'use client';

/**
 * Student Assignments Page
 *
 * Simple, clean list of assignments — consistent with courses page design.
 * - Search and filters
 * - Status badges, due dates, actions
 * - All edge cases handled
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { format, isPast, formatDistanceToNow, isWithinInterval, addDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import {
    FileCode,
    Search,
    Clock,
    CheckCircle2,
    AlertCircle,
    Calendar,
    BookOpen,
    Play,
    Eye,
    ChevronRight,
} from 'lucide-react';

type AssignmentStatus = 'pending' | 'submitted' | 'graded' | 'overdue';

interface Assignment {
    id: number;
    title: string;
    description?: string;
    course_id: number;
    due_date: string;
    max_score: number;
    difficulty?: string;
    is_published?: boolean;
    course?: { id: number; code: string; name: string };
}

interface Submission {
    id: number;
    assignment_id: number;
    status?: string;
    final_score?: number | null;
}

function getAssignmentStatus(
    assignment: Assignment,
    submissions: Submission[]
): AssignmentStatus {
    const sub = submissions.find((s) => s.assignment_id === assignment.id);
    const due = new Date(assignment.due_date);
    const pastDue = isPast(due);

    if (sub?.final_score != null) return 'graded';
    if (sub) return 'submitted';
    if (pastDue) return 'overdue';
    return 'pending';
}

function getTimeText(dueDate: string) {
    const due = new Date(dueDate);
    if (isPast(due)) return 'Overdue';
    const urgent = isWithinInterval(due, { start: new Date(), end: addDays(new Date(), 1) });
    return formatDistanceToNow(due, { addSuffix: true });
}

const STATUS_CONFIG: Record<AssignmentStatus, { label: string; variant: 'default' | 'warning' | 'info' | 'success' | 'danger'; icon: typeof Clock }> = {
    pending: { label: 'Pending', variant: 'warning', icon: Clock },
    submitted: { label: 'Submitted', variant: 'info', icon: Clock },
    graded: { label: 'Graded', variant: 'success', icon: CheckCircle2 },
    overdue: { label: 'Overdue', variant: 'danger', icon: AlertCircle },
};

const DIFFICULTY_STYLES: Record<string, string> = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    hard: 'bg-red-100 text-red-700',
};

export default function StudentAssignmentsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'all'>('all');
    const [courseFilter, setCourseFilter] = useState<string>('all');

    const { data: assignments = [], isLoading, isError, error, refetch } = useQuery({
        queryKey: ['student-assignments'],
        queryFn: () => apiClient.getAssignments(),
        staleTime: 2 * 60 * 1000,
    });

    const { data: submissions = [] } = useQuery({
        queryKey: ['student-submissions'],
        queryFn: () => apiClient.getSubmissions(),
        staleTime: 2 * 60 * 1000,
    });

    const { data: courses = [] } = useQuery({
        queryKey: ['student-courses'],
        queryFn: () => apiClient.getCourses(),
    });

    const enrichedAssignments = useMemo(() => {
        const list = (assignments as Assignment[]).filter((a) => a.is_published !== false);
        return list.map((a) => ({
            ...a,
            status: getAssignmentStatus(a, submissions as Submission[]),
            submission: (submissions as Submission[]).find((s) => s.assignment_id === a.id),
        }));
    }, [assignments, submissions]);

    const filteredAssignments = useMemo(() => {
        let result = enrichedAssignments;
        const q = searchQuery.toLowerCase().trim();
        if (q) {
            result = result.filter(
                (a) =>
                    a.title.toLowerCase().includes(q) ||
                    (a.course?.name ?? '').toLowerCase().includes(q) ||
                    (a.course?.code ?? '').toLowerCase().includes(q)
            );
        }
        if (statusFilter !== 'all') {
            result = result.filter((a) => a.status === statusFilter);
        }
        if (courseFilter !== 'all') {
            result = result.filter((a) => a.course_id.toString() === courseFilter);
        }
        return [...result].sort((a, b) =>
            new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        );
    }, [enrichedAssignments, searchQuery, statusFilter, courseFilter]);

    const counts = useMemo(() => ({
        pending: enrichedAssignments.filter((a) => a.status === 'pending').length,
        submitted: enrichedAssignments.filter((a) => a.status === 'submitted').length,
        graded: enrichedAssignments.filter((a) => a.status === 'graded').length,
        overdue: enrichedAssignments.filter((a) => a.status === 'overdue').length,
    }), [enrichedAssignments]);

    const hasActiveFilters = searchQuery.trim() || statusFilter !== 'all' || courseFilter !== 'all';

    return (
        <div className="space-y-6 pb-8">
            <InnerHeaderDesign
                title="My Assignments"
                subtitle={`${counts.pending} pending · ${counts.submitted} submitted · ${counts.graded} graded`}
            />

            {/* Error State */}
            {isError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="font-semibold text-sm text-red-800">Failed to load assignments</p>
                        <p className="text-sm text-red-700 mt-0.5">
                            {(error as Error)?.message || 'An error occurred.'}
                        </p>
                    </div>
                    <button
                        onClick={() => refetch()}
                        className="px-3 py-1.5 text-sm border border-red-300 rounded-lg text-red-700 hover:bg-red-100 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* Search & Filters */}
            <Card className="border-gray-100 shadow-sm">
                <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search assignments by title or course..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 border-gray-200 focus:border-primary focus:ring-primary/20"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as AssignmentStatus | 'all')}
                            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="submitted">Submitted</option>
                            <option value="graded">Graded</option>
                            <option value="overdue">Overdue</option>
                        </select>
                        <select
                            value={courseFilter}
                            onChange={(e) => setCourseFilter(e.target.value)}
                            className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                        >
                            <option value="all">All Courses</option>
                            {(courses as { id: number; name: string }[]).map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    {hasActiveFilters && (
                        <p className="text-sm text-gray-500 mt-2">
                            Showing {filteredAssignments.length} of {enrichedAssignments.length}
                            <button
                                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setCourseFilter('all'); }}
                                className="ml-2 text-primary hover:underline"
                            >
                                Clear filters
                            </button>
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Loading */}
            {isLoading && (
                <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-4">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-gray-200" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-5 bg-gray-200 rounded w-1/3" />
                                        <div className="h-4 bg-gray-200 rounded w-2/3" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Empty State — no assignments at all */}
            {!isLoading && !isError && enrichedAssignments.length === 0 && (
                <Card className="border-gray-100 shadow-sm">
                    <CardContent className="py-16">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <FileCode className="w-10 h-10 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">No assignments yet</h3>
                            <p className="text-gray-500 max-w-md mx-auto mb-6">
                                No assignments have been published in your courses. Check back later or contact your instructor.
                            </p>
                            <Link href="/student/courses">
                                <Button className="bg-primary hover:bg-primary-700 text-white">
                                    View My Courses
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* No Results — filters applied but nothing matches */}
            {!isLoading && !isError && enrichedAssignments.length > 0 && filteredAssignments.length === 0 && (
                <Card className="border-gray-100 shadow-sm">
                    <CardContent className="py-16">
                        <div className="text-center">
                            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gray-100 flex items-center justify-center">
                                <Search className="w-7 h-7 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
                            <p className="text-gray-500 mb-6">
                                {hasActiveFilters ? 'Try adjusting your search or filters.' : 'No assignments match.'}
                            </p>
                            <Button
                                className="bg-primary hover:bg-primary-700 text-white"
                                onClick={() => { setSearchQuery(''); setStatusFilter('all'); setCourseFilter('all'); }}
                            >
                                Clear Filters
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Assignments List */}
            {!isLoading && !isError && filteredAssignments.length > 0 && (
                <div className="space-y-3">
                    {filteredAssignments.map((assignment) => {
                        const config = STATUS_CONFIG[assignment.status];
                        const timeText = getTimeText(assignment.due_date);
                        const isUrgent = assignment.status === 'pending' || assignment.status === 'overdue';
                        const difficultyStyle = DIFFICULTY_STYLES[(assignment.difficulty || '').toLowerCase()] ?? 'bg-gray-100 text-gray-700';

                        return (
                            <Link
                                key={assignment.id}
                                href={`/student/assignments/${assignment.id}`}
                                className="block"
                            >
                                <Card className="hover:shadow-md hover:border-primary/20 transition-all group">
                                    <CardContent className="p-4 md:p-5">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                            {/* Icon */}
                                            <div
                                                className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${assignment.status === 'graded' ? 'bg-green-50' :
                                                        assignment.status === 'submitted' ? 'bg-blue-50' :
                                                            assignment.status === 'overdue' ? 'bg-red-50' : 'bg-amber-50'
                                                    }`}
                                            >
                                                <config.icon
                                                    className={`w-6 h-6 ${assignment.status === 'graded' ? 'text-green-600' :
                                                            assignment.status === 'submitted' ? 'text-blue-600' :
                                                                assignment.status === 'overdue' ? 'text-red-600' : 'text-amber-600'
                                                        }`}
                                                />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">
                                                        {assignment.title}
                                                    </h3>
                                                    <Badge variant={config.variant}>{config.label}</Badge>
                                                    {assignment.difficulty && (
                                                        <Badge variant="outline" className={difficultyStyle}>
                                                            {assignment.difficulty}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-500 line-clamp-1 mb-2">
                                                    {assignment.description || 'No description'}
                                                </p>
                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <BookOpen className="w-3.5 h-3.5" />
                                                        {assignment.course?.code ?? '—'} · {assignment.course?.name ?? 'Unknown'}
                                                    </span>
                                                    <span className={`flex items-center gap-1 ${assignment.status === 'overdue' ? 'text-red-600 font-medium' : ''}`}>
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        Due {format(new Date(assignment.due_date), 'MMM d, yyyy')}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Score / Time + Action */}
                                            <div className="flex items-center gap-4 flex-shrink-0">
                                                {assignment.status === 'graded' && assignment.submission?.final_score != null ? (
                                                    <div className="text-right">
                                                        <p className="text-xl font-bold text-primary">
                                                            {Math.round(assignment.submission.final_score)}/{assignment.max_score}
                                                        </p>
                                                        <p className="text-xs text-gray-500">Score</p>
                                                    </div>
                                                ) : (
                                                    <div className="text-right">
                                                        <p className={`text-sm font-medium ${assignment.status === 'overdue' ? 'text-red-600' : 'text-gray-600'}`}>
                                                            {timeText}
                                                        </p>
                                                    </div>
                                                )}

                                                <Button
                                                    size="sm"
                                                    variant={isUrgent ? 'default' : 'outline'}
                                                    className={`gap-1.5 ${isUrgent ? 'bg-primary hover:bg-primary-700' : 'border-primary/30 hover:border-primary hover:bg-primary/5'}`}
                                                >
                                                    {isUrgent ? (
                                                        <>
                                                            <Play className="w-3.5 h-3.5" />
                                                            Start
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Eye className="w-3.5 h-3.5" />
                                                            View
                                                        </>
                                                    )}
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
