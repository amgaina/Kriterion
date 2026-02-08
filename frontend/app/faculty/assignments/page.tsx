'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
    Calendar,
    Clock,
    Edit,
    Trash2,
    Loader2,
    Plus,
    FileText,
} from 'lucide-react';

interface Assignment {
    id: number;
    course_id: number;
    title: string;
    description?: string;
    due_date?: string;
    is_published: boolean;
    course?: {
        name: string;
        code: string;
        section?: string;
    };
}

export default function FacultyAssignmentsPage() {
    const queryClient = useQueryClient();
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    const { data: assignments, isLoading, error } = useQuery({
        queryKey: ['assignments', 'faculty'],
        queryFn: () => apiClient.getAssignments(),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => apiClient.deleteAssignment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assignments', 'faculty'] });
            setDeleteConfirm(null);
        },
    });

    const handleDelete = (id: number) => {
        deleteMutation.mutate(id);
    };

    const isOverdue = (dueDate: string | undefined) => {
        if (!dueDate) return false;
        return new Date(dueDate) < new Date();
    };

    const isDueSoon = (dueDate: string | undefined) => {
        if (!dueDate) return false;
        const now = new Date();
        const due = new Date(dueDate);
        const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursUntilDue <= 24 && hoursUntilDue > 0;
    };

    return (
        <ProtectedRoute allowedRoles={["FACULTY"]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Assignments</h1>
                            <p className="text-gray-500 mt-1">
                                {!isLoading && assignments ? `${assignments.length} assignment${assignments.length !== 1 ? 's' : ''}` : ''}
                            </p>
                        </div>
                        <Link href="/faculty/courses">
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Create Assignment
                            </Button>
                        </Link>
                    </div>

                    {isLoading && (
                        <div className="flex items-center justify-center h-96">
                            <Loader2 className="w-8 h-8 animate-spin text-[#862733]" />
                        </div>
                    )}

                    {error && (
                        <Alert type="error">
                            Failed to load assignments. Please try again.
                        </Alert>
                    )}

                    {!isLoading && assignments && assignments.length === 0 && (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-600 mb-4">No assignments yet</p>
                                <Link href="/faculty/courses">
                                    <Button>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create Your First Assignment
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    )}

                    {!isLoading && assignments && assignments.length > 0 && (
                        <div className="space-y-3">
                            {assignments.map((assignment: Assignment) => (
                                <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h2 className="text-lg font-semibold text-gray-900">
                                                        {assignment.title}
                                                    </h2>
                                                    <Badge variant={assignment.is_published ? 'success' : 'secondary'}>
                                                        {assignment.is_published ? 'Published' : 'Draft'}
                                                    </Badge>
                                                </div>

<div className="mb-3 p-2 bg-blue-50 rounded">
                                    {assignment.course && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-blue-600 uppercase">Class:</span>
                                            <span className="font-semibold text-gray-900">{assignment.course.code}</span>
                                            {assignment.course.name && (
                                                <>
                                                    <span className="text-gray-400">•</span>
                                                    <span className="text-gray-700 text-sm">{assignment.course.name}</span>
                                                </>
                                            )}
                                            {assignment.course.section && (
                                                <>
                                                    <span className="text-gray-400">•</span>
                                                    <span className="text-gray-700 font-medium">Section {assignment.course.section}</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {assignment.description && (
                                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                        {assignment.description}
                                    </p>
                                )}

                                <div className="flex flex-wrap gap-4 text-sm text-gray-600">

                                                    {/* Due Date */}
                                                    {assignment.due_date && (
                                                        <div className="flex flex-col">
                                                            <span className="text-xs text-gray-500 uppercase font-semibold">Due Date</span>
                                                            <div className="flex items-center gap-1 mt-0.5">
                                                                <Calendar className="w-4 h-4 text-gray-400" />
                                                                <span className={
                                                                    isOverdue(assignment.due_date)
                                                                        ? 'text-red-600 font-medium'
                                                                        : isDueSoon(assignment.due_date)
                                                                            ? 'text-amber-600 font-medium'
                                                                            : ''
                                                                }>
                                                                    {new Date(assignment.due_date).toLocaleDateString('en-US', {
                                                                        month: 'short',
                                                                        day: 'numeric',
                                                                        year: 'numeric',
                                                                    })}
                                                                </span>
                                                                <span className="text-gray-500 text-xs">
                                                                    {new Date(assignment.due_date).toLocaleTimeString('en-US', {
                                                                        hour: '2-digit',
                                                                        minute: '2-digit',
                                                                    })}
                                                                </span>
                                                                {isOverdue(assignment.due_date) && (
                                                                    <Badge variant="danger" className="ml-2">Overdue</Badge>
                                                                )}
                                                                {isDueSoon(assignment.due_date) && (
                                                                    <Badge variant="warning" className="ml-2">Due Soon</Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-2">
                                                <Link href={`/faculty/courses/${assignment.course_id}/assignments/${assignment.id}/edit`}>
                                                    <Button variant="outline" size="sm">
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setDeleteConfirm(assignment.id)}
                                                    disabled={deleteMutation.isPending}
                                                    className="text-red-600 hover:bg-red-50"
                                                >
                                                    {deleteMutation.isPending ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Delete Confirmation Modal */}
                {deleteConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                        <Card className="w-96 shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-red-600">Delete Assignment?</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-gray-600">
                                    Are you sure you want to delete this assignment? This action cannot be undone.
                                </p>
                                <div className="flex gap-3 justify-end">
                                    <Button
                                        variant="outline"
                                        onClick={() => setDeleteConfirm(null)}
                                        disabled={deleteMutation.isPending}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="danger"
                                        onClick={() => handleDelete(deleteConfirm)}
                                        disabled={deleteMutation.isPending}
                                    >
                                        {deleteMutation.isPending ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Deleting...
                                            </>
                                        ) : (
                                            'Delete'
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </DashboardLayout>
        </ProtectedRoute>
    );
}
