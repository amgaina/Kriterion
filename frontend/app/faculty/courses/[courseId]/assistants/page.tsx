'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { AcknowledgementPopup } from '@/components/ui/acknowledgement-popup';
import { DataTable } from '@/components/ui/data-table';
import { CourseLoadingPage, CourseLoadingSpinner } from '@/components/course/CourseLoading';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import { BackLink } from '@/components/ui/BackLink';
import {
    UserCog,
    UserPlus,
    RefreshCw,
    Search,
    Trash2,
    Mail,
    Calendar,
    ShieldCheck,
} from 'lucide-react';

interface AssistantInCourse {
    id: number;
    email: string;
    full_name?: string | null;
    assigned_at: string;
}

const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

export default function CourseAssistantsPage() {
    const params = useParams();
    const queryClient = useQueryClient();
    const courseId = Number(params?.courseId);

    const [searchQuery, setSearchQuery] = useState('');
    const [addModal, setAddModal] = useState(false);
    const [assistantEmail, setAssistantEmail] = useState('');
    const [removeTarget, setRemoveTarget] = useState<AssistantInCourse | null>(null);
    const [notification, setNotification] = useState<{
        open: boolean;
        type: 'success' | 'error' | 'warning';
        title: string;
        message: string;
    }>({ open: false, type: 'success', title: '', message: '' });

    const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
        setNotification({
            open: true,
            type,
            title: type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : 'Error',
            message,
        });
    };

    const { data: assistants = [], isLoading, isFetching, refetch } = useQuery({
        queryKey: ['course-assistants', courseId],
        queryFn: () => apiClient.getCourseAssistants(courseId) as Promise<AssistantInCourse[]>,
        enabled: !!courseId,
    });

    const { data: course } = useQuery({
        queryKey: ['course', courseId],
        queryFn: () => apiClient.getCourse(courseId) as Promise<{ code: string; name: string }>,
        enabled: !!courseId,
    });

    const addAssistantMutation = useMutation({
        mutationFn: (email: string) => apiClient.addCourseAssistant(courseId, email),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-assistants', courseId] });
            setAddModal(false);
            setAssistantEmail('');
            showNotification('success', 'Grading assistant added successfully.');
        },
        onError: (err: any) => showNotification('error', err.response?.data?.detail || 'Failed to add assistant'),
    });

    const removeAssistantMutation = useMutation({
        mutationFn: (assistantId: number) => apiClient.removeCourseAssistant(courseId, assistantId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-assistants', courseId] });
            setRemoveTarget(null);
            showNotification('success', 'Assistant removed from course.');
        },
        onError: (err: any) => showNotification('error', err.response?.data?.detail || 'Failed to remove assistant'),
    });

    const filteredAssistants = searchQuery.trim()
        ? assistants.filter(
              (a) =>
                  (a.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                  a.email.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : assistants;

    const columns = [
        {
            key: 'full_name',
            header: 'Assistant',
            cell: (a: AssistantInCourse) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center text-sm font-semibold text-violet-700 flex-shrink-0">
                        {(a.full_name || a.email)
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">{a.full_name || 'No Name'}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[220px]">{a.email}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'email',
            header: 'Email',
            cell: (a: AssistantInCourse) => (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="truncate max-w-[200px]">{a.email}</span>
                </div>
            ),
        },
        {
            key: 'assigned_at',
            header: 'Assigned',
            cell: (a: AssistantInCourse) => (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>{formatDate(a.assigned_at)}</span>
                </div>
            ),
        },
        {
            key: 'actions',
            header: '',
            className: 'w-20',
            cell: (a: AssistantInCourse) => (
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setRemoveTarget(a)}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            ),
        },
    ];

    if (isLoading) {
        return <CourseLoadingPage message="Loading assistants..." />;
    }

    return (
        <>
            <div className="space-y-6 pb-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <BackLink href={`/faculty/courses/${courseId}`} label="Back to Overview" className="mb-2" />
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <div className="p-2 bg-violet-100 rounded-xl">
                                <UserCog className="w-6 h-6 text-violet-600" />
                            </div>
                            Grading Assistants
                        </h1>
                        {course && (
                            <p className="text-gray-500 mt-1">
                                {course.code} · {course.name}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            disabled={isFetching}
                            className="gap-2"
                        >
                            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => setAddModal(true)}
                            className="gap-2 bg-[#862733] hover:bg-[#a03040]"
                        >
                            <UserPlus className="w-4 h-4" /> Add Assistant
                        </Button>
                    </div>
                </div>

                {/* Info Card */}
                <Card className="border-0 shadow-md bg-gradient-to-r from-violet-50 to-purple-50">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-violet-100 rounded-lg">
                                <ShieldCheck className="w-5 h-5 text-violet-600" />
                            </div>
                            <div>
                                <h3 className="font-medium text-gray-900 mb-1">What can Grading Assistants do?</h3>
                                <ul className="text-sm text-gray-600 space-y-1">
                                    <li>• View all student submissions for this course</li>
                                    <li>• Grade and provide feedback on submissions</li>
                                    <li>• Run test cases and view code execution results</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Search */}
                {assistants.length > 0 && (
                    <Card className="border-0 shadow-md">
                        <CardContent className="p-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Search by name or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            {searchQuery && (
                                <p className="mt-2 text-sm text-gray-500">
                                    {filteredAssistants.length} of {assistants.length} assistants
                                </p>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Assistants List */}
                {assistants.length === 0 ? (
                    <Card className="border-0 shadow-md">
                        <CardContent className="py-16 text-center">
                            <UserCog className="w-14 h-14 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-1">No assistants assigned</h3>
                            <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
                                Add grading assistants to help with grading submissions for this course.
                            </p>
                            <Button
                                onClick={() => setAddModal(true)}
                                className="gap-2 bg-[#862733] hover:bg-[#a03040]"
                            >
                                <UserPlus className="w-4 h-4" /> Add Grading Assistant
                            </Button>
                        </CardContent>
                    </Card>
                ) : filteredAssistants.length === 0 ? (
                    <Card className="border-0 shadow-md">
                        <CardContent className="py-16 text-center">
                            <Search className="w-14 h-14 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-1">No matching assistants</h3>
                            <p className="text-gray-500 text-sm">Try a different search term.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="border-0 shadow-md overflow-hidden">
                        <DataTable columns={columns} data={filteredAssistants} emptyMessage="No assistants found" />
                    </Card>
                )}
            </div>

            {/* Add Assistant Modal */}
            <Modal isOpen={addModal} onClose={() => setAddModal(false)} title="Add Grading Assistant" size="md">
                <div className="space-y-4">
                    <p className="text-sm text-gray-500">
                        Enter the email of an assistant who has an account. They will be able to grade submissions for
                        this course.
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Assistant Email</label>
                        <Input
                            type="email"
                            placeholder="assistant@university.edu"
                            value={assistantEmail}
                            onChange={(e) => setAssistantEmail(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && assistantEmail.includes('@')) {
                                    addAssistantMutation.mutate(assistantEmail);
                                }
                            }}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => setAddModal(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => addAssistantMutation.mutate(assistantEmail)}
                            disabled={!assistantEmail.includes('@') || addAssistantMutation.isPending}
                            className="bg-[#862733] hover:bg-[#a03040]"
                        >
                            {addAssistantMutation.isPending ? (
                                <CourseLoadingSpinner size="sm" label="Adding..." />
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4 mr-2" /> Add Assistant
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Remove Confirmation */}
            <ConfirmDeleteModal
                isOpen={!!removeTarget}
                onClose={() => setRemoveTarget(null)}
                onConfirm={() => removeTarget && removeAssistantMutation.mutate(removeTarget.id)}
                confirmationPhrase="Remove"
                itemName={removeTarget?.full_name || removeTarget?.email}
                title="Remove Assistant?"
                description={
                    removeTarget
                        ? `Are you sure you want to remove "${removeTarget.full_name || removeTarget.email}" from this course? Type "Remove" to confirm.`
                        : undefined
                }
                confirmLabel="Remove Assistant"
                confirmHint='Type "Remove" below to confirm.'
                loadingLabel="Removing..."
                isLoading={removeAssistantMutation.isPending}
                variant="warning"
            />

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
