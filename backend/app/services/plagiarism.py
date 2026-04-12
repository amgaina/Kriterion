"""
Plagiarism Detection Service - powered by JPlag (Greedy String Tiling).

Runs JPlag v4.3.0 as a subprocess to compare all submissions for an assignment.
Falls back to a lightweight n-gram / Jaccard approach when the JPlag JAR is
unavailable (e.g. local development without Docker).
"""

import os
import re
import json
import shutil
import hashlib
import zipfile
import subprocess
import tempfile
from typing import Dict, List, Tuple, Optional, Set
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import and_

from app.models.submission import (
    Submission, SubmissionFile, PlagiarismMatch, SubmissionStatus,
)
from app.models.assignment import Assignment
from app.models.language import Language
from app.core.logging import logger

JPLAG_JAR = os.environ.get("JPLAG_JAR", "/opt/jplag.jar")

JPLAG_LANGUAGE_MAP = {
    "python": "python3",
    "python3": "python3",
    "java": "java",
}

FILE_EXT_MAP = {
    "python": ".py", "python3": ".py",
    "java": ".java",
}


def _jplag_available() -> bool:
    return os.path.isfile(JPLAG_JAR)


# ═══════════════════════════════════════════════════════════════════
#  Lightweight fallback (n-gram / Jaccard) - used when JPlag JAR
#  is not present (local dev, CI, etc.)
# ═══════════════════════════════════════════════════════════════════

_COMMENT_PATTERNS = {
    "python": [r'#.*$', r'"""[\s\S]*?"""', r"'''[\s\S]*?'''"],
    "java": [r'//.*$', r'/\*[\s\S]*?\*/'],
}
_STRING_PAT = re.compile(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'')
_WS_PAT = re.compile(r'\s+')


def _strip_comments(code: str, lang: str) -> str:
    for pat in _COMMENT_PATTERNS.get(lang, _COMMENT_PATTERNS["java"]):
        code = re.sub(pat, '', code, flags=re.MULTILINE)
    return code


def _normalise(code: str, lang: str = "python") -> str:
    code = _strip_comments(code, lang)
    code = _STRING_PAT.sub('"S"', code)
    code = _WS_PAT.sub(' ', code)
    return code.strip().lower()


def _ngrams(tokens: List[str], n: int = 5) -> List[Tuple[str, ...]]:
    if len(tokens) < n:
        return [tuple(tokens)]
    return [tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]


def _fingerprint(code: str, lang: str = "python", n: int = 5) -> set:
    normalised = _normalise(code, lang)
    tokens = normalised.split()
    return {hashlib.md5('|'.join(g).encode()).hexdigest()
            for g in _ngrams(tokens, n)}


def _jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 0.0
    union = a | b
    return (len(a & b) / len(union)) * 100 if union else 0.0


def _find_matching_snippets(
    code_a: str, code_b: str, lang: str, window: int = 4
) -> List[Dict]:
    lines_a, lines_b = code_a.splitlines(), code_b.splitlines()
    norm_a = [_normalise(l, lang) for l in lines_a]
    norm_b = [_normalise(l, lang) for l in lines_b]
    matches: List[Dict] = []
    i = 0
    while i < len(norm_a):
        best_j, best_len = -1, 0
        for j in range(len(norm_b)):
            ml = 0
            while (i + ml < len(norm_a) and j + ml < len(norm_b)
                   and norm_a[i + ml] == norm_b[j + ml]
                   and norm_a[i + ml].strip()):
                ml += 1
            if ml >= window and ml > best_len:
                best_j, best_len = j, ml
        if best_len >= window:
            matches.append({
                "source_line_start": i + 1,
                "source_line_end": i + best_len,
                "matched_line_start": best_j + 1,
                "matched_line_end": best_j + best_len,
                "source_code_snippet": '\n'.join(lines_a[i:i + best_len]),
                "matched_code_snippet": '\n'.join(lines_b[best_j:best_j + best_len]),
            })
            i += best_len
        else:
            i += 1
    return matches


# ═══════════════════════════════════════════════════════════════════
#  Main service class
# ═══════════════════════════════════════════════════════════════════

class PlagiarismService:
    def __init__(self, db: Session):
        self.db = db

    # ── helpers ───────────────────────────────────────────────────

    @staticmethod
    def _jplag_lang(lang: str) -> str:
        return JPLAG_LANGUAGE_MAP.get(lang.lower(), "text")

    @staticmethod
    def _file_ext(lang: str) -> str:
        return FILE_EXT_MAP.get(lang.lower(), ".txt")

    def _read_submission_code(self, sub: Submission) -> str:
        parts: List[str] = []
        if sub.code:
            parts.append(sub.code)
        for f in (sub.files or []):
            path = f.file_path or ""
            try:
                if path.startswith("http"):
                    from app.services.s3_storage import s3_service
                    import tempfile as _tf
                    s3_key = path.split(".amazonaws.com/")[-1] if ".amazonaws.com/" in path else path
                    with _tf.NamedTemporaryFile(delete=False, suffix=f.filename) as tmp:
                        s3_service.download_submission_file(s3_key, tmp.name)
                        with open(tmp.name, 'r', encoding='utf-8', errors='replace') as fh:
                            c = fh.read()
                            if c.strip():
                                parts.append(c)
                        os.unlink(tmp.name)
                elif path:
                    fp = Path(path)
                    if fp.exists() and fp.is_file():
                        with open(fp, 'r', encoding='utf-8', errors='replace') as fh:
                            c = fh.read()
                            if c.strip():
                                parts.append(c)
            except Exception as e:
                logger.warning(f"Could not read file {f.filename}: {e}")
        return '\n'.join(parts)

    def _latest_per_student(
        self, assignment_id: int
    ) -> Dict[int, Submission]:
        all_subs = (
            self.db.query(Submission)
            .options(joinedload(Submission.files), joinedload(Submission.student))
            .filter(Submission.assignment_id == assignment_id)
            .all()
        )
        latest: Dict[int, Submission] = {}
        for s in all_subs:
            ex = latest.get(s.student_id)
            if not ex or s.attempt_number > ex.attempt_number:
                latest[s.student_id] = s
        return latest

    # ── write submission files for JPlag ─────────────────────────

    def _write_sub_dir(
        self, sub: Submission, root: str, lang: str
    ) -> Optional[str]:
        """Write submission files into root/sub_<id>/."""
        d = os.path.join(root, f"sub_{sub.id}")
        os.makedirs(d, exist_ok=True)
        ext = self._file_ext(lang)
        wrote = False

        if sub.code and sub.code.strip():
            with open(os.path.join(d, f"main{ext}"), 'w', encoding='utf-8') as f:
                f.write(sub.code)
            wrote = True

        for sf in (sub.files or []):
            path = sf.file_path or ""
            fname = sf.filename or f"file_{sf.id}{ext}"
            target = os.path.join(d, fname)
            try:
                if path.startswith("http"):
                    from app.services.s3_storage import s3_service
                    s3_key = path.split(".amazonaws.com/")[-1] if ".amazonaws.com/" in path else path
                    s3_service.download_submission_file(s3_key, target)
                    wrote = True
                elif path:
                    p = Path(path)
                    if p.exists() and p.is_file():
                        shutil.copy2(str(p), target)
                        wrote = True
            except Exception as e:
                logger.warning(f"Could not write {fname} for sub {sub.id}: {e}")

        if not wrote:
            shutil.rmtree(d, ignore_errors=True)
            return None
        return d

    # ── JPlag execution & parsing ────────────────────────────────

    def _find_result_archive(self, base: str) -> Optional[str]:
        for candidate in [f"{base}.zip", f"{base}.jplag", base]:
            if os.path.isfile(candidate):
                try:
                    if zipfile.is_zipfile(candidate):
                        return candidate
                except Exception:
                    pass
        parent = os.path.dirname(base) or "."
        if os.path.isdir(parent):
            for f in sorted(os.listdir(parent)):
                fp = os.path.join(parent, f)
                if os.path.isfile(fp) and (f.endswith(".zip") or f.endswith(".jplag")):
                    return fp
        return None

    def _parse_archive(self, archive_path: str) -> Dict:
        extract = tempfile.mkdtemp(prefix="jplag_ex_")
        try:
            with zipfile.ZipFile(archive_path, 'r') as zf:
                zf.extractall(extract)
            return self._parse_result_dir(extract)
        finally:
            shutil.rmtree(extract, ignore_errors=True)

    def _parse_result_dir(self, d: str) -> Dict:
        result: Dict = {"top_comparisons": [], "comparisons": {}}
        for name in ["topComparisons.json", "overview.json"]:
            fp = os.path.join(d, name)
            if os.path.exists(fp):
                with open(fp) as f:
                    result["top_comparisons"] = json.load(f)
                break
        comp_dir = os.path.join(d, "comparisons")
        if os.path.isdir(comp_dir):
            for fname in os.listdir(comp_dir):
                if fname.endswith(".json"):
                    with open(os.path.join(comp_dir, fname)) as f:
                        key = fname.replace(".json", "")
                        result["comparisons"][key] = json.load(f)
        return result

    def _run_jplag(self, subs_dir: str, lang: str) -> Dict:
        """Execute JPlag CLI and return parsed results."""
        jplag_lang = self._jplag_lang(lang)
        result_dir = tempfile.mkdtemp(prefix="jplag_res_")
        result_base = os.path.join(result_dir, "result")

        try:
            cmd = [
                "java", "-jar", JPLAG_JAR,
                subs_dir,
                "-l", jplag_lang,
                "-r", result_base,
                "-n", "-1",
                "--cluster-skip",
                "-M", "RUN",
            ]
            logger.info(f"Running JPlag: {' '.join(cmd)}")
            proc = subprocess.run(
                cmd, capture_output=True, text=True, timeout=600,
            )
            if proc.returncode != 0:
                logger.error(f"JPlag stderr: {proc.stderr[:2000]}")
                raise RuntimeError(
                    f"JPlag exited with code {proc.returncode}: "
                    f"{proc.stderr[:500]}"
                )
            logger.info(f"JPlag completed successfully")

            archive = self._find_result_archive(result_base)
            if archive:
                return self._parse_archive(archive)
            if os.path.isdir(result_base):
                return self._parse_result_dir(result_base)
            for item in os.listdir(result_dir):
                item_path = os.path.join(result_dir, item)
                if os.path.isdir(item_path):
                    return self._parse_result_dir(item_path)
            raise RuntimeError("Could not locate JPlag output")
        finally:
            shutil.rmtree(result_dir, ignore_errors=True)

    @staticmethod
    def _extract_similarity(tc: Dict) -> float:
        """Extract % similarity from a topComparisons entry."""
        sims = tc.get("similarities", tc.get("similarity", {}))
        if isinstance(sims, dict):
            val = sims.get("AVG", sims.get("MAX", sims.get("avg",
                    sims.get("max", 0))))
        elif isinstance(sims, (int, float)):
            val = sims
        else:
            val = 0
        if isinstance(val, (int, float)) and 0 <= val <= 1:
            val *= 100
        return round(float(val), 1)

    @staticmethod
    def _extract_line(pos) -> int:
        """Extract a line number from a JPlag position field."""
        if isinstance(pos, dict):
            return pos.get("line", pos.get("token", 1))
        if isinstance(pos, int):
            return max(pos, 1)
        return 1

    def _extract_matches_from_comp(self, comp: Dict) -> List[Dict]:
        """Parse match regions from a JPlag comparison JSON."""
        out: List[Dict] = []
        for m in comp.get("matches", []):
            s1 = self._extract_line(m.get("startInFirst", m.get("start1", 1)))
            e1 = self._extract_line(m.get("endInFirst", m.get("end1", s1)))
            s2 = self._extract_line(m.get("startInSecond", m.get("start2", 1)))
            e2 = self._extract_line(m.get("endInSecond", m.get("end2", s2)))
            tokens = m.get("tokens", max(e1 - s1 + 1, 1))

            if e1 <= s1:
                e1 = s1 + max(tokens // 3, 1)
            if e2 <= s2:
                e2 = s2 + max(tokens // 3, 1)

            out.append({
                "source_line_start": s1,
                "source_line_end": e1,
                "matched_line_start": s2,
                "matched_line_end": e2,
                "tokens": tokens,
                "first_file": m.get("firstFile", m.get("file1", "")),
                "second_file": m.get("secondFile", m.get("file2", "")),
            })
        return out

    # ── core: run check for whole assignment ─────────────────────

    def _run_jplag_for_assignment(self, assignment: Assignment) -> Dict:
        """Run JPlag once for all latest submissions and return structured
        pair-wise results."""
        language = "python"
        try:
            if assignment.language and assignment.language.name:
                language = assignment.language.name.lower()
        except Exception:
            pass

        student_latest = self._latest_per_student(assignment.id)
        if len(student_latest) < 2:
            return {"pairs": {}, "language": language}

        work_dir = tempfile.mkdtemp(prefix="jplag_subs_")
        folder_map: Dict[str, Submission] = {}
        try:
            for sub in student_latest.values():
                sub_dir = self._write_sub_dir(sub, work_dir, language)
                if sub_dir:
                    folder_map[os.path.basename(sub_dir)] = sub

            if len(folder_map) < 2:
                return {"pairs": {}, "language": language}

            jplag_out = self._run_jplag(work_dir, language)

            pairs: Dict[Tuple[int, int], Dict] = {}
            for tc in jplag_out.get("top_comparisons", []):
                first = tc.get("firstSubmission", tc.get("first_submission", ""))
                second = tc.get("secondSubmission", tc.get("second_submission", ""))
                sub_a = folder_map.get(first)
                sub_b = folder_map.get(second)
                if not sub_a or not sub_b:
                    continue

                similarity = self._extract_similarity(tc)

                comp_key = f"{first}-{second}"
                comp_alt = f"{second}-{first}"
                comp_data = jplag_out["comparisons"].get(
                    comp_key, jplag_out["comparisons"].get(comp_alt, {}))
                matches = self._extract_matches_from_comp(comp_data)

                pairs[(sub_a.id, sub_b.id)] = {
                    "sub_a": sub_a,
                    "sub_b": sub_b,
                    "similarity": similarity,
                    "matches": matches,
                }
            return {"pairs": pairs, "language": language}
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

    # ── fallback (n-gram / Jaccard) ──────────────────────────────

    def _run_fallback_for_assignment(self, assignment: Assignment) -> Dict:
        """Original n-gram/Jaccard comparison as a fallback."""
        language = "python"
        try:
            if assignment.language and assignment.language.name:
                language = assignment.language.name.lower()
        except Exception:
            pass

        student_latest = self._latest_per_student(assignment.id)
        if len(student_latest) < 2:
            return {"pairs": {}, "language": language}

        sub_code: Dict[int, Tuple[Submission, str, set]] = {}
        for sub in student_latest.values():
            code = self._read_submission_code(sub)
            if code.strip():
                fp = _fingerprint(code, language)
                sub_code[sub.id] = (sub, code, fp)

        if len(sub_code) < 2:
            return {"pairs": {}, "language": language}

        ids = list(sub_code.keys())
        pairs: Dict[Tuple[int, int], Dict] = {}
        for i in range(len(ids)):
            for j in range(i + 1, len(ids)):
                sa, code_a, fp_a = sub_code[ids[i]]
                sb, code_b, fp_b = sub_code[ids[j]]
                sim = _jaccard(fp_a, fp_b)
                if sim < 15:
                    continue
                snippets = _find_matching_snippets(code_a, code_b, language)
                pairs[(sa.id, sb.id)] = {
                    "sub_a": sa,
                    "sub_b": sb,
                    "similarity": round(sim, 1),
                    "matches": [
                        {**s, "tokens": 0, "first_file": "", "second_file": ""}
                        for s in snippets
                    ],
                }
        return {"pairs": pairs, "language": language}

    # ── choose engine ────────────────────────────────────────────

    def _run_engine(self, assignment: Assignment) -> Dict:
        if _jplag_available():
            try:
                return self._run_jplag_for_assignment(assignment)
            except Exception as e:
                logger.error(f"JPlag failed, falling back to n-gram: {e}")
        logger.info("Using fallback n-gram/Jaccard engine")
        return self._run_fallback_for_assignment(assignment)

    # ── store / update helpers ───────────────────────────────────

    def _code_snippet_for_lines(
        self, sub: Submission, start: int, end: int, max_len: int = 2000
    ) -> str:
        code = self._read_submission_code(sub)
        lines = code.splitlines()
        selected = lines[max(start - 1, 0):end]
        return '\n'.join(selected)[:max_len]

    def _update_other(
        self,
        other: Submission,
        source_sub: Submission,
        similarity: float,
        snippets: List[Dict],
        threshold: float,
    ):
        """Flag the matched student and update their plagiarism_report."""
        sim_rounded = round(similarity, 1)
        source_name = (
            source_sub.student.full_name
            if source_sub.student
            else f"Student #{source_sub.student_id}"
        )

        other.plagiarism_checked = True
        if sim_rounded > (other.plagiarism_score or 0):
            other.plagiarism_score = sim_rounded
        if similarity >= threshold:
            other.plagiarism_flagged = True
            other.status = SubmissionStatus.FLAGGED

        rpt = other.plagiarism_report if isinstance(other.plagiarism_report, dict) else {}
        existing = [
            m for m in rpt.get("matches", [])
            if m.get("matched_submission_id") != source_sub.id
        ]
        existing.append({
            "matched_submission_id": source_sub.id,
            "student_name": source_name,
            "student_id": source_sub.student_id,
            "similarity_percentage": sim_rounded,
            "snippet_count": len(snippets),
        })
        rpt["matches"] = existing
        rpt["max_similarity"] = max(
            (m["similarity_percentage"] for m in existing), default=0.0)
        rpt["checked_at"] = datetime.utcnow().isoformat()
        rpt["engine"] = "jplag" if _jplag_available() else "ngram"
        other.plagiarism_report = rpt
        flag_modified(other, "plagiarism_report")

    def _store_match_records(
        self,
        sub_a: Submission,
        sub_b: Submission,
        similarity: float,
        matches: List[Dict],
    ):
        """Persist bidirectional PlagiarismMatch rows."""
        sim_rounded = round(similarity, 1)
        now = datetime.utcnow()
        name_a = sub_a.student.full_name if sub_a.student else f"Student #{sub_a.student_id}"
        name_b = sub_b.student.full_name if sub_b.student else f"Student #{sub_b.student_id}"

        self.db.query(PlagiarismMatch).filter(and_(
            PlagiarismMatch.submission_id == sub_a.id,
            PlagiarismMatch.matched_submission_id == sub_b.id,
        )).delete()
        self.db.query(PlagiarismMatch).filter(and_(
            PlagiarismMatch.submission_id == sub_b.id,
            PlagiarismMatch.matched_submission_id == sub_a.id,
        )).delete()

        for snip in matches[:10]:
            s_start = snip.get("source_line_start", 1)
            s_end = snip.get("source_line_end", s_start)
            m_start = snip.get("matched_line_start", 1)
            m_end = snip.get("matched_line_end", m_start)

            src_snippet = snip.get(
                "source_code_snippet",
                self._code_snippet_for_lines(sub_a, s_start, s_end))
            matched_snippet = snip.get(
                "matched_code_snippet",
                self._code_snippet_for_lines(sub_b, m_start, m_end))

            self.db.add(PlagiarismMatch(
                submission_id=sub_a.id,
                matched_submission_id=sub_b.id,
                similarity_percentage=sim_rounded,
                matched_source=name_b,
                source_code_snippet=src_snippet[:2000],
                matched_code_snippet=matched_snippet[:2000],
                source_line_start=s_start,
                source_line_end=s_end,
                matched_line_start=m_start,
                matched_line_end=m_end,
                detected_at=now,
            ))
            self.db.add(PlagiarismMatch(
                submission_id=sub_b.id,
                matched_submission_id=sub_a.id,
                similarity_percentage=sim_rounded,
                matched_source=name_a,
                source_code_snippet=matched_snippet[:2000],
                matched_code_snippet=src_snippet[:2000],
                source_line_start=m_start,
                source_line_end=m_end,
                matched_line_start=s_start,
                matched_line_end=s_end,
                detected_at=now,
            ))

    # ═════════════════════════════════════════════════════════════
    #  PUBLIC API
    # ═════════════════════════════════════════════════════════════

    def check_submission(
        self, submission_id: int, *, force: bool = False
    ) -> Dict:
        """Run plagiarism check for a single submission (compares against
        all other submissions in the same assignment via JPlag)."""

        submission = (
            self.db.query(Submission)
            .options(
                joinedload(Submission.files),
                joinedload(Submission.student),
                joinedload(Submission.assignment).joinedload(Assignment.language),
            )
            .filter(Submission.id == submission_id)
            .first()
        )
        if not submission:
            raise ValueError(f"Submission {submission_id} not found")

        if submission.plagiarism_checked and not force:
            return {
                "already_checked": True,
                "plagiarism_score": submission.plagiarism_score,
                "plagiarism_flagged": submission.plagiarism_flagged,
            }

        assignment = submission.assignment
        threshold = (
            assignment.plagiarism_threshold
            if assignment.enable_plagiarism_check
            else 100
        )

        engine_result = self._run_engine(assignment)
        pairs = engine_result["pairs"]

        max_sim = 0.0
        all_match_info: List[Dict] = []

        for (id_a, id_b), pair in pairs.items():
            if id_a != submission_id and id_b != submission_id:
                continue

            sim = pair["similarity"]
            matches = pair["matches"]
            if sim < 15:
                continue

            is_reversed = (id_a != submission_id)
            other = pair["sub_a"] if is_reversed else pair["sub_b"]

            student_name = (
                other.student.full_name
                if other.student
                else f"Student #{other.student_id}"
            )

            all_match_info.append({
                "matched_submission_id": other.id,
                "student_name": student_name,
                "student_id": other.student_id,
                "similarity_percentage": round(sim, 1),
                "snippet_count": len(matches),
            })

            if sim > max_sim:
                max_sim = sim

            oriented_matches = matches
            if is_reversed:
                oriented_matches = [
                    {
                        **m,
                        "source_line_start": m["matched_line_start"],
                        "source_line_end": m["matched_line_end"],
                        "matched_line_start": m["source_line_start"],
                        "matched_line_end": m["source_line_end"],
                        "source_code_snippet": m.get("matched_code_snippet", ""),
                        "matched_code_snippet": m.get("source_code_snippet", ""),
                    }
                    for m in matches
                ]

            self._update_other(other, submission, sim, matches, threshold)

            if sim >= 20 and matches:
                if is_reversed:
                    self._store_match_records(other, submission, sim, matches)
                else:
                    self._store_match_records(submission, other, sim, matches)

        flagged = max_sim >= threshold
        submission.plagiarism_checked = True
        submission.plagiarism_score = round(max_sim, 1)
        submission.plagiarism_flagged = flagged
        submission.plagiarism_report = {
            "max_similarity": round(max_sim, 1),
            "comparisons": len(all_match_info),
            "matches": all_match_info,
            "checked_at": datetime.utcnow().isoformat(),
            "engine": "jplag" if _jplag_available() else "ngram",
        }
        if flagged:
            submission.status = SubmissionStatus.FLAGGED
        flag_modified(submission, "plagiarism_report")

        self.db.commit()
        self.db.refresh(submission)

        return {
            "plagiarism_score": round(max_sim, 1),
            "plagiarism_flagged": flagged,
            "comparisons": len(all_match_info),
            "matches": all_match_info,
        }

    def check_all_for_assignment(self, assignment_id: int) -> Dict:
        """Batch plagiarism check - runs JPlag once for all submissions."""
        assignment = (
            self.db.query(Assignment)
            .options(joinedload(Assignment.language))
            .filter(Assignment.id == assignment_id)
            .first()
        )
        if not assignment:
            raise ValueError(f"Assignment {assignment_id} not found")

        threshold = (
            assignment.plagiarism_threshold
            if assignment.enable_plagiarism_check
            else 100
        )

        engine_result = self._run_engine(assignment)
        pairs = engine_result["pairs"]

        student_latest = self._latest_per_student(assignment_id)

        sub_max_sim: Dict[int, float] = {}
        sub_matches_info: Dict[int, List[Dict]] = {}

        for (id_a, id_b), pair in pairs.items():
            sim = pair["similarity"]
            matches = pair["matches"]
            sub_a, sub_b = pair["sub_a"], pair["sub_b"]

            for sid, other_sub in [(id_a, sub_b), (id_b, sub_a)]:
                if sim > sub_max_sim.get(sid, 0):
                    sub_max_sim[sid] = sim
                name = (other_sub.student.full_name
                        if other_sub.student
                        else f"Student #{other_sub.student_id}")
                sub_matches_info.setdefault(sid, []).append({
                    "matched_submission_id": other_sub.id,
                    "student_name": name,
                    "student_id": other_sub.student_id,
                    "similarity_percentage": round(sim, 1),
                    "snippet_count": len(matches),
                })

            if sim >= 20 and matches:
                self._store_match_records(sub_a, sub_b, sim, matches)

        results = []
        for sub in student_latest.values():
            ms = sub_max_sim.get(sub.id, 0.0)
            fl = ms >= threshold
            mi = sub_matches_info.get(sub.id, [])

            sub.plagiarism_checked = True
            sub.plagiarism_score = round(ms, 1)
            sub.plagiarism_flagged = fl
            sub.plagiarism_report = {
                "max_similarity": round(ms, 1),
                "comparisons": len(mi),
                "matches": mi,
                "checked_at": datetime.utcnow().isoformat(),
                "engine": "jplag" if _jplag_available() else "ngram",
            }
            if fl:
                sub.status = SubmissionStatus.FLAGGED
            flag_modified(sub, "plagiarism_report")

            results.append({
                "submission_id": sub.id,
                "plagiarism_score": round(ms, 1),
                "plagiarism_flagged": fl,
            })

        self.db.commit()

        return {
            "assignment_id": assignment_id,
            "total_checked": len(results),
            "results": results,
            "engine": "jplag" if _jplag_available() else "ngram",
        }

    def get_matches(self, submission_id: int) -> List[PlagiarismMatch]:
        return (
            self.db.query(PlagiarismMatch)
            .filter(PlagiarismMatch.submission_id == submission_id)
            .order_by(PlagiarismMatch.similarity_percentage.desc())
            .all()
        )

    def review_match(
        self,
        match_id: int,
        is_confirmed: bool,
        reviewer_notes: str,
        reviewer_id: int,
    ) -> PlagiarismMatch:
        match = (
            self.db.query(PlagiarismMatch)
            .filter(PlagiarismMatch.id == match_id)
            .first()
        )
        if not match:
            raise ValueError(f"PlagiarismMatch {match_id} not found")

        match.is_reviewed = True
        match.is_confirmed = is_confirmed
        match.reviewer_notes = reviewer_notes
        match.reviewed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(match)
        return match
