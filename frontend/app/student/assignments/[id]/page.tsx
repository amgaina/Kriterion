'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api-client'
import { format } from 'date-fns'

import {
    ArrowLeft,
    Play,
    Send,
    Folder,
    FileCode,
    Target,
    X,
    Calendar,
    Upload as UploadIcon,
    AlertCircle,
    Loader2,
    History,
    CheckCircle2,
    XCircle,
    Info,
    BookOpen,
    ClipboardList,
    Terminal,
    Clock,
    Award,
    Zap,
    TrendingUp,
    Code,
    Sparkles,
} from 'lucide-react'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { DashboardLayout } from '@/components/layouts/DashboardLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'

/* ====================================================================
   TYPE DEFINITIONS
   ==================================================================== */

interface UploadedFile {
    name: string
    content: string
    size: number
}

interface TestResult {
    id: number
    name: string
    passed: boolean
    score: number
    max_score: number
    output?: string
    error?: string
}

interface Assignment {
    id: number
    title: string
    description: string
    instructions: string
    rubric: string
    due_date: string
    max_score: number
    language: {
        id: number
        name: string
        version: string
    }
}

interface Submission {
    id: number
    created_at: string
    final_score: number | null
    status: string
}

/* ====================================================================
   MAIN COMPONENT
   ==================================================================== */

export default function AssignmentPage() {
    const { id } = useParams()
    const router = useRouter()
    const queryClient = useQueryClient()
    const { toast } = useToast()

    const assignmentId = Number(id)

    /* ----------------------------- Constants ---------------------------- */
    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
    const ALLOWED_EXTENSIONS = ['.py', '.java', '.cpp', '.c', '.js', '.ts', '.txt']

    /* ----------------------------- Refs ---------------------------- */
    const fileInputRef = useRef<HTMLInputElement>(null)

    /* ----------------------------- State ---------------------------- */
    const [files, setFiles] = useState<UploadedFile[]>([])
    const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null)
    const [testResults, setTestResults] = useState<TestResult[]>([])
    const [compilationMessage, setCompilationMessage] = useState<string>('')
    const [compilationSuccess, setCompilationSuccess] = useState<boolean>(false)
    const [isRunning, setIsRunning] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [activeModal, setActiveModal] = useState<
        'description' | 'instructions' | 'rubric' | 'submissions' | null
    >(null)
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isHoveringUpload, setIsHoveringUpload] = useState(false)
    const [successAnimation, setSuccessAnimation] = useState(false)

    /* ----------------------------- API Queries ---------------------------- */
    const {
        data: assignment,
        isLoading: isLoadingAssignment,
        error: assignmentError
    } = useQuery<Assignment>({
        queryKey: ['assignment', assignmentId],
        queryFn: () => apiClient.getAssignment(assignmentId),
        retry: 2,
    })

    const {
        data: submissions = [],
        isLoading: isLoadingSubmissions
    } = useQuery<Submission[]>({
        queryKey: ['submissions', assignmentId],
        queryFn: () => apiClient.getSubmissions(assignmentId),
        enabled: !!assignment,
    })

    /* ----------------------------- Derived State ---------------------------- */
    const isOverdue = useMemo(() =>
        assignment ? new Date(assignment.due_date) < new Date() : false,
        [assignment]
    )

    const dueDate = useMemo(() =>
        assignment ? new Date(assignment.due_date) : null,
        [assignment]
    )

    const passingTests = useMemo(() =>
        testResults.filter(r => r.passed).length,
        [testResults]
    )

    const totalScore = useMemo(() =>
        testResults.reduce((sum, r) => sum + r.score, 0),
        [testResults]
    )

    const maxPossibleScore = useMemo(() =>
        testResults.reduce((sum, r) => sum + r.max_score, 0),
        [testResults]
    )

    const latestSubmission = useMemo(() =>
        submissions.length > 0 ? submissions[0] : null,
        [submissions]
    )

    /* ----------------------------- File Handling ---------------------------- */

    const handleUpload = useCallback((fileList: FileList | null) => {
        if (!fileList) return
        setError(null)

        const fileArray = Array.from(fileList)

        fileArray.forEach((file) => {
            // Validate file size
            if (file.size > MAX_FILE_SIZE) {
                const errorMsg = `File "${file.name}" exceeds 5MB limit`
                setError(errorMsg)
                toast({
                    title: 'File too large',
                    description: errorMsg,
                    variant: 'destructive',
                })
                return
            }

            // Validate file extension
            const ext = '.' + file.name.split('.').pop()?.toLowerCase()
            if (!ALLOWED_EXTENSIONS.includes(ext)) {
                const errorMsg = `File "${file.name}" has an unsupported extension`
                setError(errorMsg)
                toast({
                    title: 'Invalid file type',
                    description: errorMsg,
                    variant: 'destructive',
                })
                return
            }

            const reader = new FileReader()
            reader.onload = (e) => {
                const content = e.target?.result as string
                const newFile: UploadedFile = {
                    name: file.name,
                    content,
                    size: file.size,
                }

                setFiles((prev) => {
                    const existingIndex = prev.findIndex((f) => f.name === file.name)
                    if (existingIndex >= 0) {
                        toast({
                            title: 'File updated',
                            description: `"${file.name}" has been updated`,
                        })
                        const updated = [...prev]
                        updated[existingIndex] = newFile
                        return updated
                    }
                    toast({
                        title: 'File added',
                        description: `"${file.name}" has been uploaded`,
                    })
                    return [...prev, newFile]
                })

                if (!selectedFile) setSelectedFile(newFile)
            }

            reader.onerror = () => {
                toast({
                    title: 'Upload failed',
                    description: `Failed to read "${file.name}"`,
                    variant: 'destructive',
                })
            }

            reader.readAsText(file)
        })
    }, [selectedFile, toast, MAX_FILE_SIZE, ALLOWED_EXTENSIONS])

    const removeFile = useCallback((name: string) => {
        setFiles((prev) => prev.filter((f) => f.name !== name))
        if (selectedFile?.name === name) {
            const remaining = files.filter(f => f.name !== name)
            setSelectedFile(remaining.length > 0 ? remaining[0] : null)
        }
        toast({
            title: 'File removed',
            description: `"${name}" has been removed`,
        })
    }, [selectedFile, files, toast])

    const updateFileContent = useCallback((value: string) => {
        if (!selectedFile) return

        const updated = { ...selectedFile, content: value }
        setSelectedFile(updated)
        setFiles((prev) =>
            prev.map((f) => (f.name === updated.name ? updated : f))
        )
    }, [selectedFile])

    /* ----------------------------- Run Code ---------------------------- */

    const runCode = async () => {
        if (!files.length) {
            toast({
                title: 'No files uploaded',
                description: 'Please upload at least one file before running',
                variant: 'destructive',
            })
            return
        }

        setIsRunning(true)
        setTestResults([])
        setCompilationMessage('')
        setError(null)

        try {
            const response = await apiClient.runCode(assignmentId, files)

            // Handle case with no test cases (compilation check only)
            if (response.results.length === 0 && response.message) {
                setCompilationSuccess(response.success)
                setCompilationMessage(response.message)

                toast({
                    title: response.success ? 'Compiled Successfully' : 'Compilation Failed',
                    description: response.success ? 'Your code compiled and ran successfully!' : 'Check the output for errors',
                    variant: response.success ? 'default' : 'destructive',
                })
            } else {
                // Handle test results
                setTestResults(response.results)
                const passed = response.results.filter((r: TestResult) => r.passed).length
                const total = response.results.length
                const score = response.results.reduce((sum: number, r: TestResult) => sum + r.score, 0)

                toast({
                    title: `Tests Completed: ${passed}/${total} Passed`,
                    description: `Score: ${score} points`,
                    variant: passed === total ? 'default' : 'destructive',
                })
            }
        } catch (err: any) {
            const errorMsg = err?.response?.data?.detail || 'Failed to run code. Please try again.'
            setError(errorMsg)
            setCompilationSuccess(false)
            setCompilationMessage(errorMsg)
            toast({
                title: 'Execution Failed',
                description: errorMsg,
                variant: 'destructive',
            })
        } finally {
            setIsRunning(false)
        }
    }

    /* ----------------------------- Submit ---------------------------- */

    const handleSubmit = () => {
        if (!files.length) {
            toast({
                title: 'No files to submit',
                description: 'Please upload at least one file before submitting',
                variant: 'destructive',
            })
            return
        }
        setShowSubmitConfirm(true)
    }

    const submitCode = async () => {
        setIsSubmitting(true)
        setError(null)
        setShowSubmitConfirm(false)

        try {
            const fileObjects = files.map((f) => {
                const blob = new Blob([f.content], { type: 'text/plain' })
                return new File([blob], f.name)
            })

            await apiClient.createSubmission(assignmentId, fileObjects)
            await queryClient.invalidateQueries({ queryKey: ['submissions', assignmentId] })

            setSuccessAnimation(true)
            toast({
                title: 'Submission Successful!',
                description: 'Your assignment has been submitted for grading',
            })

            // Clear files after successful submission
            setTimeout(() => {
                setFiles([])
                setSelectedFile(null)
                setTestResults([])
                setCompilationMessage('')
            }, 800)

            // Redirect after animation
            setTimeout(() => router.push('/student/courses'), 2000)
        } catch (err: any) {
            const errorMsg = err?.response?.data?.detail || 'Failed to submit assignment'
            setError(errorMsg)
            toast({
                title: 'Submission failed',
                description: errorMsg,
                variant: 'destructive',
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    /* ====================================================================
       RENDER
       ==================================================================== */

    // Loading state
    if (isLoadingAssignment) {
        return (
            <ProtectedRoute allowedRoles={['STUDENT']}>
                <DashboardLayout>
                    <div className="flex items-center justify-center h-[calc(100vh-120px)]">
                        <div className="text-center space-y-6 animate-in fade-in-50 duration-500">
                            <Loader2 className="w-16 h-16 mx-auto animate-spin text-foreground" />
                            <div className="space-y-2">
                                <p className="text-xl font-semibold">Loading assignment...</p>
                                <p className="text-sm text-muted-foreground">Preparing your workspace</p>
                            </div>
                        </div>
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        )
    }

    // Error state
    if (assignmentError || !assignment) {
        return (
            <ProtectedRoute allowedRoles={['STUDENT']}>
                <DashboardLayout>
                    <div className="flex items-center justify-center h-[calc(100vh-120px)]">
                        <Card className="p-8 max-w-md shadow-lg animate-in zoom-in-95 duration-300">
                            <div className="text-center space-y-6">
                                <AlertCircle className="w-20 h-20 mx-auto text-muted-foreground" />
                                <div className="space-y-2">
                                    <h2 className="text-2xl font-bold">Assignment Not Found</h2>
                                    <p className="text-muted-foreground leading-relaxed">
                                        The assignment you're looking for doesn't exist or you don't have permission to access it.
                                    </p>
                                </div>
                                <Button
                                    onClick={() => router.push('/student/courses')}
                                    className="mt-4 group"
                                    size="lg"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                                    Back to Courses
                                </Button>
                            </div>
                        </Card>
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        )
    }

    return (
        <ProtectedRoute allowedRoles={['STUDENT']}>
            <DashboardLayout>
                <div className="flex flex-col h-[calc(100vh-120px)] space-y-4 p-1 animate-in fade-in-50 duration-300">

                    {/* ================ Assignment Header ================ */}
                    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
                        <CardHeader className="pb-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-3 flex-1">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h1 className="text-3xl font-bold tracking-tight">{assignment.title}</h1>
                                        {isOverdue ? (
                                            <Badge variant="destructive" className="text-xs font-semibold">
                                                <AlertCircle className="w-3 h-3 mr-1" />
                                                Overdue
                                            </Badge>
                                        ) : (
                                            <Badge className="text-xs font-semibold">
                                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                                Active
                                            </Badge>
                                        )}
                                        <Badge variant="outline" className="text-xs font-semibold">
                                            <Code className="w-3 h-3 mr-1" />
                                            {assignment.language?.name || 'N/A'}
                                        </Badge>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 text-sm">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Calendar className="w-4 h-4 flex-shrink-0" />
                                            <span>
                                                Due: <strong className="text-foreground">
                                                    {dueDate ? format(dueDate, 'MMM dd, yyyy · hh:mm a') : 'No due date'}
                                                </strong>
                                            </span>
                                        </div>
                                        <div className="h-4 w-px bg-border" />
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Target className="w-4 h-4 flex-shrink-0" />
                                            <span>
                                                Max Score: <strong className="text-foreground">{assignment.max_score || 100} pts</strong>
                                            </span>
                                        </div>
                                        <div className="h-4 w-px bg-border" />
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Code className="w-4 h-4 flex-shrink-0" />
                                            <span>
                                                Language: <strong className="text-foreground capitalize">{assignment.language?.name || 'N/A'}</strong>
                                            </span>
                                        </div>
                                    </div>

                                    {latestSubmission && (
                                        <Alert className="mt-3">
                                            <Info className="h-4 w-4" />
                                            <AlertDescription>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <strong>Latest submission:</strong> {format(new Date(latestSubmission.created_at), 'MMM dd, yyyy · hh:mm a')} ·
                                                    Score: <strong>{latestSubmission.final_score ?? 'Pending'}/{assignment.max_score}</strong>
                                                    {latestSubmission.final_score !== null && (
                                                        <Badge variant="outline" className="ml-2">
                                                            {((latestSubmission.final_score / assignment.max_score) * 100).toFixed(0)}%
                                                        </Badge>
                                                    )}
                                                </div>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setActiveModal('description')}>
                                        <BookOpen className="w-4 h-4 mr-1" />
                                        Description
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setActiveModal('instructions')}>
                                        <Info className="w-4 h-4 mr-1" />
                                        Instructions
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setActiveModal('rubric')}>
                                        <ClipboardList className="w-4 h-4 mr-1" />
                                        Rubric
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setActiveModal('submissions')}>
                                        <History className="w-4 h-4 mr-1" />
                                        History
                                        {submissions.length > 0 && (
                                            <Badge variant="outline" className="ml-1">
                                                {submissions.length}
                                            </Badge>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    {/* ================ Error Alert ================ */}
                    {error && (
                        <Alert variant="destructive" className="animate-in slide-in-from-top-2 duration-300">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="font-medium">{error}</AlertDescription>
                            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
                                <X className="h-4 w-4" />
                            </Button>
                        </Alert>
                    )}

                    {/* ================ Action Bar ================ */}
                    <div className="flex items-center justify-between bg-muted/30 px-6 py-4 rounded-lg border shadow-sm">
                        <Button
                            variant="ghost"
                            onClick={() => router.push('/student/courses')}
                            size="sm"
                            className="group"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                            Back to Courses
                        </Button>

                        <div className="flex items-center gap-4">
                            {files.length > 0 && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background px-4 py-2 rounded-lg border">
                                    <FileCode className="w-4 h-4" />
                                    <span className="font-medium">
                                        {files.length} file{files.length !== 1 ? 's' : ''} uploaded
                                    </span>
                                </div>
                            )}
                            <Button
                                onClick={runCode}
                                disabled={isRunning || files.length === 0}
                                variant="secondary"
                                size="default"
                                className="min-w-[150px] font-semibold"
                            >
                                {isRunning ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Running...
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-4 h-4 mr-2" />
                                        Run & Test
                                    </>
                                )}
                            </Button>

                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || files.length === 0}
                                className="min-w-[180px] font-semibold"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        Submit Assignment
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* ================ Main Layout: Three Columns ================ */}
                    <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">

                        {/* ========== Left Panel: File Manager ========== */}
                        <Card className="col-span-3 flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
                            <CardHeader className="pb-3 border-b bg-muted/30">
                                <div className="flex items-center justify-between mb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Folder className="w-5 h-5" />
                                        <span>Files</span>
                                        {files.length > 0 && (
                                            <Badge variant="outline" className="ml-1">
                                                {files.length}
                                            </Badge>
                                        )}
                                    </CardTitle>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        hidden
                                        accept={ALLOWED_EXTENSIONS.join(',')}
                                        onChange={(e) => handleUpload(e.target.files)}
                                    />

                                    <Button
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <UploadIcon className="w-4 h-4 mr-1" />
                                        Upload
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground px-1">
                                    Max 5MB · {ALLOWED_EXTENSIONS.join(', ')}
                                </p>
                            </CardHeader>

                            <div className="flex-1 overflow-y-auto p-3">
                                {files.length === 0 ? (
                                    <div
                                        className="flex flex-col items-center justify-center h-full text-center py-8 cursor-pointer"
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(e) => {
                                            e.preventDefault()
                                            setIsHoveringUpload(true)
                                        }}
                                        onDragLeave={() => setIsHoveringUpload(false)}
                                        onDrop={(e) => {
                                            e.preventDefault()
                                            setIsHoveringUpload(false)
                                            handleUpload(e.dataTransfer.files)
                                        }}
                                    >
                                        <FileCode className="w-20 h-20 text-muted-foreground/50 mb-4" />
                                        <p className="text-sm font-medium text-muted-foreground mb-1">
                                            No files uploaded
                                        </p>
                                        <p className="text-xs text-muted-foreground mb-4">
                                            Click or drag files to begin
                                        </p>
                                        <Button
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                fileInputRef.current?.click()
                                            }}
                                            variant="outline"
                                        >
                                            <UploadIcon className="w-4 h-4 mr-2" />
                                            Choose Files
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {files.map((file, index) => (
                                            <div
                                                key={file.name}
                                                onClick={() => setSelectedFile(file)}
                                                className={`p-3 rounded-lg cursor-pointer flex items-center justify-between group/file transition-all duration-300 animate-in slide-in-from-left-2 ${selectedFile?.name === file.name
                                                    ? 'bg-gradient-to-r from-primary/20 to-purple-500/20 border-2 border-primary shadow-lg scale-[1.02]'
                                                    : 'hover:bg-accent/50 border-2 border-transparent hover:border-accent hover:scale-[1.01] hover:shadow-md'
                                                    }`}
                                                style={{ animationDelay: `${index * 50}ms` }}
                                            >
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <div className={`p-1.5 rounded-md transition-colors duration-300 ${selectedFile?.name === file.name ? 'bg-primary/20' : 'bg-muted group-hover/file:bg-primary/10'}`}>
                                                        <FileCode className={`w-4 h-4 flex-shrink-0 transition-colors duration-300 ${selectedFile?.name === file.name ? 'text-primary' : 'text-muted-foreground group-hover/file:text-primary'
                                                            }`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm font-medium truncate transition-colors duration-300 ${selectedFile?.name === file.name ? 'text-primary' : 'group-hover/file:text-foreground'
                                                            }`}>
                                                            {file.name}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-xs text-muted-foreground">
                                                                {(file.size / 1024).toFixed(1)} KB
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">·</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {file.content.split('\n').length} lines
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 w-8 p-0 opacity-0 group-hover/file:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-all duration-300 hover:scale-110"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        removeFile(file.name)
                                                    }}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>

                        {/* ========== Middle Panel: Code Editor ========== */}
                        <Card className="col-span-6 flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
                            {selectedFile ? (
                                <>
                                    <CardHeader className="pb-3 border-b bg-muted/30">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Code className="w-4 h-4" />
                                                <div className="flex flex-col">
                                                    <CardTitle className="text-sm font-mono font-bold">
                                                        {selectedFile.name}
                                                    </CardTitle>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Editing mode
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Badge variant="outline" className="text-xs">
                                                    <Terminal className="w-3 h-3 mr-1" />
                                                    {selectedFile.content.split('\n').length} lines
                                                </Badge>
                                                <Badge variant="outline" className="text-xs">
                                                    {(selectedFile.size / 1024).toFixed(1)} KB
                                                </Badge>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <div className="flex-1 overflow-hidden">
                                        <textarea
                                            value={selectedFile.content}
                                            onChange={(e) => updateFileContent(e.target.value)}
                                            className="w-full h-full p-5 font-mono text-sm outline-none resize-none bg-background"
                                            placeholder="// Write your code here..."
                                            spellCheck={false}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center space-y-4 p-8">
                                        <Code className="w-24 h-24 mx-auto text-muted-foreground/50" />
                                        <div className="space-y-2">
                                            <p className="text-lg font-semibold text-muted-foreground">
                                                No file selected
                                            </p>
                                            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                                {files.length > 0
                                                    ? 'Select a file from the left panel to start editing'
                                                    : 'Upload files to get started with your assignment'}
                                            </p>
                                        </div>
                                        {files.length === 0 && (
                                            <Button
                                                onClick={() => fileInputRef.current?.click()}
                                                variant="outline"
                                                className="mt-4"
                                            >
                                                <UploadIcon className="w-4 h-4 mr-2" />
                                                Upload Your First File
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Right Panel - Results */}
                        <Card className="col-span-3 flex flex-col overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300">
                            <CardHeader className="pb-3 border-b bg-muted/30">
                                <CardTitle className="text-base flex items-center gap-2">
                                    {compilationMessage && testResults.length === 0 ? (
                                        <>
                                            <Terminal className="w-5 h-5" />
                                            <span>Compilation</span>
                                        </>
                                    ) : (
                                        <>
                                            <Target className="w-5 h-5" />
                                            <span>Test Results</span>
                                        </>
                                    )}
                                    {testResults.length > 0 && (
                                        <Badge
                                            variant={passingTests === testResults.length ? 'default' : 'destructive'}
                                            className="ml-auto"
                                        >
                                            {passingTests}/{testResults.length}
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>

                            <div className="flex-1 overflow-y-auto p-4">                              {isRunning ? (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <Loader2 className="w-12 h-12 animate-spin mb-4" />
                                    <p className="text-sm font-semibold mb-2">Running code...</p>
                                    <p className="text-xs text-muted-foreground">
                                        Executing tests and checking results
                                    </p>
                                </div>
                            ) : compilationMessage && testResults.length === 0 ? (
                                <div className="space-y-3">
                                    <Alert variant={compilationSuccess ? 'default' : 'destructive'}>
                                        {compilationSuccess ? (
                                            <CheckCircle2 className="h-5 w-5" />
                                        ) : (
                                            <XCircle className="h-5 w-5" />
                                        )}
                                        <AlertDescription className="font-semibold">
                                            {compilationSuccess ? '\u2713 Compilation Successful' : '\u2717 Compilation Failed'}
                                        </AlertDescription>
                                    </Alert>
                                    <Card className="bg-muted/50">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                                <Terminal className="w-4 h-4" />
                                                Output:
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed p-3 rounded-md bg-background border">
                                                {compilationMessage}
                                            </pre>
                                        </CardContent>
                                    </Card>
                                </div>
                            ) : testResults.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <Target className="w-20 h-20 text-muted-foreground/50 mb-4" />
                                    <p className="text-sm font-medium text-muted-foreground mb-1">
                                        No results yet
                                    </p>
                                    <p className="text-xs text-muted-foreground max-w-[200px]">
                                        Run your code to see test results and feedback
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {totalScore > 0 && (
                                        <Alert>
                                            <Award className="h-5 w-5" />
                                            <AlertDescription className="font-semibold flex items-center gap-2">
                                                <span>Total Score:</span>
                                                <span className="text-xl font-bold">{totalScore}</span>
                                                <span>/</span>
                                                <span>{maxPossibleScore}</span>
                                                <span className="text-sm">points</span>
                                                <Badge variant="outline" className="ml-2">
                                                    {((totalScore / maxPossibleScore) * 100).toFixed(0)}%
                                                </Badge>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    {testResults.map((test) => (
                                        <Card
                                            key={test.id}
                                            className={`border-2 transition-shadow hover:shadow-md ${test.passed
                                                ? 'border-foreground/20'
                                                : 'border-destructive/50'
                                                }`}
                                        >
                                            <CardHeader className="pb-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2">
                                                        {test.passed ? (
                                                            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                                                        ) : (
                                                            <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                                                        )}
                                                        <CardTitle className="text-sm font-semibold">{test.name}</CardTitle>
                                                    </div>
                                                    <Badge
                                                        variant={test.passed ? 'default' : 'destructive'}
                                                        className="text-xs font-bold"
                                                    >
                                                        {test.score}/{test.max_score}
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            {(test.error || test.output) && (
                                                <CardContent className="pt-0 space-y-2">
                                                    {test.error && (
                                                        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                                                            <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                                                                <XCircle className="w-3 h-3" />
                                                                Error:
                                                            </p>
                                                            <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">
                                                                {test.error}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {test.output && (
                                                        <div className="bg-muted/50 border rounded-lg p-3">
                                                            <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                                                                <Terminal className="w-3 h-3" />
                                                                Output:
                                                            </p>
                                                            <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed">
                                                                {test.output}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            )}
                            </div>
                        </Card>
                    </div>
                </div>

                {/* ================ Info Modals ================ */}
                <Dialog open={!!activeModal} onOpenChange={() => setActiveModal(null)}>
                    <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                {activeModal === 'description' && <BookOpen className="w-6 h-6 text-primary" />}
                                {activeModal === 'instructions' && <Info className="w-6 h-6 text-primary" />}
                                {activeModal === 'rubric' && <ClipboardList className="w-6 h-6 text-primary" />}
                                {activeModal === 'submissions' && <History className="w-6 h-6 text-primary" />}
                                <span className="capitalize">{activeModal}</span>
                            </DialogTitle>
                        </DialogHeader>

                        <div className="border-t my-2" />

                        <div className="flex-1 overflow-y-auto">
                            {activeModal === 'description' && (
                                <div className="prose dark:prose-invert max-w-none">
                                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                        {assignment.description || 'No description provided.'}
                                    </p>
                                </div>
                            )}

                            {activeModal === 'instructions' && (
                                <div className="prose dark:prose-invert max-w-none">
                                    <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg leading-relaxed">
                                        {assignment.instructions || 'No instructions provided.'}
                                    </pre>
                                </div>
                            )}

                            {activeModal === 'rubric' && (
                                <div className="prose dark:prose-invert max-w-none">
                                    <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap leading-relaxed">
                                        {assignment.rubric || 'No rubric provided.'}
                                    </div>
                                </div>
                            )}

                            {activeModal === 'submissions' && (
                                <div>
                                    {isLoadingSubmissions ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                        </div>
                                    ) : submissions.length === 0 ? (
                                        <div className="text-center py-12">
                                            <History className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                                            <p className="text-lg font-medium text-muted-foreground">No submissions yet</p>
                                            <p className="text-sm text-muted-foreground mt-2">Your submission history will appear here</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <p className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
                                                <Info className="w-4 h-4" />
                                                Total submissions: <strong className="text-foreground">{submissions.length}</strong>
                                            </p>
                                            {submissions.map((sub: any, index: number) => (
                                                <Card key={sub.id} className="border-l-4 border-l-primary hover:shadow-md transition-shadow">
                                                    <CardHeader>
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <CardTitle className="text-lg">
                                                                        Submission #{submissions.length - index}
                                                                    </CardTitle>
                                                                    {index === 0 && (
                                                                        <Badge variant="info" className="text-xs">Latest</Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                                    <Calendar className="w-3 h-3" />
                                                                    {format(new Date(sub.created_at), 'MMM dd, yyyy · hh:mm a')}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-3xl font-bold text-primary">
                                                                    {sub.final_score ?? '—'}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    out of {assignment.max_score || 100}
                                                                </p>
                                                                {sub.final_score !== null && (
                                                                    <Badge
                                                                        variant={sub.final_score >= (assignment.max_score * 0.7) ? 'default' : 'destructive'}
                                                                        className="mt-1"
                                                                    >
                                                                        {((sub.final_score / assignment.max_score) * 100).toFixed(0)}%
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CardHeader>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* ================ Submit Confirmation Dialog ================ */}
                <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-xl flex items-center gap-2">
                                <Send className="w-5 h-5 text-primary" />
                                Confirm Submission
                            </DialogTitle>
                            <DialogDescription className="text-base pt-2">
                                You are about to submit <strong>{files.length} file{files.length !== 1 ? 's' : ''}</strong> for grading.
                            </DialogDescription>
                        </DialogHeader>

                        {isOverdue && (
                            <Alert variant="destructive" className="border-2">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                    <strong>Late Submission Warning:</strong> The due date was {dueDate ? format(dueDate, 'MMM dd, yyyy · hh:mm a') : 'N/A'}. Late penalties may apply.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-3 py-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold">Files to submit:</span>
                                <Badge variant="outline">{files.length} file{files.length !== 1 ? 's' : ''}</Badge>
                            </div>
                            <Card className="max-h-48 overflow-y-auto">
                                <CardContent className="p-3">
                                    <ul className="space-y-2">
                                        {files.map(f => (
                                            <li key={f.name} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <FileCode className="w-4 h-4 flex-shrink-0 text-primary" />
                                                    <span className="text-sm truncate font-medium">{f.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <Badge variant="outline" className="text-xs">
                                                        {(f.size / 1024).toFixed(1)} KB
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs">
                                                        {f.content.split('\n').length} lines
                                                    </Badge>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>

                        <Alert className="bg-blue-50 border-blue-200">
                            <Info className="h-4 w-4 text-blue-700" />
                            <AlertDescription className="text-blue-900 text-sm">
                                Once submitted, your assignment will be graded automatically. You can submit multiple times.
                            </AlertDescription>
                        </Alert>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                variant="outline"
                                onClick={() => setShowSubmitConfirm(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={submitCode}
                                disabled={isSubmitting || files.length === 0}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        Submit Now
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </DashboardLayout>
        </ProtectedRoute>
    )
}
