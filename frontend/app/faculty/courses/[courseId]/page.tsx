'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CourseLoadingPage } from '@/components/course/CourseLoading';
import {
    BookOpen,
    Users,
    FileText,
    Calendar,
    Clock,
    Plus,
    Loader2,
    AlertCircle,
    CheckCircle2,
    ChevronRight,
    ArrowLeft,
    BarChart3,
    Target,
} from 'lucide-react';

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
    difficulty?: string;
    due_date?: string;
    is_published: boolean;
    max_score: number;
}

const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Generate gradient from course color hex */
const courseColorStyle = (hex: string | null | undefined) => {
    if (!hex || !hex.startsWith('#')) return { background: 'linear-gradient(135deg, #862733 0%, #a03040 100%)' };
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const darker = `rgb(${Math.max(0, r - 25)}, ${Math.max(0, g - 15)}, ${Math.max(0, b - 15)})`;
    return { background: `linear-gradient(135deg, ${hex} 0%, ${darker} 100%)` };
};

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

    const activeStudents = students.filter((s: { status: string }) => s.status === 'active');
    const publishedCount = assignments.filter((a: Assignment) => a.is_published).length;
    const upcomingCount = assignments.filter((a: Assignment) => a.due_date && new Date(a.due_date) > new Date()).length;
    const overdueCount = assignments.filter((a: Assignment) => a.due_date && new Date(a.due_date) < new Date() && !a.is_published).length;
    const recentAssignments = assignments.slice(0, 5);

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

    const statusBadge =
        course.status === 'active'
            ? 'bg-emerald-100 text-emerald-800'
            : course.status === 'draft'
            ? 'bg-amber-100 text-amber-800'
            : 'bg-gray-100 text-gray-700';

    const accentColor = course.color || '#862733';

    return (
        <div className="space-y-6 pb-8">
            {/* Back */}
            <Link
                href="/faculty/courses"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" /> Back to Courses
            </Link>

            {/* ─── Course Header Banner (using course color) ─── */}
            <div
                className="rounded-2xl p-6 md:p-8 text-white relative overflow-hidden shadow-lg"
                style={courseColorStyle(course.color)}
            >
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white" />
                    <div className="absolute -right-5 -bottom-5 w-32 h-32 rounded-full bg-white" />
                </div>
                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                    <BookOpen className="w-7 h-7" />
                                </div>
                                <div>
                                    <p className="text-white/90 text-sm font-medium">
                                        {course.code}
                                        {course.section ? ` · Section ${course.section}` : ''}
                                    </p>
                                    <h1 className="text-2xl md:text-4xl font-bold tracking-tight">{course.name}</h1>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-4">
                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusBadge}`}>
                                    {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
                                </span>
                                <span className="text-white/80 text-sm flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4" /> {course.semester} {course.year}
                                </span>
                                <span className="text-white/80 text-sm flex items-center gap-1.5">
                                    <Clock className="w-4 h-4" /> Created {formatDate(course.created_at)}
                                </span>
                            </div>
                            {course.description && (
                                <p className="mt-4 text-white/85 text-sm max-w-2xl leading-relaxed">{course.description}</p>
                            )}
                        </div>
                        <Link href={`/faculty/courses/${courseId}/assignments/new`}>
                            <Button className="bg-white/20 hover:bg-white/30 text-white border border-white/30 gap-2 shadow-md">
                                <Plus className="w-4 h-4" /> New Assignment
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* ─── Stat Cards (responsive grid) ─── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-4 md:p-5">
                        <div className="flex items-center gap-3">
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: `${accentColor}20` }}
                            >
                                <Users className="w-6 h-6" style={{ color: accentColor }} />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{activeStudents.length}</p>
                                <p className="text-xs text-gray-500">Enrolled Students</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-4 md:p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-violet-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
                                <p className="text-xs text-gray-500">Total Assignments</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-4 md:p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{publishedCount}</p>
                                <p className="text-xs text-gray-500">Published</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-4 md:p-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                                <Target className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{upcomingCount}</p>
                                <p className="text-xs text-gray-500">Upcoming Due</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Quick Links & Recent Assignments ─── */}
            <div className="grid md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 border-0 shadow-md">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <BarChart3 className="w-5 h-5" style={{ color: accentColor }} />
                                Assignments
                            </CardTitle>
                            <Link href={`/faculty/courses/${courseId}/assignments`}>
                                <Button variant="ghost" size="sm" className="gap-1 text-gray-600 hover:text-gray-900">
                                    View All <ChevronRight className="w-4 h-4" />
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {assignmentsLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                            </div>
                        ) : recentAssignments.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 text-sm font-medium">No assignments yet</p>
                                <p className="text-gray-400 text-xs mt-1">Create your first assignment to get started</p>
                                <Link href={`/faculty/courses/${courseId}/assignments/new`} className="mt-4 inline-block">
                                    <Button size="sm" className="gap-2" style={{ backgroundColor: accentColor }}>
                                        <Plus className="w-4 h-4" /> Create Assignment
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {recentAssignments.map((a: Assignment) => (
                                    <Link
                                        key={a.id}
                                        href={`/faculty/courses/${courseId}/assignments/${a.id}`}
                                        className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50/80 hover:border-gray-200 transition-all group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div
                                                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                                    a.is_published ? 'bg-emerald-500' : 'bg-amber-400'
                                                }`}
                                            />
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-900 text-sm truncate group-hover:opacity-80">
                                                    {a.title}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                    <span>{a.is_published ? 'Published' : 'Draft'}</span>
                                                    {a.difficulty && (
                                                        <span className="capitalize text-gray-400">· {a.difficulty}</span>
                                                    )}
                                                    <span className="text-gray-400">{a.max_score} pts</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {a.due_date && (
                                                <span className="text-xs text-gray-500 hidden sm:inline">
                                                    Due {formatDate(a.due_date)}
                                                </span>
                                            )}
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick actions */}
                <Card className="border-0 shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Link href={`/faculty/courses/${courseId}/assignments/new`} className="block">
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50/80 hover:border-gray-200 transition-all">
                                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                                    <Plus className="w-5 h-5 text-violet-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">New Assignment</p>
                                    <p className="text-xs text-gray-500">Create a new assignment</p>
                                </div>
                            </div>
                        </Link>
                        <Link href={`/faculty/courses/${courseId}/students`} className="block">
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50/80 hover:border-gray-200 transition-all">
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: `${accentColor}20` }}
                                >
                                    <Users className="w-5 h-5" style={{ color: accentColor }} />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">Manage Students</p>
                                    <p className="text-xs text-gray-500">{activeStudents.length} enrolled</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
                            </div>
                        </Link>
                        <Link href={`/faculty/courses/${courseId}/assignments`} className="block">
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50/80 hover:border-gray-200 transition-all">
                                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900 text-sm">All Assignments</p>
                                    <p className="text-xs text-gray-500">{assignments.length} total</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
                            </div>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
