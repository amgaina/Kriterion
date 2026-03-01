'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Clock, CheckCircle, ChevronRight, FileCode, Loader2 } from 'lucide-react';

interface Course {
    id: number;
    code: string;
    name: string;
    description?: string;
    students_count: number;
    assignments_count: number;
}

export default function AssistantDashboardPage() {
    const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
        queryKey: ['assistant-courses'],
        queryFn: () => apiClient.getCourses(),
    });

    const { data: gradingStats, isLoading: statsLoading } = useQuery({
        queryKey: ['assistant-grading-stats'],
        queryFn: () => apiClient.getGradingStats(),
    });

    const coursesAssigned = courses.length;
    const pendingCount = gradingStats?.total_pending ?? 0;
    const gradedCount = gradingStats?.total_graded ?? 0;

    const isLoading = coursesLoading || statsLoading;

    return (
        <div className="flex flex-col gap-5 h-full min-h-0">
            {/* Welcome header - matches main theme */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#862733] to-[#a03040] px-5 py-4 text-white">
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
                <div className="relative">
                    <h1 className="text-lg font-bold leading-tight">
                        Grading Assistant Dashboard
                    </h1>
                    <p className="text-xs text-white/80 mt-0.5">
                        {isLoading
                            ? 'Loading...'
                            : pendingCount > 0
                                ? `${pendingCount} submission${pendingCount !== 1 ? 's' : ''} pending to grade`
                                : 'All caught up! No pending submissions'}
                    </p>
                </div>
            </div>

            {/* Stats cards - Courses Assigned, Pending to Grade, Graded */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border border-gray-200 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-[#862733]/10 flex items-center justify-center">
                                <BookOpen className="w-6 h-6 text-[#862733]" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">
                                    {isLoading ? (
                                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                    ) : (
                                        coursesAssigned
                                    )}
                                </p>
                                <p className="text-sm text-gray-500">Courses Assigned</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-gray-200 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                                <Clock className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">
                                    {isLoading ? (
                                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                    ) : (
                                        pendingCount
                                    )}
                                </p>
                                <p className="text-sm text-gray-500">Pending to Grade</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-gray-200 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">
                                    {isLoading ? (
                                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                    ) : (
                                        gradedCount
                                    )}
                                </p>
                                <p className="text-sm text-gray-500">Graded</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* My Assigned Courses */}
            <Card className="border border-gray-200 shadow-sm flex-1 min-h-0 flex flex-col">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <BookOpen className="w-5 h-5 text-[#862733]" />
                        My Assigned Courses
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                        Select a course to grade submissions. Grading assistants can only grade assignments.
                    </p>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto">
                    {coursesLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-[#862733]" />
                        </div>
                    ) : courses.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                            <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-600 font-medium">No courses assigned yet</p>
                            <p className="text-sm text-gray-500 mt-1">
                                Contact your professor to be added as a grading assistant for a course.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {courses.map((course) => (
                                <Link
                                    key={course.id}
                                    href={`/assistant/courses/${course.id}`}
                                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-[#862733]/30 hover:bg-[#862733]/5 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-[#862733]/10 flex items-center justify-center group-hover:bg-[#862733]/20 transition-colors">
                                            <FileCode className="w-5 h-5 text-[#862733]" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900 group-hover:text-[#862733] transition-colors">
                                                {course.name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge variant="outline" className="text-xs font-normal">
                                                    {course.code}
                                                </Badge>
                                                <span className="text-sm text-gray-500">
                                                    {course.students_count} students · {course.assignments_count} assignments
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-[#862733] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                            Grade
                                        </span>
                                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#862733] transition-colors" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
