'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { getAssignmentStatusSummaries } from '@/lib/course-report-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CourseLoadingPage } from '@/components/course/CourseLoading';
import {
    Users,
    FileText,
    Calendar,
    Loader2,
    AlertCircle,
    ArrowLeft,
    ChevronRight,
    Plus,
    ClipboardCheck,
    AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Course {
    id: number;
    code: string;
    name: string;
    description?: string | null;
    semester: string;
    year: number;
    status: string;
    color?: string | null;
    is_active: boolean;
    created_at: string;
    students_count: number;
    assignments_count: number;
    section?: string | null;
}

interface Assignment {
    id: number;
    title: string;
    description?: string;
    due_date?: string;
    is_published: boolean;
    max_score: number;
}

const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });


export default function CourseOverviewPage() {
    const params = useParams();
    const router = useRouter();
    const courseId = Number(params?.courseId);

    const { data: course, isLoading: courseLoading, error: courseError } = useQuery({
        queryKey: ['course', courseId],
        queryFn: () => apiClient.getCourse(courseId) as Promise<Course>,
        enabled: !!courseId,
    });

    const { data: students = [], isLoading: studentsLoading } = useQuery({
        queryKey: ['course-students', courseId],
        queryFn: async () => {
            const data = await apiClient.getCourseStudents(courseId);
            return Array.isArray(data) ? data : [];
        },
        enabled: !!courseId,
    });

    const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
        queryKey: ['course-assignments', courseId],
        queryFn: () => apiClient.getCourseAssignments(courseId, true) as Promise<Assignment[]>,
        enabled: !!courseId,
    });

    const { data: courseReport } = useQuery({
        queryKey: ['course-report', courseId],
        queryFn: () => apiClient.getCourseReport(courseId),
        enabled: !!courseId,
    });

    const activeStudents = students.filter((s: { status: string }) => s.status === 'active');
    const publishedCount = assignments.filter((a: Assignment) => a.is_published).length;
    const statusSummaries = getAssignmentStatusSummaries(courseReport);
    const needsGradingTotal = statusSummaries.reduce((s, a) => s + a.ungradedCount, 0);

    const recentAssignments = assignments.slice().sort((a, b) => {
        const ad = a.due_date ? new Date(a.due_date).getTime() : 0;
        const bd = b.due_date ? new Date(b.due_date).getTime() : 0;
        return ad - bd;
    });
    const gradeValues = activeStudents
        .map((s: any) => s.current_grade as number | null | undefined)
        .filter((g): g is number => g != null);
    const averageGrade = gradeValues.length
        ? gradeValues.reduce((sum, g) => sum + g, 0) / gradeValues.length
        : null;

    if (courseLoading || !course) {
        return <CourseLoadingPage message="Loading course..." />;
    }

    if (courseError) {
        return (
            <div className="text-center py-16">
                <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load course</h2>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">{(courseError as Error)?.message || 'Course not found.'}</p>
                <Button onClick={() => router.push('/faculty/courses')} className="gap-2" variant="outline">
                    <ArrowLeft className="w-4 h-4" /> Back to Courses
                </Button>
            </div>
        );
    }

    const accentColor = course.color || '#862733';

    const totalAssignments = assignments.length;
    const statCards = [
        {
            label: 'Enrolled students',
            value: activeStudents.length,
            icon: Users,
            href: `/faculty/courses/${courseId}/students`,
        },
        {
            label: 'Total assignments',
            value: totalAssignments,
            icon: FileText,
            href: `/faculty/courses/${courseId}/assignments`,
        },
        {
            label: 'Class average',
            value: averageGrade != null ? `${averageGrade.toFixed(1)}%` : '—',
            icon: ClipboardCheck,
        },
        ...(needsGradingTotal > 0
            ? [
                  {
                      label: 'Needs grading',
                      value: needsGradingTotal,
                      icon: AlertTriangle,
                      href: `/faculty/courses/${courseId}/assignments?filter=needs-grading`,
                  },
              ]
            : []),
    ];

    return (
        <motion.div
            className="space-y-6 pb-8"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
        >
            {/* Stats row — equal-width cards, evenly distributed */}
            <motion.section className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }} variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}>
                {statCards.map((stat) => {
                    const Icon = stat.icon;
                    const card = (
                        <Card className="h-full border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
                            <CardContent className="p-4 flex items-center gap-3 h-full">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: `${accentColor}18` }}
                                >
                                    <Icon className="w-5 h-5" style={{ color: accentColor }} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                        {stat.label}
                                    </p>
                                    <p className="text-xl font-semibold text-gray-900 mt-0.5">{stat.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                    return (
                        <motion.div
                            key={stat.label}
                            className="min-w-0 h-full"
                            variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                        >
                            {stat.href ? <Link href={stat.href} className="block h-full">{card}</Link> : card}
                        </motion.div>
                    );
                })}
            </motion.section>

            {/* Course info (description + semester) when present */}
            {(course.description || (course.semester && course.year)) && (
                <motion.section variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
                    <Card className="border border-gray-200 shadow-sm">
                        <CardContent className="p-4">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                                {course.semester && course.year && (
                                    <span className="flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4" style={{ color: accentColor }} />
                                        {course.semester} {course.year}
                                    </span>
                                )}
                            </div>
                            {course.description && (
                                <p className="mt-3 text-gray-700 leading-relaxed">{course.description}</p>
                            )}
                        </CardContent>
                    </Card>
                </motion.section>
            )}

            {/* Assignments list + Quick links */}
            <section className="grid md:grid-cols-3 gap-6">
                <motion.div className="md:col-span-2" variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
                    <Card className="border border-gray-200 shadow-sm h-full flex flex-col">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between gap-3">
                                <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
                                    <FileText className="w-4 h-4" style={{ color: accentColor }} />
                                    Assignments
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Link href={`/faculty/courses/${courseId}/assignments/new`}>
                                        <Button size="sm" className="gap-1.5 h-8 rounded-full px-3.5" style={{ backgroundColor: accentColor }}>
                                            <Plus className="w-3.5 h-3.5" /> New
                                        </Button>
                                    </Link>
                                    <Link href={`/faculty/courses/${courseId}/assignments`}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="gap-1 text-gray-600 hover:text-gray-900 h-8 rounded-full px-3.5"
                                        >
                                            View all <ChevronRight className="w-3.5 h-3.5" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 min-h-0">
                            {assignmentsLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                </div>
                            ) : recentAssignments.length === 0 ? (
                                <div className="text-center py-10 border border-dashed border-gray-200 rounded-xl">
                                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm font-medium">No assignments yet</p>
                                    <p className="text-gray-400 text-xs mt-1">Create your first assignment to get started.</p>
                                    <Link href={`/faculty/courses/${courseId}/assignments/new`} className="mt-4 inline-block">
                                        <Button size="sm" className="gap-2" style={{ backgroundColor: accentColor }}>
                                            <Plus className="w-4 h-4" /> Create assignment
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl">
                                    {recentAssignments.map((a: Assignment) => {
                                        const summary = statusSummaries.find((s) => s.assignmentId === a.id);
                                        const hasNeedsGrading = (summary?.ungradedCount ?? 0) > 0;
                                        const hasMissing = (summary?.missingCount ?? 0) > 0;
                                        return (
                                            <Link
                                                key={a.id}
                                                href={`/faculty/courses/${courseId}/assignments/${a.id}`}
                                                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm text-gray-900 truncate">{a.title}</p>
                                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                                                        <span>{a.is_published ? 'Published' : 'Draft'}</span>
                                                        <span className="text-gray-400">{a.max_score} pts</span>
                                                        {a.due_date && (
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" /> Due {formatDate(a.due_date)}
                                                            </span>
                                                        )}
                                                        {hasNeedsGrading && (
                                                            <span className="text-amber-600 font-medium">
                                                                {summary!.ungradedCount} to grade
                                                            </span>
                                                        )}
                                                        {hasMissing && (
                                                            <span className="text-red-600 font-medium">
                                                                {summary!.missingCount} missing
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
                    <Card className="border border-gray-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold text-gray-900">Quick links</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Link href={`/faculty/courses/${courseId}/students`} className="block">
                                <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: `${accentColor}18` }}
                                    >
                                        <Users className="w-5 h-5" style={{ color: accentColor }} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm text-gray-900">Manage students</p>
                                        <p className="text-xs text-gray-500">{activeStudents.length} active</p>
                                    </div>
                                </div>
                            </Link>
                            <Link href={`/faculty/courses/${courseId}/assignments`} className="block">
                                <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: `${accentColor}18` }}
                                    >
                                        <FileText className="w-5 h-5" style={{ color: accentColor }} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm text-gray-900">All assignments</p>
                                        <p className="text-xs text-gray-500">
                                            {assignments.length} total · {publishedCount} published
                                        </p>
                                    </div>
                                </div>
                            </Link>
                        </CardContent>
                    </Card>
                </motion.div>
            </section>
        </motion.div>
    );
}
