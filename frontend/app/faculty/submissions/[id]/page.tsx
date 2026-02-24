'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Tabs, TabPanel } from '@/components/ui/tabs';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import {
    ArrowLeft,
    User,
    Calendar,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Play,
    Save,
    Download,
    FileCode,
    Terminal,
    MessageSquare
} from 'lucide-react';

interface TestResult {
    id: string;
    name: string;
    passed: boolean;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    executionTime: number;
    errorMessage?: string;
}

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
    code: string;
    language: string;
    feedback: string;
    execution_time: number;
    memory_used: number;
    test_results: TestResult[];
}

export default function SubmissionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const submissionId = params.id as string;

    const [feedback, setFeedback] = useState('');
    const [manualScore, setManualScore] = useState<number | null>(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [activeTab, setActiveTab] = useState('code');

    const { data: submission, isLoading } = useQuery({
        queryKey: ['submission', submissionId],
        queryFn: () => apiClient.getSubmission(parseInt(submissionId)),
    });

    // Mock data
    const mockSubmission: Submission = {
        id: submissionId,
        student_id: 'STU001',
        student_name: 'John Smith',
        student_email: 'john.smith@university.edu',
        assignment_id: '3',
        assignment_title: 'Control Flow Statements',
        course_code: 'CS101',
        submitted_at: '2026-01-27T14:30:00',
        status: 'graded',
        score: 85,
        max_score: 100,
        language: 'python',
        code: `def classify_number(n):
    """Classify a number as positive, negative, or zero."""
    if n > 0:
        return "positive"
    elif n < 0:
        return "negative"
    else:
        return "zero"

def fizzbuzz(n):
    """Generate FizzBuzz sequence from 1 to n."""
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
    return result

def calculate_grade(score):
    """Calculate letter grade from numeric score."""
    if score >= 90:
        return "A"
    elif score >= 80:
        return "B"
    elif score >= 70:
        return "C"
    elif score >= 60:
        return "D"
    else:
        return "F"`,
        feedback: 'Good work! Your implementation is clean and efficient. Consider adding more comments to explain your logic.',
        execution_time: 0.234,
        memory_used: 12.5,
        test_results: [
            { id: '1', name: 'Test classify_number positive', passed: true, input: '5', expectedOutput: 'positive', actualOutput: 'positive', executionTime: 0.012 },
            { id: '2', name: 'Test classify_number negative', passed: true, input: '-3', expectedOutput: 'negative', actualOutput: 'negative', executionTime: 0.008 },
            { id: '3', name: 'Test classify_number zero', passed: true, input: '0', expectedOutput: 'zero', actualOutput: 'zero', executionTime: 0.007 },
            { id: '4', name: 'Test fizzbuzz basic', passed: true, input: '15', expectedOutput: '["1","2","Fizz",...]', actualOutput: '["1","2","Fizz",...]', executionTime: 0.045 },
            { id: '5', name: 'Test fizzbuzz edge case', passed: false, input: '0', expectedOutput: '[]', actualOutput: 'Error: range cannot be zero', executionTime: 0.003, errorMessage: 'Edge case not handled' },
            { id: '6', name: 'Test grade A', passed: true, input: '95', expectedOutput: 'A', actualOutput: 'A', executionTime: 0.005 },
            { id: '7', name: 'Test grade boundaries', passed: true, input: '89', expectedOutput: 'B', actualOutput: 'B', executionTime: 0.004 },
            { id: '8', name: 'Test grade F', passed: true, input: '45', expectedOutput: 'F', actualOutput: 'F', executionTime: 0.004 },
        ],
    };

    const displaySubmission = submission || mockSubmission;
    const passedTests = displaySubmission.test_results.filter((t: TestResult) => t.passed).length;
    const totalTests = displaySubmission.test_results.length;

    const gradeMutation = useMutation({
        mutationFn: ({ score, feedback }: { score: number; feedback: string }) =>
            apiClient.gradeSubmission(parseInt(submissionId)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
            setSuccessMessage('Submission graded successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        },
    });

    const handleGrade = () => {
        const finalScore = manualScore ?? displaySubmission.score ?? Math.round((passedTests / totalTests) * displaySubmission.max_score);
        gradeMutation.mutate({
            score: finalScore,
            feedback: feedback || displaySubmission.feedback,
        });
    };

    const handleRerun = () => {
        // In real app, this would trigger re-execution of tests
        setSuccessMessage('Re-running tests...');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'graded':
                return <Badge variant="success">Graded</Badge>;
            case 'pending':
                return <Badge variant="warning">Pending</Badge>;
            case 'grading':
                return <Badge variant="info">Grading</Badge>;
            case 'error':
                return <Badge variant="danger">Error</Badge>;
            default:
                return <Badge variant="default">{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#862733]"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
                    {successMessage && (
                        <Alert type="success" title="Success">
                            {successMessage}
                        </Alert>
                    )}

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <Link href="/faculty/submissions">
                                <Button variant="ghost" size="sm">
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Submission Details</h1>
                                <div className="flex items-center gap-3 mt-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-[#862733] flex items-center justify-center text-white text-sm">
                                            {displaySubmission.student_name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium">{displaySubmission.student_name}</p>
                                            <p className="text-sm text-gray-500">{displaySubmission.student_email}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleRerun}>
                                <Play className="w-4 h-4 mr-2" />
                                Re-run Tests
                            </Button>
                            <Button variant="outline">
                                <Download className="w-4 h-4 mr-2" />
                                Download Code
                            </Button>
                        </div>
                    </div>

                    {/* Overview Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-sm text-gray-500">Assignment</p>
                                <p className="font-medium mt-1">{displaySubmission.assignment_title}</p>
                                <Badge variant="default" className="mt-1">{displaySubmission.course_code}</Badge>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-sm text-gray-500">Submitted</p>
                                <p className="font-medium mt-1">{format(new Date(displaySubmission.submitted_at), 'MMM d, h:mm a')}</p>
                                <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(displaySubmission.submitted_at), { addSuffix: true })}</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-sm text-gray-500">Tests Passed</p>
                                <p className={`text-2xl font-bold ${passedTests === totalTests ? 'text-green-600' : 'text-orange-600'}`}>
                                    {passedTests}/{totalTests}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-sm text-gray-500">Score</p>
                                <p className="text-2xl font-bold">
                                    {displaySubmission.score !== null ? `${displaySubmission.score}/${displaySubmission.max_score}` : '-'}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <p className="text-sm text-gray-500">Status</p>
                                <div className="mt-2">{getStatusBadge(displaySubmission.status)}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Code Panel */}
                        <div className="lg:col-span-2">
                            <Tabs
                                tabs={[
                                    { id: 'code', label: 'Code' },
                                    { id: 'tests', label: 'Test Results' }
                                ]}
                                activeTab={activeTab}
                                onTabChange={setActiveTab}
                            />

                            {activeTab === 'code' && (
                                <TabPanel>
                                    <Card>
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <CardTitle>Submitted Code</CardTitle>
                                                <Badge variant="default">{displaySubmission.language}</Badge>
                                            </div>
                                            <CardDescription>
                                                Execution time: {displaySubmission.execution_time}s | Memory: {displaySubmission.memory_used} MB
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-sm">
                                                <code>{displaySubmission.code}</code>
                                            </pre>
                                        </CardContent>
                                    </Card>
                                </TabPanel>
                            )}

                            {activeTab === 'tests' && (
                                <TabPanel>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Test Results</CardTitle>
                                            <CardDescription>
                                                {passedTests} of {totalTests} tests passed
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                {displaySubmission.test_results.map((test: TestResult, index: number) => (
                                                    <div
                                                        key={test.id}
                                                        className={`p-4 rounded-lg border ${test.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                {test.passed ? (
                                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                                ) : (
                                                                    <XCircle className="w-5 h-5 text-red-600" />
                                                                )}
                                                                <span className="font-medium">Test {index + 1}: {test.name}</span>
                                                            </div>
                                                            <span className="text-sm text-gray-500">{test.executionTime}s</span>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                                            <div>
                                                                <p className="text-gray-500 mb-1">Input</p>
                                                                <pre className="bg-white p-2 rounded">{test.input}</pre>
                                                            </div>
                                                            <div>
                                                                <p className="text-gray-500 mb-1">Expected</p>
                                                                <pre className="bg-white p-2 rounded">{test.expectedOutput}</pre>
                                                            </div>
                                                            <div>
                                                                <p className="text-gray-500 mb-1">Actual</p>
                                                                <pre className={`p-2 rounded ${test.passed ? 'bg-white' : 'bg-red-100'}`}>
                                                                    {test.actualOutput}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                        {test.errorMessage && (
                                                            <div className="mt-2 p-2 bg-red-100 rounded text-red-700 text-sm">
                                                                <AlertCircle className="w-4 h-4 inline mr-1" />
                                                                {test.errorMessage}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </TabPanel>
                            )}
                        </div>

                        {/* Grading Panel */}
                        <div>
                            <Card className="sticky top-20">
                                <CardHeader>
                                    <CardTitle>
                                        <MessageSquare className="w-5 h-5 inline mr-2" />
                                        Grading
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Auto-calculated Score */}
                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center justify-between text-sm mb-2">
                                            <span className="text-gray-600">Auto-calculated Score</span>
                                            <span className="font-bold">
                                                {Math.round((passedTests / totalTests) * displaySubmission.max_score)}/{displaySubmission.max_score}
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full ${passedTests === totalTests ? 'bg-green-500' : 'bg-orange-500'}`}
                                                style={{ width: `${(passedTests / totalTests) * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Manual Score Override */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Manual Score Override
                                        </label>
                                        <Input
                                            type="number"
                                            placeholder={`Enter score (0-${displaySubmission.max_score})`}
                                            value={manualScore ?? displaySubmission.score ?? ''}
                                            onChange={(e) => setManualScore(e.target.value ? parseInt(e.target.value) : null)}
                                            min={0}
                                            max={displaySubmission.max_score}
                                        />
                                    </div>

                                    {/* Feedback */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Feedback for Student
                                        </label>
                                        <textarea
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#862733] focus:border-transparent text-sm"
                                            rows={6}
                                            placeholder="Provide feedback to help the student improve..."
                                            value={feedback || displaySubmission.feedback}
                                            onChange={(e) => setFeedback(e.target.value)}
                                        />
                                    </div>

                                    {/* Quick Feedback Buttons */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Quick Feedback
                                        </label>
                                        <div className="flex flex-wrap gap-1">
                                            {['Good work!', 'Needs improvement', 'Edge cases missing', 'Clean code', 'Add comments'].map((text) => (
                                                <button
                                                    key={text}
                                                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                                                    onClick={() => setFeedback((prev) => prev ? `${prev} ${text}` : text)}
                                                >
                                                    {text}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Submit Button */}
                                    <Button
                                        className="w-full"
                                        onClick={handleGrade}
                                        disabled={gradeMutation.isPending}
                                    >
                                        <Save className="w-4 h-4 mr-2" />
                                        {gradeMutation.isPending ? 'Saving...' : 'Save Grade & Feedback'}
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
    );
}
