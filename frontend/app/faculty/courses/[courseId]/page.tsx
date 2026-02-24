'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { DataTable } from '@/components/ui/data-table';
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
    RefreshCw,
    ArrowLeft,
    Edit,
    UserPlus,
    Upload,
    Trash2,
    ChevronRight,
    GraduationCap,
    BarChart3,
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
    students_count: number;
    assignments_count: number;
    section?: string | null;
    instructor_id: number;
}

interface StudentInCourse {
    id: number;
    email: string;
    full_name: string;
    student_id?: string | null;
    enrolled_at: string;
    status: string;
}

interface Assignment {
    id: number;
    title: string;
    description?: string;
    difficulty?: string;
    due_date?: string;
    is_published: boolean;
    max_score: number;
    created_at: string;
}

const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const formatDateTime = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function CourseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const courseId = Number(params?.courseId);

    const [enrollModal, setEnrollModal] = useState(false);
    const [bulkEnrollModal, setBulkEnrollModal] = useState(false);
    const [enrollEmail, setEnrollEmail] = useState('');
    const [bulkEmails, setBulkEmails] = useState('');
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const showNotification = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    const { data: course, isLoading: courseLoading, error: courseError } = useQuery({
        queryKey: ['course', courseId],
        queryFn: () => apiClient.getCourse(courseId) as Promise<Course>,
        enabled: !!courseId,
    });

    const { data: students = [], isLoading: studentsLoading } = useQuery({
        queryKey: ['course-students', courseId],
        queryFn: () => apiClient.getCourseStudents(courseId) as Promise<StudentInCourse[]>,
        enabled: !!courseId,
    });

    const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
        queryKey: ['course-assignments', courseId],
        queryFn: () => apiClient.getCourseAssignments(courseId, true) as Promise<Assignment[]>,
        enabled: !!courseId,
    });

    const enrollMutation = useMutation({
        mutationFn: ({ email }: { email: string }) => apiClient.enrollStudentByEmail(courseId, email),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['course', courseId] });
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
            queryClient.invalidateQueries({ queryKey: ['course', courseId] });
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
            queryClient.invalidateQueries({ queryKey: ['course', courseId] });
            queryClient.invalidateQueries({ queryKey: ['course-students', courseId] });
            showNotification('success', 'Student removed from course.');
        },
        onError: (err: any) => showNotification('error', err.response?.data?.detail || 'Failed to unenroll student'),
    });

    const statusColor = course?.status === 'active'
        ? 'bg-green-100 text-green-800'
        : course?.status === 'draft'
            ? 'bg-amber-100 text-amber-800'
            : 'bg-gray-100 text-gray-800';

    const statusGradient = course?.status === 'active'
        ? 'from-emerald-500 to-teal-600'
        : course?.status === 'draft'
            ? 'from-amber-500 to-orange-600'
            : 'from-gray-400 to-gray-600';

    const recentAssignments = assignments.slice(0, 5);
    const activeStudents = students.filter(s => s.status === 'active');
    const publishedCount = assignments.filter((a: Assignment) => a.is_published).length;
    const upcomingAssignments = assignments.filter((a: Assignment) => a.due_date && new Date(a.due_date) > new Date());

    if (courseLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (courseError || !course) {
        return (
            <div className="text-center py-20">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load course</h2>
                <p className="text-gray-500 mb-6">{(courseError as any)?.message || 'Course not found.'}</p>
                <Button onClick={() => router.push('/faculty/courses')} className="gap-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Courses
                </Button>
            </div>
        );
    }

    const studentColumns = [
        {
            key: 'full_name',
            header: 'Name',
            cell: (s: StudentInCourse) => (
                <div>
                    <p className="font-medium text-gray-900">{s.full_name}</p>
                    <p className="text-xs text-gray-500">{s.email}</p>
                </div>
            ),
        },
        {
            key: 'student_id',
            header: 'Student ID',
            cell: (s: StudentInCourse) => <span className="text-sm text-gray-600">{s.student_id || '-'}</span>,
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
                    s.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
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
                        if (confirm(`Remove ${s.full_name} from this course?`)) {
                            unenrollMutation.mutate(s.id);
                        }
                    }}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Unenroll"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            ),
        },
    ];

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

                    {/* ─── Course Header Banner ─── */}
                    <div className={`bg-gradient-to-r ${statusGradient} rounded-2xl p-6 md:p-8 text-white relative overflow-hidden`}>
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/20" />
                            <div className="absolute -right-5 -bottom-5 w-28 h-28 rounded-full bg-white/10" />
                        </div>
                        <div className="relative z-10">
                            <button
                                onClick={() => router.push('/faculty/courses')}
                                className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-4 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Back to Courses
                            </button>

                            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                            <BookOpen className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-white/80 text-sm font-medium">{course.code}{course.section ? ` - Section ${course.section}` : ''}</p>
                                            <h1 className="text-2xl md:text-3xl font-bold">{course.name}</h1>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 mt-3">
                                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>
                                            {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
                                        </span>
                                        <span className="text-white/70 text-sm flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5" /> {course.semester} {course.year}
                                        </span>
                                        <span className="text-white/70 text-sm flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" /> Created {formatDate(course.created_at)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Link href={`/faculty/courses/${courseId}/assignments/new`}>
                                        <Button className="bg-white/20 hover:bg-white/30 text-white border-0 gap-2">
                                            <Plus className="w-4 h-4" /> New Assignment
                                        </Button>
                                    </Link>
                                </div>
                            </div>

                            {course.description && (
                                <p className="mt-4 text-white/80 text-sm max-w-2xl leading-relaxed">
                                    {course.description}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ─── Stat Cards ─── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{activeStudents.length}</p>
                                        <p className="text-xs text-gray-500">Enrolled Students</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
                                        <p className="text-xs text-gray-500">Total Assignments</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center">
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{publishedCount}</p>
                                        <p className="text-xs text-gray-500">Published</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">{upcomingAssignments.length}</p>
                                        <p className="text-xs text-gray-500">Upcoming Due</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ─── Recent Assignments ─── */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-primary" />
                                    Assignments
                                </CardTitle>
                                <Link href={`/faculty/courses/${courseId}/assignments`}>
                                    <Button className="gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 h-9 px-3 text-sm">
                                        View All <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {assignmentsLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                </div>
                            ) : recentAssignments.length === 0 ? (
                                <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm mb-4">No assignments yet</p>
                                    <Link href={`/faculty/courses/${courseId}/assignments/new`}>
                                        <Button className="gap-2 h-9 px-3 text-sm">
                                            <Plus className="w-4 h-4" /> Create First Assignment
                                        </Button>
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {recentAssignments.map((a: Assignment) => (
                                        <Link
                                            key={a.id}
                                            href={`/faculty/courses/${courseId}/assignments/${a.id}`}
                                            className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.is_published ? 'bg-green-500' : 'bg-amber-400'}`} />
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-900 text-sm truncate group-hover:text-primary transition-colors">
                                                        {a.title}
                                                    </p>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                                        <span>{a.is_published ? 'Published' : 'Draft'}</span>
                                                        {a.difficulty && <span className="capitalize">{a.difficulty}</span>}
                                                        <span>{a.max_score} pts</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                {a.due_date && (
                                                    <span className="text-xs text-gray-500 hidden sm:block">
                                                        Due {formatDate(a.due_date)}
                                                    </span>
                                                )}
                                                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary transition-colors" />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ─── Students List ─── */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <GraduationCap className="w-5 h-5 text-primary" />
                                    Enrolled Students ({activeStudents.length})
                                </CardTitle>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => setEnrollModal(true)}
                                        className="gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 h-9 px-3 text-sm"
                                    >
                                        <UserPlus className="w-4 h-4" /> Enroll
                                    </Button>
                                    <Button
                                        onClick={() => setBulkEnrollModal(true)}
                                        className="gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 h-9 px-3 text-sm"
                                    >
                                        <Upload className="w-4 h-4" /> Bulk
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {studentsLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                </div>
                            ) : activeStudents.length === 0 ? (
                                <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm mb-4">No students enrolled yet</p>
                                    <Button onClick={() => setEnrollModal(true)} className="gap-2 h-9 px-3 text-sm">
                                        <UserPlus className="w-4 h-4" /> Enroll Students
                                    </Button>
                                </div>
                            ) : (
                                <DataTable
                                    columns={studentColumns}
                                    data={activeStudents}
                                    emptyMessage="No students enrolled"
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ─── Enroll Modal ─── */}
                <Modal isOpen={enrollModal} onClose={() => setEnrollModal(false)} title="Enroll Student" size="md">
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Enrolling in: <span className="font-semibold text-gray-900">{course.code} - {course.name}</span></p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Student Email</label>
                        <Input
                            type="email"
                            placeholder="student@university.edu"
                            value={enrollEmail}
                            onChange={(e) => setEnrollEmail(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && enrollEmail.includes('@')) {
                                    enrollMutation.mutate({ email: enrollEmail });
                                }
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

                {/* ─── Bulk Enroll Modal ─── */}
                <Modal isOpen={bulkEnrollModal} onClose={() => setBulkEnrollModal(false)} title="Bulk Enroll Students" size="lg">
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">Enrolling in: <span className="font-semibold text-gray-900">{course.code} - {course.name}</span></p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Student Emails</label>
                        <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm resize-y"
                            rows={8}
                            placeholder={"student1@university.edu\nstudent2@university.edu\nstudent3@university.edu"}
                            value={bulkEmails}
                            onChange={(e) => setBulkEmails(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1.5">One email per line, or separated by commas.</p>
                    </div>
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                        {(() => {
                            const count = bulkEmails.split(/[\n,;]+/).filter(e => e.trim() && e.includes('@')).length;
                            return <span>{count} valid email{count !== 1 ? 's' : ''} detected</span>;
                        })()}
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
