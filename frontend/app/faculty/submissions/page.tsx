'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import {
    Search,
    FileCode,
    Calendar,
    Clock,
    User,
    CheckCircle,
    XCircle,
    AlertCircle,
    Eye,
    Filter,
    Download,
    RefreshCw
} from 'lucide-react';

interface Submission {
    id: string;
    student_id: string;
    student_name: string;
    student_email: string;
    assignment_id: string;
    assignment_title: string;
    course_code: string;
    submitted_at: string;
    status: 'pending' | 'grading' | 'graded' | 'error';
    score: number | null;
    max_score: number;
    tests_passed: number;
    total_tests: number;
    execution_time: number;
}

export default function FacultySubmissionsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterAssignment, setFilterAssignment] = useState<string>('all');

    const { data: submissions = [], isLoading, refetch } = useQuery({
        queryKey: ['faculty-submissions'],
        queryFn: () => apiClient.getSubmissions(),
    });

    // Mock data
    const mockSubmissions: Submission[] = [
        {
            id: '1',
            student_id: 'STU001',
            student_name: 'John Smith',
            student_email: 'john.smith@university.edu',
            assignment_id: '3',
            assignment_title: 'Control Flow Statements',
            course_code: 'CS101',
            submitted_at: '2026-01-27T14:30:00',
            status: 'pending',
            score: null,
            max_score: 100,
            tests_passed: 0,
            total_tests: 5,
            execution_time: 0,
        },
        {
            id: '2',
            student_id: 'STU002',
            student_name: 'Jane Doe',
            student_email: 'jane.doe@university.edu',
            assignment_id: '3',
            assignment_title: 'Control Flow Statements',
            course_code: 'CS101',
            submitted_at: '2026-01-27T13:45:00',
            status: 'graded',
            score: 92,
            max_score: 100,
            tests_passed: 5,
            total_tests: 5,
            execution_time: 0.234,
        },
        {
            id: '3',
            student_id: 'STU003',
            student_name: 'Bob Wilson',
            student_email: 'bob.wilson@university.edu',
            assignment_id: '3',
            assignment_title: 'Control Flow Statements',
            course_code: 'CS101',
            submitted_at: '2026-01-27T12:20:00',
            status: 'graded',
            score: 78,
            max_score: 100,
            tests_passed: 4,
            total_tests: 5,
            execution_time: 0.156,
        },
        {
            id: '4',
            student_id: 'STU004',
            student_name: 'Alice Brown',
            student_email: 'alice.brown@university.edu',
            assignment_id: '4',
            assignment_title: 'Linked List Implementation',
            course_code: 'CS201',
            submitted_at: '2026-01-27T11:00:00',
            status: 'grading',
            score: null,
            max_score: 150,
            tests_passed: 0,
            total_tests: 8,
            execution_time: 0,
        },
        {
            id: '5',
            student_id: 'STU005',
            student_name: 'Charlie Davis',
            student_email: 'charlie.davis@university.edu',
            assignment_id: '3',
            assignment_title: 'Control Flow Statements',
            course_code: 'CS101',
            submitted_at: '2026-01-27T10:15:00',
            status: 'error',
            score: null,
            max_score: 100,
            tests_passed: 0,
            total_tests: 5,
            execution_time: 0,
        },
        {
            id: '6',
            student_id: 'STU006',
            student_name: 'Eva Martinez',
            student_email: 'eva.martinez@university.edu',
            assignment_id: '2',
            assignment_title: 'Variables and Data Types',
            course_code: 'CS101',
            submitted_at: '2026-01-26T16:30:00',
            status: 'graded',
            score: 100,
            max_score: 100,
            tests_passed: 5,
            total_tests: 5,
            execution_time: 0.089,
        },
    ];

    const displaySubmissions = submissions.length > 0 ? submissions : mockSubmissions;

    const assignments: string[] = Array.from(new Set(displaySubmissions.map((s: Submission) => s.assignment_title)));

    const filteredSubmissions = displaySubmissions.filter((s: Submission) => {
        const matchesSearch = s.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.student_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.assignment_title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
        const matchesAssignment = filterAssignment === 'all' || s.assignment_title === filterAssignment;
        return matchesSearch && matchesStatus && matchesAssignment;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'graded':
                return <Badge variant="success">Graded</Badge>;
            case 'pending':
                return <Badge variant="warning">Pending</Badge>;
            case 'grading':
                return <Badge variant="info">Grading...</Badge>;
            case 'error':
                return <Badge variant="danger">Error</Badge>;
            default:
                return <Badge variant="default">{status}</Badge>;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'graded':
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'pending':
                return <Clock className="w-4 h-4 text-yellow-500" />;
            case 'grading':
                return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'error':
                return <XCircle className="w-4 h-4 text-red-500" />;
            default:
                return <AlertCircle className="w-4 h-4 text-gray-500" />;
        }
    };

    const columns = [
        {
            header: 'Student',
            key: 'student_name' as const,
            render: (submission: Submission) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#862733] flex items-center justify-center text-white text-sm font-medium">
                        {submission.student_name.charAt(0)}
                    </div>
                    <div>
                        <p className="font-medium text-gray-900">{submission.student_name}</p>
                        <p className="text-sm text-gray-500">{submission.student_email}</p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Assignment',
            key: 'assignment_title' as const,
            render: (submission: Submission) => (
                <div>
                    <p className="font-medium text-gray-900">{submission.assignment_title}</p>
                    <p className="text-sm text-gray-500">{submission.course_code}</p>
                </div>
            ),
        },
        {
            header: 'Submitted',
            key: 'submitted_at' as const,
            render: (submission: Submission) => (
                <div className="text-sm">
                    <p className="text-gray-900">{format(new Date(submission.submitted_at), 'MMM d, yyyy')}</p>
                    <p className="text-gray-500">{formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}</p>
                </div>
            ),
        },
        {
            header: 'Tests',
            key: 'tests_passed' as const,
            render: (submission: Submission) => (
                <div className="flex items-center gap-2">
                    {submission.status === 'graded' ? (
                        <>
                            <span className={`font-medium ${submission.tests_passed === submission.total_tests ? 'text-green-600' : 'text-orange-600'}`}>
                                {submission.tests_passed}/{submission.total_tests}
                            </span>
                            {submission.tests_passed === submission.total_tests && (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                        </>
                    ) : (
                        <span className="text-gray-400">-</span>
                    )}
                </div>
            ),
        },
        {
            header: 'Score',
            key: 'score' as const,
            render: (submission: Submission) => (
                <div>
                    {submission.score !== null ? (
                        <Badge variant={submission.score >= 80 ? 'success' : submission.score >= 60 ? 'warning' : 'danger'}>
                            {submission.score}/{submission.max_score}
                        </Badge>
                    ) : (
                        <span className="text-gray-400">-</span>
                    )}
                </div>
            ),
        },
        {
            header: 'Status',
            key: 'status' as const,
            render: (submission: Submission) => (
                <div className="flex items-center gap-2">
                    {getStatusIcon(submission.status)}
                    {getStatusBadge(submission.status)}
                </div>
            ),
        },
        {
            header: 'Actions',
            key: 'id' as const,
            render: (submission: Submission) => (
                <div className="flex items-center gap-1">
                    <Link href={`/faculty/submissions/${submission.id}`}>
                        <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                        </Button>
                    </Link>
                    {submission.status === 'pending' && (
                        <Link href={`/faculty/grading?submission=${submission.id}`}>
                            <Button variant="outline" size="sm">
                                Grade
                            </Button>
                        </Link>
                    )}
                </div>
            ),
        },
    ];

    const pendingCount = displaySubmissions.filter((s: Submission) => s.status === 'pending').length;
    const gradedCount = displaySubmissions.filter((s: Submission) => s.status === 'graded').length;
    const errorCount = displaySubmissions.filter((s: Submission) => s.status === 'error').length;

    return (
        <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
                            <p className="text-gray-500 mt-1">View and manage student submissions</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => refetch()}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh
                            </Button>
                            <Button variant="outline">
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <FileCode className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{displaySubmissions.length}</p>
                                        <p className="text-sm text-gray-500">Total Submissions</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-yellow-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{pendingCount}</p>
                                        <p className="text-sm text-gray-500">Pending Review</p>
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
                                        <p className="text-2xl font-bold">{gradedCount}</p>
                                        <p className="text-sm text-gray-500">Graded</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                        <XCircle className="w-5 h-5 text-red-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{errorCount}</p>
                                        <p className="text-sm text-gray-500">Errors</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        placeholder="Search by student or assignment..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <select
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#862733] focus:border-transparent"
                                    value={filterAssignment}
                                    onChange={(e) => setFilterAssignment(e.target.value)}
                                >
                                    <option value="all">All Assignments</option>
                                    {assignments.map((a: string) => (
                                        <option key={a} value={a}>{a}</option>
                                    ))}
                                </select>
                                <select
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#862733] focus:border-transparent"
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                >
                                    <option value="all">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="grading">Grading</option>
                                    <option value="graded">Graded</option>
                                    <option value="error">Error</option>
                                </select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Submissions Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Submissions</CardTitle>
                            <CardDescription>
                                {filteredSubmissions.length} submissions found
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <DataTable
                                columns={columns}
                                data={filteredSubmissions}
                                isLoading={isLoading}
                            />
                        </CardContent>
                    </Card>
                </div>
    );
}
