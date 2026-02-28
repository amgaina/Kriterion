'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { format, isPast, isWithinInterval, addDays } from 'date-fns';
import Link from 'next/link';
import {
    BookOpen,
    FileCode,
    Award,
    Clock,
    ArrowRight,
    CalendarDays,
    Loader2,
} from 'lucide-react';

interface StudentCourse {
    id: number;
    code: string;
    name: string;
    semester?: string;
    year?: number;
    assignments_count?: number;
}

interface StudentAssignment {
    id: number;
    title: string;
    due_date: string;
    course?: { id: number; code: string; name: string };
    course_name?: string;
}

interface DashboardStats {
    enrolled_courses?: number;
    total_submissions?: number;
    pending_assignments?: number;
    average_score?: number;
}

export default function StudentDashboardPage() {
    const { user } = useAuth();
    const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
        queryKey: ['student-stats'],
        queryFn: () => apiClient.getDashboardStats(),
    });

    const { data: courses = [], isLoading: coursesLoading } = useQuery({
        queryKey: ['student-courses'],
        queryFn: () => apiClient.getCourses(),
    });

    const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
        queryKey: ['student-assignments'],
        queryFn: () => apiClient.getAssignments(),
    });

    const firstName = user?.full_name?.split(' ')[0] || 'Student';
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    }, []);

    // Published assignments with due dates for calendar and list
    const publishedAssignments = useMemo(() => {
        return (assignments as StudentAssignment[]).filter((a: any) => a.is_published !== false);
    }, [assignments]);

    const pendingCount = stats?.pending_assignments ?? 0;

    const getTimeRemaining = (dueDate: string) => {
        const due = new Date(dueDate);
        if (isPast(due)) return { text: 'Overdue', urgent: true };
        const isUrgent = isWithinInterval(due, { start: new Date(), end: addDays(new Date(), 1) });
        const text = format(due, 'MMM d');
        return { text, urgent: isUrgent };
    };

    return (
        <div className="flex flex-col gap-4 h-full min-h-0">
                    {/* Welcome banner — compact, same as faculty */}
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary to-primary-700 px-5 py-4 text-white">
                        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
                        <div className="relative flex items-center justify-between">
                            <div>
                                <h1 className="text-lg font-bold leading-tight">
                                    {greeting}, {firstName}
                                </h1>
                                <p className="text-xs text-white/70 mt-0.5">
                                    {statsLoading
                                        ? 'Loading...'
                                        : pendingCount > 0
                                        ? `${pendingCount} assignment${pendingCount > 1 ? 's' : ''} due soon`
                                        : 'No pending assignments'}
                                </p>
                            </div>
                            {!statsLoading && pendingCount > 0 && (
                                <Link
                                    href="/student/assignments"
                                    className="hidden sm:flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    View assignments <ArrowRight className="w-3 h-3" />
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Stats row — same layout as faculty */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <StatTile
                            label="Enrolled"
                            value={stats?.enrolled_courses ?? courses?.length ?? 0}
                            icon={BookOpen}
                            loading={statsLoading && coursesLoading}
                            color="text-blue-600"
                            bg="bg-blue-50"
                            sub="courses"
                        />
                        <StatTile
                            label="Assignments"
                            value={publishedAssignments.length}
                            icon={FileCode}
                            loading={assignmentsLoading}
                            color="text-emerald-600"
                            bg="bg-emerald-50"
                            sub="available"
                        />
                        <StatTile
                            label="Pending"
                            value={stats?.pending_assignments ?? 0}
                            icon={Clock}
                            loading={statsLoading}
                            color="text-amber-600"
                            bg="bg-amber-50"
                            highlight={!!stats?.pending_assignments && stats.pending_assignments > 0}
                            sub="to complete"
                        />
                        <StatTile
                            label="Avg Score"
                            value={stats?.average_score ?? 0}
                            icon={Award}
                            loading={statsLoading}
                            color="text-violet-600"
                            bg="bg-violet-50"
                            sub="%"
                        />
                    </div>

                    {/* Two-column: Courses + Upcoming Assignments (same layout as faculty) */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 flex-1 min-h-0 overflow-hidden">
                        {/* My Courses */}
                        <div className="lg:col-span-3 rounded-xl border border-gray-100 bg-white overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-primary" />
                                    My Courses
                                </h2>
                                <Link
                                    href="/student/courses"
                                    className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                                >
                                    View all <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {coursesLoading ? (
                                    <div className="flex justify-center items-center py-10">
                                        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                                    </div>
                                ) : !courses?.length ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-xs">
                                        <BookOpen className="w-8 h-8 mb-2 text-gray-200" />
                                        No enrolled courses
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {(courses as StudentCourse[]).map((course) => (
                                            <Link
                                                key={course.id}
                                                href={`/student/courses/${course.id}`}
                                                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors group"
                                            >
                                                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                    {course.code?.slice(0, 2) || '??'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
                                                        {course.name}
                                                    </p>
                                                    <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                                                        {course.code}
                                                        {course.semester && course.year && (
                                                            <span className="text-[10px] text-gray-400">
                                                                {course.semester} {course.year}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-4 flex-shrink-0">
                                                    {course.assignments_count !== undefined && (
                                                        <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
                                                            <FileCode className="w-3 h-3" />
                                                            {course.assignments_count}
                                                        </span>
                                                    )}
                                                    <ArrowRight className="w-3.5 h-3.5 text-gray-200 group-hover:text-primary transition-colors" />
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Upcoming Assignments — same structure as faculty's "Allowed Languages" panel */}
                        <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white overflow-hidden flex flex-col">
                            <div className="px-4 py-3 border-b border-gray-100">
                                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-primary" />
                                    Upcoming Assignments
                                </h2>
                                <p className="text-[11px] text-gray-400 mt-0.5">Due soon</p>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {assignmentsLoading ? (
                                    <div className="flex justify-center items-center py-10">
                                        <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                                    </div>
                                ) : publishedAssignments.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-xs">
                                        <FileCode className="w-8 h-8 mb-2 text-gray-200" />
                                        No upcoming assignments
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {publishedAssignments.slice(0, 8).map((assignment: StudentAssignment) => {
                                                const timeInfo = getTimeRemaining(assignment.due_date);
                                                const courseName =
                                                    assignment.course?.name || assignment.course_name || '';
                                                return (
                                                    <Link
                                                        key={assignment.id}
                                                        href={`/student/assignments/${assignment.id}`}
                                                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors group"
                                                    >
                                                        <div
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                                timeInfo.urgent ? 'bg-amber-50' : 'bg-gray-50'
                                                            }`}
                                                        >
                                                            <FileCode
                                                                className={`w-4 h-4 ${
                                                                    timeInfo.urgent ? 'text-amber-600' : 'text-gray-500'
                                                                }`}
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
                                                                {assignment.title}
                                                            </p>
                                                            <p className="text-[11px] text-gray-400 truncate">
                                                                {courseName}
                                                            </p>
                                                        </div>
                                                        <span
                                                            className={`text-[10px] font-medium flex-shrink-0 ${
                                                                timeInfo.urgent ? 'text-amber-600' : 'text-gray-500'
                                                            }`}
                                                        >
                                                            {timeInfo.text}
                                                        </span>
                                                        <ArrowRight className="w-3 h-3 text-gray-200 group-hover:text-primary transition-colors flex-shrink-0" />
                                                    </Link>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quick links row — same style as faculty */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
                        {[
                            { label: 'Courses', href: '/student/courses', icon: BookOpen, grad: 'from-blue-500 to-blue-600' },
                            { label: 'Assignments', href: '/student/assignments', icon: FileCode, grad: 'from-emerald-500 to-emerald-600' },
                            { label: 'Grades', href: '/student/grades', icon: Award, grad: 'from-amber-500 to-amber-600' },
                            { label: 'Progress', href: '/student/progress', icon: CalendarDays, grad: 'from-violet-500 to-violet-600' },
                        ].map((a) => (
                            <Link key={a.href} href={a.href}>
                                <div className="group flex items-center gap-2.5 rounded-lg border border-gray-100 bg-white px-3 py-2.5 hover:border-gray-200 hover:shadow-sm transition-all">
                                    <div
                                        className={`w-7 h-7 rounded-md bg-gradient-to-br ${a.grad} flex items-center justify-center flex-shrink-0`}
                                    >
                                        <a.icon className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <span className="text-xs font-medium text-gray-700 group-hover:text-primary transition-colors">
                                        {a.label}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-gray-200 group-hover:text-primary ml-auto flex-shrink-0 transition-colors" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
    );
}

function StatTile({
    label,
    value,
    icon: Icon,
    loading,
    color,
    bg,
    highlight,
    sub,
}: {
    label: string;
    value?: number;
    icon: React.ElementType;
    loading: boolean;
    color: string;
    bg: string;
    highlight?: boolean;
    sub?: string;
}) {
    return (
        <div
            className={`rounded-xl border px-3.5 py-3 ${
                highlight ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100 bg-white'
            }`}
        >
            <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
            </div>
            <p className={`text-xl font-bold ${highlight ? 'text-amber-700' : 'text-gray-900'}`}>
                {loading ? (
                    <span className="inline-block w-6 h-6 bg-gray-100 rounded animate-pulse" />
                ) : (
                    value ?? 0
                )}
            </p>
            {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
    );
}
