'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { DashboardStatTile } from '@/components/ui/DashboardStatTile';
import { BookOpen, Clock, CheckCircle, ArrowRight, Loader2, Users, FileText } from 'lucide-react';

interface Course {
    id: number;
    code: string;
    name: string;
    description?: string;
    students_count: number;
    assignments_count: number;
}

export default function AssistantDashboardPage() {
    const { user } = useAuth();

    const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
        queryKey: ['assistant-courses'],
        queryFn: () => apiClient.getCourses(),
    });

    const { data: gradingStats, isLoading: statsLoading } = useQuery({
        queryKey: ['assistant-grading-stats'],
        queryFn: () => apiClient.getGradingStats(),
        refetchInterval: 15_000,
    });

    const firstName = user?.full_name?.split(' ')[0] || 'Assistant';
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    }, []);

    const isLoading = coursesLoading || statsLoading;
    const pendingCount = gradingStats?.total_pending ?? 0;
    const gradedCount = gradingStats?.total_graded ?? 0;

    return (
        <div className="flex flex-col gap-4 h-full min-h-0">
            {/* Welcome banner */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#862733] to-[#a03040] px-5 py-4 text-white">
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
                <div className="relative flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold leading-tight">{greeting}, {firstName}</h1>
                        <p className="text-xs text-white/70 mt-0.5">
                            {isLoading
                                ? 'Loading...'
                                : pendingCount > 0
                                    ? `${pendingCount} submission${pendingCount !== 1 ? 's' : ''} pending to grade`
                                    : 'All caught up — no pending submissions'}
                        </p>
                    </div>
                    {!isLoading && pendingCount > 0 && (
                        <Link
                            href="/assistant/grading"
                            className="hidden sm:flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            View pending <ArrowRight className="w-3 h-3" />
                        </Link>
                    )}
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2.5">
                <DashboardStatTile
                    label="Courses"
                    value={courses.length}
                    icon={BookOpen}
                    loading={isLoading}
                    color="text-[#862733]"
                    bg="bg-[#862733]/10"
                    sub="assigned"
                />
                <DashboardStatTile
                    label="Pending"
                    value={pendingCount}
                    icon={Clock}
                    loading={isLoading}
                    color="text-amber-600"
                    bg="bg-amber-50"
                    highlight={pendingCount > 0}
                    sub="to grade"
                />
                <DashboardStatTile
                    label="Graded"
                    value={gradedCount}
                    icon={CheckCircle}
                    loading={isLoading}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                    sub="submissions"
                />
            </div>

            {/* My Assigned Courses */}
            <div className="rounded-xl border border-gray-100 bg-white overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#862733]" />
                        My Assigned Courses
                    </h2>
                    <Link href="/assistant/courses" className="text-[11px] text-primary hover:underline flex items-center gap-0.5">
                        View all <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {coursesLoading ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                        </div>
                    ) : courses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-xs text-center px-4">
                            <BookOpen className="w-8 h-8 mb-2 text-gray-200" />
                            <p className="font-medium">No courses assigned yet</p>
                            <p className="mt-1">Contact your professor to be added as a grading assistant.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {courses.map((course) => (
                                <Link
                                    key={course.id}
                                    href={`/assistant/courses/${course.id}`}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors group"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-[#862733]/10 text-[#862733] flex items-center justify-center text-xs font-bold flex-shrink-0">
                                        {course.code.slice(0, 2)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#862733] transition-colors">
                                            {course.name}
                                        </p>
                                        <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                                            {course.code}
                                            <span className="inline-flex items-center gap-0.5">
                                                <Users className="w-2.5 h-2.5" />{course.students_count}
                                            </span>
                                            <span className="inline-flex items-center gap-0.5">
                                                <FileText className="w-2.5 h-2.5" />{course.assignments_count}
                                            </span>
                                        </p>
                                    </div>
                                    <ArrowRight className="w-3.5 h-3.5 text-gray-200 group-hover:text-[#862733] transition-colors flex-shrink-0" />
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
