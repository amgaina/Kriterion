'use client';

import { useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { format, isPast } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
    FileCode,
    Clock,
    CheckCircle2,
    XCircle,
    Calendar,
    Play,
    Send,
    ArrowLeft,
    Upload,
    X,
    Folder,
    File,
    AlertCircle,
    Loader2,
    Award,
    Target,
    Zap,
    CheckCircle,
    AlertTriangle,
    Info
} from 'lucide-react';

interface TestResult {
    id: number;
    name: string;
    passed: boolean;
    score: number;
    max_score: number;
    output?: string;
    error?: string;
}

interface UploadedFile {
    name: string;
    content: string;
    size: number;
}

export default function AssignmentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const assignmentId = Number(params.id);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [output, setOutput] = useState<string>('');
    const [testResults, setTestResults] = useState<TestResult[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    // Fetch assignment details
    const { data: assignment, isLoading: assignmentLoading } = useQuery({
        queryKey: ['assignment', assignmentId],
        queryFn: () => apiClient.getAssignment(assignmentId),
    });

    // Fetch student's submissions for this assignment
    const { data: submissions = [] } = useQuery({
        queryKey: ['submissions', assignmentId],
        queryFn: () => apiClient.getSubmissions(assignmentId),
    });

    const latestSubmission = submissions.length > 0 ? submissions[0] : null;

    // Handle file upload
    const handleFileUpload = useCallback((files: FileList | null) => {
        if (!files) return;

        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                const newFile: UploadedFile = {
                    name: file.name,
                    content,
                    size: file.size,
                };
                setUploadedFiles((prev) => {
                    const exists = prev.find((f) => f.name === file.name);
                    if (exists) {
                        return prev.map((f) => (f.name === file.name ? newFile : f));
                    }
                    return [...prev, newFile];
                });
                if (!selectedFile) {
                    setSelectedFile(newFile);
                }
            };
            reader.readAsText(file);
        });
    }, [selectedFile]);

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileUpload(e.dataTransfer.files);
    }, [handleFileUpload]);

    // Remove file
    const removeFile = useCallback((fileName: string) => {
        setUploadedFiles((prev) => prev.filter((f) => f.name !== fileName));
        if (selectedFile?.name === fileName) {
            setSelectedFile(uploadedFiles.length > 1 ? uploadedFiles[0] : null);
        }
    }, [selectedFile, uploadedFiles]);

    // Run code
    const handleRunCode = async () => {
        if (uploadedFiles.length === 0) {
            setOutput('⚠️ Please upload at least one file to run.');
            return;
        }

        setIsRunning(true);
        setOutput('🔄 Running your code...\n');
        setTestResults([]);

        try {
            // Simulate running code and tests
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const mockTestResults: TestResult[] = [
                {
                    id: 1,
                    name: 'Test Basic Functionality',
                    passed: true,
                    score: 10,
                    max_score: 10,
                    output: 'All assertions passed ✓',
                },
                {
                    id: 2,
                    name: 'Test Edge Cases',
                    passed: true,
                    score: 15,
                    max_score: 15,
                    output: 'Empty list, single element, large numbers - all passed ✓',
                },
                {
                    id: 3,
                    name: 'Test Performance',
                    passed: false,
                    score: 5,
                    max_score: 10,
                    error: 'Execution time exceeded: 2.5s > 2.0s limit',
                },
                {
                    id: 4,
                    name: 'Test Error Handling',
                    passed: true,
                    score: 10,
                    max_score: 10,
                    output: 'Proper exception handling verified ✓',
                },
            ];

            setTestResults(mockTestResults);
            setOutput(
                '✅ Code executed successfully!\n\n' +
                '📊 Test Results:\n' +
                mockTestResults
                    .map(
                        (t) =>
                            `${t.passed ? '✓' : '✗'} ${t.name}: ${t.score}/${t.max_score} points`
                    )
                    .join('\n') +
                '\n\n💡 Check the test panel on the right for detailed results.'
            );
        } catch (error: any) {
            setOutput(`❌ Error: ${error.message}`);
        } finally {
            setIsRunning(false);
        }
    };

    // Submit assignment
    const handleSubmit = async () => {
        if (uploadedFiles.length === 0) {
            alert('Please upload at least one file before submitting.');
            return;
        }

        if (!confirm('Are you sure you want to submit this assignment? This will count as an attempt.')) {
            return;
        }

        setIsSubmitting(true);
        try {
            // Convert files to File objects for upload
            const fileObjects = uploadedFiles.map((f) => {
                const blob = new Blob([f.content], { type: 'text/plain' });
                return new window.File([blob], f.name, { type: 'text/plain' });
            });

            await apiClient.createSubmission(assignmentId, fileObjects);
            
            setOutput('✅ Assignment submitted successfully!\n\n📝 Your submission is being graded...');
            queryClient.invalidateQueries({ queryKey: ['submissions', assignmentId] });
            
            // Redirect after a delay
            setTimeout(() => {
                router.push('/student/courses');
            }, 2000);
        } catch (error: any) {
            setOutput(`❌ Submission failed: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Calculate test statistics
    const testStats = {
        total: testResults.length,
        passed: testResults.filter((t) => t.passed).length,
        failed: testResults.filter((t) => !t.passed).length,
        score: testResults.reduce((sum, t) => sum + t.score, 0),
        maxScore: testResults.reduce((sum, t) => sum + t.max_score, 0),
    };

    if (assignmentLoading) {
        return (
            <ProtectedRoute allowedRoles={['STUDENT']}>
                <DashboardLayout>
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center">
                            <Loader2 className="w-12 h-12 animate-spin text-[#862733] mx-auto mb-4" />
                            <p className="text-gray-500">Loading assignment...</p>
                        </div>
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    if (!assignment) {
        return (
            <ProtectedRoute allowedRoles={['STUDENT']}>
                <DashboardLayout>
                    <div className="text-center py-12">
                        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Assignment Not Found</h2>
                        <Button onClick={() => router.back()} className="mt-4">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Go Back
                        </Button>
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    const isOverdue = isPast(new Date(assignment.due_date));
    const hasSubmission = latestSubmission !== null;

    return (
        <ProtectedRoute allowedRoles={['STUDENT']}>
            <DashboardLayout>
                <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.back()}
                                className="gap-2"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
                                <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        Due: {format(new Date(assignment.due_date), 'MMM dd, yyyy HH:mm')}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Award className="w-4 h-4" />
                                        {assignment.max_score} points
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className={
                                            assignment.difficulty === 'easy'
                                                ? 'bg-green-100 text-green-700 border-green-200'
                                                : assignment.difficulty === 'hard'
                                                ? 'bg-red-100 text-red-700 border-red-200'
                                                : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                        }
                                    >
                                        {assignment.difficulty}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleRunCode}
                                disabled={isRunning || uploadedFiles.length === 0}
                                className="gap-2 bg-blue-600 hover:bg-blue-700"
                            >
                                {isRunning ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Running...
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4" />
                                        Run Code
                                    </>
                                )}
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || uploadedFiles.length === 0}
                                className="gap-2 bg-[#862733] hover:bg-[#6d1f29]"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Submit Assignment
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Alerts */}
                    {isOverdue && !hasSubmission && (
                        <Alert type="error" className="border-red-200 bg-red-50">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <div className="ml-2">
                                <p className="font-medium text-red-900">This assignment is overdue!</p>
                                <p className="text-sm text-red-700">
                                    Late submissions may incur a penalty of {assignment.late_penalty_per_day}% per day.
                                </p>
                            </div>
                        </Alert>
                    )}

                    {hasSubmission && (
                        <Alert type="success" className="border-green-200 bg-green-50">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <div className="ml-2">
                                <p className="font-medium text-green-900">
                                    You have already submitted this assignment
                                </p>
                                <p className="text-sm text-green-700">
                                    Score: {latestSubmission.final_score}/{assignment.max_score} | Tests Passed:{' '}
                                    {latestSubmission.tests_passed}/{latestSubmission.tests_total}
                                </p>
                            </div>
                        </Alert>
                    )}

                    {/* Main VSCode-like Layout */}
                    <div className="grid grid-cols-12 gap-4" style={{ height: 'calc(100vh - 280px)' }}>
                        {/* Left Sidebar - File Explorer */}
                        <Card className="col-span-12 lg:col-span-3 overflow-hidden flex flex-col">
                            <CardHeader className="pb-3 border-b bg-gray-50">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Folder className="w-4 h-4" />
                                    Files
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 p-0 overflow-y-auto">
                                {/* Drag & Drop Zone */}
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={`m-3 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                                        isDragging
                                            ? 'border-[#862733] bg-[#862733]/5'
                                            : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                >
                                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                    <p className="text-sm text-gray-600 mb-2">
                                        Drag & drop files here
                                    </p>
                                    <p className="text-xs text-gray-500 mb-3">or</p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        onChange={(e) => handleFileUpload(e.target.files)}
                                        className="hidden"
                                        accept=".py,.java,.js,.ts,.cpp,.c,.h,.hpp"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="gap-2"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Browse Files
                                    </Button>
                                </div>

                                {/* File List */}
                                <div className="px-3 pb-3">
                                    {uploadedFiles.length > 0 ? (
                                        <div className="space-y-1">
                                            {uploadedFiles.map((file) => (
                                                <div
                                                    key={file.name}
                                                    onClick={() => setSelectedFile(file)}
                                                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                                                        selectedFile?.name === file.name
                                                            ? 'bg-[#862733] text-white'
                                                            : 'hover:bg-gray-100'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <FileCode className="w-4 h-4 flex-shrink-0" />
                                                        <span className="text-sm font-medium truncate">
                                                            {file.name}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeFile(file.name);
                                                        }}
                                                        className={`ml-2 p-1 rounded hover:bg-red-100 ${
                                                            selectedFile?.name === file.name
                                                                ? 'hover:bg-red-600'
                                                                : ''
                                                        }`}
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500 text-sm">
                                            No files uploaded yet
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Middle - Code Editor */}
                        <Card className="col-span-12 lg:col-span-6 overflow-hidden flex flex-col">
                            <CardHeader className="pb-3 border-b bg-gray-50">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                        <FileCode className="w-4 h-4" />
                                        {selectedFile ? selectedFile.name : 'Code Editor'}
                                    </CardTitle>
                                    {selectedFile && (
                                        <Badge variant="default" className="text-xs">
                                            {(selectedFile.size / 1024).toFixed(2)} KB
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
                                {selectedFile ? (
                                    <div className="flex-1 overflow-auto">
                                        <pre className="p-4 text-sm font-mono bg-gray-50 h-full overflow-auto">
                                            <code>{selectedFile.content}</code>
                                        </pre>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-gray-500">
                                        <div className="text-center">
                                            <FileCode className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                                            <p>Select a file to view its contents</p>
                                            <p className="text-sm text-gray-400 mt-1">
                                                Upload files from the left panel
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Output Section */}
                                {output && (
                                    <div className="border-t bg-gray-900 text-gray-100">
                                        <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                                            <span className="text-xs font-medium flex items-center gap-2">
                                                <Zap className="w-3 h-3" />
                                                Output
                                            </span>
                                            <button
                                                onClick={() => setOutput('')}
                                                className="text-gray-400 hover:text-white"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <pre className="p-4 text-xs font-mono overflow-auto max-h-48">
                                            {output}
                                        </pre>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Right Sidebar - Test Results */}
                        <Card className="col-span-12 lg:col-span-3 overflow-hidden flex flex-col">
                            <CardHeader className="pb-3 border-b bg-gray-50">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Target className="w-4 h-4" />
                                    Test Results
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 p-4 overflow-y-auto">
                                {testResults.length > 0 ? (
                                    <div className="space-y-4">
                                        {/* Summary */}
                                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium text-gray-700">
                                                    Score
                                                </span>
                                                <span className="text-2xl font-bold text-[#862733]">
                                                    {testStats.score}/{testStats.maxScore}
                                                </span>
                                            </div>
                                            <Progress
                                                value={(testStats.score / testStats.maxScore) * 100}
                                                className="h-2 mb-3"
                                            />
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-1 text-green-600">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    <span>{testStats.passed} Passed</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-red-600">
                                                    <XCircle className="w-4 h-4" />
                                                    <span>{testStats.failed} Failed</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Individual Tests */}
                                        <div className="space-y-2">
                                            {testResults.map((test) => (
                                                <div
                                                    key={test.id}
                                                    className={`p-3 rounded-lg border-l-4 ${
                                                        test.passed
                                                            ? 'bg-green-50 border-green-500'
                                                            : 'bg-red-50 border-red-500'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between mb-1">
                                                        <span className="text-sm font-medium text-gray-900 flex-1">
                                                            {test.name}
                                                        </span>
                                                        {test.passed ? (
                                                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                                        ) : (
                                                            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-600 mb-2">
                                                        Score: {test.score}/{test.max_score}
                                                    </div>
                                                    {test.output && (
                                                        <p className="text-xs text-gray-700 mt-1">
                                                            {test.output}
                                                        </p>
                                                    )}
                                                    {test.error && (
                                                        <p className="text-xs text-red-700 mt-1 font-mono">
                                                            {test.error}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-center">
                                        <div>
                                            <Target className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                            <p className="text-sm text-gray-500 mb-1">
                                                No test results yet
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                Run your code to see test results
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Assignment Instructions */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Info className="w-5 h-5" />
                                Instructions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="prose max-w-none text-gray-700">
                                <p>{assignment.description}</p>
                                {assignment.instructions && (
                                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-sm whitespace-pre-wrap">{assignment.instructions}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
