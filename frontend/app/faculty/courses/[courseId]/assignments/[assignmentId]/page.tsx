'use client';

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import Link from 'next/link';
import {
    ArrowLeft,
    FileText,
    Clock,
    Calendar,
    Target,
    Code,
    AlertCircle,
    Loader2,
    CheckCircle2,
} from 'lucide-react';

interface Assignment {
    id: number;
    course_id: number;
    title: string;
    description?: string;
    instructions?: string;
    difficulty: string;
    due_date?: string;
    is_published: boolean;
    max_score: number;
    passing_score: number;
    max_attempts: number;
    allow_late: boolean;
    late_penalty_per_day?: number;
    max_late_days?: number;
    language_id?: number;
    starter_code?: string;
    solution_code?: string;
    enable_plagiarism_check: boolean;
    enable_ai_detection: boolean;
    submission_count?: number;
    created_at: string;
    updated_at?: string;
}

export default function AssignmentDetailPage() {
    const params = useParams();
    const courseParam = params?.courseId as string | string[] | undefined;
    const assignmentParam = params?.assignmentId as string | string[] | undefined;
    
    const courseIdStr = Array.isArray(courseParam) ? (courseParam[0] ?? '') : (courseParam ?? '');
    const assignmentIdStr = Array.isArray(assignmentParam) ? (assignmentParam[0] ?? '') : (assignmentParam ?? '');
    
    const courseId = useMemo(() => parseInt(courseIdStr, 10), [courseIdStr]);
    const assignmentId = useMemo(() => parseInt(assignmentIdStr, 10), [assignmentIdStr]);

    const { data: assignment, isLoading, error } = useQuery({
        queryKey: ['assignment', assignmentId],
        queryFn: () => apiClient.getAssignment(assignmentId),
        enabled: !!assignmentId,
    });

    if (isLoading) {
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
                        Failed to load assignment. Please try again.
                    </Alert>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    if (!assignment) {
        return (
            <ProtectedRoute allowedRoles={["FACULTY"]}>
                <DashboardLayout>
                    <Alert type="warning">
                        Assignment not found.
                    </Alert>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    const difficultyColor = assignment.difficulty === 'hard' 
        ? 'bg-red-100 text-red-800' 
        : assignment.difficulty === 'medium'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-green-100 text-green-800';

    const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
    const isOverdue = dueDate && dueDate < new Date();

    return (
        <ProtectedRoute allowedRoles={["FACULTY"]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header with Back Button */}
                    <div className="flex items-center gap-4">
                        <Link href={`/faculty/courses/${courseId}/assignments`}>
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Assignments
                            </Button>
                        </Link>
                    </div>

                    {/* Title Section */}
                    <div className="space-y-2">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg">
                                        <FileText className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h1 className="text-3xl font-bold text-gray-900">{assignment.title}</h1>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge className={assignment.is_published ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                                        {assignment.is_published ? 'Published' : 'Draft'}
                                    </Badge>
                                    <Badge className={difficultyColor}>
                                        {assignment.difficulty?.charAt(0).toUpperCase() + assignment.difficulty?.slice(1)}
                                    </Badge>
                                    {isOverdue && (
                                        <Badge className="bg-red-100 text-red-800">
                                            Overdue
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column - Description & Details */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Description */}
                            {assignment.description && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Description</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-gray-700 whitespace-pre-wrap">{assignment.description}</p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Instructions */}
                            {assignment.instructions && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Instructions</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-gray-700 whitespace-pre-wrap">{assignment.instructions}</p>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Starter Code */}
                            {assignment.starter_code && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Code className="w-5 h-5" />
                                            Starter Code
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto text-gray-800">
                                            {assignment.starter_code}
                                        </pre>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Scoring Rubric */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Target className="w-5 h-5" />
                                        Scoring
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">Max Score</p>
                                            <p className="text-2xl font-bold text-gray-900">{assignment.max_score}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">Passing Score</p>
                                            <p className="text-2xl font-bold text-green-600">{assignment.passing_score}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Submissions */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Submissions</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">Total Submissions</p>
                                            <p className="text-2xl font-bold text-gray-900">{assignment.submission_count ?? 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">Max Attempts</p>
                                            <p className="text-2xl font-bold text-gray-900">
                                                {assignment.max_attempts === 0 ? 'Unlimited' : assignment.max_attempts}
                                            </p>
                                        </div>
                                    </div>
                                    {assignment.submission_count && assignment.submission_count > 0 && (
                                        <div className="pt-3 border-t">
                                            <Link href={`/faculty/courses/${courseId}/assignments/${assignmentId}/submissions`}>
                                                <Button variant="outline" className="w-full">
                                                    View Submissions
                                                </Button>
                                            </Link>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Column - Metadata */}
                        <div className="space-y-6">
                            {/* Due Date Card */}
                            {dueDate && (
                                <Card className={isOverdue ? 'border-red-200 bg-red-50' : ''}>
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-sm text-gray-500 mb-2">Due Date</p>
                                                <p className="text-lg font-bold text-gray-900">
                                                    {dueDate.toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })}
                                                </p>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    {dueDate.toLocaleTimeString('en-US', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                                                <Calendar className="w-5 h-5 text-blue-600" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Late Submission Policy */}
                            {assignment.allow_late && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            Late Submissions
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2 text-sm">
                                        <div>
                                            <p className="text-gray-500">Allowed</p>
                                            <p className="font-medium text-gray-900">Yes</p>
                                        </div>
                                        {assignment.late_penalty_per_day && (
                                            <div>
                                                <p className="text-gray-500">Penalty per Day</p>
                                                <p className="font-medium text-gray-900">{assignment.late_penalty_per_day}%</p>
                                            </div>
                                        )}
                                        {assignment.max_late_days && (
                                            <div>
                                                <p className="text-gray-500">Max Late Days</p>
                                                <p className="font-medium text-gray-900">{assignment.max_late_days}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Checks */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Checks</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">Plagiarism Detection</span>
                                        {assignment.enable_plagiarism_check ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <AlertCircle className="w-5 h-5 text-gray-300" />
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">AI Detection</span>
                                        {assignment.enable_ai_detection ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <AlertCircle className="w-5 h-5 text-gray-300" />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Created Info */}
                            <Card>
                                <CardContent className="p-4 text-sm text-gray-500 space-y-1">
                                    <p>
                                        Created {new Date(assignment.created_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                        })}
                                    </p>
                                    {assignment.updated_at && (
                                        <p>
                                            Updated {new Date(assignment.updated_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
