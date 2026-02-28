'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
    Search,
    CheckCircle,
    Clock,
    User,
    FileCode,
    ChevronRight,
    ArrowLeft,
    Save,
    Zap,
} from 'lucide-react';

export default function AssistantGradingPage() {
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const courseFilter = searchParams.get('course') ? parseInt(searchParams.get('course')!, 10) : null;

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAssignment, setSelectedAssignment] = useState<number | null>(null);
    const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
    const [feedback, setFeedback] = useState('');
    const [manualScore, setManualScore] = useState<number | null>(null);
    const [successMessage, setSuccessMessage] = useState('');

    const { data: courses = [] } = useQuery({
        queryKey: ['assistant-courses'],
        queryFn: () => apiClient.getCourses(),
    });

    const { data: rawSubmissions = [], isLoading } = useQuery({
        queryKey: ['assistant-grading-submissions'],
        queryFn: () => apiClient.getSubmissions(),
    });

    const { data: assignmentSubmissions = [] } = useQuery({
        queryKey: ['assistant-assignment-submissions', selectedAssignment],
        queryFn: () => apiClient.getAssignmentSubmissions(selectedAssignment!),
        enabled: !!selectedAssignment,
    });

    const { data: assignments = [] } = useQuery({
        queryKey: ['assistant-assignments', courseFilter],
        queryFn: async () => {
            if (courseFilter) {
                const courseAssignments = await apiClient.getCourseAssignments(courseFilter, true);
                return courseAssignments;
            }
            const all: any[] = [];
            for (const c of courses) {
                const aList = await apiClient.getCourseAssignments(c.id, true);
                all.push(...(aList || []));
            }
            return all;
        },
        enabled: courses.length > 0,
    });

    const assignmentMap = useMemo(() => {
        const map: Record<number, { id: number; title: string; course_code: string; course_id: number }> = {};
        for (const a of assignments as any[]) {
            map[a.id] = { id: a.id, title: a.title || a.name, course_code: a.course?.code || '', course_id: a.course_id };
        }
        return map;
    }, [assignments]);

    const submissionsByAssignment = useMemo(() => {
        const byAssign: Record<number, any[]> = {};
        for (const s of rawSubmissions as any[]) {
            const aid = s.assignment_id ?? s.assignment?.id;
            if (!aid) continue;
            if (courseFilter && assignmentMap[aid]?.course_id !== courseFilter) continue;
            if (!byAssign[aid]) byAssign[aid] = [];
            byAssign[aid].push(s);
        }
        return byAssign;
    }, [rawSubmissions, assignmentMap, courseFilter]);

    const assignmentList = useMemo(() => {
        return Object.entries(submissionsByAssignment).map(([aid, subs]) => {
            const a = assignmentMap[parseInt(aid)];
            const pending = subs.filter((s: any) => !['completed'].includes(String(s.status || ''))).length;
            return {
                id: parseInt(aid),
                title: a?.title || 'Assignment',
                course_code: a?.course_code || '',
                pending_count: pending,
                graded_count: subs.length - pending,
                total_count: subs.length,
            };
        });
    }, [submissionsByAssignment, assignmentMap]);

    const pendingSubmissions = useMemo(() => {
        const aid = selectedAssignment;
        if (!aid) return [];
        const subs = (assignmentSubmissions as any[]).length > 0
            ? assignmentSubmissions
            : (submissionsByAssignment[aid] || []);
        return subs.filter((s: any) => !['completed'].includes(String(s.status || '')));
    }, [selectedAssignment, submissionsByAssignment, assignmentSubmissions]);

    const filteredSubmissions = pendingSubmissions.filter((s: any) => {
        const name = (s.student?.full_name || s.student_name || '').toLowerCase();
        return name.includes(searchQuery.toLowerCase());
    });

    const gradeMutation = useMutation({
        mutationFn: async ({ submissionId, score, feedback }: { submissionId: number; score: number; feedback: string }) => {
            await apiClient.saveManualGrade(submissionId, { final_score: score, feedback });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assistant-grading-submissions'] });
            setSelectedSubmission(null);
            setFeedback('');
            setManualScore(null);
            setSuccessMessage('Grade saved successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        },
    });

    const handleGrade = () => {
        if (!selectedSubmission) return;
        const sid = typeof selectedSubmission.id === 'number' ? selectedSubmission.id : parseInt(selectedSubmission.id);
        const score = manualScore ?? (selectedSubmission.test_score ?? selectedSubmission.raw_score ?? 0);
        gradeMutation.mutate({ submissionId: sid, score, feedback });
    };

    const totalPending = assignmentList.reduce((acc, a) => acc + a.pending_count, 0);

    return (
        <div className="space-y-6">
            {successMessage && (
                <Alert type="success" title="Success">
                    {successMessage}
                </Alert>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link href="/assistant/dashboard">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="w-4 h-4 mr-1" /> Back
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Grading Assistant</h1>
                        <p className="text-gray-500 mt-1">Grade student submissions for your assigned courses</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{totalPending}</p>
                                <p className="text-sm text-gray-500">Pending Review</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {assignmentList.reduce((acc, a) => acc + a.graded_count, 0)}
                                </p>
                                <p className="text-sm text-gray-500">Graded</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                <FileCode className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{assignmentList.length}</p>
                                <p className="text-sm text-gray-500">Assignments</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Assignments</CardTitle>
                        <CardDescription>Select an assignment to grade</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {assignmentList.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                                <p className="font-medium">All caught up!</p>
                                <p className="text-sm">No pending submissions</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {assignmentList.map((a) => (
                                    <button
                                        key={a.id}
                                        type="button"
                                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${selectedAssignment === a.id ? 'bg-primary/5 border-l-4 border-primary' : ''}`}
                                        onClick={() => setSelectedAssignment(selectedAssignment === a.id ? null : a.id)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-gray-900">{a.title}</p>
                                                <p className="text-sm text-gray-500">{a.course_code}</p>
                                            </div>
                                            {a.pending_count > 0 && (
                                                <Badge variant="warning">{a.pending_count}</Badge>
                                            )}
                                            <ChevronRight className="w-4 h-4 text-gray-400" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Pending Submissions</CardTitle>
                        <div className="relative mt-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search students..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {filteredSubmissions.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                                <p className="font-medium">All caught up!</p>
                                <p className="text-sm">No pending submissions to grade</p>
                            </div>
                        ) : (
                            <div className="divide-y max-h-96 overflow-y-auto">
                                {filteredSubmissions.map((s: any) => {
                                    const name = s.student?.full_name || s.student_name || 'Student';
                                    return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${selectedSubmission?.id === s.id ? 'bg-primary/5' : ''}`}
                                            onClick={() => {
                                                setSelectedSubmission(s);
                                                setFeedback(s.feedback || '');
                                                setManualScore(s.final_score ?? s.raw_score ?? null);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm">
                                                    {name.charAt(0)}
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <p className="font-medium">{name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {s.tests_passed ?? 0}/{s.tests_total ?? 0} tests · {s.status}
                                                    </p>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Grade Submission</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!selectedSubmission ? (
                            <div className="py-12 text-center text-gray-500">
                                <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p>Select a submission to grade</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Score</label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={selectedSubmission.max_score ?? 100}
                                        value={manualScore ?? ''}
                                        onChange={(e) => setManualScore(e.target.value ? parseFloat(e.target.value) : null)}
                                        placeholder="Enter score"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Feedback</label>
                                    <textarea
                                        className="w-full min-h-[120px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        placeholder="Add feedback for the student..."
                                    />
                                </div>
                                <Button
                                    className="w-full"
                                    onClick={handleGrade}
                                    disabled={gradeMutation.isPending}
                                >
                                    {gradeMutation.isPending ? (
                                        <>Saving...</>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4 mr-2" />
                                            Save Grade
                                        </>
                                    )}
                                </Button>
                                <Link href={`/assistant/submissions/${selectedSubmission.id}`}>
                                    <Button variant="outline" className="w-full">
                                        <FileCode className="w-4 h-4 mr-2" />
                                        View Full Submission
                                    </Button>
                                </Link>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
