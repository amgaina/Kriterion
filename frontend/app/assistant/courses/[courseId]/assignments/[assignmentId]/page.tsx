'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CourseLoadingPage } from '@/components/course/CourseLoading';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import {
    ArrowLeft,
    User,
    Clock,
    CheckCircle,
    FileCode,
    ChevronRight,
    Search,
} from 'lucide-react';
import { format, isPast } from 'date-fns';

interface StudentInfo {
    id: number;
    full_name: string;
    email: string;
}

interface SubmissionItem {
    id: number;
    student_id: number;
    student?: StudentInfo;
    attempt_number: number;
    status: string;
    submitted_at: string;
    tests_passed: number;
    tests_total: number;
    final_score: number | null;
    max_score: number;
}

interface Assignment {
    id: number;
    title: string;
    course?: { id: number; code: string; name: string };
    max_score?: number;
    due_date?: string;
}

const isSubmissionGraded = (submission: SubmissionItem) => {
    const status = String(submission.status || '').toLowerCase();
    return submission.final_score != null || status === 'completed' || status === 'autograded' || status === 'graded';
};

const getScoreColor = (score: number, max: number) => {
    if (max <= 0) return 'text-gray-600';
    const pct = (score / max) * 100;
    if (pct >= 90) return 'text-emerald-600';
    if (pct >= 70) return 'text-blue-600';
    if (pct >= 50) return 'text-amber-600';
    return 'text-red-600';
};

const getScoreBgColor = (score: number, max: number) => {
    if (max <= 0) return 'bg-gray-50';
    const pct = (score / max) * 100;
    if (pct >= 90) return 'bg-emerald-50';
    if (pct >= 70) return 'bg-blue-50';
    if (pct >= 50) return 'bg-amber-50';
    return 'bg-red-50';
};

export default function AssistantAssignmentPage() {
    const params = useParams();
    const courseId = Number(params?.courseId);
    const assignmentId = Number(params?.assignmentId);
    const [searchQuery, setSearchQuery] = useState('');

    const { data: assignment, isLoading: assignLoading } = useQuery<Assignment>({
        queryKey: ['assignment', assignmentId],
        queryFn: () => apiClient.getAssignment(assignmentId),
        enabled: !!assignmentId,
    });

    const { data: submissions = [], isLoading: subsLoading } = useQuery<SubmissionItem[]>({
        queryKey: ['assignment-submissions', assignmentId],
        queryFn: () => apiClient.getAssignmentSubmissions(assignmentId),
        enabled: !!assignmentId,
    });

    const studentGroups = useMemo(
        () =>
            submissions.reduce<Map<number, SubmissionItem[]>>((acc, sub) => {
                const sid = sub.student_id;
                if (!acc.has(sid)) acc.set(sid, []);
                acc.get(sid)!.push(sub);
                return acc;
            }, new Map()),
        [submissions]
    );

    const studentsWithLatest = useMemo(() => {
        return Array.from(studentGroups.entries()).map(([studentId, subs]) => {
            const sorted = [...subs].sort(
                (a, b) => {
                    const submittedAtDiff = new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
                    if (submittedAtDiff !== 0) return submittedAtDiff;

                    const attemptDiff = (b.attempt_number || 0) - (a.attempt_number || 0);
                    if (attemptDiff !== 0) return attemptDiff;

                    return (b.id || 0) - (a.id || 0);
                }
            );
            const latest = sorted[0];
            const pending = !isSubmissionGraded(latest);
            return {
                studentId,
                student: latest.student || { id: studentId, full_name: 'Student', email: '' },
                latest,
                pending,
                totalAttempts: sorted.length,
            };
        });
    }, [studentGroups]);

    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return studentsWithLatest;
        const q = searchQuery.toLowerCase();
        return studentsWithLatest.filter(
            (s) =>
                s.student.full_name.toLowerCase().includes(q) ||
                s.student.email.toLowerCase().includes(q)
        );
    }, [studentsWithLatest, searchQuery]);

    const sortedStudents = useMemo(() => {
        return [...filteredStudents].sort((a, b) => {
            if (a.pending !== b.pending) return a.pending ? -1 : 1;
            return a.student.full_name.localeCompare(b.student.full_name);
        });
    }, [filteredStudents]);

    const pendingCount = studentsWithLatest.filter((s) => s.pending).length;
    const gradedCount = studentsWithLatest.length - pendingCount;

    const isLoading = assignLoading || subsLoading;

    if (isLoading || !assignment) {
        return (
            <div className="space-y-6 pb-8">
                <div className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
                <CourseLoadingPage message="Loading assignment..." />
            </div>
        );
    }

    const courseCode = assignment.course?.code || '';
    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    const isOverdue = dueDate && isPast(dueDate);
    const maxScore = assignment.max_score ?? 100;

    return (
        <div className="space-y-6 pb-8">
            <Link href={`/assistant/courses/${courseId}`}>
                <Button variant="ghost" size="sm" className="gap-2 -ml-1">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Course
                </Button>
            </Link>

            <InnerHeaderDesign
                title={assignment.title}
                subtitle={`${courseCode} · ${maxScore} pts${dueDate ? ` · Due ${format(dueDate, 'MMM d, yyyy')}${isOverdue ? ' (Past due)' : ''}` : ''}`}
            />

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
                                <p className="text-xs text-gray-500">Pending to grade</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{gradedCount}</p>
                                <p className="text-xs text-gray-500">Graded</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-gray-100 shadow-sm hover:shadow-md transition-shadow col-span-2 lg:col-span-1">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <User className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">
                                    {studentsWithLatest.length}
                                </p>
                                <p className="text-xs text-gray-500">Students</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <Card className="border-gray-100 shadow-sm">
                <CardContent className="p-4">
                    <div className="relative max-w-xl">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search students by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 border-gray-200 focus:border-primary focus:ring-primary/20"
                        />
                    </div>
                    {searchQuery && studentsWithLatest.length > 0 && (
                        <p className="text-sm text-gray-500 mt-2">
                            Showing {sortedStudents.length} of {studentsWithLatest.length} students
                            <button
                                onClick={() => setSearchQuery('')}
                                className="ml-2 text-primary hover:underline"
                            >
                                Clear
                            </button>
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Student list */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Student Submissions
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    Click a student to grade their latest submission. Each student is shown once with
                    their most recent attempt.
                </p>

                {studentsWithLatest.length === 0 ? (
                    <Card className="border-gray-100 shadow-sm">
                        <CardContent className="py-16">
                            <div className="text-center">
                                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <FileCode className="w-10 h-10 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                    No submissions yet
                                </h3>
                                <p className="text-gray-500 max-w-md mx-auto">
                                    Students haven&apos;t submitted for this assignment. Submissions
                                    will appear here when they submit.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : sortedStudents.length === 0 ? (
                    <Card className="border-gray-100 shadow-sm">
                        <CardContent className="py-16">
                            <div className="text-center">
                                <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gray-100 flex items-center justify-center">
                                    <Search className="w-7 h-7 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                    No students found
                                </h3>
                                <p className="text-gray-500">Try adjusting your search</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {sortedStudents.map(({ studentId, student, latest, pending, totalAttempts }) => {
                            const scorePct =
                                latest.final_score != null && latest.max_score > 0
                                    ? (latest.final_score / latest.max_score) * 100
                                    : 0;

                            return (
                                <Card
                                    key={studentId}
                                    className="hover:shadow-md transition-all duration-200 group border-gray-100 overflow-hidden"
                                >
                                    <div className="flex items-stretch">
                                        {/* Status bar */}
                                        <div
                                            className={`w-1.5 flex-shrink-0 ${
                                                pending ? 'bg-primary' : 'bg-emerald-500'
                                            }`}
                                        />

                                        <Link
                                            href={`/assistant/courses/${courseId}/assignments/${assignmentId}/grade/${studentId}`}
                                            className="flex-1 p-4 md:p-5 hover:bg-gray-50/50 transition-colors min-w-0"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                                                        <span className="text-base font-semibold text-primary">
                                                            {student.full_name?.charAt(0) || '?'}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">
                                                            {student.full_name}
                                                        </p>
                                                        <p className="text-sm text-gray-500 truncate">
                                                            {student.email}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                            <span>
                                                                Submitted{' '}
                                                                {format(
                                                                    new Date(latest.submitted_at),
                                                                    'MMM d, h:mm a'
                                                                )}
                                                            </span>
                                                            <span>
                                                                {latest.tests_passed}/
                                                                {latest.tests_total} tests
                                                            </span>
                                                            {totalAttempts > 1 && (
                                                                <span>{totalAttempts} attempts</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 flex-shrink-0">
                                                    {pending ? (
                                                        <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-amber-100 text-amber-800">
                                                            Pending
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${getScoreBgColor(
                                                                latest.final_score ?? 0,
                                                                latest.max_score
                                                            )} ${getScoreColor(
                                                                latest.final_score ?? 0,
                                                                latest.max_score
                                                            )}`}
                                                        >
                                                            {latest.final_score?.toFixed(1)} /{' '}
                                                            {latest.max_score}
                                                        </span>
                                                    )}
                                                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
