'use client';

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, FileCode, CheckCircle, Clock, ChevronRight } from 'lucide-react';

interface Course {
    id: number;
    code: string;
    name: string;
    description?: string;
    students_count: number;
    assignments_count: number;
}

export default function AssistantDashboardPage() {
    const { data: courses = [], isLoading } = useQuery<Course[]>({
        queryKey: ['assistant-courses'],
        queryFn: () => apiClient.getCourses(),
    });

    const { data: submissions = [] } = useQuery({
        queryKey: ['assistant-submissions'],
        queryFn: () => apiClient.getSubmissions(),
    });

    const pendingCount = Array.isArray(submissions)
        ? submissions.filter((s: any) => s.status === 'pending' || s.status === 'manual_review' || s.status === 'autograded').length
        : 0;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Grading Assistant Dashboard</h1>
                <p className="text-gray-500 mt-1">Help professors grade assignments for your assigned courses</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{courses.length}</p>
                                <p className="text-sm text-gray-500">Courses Assigned</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
                                <p className="text-sm text-gray-500">Pending to Grade</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900">
                                    {Array.isArray(submissions) ? submissions.filter((s: any) => s.status === 'completed').length : 0}
                                </p>
                                <p className="text-sm text-gray-500">Graded</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5" />
                        My Assigned Courses
                    </CardTitle>
                    <p className="text-sm text-gray-500">Courses where you help with grading</p>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-gray-500">Loading courses...</p>
                    ) : courses.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                            <FileCode className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                            <p className="text-gray-600 font-medium">No courses assigned yet</p>
                            <p className="text-sm text-gray-500">Contact your professor to be added as a grading assistant</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {courses.map((course) => (
                                <Link
                                    key={course.id}
                                    href={`/assistant/courses/${course.id}`}
                                    className="block p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900">{course.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline">{course.code}</Badge>
                                                <span className="text-sm text-gray-500">
                                                    {course.students_count} students · {course.assignments_count} assignments
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {courses.length > 0 && (
                <div className="flex justify-end">
                    <Link href="/assistant/grading">
                        <Button size="lg" className="bg-primary hover:bg-primary/90">
                            <FileCode className="w-5 h-5 mr-2" />
                            Go to Grading
                        </Button>
                    </Link>
                </div>
            )}
        </div>
    );
}
