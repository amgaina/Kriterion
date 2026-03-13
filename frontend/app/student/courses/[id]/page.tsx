'use client';

/**
 * Student Course Detail Page
 *
 * Three tabs:
 * 1. Overview - Course info, total grade, pending assignments
 * 2. Assignments - All assignments list
 * 3. Grading - Score per assignment (graded → score/max, ungraded → -/max)
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { format, isPast } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabPanel } from '@/components/ui/tabs';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import { ScoreBadge } from '@/components/ui/ScoreBadge';
import { getScoreBgColor, getScoreTextColor } from '@/lib/score-utils';
import {
    ArrowLeft,
    BookOpen,
    User,
    Mail,
    FileCode,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    Award,
    LayoutGrid,
    ClipboardList,
} from 'lucide-react';

interface Course {
    id: number;
    name: string;
    code: string;
    description?: string | null;
    semester: string;
    year: number;
    instructor_id: number;
    instructor_name?: string | null;
    instructor_email?: string | null;
}

interface Assignment {
    id: number;
    title: string;
    course_id: number;
    max_score: number;
    due_date?: string;
    is_published?: boolean;
}

interface Submission {
    id: number;
    assignment_id: number;
    final_score?: number | null;
    max_score?: number;
    graded_at?: string | null;
}

export default function StudentCourseDetailPage() {
    const params = useParams();
    const courseId = Number(params.id);
    const [activeTab, setActiveTab] = useState('overview');

    const { data: course, isLoading: courseLoading, isError: courseError, error: courseErr, refetch: refetchCourse } = useQuery({
        queryKey: ['course', courseId],
        queryFn: () => apiClient.getCourse(courseId),
        enabled: !!courseId,
    });

    const { data: assignments = [] } = useQuery({
        queryKey: ['student-assignments', courseId],
        queryFn: () => apiClient.getAssignments(courseId),
        enabled: !!courseId,
    });

    const { data: submissions = [] } = useQuery({
        queryKey: ['student-submissions'],
        queryFn: () => apiClient.getSubmissions(),
        staleTime: 2 * 60 * 1000,
    });

    const courseAssignments = (assignments as (Assignment & { is_published?: boolean })[])
        .filter((a) => (a as { is_published?: boolean }).is_published !== false)
        .sort((a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime());

    const submissionByAssignment = new Map<number, Submission>();
    (submissions as Submission[]).forEach((s) => {
        const existing = submissionByAssignment.get(s.assignment_id);
        const sGraded = s.final_score != null;
        const eGraded = existing?.final_score != null;
        if (!existing) {
            submissionByAssignment.set(s.assignment_id, s);
        } else if (sGraded && !eGraded) {
            submissionByAssignment.set(s.assignment_id, s);
        } else if (sGraded && eGraded && s.graded_at && existing.graded_at && new Date(s.graded_at) > new Date(existing.graded_at)) {
            submissionByAssignment.set(s.assignment_id, s);
        } else if (!sGraded && !eGraded && (s as { submitted_at?: string }).submitted_at && (existing as { submitted_at?: string }).submitted_at &&
            new Date((s as { submitted_at?: string }).submitted_at!) > new Date((existing as { submitted_at?: string }).submitted_at!)) {
            submissionByAssignment.set(s.assignment_id, s);
        }
    });

    const gradedScores: number[] = [];
    courseAssignments.forEach((a) => {
        const sub = submissionByAssignment.get(a.id);
        if (sub?.final_score != null) {
            const max = sub.max_score ?? a.max_score ?? 100;
            gradedScores.push((sub.final_score / max) * 100);
        }
    });
    const totalGrade = gradedScores.length > 0
        ? Math.round(gradedScores.reduce((a, b) => a + b, 0) / gradedScores.length)
        : null;

    const pendingAssignments = courseAssignments.filter((a) => {
        const sub = submissionByAssignment.get(a.id);
        return sub?.final_score == null;
    });

    if (courseError || !courseId) {
        return (
            <div className="space-y-6 pb-8 px-1 sm:px-0">
                <Link href="/student/courses">
                    <Button variant="outline" size="sm" className="gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Courses
                    </Button>
                </Link>
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="py-12 text-center px-4 sm:px-6">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <p className="font-semibold text-gray-900">Failed to load course</p>
                        <p className="text-sm text-gray-600 mt-1">
                            {(courseErr as Error)?.message || 'Course not found.'}
                        </p>
                        <Button variant="outline" onClick={() => refetchCourse()} className="mt-4">
                            Try Again
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (courseLoading || !course) {
        return (
            <div className="space-y-6 pb-8 px-1 sm:px-0">
                <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
                <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-6">
                                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
                                <div className="h-4 bg-gray-100 rounded w-full" />
                                <div className="h-4 bg-gray-100 rounded w-2/3 mt-2" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    const c = course as Course;

    const tabs = [
        { id: 'overview', label: 'Overview', icon: <LayoutGrid className="w-4 h-4" /> },
        { id: 'assignments', label: 'Assignments', icon: <ClipboardList className="w-4 h-4" />, count: courseAssignments.length },
        { id: 'grading', label: 'Grading', icon: <Award className="w-4 h-4" />, count: gradedScores.length },
    ];

    return (
        <div className="space-y-6 pb-8 px-1 sm:px-0">
            <Link href="/student/courses">
                <Button variant="outline" size="sm" className="gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Courses
                </Button>
            </Link>

            <InnerHeaderDesign
                title={c.name}
                subtitle={`${c.code} · ${c.semester} ${c.year}`}
            />

            <Card className="border-gray-100 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <div className="px-4 sm:px-5 pt-4">
                        <Tabs
                            tabs={tabs}
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                            className="border-0"
                        />
                    </div>

                    {/* Tab 1: Overview */}
                    {activeTab === 'overview' && (
                        <TabPanel className="px-4 sm:px-5 pb-6 pt-2">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                                {/* Course Info */}
                                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                                    <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 sm:p-5">
                                        <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                            <BookOpen className="w-5 h-5 text-primary" />
                                            Course Information
                                        </h3>
                                        <div className="space-y-3 sm:space-y-4">
                                            <div>
                                                <p className="text-xs sm:text-sm font-medium text-gray-500">Title</p>
                                                <p className="text-gray-900">{c.name}</p>
                                            </div>
                                            {c.description && (
                                                <div>
                                                    <p className="text-xs sm:text-sm font-medium text-gray-500">Description</p>
                                                    <p className="text-gray-700 text-sm sm:text-base">{c.description}</p>
                                                </div>
                                            )}
                                            {(c.instructor_name || c.instructor_email) && (
                                                <div>
                                                    <p className="text-xs sm:text-sm font-medium text-gray-500 mb-2">Instructor</p>
                                                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-4">
                                                        {c.instructor_name && (
                                                            <span className="flex items-center gap-2 text-gray-900">
                                                                <User className="w-4 h-4 text-primary flex-shrink-0" />
                                                                {c.instructor_name}
                                                            </span>
                                                        )}
                                                        {c.instructor_email && (
                                                            <a
                                                                href={`mailto:${c.instructor_email}`}
                                                                className="flex items-center gap-2 text-primary hover:underline text-sm sm:text-base"
                                                            >
                                                                <Mail className="w-4 h-4 flex-shrink-0" />
                                                                {c.instructor_email}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Total Grade */}
                                <div>
                                    <div className="rounded-xl border border-gray-100 p-4 sm:p-5 h-full">
                                        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <Award className="w-5 h-5 text-primary" />
                                            Total Grade
                                        </h3>
                                        <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center gap-4">
                                            <div
                                                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${totalGrade != null ? getScoreBgColor(totalGrade) : 'bg-gray-50'
                                                    }`}
                                            >
                                                <span
                                                    className={`text-xl sm:text-2xl font-bold ${totalGrade != null ? getScoreTextColor(totalGrade) : 'text-gray-400'
                                                        }`}
                                                >
                                                    {totalGrade != null ? `${totalGrade}%` : '-'}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Average of graded</p>
                                                <p className="text-sm text-gray-600 mt-0.5">
                                                    {gradedScores.length} of {courseAssignments.length} graded
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Pending Assignments */}
                            {pendingAssignments.length > 0 && (
                                <div className="mt-4 sm:mt-6">
                                    <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5 text-amber-600" />
                                        Pending ({pendingAssignments.length})
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                        {pendingAssignments.map((a) => {
                                            const isOverdue = a.due_date && isPast(new Date(a.due_date));
                                            return (
                                                <Link
                                                    key={a.id}
                                                    href={`/student/assignments/${a.id}`}
                                                    className="flex items-center gap-3 p-3 sm:p-4 rounded-lg border border-gray-100 hover:border-primary/20 hover:bg-primary/5 transition-colors group"
                                                >
                                                    <FileCode className="w-5 h-5 text-gray-400 flex-shrink-0 group-hover:text-primary" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-gray-900 truncate text-sm sm:text-base">{a.title}</p>
                                                        <p className={`text-xs sm:text-sm ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                                                            Due {a.due_date ? format(new Date(a.due_date), 'MMM d') : '-'}
                                                            {isOverdue && ' · Overdue'}
                                                        </p>
                                                    </div>
                                                    <Button size="sm" className="bg-primary hover:bg-primary-700 text-white flex-shrink-0">
                                                        {isOverdue ? 'Complete' : 'Start'}
                                                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                                                    </Button>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {pendingAssignments.length === 0 && courseAssignments.length > 0 && (
                                <div className="mt-6 flex items-center gap-2 p-4 rounded-lg bg-green-50 border border-green-100">
                                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                                    <p className="text-sm text-green-800">All assignments completed or graded.</p>
                                </div>
                            )}
                        </TabPanel>
                    )}

                    {/* Tab 2: Assignments */}
                    {activeTab === 'assignments' && (
                        <TabPanel className="px-4 sm:px-5 pb-6 pt-2">
                            {courseAssignments.length === 0 ? (
                                <div className="py-12 sm:py-16 text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                                        <FileCode className="w-8 h-8 text-primary" />
                                    </div>
                                    <p className="text-gray-500">No assignments in this course yet.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {courseAssignments.map((a) => {
                                        const sub = submissionByAssignment.get(a.id);
                                        const isGraded = sub?.final_score != null;
                                        const maxScore = sub?.max_score ?? a.max_score ?? 100;
                                        const isOverdue = a.due_date && isPast(new Date(a.due_date)) && !isGraded;
                                        return (
                                            <Link
                                                key={a.id}
                                                href={`/student/assignments/${a.id}`}
                                                className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4 sm:py-3.5 hover:bg-primary/5 -mx-2 px-2 sm:mx-0 sm:px-0 rounded-lg transition-colors group"
                                            >
                                                <div
                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isGraded ? getScoreBgColor((sub!.final_score! / maxScore) * 100) :
                                                            isOverdue ? 'bg-red-50' : 'bg-gray-50'
                                                        }`}
                                                >
                                                    {isGraded ? (
                                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                    ) : isOverdue ? (
                                                        <AlertCircle className="w-5 h-5 text-red-600" />
                                                    ) : (
                                                        <FileCode className="w-5 h-5 text-gray-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
                                                        {a.title}
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                                        Due {a.due_date ? format(new Date(a.due_date), 'MMM d, yyyy') : '-'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {isGraded ? (
                                                        <ScoreBadge percent={(sub!.final_score! / maxScore) * 100} successThreshold={70} warningThreshold={60}>
                                                            {Math.round(sub!.final_score!)}/{maxScore}
                                                        </ScoreBadge>
                                                    ) : (
                                                        <span className="text-sm text-gray-400">-/{maxScore}</span>
                                                    )}
                                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary" />
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </TabPanel>
                    )}

                    {/* Tab 3: Grading */}
                    {activeTab === 'grading' && (
                        <TabPanel className="px-4 sm:px-5 pb-6 pt-2">
                            <p className="text-sm text-gray-500 mb-4">
                                Your score for each assignment in this course.
                            </p>
                            {courseAssignments.length === 0 ? (
                                <div className="py-12 sm:py-16 text-center">
                                    <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">No assignments to display.</p>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-gray-100 overflow-hidden">
                                    <div className="divide-y divide-gray-50">
                                        {courseAssignments.map((a) => {
                                            const sub = submissionByAssignment.get(a.id);
                                            const isGraded = sub?.final_score != null;
                                            const maxScore = sub?.max_score ?? a.max_score ?? 100;
                                            const pct = isGraded ? Math.round((sub!.final_score! / maxScore) * 100) : 0;
                                            return (
                                                <Link
                                                    key={a.id}
                                                    href={`/student/assignments/${a.id}`}
                                                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-3.5 hover:bg-primary/5 transition-colors group"
                                                >
                                                    <div
                                                        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isGraded ? getScoreBgColor(pct) : 'bg-gray-50'
                                                            }`}
                                                    >
                                                        {isGraded ? (
                                                            <span className={`text-sm font-bold ${getScoreTextColor(pct)}`}>
                                                                {pct}%
                                                            </span>
                                                        ) : (
                                                            <FileCode className="w-5 h-5 text-gray-400" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
                                                            {a.title}
                                                        </p>
                                                        {sub?.graded_at && (
                                                            <p className="text-xs text-gray-500">
                                                                Graded {format(new Date(sub.graded_at!), 'MMM d')}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {isGraded ? (
                                                            <ScoreBadge percent={pct}>
                                                                {Math.round(sub!.final_score!)}/{maxScore}
                                                            </ScoreBadge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-gray-500 border-gray-200">
                                                                -/{maxScore}
                                                            </Badge>
                                                        )}
                                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary" />
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </TabPanel>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
