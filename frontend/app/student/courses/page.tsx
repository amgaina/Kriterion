'use client';

/**
 * Student Courses Page
 *
 * Clean, simple view of enrolled courses — same layout as faculty courses.
 * - Search
 * - Course cards grid
 * - Responsive
 */

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
    name: string;
    code: string;
    description: string | null;
    semester: string;
    year: number;
    assignments_count?: number;
    color?: string;
}

export default function StudentCoursesPage() {
    const [searchQuery, setSearchQuery] = useState('');

    const {
        data: courses = [],
        isLoading,
        isError,
        error,
        refetch,
    } = useQuery({
        queryKey: ['student-courses'],
        queryFn: () => apiClient.getCourses(),
        staleTime: 5 * 60 * 1000,
    });

    const filteredCourses = useMemo(() => {
        if (!searchQuery.trim()) return courses;
        const q = searchQuery.toLowerCase();
        return courses.filter(
            (c: Course) =>
                c.name.toLowerCase().includes(q) ||
                c.code.toLowerCase().includes(q) ||
                (c.description || '').toLowerCase().includes(q)
        );
    }, [courses, searchQuery]);

    return (
        <div className="space-y-6 pb-8">
            <InnerHeaderDesign
                title="My Courses"
                subtitle="Your enrolled courses and assignments"
            />

            {/* Error State */}
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

            {/* Search */}
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
                    {(searchQuery && courses.length > 0) && (
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

            {/* Loading */}
            {isLoading && <CourseLoadingSkeleton count={6} />}

            {/* Empty State */}
            {!isLoading && !isError && courses.length === 0 && (
                <Card className="border-gray-100 shadow-sm">
                    <CardContent className="py-16">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <BookOpen className="w-10 h-10 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">No courses yet</h3>
                            <p className="text-gray-500 max-w-md mx-auto">
                                You are not enrolled in any courses. Contact your instructor to get enrolled.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* No Results */}
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

            {/* Course Cards */}
            {!isLoading && !isError && filteredCourses.length > 0 && (
                <CourseCardGrid>
                    {filteredCourses.map((course: Course) => (
                        <CourseCard
                            key={course.id}
                            course={{
                                id: course.id,
                                code: course.code,
                                name: course.name,
                                description: course.description || null,
                                semester: course.semester,
                                year: course.year,
                                assignments_count: course.assignments_count,
                                color: course.color,
                            }}
                            variant="student"
                            basePath="/student/courses"
                        />
                    ))}
                </CourseCardGrid>
            )}
        </div>
    );
}
