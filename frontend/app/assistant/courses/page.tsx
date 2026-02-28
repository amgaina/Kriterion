'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, FileCode, ChevronRight } from 'lucide-react';

interface Course {
    id: number;
    code: string;
    name: string;
    description?: string;
    students_count: number;
    assignments_count: number;
}

export default function AssistantCoursesPage() {
    const { data: courses = [], isLoading } = useQuery<Course[]>({
        queryKey: ['assistant-courses'],
        queryFn: () => apiClient.getCourses(),
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">My Assigned Courses</h1>
                <p className="text-gray-500 mt-1">Courses where you assist with grading</p>
            </div>

            {isLoading ? (
                <Card>
                    <CardContent className="py-12 text-center text-gray-500">Loading courses...</CardContent>
                </Card>
            ) : courses.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No courses assigned</h3>
                        <p className="text-gray-500">Contact your professor to be added as a grading assistant.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {courses.map((course) => (
                        <Card key={course.id}>
                            <CardContent className="p-0">
                                <Link
                                    href={`/assistant/grading?course=${course.id}`}
                                    className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                                            <BookOpen className="w-6 h-6 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{course.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline">{course.code}</Badge>
                                                <span className="text-sm text-gray-500">
                                                    {course.students_count} students · {course.assignments_count} assignments
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" asChild>
                                            <span>
                                                <FileCode className="w-4 h-4 mr-1" />
                                                Grade
                                            </span>
                                        </Button>
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    </div>
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
