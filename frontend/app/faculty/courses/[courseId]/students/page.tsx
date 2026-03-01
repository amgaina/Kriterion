'use client';

import React, { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { DataTable } from '@/components/ui/data-table';
import { CourseLoadingPage, CourseLoadingSpinner } from '@/components/course/CourseLoading';
import { EnrollStudentModal } from '@/components/course/EnrollStudentModal';
import { BulkEnrollModal } from '@/components/course/BulkEnrollModal';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import {
    Users,
    UserPlus,
    Upload,
    Search,
    RefreshCw,
    GraduationCap,
    UserMinus,
    AlertCircle,
    CheckCircle2,
    UserCog,
    X,
    AlertTriangle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface StudentInCourse {
    id: number;
    email: string;
    full_name: string;
    student_id?: string | null;
    enrolled_at: string;
    status: string;
    current_grade?: number | null;
}

interface AssistantInCourse {
    id: number;
    email: string;
    full_name?: string | null;
    assigned_at: string;
}

const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const formatGrade = (grade: number | null | undefined) => {
    if (grade == null) return '-';
    return `${Math.round(grade * 10) / 10}%`;
};

export default function CourseStudentsPage() {
    const params = useParams();
    const queryClient = useQueryClient();
    const courseId = Number(params?.courseId);

    const [searchQuery, setSearchQuery] = useState('');
    const [enrollModal, setEnrollModal] = useState(false);
    const [bulkEnrollModal, setBulkEnrollModal] = useState(false);
    const [assistantModal, setAssistantModal] = useState(false);
    const [assistantEmail, setAssistantEmail] = useState('');
    const [inactiveTarget, setInactiveTarget] = useState<{ id: number; full_name: string } | null>(null);
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

    const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    const { data: students = [], isLoading, isFetching, refetch } = useQuery({
        queryKey: ['course-students', courseId],
        queryFn: () => apiClient.getCourseStudents(courseId) as Promise<StudentInCourse[]>,
        enabled: !!courseId,
    });

    const { data: assistants = [] } = useQuery({
        queryKey: ['course-assistants', courseId],
        queryFn: () => apiClient.getCourseAssistants(courseId) as Promise<AssistantInCourse[]>,
        enabled: !!courseId,
    });

    const { data: course } = useQuery({
        queryKey: ['course', courseId],
        queryFn: () => apiClient.getCourse(courseId) as Promise<{ code: string; name: string }>,
        enabled: !!courseId,
    });

    const invalidateCourse = () => {
        queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    };

    const makeInactiveMutation = useMutation({
        mutationFn: (studentId: number) => apiClient.unenrollStudent(courseId, studentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-students', courseId] });
            invalidateCourse();
            setInactiveTarget(null);
            showNotification('success', 'Student marked as inactive for this course.');
        },
        onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to make inactive';
            showNotification('error', typeof msg === 'string' ? msg : 'Failed to make inactive');
        },
    });

    const addAssistantMutation = useMutation({
        mutationFn: (email: string) => apiClient.addCourseAssistant(courseId, email),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-assistants', courseId] });
            setAssistantModal(false);
            setAssistantEmail('');
            showNotification('success', 'Grading assistant added successfully.');
        },
        onError: (err: any) => showNotification('error', err.response?.data?.detail || 'Failed to add assistant'),
    });

    const removeAssistantMutation = useMutation({
        mutationFn: (assistantId: number) => apiClient.removeCourseAssistant(courseId, assistantId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-assistants', courseId] });
            showNotification('success', 'Assistant removed from course.');
        },
        onError: (err: any) => showNotification('error', err.response?.data?.detail || 'Failed to remove assistant'),
    });

    const activeStudents = useMemo(() => students.filter(s => s.status === 'active'), [students]);
    const droppedStudents = useMemo(() => students.filter(s => s.status !== 'active'), [students]);

    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students;
        const q = searchQuery.toLowerCase();
        return students.filter(
            s =>
                s.full_name.toLowerCase().includes(q) ||
                s.email.toLowerCase().includes(q) ||
                (s.student_id ?? '').toLowerCase().includes(q),
        );
    }, [students, searchQuery]);

    const columns = [
        {
            key: 'full_name',
            header: 'Student',
            cell: (s: StudentInCourse) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#862733]/10 flex items-center justify-center text-xs font-semibold text-[#862733] flex-shrink-0">
                        {s.full_name
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">{s.full_name}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[180px]">{s.email}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'student_id',
            header: 'Student ID',
            cell: (s: StudentInCourse) => (
                <span className="text-sm text-gray-600 font-mono">{s.student_id || '-'}</span>
            ),
        },
        {
            key: 'current_grade',
            header: 'Grade',
            cell: (s: StudentInCourse) => (
                <span
                    className={`font-medium ${s.current_grade != null
                            ? s.current_grade >= 90
                                ? 'text-emerald-600'
                                : s.current_grade >= 70
                                    ? 'text-gray-700'
                                    : 'text-amber-600'
                            : 'text-gray-400'
                        }`}
                >
                    {formatGrade(s.current_grade)}
                </span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            cell: (s: StudentInCourse) => {
                const isActive = s.status === 'active';
                const label = isActive ? 'Active' : 'Inactive';
                return (
                    <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        {label}
                    </span>
                );
            },
        },
        {
            key: 'enrolled_at',
            header: 'Enrolled',
            cell: (s: StudentInCourse) => <span className="text-sm text-gray-600">{formatDate(s.enrolled_at)}</span>,
        },
        {
            key: 'actions',
            header: '',
            className: 'w-14',
            cell: (s: StudentInCourse) =>
                s.status === 'active' ? (
                    <button
                        onClick={() => setInactiveTarget({ id: s.id, full_name: s.full_name })}
                        className="p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Make inactive"
                    >
                        <UserMinus className="w-4 h-4" />
                    </button>
                ) : (
                    <span className="p-2 text-gray-300 cursor-default" title="Inactive">
                        <UserMinus className="w-4 h-4" />
                    </span>
                ),
        },
    ];

    if (isLoading) {
        return <CourseLoadingPage message="Loading students..." />;
    }

    return (
        <>
            <div className="space-y-6 pb-8">
                {/* Notification */}
                <AnimatePresence mode="wait">
                    {notification && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className={`rounded-xl border p-4 flex items-start gap-3 ${notification.type === 'success'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : notification.type === 'warning'
                                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                                        : 'bg-red-50 border-red-200 text-red-800'
                                }`}
                        >
                            {notification.type === 'success' ? (
                                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            ) : notification.type === 'warning' ? (
                                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            )}
                            <p className="text-sm flex-1">{notification.message}</p>
                            <button
                                onClick={() => setNotification(null)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <Link
                            href={`/faculty/courses/${courseId}`}
                            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm mb-2 transition-colors"
                        >
                            ← Back to Overview
                        </Link>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
                            <div className="p-2 bg-[#862733]/10 rounded-xl">
                                <GraduationCap className="w-6 h-6 text-[#862733]" />
                            </div>
                            Students
                        </h1>
                        <p className="text-gray-500 mt-1">
                            {activeStudents.length} active
                            {droppedStudents.length > 0 ? ` · ${droppedStudents.length} inactive` : ''}
                        </p>
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
                        <Button variant="outline" size="sm" onClick={() => setEnrollModal(true)} className="gap-2">
                            <UserPlus className="w-4 h-4" /> Enroll
                        </Button>
                        <Button size="sm" onClick={() => setBulkEnrollModal(true)} className="gap-2 bg-[#862733] hover:bg-[#a03040]">
                            <Upload className="w-4 h-4" /> Bulk Enroll
                        </Button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="border-0 shadow-md">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{students.length}</p>
                                    <p className="text-xs text-gray-500">Total</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-md">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-emerald-600">{activeStudents.length}</p>
                                    <p className="text-xs text-gray-500">Active</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-md">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center">
                                    <AlertCircle className="w-5 h-5 text-gray-500" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-600">{droppedStudents.length}</p>
                                    <p className="text-xs text-gray-500">Inactive</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-md">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center">
                                    <UserCog className="w-5 h-5 text-violet-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{assistants.length}</p>
                                    <p className="text-xs text-gray-500">Assistants</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Add Grading Assistant */}
                <Card className="border-0 shadow-md">
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <UserCog className="w-5 h-5 text-violet-600" />
                                Grading Assistants
                            </CardTitle>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAssistantModal(true)}
                                className="gap-2 w-fit"
                            >
                                <UserPlus className="w-4 h-4" /> Add Assistant
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-500 mb-4">
                            Assistants can grade submissions for this course. Add assistants by their email address.
                        </p>
                        {assistants.length === 0 ? (
                            <div className="py-6 text-center border-2 border-dashed border-gray-200 rounded-xl">
                                <UserCog className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">No assistants assigned</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-3"
                                    onClick={() => setAssistantModal(true)}
                                >
                                    Add Grading Assistant
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {assistants.map((a) => (
                                    <div
                                        key={a.id}
                                        className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/50"
                                    >
                                        <div>
                                            <p className="font-medium text-gray-900">{a.full_name || a.email}</p>
                                            <p className="text-xs text-gray-500">{a.email}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => {
                                                if (confirm(`Remove ${a.email} from this course?`)) {
                                                    removeAssistantMutation.mutate(a.id);
                                                }
                                            }}
                                            disabled={removeAssistantMutation.isPending}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Search */}
                <Card className="border-0 shadow-md">
                    <CardContent className="p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search by name, email, or student ID..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        {searchQuery && (
                            <p className="mt-2 text-sm text-gray-500">
                                {filteredStudents.length} of {students.length} students
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Student Table */}
                {filteredStudents.length === 0 ? (
                    <Card className="border-0 shadow-md">
                        <CardContent className="py-16 text-center">
                            <Users className="w-14 h-14 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-1">
                                {students.length === 0 ? 'No students enrolled' : 'No matching students'}
                            </h3>
                            <p className="text-gray-500 text-sm mb-6">
                                {students.length === 0
                                    ? 'Enroll students to get started.'
                                    : 'Try a different search term.'}
                            </p>
                            {students.length === 0 && (
                                <Button onClick={() => setEnrollModal(true)} className="gap-2 bg-[#862733] hover:bg-[#a03040]">
                                    <UserPlus className="w-4 h-4" /> Enroll Students
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="border-0 shadow-md overflow-hidden">
                        <DataTable
                            columns={columns}
                            data={filteredStudents}
                            emptyMessage="No students found"
                        />
                    </Card>
                )}
            </div>

            {/* Enroll Modals (reusable components) */}
            <EnrollStudentModal
                courseId={courseId}
                isOpen={enrollModal}
                onClose={() => setEnrollModal(false)}
                courseInfo={course ? { code: course.code, name: course.name } : undefined}
                invalidateKeys={[['course-students', courseId], ['course', courseId]]}
                onSuccess={(data) => {
                    if (data.student_not_found) {
                        showNotification('warning', data.message || 'Student is not in the system. Request sent to admin.');
                    } else {
                        showNotification('success', 'Student enrolled successfully!');
                    }
                }}
                onError={(err: any) => showNotification('error', err?.response?.data?.detail || 'Failed to enroll.')}
            />
            <BulkEnrollModal
                courseId={courseId}
                isOpen={bulkEnrollModal}
                onClose={() => setBulkEnrollModal(false)}
                courseInfo={course ? { code: course.code, name: course.name } : undefined}
                invalidateKeys={[['course-students', courseId], ['course', courseId]]}
                onSuccess={(data) => {
                    const hasNotFound = data.not_found && data.not_found.length > 0;
                    if (hasNotFound) {
                        showNotification('warning', `Enrolled ${data.enrolled || 0}. ${data.not_found?.length || 0} not in system.`);
                    } else {
                        showNotification('success', `Enrolled ${data.enrolled || 0} student(s).`);
                    }
                }}
                onError={(err: any) => showNotification('error', err?.response?.data?.detail || 'Bulk enrollment failed')}
            />

            {/* Make Student Inactive Confirmation Modal */}
            <ConfirmDeleteModal
                isOpen={!!inactiveTarget}
                onClose={() => setInactiveTarget(null)}
                onConfirm={() => inactiveTarget && makeInactiveMutation.mutate(inactiveTarget.id)}
                confirmationPhrase="Make inactive"
                itemName={inactiveTarget?.full_name}
                title="Make student inactive?"
                description={
                    inactiveTarget
                        ? `Are you sure you want to make "${inactiveTarget.full_name}" inactive for this course? They will no longer see assignments or be able to submit. Type "Make inactive" to confirm.`
                        : undefined
                }
                confirmLabel="Make Inactive"
                confirmHint='Type "Make inactive" below to confirm.'
                loadingLabel="Making inactive..."
                isLoading={makeInactiveMutation.isPending}
                variant="warning"
            />

            {/* Add Assistant Modal */}
            <Modal isOpen={assistantModal} onClose={() => setAssistantModal(false)} title="Add Grading Assistant" size="md">
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
                            onChange={e => setAssistantEmail(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && assistantEmail.includes('@')) {
                                    addAssistantMutation.mutate(assistantEmail);
                                }
                            }}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="outline" onClick={() => setAssistantModal(false)}>
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
        </>
    );
}
