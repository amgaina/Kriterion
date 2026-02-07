"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
    BookOpen,
    Users,
    FileText,
    Calendar,
    Clock,
    Plus,
    Eye,
    Loader2,
    AlertCircle,
    CheckCircle2,
} from 'lucide-react';

interface Course {
    id: number;
    code: string;
    name: string;
    description?: string | null;
    semester: string;
    year: number;
    status: string;
    is_active: boolean;
    created_at: string;
    students_count?: number;
    assignments_count?: number;
    section?: string | null;
}

export default function CourseOverviewPage() {
    const params = useParams();
    const courseId = Number(params?.courseId);
    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                const data = await apiClient.getCourse(courseId);
                setCourse(data);
            } catch (e: any) {
                setError(e?.response?.data?.detail || e?.message || 'Failed to load course');
            } finally {
                setLoading(false);
            }
        }
        if (courseId) load();
    }, [courseId]);

    if (loading) {
        return (
            <ProtectedRoute allowedRoles={["FACULTY"]}>
                <DashboardLayout>
                    <div className="flex items-center justify-center h-96">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    if (error) {
        return (
            <ProtectedRoute allowedRoles={["FACULTY"]}>
                <DashboardLayout>
                    <Alert type="error">
                        {error}
                    </Alert>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    if (!course) {
        return (
            <ProtectedRoute allowedRoles={["FACULTY"]}>
                <DashboardLayout>
                    <Alert type="warning">
                        Course not found.
                    </Alert>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    const statusColor = course.status === 'active' 
        ? 'bg-green-100 text-green-800' 
        : course.status === 'draft' 
        ? 'bg-amber-100 text-amber-800'
        : 'bg-gray-100 text-gray-800';

    const isActive = course.is_active;

    return (
        <ProtectedRoute allowedRoles={["FACULTY"]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                                    <BookOpen className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900">{course.code}</h1>
                                    <p className="text-gray-500 text-sm">{course.name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                                <Badge className={statusColor}>
                                    {course.status?.charAt(0).toUpperCase() + course.status?.slice(1) || 'Active'}
                                </Badge>
                                {isActive && (
                                    <span className="flex items-center gap-1 text-sm text-green-600">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Active
                                    </span>
                                )}
                            </div>
                        </div>
                        <Link href={`/faculty/courses/${courseId}/assignments/new`}>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Create Assignment
                            </Button>
                        </Link>
                    </div>

                    {/* Course Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Course Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Semester</p>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <p className="font-medium">{course.semester} {course.year}</p>
                                    </div>
                                </div>
                                {course.section && (
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Section</p>
                                        <p className="font-medium">{course.section}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Created</p>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        <p className="font-medium">
                                            {new Date(course.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {course.description && (
                                <div className="pt-4 border-t border-gray-200">
                                    <p className="text-sm text-gray-500 mb-2">Description</p>
                                    <p className="text-gray-700">{course.description}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500 mb-2">Enrolled Students</p>
                                        <p className="text-3xl font-bold text-gray-900">
                                            {course.students_count ?? 0}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                                        <Users className="w-6 h-6 text-blue-600" />
                                    </div>
                                </div>
                                <Link href={`/faculty/courses/${courseId}/students`}>
                                    <Button variant="outline" size="sm" className="mt-4 w-full">
                                        <Users className="w-4 h-4 mr-2" />
                                        Manage Students
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm text-gray-500 mb-2">Assignments</p>
                                        <p className="text-3xl font-bold text-gray-900">
                                            {course.assignments_count ?? 0}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg">
                                        <FileText className="w-6 h-6 text-purple-600" />
                                    </div>
                                </div>
                                <Link href={`/faculty/courses/${courseId}/assignments`}>
                                    <Button variant="outline" size="sm" className="mt-4 w-full">
                                        <Eye className="w-4 h-4 mr-2" />
                                        View Assignments
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Quick Actions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Link href={`/faculty/courses/${courseId}/assignments`}>
                                    <Button variant="outline" className="w-full">
                                        <FileText className="w-4 h-4 mr-2" />
                                        View All Assignments
                                    </Button>
                                </Link>
                                <Link href={`/faculty/courses/${courseId}/students`}>
                                    <Button variant="outline" className="w-full">
                                        <Users className="w-4 h-4 mr-2" />
                                        Manage Students
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
