'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    test_code?: string;
    setup_code?: string;
    teardown_code?: string;
    points: number;
    is_hidden: boolean;
    is_sample: boolean;
    ignore_whitespace: boolean;
    ignore_case: boolean;
    use_regex: boolean;
    time_limit_seconds?: number;
    memory_limit_mb?: number;
    order: number;
    created_at?: string;
    updated_at?: string;
}

interface Assignment {
    id: number;
    course_id: number;
    title: string;
    description?: string;
    instructions?: string;
    difficulty: string;
    due_date?: string;
    is_published: boolean;
    max_score: number;
    passing_score: number;
    max_attempts: number;
    allow_late: boolean;
    late_penalty_per_day?: number;
    max_late_days?: number;
    language_id?: number;
    starter_code?: string;
    solution_code?: string;
    test_weight: number;
    rubric_weight: number;
    enable_plagiarism_check: boolean;
    enable_ai_detection: boolean;
    plagiarism_threshold?: number;
    ai_detection_threshold?: number;
    allow_groups: boolean;
    max_group_size?: number;
    max_file_size_mb?: number;
    submission_count?: number;
    test_cases?: TestCaseItem[];
    created_at: string;
    updated_at?: string;
}

interface StudentInfo {
    id: number;
    full_name: string;
    email: string;
    student_id?: string;
}

interface SubmissionItem {
    id: number;
    assignment_id: number;
    student_id: number;
    student?: StudentInfo;
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

/* ====================================================================
   HELPERS
   ==================================================================== */

const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const formatDateTime = (dateString: string) =>
    format(new Date(dateString), 'MMM dd, yyyy · hh:mm a');

const getDifficultyStyle = (d?: string) => {
    switch (d) {
        case 'easy': return 'bg-green-100 text-green-800';
        case 'medium': return 'bg-amber-100 text-amber-800';
        case 'hard': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

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

export default function AssignmentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();

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

    const { data: assignment, isLoading, error } = useQuery({
        queryKey: ['assignment', assignmentId],
        queryFn: () => apiClient.getAssignment(assignmentId) as Promise<Assignment>,
        enabled: !!assignmentId,
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

    const deleteMutation = useMutation({
        mutationFn: () => apiClient.deleteAssignment(assignmentId),
        onSuccess: () => router.push(`/faculty/courses/${courseId}/assignments`),
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

    // Test case helpers
    const testCases: TestCaseItem[] = assignment?.test_cases ?? [];

    const resetTCForm = () => {
        setTCForm({
            name: '', description: '', input_data: '', expected_output: '',
            points: 10, is_hidden: false, is_sample: false,
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
                points: tcForm.points ?? 10,
                is_hidden: tcForm.is_hidden ?? false,
                is_sample: tcForm.is_sample ?? false,
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
        router.push(`/faculty/courses/${courseId}/assignments/${assignmentId}/grade/${studentId}`);
    }, [router, courseId, assignmentId]);

    const handleSort = useCallback((col: typeof sortBy) => {
        if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortDir(col === 'score' ? 'desc' : 'asc'); }
    }, [sortBy]);

    /* ===== RENDER ===== */

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
                    onClick={() => router.push(`/faculty/courses/${courseId}/assignments`)}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Assignments
                </Button>
            </div>
        );
    }

    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    const isOverdue = dueDate && dueDate < new Date();
    const statusGradient = assignment.is_published
        ? isOverdue ? 'from-red-500 to-rose-600' : 'from-emerald-500 to-teal-600'
        : 'from-amber-500 to-orange-600';

    return (
        <div className="space-y-6 pb-8">
                    {/* ─── Header Banner ─── */}
                    <div className={`bg-gradient-to-r ${statusGradient} rounded-2xl p-6 md:p-8 text-white relative overflow-hidden`}>
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/20" />
                            <div className="absolute -right-5 -bottom-5 w-28 h-28 rounded-full bg-white/10" />
                        </div>
                        <div className="relative z-10">
                            <button
                                onClick={() => router.push(`/faculty/courses/${courseId}/assignments`)}
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
                                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-white/20 capitalize">
                                            {assignment.difficulty}
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
                                    <Link href={`/faculty/courses/${courseId}/assignments/${assignmentId}/edit`}>
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
                    </div>

                    {/* ─── Tabs ─── */}
                    <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                activeTab === 'overview'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <FileText className="w-4 h-4" /> Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('submissions')}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                activeTab === 'submissions'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Users className="w-4 h-4" /> Submissions
                            {(assignment.submission_count ?? 0) > 0 && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-semibold">
                                    {assignment.submission_count}
                                </span>
                            )}
                        </button>
                        {assignment.enable_plagiarism_check && (
                            <button
                                onClick={() => setActiveTab('plagiarism')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                    activeTab === 'plagiarism'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Shield className="w-4 h-4" /> Plagiarism Report
                            </button>
                        )}
                    </div>

                    {/* ─── Tab Content ─── */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Quick Stats */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                                <Target className="w-5 h-5 text-blue-600" />
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
                                            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                                                <CheckCircle2 className="w-5 h-5 text-green-600" />
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
                                            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                                <FlaskConical className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900">{assignment.test_weight}%</p>
                                                <p className="text-xs text-gray-500">Test Weight</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                                <RefreshCw className="w-5 h-5 text-amber-600" />
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
                                    {assignment.starter_code && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2"><Code className="w-5 h-5" /> Starter Code</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto font-mono">
                                                    {assignment.starter_code}
                                                </pre>
                                            </CardContent>
                                        </Card>
                                    )}
                                    {assignment.solution_code && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2"><Code className="w-5 h-5" /> Solution Code</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto font-mono">
                                                    {assignment.solution_code}
                                                </pre>
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
                                                    <Button onClick={() => setActiveTab('submissions')} className="gap-2 bg-[#862733] hover:bg-[#a03040] text-white">
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
                                                                    tc.is_hidden ? 'bg-gray-100 text-gray-500' : tc.is_sample ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                                                                }`}>
                                                                    {idx + 1}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-sm font-semibold text-gray-900 truncate">{tc.name}</p>
                                                                        {tc.is_hidden && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Hidden</span>}
                                                                        {tc.is_sample && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">Sample</span>}
                                                                    </div>
                                                                    {tc.description && <p className="text-xs text-gray-500 truncate mt-0.5">{tc.description}</p>}
                                                                </div>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <span className="text-sm font-bold text-purple-600">{tc.points} pts</span>
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
                                                            <span className="text-sm font-bold text-gray-900">{testCases.reduce((s, t) => s + t.points, 0)} total pts</span>
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

                                                    {/* Name & Points */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                        <div className="sm:col-span-2">
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                                                            <input value={tcForm.name || ''} onChange={e => setTCForm(p => ({ ...p, name: e.target.value }))}
                                                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733]/30 focus:border-[#862733]"
                                                                placeholder="e.g. Basic Addition" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                                                            <input type="number" min={0} step={0.5} value={tcForm.points ?? 10}
                                                                onChange={e => setTCForm(p => ({ ...p, points: parseFloat(e.target.value) || 0 }))}
                                                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733]/30 focus:border-[#862733]" />
                                                        </div>
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
                                                                { key: 'is_sample', label: 'Sample', desc: 'Visible as example' },
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
                                    <Card>
                                        <CardHeader><CardTitle className="text-base">Grading Weights</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="flex rounded-full overflow-hidden h-3 bg-gray-200">
                                                <div className="bg-blue-500 transition-all" style={{ width: `${assignment.test_weight}%` }} />
                                                <div className="bg-purple-500 transition-all" style={{ width: `${assignment.rubric_weight}%` }} />
                                            </div>
                                            <div className="flex justify-between mt-2 text-xs text-gray-600">
                                                <span className="flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500" /> Tests {assignment.test_weight}%
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full bg-purple-500" /> Rubric {assignment.rubric_weight}%
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
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
                            {/* Submissions Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <p className="text-2xl font-bold text-gray-900">{stats.submitted}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Students</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <p className="text-2xl font-bold text-green-600">{stats.graded}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Graded</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <p className="text-2xl font-bold text-blue-600">
                                            {stats.avg !== null ? stats.avg.toFixed(1) : '—'}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">Avg Score</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <p className="text-2xl font-bold text-emerald-600">{stats.passing}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Passing</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <p className="text-2xl font-bold text-amber-600">{stats.late}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Late</p>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="p-4 text-center">
                                        <p className="text-2xl font-bold text-red-600">{stats.flagged}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">Flagged</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Plagiarism Check */}
                            {assignment.enable_plagiarism_check && (
                                <Card className="border-purple-200 bg-purple-50/30">
                                    <CardContent className="p-4">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-purple-100">
                                                    <Shield className="w-5 h-5 text-purple-700" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">Plagiarism Detection</p>
                                                    <p className="text-xs text-gray-500">
                                                        Threshold: {assignment.plagiarism_threshold ?? 30}% · Compares all submissions using n-gram fingerprinting
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                onClick={runPlagiarismCheckAll}
                                                disabled={plagiarismRunning || submissions.length < 2}
                                                size="sm"
                                                className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                                            >
                                                {plagiarismRunning
                                                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Checking...</>
                                                    : <><Shield className="w-3.5 h-3.5 mr-1.5" /> Run Plagiarism Check</>
                                                }
                                            </Button>
                                        </div>
                                        {plagiarismResult && (
                                            <div className={`mt-3 rounded-lg p-3 text-sm ${plagiarismResult.error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-white border border-purple-200'}`}>
                                                {plagiarismResult.error ? (
                                                    <p>{plagiarismResult.error}</p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-4">
                                                        <span className="text-gray-600">Checked: <strong className="text-gray-900">{plagiarismResult.total_checked}</strong> submissions</span>
                                                        {plagiarismResult.results?.filter((r: any) => r.plagiarism_flagged).length > 0 && (
                                                            <span className="text-red-600 font-medium">
                                                                <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                                                                {plagiarismResult.results.filter((r: any) => r.plagiarism_flagged).length} flagged
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

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
                            ) : (
                                <div className="space-y-3">
                                    {filteredGroups.map((group) => {
                                        const isExpanded = expandedStudents.has(group.student.id);
                                        const latest = group.latestSubmission;
                                        const hasFlagged = group.submissions.some(s => s.plagiarism_flagged || s.ai_flagged);

                                        return (
                                            <Card key={group.student.id} className={`overflow-hidden transition-shadow hover:shadow-md ${hasFlagged ? 'border-l-4 border-l-red-500' : ''}`}>
                                                {/* Student Row */}
                                                <div
                                                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                                                    onClick={() => toggleExpanded(group.student.id)}
                                                >
                                                    <button className="shrink-0 text-gray-400">
                                                        {isExpanded
                                                            ? <ChevronDown className="w-5 h-5" />
                                                            : <ChevronRight className="w-5 h-5" />
                                                        }
                                                    </button>

                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                                        latest.plagiarism_flagged ? 'bg-red-100' : 'bg-primary/10'
                                                    }`}>
                                                        <User className={`w-5 h-5 ${latest.plagiarism_flagged ? 'text-red-500' : 'text-primary'}`} />
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="font-semibold text-gray-900 truncate">{group.student.full_name}</p>
                                                            {latest.plagiarism_flagged && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700 border border-red-200">
                                                                    <Shield className="w-3 h-3" /> PLAGIARISM
                                                                </span>
                                                            )}
                                                            {!latest.plagiarism_flagged && hasFlagged && (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-700">
                                                                    <AlertTriangle className="w-3 h-3" /> Flagged
                                                                </span>
                                                            )}
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
                                                        {/* Inline plagiarism match info */}
                                                        {latest.plagiarism_checked && latest.plagiarism_score !== null && latest.plagiarism_score > 0 && latest.plagiarism_report?.matches?.length > 0 && (
                                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                                <span className="text-[10px] text-gray-400">Matched with:</span>
                                                                {latest.plagiarism_report.matches.slice(0, 3).map((pm: any, i: number) => (
                                                                    <span key={i} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                                                        pm.similarity_percentage >= (assignment.plagiarism_threshold ?? 30) ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                                                                    }`}>
                                                                        {pm.student_name} ({pm.similarity_percentage.toFixed(0)}%)
                                                                    </span>
                                                                ))}
                                                                {latest.plagiarism_report.matches.length > 3 && (
                                                                    <span className="text-[10px] text-gray-400">+{latest.plagiarism_report.matches.length - 3} more</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="hidden sm:flex items-center gap-6 text-sm shrink-0">
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-500">Attempts</p>
                                                            <p className="font-semibold text-gray-900">{group.totalAttempts}</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs text-gray-500">Tests</p>
                                                            <p className="font-semibold text-gray-900">
                                                                {latest.tests_total > 0 ? `${latest.tests_passed}/${latest.tests_total}` : '—'}
                                                            </p>
                                                        </div>
                                                        <div className="text-center min-w-[70px]">
                                                            <p className="text-xs text-gray-500">Best Score</p>
                                                            <p className={`text-lg font-bold ${getScoreColor(group.bestScore, assignment.max_score)}`}>
                                                                {group.bestScore !== null ? group.bestScore.toFixed(1) : '—'}
                                                                <span className="text-xs text-gray-400 font-normal">/{assignment.max_score}</span>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Plagiarism similarity column */}
                                                    {latest.plagiarism_checked && latest.plagiarism_score !== null && latest.plagiarism_score > 0 && (
                                                        <div className="hidden lg:flex flex-col items-center min-w-[70px] shrink-0">
                                                            <p className="text-xs text-gray-500 mb-0.5">Similarity</p>
                                                            <p className={`text-lg font-bold ${latest.plagiarism_score >= (assignment.plagiarism_threshold ?? 30) ? 'text-red-600' : latest.plagiarism_score >= 20 ? 'text-amber-600' : 'text-gray-500'}`}>
                                                                {latest.plagiarism_score.toFixed(0)}%
                                                            </p>
                                                            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-0.5">
                                                                <div className={`h-full rounded-full ${
                                                                    latest.plagiarism_score >= (assignment.plagiarism_threshold ?? 30) ? 'bg-red-500' : latest.plagiarism_score >= 20 ? 'bg-amber-500' : 'bg-gray-400'
                                                                }`} style={{ width: `${Math.min(latest.plagiarism_score, 100)}%` }} />
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="shrink-0">
                                                        <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusBadge(latest.status)}`}>
                                                            {latest.status}
                                                        </span>
                                                    </div>

                                                    <Button
                                                        size="sm"
                                                        onClick={(e) => { e.stopPropagation(); navigateToGrading(group.student.id); }}
                                                        className="h-8 px-3 text-xs shrink-0 gap-1.5 bg-[#862733] hover:bg-[#a03040] text-white"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" /> Grade
                                                    </Button>
                                                </div>

                                                {/* Expanded: All Submissions */}
                                                {isExpanded && (
                                                    <div className="border-t bg-gray-50/50">
                                                        <div className="px-4 py-3">
                                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                                                All Submissions ({group.totalAttempts})
                                                            </p>
                                                            <div className="space-y-2">
                                                                {group.submissions.map((sub, idx) => (
                                                                    <div
                                                                        key={sub.id}
                                                                        className={`flex items-center gap-4 p-3 rounded-xl border bg-white cursor-pointer hover:shadow-sm transition-all ${
                                                                            idx === 0 ? 'border-primary/30 ring-1 ring-primary/10' : 'border-gray-200'
                                                                        }`}
                                                                        onClick={(e) => { e.stopPropagation(); navigateToGrading(group.student.id); }}
                                                                    >
                                                                        <div className="flex items-center gap-2 shrink-0">
                                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                                                                idx === 0 ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'
                                                                            }`}>
                                                                                #{sub.attempt_number}
                                                                            </div>
                                                                            {idx === 0 && (
                                                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                                                                    Latest
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm text-gray-700">
                                                                                {formatDateTime(sub.submitted_at)}
                                                                            </p>
                                                                            <div className="flex items-center gap-3 mt-0.5">
                                                                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${getStatusBadge(sub.status)}`}>
                                                                                    {sub.status}
                                                                                </span>
                                                                                {sub.is_late && (
                                                                                    <span className="text-[10px] text-amber-600 font-medium">
                                                                                        Late ({sub.late_penalty_applied}% penalty)
                                                                                    </span>
                                                                                )}
                                                                                {(sub.plagiarism_flagged || sub.ai_flagged) && (
                                                                                    <span className="text-[10px] text-red-600 font-medium flex items-center gap-0.5">
                                                                                        <AlertTriangle className="w-3 h-3" />
                                                                                        {sub.plagiarism_flagged && 'Plagiarism'}
                                                                                        {sub.plagiarism_flagged && sub.ai_flagged && ' & '}
                                                                                        {sub.ai_flagged && 'AI'}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        <div className="hidden sm:flex items-center gap-4 shrink-0">
                                                                            {sub.tests_total > 0 && (
                                                                                <div className="text-center">
                                                                                    <p className="text-xs text-gray-500">Tests</p>
                                                                                    <p className={`text-sm font-semibold ${sub.tests_passed === sub.tests_total ? 'text-green-600' : 'text-gray-700'}`}>
                                                                                        {sub.tests_passed}/{sub.tests_total}
                                                                                    </p>
                                                                                </div>
                                                                            )}
                                                                            {sub.plagiarism_checked && sub.plagiarism_score !== null && sub.plagiarism_score > 0 && (
                                                                                <div className="text-center">
                                                                                    <p className="text-xs text-gray-500">Similarity</p>
                                                                                    <p className={`text-sm font-semibold ${sub.plagiarism_flagged ? 'text-red-600' : 'text-gray-500'}`}>
                                                                                        {sub.plagiarism_score.toFixed(0)}%
                                                                                    </p>
                                                                                </div>
                                                                            )}
                                                                            <div className="text-center min-w-[60px]">
                                                                                <p className="text-xs text-gray-500">Score</p>
                                                                                <p className={`text-sm font-bold ${getScoreColor(sub.final_score, sub.max_score)}`}>
                                                                                    {sub.final_score !== null ? sub.final_score.toFixed(1) : '—'}
                                                                                </p>
                                                                            </div>
                                                                        </div>

                                                                        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
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
                                                                N-gram fingerprinting with Jaccard similarity · Threshold: {assignment.plagiarism_threshold ?? 30}%
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
                                                                        <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
                                                                            <CheckCircle2 className="w-10 h-10 mx-auto text-green-500 mb-3" />
                                                                            <p className="text-sm font-medium text-gray-700">No suspicious matches</p>
                                                                            <p className="text-xs text-gray-500 mt-1">This submission appears to be original work.</p>
                                                                        </div>
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
    );
}
