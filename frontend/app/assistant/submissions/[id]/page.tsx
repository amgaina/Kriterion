'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { ArrowLeft, Save, User } from 'lucide-react';
import { format } from 'date-fns';

export default function AssistantSubmissionDetailPage() {
    const params = useParams();
    const queryClient = useQueryClient();
    const id = parseInt(params.id as string, 10);

    const [feedback, setFeedback] = useState('');
    const [manualScore, setManualScore] = useState<number | null>(null);
    const [successMessage, setSuccessMessage] = useState('');

    const { data: submission, isLoading } = useQuery({
        queryKey: ['submission', id],
        queryFn: () => apiClient.getSubmission(id),
    });

    const gradeMutation = useMutation({
        mutationFn: async () => {
            await apiClient.saveManualGrade(id, {
                final_score: manualScore ?? submission?.final_score ?? submission?.raw_score ?? 0,
                feedback,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submission', id] });
            queryClient.invalidateQueries({ queryKey: ['assistant-grading-submissions'] });
            setSuccessMessage('Grade saved successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        },
    });

    const handleGrade = () => gradeMutation.mutate();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!submission) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">Submission not found</p>
                <Link href="/assistant/dashboard">
                    <Button className="mt-4">Back to Dashboard</Button>
                </Link>
            </div>
        );
    }

    const studentName = submission.student?.full_name || (submission as any).student_name || 'Student';
    const assignmentTitle = submission.assignment?.title || (submission as any).assignment_title || 'Assignment';
    const courseCode = submission.assignment?.course?.code || (submission as any).course_code || '';
    const testResults = (submission as any).test_results || [];
    const passedTests = testResults.filter((t: any) => t.passed).length;
    const totalTests = testResults.length;
    const currentScore = submission.final_score ?? submission.raw_score ?? (totalTests > 0 ? Math.round((passedTests / totalTests) * (submission.max_score || 100)) : null);

    return (
        <div className="space-y-6">
            {successMessage && (
                <Alert type="success" title="Success">
                    {successMessage}
                </Alert>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <Link href="/assistant/dashboard">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm">
                                <User className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="font-medium">{studentName}</p>
                                <p className="text-sm text-gray-500">{assignmentTitle} · {courseCode}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-sm text-gray-500">Submitted</p>
                        <p className="font-medium mt-1">{format(new Date(submission.submitted_at), 'MMM d, h:mm a')}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-sm text-gray-500">Tests</p>
                        <p className="font-medium mt-1">{passedTests}/{totalTests}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <p className="text-sm text-gray-500">Status</p>
                        <p className="font-medium mt-1">{submission.status}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Submission</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto max-h-96">
                            {submission.code || '(No code - check files)'}
                        </pre>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Grade</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Score</label>
                            <Input
                                type="number"
                                min={0}
                                max={submission.max_score ?? 100}
                                value={manualScore ?? currentScore ?? ''}
                                onChange={(e) => setManualScore(e.target.value ? parseFloat(e.target.value) : null)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Feedback</label>
                            <textarea
                                className="w-full min-h-[120px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                value={feedback || submission.feedback || ''}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Add feedback..."
                            />
                        </div>
                        <Button
                            className="w-full"
                            onClick={handleGrade}
                            disabled={gradeMutation.isPending}
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {gradeMutation.isPending ? 'Saving...' : 'Save Grade'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
