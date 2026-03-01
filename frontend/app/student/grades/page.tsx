'use client';

/**
 * Student Grades Page
 *
 * Shows all assignments by course.
 * - Course average (graded only)
 * - Every assignment: graded → score/max, not graded → -/max
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import {
    Award,
    Search,
    BookOpen,
    FileCode,
    ChevronRight,
    AlertCircle,
} from 'lucide-react';

interface Submission {
    id: number;
    assignment_id: number;
    status: string;
    final_score?: number | null;
    max_score: number;
    submitted_at?: string;
    graded_at?: string | null;
}

interface Assignment {
    id: number;
    title: string;
    course_id: number;
    max_score: number;
    due_date?: string;
    is_published?: boolean;
    course?: { id: number; code: string; name: string };
}

interface Course {
    id: number;
    code: string;
    name: string;
}

function getScoreColor(pct: number) {
    if (pct >= 90) return 'text-green-600';
    if (pct >= 80) return 'text-blue-600';
    if (pct >= 70) return 'text-amber-600';
    if (pct >= 60) return 'text-orange-600';
    return 'text-red-600';
}

function getScoreBgColor(pct: number) {
    if (pct >= 90) return 'bg-green-50';
    if (pct >= 80) return 'bg-blue-50';
    if (pct >= 70) return 'bg-amber-50';
    if (pct >= 60) return 'bg-orange-50';
    return 'bg-red-50';
}

export default function StudentGradesPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [courseFilter, setCourseFilter] = useState<string>('all');

    const { data: submissions = [], isLoading, isError, error, refetch } = useQuery({
        queryKey: ['student-submissions'],
        queryFn: () => apiClient.getSubmissions(),
        staleTime: 2 * 60 * 1000,
    });

    const { data: assignments = [] } = useQuery({
        queryKey: ['student-assignments'],
        queryFn: () => apiClient.getAssignments(),
    });

    const { data: courses = [] } = useQuery({
        queryKey: ['student-courses'],
        queryFn: () => apiClient.getCourses(),
    });

    const submissionByAssignment = useMemo(() => {
        const m = new Map<number, Submission>();
        (submissions as Submission[]).forEach((s) => {
            const existing = m.get(s.assignment_id);
            const sGraded = s.final_score != null;
            const eGraded = existing?.final_score != null;
            if (!existing) {
                m.set(s.assignment_id, s);
            } else if (sGraded && !eGraded) {
                m.set(s.assignment_id, s);
            } else if (sGraded && eGraded && s.graded_at && existing.graded_at && new Date(s.graded_at) > new Date(existing.graded_at)) {
                m.set(s.assignment_id, s);
            } else if (!sGraded && !eGraded && s.submitted_at && existing.submitted_at && new Date(s.submitted_at) > new Date(existing.submitted_at)) {
                m.set(s.assignment_id, s);
            }
        });
        return m;
    }, [submissions]);

    const assignmentsByCourse = useMemo(() => {
        const byCourse = new Map<number, Assignment[]>();
        (assignments as (Assignment & { is_published?: boolean })[]).forEach((a) => {
            if ((a as { is_published?: boolean }).is_published !== false) {
                const arr = byCourse.get(a.course_id) ?? [];
                arr.push(a);
                byCourse.set(a.course_id, arr);
            }
        });
        byCourse.forEach((arr) => arr.sort((a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime()));
        return byCourse;
    }, [assignments]);

    const courseStats = useMemo(() => {
        const result: { course: Course; avg: number; graded: number; total: number }[] = [];
        (courses as Course[]).forEach((c) => {
            const courseAssignments = assignmentsByCourse.get(c.id) ?? [];
            const scores: number[] = [];
            courseAssignments.forEach((a) => {
                const sub = submissionByAssignment.get(a.id);
                if (sub?.final_score != null) {
                    scores.push((sub.final_score / (sub.max_score || 100)) * 100);
                }
            });
            if (courseAssignments.length > 0) {
                result.push({
                    course: c,
                    avg: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
                    graded: scores.length,
                    total: courseAssignments.length,
                });
            }
        });
        return result;
    }, [courses, assignmentsByCourse, submissionByAssignment]);

    const overallAvg = useMemo(() => {
        const graded = (submissions as Submission[]).filter((s) => s.final_score != null);
        if (graded.length === 0) return null;
        const sum = graded.reduce(
            (acc, s) => acc + (s.final_score! / (s.max_score || 100)) * 100,
            0
        );
        return Math.round(sum / graded.length);
    }, [submissions]);

    const filteredCourses = useMemo(() => {
        let list = courseStats;
        const q = searchQuery.toLowerCase().trim();
        if (courseFilter !== 'all') {
            list = list.filter((s) => s.course.id.toString() === courseFilter);
        }
        if (q) {
            list = list.filter(
                (s) =>
                    s.course.name.toLowerCase().includes(q) ||
                    s.course.code.toLowerCase().includes(q)
            );
        }
        return list;
    }, [courseStats, searchQuery, courseFilter]);

    const allAssignmentsCount = (assignments as Assignment[]).filter(
        (a) => (a as { is_published?: boolean }).is_published !== false
    ).length;

    return (
        <div className="space-y-6 pb-8">
            <InnerHeaderDesign
                title="My Grades"
                subtitle="All assignments by course"
            />

            {isError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="font-semibold text-sm text-red-800">Failed to load grades</p>
                        <p className="text-sm text-red-700 mt-0.5">{(error as Error)?.message || 'An error occurred.'}</p>
                    </div>
                    <button
                        onClick={() => refetch()}
                        className="px-3 py-1.5 text-sm border border-red-300 rounded-lg text-red-700 hover:bg-red-100"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {isLoading && (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-6">
                                <div className="h-6 bg-gray-200 rounded w-1/4 mb-4" />
                                <div className="space-y-2">
                                    {[1, 2, 3].map((j) => (
                                        <div key={j} className="h-12 bg-gray-100 rounded" />
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {!isLoading && !isError && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {overallAvg != null && (
                            <Card className="border-primary/20 shadow-sm hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                                            <Award className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold text-primary">{overallAvg}%</p>
                                            <p className="text-sm text-gray-500">Overall average</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                        {courseStats.slice(0, 3).map(({ course, avg, graded, total }) => (
                            <Card key={course.id} className="border-gray-100 hover:border-primary/20 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${avg > 0 ? getScoreBgColor(avg) : 'bg-gray-50'}`}>
                                            <BookOpen className={`w-6 h-6 ${avg > 0 ? getScoreColor(avg) : 'text-gray-400'}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 truncate">{course.name}</p>
                                            <p className="text-sm text-gray-500">{course.code} · {graded}/{total} graded</p>
                                        </div>
                                    </div>
                                    {total > 0 && (
                                        <Progress
                                            value={avg}
                                            size="sm"
                                            variant={avg >= 80 ? 'success' : avg >= 60 ? 'warning' : 'danger'}
                                            className="mt-3"
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card className="border-gray-100 shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        placeholder="Search by course..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 border-gray-200 focus:border-primary focus:ring-primary/20"
                                    />
                                </div>
                                <select
                                    value={courseFilter}
                                    onChange={(e) => setCourseFilter(e.target.value)}
                                    className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                                >
                                    <option value="all">All courses</option>
                                    {(courses as Course[]).map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {allAssignmentsCount === 0 ? (
                                <div className="py-16 text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                                        <FileCode className="w-8 h-8 text-primary" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No assignments yet</h3>
                                    <p className="text-gray-500 mb-6">You have no assignments in your courses.</p>
                                    <Link href="/student/courses">
                                        <Button className="bg-primary hover:bg-primary-700 text-white">
                                            View Courses
                                        </Button>
                                    </Link>
                                </div>
                            ) : filteredCourses.length === 0 ? (
                                <div className="py-16 text-center">
                                    <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gray-100 flex items-center justify-center">
                                        <Search className="w-7 h-7 text-gray-400" />
                                    </div>
                                    <p className="text-gray-500">No courses match your search</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {filteredCourses.map(({ course, avg, graded, total }) => {
                                        const courseAssignments = (assignmentsByCourse.get(course.id) ?? [])
                                            .filter((a) => {
                                                const q = searchQuery.toLowerCase().trim();
                                                if (!q) return true;
                                                return a.title.toLowerCase().includes(q) ||
                                                    (a.course?.name ?? '').toLowerCase().includes(q) ||
                                                    (a.course?.code ?? '').toLowerCase().includes(q);
                                            });

                                        if (courseAssignments.length === 0) return null;

                                        return (
                                            <div key={course.id} className="rounded-xl border border-gray-100 overflow-hidden">
                                                <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border-l-4 border-l-primary">
                                                    <h3 className="font-semibold text-gray-900">{course.name}</h3>
                                                    <span className="text-sm text-primary font-medium">{course.code}</span>
                                                    <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                                                        {graded}/{total} graded
                                                    </Badge>
                                                    {graded > 0 && (
                                                        <span className="text-sm font-medium text-gray-600">
                                                            Avg: {Math.round(avg)}%
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="divide-y divide-gray-50">
                                                    {courseAssignments.map((assignment) => {
                                                        const sub = submissionByAssignment.get(assignment.id);
                                                        const isGraded = sub?.final_score != null;
                                                        const maxScore = sub?.max_score ?? assignment.max_score ?? 100;
                                                        const pct = isGraded
                                                            ? Math.round((sub!.final_score! / maxScore) * 100)
                                                            : 0;

                                                        return (
                                                            <Link
                                                                key={assignment.id}
                                                                href={`/student/assignments/${assignment.id}`}
                                                                className="flex items-center gap-4 px-4 py-3.5 hover:bg-primary/5 transition-colors group"
                                                            >
                                                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isGraded ? getScoreBgColor(pct) : 'bg-gray-50'}`}>
                                                                    {isGraded ? (
                                                                        <span className={`text-sm font-bold ${getScoreColor(pct)}`}>
                                                                            {pct}%
                                                                        </span>
                                                                    ) : (
                                                                        <FileCode className="w-5 h-5 text-gray-400" />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
                                                                        {assignment.title}
                                                                    </p>
                                                                    {sub?.graded_at && (
                                                                        <p className="text-xs text-gray-500">
                                                                            Graded {format(new Date(sub.graded_at), 'MMM d')}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                                    {isGraded ? (
                                                                        <Badge variant={pct >= 80 ? 'success' : pct >= 60 ? 'warning' : 'danger'}>
                                                                            {sub!.final_score}/{maxScore}
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-gray-500 border-gray-200">
                                                                            -/{maxScore}
                                                                        </Badge>
                                                                    )}
                                                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors" />
                                                                </div>
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
