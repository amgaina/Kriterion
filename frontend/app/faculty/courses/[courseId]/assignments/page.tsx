'use client';

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AcknowledgementPopup } from '@/components/ui/acknowledgement-popup';
import { CourseLoadingPage } from '@/components/course/CourseLoading';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import {
    Plus,
    FileText,
    CheckCircle2,
    Clock,
    Loader2,
    Search,
    Eye,
    EyeOff,
    Trash2,
    AlertCircle,
    ChevronRight,
    FlaskConical,
    Target,
    RefreshCw,
} from 'lucide-react';

interface Assignment {
    id: number;
    course_id: number;
    title: string;
    description?: string;
    difficulty?: string;
    due_date?: string;
    is_published: boolean;
    max_score: number;
    passing_score: number;
    test_weight: number;
    rubric_weight: number;
    max_attempts: number;
    allow_late: boolean;
    created_at: string;
    updated_at?: string;
}

const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const getDifficultyStyle = (d?: string) => {
    switch (d) {
        case 'easy': return 'bg-green-100 text-green-800';
        case 'medium': return 'bg-amber-100 text-amber-800';
        case 'hard': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const isOverdue = (dueDate?: string) => dueDate ? new Date(dueDate) < new Date() : false;
const isClosed = (a: Assignment) => !!a.is_published && !!a.due_date && new Date(a.due_date) < new Date();
const isUpcoming = (dueDate?: string) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const now = new Date();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    return due > now && (due.getTime() - now.getTime()) < threeDays;
};

export default function AssignmentsPage() {
    const params = useParams();
    const queryClient = useQueryClient();
    const courseParam = params?.courseId as string | string[] | undefined;
    const courseIdStr = Array.isArray(courseParam) ? (courseParam[0] ?? '') : (courseParam ?? '');
    const courseId = useMemo(() => parseInt(courseIdStr, 10), [courseIdStr]);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'closed'>('all');
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
    const [notification, setNotification] = useState<{
        open: boolean;
        type: 'success' | 'error';
        title: string;
        message: string;
    }>({
        open: false,
        type: 'success',
        title: 'Success',
        message: '',
    });

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({
            open: true,
            type,
            title: type === 'success' ? 'Success' : 'Error',
            message,
        });
    };

    const { data: allAssignments = [], isLoading, isFetching, refetch } = useQuery({
        queryKey: ['course-assignments', courseId],
        queryFn: () => apiClient.getCourseAssignments(courseId, true, 'all') as Promise<Assignment[]>,
        enabled: !!courseId && !isNaN(courseId),
    });

    const assignments = useMemo(() => {
        const list = allAssignments as Assignment[];
        if (statusFilter === 'all') return list;
        if (statusFilter === 'published') return list.filter((a) => a.is_published && !isClosed(a));
        if (statusFilter === 'draft') return list.filter((a) => !a.is_published);
        if (statusFilter === 'closed') return list.filter(isClosed);
        return list;
    }, [allAssignments, statusFilter]);

    const publishMutation = useMutation({
        mutationFn: (id: number) => apiClient.publishAssignment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-assignments', courseId] });
            showNotification('success', 'Assignment published!');
        },
        onError: (err: any) => showNotification('error', err.response?.data?.detail || 'Failed to publish'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => apiClient.deleteAssignment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-assignments', courseId] });
            setDeleteTarget(null);
            showNotification('success', 'Assignment deleted.');
        },
        onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to delete';
            showNotification('error', typeof msg === 'string' ? msg : 'Failed to delete');
        },
    });

    const filteredAssignments = useMemo(() => {
        let result = assignments;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter((a: Assignment) => a.title.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q));
        }
        return result;
    }, [assignments, searchQuery]);

    const stats = useMemo(() => {
        const all = allAssignments as Assignment[];
        const closed = all.filter(isClosed);
        const published = all.filter((a) => a.is_published && !isClosed(a));
        const drafts = all.filter((a) => !a.is_published);
        return {
            total: all.length,
            published: published.length,
            drafts: drafts.length,
            closed: closed.length,
            overdue: closed.length,
        };
    }, [allAssignments]);

    if (isLoading) {
        return <CourseLoadingPage message="Loading assignments..." />;
    }

    return (
        <>
            <div className="space-y-6 pb-8">

                    {/* ─── Header ─── */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <Link
                                href={`/faculty/courses/${courseId}`}
                                className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm mb-2 transition-colors"
                            >
                                ← Back to Overview
                            </Link>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <FileText className="w-6 h-6 text-primary" />
                                </div>
                                Assignments
                            </h1>
                            <p className="text-gray-500 mt-1">
                                {stats.total} total &middot; {stats.published} published &middot; {stats.drafts} draft{stats.drafts !== 1 ? 's' : ''} &middot; {stats.closed} closed
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => refetch()}
                                disabled={isFetching}
                                className="gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 h-9 px-3"
                            >
                                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                            </Button>
                            <Link href={`/faculty/courses/${courseId}/assignments/new`}>
                                <Button className="gap-2 h-9">
                                    <Plus className="w-4 h-4" /> New Assignment
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* ─── Stat Cards ─── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStatusFilter('all')}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                                        <p className="text-xs text-gray-500">Total</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStatusFilter('published')}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                                        <Eye className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-green-600">{stats.published}</p>
                                        <p className="text-xs text-gray-500">Published</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStatusFilter('draft')}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                        <EyeOff className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-amber-600">{stats.drafts}</p>
                                        <p className="text-xs text-gray-500">Drafts</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card
                            className="hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => setStatusFilter('closed')}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                                        <AlertCircle className="w-5 h-5 text-red-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-red-600">{stats.closed}</p>
                                        <p className="text-xs text-gray-500">Closed</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ─── Search & Filter ─── */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        placeholder="Search assignments..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <select
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'published' | 'draft' | 'closed')}
                                >
                                    <option value="all">All Status</option>
                                    <option value="published">Published</option>
                                    <option value="draft">Drafts</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </div>
                            {(searchQuery || statusFilter !== 'all') && (
                                <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                                    <span>Showing {filteredAssignments.length} of {assignments.length} assignment{assignments.length !== 1 ? 's' : ''}</span>
                                    <button onClick={() => { setSearchQuery(''); setStatusFilter('all'); }} className="text-primary hover:underline">Clear</button>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ─── Assignment Cards ─── */}
                    {filteredAssignments.length === 0 ? (
                        <Card>
                            <CardContent className="py-16 text-center">
                                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-1">
                                    {assignments.length === 0 ? 'No assignments yet' : 'No matching assignments'}
                                </h3>
                                <p className="text-gray-500 mb-6 text-sm">
                                    {assignments.length === 0
                                        ? 'Create your first assignment to get started.'
                                        : 'Try adjusting your search or filter.'}
                                </p>
                                {assignments.length === 0 && (
                                    <Link href={`/faculty/courses/${courseId}/assignments/new`}>
                                        <Button className="gap-2">
                                            <Plus className="w-4 h-4" /> Create First Assignment
                                        </Button>
                                    </Link>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {filteredAssignments.map((a: Assignment) => {
                                const overdue = a.is_published && isOverdue(a.due_date);
                                const upcoming = a.is_published && isUpcoming(a.due_date);

                                return (
                                    <Card key={a.id} className="hover:shadow-md transition-all group">
                                        <CardContent className="p-0">
                                            <div className="flex items-stretch">
                                                {/* Status indicator */}
                                                <div className={`w-1.5 flex-shrink-0 rounded-l-lg ${
                                                    a.is_published
                                                        ? overdue ? 'bg-red-500' : upcoming ? 'bg-amber-400' : 'bg-green-500'
                                                        : 'bg-gray-300'
                                                }`} />

                                                {/* Main content */}
                                                <Link
                                                    href={`/faculty/courses/${courseId}/assignments/${a.id}`}
                                                    className="flex-1 p-4 md:p-5 hover:bg-gray-50/50 transition-colors"
                                                >
                                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                                <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors truncate">
                                                                    {a.title}
                                                                </h3>
                                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                                    a.is_published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                                                }`}>
                                                                    {a.is_published ? 'Published' : 'Draft'}
                                                                </span>
                                                                {a.difficulty && (
                                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${getDifficultyStyle(a.difficulty)}`}>
                                                                        {a.difficulty}
                                                                    </span>
                                                                )}
                                                                {overdue && (
                                                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-100 text-red-700">
                                                                        Past Due
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {a.description && (
                                                                <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">{a.description}</p>
                                                            )}
                                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                                <span className="flex items-center gap-1">
                                                                    <Target className="w-3.5 h-3.5" /> {a.max_score} pts
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <FlaskConical className="w-3.5 h-3.5" /> Tests {a.test_weight}%
                                                                </span>
                                                                {a.max_attempts > 0 && (
                                                                    <span className="flex items-center gap-1">
                                                                        <RefreshCw className="w-3.5 h-3.5" /> {a.max_attempts} attempts
                                                                    </span>
                                                                )}
                                                                {a.allow_late && (
                                                                    <span className="flex items-center gap-1 text-amber-600">
                                                                        <Clock className="w-3.5 h-3.5" /> Late OK
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-4 flex-shrink-0">
                                                            {a.due_date && (
                                                                <div className="text-right hidden sm:block">
                                                                    <p className="text-xs text-gray-400">Due</p>
                                                                    <p className={`text-sm font-medium ${overdue ? 'text-red-600' : upcoming ? 'text-amber-600' : 'text-gray-700'}`}>
                                                                        {formatDate(a.due_date)}
                                                                    </p>
                                                                </div>
                                                            )}
                                                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
                                                        </div>
                                                    </div>
                                                </Link>

                                                {/* Action buttons */}
                                                <div className="flex flex-col justify-center gap-1 px-3 border-l border-gray-100">
                                                    {!a.is_published ? (
                                                        <button
                                                            onClick={() => publishMutation.mutate(a.id)}
                                                            disabled={publishMutation.isPending}
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                            title="Publish"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            className="p-2 text-gray-400 rounded-lg cursor-default"
                                                            title="Published"
                                                        >
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setDeleteTarget({ id: a.id, title: a.title })}
                                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {/* Delete confirmation modal */}
                    <ConfirmDeleteModal
                        isOpen={!!deleteTarget}
                        onClose={() => setDeleteTarget(null)}
                        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                        confirmationPhrase="Delete this Assignment"
                        itemName={deleteTarget?.title}
                        title="Delete Assignment"
                        description={
                            deleteTarget
                                ? `Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone. Type "Delete this Assignment" to confirm.`
                                : undefined
                        }
                        isLoading={deleteMutation.isPending}
                    />

                    {/* Background refresh indicator */}
                    {isFetching && !isLoading && (
                        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-full px-4 py-2 flex items-center gap-2 text-sm text-gray-600 border">
                            <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                            Updating...
                        </div>
                    )}
                    </div>

                    <AcknowledgementPopup
                        isOpen={notification.open}
                        onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
                        type={notification.type}
                        title={notification.title}
                        message={notification.message}
                    />
                </>
    );
}
