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
    AlertCircle,
    Loader2,
    CheckCircle2,
    Edit,
    Eye,
    EyeOff,
    Users,
    RefreshCw,
    Trash2,
    Search,
    ChevronDown,
    ChevronRight,
    X,
    User,
    Inbox,
    LayoutDashboard,
    Shield,
    AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

    const [activeTab, setActiveTab] = useState<'overview' | 'submissions'>('overview');
    const [searchQuery, setSearchQuery] = useState('');

    // Test case management state
    const [editingTC, setEditingTC] = useState<TestCaseItem | null>(null);
    const [isAddingTC, setIsAddingTC] = useState(false);
    const [savingTC, setSavingTC] = useState(false);
    const [deletingTCId, setDeletingTCId] = useState<number | null>(null);
    const [tcForm, setTCForm] = useState<Partial<TestCaseItem>>({});
    const [tcError, setTCError] = useState<string | null>(null);
    const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());
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
        enabled: !!assignmentId && activeTab === 'submissions',
    });

    const publishMutation = useMutation({
        mutationFn: () => apiClient.publishAssignment(assignmentId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assignment', assignmentId] }),
    });

    const deleteMutation = useMutation({
        mutationFn: () => apiClient.deleteAssignment(assignmentId),
        onSuccess: () => router.push(`/faculty/courses/${courseId}/assignments`),
    });

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
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${assignment.is_published ? 'bg-white/20' : 'bg-white/30'
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
            <div className="flex justify-center overflow-x-auto py-1">
                <nav className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-gray-100/80 border border-gray-200/80 shadow-sm min-w-0">
                    {[
                        { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
                        { id: 'submissions' as const, label: 'Submissions', icon: Inbox },
                    ].map((item) => {
                        const active = activeTab === item.id;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setActiveTab(item.id)}
                                className="relative block active:scale-[0.98] transition-transform"
                            >
                                <span
                                    className={`
                                        relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                                        transition-all duration-200 ease-out
                                        ${active ? 'text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'}
                                    `}
                                >
                                    <Icon className="w-4 h-4 flex-shrink-0" />
                                    {item.label}
                                    {item.id === 'submissions' && (assignment.submission_count ?? 0) > 0 && (
                                        <span className="ml-0.5 px-1.5 py-0.5 text-xs rounded-full bg-white/20 font-semibold">
                                            {assignment.submission_count}
                                        </span>
                                    )}
                                </span>
                                <AnimatePresence>
                                    {active && (
                                        <motion.span
                                            layoutId="assignment-tab"
                                            className="absolute inset-0 z-0 rounded-xl bg-[#862733] shadow-md"
                                            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                            initial={false}
                                        />
                                    )}
                                </AnimatePresence>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* ─── Tab Content ─── */}
            <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
                <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                >
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
                                        <CardTitle className="text-base">Starter Code</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto font-mono">
                                            {assignment.starter_code}
                                        </pre>
                                    </CardContent>
                                </Card>
                            )}

                            {/* ─── Test Cases ─── */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        Test Cases
                                        <span className="ml-2 text-sm font-normal text-gray-400">({testCases.length})</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {testCases.length === 0 ? (
                                        <p className="text-sm text-gray-500 py-4">No test cases. Edit the assignment to add them.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {testCases.map((tc, idx) => (
                                                <div key={tc.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 border border-gray-100">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-6 h-6 rounded-md bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-medium">
                                                            {idx + 1}
                                                        </span>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">{tc.name}</p>
                                                            {tc.description && <p className="text-xs text-gray-500 truncate max-w-[200px]">{tc.description}</p>}
                                                        </div>
                                                        {tc.is_hidden && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">Hidden</span>}
                                                        {tc.is_sample && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Sample</span>}
                                                    </div>
                                                    <span className="text-sm font-semibold text-gray-700">{tc.points} pts</span>
                                                </div>
                                            ))}
                                            <p className="text-xs text-gray-500 pt-2 border-t border-gray-100 mt-2">
                                                {testCases.reduce((s, t) => s + t.points, 0)} total points · Manage via Edit
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div>
                            <Card>
                                <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
                                <CardContent className="space-y-3 text-sm">
                                    <div className="flex justify-between"><span className="text-gray-500">Max score</span><span className="font-medium">{assignment.max_score}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Passing</span><span className="font-medium">{assignment.passing_score}</span></div>
                                    {assignment.due_date && (
                                        <div className="flex justify-between"><span className="text-gray-500">Due</span><span className="font-medium">{formatDateTime(assignment.due_date)}</span></div>
                                    )}
                                    <div className="flex justify-between"><span className="text-gray-500">Max attempts</span><span className="font-medium">{assignment.max_attempts === 0 ? '∞' : assignment.max_attempts}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Late allowed</span>{assignment.allow_late ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <span className="text-gray-400">No</span>}</div>
                                    {assignment.allow_late && assignment.late_penalty_per_day != null && (
                                        <div className="flex justify-between"><span className="text-gray-500">Late penalty</span><span className="font-medium">{assignment.late_penalty_per_day}%/day</span></div>
                                    )}
                                    <div className="flex justify-between pt-2 border-t"><span className="text-gray-500">Tests</span><span className="font-medium">{assignment.test_weight}%</span></div>
                                    <div className="flex justify-between"><span className="text-gray-500">Rubric</span><span className="font-medium">{assignment.rubric_weight}%</span></div>
                                    <p className="text-xs text-gray-400 pt-2">{formatDate(assignment.created_at)}</p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </motion.div>
            )}

            {activeTab === 'submissions' && (
                <motion.div
                    key="submissions"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                >
                    {/* Search and Sort */}
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
                                            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors capitalize ${sortBy === col
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

                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${latest.plagiarism_flagged ? 'bg-red-100' : 'bg-primary/10'
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
                                                </p>
                                            </div>

                                            <div className="hidden sm:flex items-center gap-6 text-sm shrink-0">
                                                <div className="text-center">
                                                    <p className="text-xs text-gray-500">Attempts</p>
                                                    <p className="font-semibold text-gray-900">{group.totalAttempts}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xs text-gray-500">Tests</p>
                                                    <p className="font-semibold text-gray-900">
                                                        {latest.tests_total > 0 ? `${latest.tests_passed}/${latest.tests_total}` : '-'}
                                                    </p>
                                                </div>
                                                <div className="text-center min-w-[70px]">
                                                    <p className="text-xs text-gray-500">Best Score</p>
                                                    <p className={`text-lg font-bold ${getScoreColor(group.bestScore, assignment.max_score)}`}>
                                                        {group.bestScore !== null ? group.bestScore.toFixed(1) : '-'}
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
                                                        <div className={`h-full rounded-full ${latest.plagiarism_score >= (assignment.plagiarism_threshold ?? 30) ? 'bg-red-500' : latest.plagiarism_score >= 20 ? 'bg-amber-500' : 'bg-gray-400'
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
                                                                className={`flex items-center gap-4 p-3 rounded-xl border bg-white cursor-pointer hover:shadow-sm transition-all ${idx === 0 ? 'border-primary/30 ring-1 ring-primary/10' : 'border-gray-200'
                                                                    }`}
                                                                onClick={(e) => { e.stopPropagation(); navigateToGrading(group.student.id); }}
                                                            >
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'
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
                                                                            {sub.final_score !== null ? sub.final_score.toFixed(1) : '-'}
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
                </motion.div>
            )}
            </AnimatePresence>
        </div>
    );
}
