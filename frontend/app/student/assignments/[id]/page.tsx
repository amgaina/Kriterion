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
    FolderOpen,
    FileCode,
    Target,
    X,
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
    Code,
    ChevronDown,
    Clock,
    Plus,
    PartyPopper,
    Paperclip,
    Download,
} from 'lucide-react'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Button } from '@/components/ui/button'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'

/* ====================================================================
   TYPES
   ==================================================================== */

interface UploadedFile {
    name: string
    content: string
    size: number
}

interface TestResultItem {
    id: number
    name: string
    passed: boolean
    score: number
    max_score: number
    output?: string | null
    error?: string | null
    expected_output?: string | null
    execution_time?: number
}

interface RunCodeResult {
    success: boolean
    results: TestResultItem[]
    total_score: number
    max_score: number
    tests_passed: number
    tests_total: number
    message?: string
    compilation_status?: string
}

interface Assignment {
    id: number
    title: string
    description: string
    instructions: string
    due_date: string
    max_score: number
    passing_score: number
    max_attempts: number
    max_file_size_mb: number
    allowed_file_extensions: string[] | null
    required_files: string[] | null
    allow_late: boolean
    late_penalty_per_day: number
    max_late_days: number
    difficulty: string
    test_weight: number
    rubric_weight: number
    starter_code: string | null
    language: {
        id: number
        name: string
        display_name: string
        file_extension: string
    }
    course: {
        id: number
        name: string
        code: string
    }
    rubric?: any
}

interface SubmissionItem {
    id: number
    created_at: string
    submitted_at: string
    final_score: number | null
    status: string
    tests_passed: number
    tests_total: number
    is_late: boolean
    attempt_number: number
}

const FILE_ICONS: Record<string, string> = {
    '.py': '🐍', '.java': '☕', '.cpp': '⚡', '.c': '⚙️',
    '.js': '🟨', '.ts': '🔷', '.txt': '📄', '.md': '📝',
}

function getFileIcon(filename: string) {
    const ext = '.' + (filename.split('.').pop()?.toLowerCase() || '')
    return FILE_ICONS[ext] || '📄'
}

/* ====================================================================
   COMPONENT
   ==================================================================== */

export default function StudentAssignmentPage() {
    const { id } = useParams()
    const router = useRouter()
    const queryClient = useQueryClient()
    const { toast } = useToast()
    const assignmentId = Number(id)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // State
    const [files, setFiles] = useState<UploadedFile[]>([])
    const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null)
    const [runResult, setRunResult] = useState<RunCodeResult | null>(null)
    const [isRunning, setIsRunning] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showSubmitDialog, setShowSubmitDialog] = useState(false)
    const [submitPhase, setSubmitPhase] = useState<'confirm' | 'loading' | 'success'>('confirm')
    const [error, setError] = useState<string | null>(null)
    const [explorerOpen, setExplorerOpen] = useState(true)
    const [panelOpen, setPanelOpen] = useState(true)
    const [activePanel, setActivePanel] = useState<'output' | 'tests'>('output')
    const [rightPanel, setRightPanel] = useState<'description' | 'instructions' | 'rubric' | 'history' | 'supplementary' | null>(null)

    // API
    const { data: assignment, isLoading, error: loadError } = useQuery<Assignment>({
        queryKey: ['assignment', assignmentId],
        queryFn: () => apiClient.getAssignment(assignmentId),
        retry: 2,
    })

    const { data: submissions = [], isLoading: isLoadingSubs } = useQuery<SubmissionItem[]>({
        queryKey: ['submissions', assignmentId],
        queryFn: () => apiClient.getSubmissions(assignmentId),
        enabled: !!assignment,
    })

    const { data: supplementaryFiles = [] } = useQuery({
        queryKey: ['assignment-supplementary', assignmentId],
        queryFn: () => apiClient.getAssignmentSupplementaryFiles(assignmentId),
        enabled: !!assignmentId && !!assignment,
    })

    // Derived: normalize allowed extensions (lowercase, leading dot); fallback to language ext
    const allowedExtensions = useMemo(() => {
        const raw = assignment?.allowed_file_extensions
        if (raw && Array.isArray(raw) && raw.length > 0) {
            return raw.map((e: string) => {
                const s = String(e).trim().toLowerCase()
                return s.startsWith('.') ? s : '.' + s
            }).filter(Boolean)
        }
        const langExt = assignment?.language?.file_extension
        return langExt ? [langExt.startsWith('.') ? langExt : '.' + langExt] : ['.py']
    }, [assignment?.allowed_file_extensions, assignment?.language?.file_extension])
    const maxFileSizeMB = assignment?.max_file_size_mb || 10
    const maxFileSize = maxFileSizeMB * 1024 * 1024
    const isOverdue = useMemo(() => assignment ? new Date(assignment.due_date) < new Date() : false, [assignment])
    const dueDate = useMemo(() => assignment ? new Date(assignment.due_date) : null, [assignment])
    const latestSubmission = useMemo(() => submissions.length > 0 ? submissions[0] : null, [submissions])
    const maxAttempts = assignment?.max_attempts || 0
    const attemptsLeft = maxAttempts > 0 ? maxAttempts - submissions.length : Infinity

    const editorLines = (selectedFile?.content || '').split('\n')

    // Load starter code only if it contains actual code
    useEffect(() => {
        if (!assignment || files.length > 0) return
        if (!assignment.starter_code) return

        let codeContent = ''
        try {
            const parsed = JSON.parse(assignment.starter_code)
            codeContent = parsed.code || ''
        } catch {
            codeContent = assignment.starter_code
        }

        if (codeContent.trim()) {
            const ext = assignment.language?.file_extension || '.py'
            const f: UploadedFile = { name: `main${ext}`, content: codeContent, size: new Blob([codeContent]).size }
            setFiles([f])
            setSelectedFile(f)
        }
    }, [assignment])

    /* ===== File Handling ===== */

    const handleUpload = useCallback((fileList: FileList | null) => {
        if (!fileList) return
        setError(null)
        for (const file of Array.from(fileList)) {
            if (file.size > maxFileSize) {
                const msg = `File exceeded the required size (${maxFileSizeMB} MB)`
                setError(msg)
                toast({ title: 'File too large', description: msg, variant: 'destructive' })
                return
            }
            const ext = '.' + file.name.split('.').pop()?.toLowerCase()
            if (!allowedExtensions.includes(ext)) {
                const msg = `"${file.name}" is not allowed. Use: ${allowedExtensions.join(', ')}`
                setError(msg)
                toast({ title: 'Invalid file type', description: msg, variant: 'destructive' })
                return
            }
            const reader = new FileReader()
            reader.onload = (e) => {
                const content = e.target?.result as string
                const newFile: UploadedFile = { name: file.name, content, size: file.size }
                setFiles((prev) => {
                    const idx = prev.findIndex((f) => f.name === file.name)
                    if (idx >= 0) { const u = [...prev]; u[idx] = newFile; return u }
                    return [...prev, newFile]
                })
                setSelectedFile(newFile)
            }
            reader.readAsText(file)
        }
    }, [maxFileSize, maxFileSizeMB, allowedExtensions, toast])

    const handleNewFile = useCallback(() => {
        const ext = allowedExtensions[0] || assignment?.language?.file_extension || '.py'
        let name = `file${ext}`
        let c = 1
        while (files.some(f => f.name === name)) { name = `file${c}${ext}`; c++ }
        const nf: UploadedFile = { name, content: '', size: 0 }
        setFiles(prev => [...prev, nf])
        setSelectedFile(nf)
    }, [assignment, files, allowedExtensions])

    const removeFile = useCallback((name: string) => {
        setFiles((prev) => prev.filter((f) => f.name !== name))
        if (selectedFile?.name === name) {
            const rest = files.filter(f => f.name !== name)
            setSelectedFile(rest.length > 0 ? rest[0] : null)
        }
    }, [selectedFile, files])

    const updateFileContent = useCallback((value: string) => {
        if (!selectedFile) return
        const updated = { ...selectedFile, content: value, size: new Blob([value]).size }
        setSelectedFile(updated)
        setFiles((prev) => prev.map((f) => (f.name === updated.name ? updated : f)))
    }, [selectedFile])

    /* ===== Run Code ===== */

    const runCode = async () => {
        if (!files.length) {
            toast({ title: 'No files', description: 'Create or upload a file first.', variant: 'destructive' })
            return
        }
        // Validate no empty files
        const emptyFiles = files.filter(f => !f.content.trim())
        if (emptyFiles.length === files.length) {
            toast({ title: 'Empty files', description: 'Write some code before running.', variant: 'destructive' })
            return
        }

        setIsRunning(true)
        setRunResult(null)
        setError(null)
        setPanelOpen(true)
        setActivePanel('output')

        try {
            const response: RunCodeResult = await apiClient.runCode(assignmentId, files)
            setRunResult(response)
            setActivePanel(response.results.length > 0 ? 'tests' : 'output')

            if (response.compilation_status === 'Time Exceeds') {
                toast({ title: 'Time Exceeds', description: 'Your code took too long to run.', variant: 'destructive' })
            } else if (response.compilation_status === 'Not Compiled Successfully') {
                toast({ title: 'Not Compiled Successfully', description: 'Check the output panel.', variant: 'destructive' })
            } else if (response.compilation_status === 'Compiled Successfully') {
                if (response.results.length > 0) {
                    const p = response.tests_passed, t = response.tests_total
                    toast({
                        title: p === t ? 'All Tests Passed!' : `${p}/${t} Tests Passed`,
                        variant: p === t ? 'default' : 'destructive',
                    })
                } else {
                    toast({ title: 'Compiled Successfully', description: 'Your code ran without errors.' })
                }
            }
        } catch (err: any) {
            const msg = err?.response?.data?.detail || 'Failed to run code'
            setError(msg)
            setRunResult({
                success: false, results: [], total_score: 0, max_score: 0,
                tests_passed: 0, tests_total: 0, message: msg, compilation_status: 'Not Compiled Successfully'
            })
            toast({ title: 'Execution Failed', description: msg, variant: 'destructive' })
        } finally {
            setIsRunning(false)
        }
    }

    /* ===== Submit ===== */

    const handleSubmit = () => {
        if (!files.length) {
            toast({ title: 'No files', description: 'Upload files before submitting.', variant: 'destructive' }); return
        }
        if (files.every(f => !f.content.trim())) {
            toast({ title: 'Empty files', description: 'Write code before submitting.', variant: 'destructive' }); return
        }
        if (attemptsLeft <= 0) {
            toast({ title: 'No attempts left', description: `You've used all ${maxAttempts} attempts.`, variant: 'destructive' }); return
        }
        if (assignment?.required_files?.length) {
            const missing = assignment.required_files.filter(rf => !files.some(f => f.name === rf))
            if (missing.length > 0) {
                toast({ title: 'Missing required files', description: `Required: ${missing.join(', ')}`, variant: 'destructive' }); return
            }
        }
        setSubmitPhase('confirm')
        setShowSubmitDialog(true)
    }

    const submitCode = async () => {
        if (!assignment) return
        setIsSubmitting(true)
        setError(null)
        setSubmitPhase('loading')

        try {
            const fileObjects = files.map((f) => {
                const blob = new Blob([f.content], { type: 'text/plain' })
                return new File([blob], f.name)
            })
            await apiClient.createSubmission(assignmentId, fileObjects)
            await queryClient.invalidateQueries({ queryKey: ['submissions', assignmentId] })
            setSubmitPhase('success')
            // Auto-redirect to course page after 2.5s
            setTimeout(() => {
                router.push(`/student/courses/${assignment.course.id}`)
            }, 2500)
        } catch (err: any) {
            const msg = err?.response?.data?.detail || 'Submission failed'
            setError(msg)
            toast({ title: 'Submission Failed', description: msg, variant: 'destructive' })
            setShowSubmitDialog(false)
        } finally {
            setIsSubmitting(false)
        }
    }

    const goToCourse = () => {
        setShowSubmitDialog(false)
        if (assignment?.course?.id) {
            router.push(`/student/courses/${assignment.course.id}`)
        } else {
            router.push('/student/courses')
        }
    }

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'Enter') {
                e.preventDefault(); if (!isRunning && files.length > 0) runCode()
            }
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Enter') {
                e.preventDefault(); if (!isSubmitting && files.length > 0) handleSubmit()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isRunning, isSubmitting, files.length])

    /* ===== RENDER ===== */

    if (isLoading) {
        return (
            <ProtectedRoute allowedRoles={['STUDENT']}>
                <div className="flex items-center justify-center h-screen bg-[#1e1e1e]">
                    <div className="text-center space-y-4">
                        <Loader2 className="w-10 h-10 mx-auto animate-spin text-[#0e639c]" />
                        <p className="text-sm text-[#858585]">Loading workspace...</p>
                    </div>
                </div>
            </ProtectedRoute>
        )
    }

    if (loadError || !assignment) {
        return (
            <ProtectedRoute allowedRoles={['STUDENT']}>
                <div className="flex items-center justify-center h-screen bg-[#1e1e1e]">
                    <div className="text-center space-y-6 p-8 border border-[#3c3c3c] rounded-xl bg-[#252526] max-w-md">
                        <AlertCircle className="w-16 h-16 mx-auto text-[#f44747]" />
                        <h2 className="text-xl font-bold text-[#cccccc]">Assignment Not Found</h2>
                        <p className="text-sm text-[#858585]">This assignment doesn't exist or you don't have access.</p>
                        <Button onClick={() => router.push('/student/courses')} className="bg-[#0e639c] hover:bg-[#1177bb] text-white">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Courses
                        </Button>
                    </div>
                </div>
            </ProtectedRoute>
        )
    }

    return (
        <ProtectedRoute allowedRoles={['STUDENT']}>
            <div className="flex flex-col h-screen bg-[#1e1e1e] text-[#cccccc] overflow-hidden">

                {/* ===== Title Bar ===== */}
                <div className="flex items-center justify-between bg-[#323233] px-4 py-1.5 border-b border-[#3c3c3c] select-none shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <Button variant="ghost" size="sm" onClick={() => router.back()}
                            className="h-6 px-2 text-[#cccccc] hover:text-white hover:bg-[#505050] text-xs shrink-0">
                            <ArrowLeft className="w-3 h-3 mr-1" /> Back
                        </Button>
                        <div className="h-3 w-px bg-[#5a5a5a]" />
                        <span className="text-xs text-[#cccccc] font-medium truncate">
                            {assignment.course?.code} &mdash; {assignment.title}
                        </span>
                        {isOverdue
                            ? <Badge variant="danger" className="text-[10px] px-1.5 py-0 shrink-0"><Clock className="w-2.5 h-2.5 mr-0.5" /> Overdue</Badge>
                            : <Badge variant="success" className="text-[10px] px-1.5 py-0 shrink-0">Active</Badge>
                        }
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-[#858585]">Due: {dueDate ? format(dueDate, 'MMM dd, yyyy · hh:mm a') : 'N/A'}</span>
                        <div className="h-3 w-px bg-[#5a5a5a]" />
                        <span className="text-[10px] text-[#858585]">{assignment.language?.display_name || 'N/A'}</span>
                        <div className="h-3 w-px bg-[#5a5a5a]" />
                        <span className="text-[10px] text-[#858585]">{assignment.max_score} pts</span>
                        {maxAttempts > 0 && (
                            <>
                                <div className="h-3 w-px bg-[#5a5a5a]" />
                                <span className={`text-[10px] ${attemptsLeft <= 1 ? 'text-red-400' : 'text-[#858585]'}`}>
                                    {attemptsLeft === Infinity ? '∞' : attemptsLeft} left
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* ===== Toolbar ===== */}
                <div className="flex items-center justify-between bg-[#252526] px-3 py-1 border-b border-[#3c3c3c] shrink-0">
                    <div className="flex items-center gap-1">
                        {latestSubmission && (
                            <span className="text-[10px] text-[#858585] mr-2 px-2 py-0.5 bg-[#333] rounded">
                                Last score: {latestSubmission.final_score ?? 'Grading...'}/{assignment.max_score}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setRightPanel(rightPanel === 'description' ? null : 'description')}
                            className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'description' ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#505050]'}`}>
                            <BookOpen className="w-3 h-3" /> Description
                        </button>
                        <button onClick={() => setRightPanel(rightPanel === 'instructions' ? null : 'instructions')}
                            className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'instructions' ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#505050]'}`}>
                            <Info className="w-3 h-3" /> Instructions
                        </button>
                        <button onClick={() => setRightPanel(rightPanel === 'rubric' ? null : 'rubric')}
                            className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'rubric' ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#505050]'}`}>
                            <ClipboardList className="w-3 h-3" /> Rubric
                        </button>
                        <button onClick={() => setRightPanel(rightPanel === 'history' ? null : 'history')}
                            className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'history' ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#505050]'}`}>
                            <History className="w-3 h-3" /> History
                            {submissions.length > 0 && <span className="px-1 py-0 text-[9px] bg-[#505050] rounded">{submissions.length}</span>}
                        </button>
                        <button onClick={() => setRightPanel(rightPanel === 'supplementary' ? null : 'supplementary')}
                            className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'supplementary' ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#505050]'}`}>
                            <Paperclip className="w-3 h-3" /> Files
                            {supplementaryFiles.length > 0 && <span className="px-1 py-0 text-[9px] bg-[#505050] rounded">{supplementaryFiles.length}</span>}
                        </button>
                        <div className="w-px h-4 bg-[#5a5a5a] mx-1" />
                        <Button onClick={runCode} disabled={isRunning || files.length === 0} size="sm"
                            className="h-6 px-3 text-[10px] bg-[#0e639c] hover:bg-[#1177bb] text-white border-0">
                            {isRunning
                                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running...</>
                                : <><Play className="w-3 h-3 mr-1" /> Run Code <span className="ml-1 text-[9px] opacity-60">⌘↵</span></>
                            }
                        </Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting || files.length === 0 || attemptsLeft <= 0} size="sm"
                            className="h-6 px-3 text-[10px] bg-[#862733] hover:bg-[#a03040] text-white border-0">
                            {isSubmitting
                                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Submitting...</>
                                : <><Send className="w-3 h-3 mr-1" /> Submit</>
                            }
                        </Button>
                    </div>
                </div>

                {/* ===== Main Content ===== */}
                <div className="flex flex-1 min-h-0">

                    {/* Activity Bar */}
                    <div className="w-12 bg-[#333333] border-r border-[#3c3c3c] flex flex-col items-center py-2 gap-1 shrink-0">
                        <button onClick={() => setExplorerOpen(!explorerOpen)} title="Explorer"
                            className={`w-10 h-10 flex items-center justify-center rounded hover:bg-[#505050] ${explorerOpen ? 'text-white border-l-2 border-white' : 'text-[#858585]'}`}>
                            <FileCode className="w-5 h-5" />
                        </button>
                        <button onClick={() => { setPanelOpen(true); setActivePanel('output') }} title="Output"
                            className={`w-10 h-10 flex items-center justify-center rounded hover:bg-[#505050] ${panelOpen && activePanel === 'output' ? 'text-white border-l-2 border-white' : 'text-[#858585]'}`}>
                            <Terminal className="w-5 h-5" />
                        </button>
                        <button onClick={() => { setPanelOpen(true); setActivePanel('tests') }} title="Tests"
                            className={`w-10 h-10 flex items-center justify-center rounded hover:bg-[#505050] ${panelOpen && activePanel === 'tests' ? 'text-white border-l-2 border-white' : 'text-[#858585]'}`}>
                            <Target className="w-5 h-5" />
                        </button>

                    </div>

                    {/* Explorer Sidebar */}
                    {explorerOpen && (
                        <div className="w-56 bg-[#252526] border-r border-[#3c3c3c] flex flex-col min-h-0 shrink-0">
                            <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb] flex items-center justify-between">
                                <span>Explorer</span>
                                <div className="flex gap-0.5">
                                    <button onClick={handleNewFile} className="p-0.5 rounded hover:bg-[#505050]" title="New File"><Plus className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => fileInputRef.current?.click()} className="p-0.5 rounded hover:bg-[#505050]" title="Upload"><UploadIcon className="w-3.5 h-3.5" /></button>
                                </div>
                            </div>
                            <input ref={fileInputRef} type="file" multiple hidden accept={allowedExtensions.join(',')} onChange={(e) => { handleUpload(e.target.files); e.target.value = '' }} />

                            <div className="px-2 py-1">
                                <div className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#cccccc]">
                                    <ChevronDown className="w-3 h-3" />
                                    <FolderOpen className="w-3.5 h-3.5 text-[#dcb67a]" />
                                    <span className="font-medium truncate">{assignment.title.substring(0, 18)}</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto px-1"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}>
                                {files.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 cursor-pointer text-center"
                                        onClick={() => fileInputRef.current?.click()}>
                                        <UploadIcon className="w-8 h-8 text-[#505050] mb-2" />
                                        <p className="text-[11px] text-[#858585]">Drop files or click to upload</p>
                                        <p className="text-[10px] text-[#606060] mt-1">Max {maxFileSizeMB}MB per file</p>
                                    </div>
                                ) : (
                                    <div className="space-y-0.5 pl-4">
                                        {files.map((file) => (
                                            <div key={file.name} onClick={() => setSelectedFile(file)}
                                                className={`group flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-[12px] ${selectedFile?.name === file.name ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#2a2d2e]'}`}>
                                                <span className="text-xs">{getFileIcon(file.name)}</span>
                                                <span className="flex-1 truncate font-mono text-[12px]">{file.name}</span>
                                                <button onClick={(e) => { e.stopPropagation(); removeFile(file.name) }}
                                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/30 text-[#858585] hover:text-red-400">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="px-3 py-2 border-t border-[#3c3c3c] text-[10px] text-[#858585]">
                                <p>{files.length} file{files.length !== 1 ? 's' : ''}</p>
                                <p className="mt-0.5 text-[#606060]">Allowed: {allowedExtensions.join(', ')} · Max {maxFileSizeMB}MB</p>
                            </div>
                        </div>
                    )}

                    {/* ===== Center: Editor + Bottom Panel ===== */}
                    <div className="flex-1 flex flex-col min-h-0 min-w-0">
                        {/* Editor Tabs */}
                        <div className="bg-[#252526] border-b border-[#3c3c3c] flex items-center min-h-[35px] overflow-x-auto shrink-0">
                            {files.map((file) => (
                                <div key={file.name} onClick={() => setSelectedFile(file)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-[12px] border-r border-[#3c3c3c] shrink-0 ${selectedFile?.name === file.name ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#0e639c]' : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#2d2d2d]/80'}`}>
                                    <span className="text-xs">{getFileIcon(file.name)}</span>
                                    <span className="font-mono">{file.name}</span>
                                    <button onClick={(e) => { e.stopPropagation(); removeFile(file.name) }} className="ml-1 p-0.5 rounded hover:bg-[#505050]">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {files.length === 0 && <div className="px-3 py-1.5 text-[12px] text-[#858585]">No files open</div>}
                        </div>

                        {/* Editor + Bottom Panel */}
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* Code Editor */}
                            <div className={`${panelOpen ? 'flex-[6]' : 'flex-1'} min-h-0 overflow-hidden`}>
                                {selectedFile ? (
                                    <div className="h-full flex">
                                        <div className="bg-[#1e1e1e] text-[#858585] text-right pr-3 pl-4 pt-2 select-none overflow-hidden font-mono text-[13px] leading-[20px] border-r border-[#3c3c3c] min-w-[50px]">
                                            {editorLines.map((_, i) => <div key={i} className="h-[20px]">{i + 1}</div>)}
                                        </div>
                                        <textarea
                                            value={selectedFile.content}
                                            onChange={(e) => updateFileContent(e.target.value)}
                                            className="flex-1 bg-[#1e1e1e] text-[#d4d4d4] p-2 pl-4 font-mono text-[13px] leading-[20px] outline-none resize-none"
                                            placeholder="// Start typing your code..."
                                            spellCheck={false} autoCapitalize="off" autoCorrect="off" data-gramm="false"
                                        />
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center bg-[#1e1e1e]">
                                        <div className="text-center space-y-4">
                                            <Code className="w-16 h-16 mx-auto text-[#505050]" />
                                            <p className="text-sm text-[#858585]">
                                                {files.length > 0 ? 'Select a file to start editing' : 'Upload or create a file to get started'}
                                            </p>
                                            {files.length === 0 && (
                                                <div className="flex gap-2 justify-center">
                                                    <Button onClick={handleNewFile} size="sm" className="bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs h-7">
                                                        <Plus className="w-3 h-3 mr-1" /> New File
                                                    </Button>
                                                    <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="outline" className="text-[#cccccc] border-[#505050] hover:bg-[#505050] text-xs h-7">
                                                        <UploadIcon className="w-3 h-3 mr-1" /> Upload
                                                    </Button>
                                                </div>
                                            )}
                                            <div className="text-[11px] text-[#606060] space-y-1">
                                                <p><kbd className="px-1 py-0.5 rounded bg-[#333] text-[#aaa]">⌘+Enter</kbd> run &nbsp; <kbd className="px-1 py-0.5 rounded bg-[#333] text-[#aaa]">⌘+Shift+Enter</kbd> submit</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Bottom Panel */}
                            {panelOpen && (
                                <div className="flex-[4] min-h-[100px] border-t border-[#3c3c3c] flex flex-col bg-[#1e1e1e]">
                                    <div className="flex items-center bg-[#252526] border-b border-[#3c3c3c] px-2 shrink-0">
                                        <button onClick={() => setActivePanel('output')}
                                            className={`px-3 py-1.5 text-[11px] font-medium border-b-2 ${activePanel === 'output' ? 'border-[#0e639c] text-white' : 'border-transparent text-[#858585] hover:text-[#cccccc]'}`}>
                                            <Terminal className="w-3 h-3 inline mr-1" /> OUTPUT
                                        </button>
                                        <button onClick={() => setActivePanel('tests')}
                                            className={`px-3 py-1.5 text-[11px] font-medium border-b-2 ${activePanel === 'tests' ? 'border-[#0e639c] text-white' : 'border-transparent text-[#858585] hover:text-[#cccccc]'}`}>
                                            <Target className="w-3 h-3 inline mr-1" /> TESTS
                                            {runResult && runResult.results.length > 0 && (
                                                <span className={`ml-1 px-1.5 py-0 text-[9px] rounded-full ${runResult.tests_passed === runResult.tests_total ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {runResult.tests_passed}/{runResult.tests_total}
                                                </span>
                                            )}
                                        </button>
                                        <div className="flex-1" />
                                        <button onClick={() => setPanelOpen(false)} className="p-1 rounded hover:bg-[#505050] text-[#858585]"><X className="w-3 h-3" /></button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-3 font-mono text-[12px]">
                                        {activePanel === 'output' ? (
                                            <div>
                                                {isRunning ? (
                                                    <div className="flex items-center gap-2 text-[#569cd6]">
                                                        <Loader2 className="w-4 h-4 animate-spin" /> Running your code...
                                                    </div>
                                                ) : runResult ? (
                                                    <div className="space-y-3">
                                                        {/* Compilation Status Banner */}
                                                        <div className={`flex items-center gap-3 p-3 rounded-lg ${runResult.compilation_status === 'Compiled Successfully'
                                                                ? 'bg-[#0d2818] border border-[#2ea04366]'
                                                                : runResult.compilation_status === 'Time Exceeds'
                                                                    ? 'bg-[#332b00] border border-[#665500]'
                                                                    : 'bg-[#2d0000] border border-[#5c1e1e]'
                                                            }`}>
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${runResult.compilation_status === 'Compiled Successfully'
                                                                    ? 'bg-[#2ea043]/20'
                                                                    : runResult.compilation_status === 'Time Exceeds'
                                                                        ? 'bg-[#dcdcaa]/20'
                                                                        : 'bg-[#f44747]/20'
                                                                }`}>
                                                                {runResult.compilation_status === 'Compiled Successfully'
                                                                    ? <CheckCircle2 className="w-5 h-5 text-[#4ec9b0]" />
                                                                    : runResult.compilation_status === 'Time Exceeds'
                                                                        ? <Clock className="w-5 h-5 text-[#dcdcaa]" />
                                                                        : <XCircle className="w-5 h-5 text-[#f44747]" />
                                                                }
                                                            </div>
                                                            <div>
                                                                <p className={`text-[13px] font-semibold ${runResult.compilation_status === 'Compiled Successfully' ? 'text-[#4ec9b0]'
                                                                        : runResult.compilation_status === 'Time Exceeds' ? 'text-[#dcdcaa]'
                                                                            : 'text-[#f44747]'
                                                                    }`}>
                                                                    {runResult.compilation_status || (runResult.success ? 'Compiled Successfully' : 'Not Compiled Successfully')}
                                                                </p>
                                                                {runResult.results.length === 0 && runResult.compilation_status === 'Compiled Successfully' && (
                                                                    <p className="text-[11px] text-[#858585] mt-0.5">Your code ran without errors.</p>
                                                                )}
                                                                {runResult.compilation_status === 'Time Exceeds' && (
                                                                    <p className="text-[11px] text-[#858585] mt-0.5">Your code exceeded the time limit.</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {runResult.message && runResult.compilation_status !== 'Compiled Successfully' && (
                                                            <pre className="text-[#f44747] whitespace-pre-wrap text-[11px] leading-relaxed bg-[#2d0000] p-3 rounded border border-[#5c1e1e]">{runResult.message}</pre>
                                                        )}
                                                        {runResult.results.length > 0 && (
                                                            <div className="pt-2 border-t border-[#3c3c3c]">
                                                                <div className="text-[#858585] text-[11px] mb-2">Test Results: {runResult.tests_passed}/{runResult.tests_total} passed</div>
                                                                {runResult.results.map((r) => (
                                                                    <div key={r.id} className={`flex items-center gap-2 py-0.5 ${r.passed ? 'text-[#4ec9b0]' : 'text-[#f44747]'}`}>
                                                                        {r.passed ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                                                                        <span>{r.name} {r.passed ? 'passed' : 'failed'}{r.error && r.error !== 'Output does not match expected' ? ` — ${r.error}` : ''}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-[#858585] space-y-1">
                                                        <p>{'>'} Ready. Press <span className="text-[#569cd6]">Run Code</span> or <kbd className="px-1 py-0.5 rounded bg-[#333] text-[#aaa] text-[10px]">⌘+Enter</kbd></p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div>
                                                {isRunning ? (
                                                    <div className="flex items-center gap-2 text-[#569cd6]"><Loader2 className="w-4 h-4 animate-spin" /> Running tests...</div>
                                                ) : runResult && runResult.results.length > 0 ? (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-3 mb-3 pb-2 border-b border-[#3c3c3c]">
                                                            <div className={`text-sm font-bold ${runResult.tests_passed === runResult.tests_total ? 'text-[#4ec9b0]' : 'text-[#f44747]'}`}>
                                                                {runResult.tests_passed === runResult.tests_total ? 'All Tests Passed!' : `${runResult.tests_passed}/${runResult.tests_total} Passed`}
                                                            </div>
                                                            <div className="flex-1 h-2 bg-[#333] rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full transition-all duration-500 ${runResult.tests_passed === runResult.tests_total ? 'bg-[#4ec9b0]' : 'bg-[#f44747]'}`}
                                                                    style={{ width: `${runResult.tests_total > 0 ? (runResult.tests_passed / runResult.tests_total) * 100 : 0}%` }} />
                                                            </div>
                                                            <span className="text-[10px] text-[#858585]">{runResult.total_score}/{runResult.max_score} pts</span>
                                                        </div>
                                                        {runResult.results.map((test) => (
                                                            <div key={test.id} className={`flex items-center gap-3 px-3 py-2 rounded border ${test.passed ? 'border-[#2ea04366] bg-[#2ea04310]' : 'border-[#f4474766] bg-[#f4474710]'}`}>
                                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${test.passed ? 'bg-[#2ea043] text-white' : 'bg-[#f44747] text-white'}`}>
                                                                    {test.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className={`text-[12px] font-medium ${test.passed ? 'text-[#4ec9b0]' : 'text-[#f44747]'}`}>
                                                                        {test.name} &mdash; {test.passed ? 'passed' : 'failed'}
                                                                    </div>
                                                                    {test.error && test.error !== 'Output does not match expected' && (
                                                                        <div className="text-[10px] text-[#f44747] mt-0.5">{test.error}</div>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-[#858585]">{test.score}/{test.max_score} pts</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : runResult && runResult.results.length === 0 ? (
                                                    <div className="text-center py-8 space-y-3">
                                                        <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${runResult.compilation_status === 'Compiled Successfully'
                                                                ? 'bg-[#2ea043]/20' : 'bg-[#f44747]/20'
                                                            }`}>
                                                            {runResult.compilation_status === 'Compiled Successfully'
                                                                ? <CheckCircle2 className="w-7 h-7 text-[#4ec9b0]" />
                                                                : <XCircle className="w-7 h-7 text-[#f44747]" />
                                                            }
                                                        </div>
                                                        <p className={`text-[13px] font-semibold ${runResult.compilation_status === 'Compiled Successfully' ? 'text-[#4ec9b0]' : 'text-[#f44747]'
                                                            }`}>
                                                            {runResult.compilation_status || (runResult.success ? 'Compiled Successfully' : 'Not Compiled Successfully')}
                                                        </p>
                                                        <p className="text-[11px] text-[#858585]">
                                                            No test cases for this assignment.
                                                            {runResult.compilation_status === 'Compiled Successfully'
                                                                ? ' Your code compiled and ran without errors.'
                                                                : ' Check the output panel for details.'}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-8">
                                                        <Target className="w-10 h-10 mx-auto text-[#505050] mb-3" />
                                                        <p className="text-[12px] text-[#858585]">No test results yet</p>
                                                        <p className="text-[11px] text-[#606060] mt-1">Run your code to see results</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ===== Right Panel (Copilot-style) ===== */}
                    {rightPanel && (
                        <div className="w-80 bg-[#252526] border-l border-[#3c3c3c] flex flex-col min-h-0 shrink-0">
                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#3c3c3c] shrink-0">
                                <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
                                    {rightPanel === 'description' && <><BookOpen className="w-4 h-4 text-[#569cd6]" /> Description</>}
                                    {rightPanel === 'instructions' && <><Info className="w-4 h-4 text-[#dcdcaa]" /> Instructions</>}
                                    {rightPanel === 'rubric' && <><ClipboardList className="w-4 h-4 text-[#c586c0]" /> Rubric</>}
                                    {rightPanel === 'history' && <><History className="w-4 h-4 text-[#4ec9b0]" /> Submissions</>}
                                    {rightPanel === 'supplementary' && <><Paperclip className="w-4 h-4 text-[#dcdcaa]" /> Supplementary Files</>}
                                </div>
                                <button onClick={() => setRightPanel(null)} className="p-1 rounded hover:bg-[#505050] text-[#858585]">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 text-[13px] leading-relaxed">
                                {rightPanel === 'description' && (
                                    <div className="space-y-4">
                                        <p className="text-[#cccccc] whitespace-pre-wrap">{assignment.description || 'No description provided.'}</p>
                                        <div className="grid grid-cols-2 gap-2 mt-4">
                                            <div className="bg-[#1e1e1e] p-2.5 rounded border border-[#3c3c3c]">
                                                <p className="text-[10px] text-[#858585] uppercase">Language</p>
                                                <p className="text-[12px] text-white font-medium mt-0.5">{assignment.language?.display_name || 'N/A'}</p>
                                            </div>
                                            <div className="bg-[#1e1e1e] p-2.5 rounded border border-[#3c3c3c]">
                                                <p className="text-[10px] text-[#858585] uppercase">Max Score</p>
                                                <p className="text-[12px] text-white font-medium mt-0.5">{assignment.max_score} pts</p>
                                            </div>
                                            <div className="bg-[#1e1e1e] p-2.5 rounded border border-[#3c3c3c]">
                                                <p className="text-[10px] text-[#858585] uppercase">Difficulty</p>
                                                <p className="text-[12px] text-white font-medium mt-0.5 capitalize">{assignment.difficulty || 'Medium'}</p>
                                            </div>
                                            <div className="bg-[#1e1e1e] p-2.5 rounded border border-[#3c3c3c]">
                                                <p className="text-[10px] text-[#858585] uppercase">Attempts</p>
                                                <p className="text-[12px] text-white font-medium mt-0.5">{maxAttempts > 0 ? `${submissions.length}/${maxAttempts}` : `${submissions.length} (∞)`}</p>
                                            </div>
                                        </div>
                                        {assignment.allow_late && (
                                            <div className="bg-[#332b00] border border-[#665500] p-3 rounded">
                                                <p className="text-[11px] font-medium text-[#dcdcaa]">Late Policy</p>
                                                <p className="text-[11px] text-[#cccccc] mt-1">{assignment.late_penalty_per_day}% penalty/day, up to {assignment.max_late_days} days</p>
                                            </div>
                                        )}
                                        {allowedExtensions.length > 0 && (
                                            <div className="bg-[#1e1e1e] border border-[#3c3c3c] p-3 rounded">
                                                <p className="text-[11px] font-medium text-[#569cd6]">Allowed File Types</p>
                                                <p className="text-[11px] text-[#cccccc] mt-1">Only these extensions can be submitted: <code className="px-1 py-0.5 bg-[#333] rounded text-[#dcdcaa]">{allowedExtensions.join(', ')}</code></p>
                                            </div>
                                        )}
                                        {assignment.required_files && assignment.required_files.length > 0 && (
                                            <div className="bg-[#1e1e1e] border border-[#3c3c3c] p-3 rounded">
                                                <p className="text-[11px] font-medium text-[#569cd6]">Required Files</p>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {assignment.required_files.map(f => {
                                                        const exists = files.some(uf => uf.name === f)
                                                        return (
                                                            <span key={f} className={`text-[10px] px-1.5 py-0.5 rounded ${exists ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                                {exists ? '✓' : '✗'} {f}
                                                            </span>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {rightPanel === 'instructions' && (
                                    <div>
                                        {assignment.instructions ? (
                                            <pre className="whitespace-pre-wrap text-[12px] text-[#cccccc] leading-relaxed font-sans">{assignment.instructions}</pre>
                                        ) : (
                                            <div className="text-center py-8">
                                                <Info className="w-10 h-10 mx-auto text-[#505050] mb-3" />
                                                <p className="text-[#858585]">No instructions provided.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {rightPanel === 'rubric' && (
                                    <div>
                                        {assignment.rubric ? (
                                            <div className="space-y-3">
                                                <div className="bg-[#1e1e1e] p-3 rounded border border-[#3c3c3c]">
                                                    <p className="text-[11px] text-[#858585]">Grading Weight</p>
                                                    <div className="flex gap-4 mt-1">
                                                        <span className="text-[12px] text-[#4ec9b0]">Tests: {assignment.test_weight}%</span>
                                                        <span className="text-[12px] text-[#c586c0]">Rubric: {assignment.rubric_weight}%</span>
                                                    </div>
                                                    <div className="flex h-2 mt-2 rounded-full overflow-hidden bg-[#333]">
                                                        <div className="bg-[#4ec9b0]" style={{ width: `${assignment.test_weight}%` }} />
                                                        <div className="bg-[#c586c0]" style={{ width: `${assignment.rubric_weight}%` }} />
                                                    </div>
                                                </div>
                                                <p className="text-[11px] text-[#858585]">Detailed rubric criteria are evaluated during grading.</p>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8">
                                                <ClipboardList className="w-10 h-10 mx-auto text-[#505050] mb-3" />
                                                <p className="text-[#858585]">No rubric for this assignment.</p>
                                                <p className="text-[10px] text-[#606060] mt-1">Grading: {assignment.test_weight}% tests</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {rightPanel === 'supplementary' && (
                                    <div>
                                        {supplementaryFiles.length === 0 ? (
                                            <div className="text-center py-8">
                                                <Paperclip className="w-10 h-10 mx-auto text-[#505050] mb-3" />
                                                <p className="text-[#858585]">No supplementary files</p>
                                                <p className="text-[10px] text-[#606060] mt-1">Your instructor has not added any files.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <p className="text-[11px] text-[#858585] mb-3">Download reference materials from your instructor.</p>
                                                {supplementaryFiles.map((f: { filename: string; download_url: string; size?: number }) => (
                                                    <a
                                                        key={f.filename}
                                                        href={f.download_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-3 p-3 rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] hover:bg-[#2a2d2e] hover:border-[#505050] transition-colors group"
                                                    >
                                                        <div className="w-9 h-9 rounded-lg bg-[#094771]/20 flex items-center justify-center shrink-0">
                                                            <FileCode className="w-4 h-4 text-[#569cd6]" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[12px] font-medium text-white truncate">{f.filename}</p>
                                                            {f.size != null && f.size > 0 && (
                                                                <p className="text-[10px] text-[#858585]">{(f.size / 1024).toFixed(1)} KB</p>
                                                            )}
                                                        </div>
                                                        <Download className="w-4 h-4 text-[#858585] group-hover:text-[#569cd6] shrink-0" />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {rightPanel === 'history' && (
                                    <div>
                                        {isLoadingSubs ? (
                                            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#0e639c]" /></div>
                                        ) : submissions.length === 0 ? (
                                            <div className="text-center py-8">
                                                <History className="w-10 h-10 mx-auto text-[#505050] mb-3" />
                                                <p className="text-[#858585]">No submissions yet</p>
                                                <p className="text-[10px] text-[#606060] mt-1">Submit your code to see history</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <p className="text-[11px] text-[#858585] mb-3">
                                                    {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
                                                    {maxAttempts > 0 && ` · ${attemptsLeft} left`}
                                                </p>
                                                {submissions.map((sub, i) => (
                                                    <div key={sub.id} className={`p-3 rounded border ${i === 0 ? 'border-[#0e639c]/50 bg-[#0e639c]/10' : 'border-[#3c3c3c] bg-[#1e1e1e]'}`}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[12px] font-medium text-white">#{sub.attempt_number}</span>
                                                                {i === 0 && <span className="text-[9px] px-1 py-0 bg-[#0e639c] text-white rounded">Latest</span>}
                                                                {sub.is_late && <span className="text-[9px] px-1 py-0 bg-[#665500] text-[#dcdcaa] rounded">Late</span>}
                                                            </div>
                                                            <span className="text-[14px] font-bold text-white">
                                                                {sub.final_score !== null ? sub.final_score.toFixed(1) : '-'}
                                                                <span className="text-[10px] text-[#858585] font-normal">/{assignment.max_score}</span>
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-[#858585] mt-1">
                                                            {format(new Date(sub.submitted_at || sub.created_at), 'MMM dd, yyyy · hh:mm a')}
                                                            {sub.tests_total > 0 && ` · ${sub.tests_passed}/${sub.tests_total} tests`}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ===== Status Bar ===== */}
                <div className="flex items-center justify-between bg-[#007acc] px-3 py-0.5 text-white text-[11px] select-none shrink-0">
                    <div className="flex items-center gap-3">
                        {isRunning ? (
                            <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Running...</span>
                        ) : runResult ? (
                            <span className="flex items-center gap-1">
                                {runResult.compilation_status === 'Compiled Successfully' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {runResult.compilation_status}
                                {runResult.results.length > 0 && ` · ${runResult.tests_passed}/${runResult.tests_total} tests`}
                            </span>
                        ) : <span>Ready</span>}
                    </div>
                    <div className="flex items-center gap-3">
                        <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
                        {selectedFile && (
                            <><span>Ln {editorLines.length}</span><span>{(selectedFile.size / 1024).toFixed(1)} KB</span></>
                        )}
                        <span>{assignment.language?.display_name || 'N/A'}</span>
                    </div>
                </div>
            </div>

            {/* ===== Error Toast ===== */}
            {error && (
                <div className="fixed bottom-4 right-4 z-50 max-w-md bg-[#5c1e1e] text-[#f44747] border border-[#f44747]/30 px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm flex-1">{error}</p>
                    <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* ===== Submit Modal (Confirm → Loading → Success) ===== */}
            <Modal
                isOpen={showSubmitDialog}
                onClose={submitPhase === 'loading' ? () => { } : () => setShowSubmitDialog(false)}
                size="sm"
            >
                {submitPhase === 'confirm' && (
                    <div className="space-y-5">
                        <div className="text-center">
                            <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                <Send className="w-7 h-7 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Confirm Submission</h3>
                            <p className="text-sm text-gray-600 mt-2">
                                Are you sure you want to submit <strong>{files.length} file{files.length !== 1 ? 's' : ''}</strong> for grading?
                            </p>
                            <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
                                <p className="text-sm font-medium text-amber-800">
                                    This submission must be your own original work. No AI assistance or plagiarism is allowed.
                                </p>
                            </div>
                        </div>
                        {isOverdue && (
                            <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-red-800">Late Submission</p>
                                    <p className="text-xs text-red-700 mt-0.5">
                                        Due date was {dueDate ? format(dueDate, 'MMM dd, yyyy · hh:mm a') : 'N/A'}. A {assignment.late_penalty_per_day}%/day penalty applies.
                                    </p>
                                </div>
                            </div>
                        )}
                        {maxAttempts > 0 && (
                            <p className="text-xs text-gray-500 text-center">
                                This will use attempt <strong>{submissions.length + 1}</strong> of <strong>{maxAttempts}</strong>.
                            </p>
                        )}
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700">Files to submit:</p>
                            <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg border border-gray-200 p-2">
                                {files.map(f => (
                                    <div key={f.name} className="flex items-center justify-between px-2 py-1.5 rounded bg-gray-50 text-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span>{getFileIcon(f.name)}</span>
                                            <span className="font-mono text-xs truncate">{f.name}</span>
                                        </div>
                                        <span className="text-xs text-gray-500 shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <ModalFooter className="gap-3 pt-2">
                            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
                                Cancel
                            </Button>
                            <Button onClick={submitCode} className="bg-primary hover:bg-primary-700 text-white">
                                <Send className="w-4 h-4 mr-2" /> Submit Now
                            </Button>
                        </ModalFooter>
                    </div>
                )}

                {submitPhase === 'loading' && (
                    <div className="flex flex-col items-center justify-center py-12 px-4 space-y-6">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Send className="w-6 h-6 text-primary" />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <h3 className="text-lg font-semibold text-gray-900">Submitting Your Code...</h3>
                            <p className="text-sm text-gray-500">
                                Uploading {files.length} file{files.length !== 1 ? 's' : ''} for grading
                            </p>
                        </div>
                        <div className="w-40 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '75%' }} />
                        </div>
                    </div>
                )}

                {submitPhase === 'success' && (
                    <div className="flex flex-col items-center justify-center py-8 px-4 space-y-5">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle2 className="w-10 h-10 text-green-600" />
                            </div>
                            <div className="absolute -top-1 -right-1">
                                <PartyPopper className="w-7 h-7 text-amber-500" />
                            </div>
                        </div>
                        <div className="text-center space-y-1">
                            <h3 className="text-xl font-bold text-gray-900">Submitted Successfully</h3>
                            <p className="text-sm text-gray-600 max-w-xs">
                                Your code has been submitted for grading. You'll see your results once grading is complete.
                            </p>
                        </div>
                        {maxAttempts > 0 && (
                            <p className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                                Attempt {submissions.length}/{maxAttempts} used
                            </p>
                        )}
                        <p className="text-xs text-gray-400">Redirecting to course...</p>
                        <Button onClick={goToCourse} className="bg-primary hover:bg-primary-700 text-white w-full sm:w-auto">
                            Go to Course
                        </Button>
                    </div>
                )}
            </Modal>
        </ProtectedRoute>
    )
}
