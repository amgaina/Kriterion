'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { DashboardQuickLinks } from '@/components/ui/DashboardQuickLinks';
import { DashboardStatTile } from '@/components/ui/DashboardStatTile';
import {
    BookOpen,
    Users,
    FileText,
    Clock,
    ArrowRight,
    Code2,
    CalendarDays,
    Loader2,
} from 'lucide-react';

interface DashboardStats {
    total_courses: number;
    total_students: number;
    total_assignments: number;
    pending_grading: number; // assignments not past due date
}

interface FacultyCourse {
    id: number;
    code: string;
    name: string;
    student_count: number;
    assignment_count: number;
    status: string;
    start_date?: string | null;
    end_date?: string | null;
}

interface ProgrammingLanguage {
    id: number;
    name: string;
    display_name: string;
    version: string;
    file_extension: string;
}

const langColors: Record<string, string> = {
    python: 'bg-sky-100 text-sky-700',
    java: 'bg-orange-100 text-orange-700',
    cpp: 'bg-blue-100 text-blue-700',
    'c++': 'bg-blue-100 text-blue-700',
    'c#': 'bg-violet-100 text-violet-700',
    javascript: 'bg-yellow-100 text-yellow-800',
    c: 'bg-gray-100 text-gray-700',
};

export default function FacultyDashboard() {
    const { user } = useAuth();

    const { data: stats, isLoading } = useQuery<DashboardStats>({
        queryKey: ['faculty-dashboard'],
        queryFn: () => apiClient.getFacultyDashboard(),
    });

    const { data: courses = [] } = useQuery<FacultyCourse[]>({
        queryKey: ['faculty-courses-dashboard'],
        queryFn: () => apiClient.getFacultyCourses(),
    });

    const { data: languages = [] } = useQuery<ProgrammingLanguage[]>({
        queryKey: ['faculty-languages'],
        queryFn: () => apiClient.getFacultyLanguages(),
    });

    const firstName = user?.full_name?.split(' ')[0] || 'Professor';
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    }, []);

    const activeCourses = courses.filter((c) => c.status === 'active');

    return (
        <div className="flex flex-col gap-4 h-full min-h-0">
            {/* Welcome banner - compact */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary to-primary-700 px-5 py-4 text-white">
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
                <div className="relative flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold leading-tight">
                            {greeting}, {firstName}
                        </h1>
                        <p className="text-xs text-white/70 mt-0.5">
                            {isLoading
                                ? 'Loading...'
                                : stats?.pending_grading
                                    ? `${stats.pending_grading} active assignment${stats.pending_grading > 1 ? 's' : ''} with upcoming deadlines`
                                    : 'No assignments with upcoming deadlines'}
                        </p>
                    </div>
                    {stats && !isLoading && stats.pending_grading > 0 && (
                        <Link
                            href="/faculty/assignments"
                            className="hidden sm:flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            View assignments <ArrowRight className="w-3 h-3" />
                        </Link>
                    )}
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <DashboardStatTile label="Active Courses" value={stats?.total_courses} icon={BookOpen} loading={isLoading} color="text-blue-600" bg="bg-blue-50" />
                <DashboardStatTile label="Students" value={stats?.total_students} icon={Users} loading={isLoading} color="text-violet-600" bg="bg-violet-50" sub="enrolled" />
                <DashboardStatTile label="Assignments" value={stats?.total_assignments} icon={FileText} loading={isLoading} color="text-emerald-600" bg="bg-emerald-50" sub="created" />
                <DashboardStatTile
                    label="Pending"
                    value={stats?.pending_grading}
                    icon={Clock}
                    loading={isLoading}
                    color="text-amber-600"
                    bg="bg-amber-50"
                    highlight={!!stats?.pending_grading && stats.pending_grading > 0}
                    sub="not past due"
                />
            </div>

            {/* Two-column: Courses + Languages */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 flex-1 min-h-0 overflow-hidden">
                {/* My Courses */}
                <div className="lg:col-span-3 rounded-xl border border-gray-100 bg-white overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-primary" />
                            My Courses
                        </h2>
                        <Link
                            href="/faculty/courses"
                            className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                        >
                            View all <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex justify-center items-center py-10">
                                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                            </div>
                        ) : activeCourses.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-xs">
                                <BookOpen className="w-8 h-8 mb-2 text-gray-200" />
                                No active courses
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {activeCourses.map((course) => (
                                    <Link
                                        key={course.id}
                                        href={`/faculty/courses/${course.id}`}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors group"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                                            {course.code.slice(0, 2)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
                                                {course.name}
                                            </p>
                                            <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                                                {course.code}
                                                {course.end_date && (
                                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
                                                        <CalendarDays className="w-2.5 h-2.5" />
                                                        Ends {format(parseISO(course.end_date), 'MMM d')}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4 flex-shrink-0">
                                            <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
                                                <Users className="w-3 h-3" />
                                                {course.student_count}
                                            </span>
                                            <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
                                                <FileText className="w-3 h-3" />
                                                {course.assignment_count}
                                            </span>
                                            <ArrowRight className="w-3.5 h-3.5 text-gray-200 group-hover:text-primary transition-colors" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Allowed Languages */}
                <div className="lg:col-span-2 rounded-xl border border-gray-100 bg-white overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <Code2 className="w-4 h-4 text-primary" />
                            Available Languages
                        </h2>
                        <p className="text-[11px] text-gray-400 mt-0.5">Granted by administrator</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {languages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-400 text-xs">
                                <Code2 className="w-8 h-8 mb-2 text-gray-200" />
                                No languages available
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {languages.map((lang) => {
                                    const colorClass = langColors[lang.name.toLowerCase()] || 'bg-gray-100 text-gray-700';
                                    return (
                                        <div
                                            key={lang.id}
                                            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 ${colorClass}`}
                                        >
                                            <span className="text-xs font-semibold">{lang.display_name}</span>
                                            <span className="text-[10px] opacity-60">{lang.version}</span>
                                            <span className="text-[10px] font-mono opacity-50">{lang.file_extension}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick links row */}
            <DashboardQuickLinks
                items={[
                    { label: 'Courses', href: '/faculty/courses', icon: BookOpen, grad: 'from-blue-500 to-blue-600' },
                    { label: 'Assignments', href: '/faculty/assignments', icon: FileText, grad: 'from-emerald-500 to-emerald-600' },
                    { label: 'Submissions', href: '/faculty/submissions', icon: Clock, grad: 'from-amber-500 to-amber-600' },
                    { label: 'Reports', href: '/faculty/reports', icon: Users, grad: 'from-violet-500 to-violet-600' },
                ].map((item) => ({
                    label: item.label,
                    href: item.href,
                    icon: item.icon,
                    gradientClass: item.grad,
                }))}
            />
        </div>
    );
}
