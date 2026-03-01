'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CourseCard, CourseCardGrid } from '@/components/course/CourseCard';
import { CourseLoadingSkeleton } from '@/components/course/CourseLoading';
import { InnerHeaderDesign } from '@/components/InnerHeaderDesign';
import { Search, BookOpen } from 'lucide-react';

interface Course {
    id: number;
    code: string;
    name: string;
    description?: string | null;
    students_count?: number;
    assignments_count?: number;
    student_count?: number;
    assignment_count?: number;
    semester?: string;
    year?: number;
    color?: string | null;
}

export default function AssistantCoursesPage() {
    const [searchQuery, setSearchQuery] = useState('');

    const {
        data: courses = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery<Course[]>({
        queryKey: ['assistant-courses'],
        queryFn: () => apiClient.getCourses(),
        staleTime: 5 * 60 * 1000,
    });

    const filteredCourses = useMemo(() => {
        if (!searchQuery.trim()) return courses;
        const q = searchQuery.toLowerCase();
        return courses.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                c.code.toLowerCase().includes(q) ||
                (c.description || '').toLowerCase().includes(q)
        );
    }, [courses, searchQuery]);

    return (
        <div className="space-y-6 pb-8">
            <InnerHeaderDesign
                title="My Courses"
                subtitle="Courses where you assist with grading. Select a course to grade submissions."
            />

            {isError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                    <div className="flex-1">
                        <p className="font-semibold text-sm text-red-800">Failed to load courses</p>
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

            <Card className="border-gray-100 shadow-sm">
                <CardContent className="p-5">
                    <div className="relative max-w-xl">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search courses by name, code, or description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 border-gray-200 focus:border-primary focus:ring-primary/20"
                        />
                    </div>
                    {searchQuery && courses.length > 0 && (
                        <p className="text-sm text-gray-500 mt-2">
                            Showing {filteredCourses.length} of {courses.length} courses
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

            {isLoading && <CourseLoadingSkeleton count={6} />}

            {!isLoading && !isError && courses.length === 0 && (
                <Card className="border-gray-100 shadow-sm">
                    <CardContent className="py-16">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <BookOpen className="w-10 h-10 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">No courses assigned</h3>
                            <p className="text-gray-500 max-w-md mx-auto">
                                Contact your professor to be added as a grading assistant for a course.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && courses.length > 0 && filteredCourses.length === 0 && (
                <Card className="border-gray-100 shadow-sm">
                    <CardContent className="py-16">
                        <div className="text-center">
                            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gray-100 flex items-center justify-center">
                                <Search className="w-7 h-7 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
                            <p className="text-gray-500">Try adjusting your search</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && filteredCourses.length > 0 && (
                <CourseCardGrid>
                    {filteredCourses.map((course) => (
                        <CourseCard
                            key={course.id}
                            course={{
                                id: course.id,
                                code: course.code,
                                name: course.name,
                                description: course.description || null,
                                students_count: course.students_count ?? course.student_count,
                                assignments_count: course.assignments_count ?? course.assignment_count,
                                semester: course.semester,
                                year: course.year,
                                color: course.color,
                            }}
                            variant="assistant"
                            basePath="/assistant/courses"
                        />
                    ))}
                </CourseCardGrid>
            )}
        </div>
    );
}
