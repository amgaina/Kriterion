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
    FileCode,
    Clock,
    CheckCircle,
    ChevronRight,
    Search,
    Target,
} from 'lucide-react';
import { format, isPast } from 'date-fns';

interface Assignment {
    id: number;
    title: string;
    course_id: number;
    due_date?: string;
    max_score: number;
    is_published?: boolean;
    description?: string;
}

interface Course {
    id: number;
    code: string;
    name: string;
}

export default function AssistantCourseDetailPage() {
    const params = useParams();
    const courseId = Number(params?.courseId);
    const [searchQuery, setSearchQuery] = useState('');

    const { data: course, isLoading: courseLoading } = useQuery<Course>({
        queryKey: ['course', courseId],
        queryFn: () => apiClient.getCourse(courseId),
        enabled: !!courseId,
    });

    const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<Assignment[]>({
        queryKey: ['assistant-assignments', courseId],
        queryFn: () => apiClient.getCourseAssignments(courseId, true),
        enabled: !!courseId,
    });

    const { data: gradingStats, isLoading: statsLoading } = useQuery({
        queryKey: ['assistant-grading-stats', courseId],
        queryFn: () => apiClient.getGradingStats(courseId),
        enabled: !!courseId,
    });

    const statsByAssignment = useMemo(() => {
        const map: Record<number, { pending: number; graded: number }> = {};
        for (const a of gradingStats?.assignments ?? []) {
            map[a.assignment_id] = { pending: a.pending_count, graded: a.graded_count };
        }
        return map;
    }, [gradingStats]);

    const assignmentStats = useMemo(() => {
        return assignments.map((a) => {
            const s = statsByAssignment[a.id] ?? { pending: 0, graded: 0 };
            return { ...a, pending: s.pending, graded: s.graded, total: s.pending + s.graded };
        });
    }, [assignments, statsByAssignment]);

    const stats = useMemo(() => {
        const totalPending = assignmentStats.reduce((s, a) => s + a.pending, 0);
        const totalGraded = assignmentStats.reduce((s, a) => s + a.graded, 0);
        return { total: assignmentStats.length, pending: totalPending, graded: totalGraded };
    }, [assignmentStats]);

    const filteredAssignments = useMemo(() => {
        if (!searchQuery.trim()) return assignmentStats;
        const q = searchQuery.toLowerCase();
        return assignmentStats.filter(
            (a) =>
                a.title.toLowerCase().includes(q) ||
                (a.description ?? '').toLowerCase().includes(q)
        );
    }, [assignmentStats, searchQuery]);

    const isLoading = courseLoading || assignmentsLoading || statsLoading;

    if (isLoading || !course) {
        return (
            <div className="space-y-6 pb-8">
                <div className="h-9 w-24 bg-gray-200 rounded animate-pulse" />
                <CourseLoadingPage message="Loading course..." />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-8">
            <Link href="/assistant/dashboard">
                <Button variant="ghost" size="sm" className="gap-2 -ml-1">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </Button>
            </Link>

            <InnerHeaderDesign
                title={course.name}
                subtitle={`${course.code} · Grade submissions for this course`}
            />

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <FileCode className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                                <p className="text-xs text-gray-500">Assignments</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                                <p className="text-xs text-gray-500">Pending to grade</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-gray-100 shadow-sm hover:shadow-md transition-shadow col-span-2 lg:col-span-1">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-emerald-600">{stats.graded}</p>
                                <p className="text-xs text-gray-500">Graded</p>
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
                            placeholder="Search assignments..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 border-gray-200 focus:border-primary focus:ring-primary/20"
                        />
                    </div>
                    {searchQuery && assignmentStats.length > 0 && (
                        <p className="text-sm text-gray-500 mt-2">
                            Showing {filteredAssignments.length} of {assignmentStats.length} assignments
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

            {/* Assignments list */}
            <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-primary" />
                    Assignments
                </h2>
                <p className="text-sm text-gray-500 mb-4">
                    Select an assignment to view and grade student submissions. You can only grade—you cannot edit or create assignments.
                </p>

                {assignmentStats.length === 0 ? (
                    <Card className="border-gray-100 shadow-sm">
                        <CardContent className="py-16">
                            <div className="text-center">
                                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <FileCode className="w-10 h-10 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">No assignments yet</h3>
                                <p className="text-gray-500 max-w-md mx-auto">
                                    Assignments will appear here when the instructor adds them to this course.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : filteredAssignments.length === 0 ? (
                    <Card className="border-gray-100 shadow-sm">
                        <CardContent className="py-16">
                            <div className="text-center">
                                <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gray-100 flex items-center justify-center">
                                    <Search className="w-7 h-7 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
                                <p className="text-gray-500">Try adjusting your search</p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {filteredAssignments.map((a) => {
                            const hasPending = a.pending > 0;
                            const isOverdue = a.due_date && isPast(new Date(a.due_date));

                            return (
                                <Card
                                    key={a.id}
                                    className="hover:shadow-md transition-all duration-200 group border-gray-100 overflow-hidden"
                                >
                                    <div className="flex items-stretch">
                                        {/* Status bar */}
                                        <div
                                            className={`w-1.5 flex-shrink-0 ${
                                                hasPending ? (isOverdue ? 'bg-amber-500' : 'bg-primary') : 'bg-emerald-500'
                                            }`}
                                        />

                                        <Link
                                            href={`/assistant/courses/${courseId}/assignments/${a.id}`}
                                            className="flex-1 p-4 md:p-5 hover:bg-gray-50/50 transition-colors min-w-0"
                                        >
                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                                        <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors truncate">
                                                            {a.title}
                                                        </h3>
                                                        {hasPending && (
                                                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                                                                {a.pending} to grade
                                                            </span>
                                                        )}
                                                        {!hasPending && a.total > 0 && (
                                                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
                                                                All graded
                                                            </span>
                                                        )}
                                                        {isOverdue && hasPending && (
                                                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700">
                                                                Past due
                                                            </span>
                                                        )}
                                                    </div>
                                                    {a.description && (
                                                        <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">
                                                            {a.description}
                                                        </p>
                                                    )}
                                                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500">
                                                        <span className="flex items-center gap-1">
                                                            <Target className="w-3.5 h-3.5" />
                                                            {a.max_score} pts
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {a.pending} pending
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                            {a.graded} graded
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 flex-shrink-0">
                                                    {a.due_date && (
                                                        <div className="text-right hidden sm:block">
                                                            <p className="text-xs text-gray-400">Due</p>
                                                            <p
                                                                className={`text-sm font-medium ${
                                                                    isOverdue ? 'text-red-600' : 'text-gray-700'
                                                                }`}
                                                            >
                                                                {format(new Date(a.due_date), 'MMM d, yyyy')}
                                                            </p>
                                                        </div>
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
