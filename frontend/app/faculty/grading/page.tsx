'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import Link from 'next/link';
import {
    Search,
    CheckCircle,
    Clock,
    User,
    FileCode,
    Play,
    Eye,
    MessageSquare,
    ChevronRight,
    Filter,
    Download,
    Zap
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
    status: 'pending' | 'graded';
    score: number | null;
    max_score: number;
    tests_passed: number;
    total_tests: number;
    code: string;
    feedback: string;
}

interface Assignment {
    id: string;
    title: string;
    course_code: string;
    pending_count: number;
    graded_count: number;
    total_count: number;
}

export default function FacultyGradingPage() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
    const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
    const [feedback, setFeedback] = useState('');
    const [manualScore, setManualScore] = useState<number | null>(null);
    const [successMessage, setSuccessMessage] = useState('');

    const { data: submissions = [], isLoading } = useQuery({
        queryKey: ['faculty-grading-submissions'],
        queryFn: () => apiClient.getSubmissions(),
    });

    // Mock data
    const mockAssignments: Assignment[] = [
        { id: '3', title: 'Control Flow Statements', course_code: 'CS101', pending_count: 12, graded_count: 26, total_count: 38 },
        { id: '4', title: 'Linked List Implementation', course_code: 'CS201', pending_count: 8, graded_count: 12, total_count: 20 },
        { id: '2', title: 'Variables and Data Types', course_code: 'CS101', pending_count: 3, graded_count: 40, total_count: 43 },
    ];

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
            tests_passed: 4,
            total_tests: 5,
            code: `def check_number(n):
    if n > 0:
        return "positive"
    elif n < 0:
        return "negative"
    else:
        return "zero"

def fizzbuzz(n):
    result = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            result.append("FizzBuzz")
        elif i % 3 == 0:
            result.append("Fizz")
        elif i % 5 == 0:
            result.append("Buzz")
        else:
            result.append(str(i))
    return result`,
            feedback: '',
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
            status: 'pending',
            score: null,
            max_score: 100,
            tests_passed: 2,
            total_tests: 5,
            code: `def check_number(n):
    if n > 0:
        return "positive"
    else:
        return "negative"  # Missing zero case

def fizzbuzz(n):
    result = []
    for i in range(1, n):  # Bug: should be n + 1
        if i % 3 == 0:
            result.append("Fizz")
        elif i % 5 == 0:
            result.append("Buzz")
        else:
            result.append(str(i))
    return result`,
            feedback: '',
        },
    ];

    const displaySubmissions = submissions.length > 0 ? submissions : mockSubmissions;

    const filteredSubmissions = displaySubmissions.filter((s: Submission) => {
        const matchesSearch = s.student_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesAssignment = !selectedAssignment || s.assignment_id === selectedAssignment;
        return matchesSearch && matchesAssignment && s.status === 'pending';
    });

    const gradeMutation = useMutation({
        mutationFn: async ({ submissionId, score, feedback }: { submissionId: string; score: number; feedback: string }) => {
            // Mock grading - in real app would call API with score and feedback
            await apiClient.gradeSubmission(parseInt(submissionId) || 0);
            return { success: true };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['faculty-grading-submissions'] });
            setSelectedSubmission(null);
            setFeedback('');
            setManualScore(null);
            setSuccessMessage('Submission graded successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        },
    });

    const handleGrade = () => {
        if (!selectedSubmission) return;

        const calculatedScore = manualScore !== null
            ? manualScore
            : Math.round((selectedSubmission.tests_passed / selectedSubmission.total_tests) * selectedSubmission.max_score);

        gradeMutation.mutate({
            submissionId: selectedSubmission.id,
            score: calculatedScore,
            feedback,
        });
    };

    const handleAutoGradeAll = () => {
        // In real app, this would trigger batch auto-grading
        setSuccessMessage('Auto-grading started for all pending submissions');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const totalPending = mockAssignments.reduce((acc, a) => acc + a.pending_count, 0);

    return (
        <div className="space-y-6">
                    {successMessage && (
                        <Alert type="success" title="Success">
                            {successMessage}
                        </Alert>
                    )}

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Grading Center</h1>
                            <p className="text-gray-500 mt-1">Review and grade student submissions</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleAutoGradeAll}>
                                <Zap className="w-4 h-4 mr-2" />
                                Auto-Grade All
                            </Button>
                            <Button variant="outline">
                                <Download className="w-4 h-4 mr-2" />
                                Export Grades
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-orange-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{totalPending}</p>
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
                                        <p className="text-2xl font-bold">
                                            {mockAssignments.reduce((acc, a) => acc + a.graded_count, 0)}
                                        </p>
                                        <p className="text-sm text-gray-500">Graded Today</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <FileCode className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold">{mockAssignments.length}</p>
                                        <p className="text-sm text-gray-500">Active Assignments</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Panel - Assignment List */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Assignments</CardTitle>
                                    <CardDescription>Select an assignment to grade</CardDescription>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y">
                                        {mockAssignments.map((assignment) => (
                                            <button
                                                key={assignment.id}
                                                className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${selectedAssignment === assignment.id ? 'bg-[#862733]/5 border-l-4 border-[#862733]' : ''
                                                    }`}
                                                onClick={() => setSelectedAssignment(
                                                    selectedAssignment === assignment.id ? null : assignment.id
                                                )}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium text-gray-900">{assignment.title}</p>
                                                        <p className="text-sm text-gray-500">{assignment.course_code}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {assignment.pending_count > 0 && (
                                                            <Badge variant="warning">{assignment.pending_count}</Badge>
                                                        )}
                                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Middle Panel - Submission List */}
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Pending Submissions</CardTitle>
                                    <div className="relative mt-2">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <Input
                                            placeholder="Search students..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {filteredSubmissions.length === 0 ? (
                                        <div className="p-8 text-center text-gray-500">
                                            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                                            <p className="font-medium">All caught up!</p>
                                            <p className="text-sm">No pending submissions to grade</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y max-h-96 overflow-y-auto">
                                            {filteredSubmissions.map((submission: Submission) => (
                                                <button
                                                    key={submission.id}
                                                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${selectedSubmission?.id === submission.id ? 'bg-[#862733]/5' : ''
                                                        }`}
                                                    onClick={() => {
                                                        setSelectedSubmission(submission);
                                                        setFeedback(submission.feedback);
                                                        setManualScore(null);
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-[#862733] flex items-center justify-center text-white text-sm">
                                                            {submission.student_name.charAt(0)}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-medium text-gray-900">{submission.student_name}</p>
                                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                                <span>{submission.tests_passed}/{submission.total_tests} tests</span>
                                                                <span>•</span>
                                                                <span>{new Date(submission.submitted_at).toLocaleTimeString()}</span>
                                                            </div>
                                                        </div>
                                                        {submission.tests_passed === submission.total_tests ? (
                                                            <CheckCircle className="w-5 h-5 text-green-500" />
                                                        ) : (
                                                            <Badge variant="warning">
                                                                {Math.round((submission.tests_passed / submission.total_tests) * 100)}%
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Right Panel - Grading Interface */}
                        <div className="lg:col-span-1">
                            {selectedSubmission ? (
                                <Card className="sticky top-20">
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle>Grade Submission</CardTitle>
                                            <Link href={`/faculty/submissions/${selectedSubmission.id}`}>
                                                <Button variant="ghost" size="sm">
                                                    <Eye className="w-4 h-4 mr-1" />
                                                    Full View
                                                </Button>
                                            </Link>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <User className="w-4 h-4" />
                                            {selectedSubmission.student_name}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {/* Test Results */}
                                        <div className="p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium">Test Results</span>
                                                <span className={`text-sm font-bold ${selectedSubmission.tests_passed === selectedSubmission.total_tests
                                                    ? 'text-green-600'
                                                    : 'text-orange-600'
                                                    }`}>
                                                    {selectedSubmission.tests_passed}/{selectedSubmission.total_tests} passed
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full ${selectedSubmission.tests_passed === selectedSubmission.total_tests
                                                        ? 'bg-green-500'
                                                        : 'bg-orange-500'
                                                        }`}
                                                    style={{ width: `${(selectedSubmission.tests_passed / selectedSubmission.total_tests) * 100}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Code Preview */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Code Preview
                                            </label>
                                            <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-x-auto max-h-48">
                                                {selectedSubmission.code}
                                            </pre>
                                        </div>

                                        {/* Score */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Score (Auto: {Math.round((selectedSubmission.tests_passed / selectedSubmission.total_tests) * selectedSubmission.max_score)}/{selectedSubmission.max_score})
                                            </label>
                                            <Input
                                                type="number"
                                                placeholder="Override score (optional)"
                                                value={manualScore ?? ''}
                                                onChange={(e) => setManualScore(e.target.value ? parseInt(e.target.value) : null)}
                                                min={0}
                                                max={selectedSubmission.max_score}
                                            />
                                        </div>

                                        {/* Feedback */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Feedback
                                            </label>
                                            <textarea
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#862733] focus:border-transparent text-sm"
                                                rows={4}
                                                placeholder="Add feedback for the student..."
                                                value={feedback}
                                                onChange={(e) => setFeedback(e.target.value)}
                                            />
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <Button
                                                className="flex-1"
                                                onClick={handleGrade}
                                                disabled={gradeMutation.isPending}
                                            >
                                                <CheckCircle className="w-4 h-4 mr-2" />
                                                {gradeMutation.isPending ? 'Grading...' : 'Submit Grade'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card>
                                    <CardContent className="p-8 text-center text-gray-500">
                                        <FileCode className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                        <p className="font-medium">Select a submission</p>
                                        <p className="text-sm">Choose a submission from the list to start grading</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
    );
}
