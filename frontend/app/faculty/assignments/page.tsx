'use client';

import React, { useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { DataTable } from '@/components/ui/data-table';
import Link from 'next/link';
import {
    Plus,
    FileText,
    Calendar,
    Loader2,
    Search,
    Eye,
} from 'lucide-react';

interface Assignment {
    id: number;
    course_id: number;
    course_code?: string;
    course_name?: string;
    title: string;
    description?: string;
    difficulty?: string;
    due_date?: string;
    is_published: boolean;
    max_score: number;
    submission_count?: number;
}

export default function FacultyAssignmentsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');

    const { data: assignments = [], isLoading, error } = useQuery({
        queryKey: ['faculty-assignments'],
        queryFn: async () => {
            // Fetch all courses first, then get assignments for each
            const courses = await apiClient.getCourses();
            const allAssignments: Assignment[] = [];
            
            for (const course of courses) {
                const courseAssignments = await apiClient.getAssignments(course.id);
                const enriched = courseAssignments.map((a: any) => ({
                    ...a,
                    course_code: course.code,
                    course_name: course.name,
                }));
                allAssignments.push(...enriched);
            }
            
            return allAssignments;
        },
    });

    const filteredAssignments = useMemo(() => {
        return assignments.filter((a: Assignment) => {
            const matchesSearch = 
                a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.course_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.course_name?.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesStatus = statusFilter === 'all' || 
                (statusFilter === 'published' && a.is_published) ||
                (statusFilter === 'draft' && !a.is_published);
            
            return matchesSearch && matchesStatus;
        });
    }, [assignments, searchQuery, statusFilter]);

    const columns = [
        {
            key: 'title',
            header: 'Assignment',
            cell: (assignment: Assignment) => (
                <div>
                    <p className="font-medium text-gray-900">{assignment.title}</p>
                    <p className="text-sm text-gray-500">{assignment.course_code} — {assignment.course_name}</p>
                </div>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (assignment: Assignment) => (
                <Badge variant={assignment.is_published ? 'success' : 'secondary'}>
                    {assignment.is_published ? 'Published' : 'Draft'}
                </Badge>
            ),
        },
        {
            key: 'difficulty',
            header: 'Difficulty',
            cell: (assignment: Assignment) => (
                <Badge variant={
                    assignment.difficulty === 'hard' ? 'danger' :
                        assignment.difficulty === 'medium' ? 'warning' : 'default'
                }>
                    {assignment.difficulty?.charAt(0).toUpperCase() + assignment.difficulty?.slice(1) || 'N/A'}
                </Badge>
            ),
        },
        {
            key: 'submissions',
            header: 'Submissions',
            cell: (assignment: Assignment) => (
                <span className="text-sm font-medium">{assignment.submission_count ?? 0}</span>
            ),
        },
        {
            key: 'due_date',
            header: 'Due Date',
            cell: (assignment: Assignment) => (
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">
                        {assignment.due_date
                            ? new Date(assignment.due_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                            })
                            : '-'}
                    </span>
                </div>
            ),
        },
        {
            key: 'actions',
            header: '',
            className: 'w-16',
            cell: (assignment: Assignment) => (
                <Link href={`/faculty/courses/${assignment.course_id}/assignments/${assignment.id}`}>
                    <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                    </Button>
                </Link>
            ),
        },
    ];

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
                        Failed to load assignments. Please try again.
                    </Alert>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={["FACULTY"]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">All Assignments</h1>
                            <p className="text-gray-500 mt-1">
                                {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <Link href="/faculty/courses">
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Create Assignment
                            </Button>
                        </Link>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-sm text-gray-500">Total</p>
                                <p className="text-3xl font-bold text-gray-900">{assignments.length}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-sm text-gray-500">Published</p>
                                <p className="text-3xl font-bold text-green-600">
                                    {assignments.filter((a: Assignment) => a.is_published).length}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <p className="text-sm text-gray-500">Drafts</p>
                                <p className="text-3xl font-bold text-amber-600">
                                    {assignments.filter((a: Assignment) => !a.is_published).length}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters */}
                    <Card>
                        <CardContent className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                    <Input
                                        type="text"
                                        placeholder="Search assignments..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <Select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as any)}
                                    options={[
                                        { value: 'all', label: 'All Status' },
                                        { value: 'published', label: 'Published' },
                                        { value: 'draft', label: 'Draft' },
                                    ]}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Assignments Table */}
                    {filteredAssignments.length > 0 ? (
                        <Card>
                            <DataTable
                                columns={columns}
                                data={filteredAssignments}
                                isLoading={isLoading}
                                emptyMessage="No assignments found"
                            />
                        </Card>
                    ) : (
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
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
