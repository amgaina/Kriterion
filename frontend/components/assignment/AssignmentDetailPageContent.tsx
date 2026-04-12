'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { format } from 'date-fns';
import {
    ArrowLeft,
    FileText,
    Clock,
    Calendar,
    Target,
    Code,
    AlertCircle,
    Loader2,
    CheckCircle2,
    Edit,
    Eye,
    EyeOff,
    Shield,
    Users,
    RefreshCw,
    FlaskConical,
    Trash2,
    Search,
    ChevronDown,
    ChevronRight,
    X,
    User,
    AlertTriangle,
    Inbox,
    Plus,
    Save,
    Download,
} from 'lucide-react';

/* ====================================================================
   TYPES
   ==================================================================== */

interface TestCaseItem {
    id: number;
    assignment_id: number;
    name: string;
    description?: string;
    input_data?: string;
    expected_output?: string;
    is_hidden: boolean;
    ignore_whitespace: boolean;
    ignore_case: boolean;
    use_regex: boolean;
    time_limit_seconds?: number;
    memory_limit_mb?: number;
    order: number;
    created_at?: string;
    updated_at?: string;
}

interface RubricItem {
    id: number;
    name: string;
    description?: string | null;
    weight?: number;
    points: number;
    min_points: number;
    max_points: number;
}

interface Assignment {
    id: number;
    course_id: number;
    title: string;
    description?: string;
    instructions?: string;
    due_date?: string;
    is_published: boolean;
    grades_published: boolean;
    max_score: number;
    passing_score: number;
    max_attempts: number;
    allow_late: boolean;
    late_penalty_per_day?: number;
    max_late_days?: number;
    language_id?: number;
    enable_plagiarism_check: boolean;
    enable_ai_detection: boolean;
    plagiarism_threshold?: number;
    ai_detection_threshold?: number;
    allow_groups: boolean;
    max_group_size?: number;
    max_file_size_mb?: number;
    submission_count?: number;
    test_cases?: TestCaseItem[];
    rubric?: { items: RubricItem[]; total_points: number } | null;
    created_at: string;
    updated_at?: string;
}

interface CourseForHeader {
    id: number;
    code: string;
    name: string;
    color?: string | null;
}

interface StudentInfo {
    id: number;
    full_name: string;
    email: string;
    student_id?: string;
}

interface GroupMemberInfo {
    id: number;
    user_id: number;
    full_name: string;
    email: string;
    student_id: string | null;
    is_leader: boolean;
}

interface GroupInfo {
    id: number;
    name: string;
    members: GroupMemberInfo[];
}

interface SubmissionItem {
    id: number;
    assignment_id: number;
    student_id: number;
    student?: StudentInfo;
    group_id?: number | null;
    group?: GroupInfo | null;
    attempt_number: number;
    status: string;
    submitted_at: string;
    is_late: boolean;
    late_penalty_applied: number;
    tests_passed: number;
    tests_total: number;
    test_score: number | null;
    rubric_score: number | null;
    raw_score: number | null;
    final_score: number | null;
    max_score: number;
    override_score: number | null;
    feedback: string | null;
    plagiarism_checked: boolean;
    plagiarism_score: number | null;
    plagiarism_flagged: boolean;
    plagiarism_report: any;
    ai_checked: boolean;
    ai_score: number | null;
    ai_flagged: boolean;
    error_message: string | null;
    created_at: string;
}

interface StudentGroup {
    student: StudentInfo;
    submissions: SubmissionItem[];
    latestSubmission: SubmissionItem;
    bestScore: number | null;
    totalAttempts: number;
}

interface AssignmentGroupEntry {
    groupId: number;
    groupName: string;
    members: GroupMemberInfo[];
    submissions: SubmissionItem[];
    latestSubmission: SubmissionItem;
    bestScore: number | null;
}

interface BulkRunResult {
    studentId: number;
    studentName: string;
    submissionId: number;
    status: 'graded' | 'manual_review' | 'error';
    testScore?: number;
    rawScore?: number;
    finalScore?: number | null;
    testsPassed?: number;
    totalTests?: number;
    errorMessage?: string;
}

/* ====================================================================
   HELPERS
   ==================================================================== */

const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const formatDateTime = (dateString: string) =>
    format(new Date(dateString), 'MMM dd, yyyy · hh:mm a');


const getStatusBadge = (status: string) => {
    switch (status) {
        case 'completed': case 'autograded':
            return 'bg-green-100 text-green-700 border-green-200';
        case 'pending':
            return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'error':
            return 'bg-red-100 text-red-700 border-red-200';
        case 'flagged':
            return 'bg-orange-100 text-orange-700 border-orange-200';
        default:
            return 'bg-gray-100 text-gray-700 border-gray-200';
    }
};

const formatStatus = (status: string) => {
    switch (status) {
        case 'autograded': return 'Auto-graded';
        case 'manual_review': return 'Needs Review';
        case 'completed': return 'Completed';
        case 'graded': return 'Graded';
        case 'pending': return 'Pending';
        case 'error': return 'Error';
        default: return status ? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Unknown';
    }
};

const getScoreColor = (score: number | null, max: number) => {
    if (score === null) return 'text-gray-400';
    const pct = (score / max) * 100;
    if (pct >= 90) return 'text-green-600';
    if (pct >= 70) return 'text-blue-600';
    if (pct >= 50) return 'text-amber-600';
    return 'text-red-600';
};

/* ====================================================================
   COMPONENT
   ==================================================================== */

export default function AssignmentDetailPageContent() {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const queryClient = useQueryClient();
    const basePath = (typeof pathname === 'string' && pathname.startsWith('/assistant/')) ? 'assistant' : 'faculty';

    const courseParam = params?.courseId as string | string[] | undefined;
    const assignmentParam = params?.assignmentId as string | string[] | undefined;
    const courseIdStr = Array.isArray(courseParam) ? (courseParam[0] ?? '') : (courseParam ?? '');
    const assignmentIdStr = Array.isArray(assignmentParam) ? (assignmentParam[0] ?? '') : (assignmentParam ?? '');
    const courseId = useMemo(() => parseInt(courseIdStr, 10), [courseIdStr]);
    const assignmentId = useMemo(() => parseInt(assignmentIdStr, 10), [assignmentIdStr]);

    const [activeTab, setActiveTab] = useState<'overview' | 'submissions' | 'plagiarism'>('overview');
    const [searchQuery, setSearchQuery] = useState('');

    // Test case management state
    const [editingTC, setEditingTC] = useState<TestCaseItem | null>(null);
    const [isAddingTC, setIsAddingTC] = useState(false);
    const [savingTC, setSavingTC] = useState(false);
    const [deletingTCId, setDeletingTCId] = useState<number | null>(null);
    const [tcForm, setTCForm] = useState<Partial<TestCaseItem>>({});
    const [tcError, setTCError] = useState<string | null>(null);
    const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());
    const [expandedPlagiarismStudent, setExpandedPlagiarismStudent] = useState<number | null>(null);
    const [plagiarismMatchesMap, setPlagiarismMatchesMap] = useState<Record<number, any[]>>({});
    const [loadingMatches, setLoadingMatches] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<'name' | 'score' | 'date' | 'attempts'>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    // Bulk run (autograde latest submission for each student)
    const [bulkRunning, setBulkRunning] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<{ total: number; completed: number }>({ total: 0, completed: 0 });
    const [bulkResults, setBulkResults] = useState<BulkRunResult[]>([]);
    const [bulkError, setBulkError] = useState<string | null>(null);
    const [bulkModalOpen, setBulkModalOpen] = useState(false);

    const { data: assignment, isLoading, error } = useQuery({
        queryKey: ['assignment', assignmentId],
        queryFn: () => apiClient.getAssignment(assignmentId) as Promise<Assignment>,
        enabled: !!assignmentId,
    });

    const { data: course } = useQuery<CourseForHeader>({
        queryKey: ['course-shell', courseId],
        queryFn: () => apiClient.getCourse(courseId) as Promise<CourseForHeader>,
        enabled: !!courseId,
    });

    const { data: submissions = [], isLoading: isLoadingSubs } = useQuery<SubmissionItem[]>({
        queryKey: ['assignment-submissions', assignmentId],
        queryFn: () => apiClient.getAssignmentSubmissions(assignmentId),
        enabled: !!assignmentId && (activeTab === 'submissions' || activeTab === 'plagiarism'),
    });

    const publishMutation = useMutation({
        mutationFn: () => apiClient.publishAssignment(assignmentId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignment', assignmentId] }),
    });

    const [publishGradesConfirm, setPublishGradesConfirm] = useState(false);
    const [publishGradesSuccess, setPublishGradesSuccess] = useState(false);
    const publishGradesMutation = useMutation({
        mutationFn: () => apiClient.publishGrades(assignmentId),
        onSuccess: () => {
            setPublishGradesConfirm(false);
            setPublishGradesSuccess(true);
            queryClient.invalidateQueries({ queryKey: ['assignment', assignmentId] });
        },
    });

    const [hideGradesConfirm, setHideGradesConfirm] = useState(false);
    const hideGradesMutation = useMutation({
        mutationFn: () => apiClient.hideGrades(assignmentId),
        onSuccess: () => {
            setHideGradesConfirm(false);
            queryClient.invalidateQueries({ queryKey: ['assignment', assignmentId] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => apiClient.deleteAssignment(assignmentId),
        onSuccess: () => router.push(`/${basePath}/courses/${courseId}/assignments`),
    });

    const [plagiarismRunning, setPlagiarismRunning] = useState(false);
    const [plagiarismResult, setPlagiarismResult] = useState<any>(null);

    const runPlagiarismCheckAll = async () => {
        setPlagiarismRunning(true);
        setPlagiarismResult(null);
        try {
            const result = await apiClient.checkPlagiarismAll(assignmentId);
            setPlagiarismResult(result);
            setPlagiarismMatchesMap({});
            setExpandedPlagiarismStudent(null);
            queryClient.invalidateQueries({ queryKey: ['assignment-submissions', assignmentId] });
        } catch (err: any) {
            setPlagiarismResult({ error: err?.response?.data?.detail || 'Plagiarism check failed' });
        } finally {
            setPlagiarismRunning(false);
        }
    };

    const downloadPlagiarismReport = useCallback(() => {
        if (!assignment || submissions.length === 0) return;

        const studentMap = new Map<number, SubmissionItem>();
        for (const sub of submissions) {
            const existing = studentMap.get(sub.student_id);
            if (!existing || new Date(sub.submitted_at) > new Date(existing.submitted_at)) {
                studentMap.set(sub.student_id, sub);
            }
        }
        const studentSubs = Array.from(studentMap.values())
            .sort((a, b) => (b.plagiarism_score ?? 0) - (a.plagiarism_score ?? 0));

        const rows: string[] = [];
        rows.push([
            'Student Name', 'Student Email', 'Student ID', 'Submission ID',
            'Similarity %', 'Flagged', 'Status', 'Matched With', 'Score', 'Submitted At'
        ].join(','));

        for (const sub of studentSubs) {
            const name = sub.student?.full_name || `Student #${sub.student_id}`;
            const email = sub.student?.email || '';
            const sid = sub.student?.student_id || '';
            const similarity = sub.plagiarism_checked ? (sub.plagiarism_score ?? 0).toFixed(1) : 'Not Checked';
            const flagged = sub.plagiarism_flagged ? 'YES' : 'No';
            const matchedWith = (sub.plagiarism_report?.matches || [])
                .map((m: any) => `${m.student_name} (${m.similarity_percentage.toFixed(1)}%)`)
                .join('; ') || 'None';
            const score = sub.final_score !== null ? `${sub.final_score.toFixed(1)}/${sub.max_score}` : 'Not Graded';
            const submitted = format(new Date(sub.submitted_at), 'yyyy-MM-dd HH:mm');

            const escapeCsv = (v: string) => `"${v.replace(/"/g, '""')}"`;
            rows.push([
                escapeCsv(name), escapeCsv(email), escapeCsv(sid), String(sub.id),
                similarity, flagged, sub.status, escapeCsv(matchedWith), score, submitted
            ].join(','));
        }

        const csv = rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `plagiarism-report-${assignment.title.replace(/[^a-zA-Z0-9]/g, '_')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [assignment, submissions]);

    const runBulkGrading = useCallback(async () => {
        if (!assignment || bulkRunning) return;

        const groups: StudentGroup[] = (() => {
            const map = new Map<number, SubmissionItem[]>();
            for (const sub of submissions) {
                const sid = sub.student_id;
                if (!map.has(sid)) map.set(sid, []);
                map.get(sid)!.push(sub);
            }

            const out: StudentGroup[] = [];
            for (const [, subs] of map) {
                const sorted = [...subs].sort((a, b) =>
                    new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
                );
                const latest = sorted[0];
                const best = sorted.reduce<number | null>((acc, s) => {
                    if (s.final_score === null) return acc;
                    return acc === null ? s.final_score : Math.max(acc, s.final_score);
                }, null);

                out.push({
                    student: latest.student || { id: latest.student_id, full_name: 'Unknown', email: '', student_id: undefined },
                    submissions: sorted,
                    latestSubmission: latest,
                    bestScore: best,
                    totalAttempts: sorted.length,
                });
            }
            return out;
        })();

        if (groups.length === 0) return;

        setBulkRunning(true);
        setBulkError(null);
        setBulkResults([]);
        setBulkProgress({ total: groups.length, completed: 0 });

        for (const group of groups) {
            const latest = group.latestSubmission;
            try {
                const result: any = await apiClient.gradeSubmission(latest.id);
                setBulkResults(prev => [
                    ...prev,
                    {
                        studentId: group.student.id,
                        studentName: group.student.full_name,
                        submissionId: latest.id,
                        status: (result?.status as BulkRunResult['status']) || 'graded',
                        testScore: typeof result?.test_score === 'number' ? result.test_score : undefined,
                        rawScore: typeof result?.raw_score === 'number' ? result.raw_score : undefined,
                        finalScore: typeof result?.final_score === 'number' ? result.final_score : latest.final_score,
                        testsPassed: typeof result?.tests_passed === 'number' ? result.tests_passed : latest.tests_passed,
                        totalTests: typeof result?.total_tests === 'number' ? result.total_tests : latest.tests_total,
                    },
                ]);
            } catch (err: any) {
                const message = err?.response?.data?.detail || err?.message || 'Grading failed';
                setBulkResults(prev => [
                    ...prev,
                    {
                        studentId: group.student.id,
                        studentName: group.student.full_name,
                        submissionId: latest.id,
                        status: 'error',
                        finalScore: latest.final_score,
                        testsPassed: latest.tests_passed,
                        totalTests: latest.tests_total,
                        errorMessage: message,
                    },
                ]);
                setBulkError(prev => prev || 'Some submissions failed to grade. See results below.');
            } finally {
                setBulkProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
            }
        }

        setBulkRunning(false);
        // Refresh submissions to reflect new grades
        queryClient.invalidateQueries({ queryKey: ['assignment-submissions', assignmentId] });
    }, [assignment, submissions, bulkRunning, queryClient, assignmentId]);

    // Test case helpers
    const testCases: TestCaseItem[] = assignment?.test_cases ?? [];

    const resetTCForm = () => {
        setTCForm({
            name: '', description: '', input_data: '', expected_output: '',
            is_hidden: false,
            ignore_whitespace: true, ignore_case: false, use_regex: false,
            time_limit_seconds: undefined, memory_limit_mb: undefined, order: testCases.length,
        });
        setTCError(null);
    };

    const openAddTC = () => { resetTCForm(); setEditingTC(null); setIsAddingTC(true); };

    const openEditTC = (tc: TestCaseItem) => {
        setTCForm({ ...tc });
        setEditingTC(tc);
        setIsAddingTC(true);
        setTCError(null);
    };

    const saveTestCase = async () => {
        if (!tcForm.name?.trim()) { setTCError('Name is required'); return; }
        setSavingTC(true);
        setTCError(null);
        try {
            const payload = {
                name: tcForm.name!.trim(),
                description: tcForm.description?.trim() || null,
                input_data: tcForm.input_data?.trim() || null,
                expected_output: tcForm.expected_output?.trim() || null,
                is_hidden: tcForm.is_hidden ?? false,
                ignore_whitespace: tcForm.ignore_whitespace ?? true,
                ignore_case: tcForm.ignore_case ?? false,
                use_regex: tcForm.use_regex ?? false,
                time_limit_seconds: tcForm.time_limit_seconds || null,
                memory_limit_mb: tcForm.memory_limit_mb || null,
                order: tcForm.order ?? testCases.length,
            };
            if (editingTC) {
                await apiClient.updateTestCase(assignmentId, editingTC.id, payload);
            } else {
                await apiClient.createTestCase(assignmentId, payload);
            }
            queryClient.invalidateQueries({ queryKey: ['assignment', assignmentId] });
            setIsAddingTC(false);
            setEditingTC(null);
        } catch (err: any) {
            setTCError(err?.response?.data?.detail || 'Failed to save test case');
        } finally {
            setSavingTC(false);
        }
    };

    const deleteTestCase = async (tcId: number) => {
        setDeletingTCId(tcId);
        try {
            await apiClient.deleteTestCase(assignmentId, tcId);
            queryClient.invalidateQueries({ queryKey: ['assignment', assignmentId] });
        } catch { /* ignore */ }
        finally { setDeletingTCId(null); }
    };

    const loadMatchesForSubmission = async (submissionId: number) => {
        if (plagiarismMatchesMap[submissionId]) return;
        setLoadingMatches(submissionId);
        try {
            const matches = await apiClient.getPlagiarismMatches(submissionId);
            setPlagiarismMatchesMap(prev => ({ ...prev, [submissionId]: matches || [] }));
        } catch { /* ignore */ }
        finally { setLoadingMatches(null); }
    };

    // Group submissions by group_id (for group assignments)
    const assignmentGroupEntries: AssignmentGroupEntry[] = useMemo(() => {
        if (!assignment?.allow_groups) return [];
        const map = new Map<number, SubmissionItem[]>();
        for (const sub of submissions) {
            if (!sub.group_id) continue;
            if (!map.has(sub.group_id)) map.set(sub.group_id, []);
            map.get(sub.group_id)!.push(sub);
        }
        const entries: AssignmentGroupEntry[] = [];
        for (const [groupId, subs] of map) {
            const sorted = [...subs].sort((a, b) =>
                new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
            );
            const latest = sorted[0];
            const groupInfo = latest.group;
            const best = sorted.reduce<number | null>((acc, s) => {
                if (s.final_score === null) return acc;
                return acc === null ? s.final_score : Math.max(acc, s.final_score);
            }, null);
            entries.push({
                groupId,
                groupName: groupInfo?.name ?? `Group ${groupId}`,
                members: groupInfo?.members ?? [],
                submissions: sorted,
                latestSubmission: latest,
                bestScore: best,
            });
        }
        return entries.sort((a, b) => a.groupName.localeCompare(b.groupName));
    }, [submissions, assignment?.allow_groups]);

    // Group submissions by student
    const studentGroups: StudentGroup[] = useMemo(() => {
        const map = new Map<number, SubmissionItem[]>();
        for (const sub of submissions) {
            const sid = sub.student_id;
            if (!map.has(sid)) map.set(sid, []);
            map.get(sid)!.push(sub);
        }

        const groups: StudentGroup[] = [];
        for (const [, subs] of map) {
            const sorted = [...subs].sort((a, b) =>
                new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
            );
            const latest = sorted[0];
            const best = sorted.reduce<number | null>((acc, s) => {
                if (s.final_score === null) return acc;
                return acc === null ? s.final_score : Math.max(acc, s.final_score);
            }, null);

            groups.push({
                student: latest.student || { id: latest.student_id, full_name: 'Unknown', email: '', student_id: undefined },
                submissions: sorted,
                latestSubmission: latest,
                bestScore: best,
                totalAttempts: sorted.length,
            });
        }

        return groups;
    }, [submissions]);

    // Filter and sort
    const filteredGroups = useMemo(() => {
        let result = studentGroups;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(g =>
                g.student.full_name.toLowerCase().includes(q) ||
                g.student.email.toLowerCase().includes(q) ||
                (g.student.student_id?.toLowerCase().includes(q))
            );
        }

        result.sort((a, b) => {
            let cmp = 0;
            switch (sortBy) {
                case 'name':
                    cmp = a.student.full_name.localeCompare(b.student.full_name);
                    break;
                case 'score':
                    cmp = (a.bestScore ?? -1) - (b.bestScore ?? -1);
                    break;
                case 'date':
                    cmp = new Date(a.latestSubmission.submitted_at).getTime() - new Date(b.latestSubmission.submitted_at).getTime();
                    break;
                case 'attempts':
                    cmp = a.totalAttempts - b.totalAttempts;
                    break;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [studentGroups, searchQuery, sortBy, sortDir]);

    // Stats
    const stats = useMemo(() => {
        const total = studentGroups.length;
        const submitted = total;
        const graded = studentGroups.filter(g => g.latestSubmission.final_score !== null).length;
        const scores = studentGroups.map(g => g.bestScore).filter((s): s is number => s !== null);
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
        const passing = scores.filter(s => s >= (assignment?.passing_score ?? 60)).length;
        const late = studentGroups.filter(g => g.submissions.some(s => s.is_late)).length;
        const flagged = studentGroups.filter(g => g.submissions.some(s => s.plagiarism_flagged || s.ai_flagged)).length;
        return { total, submitted, graded, avg, passing, late, flagged, scores };
    }, [studentGroups, assignment]);

    const toggleExpanded = useCallback((studentId: number) => {
        setExpandedStudents(prev => {
            const next = new Set(prev);
            if (next.has(studentId)) next.delete(studentId);
            else next.add(studentId);
            return next;
        });
    }, []);

    const navigateToGrading = useCallback((studentId: number) => {
        router.push(`/${basePath}/courses/${courseId}/assignments/${assignmentId}/grade/${studentId}`);
    }, [router, courseId, assignmentId]);

    const handleSort = useCallback((col: typeof sortBy) => {
        if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortDir(col === 'score' ? 'desc' : 'asc'); }
    }, [sortBy]);

    /* ===== RENDER ===== */
    const accentColor = course?.color || '#862733';
    const headerGradient = useMemo(() => {
        const hex = accentColor;
        if (!hex?.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) {
            return { backgroundImage: 'linear-gradient(135deg, #862733 0%, #6b1f2a 100%)' };
        }
        const normalize = (h: string) => {
            if (h.length === 4) {
                const r = h[1]; const g = h[2]; const b = h[3];
                return `#${r}${r}${g}${g}${b}${b}`;
            }
            return h;
        };
        const h = normalize(hex);
        const r = parseInt(h.slice(1, 3), 16);
        const g = parseInt(h.slice(3, 5), 16);
        const b = parseInt(h.slice(5, 7), 16);
        const darker = `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 25)}, ${Math.max(0, b - 25)})`;
        return { backgroundImage: `linear-gradient(135deg, ${h} 0%, ${darker} 100%)` };
    }, [accentColor]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error || !assignment) {
        return (
            <div className="text-center py-20">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {error ? 'Failed to load assignment' : 'Assignment not found'}
                </h2>
                <p className="text-gray-500 mb-6">{(error as any)?.message || 'The assignment may have been deleted.'}</p>
                <Button
                    onClick={() => router.push(`/${basePath}/courses/${courseId}/assignments`)}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Assignments
                </Button>
            </div>
        );
    }

    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    const isOverdue = dueDate && dueDate < new Date();

    return (
        <>
        <div className="space-y-6 pb-8">
                    {/* ─── Header Banner ─── */}
                    <div className="rounded-2xl text-white relative overflow-hidden" style={headerGradient}>
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/20" />
                            <div className="absolute -right-5 -bottom-5 w-28 h-28 rounded-full bg-white/10" />
                        </div>
                        <div className="relative z-10 px-6 md:px-8 pt-6 md:pt-8 pb-4">
                            <button
                                onClick={() => router.push(`/${basePath}/courses/${courseId}/assignments`)}
                                className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-4 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back to Assignments
                            </button>

                            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                            <FileText className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h1 className="text-2xl md:text-3xl font-bold">{assignment.title}</h1>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-3">
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                                            assignment.is_published ? 'bg-white/20' : 'bg-white/30'
                                        }`}>
                                            {assignment.is_published ? <><Eye className="w-3 h-3" /> Published</> : <><EyeOff className="w-3 h-3" /> Draft</>}
                                        </span>
                                        {isOverdue && (
                                            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-white/30">
                                                Past Due
                                            </span>
                                        )}
                                        {dueDate && (
                                            <span className="text-white/70 text-sm flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" /> Due {formatDateTime(assignment.due_date!)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {!assignment.is_published && (
                                        <Button
                                            onClick={() => publishMutation.mutate()}
                                            disabled={publishMutation.isPending}
                                            className="bg-white/20 hover:bg-white/30 text-white border-0 gap-2"
                                        >
                                            {publishMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                                            Publish
                                        </Button>
                                    )}
                                    {assignment.is_published && !assignment.grades_published && (
                                        <Button
                                            onClick={() => setPublishGradesConfirm(true)}
                                            className="bg-white/20 hover:bg-white/30 text-white border-0 gap-2"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            Publish Grades
                                        </Button>
                                    )}
                                    {assignment.grades_published && (
                                        <Button
                                            onClick={() => setHideGradesConfirm(true)}
                                            className="bg-green-500/30 hover:bg-red-500/40 text-white border-0 gap-2"
                                        >
                                            <CheckCircle2 className="w-4 h-4" /> Grades Published · Hide
                                        </Button>
                                    )}
                                    <Link href={`/${basePath}/courses/${courseId}/assignments/${assignmentId}/edit`}>
                                        <Button className="bg-white/20 hover:bg-white/30 text-white border-0 gap-2">
                                            <Edit className="w-4 h-4" /> Edit
                                        </Button>
                                    </Link>
                                    <Button
                                        onClick={() => {
                                            if (confirm(`Delete "${assignment.title}"? This cannot be undone.`)) deleteMutation.mutate();
                                        }}
                                        className="bg-white/20 hover:bg-red-500/50 text-white border-0 gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                        {/* Tabs inside banner, matching course layout */}
                        <div className="px-4 md:px-6 pb-4 pt-0 relative z-10">
                            <div className="inline-flex items-center gap-1 rounded-xl bg-black/15 backdrop-blur-sm px-1.5 py-1.5">
                                <button
                                    onClick={() => setActiveTab('overview')}
                                    className={`relative block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                                        activeTab === 'overview'
                                            ? 'bg-white/25 text-white'
                                            : 'text-white/80 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    <span className="relative z-10 flex items-center gap-2">
                                        <FileText className="w-4 h-4" /> Overview
                                    </span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('submissions')}
                                    className={`relative block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                                        activeTab === 'submissions'
                                            ? 'bg-white/25 text-white'
                                            : 'text-white/80 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    <span className="relative z-10 flex items-center gap-2">
                                        <Users className="w-4 h-4" /> Submissions
                                        {(assignment.submission_count ?? 0) > 0 && (
                                            <span className="px-2 py-0.5 text-xs rounded-full bg-black/20 text-white font-semibold">
                                                {assignment.submission_count}
                                            </span>
                                        )}
                                    </span>
                                </button>
                                {assignment.enable_plagiarism_check && (
                                    <button
                                        onClick={() => setActiveTab('plagiarism')}
                                        className={`relative block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                                            activeTab === 'plagiarism'
                                                ? 'bg-white/25 text-white'
                                                : 'text-white/80 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        <span className="relative z-10 flex items-center gap-2">
                                            <Shield className="w-4 h-4" /> Plagiarism
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ─── Tab Content ─── */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Quick Stats */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                style={{ backgroundColor: `${accentColor}18` }}
                                            >
                                                <Target className="w-5 h-5" style={{ color: accentColor }} />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900">{assignment.max_score}</p>
                                                <p className="text-xs text-gray-500">Max Score</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                style={{ backgroundColor: `${accentColor}18` }}
                                            >
                                                <CheckCircle2 className="w-5 h-5" style={{ color: accentColor }} />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900">{assignment.passing_score}</p>
                                                <p className="text-xs text-gray-500">Passing Score</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                style={{ backgroundColor: `${accentColor}18` }}
                                            >
                                                <FlaskConical className="w-5 h-5" style={{ color: accentColor }} />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900">{testCases.length}</p>
                                                <p className="text-xs text-gray-500">Test Cases</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                style={{ backgroundColor: `${accentColor}18` }}
                                            >
                                                <RefreshCw className="w-5 h-5" style={{ color: accentColor }} />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900">
                                                    {assignment.max_attempts === 0 ? '∞' : assignment.max_attempts}
                                                </p>
                                                <p className="text-xs text-gray-500">Max Attempts</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Main Content */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                    {assignment.description && (
                                        <Card>
                                            <CardHeader><CardTitle>Description</CardTitle></CardHeader>
                                            <CardContent>
                                                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{assignment.description}</p>
                                            </CardContent>
                                        </Card>
                                    )}
                                    {assignment.instructions && (
                                        <Card>
                                            <CardHeader><CardTitle>Instructions</CardTitle></CardHeader>
                                            <CardContent>
                                                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{assignment.instructions}</p>
                                            </CardContent>
                                        </Card>
                                    )}
                                    <Card>
                                        <CardHeader><CardTitle>Submissions</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-3xl font-bold text-gray-900">{assignment.submission_count ?? 0}</p>
                                                    <p className="text-sm text-gray-500">Total submissions received</p>
                                                </div>
                                                {(assignment.submission_count ?? 0) > 0 && (
                                                    <Button
                                                        onClick={() => setActiveTab('submissions')}
                                                        className="gap-2 text-white"
                                                        style={{ backgroundColor: accentColor }}
                                                    >
                                                        <Users className="w-4 h-4" /> View Submissions
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* ─── Test Cases ─── */}
                                    <Card>
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="flex items-center gap-2">
                                                    <FlaskConical className="w-5 h-5 text-purple-600" /> Test Cases
                                                    <span className="text-sm font-normal text-gray-400">({testCases.length})</span>
                                                </CardTitle>
                                                <Button size="sm" onClick={openAddTC}
                                                    className="h-8 gap-1.5 bg-[#862733] hover:bg-[#a03040] text-white text-xs">
                                                    <Plus className="w-3.5 h-3.5" /> Add Test Case
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            {testCases.length === 0 && !isAddingTC ? (
                                                <div className="text-center py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                                    <FlaskConical className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                                                    <p className="text-sm font-medium text-gray-500 mb-1">No test cases yet</p>
                                                    <p className="text-xs text-gray-400 mb-4">Add test cases to auto-grade student submissions</p>
                                                    <Button size="sm" onClick={openAddTC} className="gap-1.5 bg-[#862733] hover:bg-[#a03040] text-white">
                                                        <Plus className="w-3.5 h-3.5" /> Add First Test Case
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {testCases.map((tc, idx) => (
                                                        <div key={tc.id}
                                                            className={`group rounded-xl border transition-all ${
                                                                editingTC?.id === tc.id ? 'border-[#862733] bg-[#862733]/5' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                                            }`}>
                                                            <div className="flex items-center gap-3 px-4 py-3">
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                                                    tc.is_hidden ? 'bg-gray-100 text-gray-500' : 'bg-purple-100 text-purple-600'
                                                                }`}>
                                                                    {idx + 1}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-sm font-semibold text-gray-900 truncate">{tc.name}</p>
                                                                        {tc.is_hidden && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Hidden</span>}
                                                                    </div>
                                                                    {tc.description && <p className="text-xs text-gray-500 truncate mt-0.5">{tc.description}</p>}
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    {tc.time_limit_seconds && (
                                                                        <span className="text-xs text-gray-400">{tc.time_limit_seconds}s</span>
                                                                    )}
                                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button onClick={() => openEditTC(tc)}
                                                                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                                                                            <Edit className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button onClick={() => deleteTestCase(tc.id)}
                                                                            disabled={deletingTCId === tc.id}
                                                                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50">
                                                                            {deletingTCId === tc.id
                                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                                : <Trash2 className="w-3.5 h-3.5" />}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {tc.input_data || tc.expected_output ? (
                                                                <div className="px-4 pb-3 flex gap-3">
                                                                    {tc.input_data && (
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Input</p>
                                                                            <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 font-mono truncate overflow-hidden">{tc.input_data}</pre>
                                                                        </div>
                                                                    )}
                                                                    {tc.expected_output && (
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Expected Output</p>
                                                                            <pre className="text-xs text-green-700 bg-green-50 rounded-lg p-2 font-mono truncate overflow-hidden">{tc.expected_output}</pre>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    ))}
                                                    {testCases.length > 0 && (
                                                        <div className="flex items-center justify-between pt-2 px-1 border-t border-gray-100 mt-2">
                                                            <span className="text-xs text-gray-500">{testCases.length} test case{testCases.length !== 1 ? 's' : ''}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* ─── Test Case Add/Edit Modal ─── */}
                                    {isAddingTC && (
                                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setIsAddingTC(false)}>
                                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
                                                    <h3 className="text-lg font-semibold text-gray-900">
                                                        {editingTC ? `Edit: ${editingTC.name}` : 'Add Test Case'}
                                                    </h3>
                                                    <button onClick={() => setIsAddingTC(false)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400">
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>
                                                <div className="overflow-y-auto flex-1 p-6 space-y-5">
                                                    {tcError && (
                                                        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
                                                            <AlertCircle className="w-4 h-4 shrink-0" /> {tcError}
                                                        </div>
                                                    )}

                                                    {/* Name */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                                                        <input value={tcForm.name || ''} onChange={e => setTCForm(p => ({ ...p, name: e.target.value }))}
                                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733]/30 focus:border-[#862733]"
                                                            placeholder="e.g. Basic Addition" />
                                                    </div>

                                                    {/* Description */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                                        <input value={tcForm.description || ''} onChange={e => setTCForm(p => ({ ...p, description: e.target.value }))}
                                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733]/30 focus:border-[#862733]"
                                                            placeholder="Describe what this test case validates..." />
                                                    </div>

                                                    {/* Input & Expected Output */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Input Data</label>
                                                            <textarea value={tcForm.input_data || ''} onChange={e => setTCForm(p => ({ ...p, input_data: e.target.value }))}
                                                                rows={4} placeholder="e.g. 5,3"
                                                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#862733]/30 focus:border-[#862733]" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Output</label>
                                                            <textarea value={tcForm.expected_output || ''} onChange={e => setTCForm(p => ({ ...p, expected_output: e.target.value }))}
                                                                rows={4} placeholder="e.g. 8"
                                                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#862733]/30 focus:border-[#862733]" />
                                                        </div>
                                                    </div>

                                                    {/* Toggles */}
                                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Visibility & Comparison</p>
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                            {([
                                                                { key: 'is_hidden', label: 'Hidden', desc: 'Not shown to students' },
                                                                { key: 'ignore_whitespace', label: 'Ignore Whitespace', desc: 'Trim whitespace when comparing' },
                                                                { key: 'ignore_case', label: 'Ignore Case', desc: 'Case-insensitive comparison' },
                                                                { key: 'use_regex', label: 'Use Regex', desc: 'Match via regex pattern' },
                                                            ] as const).map(({ key, label, desc }) => (
                                                                <label key={key}
                                                                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                                                        tcForm[key] ? 'border-[#862733]/30 bg-[#862733]/5' : 'border-gray-200 bg-white'
                                                                    }`}>
                                                                    <input type="checkbox" checked={!!tcForm[key]}
                                                                        onChange={e => setTCForm(p => ({ ...p, [key]: e.target.checked }))}
                                                                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]" />
                                                                    <div>
                                                                        <p className="text-xs font-medium text-gray-900">{label}</p>
                                                                        <p className="text-[10px] text-gray-400">{desc}</p>
                                                                    </div>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Limits */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (seconds)</label>
                                                            <input type="number" min={0} value={tcForm.time_limit_seconds ?? ''}
                                                                onChange={e => setTCForm(p => ({ ...p, time_limit_seconds: e.target.value ? parseInt(e.target.value) : undefined }))}
                                                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733]/30 focus:border-[#862733]"
                                                                placeholder="Default" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Memory Limit (MB)</label>
                                                            <input type="number" min={0} value={tcForm.memory_limit_mb ?? ''}
                                                                onChange={e => setTCForm(p => ({ ...p, memory_limit_mb: e.target.value ? parseInt(e.target.value) : undefined }))}
                                                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733]/30 focus:border-[#862733]"
                                                                placeholder="Default" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                                                            <input type="number" min={0} value={tcForm.order ?? testCases.length}
                                                                onChange={e => setTCForm(p => ({ ...p, order: parseInt(e.target.value) || 0 }))}
                                                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733]/30 focus:border-[#862733]" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex gap-3 p-4 border-t bg-gray-50">
                                                    <Button variant="outline" onClick={() => setIsAddingTC(false)} className="flex-1">Cancel</Button>
                                                    <Button onClick={saveTestCase} disabled={savingTC}
                                                        className="flex-1 bg-[#862733] hover:bg-[#a03040] text-white">
                                                        {savingTC
                                                            ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>)
                                                            : (<><Save className="w-4 h-4 mr-2" /> {editingTC ? 'Update' : 'Create'} Test Case</>)}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Clock className="w-4 h-4" /> Late Submission
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-600">Allowed</span>
                                                {assignment.allow_late
                                                    ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                    : <AlertCircle className="w-5 h-5 text-gray-300" />
                                                }
                                            </div>
                                            {assignment.allow_late && assignment.late_penalty_per_day != null && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-600">Penalty/day</span>
                                                    <span className="font-medium text-gray-900">{assignment.late_penalty_per_day}%</span>
                                                </div>
                                            )}
                                            {assignment.allow_late && assignment.max_late_days != null && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-600">Max late days</span>
                                                    <span className="font-medium text-gray-900">{assignment.max_late_days}</span>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader><CardTitle className="text-base">Submission Settings</CardTitle></CardHeader>
                                        <CardContent className="space-y-3 text-sm">
                                            {assignment.max_file_size_mb != null && (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-600">Max file size</span>
                                                    <span className="font-medium text-gray-900">{assignment.max_file_size_mb} MB</span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-600">Group submissions</span>
                                                {assignment.allow_groups
                                                    ? <span className="font-medium text-green-700">Up to {assignment.max_group_size}</span>
                                                    : <span className="text-gray-400">Individual only</span>
                                                }
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <Shield className="w-4 h-4" /> Integrity Checks
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-600">Plagiarism</span>
                                                {assignment.enable_plagiarism_check
                                                    ? <span className="text-green-700 font-medium">{assignment.plagiarism_threshold ?? 30}% threshold</span>
                                                    : <AlertCircle className="w-5 h-5 text-gray-300" />
                                                }
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-gray-600">AI Detection</span>
                                                {assignment.enable_ai_detection
                                                    ? <span className="text-green-700 font-medium">{assignment.ai_detection_threshold ?? 50}% threshold</span>
                                                    : <AlertCircle className="w-5 h-5 text-gray-300" />
                                                }
                                            </div>
                                        </CardContent>
                                    </Card>
                                    {assignment.rubric && assignment.rubric.items.length > 0 && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    <Target className="w-4 h-4" style={{ color: accentColor }} />
                                                    Rubric
                                                    <span className="text-sm font-normal text-gray-400">
                                                        ({assignment.rubric.total_points} pts)
                                                    </span>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                {assignment.rubric.items.map((item) => (
                                                    <div key={item.id} className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                                                            {item.description && (
                                                                <p className="text-xs text-gray-500 truncate">{item.description}</p>
                                                            )}
                                                        </div>
                                                        <span className="text-sm font-semibold flex-shrink-0" style={{ color: accentColor }}>
                                                            {item.max_points} pts
                                                        </span>
                                                    </div>
                                                ))}
                                            </CardContent>
                                        </Card>
                                    )}
                                    <Card>
                                        <CardContent className="p-4 text-sm text-gray-500 space-y-1">
                                            <p>Created {formatDate(assignment.created_at)}</p>
                                            {assignment.updated_at && <p>Updated {formatDate(assignment.updated_at)}</p>}
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'submissions' && (
                        <div className="space-y-6">
                            {/* Run Bulk Test Execution — first and only block after tab */}
                            <Card className="border border-gray-200/80 bg-white shadow-sm">
                                <CardContent className="p-6">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div className="space-y-1 max-w-xl">
                                            <h3 className="text-base font-medium text-gray-900">
                                                Run Bulk Test Execution
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                Run each student&apos;s latest submission against all test cases. Results show tests passed and scores. Report is available in the modal and can be downloaded as CSV.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={() => {
                                                setBulkModalOpen(true);
                                                setBulkError(null);
                                                setBulkResults([]);
                                                setBulkProgress({ total: 0, completed: 0 });
                                                runBulkGrading();
                                            }}
                                            disabled={bulkRunning}
                                            className="shrink-0 gap-2 bg-gray-900 hover:bg-gray-800 text-white"
                                        >
                                            {bulkRunning ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Running…
                                                </>
                                            ) : (
                                                <>
                                                    <FlaskConical className="w-4 h-4" />
                                                    Run Bulk Execution
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Bulk run results modal */}
                            <Modal
                                isOpen={bulkModalOpen}
                                onClose={() => {
                                    if (!bulkRunning) setBulkModalOpen(false);
                                }}
                                title="Bulk Test Execution"
                                description={
                                    bulkRunning
                                        ? `Running latest submission for each student (${bulkProgress.completed}/${bulkProgress.total})…`
                                        : bulkResults.length > 0
                                            ? `Completed. ${bulkResults.length} student(s) processed.`
                                            : 'Run each student\'s latest submission against all test cases.'
                                }
                                size="xl"
                            >
                                <div className="space-y-4">
                                    {bulkRunning && (
                                        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                                            <div
                                                className="h-full bg-gray-700 transition-all duration-300"
                                                style={{
                                                    width:
                                                        bulkProgress.total > 0
                                                            ? `${(bulkProgress.completed / bulkProgress.total) * 100}%`
                                                            : '0%',
                                                }}
                                            />
                                        </div>
                                    )}
                                    {bulkError && (
                                        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                            {bulkError}
                                        </p>
                                    )}
                                    {bulkResults.length > 0 && (
                                        <>
                                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                <div className="max-h-[50vh] overflow-auto">
                                                    <table className="min-w-full text-sm">
                                                        <thead className="bg-gray-50 sticky top-0">
                                                            <tr>
                                                                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Student</th>
                                                                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Status</th>
                                                                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Tests passed</th>
                                                                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Score</th>
                                                                {bulkResults.some((r) => r.errorMessage) && (
                                                                    <th className="px-4 py-2.5 text-left font-medium text-gray-600">Error</th>
                                                                )}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {bulkResults.map((r) => (
                                                                <tr key={r.submissionId} className="border-t border-gray-100 hover:bg-gray-50/50">
                                                                    <td className="px-4 py-2.5 text-gray-900 font-medium">
                                                                        {r.studentName}
                                                                    </td>
                                                                    <td className="px-4 py-2.5">
                                                                        {r.status === 'error' ? (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                                                                <AlertCircle className="w-3 h-3" /> Error
                                                                            </span>
                                                                        ) : r.status === 'manual_review' ? (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                                                                <Clock className="w-3 h-3" /> Manual review
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                                                                                <CheckCircle2 className="w-3 h-3" /> Graded
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-gray-600">
                                                                        {typeof r.testsPassed === 'number' && typeof r.totalTests === 'number'
                                                                            ? `${r.testsPassed} / ${r.totalTests}`
                                                                            : '—'}
                                                                    </td>
                                                                    <td className="px-4 py-2.5 text-gray-600">
                                                                        {typeof r.finalScore === 'number'
                                                                            ? `${r.finalScore.toFixed(1)}%`
                                                                            : typeof r.testScore === 'number'
                                                                                ? `${r.testScore.toFixed(1)}%`
                                                                                : '—'}
                                                                    </td>
                                                                    {bulkResults.some((b) => b.errorMessage) && (
                                                                        <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[200px] truncate" title={r.errorMessage}>
                                                                            {r.errorMessage || '—'}
                                                                        </td>
                                                                    )}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                            <ModalFooter>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setBulkModalOpen(false)}
                                                >
                                                    Close
                                                </Button>
                                                <Button
                                                    className="gap-2 bg-gray-900 hover:bg-gray-800"
                                                    onClick={() => {
                                                        const header = [
                                                            'Student Name',
                                                            'Submission ID',
                                                            'Status',
                                                            'Tests Passed',
                                                            'Total Tests',
                                                            'Final Score',
                                                            'Test Score',
                                                            'Error',
                                                        ];
                                                        const rows = bulkResults.map((r) => [
                                                            r.studentName,
                                                            String(r.submissionId),
                                                            r.status,
                                                            r.testsPassed != null ? String(r.testsPassed) : '',
                                                            r.totalTests != null ? String(r.totalTests) : '',
                                                            r.finalScore != null ? r.finalScore.toFixed(1) : '',
                                                            r.testScore != null ? r.testScore.toFixed(1) : '',
                                                            r.errorMessage || '',
                                                        ]);
                                                        const csv = [header, ...rows]
                                                            .map((cols) =>
                                                                cols
                                                                    .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                                                                    .join(','),
                                                            )
                                                            .join('\n');
                                                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                                        const url = URL.createObjectURL(blob);
                                                        const link = document.createElement('a');
                                                        link.href = url;
                                                        link.download = `bulk-run-results-assignment-${assignmentId}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                        URL.revokeObjectURL(url);
                                                    }}
                                                >
                                                    <Download className="w-4 h-4" />
                                                    Download CSV
                                                </Button>
                                            </ModalFooter>
                                        </>
                                    )}
                                    {!bulkRunning && bulkResults.length === 0 && !bulkError && (
                                        <p className="text-sm text-gray-500">No submissions to run. Ensure students have submitted for this assignment.</p>
                                    )}
                                </div>
                            </Modal>

                            {/* Search and Sort Controls */}
                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <Input
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search by student name, email, or ID..."
                                                className="pl-10"
                                            />
                                            {searchQuery && (
                                                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {(['name', 'score', 'date', 'attempts'] as const).map(col => (
                                                <button
                                                    key={col}
                                                    onClick={() => handleSort(col)}
                                                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors capitalize ${
                                                        sortBy === col
                                                            ? 'bg-[#862733] text-white border-[#862733]'
                                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {col} {sortBy === col && (sortDir === 'asc' ? '↑' : '↓')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Submissions List */}
                            {isLoadingSubs ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : filteredGroups.length === 0 ? (
                                <Card>
                                    <CardContent className="py-16 text-center">
                                        <Inbox className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                            {searchQuery ? 'No students match your search' : 'No submissions yet'}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {searchQuery
                                                ? 'Try adjusting your search query.'
                                                : 'Submissions will appear here once students start submitting.'}
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : assignment?.allow_groups ? (
                                /* ── GROUP MODE: one card per group ── */
                                <div className="space-y-3">
                                    {assignmentGroupEntries.length === 0 ? (
                                        <Card>
                                            <CardContent className="py-12 text-center">
                                                <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                                <p className="text-gray-500 font-medium">No group submissions yet</p>
                                                <p className="text-sm text-gray-400 mt-1">Submissions will appear here once groups start submitting.</p>
                                            </CardContent>
                                        </Card>
                                    ) : assignmentGroupEntries.map((entry) => {
                                        const latest = entry.latestSubmission;
                                        const submitter = latest.student;
                                        return (
                                            <Card
                                                key={entry.groupId}
                                                className="overflow-hidden transition-shadow hover:shadow-md cursor-pointer"
                                                onClick={() => navigateToGrading(latest.student_id)}
                                            >
                                                <div className="p-4 hover:bg-gray-50/50 transition-colors">
                                                    <div className="flex items-start gap-4">
                                                        {/* Group icon */}
                                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                                            <Users className="w-5 h-5 text-primary" />
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                <p className="font-semibold text-gray-900">{entry.groupName}</p>
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                                                    {entry.members.length} members
                                                                </span>
                                                                {latest.is_late && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-700">
                                                                        <Clock className="w-3 h-3" /> Late
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {/* Member avatars */}
                                                            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                                                                {entry.members.map((m) => (
                                                                    <div key={m.user_id} className="flex items-center gap-1 text-[10px] text-gray-500">
                                                                        <div className="w-5 h-5 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                                                                            <span className="text-[8px] font-bold text-gray-600">
                                                                                {m.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                                            </span>
                                                                        </div>
                                                                        <span>{m.full_name}{m.is_leader ? ' 👑' : ''}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <p className="text-[11px] text-gray-400">
                                                                Submitted by: <span className="text-gray-600 font-medium">{submitter?.full_name ?? `Student #${latest.student_id}`}</span>
                                                                {' · '}{formatDateTime(latest.submitted_at)}
                                                            </p>
                                                        </div>

                                                        <div className="hidden sm:flex items-center gap-6 text-sm shrink-0">
                                                            <div className="text-center">
                                                                <p className="text-xs text-gray-500">Tests</p>
                                                                <p className="font-semibold text-gray-900">
                                                                    {latest.tests_total > 0 ? `${latest.tests_passed}/${latest.tests_total}` : '—'}
                                                                </p>
                                                            </div>
                                                            <div className="text-center min-w-[70px]">
                                                                <p className="text-xs text-gray-500">Score</p>
                                                                <p className={`text-lg font-bold ${getScoreColor(latest.final_score, assignment.max_score)}`}>
                                                                    {latest.final_score !== null ? latest.final_score.toFixed(1) : '—'}
                                                                    <span className="text-xs text-gray-400 font-normal">/{assignment.max_score}</span>
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="shrink-0">
                                                            <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusBadge(latest.status)}`}>
                                                                {formatStatus(latest.status)}
                                                            </span>
                                                        </div>

                                                        <Button
                                                            size="sm"
                                                            onClick={(e) => { e.stopPropagation(); navigateToGrading(latest.student_id); }}
                                                            className="h-8 px-3 text-xs shrink-0 gap-1.5 bg-[#862733] hover:bg-[#a03040] text-white"
                                                        >
                                                            <Edit className="w-3.5 h-3.5" /> Grade
                                                        </Button>

                                                        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            ) : (
                                /* ── INDIVIDUAL MODE ── */
                                <div className="space-y-3">
                                    {filteredGroups.map((group) => {
                                        const latest = group.latestSubmission;
                                        const hasFlagged = group.submissions.some(s => s.plagiarism_flagged || s.ai_flagged);

                                        return (
                                            <Card
                                                key={group.student.id}
                                                className={`overflow-hidden transition-shadow hover:shadow-md cursor-pointer ${hasFlagged ? 'border-l-4 border-l-red-500' : ''}`}
                                                onClick={() => navigateToGrading(group.student.id)}
                                            >
                                                <div className="flex items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors">
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                        <User className="w-5 h-5 text-primary" />
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="font-semibold text-gray-900 truncate">{group.student.full_name}</p>
                                                            {latest.is_late && (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-700">
                                                                    <Clock className="w-3 h-3" /> Late
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-500 truncate">
                                                            {group.student.email}
                                                            {group.student.student_id && <> · ID: {group.student.student_id}</>}
                                                        </p>
                                                    </div>

                                                    <div className="hidden sm:flex items-center gap-6 text-sm shrink-0">
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-500">Submitted</p>
                                                            <p className="text-xs font-medium text-gray-700">{formatDateTime(latest.submitted_at)}</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-500">Tests</p>
                                                            <p className="font-semibold text-gray-900">
                                                                {latest.tests_total > 0 ? `${latest.tests_passed}/${latest.tests_total}` : '—'}
                                                            </p>
                                                        </div>
                                                        <div className="text-center min-w-[70px]">
                                                            <p className="text-xs text-gray-500">Score</p>
                                                            <p className={`text-lg font-bold ${getScoreColor(latest.final_score, assignment.max_score)}`}>
                                                                {latest.final_score !== null ? latest.final_score.toFixed(1) : '—'}
                                                                <span className="text-xs text-gray-400 font-normal">/{assignment.max_score}</span>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {latest.plagiarism_checked && (
                                                        <div className="hidden lg:flex flex-col items-center min-w-[70px] shrink-0">
                                                            <p className="text-xs text-gray-500 mb-0.5">Similarity</p>
                                                            {latest.plagiarism_flagged && (
                                                                <span className="text-[9px] font-bold text-red-600 uppercase tracking-wide mb-0.5">Flagged</span>
                                                            )}
                                                            <p className={`text-lg font-bold ${latest.plagiarism_flagged || (latest.plagiarism_score ?? 0) >= (assignment.plagiarism_threshold ?? 30) ? 'text-red-600' : (latest.plagiarism_score ?? 0) >= 20 ? 'text-amber-600' : 'text-gray-500'}`}>
                                                                {latest.plagiarism_score !== null ? `${latest.plagiarism_score.toFixed(0)}%` : '—'}
                                                            </p>
                                                            {latest.plagiarism_score !== null && latest.plagiarism_score > 0 && (
                                                                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-0.5">
                                                                    <div className={`h-full rounded-full ${
                                                                        latest.plagiarism_flagged || latest.plagiarism_score >= (assignment.plagiarism_threshold ?? 30) ? 'bg-red-500' : latest.plagiarism_score >= 20 ? 'bg-amber-500' : 'bg-gray-400'
                                                                    }`} style={{ width: `${Math.min(latest.plagiarism_score, 100)}%` }} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="shrink-0">
                                                        <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusBadge(latest.status)}`}>
                                                            {formatStatus(latest.status)}
                                                        </span>
                                                    </div>

                                                    <Button
                                                        size="sm"
                                                        onClick={(e) => { e.stopPropagation(); navigateToGrading(group.student.id); }}
                                                        className="h-8 px-3 text-xs shrink-0 gap-1.5 bg-[#862733] hover:bg-[#a03040] text-white"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" /> Grade
                                                    </Button>

                                                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── Plagiarism Report Tab ─── */}
                    {activeTab === 'plagiarism' && (
                        <div className="space-y-6">
                            {(() => {
                                const checkedSubs = submissions.filter(s => s.plagiarism_checked);
                                const flaggedSubs = submissions.filter(s => s.plagiarism_flagged);
                                const avgScore = checkedSubs.length > 0
                                    ? checkedSubs.reduce((sum, s) => sum + (s.plagiarism_score ?? 0), 0) / checkedSubs.length
                                    : 0;

                                // Group by student, pick latest submission per student
                                const studentMap = new Map<number, SubmissionItem>();
                                for (const sub of submissions) {
                                    const existing = studentMap.get(sub.student_id);
                                    if (!existing || new Date(sub.submitted_at) > new Date(existing.submitted_at)) {
                                        studentMap.set(sub.student_id, sub);
                                    }
                                }
                                const studentSubs = Array.from(studentMap.values())
                                    .sort((a, b) => (b.plagiarism_score ?? 0) - (a.plagiarism_score ?? 0));

                                return (
                                    <>
                                        {/* Header Card */}
                                        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-white">
                                            <CardContent className="p-6">
                                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center">
                                                            <Shield className="w-7 h-7 text-purple-700" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-bold text-gray-900">Plagiarism Report</h3>
                                                            <p className="text-sm text-gray-500">
                                                                Threshold: {assignment.plagiarism_threshold ?? 30}%
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <Button
                                                            onClick={runPlagiarismCheckAll}
                                                            disabled={plagiarismRunning || submissions.length < 2}
                                                            className="bg-purple-600 hover:bg-purple-700 text-white"
                                                        >
                                                            {plagiarismRunning
                                                                ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>)
                                                                : (<><Shield className="w-4 h-4 mr-2" /> {checkedSubs.length > 0 ? 'Re-run All' : 'Run Plagiarism Check'}</>)
                                                            }
                                                        </Button>
                                                        {checkedSubs.length > 0 && (
                                                            <Button
                                                                onClick={downloadPlagiarismReport}
                                                                variant="outline"
                                                                className="border-purple-300 text-purple-700 hover:bg-purple-50"
                                                            >
                                                                <Download className="w-4 h-4 mr-2" /> Download Report
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        {/* Stats Row */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <Card>
                                                <CardContent className="p-4 text-center">
                                                    <p className="text-3xl font-bold text-gray-900">{studentSubs.length}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Students</p>
                                                </CardContent>
                                            </Card>
                                            <Card>
                                                <CardContent className="p-4 text-center">
                                                    <p className="text-3xl font-bold text-purple-600">{checkedSubs.length}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Checked</p>
                                                </CardContent>
                                            </Card>
                                            <Card className={flaggedSubs.length > 0 ? 'border-red-200 bg-red-50/30' : ''}>
                                                <CardContent className="p-4 text-center">
                                                    <p className={`text-3xl font-bold ${flaggedSubs.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{flaggedSubs.length}</p>
                                                    <p className="text-xs text-gray-500 mt-1">Flagged</p>
                                                </CardContent>
                                            </Card>
                                            <Card>
                                                <CardContent className="p-4 text-center">
                                                    <p className={`text-3xl font-bold ${avgScore >= (assignment.plagiarism_threshold ?? 30) ? 'text-red-600' : avgScore >= 15 ? 'text-amber-600' : 'text-green-600'}`}>
                                                        {avgScore.toFixed(1)}%
                                                    </p>
                                                    <p className="text-xs text-gray-500 mt-1">Avg Similarity</p>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        {/* Plagiarism result toast */}
                                        {plagiarismResult && !plagiarismResult.error && (
                                            <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
                                                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                                                <p className="text-sm text-green-800">
                                                    Plagiarism check complete — <strong>{plagiarismResult.total_checked}</strong> submissions analyzed.
                                                    {flaggedSubs.length > 0
                                                        ? <span className="text-red-600 font-semibold ml-1">{flaggedSubs.length} flagged for review.</span>
                                                        : <span className="text-green-700 ml-1">No suspicious submissions found.</span>
                                                    }
                                                </p>
                                            </div>
                                        )}
                                        {plagiarismResult?.error && (
                                            <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-center gap-3">
                                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                                                <p className="text-sm text-red-700">{plagiarismResult.error}</p>
                                            </div>
                                        )}

                                        {/* No submissions */}
                                        {studentSubs.length === 0 && (
                                            <Card>
                                                <CardContent className="py-16 text-center">
                                                    <Shield className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                                                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No submissions to check</h3>
                                                    <p className="text-sm text-gray-500">Plagiarism reports will appear here once students submit their work.</p>
                                                </CardContent>
                                            </Card>
                                        )}

                                        {/* Student-by-student report */}
                                        {studentSubs.length > 0 && (
                                            <div className="space-y-3">
                                                {studentSubs.map((sub) => {
                                                    const isExpanded = expandedPlagiarismStudent === sub.id;
                                                    const matches = plagiarismMatchesMap[sub.id] || [];
                                                    const threshold = assignment.plagiarism_threshold ?? 30;
                                                    const score = sub.plagiarism_score ?? 0;
                                                    const scoreColor = sub.plagiarism_flagged ? 'text-red-600' : score >= threshold * 0.6 ? 'text-amber-600' : 'text-green-600';
                                                    const barColor = sub.plagiarism_flagged ? 'bg-red-500' : score >= threshold * 0.6 ? 'bg-amber-500' : 'bg-green-500';

                                                    return (
                                                        <Card key={sub.id} className={`overflow-hidden transition-all ${sub.plagiarism_flagged ? 'border-l-4 border-l-red-500 shadow-md' : ''}`}>
                                                            <div
                                                                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50/60 transition-colors"
                                                                onClick={() => {
                                                                    if (isExpanded) {
                                                                        setExpandedPlagiarismStudent(null);
                                                                    } else {
                                                                        setExpandedPlagiarismStudent(sub.id);
                                                                        loadMatchesForSubmission(sub.id);
                                                                    }
                                                                }}
                                                            >
                                                                <button className="shrink-0 text-gray-400">
                                                                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                                                </button>

                                                                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: sub.plagiarism_flagged ? '#fef2f2' : '#f0fdf4' }}>
                                                                    <User className={`w-5 h-5 ${sub.plagiarism_flagged ? 'text-red-500' : 'text-green-600'}`} />
                                                                </div>

                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="font-semibold text-gray-900 truncate">{sub.student?.full_name || `Student #${sub.student_id}`}</p>
                                                                        {sub.plagiarism_flagged && (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700 border border-red-200">
                                                                                <AlertTriangle className="w-3 h-3" /> FLAGGED
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-gray-500 truncate">
                                                                        {sub.student?.email}
                                                                        {sub.student?.student_id && <> · ID: {sub.student.student_id}</>}
                                                                        {' · Attempt #'}{sub.attempt_number}
                                                                    </p>
                                                                </div>

                                                                {/* Score bar */}
                                                                <div className="hidden sm:flex items-center gap-3 shrink-0 min-w-[200px]">
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center justify-between mb-1">
                                                                            <span className="text-[10px] text-gray-500">Similarity</span>
                                                                            <span className={`text-sm font-bold ${scoreColor}`}>
                                                                                {sub.plagiarism_checked ? `${score.toFixed(1)}%` : '—'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(score, 100)}%` }} />
                                                                        </div>
                                                                        {/* threshold marker */}
                                                                        <div className="relative h-0">
                                                                            <div className="absolute top-[-10px] border-l-2 border-dashed border-gray-400 h-[10px]" style={{ left: `${threshold}%` }} />
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {!sub.plagiarism_checked && (
                                                                    <span className="text-xs text-gray-400 italic shrink-0">Not checked</span>
                                                                )}
                                                            </div>

                                                            {/* Expanded Detail */}
                                                            {isExpanded && (
                                                                <div className="border-t bg-gray-50/70 p-5">
                                                                    {/* Quick info row */}
                                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                                                                        <div className="bg-white rounded-xl p-3 border border-gray-200">
                                                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Similarity</p>
                                                                            <p className={`text-xl font-bold ${scoreColor}`}>{sub.plagiarism_checked ? `${score.toFixed(1)}%` : 'N/A'}</p>
                                                                        </div>
                                                                        <div className="bg-white rounded-xl p-3 border border-gray-200">
                                                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Status</p>
                                                                            <p className={`text-sm font-semibold ${sub.plagiarism_flagged ? 'text-red-600' : 'text-green-600'}`}>
                                                                                {sub.plagiarism_flagged ? 'Flagged' : sub.plagiarism_checked ? 'Clean' : 'Pending'}
                                                                            </p>
                                                                        </div>
                                                                        <div className="bg-white rounded-xl p-3 border border-gray-200">
                                                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Submission Score</p>
                                                                            <p className="text-sm font-semibold text-gray-900">{sub.final_score !== null ? `${sub.final_score.toFixed(1)}/${sub.max_score}` : '—'}</p>
                                                                        </div>
                                                                        <div className="bg-white rounded-xl p-3 border border-gray-200">
                                                                            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Submitted</p>
                                                                            <p className="text-sm font-semibold text-gray-900">{formatDate(sub.submitted_at)}</p>
                                                                        </div>
                                                                    </div>

                                                                    {/* Matches */}
                                                                    {loadingMatches === sub.id ? (
                                                                        <div className="text-center py-8">
                                                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-500 mb-2" />
                                                                            <p className="text-sm text-gray-500">Loading match details...</p>
                                                                        </div>
                                                                    ) : matches.length > 0 ? (
                                                                        <div>
                                                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                                                                Code Matches ({matches.length})
                                                                            </p>
                                                                            <div className="space-y-3">
                                                                                {matches.map((m: any) => (
                                                                                    <div key={m.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                                                                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                                                                                            <div className="flex items-center gap-3">
                                                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                                                                    m.similarity_percentage >= threshold ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                                                                                                }`}>
                                                                                                    <Shield className="w-4 h-4" />
                                                                                                </div>
                                                                                                <div>
                                                                                                    <p className="text-sm font-semibold text-gray-900">
                                                                                                        {m.matched_source || `Submission #${m.matched_submission_id}`}
                                                                                                    </p>
                                                                                                    <p className="text-[10px] text-gray-500">
                                                                                                        Lines {m.source_line_start}–{m.source_line_end} → Lines {m.matched_line_start}–{m.matched_line_end}
                                                                                                    </p>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="flex items-center gap-3">
                                                                                                <span className={`text-lg font-bold ${
                                                                                                    m.similarity_percentage >= threshold ? 'text-red-600' : 'text-amber-600'
                                                                                                }`}>
                                                                                                    {m.similarity_percentage.toFixed(1)}%
                                                                                                </span>
                                                                                                {m.is_reviewed && (
                                                                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                                                                                        m.is_confirmed
                                                                                                            ? 'bg-red-100 text-red-700 border border-red-200'
                                                                                                            : 'bg-green-100 text-green-700 border border-green-200'
                                                                                                    }`}>
                                                                                                        {m.is_confirmed ? 'Confirmed' : 'Dismissed'}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>

                                                                                        {/* Side-by-side code */}
                                                                                        {(m.source_code_snippet || m.matched_code_snippet) && (
                                                                                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                                                                                                <div className="p-3">
                                                                                                    <div className="flex items-center justify-between mb-2">
                                                                                                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">This Student</p>
                                                                                                        <span className="text-[10px] text-gray-400">L{m.source_line_start}–{m.source_line_end}</span>
                                                                                                    </div>
                                                                                                    <pre className="text-[11px] text-gray-800 bg-red-50 border border-red-100 rounded-lg p-3 font-mono overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap leading-relaxed">{m.source_code_snippet}</pre>
                                                                                                </div>
                                                                                                <div className="p-3">
                                                                                                    <div className="flex items-center justify-between mb-2">
                                                                                                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Matched Student</p>
                                                                                                        <span className="text-[10px] text-gray-400">L{m.matched_line_start}–{m.matched_line_end}</span>
                                                                                                    </div>
                                                                                                    <pre className="text-[11px] text-gray-800 bg-amber-50 border border-amber-100 rounded-lg p-3 font-mono overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap leading-relaxed">{m.matched_code_snippet}</pre>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}

                                                                                        {/* Actions row */}
                                                                                        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center gap-2 flex-wrap">
                                                                                            <Button
                                                                                                size="sm"
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    navigateToGrading(sub.student_id);
                                                                                                }}
                                                                                                className="h-7 px-3 text-[11px] gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                                                                                            >
                                                                                                <Code className="w-3 h-3" /> Compare in Grading View
                                                                                            </Button>
                                                                                            {!m.is_reviewed && (
                                                                                                <>
                                                                                                    <button
                                                                                                        onClick={async (e) => {
                                                                                                            e.stopPropagation();
                                                                                                            await apiClient.reviewPlagiarismMatch(m.id, true, '');
                                                                                                            setPlagiarismMatchesMap(prev => ({
                                                                                                                ...prev,
                                                                                                                [sub.id]: (prev[sub.id] || []).map((x: any) =>
                                                                                                                    x.id === m.id ? { ...x, is_reviewed: true, is_confirmed: true } : x
                                                                                                                ),
                                                                                                            }));
                                                                                                        }}
                                                                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                                                                                                    >
                                                                                                        <AlertTriangle className="w-3 h-3" /> Confirm Plagiarism
                                                                                                    </button>
                                                                                                    <button
                                                                                                        onClick={async (e) => {
                                                                                                            e.stopPropagation();
                                                                                                            await apiClient.reviewPlagiarismMatch(m.id, false, '');
                                                                                                            setPlagiarismMatchesMap(prev => ({
                                                                                                                ...prev,
                                                                                                                [sub.id]: (prev[sub.id] || []).map((x: any) =>
                                                                                                                    x.id === m.id ? { ...x, is_reviewed: true, is_confirmed: false } : x
                                                                                                                ),
                                                                                                            }));
                                                                                                        }}
                                                                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                                                                                                    >
                                                                                                        <CheckCircle2 className="w-3 h-3" /> Dismiss
                                                                                                    </button>
                                                                                                </>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ) : sub.plagiarism_checked ? (
                                                                        null
                                                                    ) : (
                                                                        <div className="text-center py-8 bg-white rounded-xl border border-dashed border-gray-300">
                                                                            <Shield className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                                                                            <p className="text-sm text-gray-500">Not yet checked</p>
                                                                            <p className="text-xs text-gray-400 mt-1">Run the plagiarism check to generate a report.</p>
                                                                        </div>
                                                                    )}

                                                                    {/* Link to grading page */}
                                                                    <div className="mt-4 flex justify-end">
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={(e) => { e.stopPropagation(); navigateToGrading(sub.student_id); }}
                                                                            className="h-8 px-4 text-xs gap-1.5 bg-[#862733] hover:bg-[#a03040] text-white"
                                                                        >
                                                                            <Edit className="w-3.5 h-3.5" /> Open in Grading View
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>

            {/* Publish Grades confirmation modal */}
            <Modal
                isOpen={publishGradesConfirm}
                onClose={() => !publishGradesMutation.isPending && setPublishGradesConfirm(false)}
                title="Publish Grades"
                description="Students will be able to see their scores and feedback after publishing."
                size="sm"
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">
                            Are you sure you want to publish the grades? Students will be notified and will be able to see their scores immediately.
                        </p>
                    </div>
                    {publishGradesMutation.isError && (
                        <p className="text-sm text-red-600">Failed to publish grades. Please try again.</p>
                    )}
                </div>
                <ModalFooter>
                    <Button
                        variant="outline"
                        onClick={() => setPublishGradesConfirm(false)}
                        disabled={publishGradesMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => publishGradesMutation.mutate()}
                        disabled={publishGradesMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white gap-2"
                    >
                        {publishGradesMutation.isPending
                            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Publishing…</>
                            : <><CheckCircle2 className="w-4 h-4" /> Yes, Publish Grades</>
                        }
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Publish Grades success modal */}
            <Modal
                isOpen={publishGradesSuccess}
                onClose={() => setPublishGradesSuccess(false)}
                title=""
                size="sm"
            >
                <div className="flex flex-col items-center text-center py-4 gap-4">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="w-9 h-9 text-green-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Grades Published!</h3>
                        <p className="text-sm text-gray-500 mt-1">
                            Students can now see their scores for <span className="font-medium text-gray-700">{assignment?.title}</span>.
                        </p>
                    </div>
                </div>
                <ModalFooter>
                    <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => setPublishGradesSuccess(false)}
                    >
                        Done
                    </Button>
                </ModalFooter>
            </Modal>

            {/* Hide Grades confirmation modal */}
            <Modal
                isOpen={hideGradesConfirm}
                onClose={() => !hideGradesMutation.isPending && setHideGradesConfirm(false)}
                title="Hide Grades"
                description="Students will no longer be able to see their scores."
                size="sm"
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-800">
                            Are you sure you want to hide the grades? Students will lose access to their scores until you publish them again.
                        </p>
                    </div>
                    {hideGradesMutation.isError && (
                        <p className="text-sm text-red-600">Failed to hide grades. Please try again.</p>
                    )}
                </div>
                <ModalFooter>
                    <Button
                        variant="outline"
                        onClick={() => setHideGradesConfirm(false)}
                        disabled={hideGradesMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => hideGradesMutation.mutate()}
                        disabled={hideGradesMutation.isPending}
                        className="bg-red-600 hover:bg-red-700 text-white gap-2"
                    >
                        {hideGradesMutation.isPending
                            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Hiding…</>
                            : <><EyeOff className="w-4 h-4" /> Yes, Hide Grades</>
                        }
                    </Button>
                </ModalFooter>
            </Modal>
        </>
    );
}
