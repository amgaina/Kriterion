'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { DataTable } from '@/components/ui/data-table';
import {
    Users,
    UserPlus,
    Upload,
    Search,
    Loader2,
    ArrowLeft,
    Trash2,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    GraduationCap,
} from 'lucide-react';

interface StudentInCourse {
    id: number;
    email: string;
    full_name: string;
    student_id?: string | null;
    enrolled_at: string;
    status: string;
}

const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function CourseStudentsPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const courseId = Number(params?.courseId);

    const [searchQuery, setSearchQuery] = useState('');
    const [enrollModal, setEnrollModal] = useState(false);
    const [bulkEnrollModal, setBulkEnrollModal] = useState(false);
    const [enrollEmail, setEnrollEmail] = useState('');
    const [bulkEmails, setBulkEmails] = useState('');
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 4000);
    };

    const { data: students = [], isLoading, isFetching, refetch } = useQuery({
        queryKey: ['course-students', courseId],
        queryFn: () => apiClient.getCourseStudents(courseId) as Promise<StudentInCourse[]>,
        enabled: !!courseId,
    });

    const enrollMutation = useMutation({
        mutationFn: ({ email }: { email: string }) => apiClient.enrollStudentByEmail(courseId, email),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-students', courseId] });
            setEnrollModal(false);
            setEnrollEmail('');
            showNotification('success', 'Student enrolled successfully!');
        },
        onError: (err: any) => showNotification('error', err.response?.data?.detail || 'Failed to enroll student'),
    });

    const bulkEnrollMutation = useMutation({
        mutationFn: ({ emails }: { emails: string[] }) => apiClient.bulkEnrollStudents(courseId, emails),
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['course-students', courseId] });
            setBulkEnrollModal(false);
            setBulkEmails('');
            showNotification('success', `Enrolled ${data.enrolled} student(s).${data.failed > 0 ? ` ${data.failed} failed.` : ''}`);
        },
        onError: (err: any) => showNotification('error', err.response?.data?.detail || 'Bulk enrollment failed'),
    });

    const unenrollMutation = useMutation({
        mutationFn: (studentId: number) => apiClient.unenrollStudent(courseId, studentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course-students', courseId] });
            showNotification('success', 'Student removed from course.');
        },
        onError: (err: any) => showNotification('error', err.response?.data?.detail || 'Failed to unenroll student'),
    });

    const activeStudents = useMemo(() => students.filter(s => s.status === 'active'), [students]);
    const droppedStudents = useMemo(() => students.filter(s => s.status !== 'active'), [students]);

    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return activeStudents;
        const q = searchQuery.toLowerCase();
        return activeStudents.filter(s =>
            s.full_name.toLowerCase().includes(q) ||
            s.email.toLowerCase().includes(q) ||
            s.student_id?.toLowerCase().includes(q)
        );
    }, [activeStudents, searchQuery]);

    const columns = [
        {
            key: 'full_name',
            header: 'Student',
            cell: (s: StudentInCourse) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {s.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">{s.full_name}</p>
                        <p className="text-xs text-gray-500">{s.email}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'student_id',
            header: 'Student ID',
            cell: (s: StudentInCourse) => <span className="text-sm text-gray-600 font-mono">{s.student_id || '-'}</span>,
        },
        {
            key: 'enrolled_at',
            header: 'Enrolled',
            cell: (s: StudentInCourse) => <span className="text-sm text-gray-600">{formatDate(s.enrolled_at)}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            cell: (s: StudentInCourse) => (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                    {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                </span>
            ),
        },
        {
            key: 'actions',
            header: '',
            className: 'w-16',
            cell: (s: StudentInCourse) => (
                <button
                    onClick={() => {
                        if (confirm(`Remove ${s.full_name} from this course?`)) unenrollMutation.mutate(s.id);
                    }}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Unenroll"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            ),
        },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
        <div className="space-y-6 pb-8">
                    {/* Notification */}
                    {notification && (
                        <div className={`rounded-lg border p-4 flex items-start gap-3 ${
                            notification.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                        }`}>
                            {notification.type === 'success' ? (
                                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                            )}
                            <p className="text-sm flex-1">{notification.message}</p>
                            <button onClick={() => setNotification(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                        </div>
                    )}

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <button
                                onClick={() => router.push(`/faculty/courses/${courseId}`)}
                                className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm mb-2 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back to Course
                            </button>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <GraduationCap className="w-6 h-6 text-primary" />
                                </div>
                                Students
                            </h1>
                            <p className="text-gray-500 mt-1">
                                {activeStudents.length} active{droppedStudents.length > 0 ? ` · ${droppedStudents.length} dropped` : ''}
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
                            <Button onClick={() => setEnrollModal(true)} className="gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 h-9 px-3">
                                <UserPlus className="w-4 h-4" /> Enroll
                            </Button>
                            <Button onClick={() => setBulkEnrollModal(true)} className="gap-2 h-9">
                                <Upload className="w-4 h-4" /> Bulk Enroll
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{students.length}</p>
                                        <p className="text-xs text-gray-500">Total</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-green-600">{activeStudents.length}</p>
                                        <p className="text-xs text-gray-500">Active</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                                        <AlertCircle className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-600">{droppedStudents.length}</p>
                                        <p className="text-xs text-gray-500">Dropped</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Search */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <Input
                                    placeholder="Search by name, email, or student ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            {searchQuery && (
                                <p className="mt-2 text-sm text-gray-500">
                                    {filteredStudents.length} of {activeStudents.length} students
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Student Table */}
                    {filteredStudents.length === 0 ? (
                        <Card>
                            <CardContent className="py-16 text-center">
                                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-1">
                                    {activeStudents.length === 0 ? 'No students enrolled' : 'No matching students'}
                                </h3>
                                <p className="text-gray-500 text-sm mb-6">
                                    {activeStudents.length === 0
                                        ? 'Enroll students to get started.'
                                        : 'Try a different search term.'}
                                </p>
                                {activeStudents.length === 0 && (
                                    <Button onClick={() => setEnrollModal(true)} className="gap-2">
                                        <UserPlus className="w-4 h-4" /> Enroll Students
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <DataTable columns={columns} data={filteredStudents} emptyMessage="No students found" />
                        </Card>
                    )}
                </div>

                {/* Enroll Modal */}
                <Modal isOpen={enrollModal} onClose={() => setEnrollModal(false)} title="Enroll Student" size="md">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Student Email</label>
                        <Input
                            type="email"
                            placeholder="student@university.edu"
                            value={enrollEmail}
                            onChange={(e) => setEnrollEmail(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && enrollEmail.includes('@')) enrollMutation.mutate({ email: enrollEmail });
                            }}
                        />
                        <p className="text-xs text-gray-500 mt-1.5">The student must already have an account.</p>
                    </div>
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                        <Button onClick={() => setEnrollModal(false)} className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Cancel</Button>
                        <Button
                            onClick={() => enrollMutation.mutate({ email: enrollEmail })}
                            disabled={!enrollEmail.includes('@') || enrollMutation.isPending}
                        >
                            {enrollMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Enrolling...</> : <><UserPlus className="w-4 h-4 mr-2" /> Enroll</>}
                        </Button>
                    </div>
                </Modal>

                {/* Bulk Enroll Modal */}
                <Modal isOpen={bulkEnrollModal} onClose={() => setBulkEnrollModal(false)} title="Bulk Enroll Students" size="lg">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Student Emails</label>
                        <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm resize-y"
                            rows={8}
                            placeholder={"student1@university.edu\nstudent2@university.edu"}
                            value={bulkEmails}
                            onChange={(e) => setBulkEmails(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1.5">One email per line, or separated by commas.</p>
                    </div>
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                        {bulkEmails.split(/[\n,;]+/).filter(e => e.trim() && e.includes('@')).length} valid email(s) detected
                    </div>
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                        <Button onClick={() => setBulkEnrollModal(false)} className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Cancel</Button>
                        <Button
                            onClick={() => {
                                const emails = bulkEmails.split(/[\n,;]+/).map(e => e.trim().toLowerCase()).filter(e => e && e.includes('@'));
                                if (emails.length > 0) bulkEnrollMutation.mutate({ emails });
                            }}
                            disabled={bulkEnrollMutation.isPending || !bulkEmails.split(/[\n,;]+/).some(e => e.trim() && e.includes('@'))}
                        >
                            {bulkEnrollMutation.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Enrolling...</> : <><Upload className="w-4 h-4 mr-2" /> Bulk Enroll</>}
                        </Button>
                    </div>
                </Modal>
        </>
    );
}
