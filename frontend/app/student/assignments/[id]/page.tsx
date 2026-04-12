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
    CheckCircle2,
    XCircle,
    Info,
    BookOpen,
    ClipboardList,
    Terminal,
    Code,
    ChevronDown,
    ChevronUp,
    Clock,
    Plus,
    PartyPopper,
    Paperclip,
    Download,
    Users,
    Crown,
} from 'lucide-react'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Button } from '@/components/ui/button'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { ConfettiPopup } from '@/components/ui/confetti-popup'
import { InteractiveTerminal, type InteractiveTerminalRef } from '@/components/InteractiveTerminal'
import { useInteractiveTerminal } from '@/hooks/useInteractiveTerminal'

/* ====================================================================
   TYPES
   ==================================================================== */

interface UploadedFile {
    name: string
    content: string
    size: number
    readOnly?: boolean
    origin?: 'student' | 'utility'
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
    stdout?: string | null
    stderr?: string | null
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
    allow_late: boolean
    late_penalty_per_day: number
    max_late_days: number
    allow_groups: boolean
    max_group_size: number
    grades_published: boolean
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

interface GroupMember {
    id: number
    user_id: number
    full_name: string
    email: string
    student_id: string | null
    is_leader: boolean
}

interface MyGroup {
    id: number
    name: string
    max_members: number
    created_at: string
    members: GroupMember[]
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
    late_penalty_applied?: number | null
    attempt_number: number
}

interface SubmissionDetail extends SubmissionItem {
    test_score?: number | null
    rubric_score?: number | null
    raw_score?: number | null
    max_score?: number | null
    override_score?: number | null
    late_penalty_applied?: number | null
    feedback?: string | null
    rubric_scores?: { rubric_item_id: number; score: number; max_score: number; comment?: string | null; item?: { name?: string; description?: string; min_points?: number; max_points?: number; points?: number } }[]
    files?: { id: number; filename: string }[]
}

const FILE_ICONS: Record<string, string> = {
    '.py': '🐍',
    '.java': '☕',
    '.txt': '📄',
    '.md': '📝',
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
    const datasetFileInputRef = useRef<HTMLInputElement>(null)
    const runInputFileRef = useRef<HTMLInputElement>(null)

    // State
    const [files, setFiles] = useState<UploadedFile[]>([])
    const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null)
    const [runResult, setRunResult] = useState<RunCodeResult | null>(null)
    const terminalRef = useRef<InteractiveTerminalRef>(null)
    const { output: interactiveOutput, running: interactiveRunning, exitCode: interactiveExitCode, setOutput: setInteractiveOutput, setExitCode: setInteractiveExitCode, start: startInteractiveTerminal, sendStdin: sendInteractiveStdin, close: closeInteractiveTerminal, outputEndRef: interactiveOutputEndRef } = useInteractiveTerminal({ assignmentId })
    // User-uploaded test datasets (run in addition to professor tests)
    const [uploadedDatasets, setUploadedDatasets] = useState<{ name: string; content: string }[]>([])
    const [datasetRunResults, setDatasetRunResults] = useState<{ name: string; stdout?: string; stderr?: string; compilation_status?: string; success: boolean }[]>([])
    const [testInputMode, setTestInputMode] = useState<'stdin' | 'file'>('stdin')
    const [customInput, setCustomInput] = useState('')
    const [inputFileName, setInputFileName] = useState('input.txt')
    const [inputFileContent, setInputFileContent] = useState('')
    // Custom input mode: either stdin text OR a single input file.
    const [datasetInputMode, setDatasetInputMode] = useState<'stdin' | 'file'>('stdin')
    const [isRunning, setIsRunning] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showSubmitDialog, setShowSubmitDialog] = useState(false)
    const [submitPhase, setSubmitPhase] = useState<'confirm' | 'loading' | 'success'>('confirm')
    const [error, setError] = useState<string | null>(null)
    const [explorerOpen, setExplorerOpen] = useState(true)
    const [panelOpen, setPanelOpen] = useState(true)
    const [activePanel, setActivePanel] = useState<'output' | 'tests'>('output')
    const [rightPanel, setRightPanel] = useState<'description' | 'instructions' | 'rubric' | 'grading' | 'supplementary' | 'custom' | 'group' | null>(null)
    const [showConfetti, setShowConfetti] = useState(false)
    const [expandedTests, setExpandedTests] = useState<Set<number>>(new Set())
    const [submittedAttemptNum, setSubmittedAttemptNum] = useState<number | null>(null)

    // API
    const { data: assignment, isLoading, error: loadError } = useQuery<Assignment>({
        queryKey: ['assignment', assignmentId],
        queryFn: () => apiClient.getAssignment(assignmentId),
        retry: 2,
    })

    const { data: submissionsAll = [], isLoading: isLoadingSubs } = useQuery<SubmissionItem[]>({
        queryKey: ['submissions', assignmentId],
        queryFn: () => apiClient.getSubmissions(assignmentId),
        enabled: !!assignment,
    })

    const { data: supplementaryFiles = [] } = useQuery({
        queryKey: ['assignment-supplementary', assignmentId],
        queryFn: () => apiClient.getAssignmentSupplementaryFiles(assignmentId),
        enabled: !!assignmentId && !!assignment,
    })

    const { data: myGroup } = useQuery<MyGroup | null>({
        queryKey: ['my-group', assignment?.course?.id],
        queryFn: () => apiClient.getMyGroup(assignment!.course.id),
        enabled: !!assignment?.allow_groups && !!assignment?.course?.id,
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

    const toggleTestDetails = (id: number) => {
        setExpandedTests(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }
    const maxFileSizeMB = assignment?.max_file_size_mb || 10
    const maxFileSize = maxFileSizeMB * 1024 * 1024
    const isOverdue = useMemo(() => assignment ? new Date(assignment.due_date) < new Date() : false, [assignment])
    const dueDate = useMemo(() => assignment ? new Date(assignment.due_date) : null, [assignment])
    const submissions = useMemo(() => (submissionsAll.length > 0 ? [submissionsAll[0]] : []), [submissionsAll])
    const latestSubmission = useMemo(() => submissions.length > 0 ? submissions[0] : null, [submissions])
    const maxAttempts = assignment?.max_attempts || 0
    const attemptsUsed = latestSubmission?.attempt_number ?? 0
    const attemptsLeft = maxAttempts > 0 ? Math.max(maxAttempts - attemptsUsed, 0) : Infinity

    const gradesPublished = !!assignment?.grades_published

    const isGraded = useMemo(() => {
        if (!latestSubmission || !gradesPublished) return false
        if (latestSubmission.final_score !== null) return true
        const s = String(latestSubmission.status || '').toLowerCase()
        return s === 'completed' || s === 'graded'
    }, [latestSubmission, gradesPublished])

    const isSubmitted = !!latestSubmission
    const isAwaitingGrade = isSubmitted && !isGraded

    // Auto-open grading panel when grade becomes available
    useEffect(() => {
        if (isGraded && rightPanel === null) {
            setRightPanel('grading')
        }
    }, [isGraded]) // eslint-disable-line react-hooks/exhaustive-deps

    const { data: latestSubmissionDetail } = useQuery<SubmissionDetail>({
        queryKey: ['submission', latestSubmission?.id],
        queryFn: () => apiClient.getSubmission(latestSubmission!.id),
        enabled: !!latestSubmission?.id,
    })

    const editorLines = (selectedFile?.content || '').split('\n')
    const hasStdinInput = customInput.trim().length > 0
    const hasTestFileInput = inputFileContent.trim().length > 0

    // No auto-loaded starter code; students start with their own files.

    const hasLoadedFromLastSubmission = useRef(false)

    useEffect(() => {
        if (!latestSubmissionDetail || hasLoadedFromLastSubmission.current) return
        hasLoadedFromLastSubmission.current = true
        const loadLastSubmissionFiles = async () => {
            try {
                const loadedFiles: UploadedFile[] = []
                for (const f of latestSubmissionDetail.files ?? []) {
                    const fileData = await apiClient.getSubmissionFileContent(latestSubmissionDetail.id, f.id)
                    loadedFiles.push({
                        name: fileData.filename,
                        content: fileData.content ?? '',
                        size: (fileData.content ?? '').length,
                        readOnly: false,
                        origin: 'student',
                    })
                }
                if (loadedFiles.length > 0) {
                    setFiles(loadedFiles)
                    setSelectedFile(loadedFiles[0])
                }
            } catch (e) {
                // Silently ignore load failures; student can still upload new files.
            }
        }
        loadLastSubmissionFiles()
    }, [latestSubmissionDetail])

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
                const newFile: UploadedFile = { name: file.name, content, size: file.size, origin: 'student' }
                setFiles((prev) => {
                    const idx = prev.findIndex((f) => f.name === file.name)
                    if (idx >= 0) { const u = [...prev]; u[idx] = newFile; return u }
                    return [...prev, newFile]
                })
                setSelectedFile(newFile)
                // Immediately allow renaming newly added file
                setEditingFileName(file.name)
                setRenameDraft(file.name)
            }
            reader.readAsText(file)
        }
    }, [maxFileSize, maxFileSizeMB, allowedExtensions, toast])

    // Students can only upload files (no file creation) to reduce complexity.

    const removeFile = useCallback((name: string) => {
        const target = files.find((f) => f.name === name)
        if (target?.readOnly || target?.origin === 'utility') return
        setFiles((prev) => prev.filter((f) => f.name !== name))
        if (selectedFile?.name === name) {
            const rest = files.filter(f => f.name !== name)
            setSelectedFile(rest.length > 0 ? rest[0] : null)
        }
        setEditingFileName(null)
    }, [selectedFile, files])

    const [editingFileName, setEditingFileName] = useState<string | null>(null)
    const [renameDraft, setRenameDraft] = useState('')
    const renameInputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        if (!editingFileName) return
        const t = window.setTimeout(() => {
            renameInputRef.current?.focus()
            renameInputRef.current?.select()
        }, 0)
        return () => window.clearTimeout(t)
    }, [editingFileName])

    const startRenameFile = useCallback((name: string) => {
        const target = files.find((f) => f.name === name)
        if (target?.readOnly || target?.origin === 'utility') return
        setEditingFileName(name)
        setRenameDraft(name)
    }, [files])

    const renameFile = useCallback((oldName: string, newName: string) => {
        const target = files.find((f) => f.name === oldName)
        if (target?.readOnly || target?.origin === 'utility') {
            setEditingFileName(null)
            return
        }
        const trimmed = newName.trim()
        if (!trimmed || trimmed === oldName) {
            setEditingFileName(null)
            return
        }
        const ext = '.' + (trimmed.split('.').pop()?.toLowerCase() || '')
        if (!allowedExtensions.includes(ext)) {
            toast({ title: 'Invalid extension', description: `Use: ${allowedExtensions.join(', ')}`, variant: 'destructive' })
            return
        }
        if (files.some((f) => f.name !== oldName && f.name === trimmed)) {
            toast({ title: 'Duplicate name', description: 'A file with this name already exists.', variant: 'destructive' })
            return
        }
        setFiles((prev) => prev.map((f) => f.name === oldName ? { ...f, name: trimmed } : f))
        if (selectedFile?.name === oldName) {
            setSelectedFile({ ...selectedFile, name: trimmed })
        }
        setEditingFileName(null)
        setRenameDraft('')
    }, [allowedExtensions, files, selectedFile, toast])

    const updateFileContent = useCallback((value: string) => {
        if (!selectedFile) return
        if (selectedFile.readOnly || selectedFile.origin === 'utility') return
        const updated = { ...selectedFile, content: value, size: new Blob([value]).size }
        setSelectedFile(updated)
        setFiles((prev) => prev.map((f) => (f.name === updated.name ? updated : f)))
    }, [selectedFile])

    // Utility files: load instructor-provided files into workspace (read-only helper files)
    useEffect(() => {
        if (!supplementaryFiles || supplementaryFiles.length === 0) return
        let cancelled = false
            ; (async () => {
                try {
                    const downloads = await Promise.all(
                        supplementaryFiles.map(async (f: { filename: string; download_url: string }) => {
                            try {
                                const res = await fetch(f.download_url)
                                if (!res.ok) return null
                                const ct = res.headers.get('content-type') || ''
                                // Best-effort: only inject text-like files into workspace
                                if (ct && !ct.startsWith('text/') && !ct.includes('json') && !ct.includes('xml')) return null
                                const content = await res.text()
                                return { name: f.filename, content }
                            } catch {
                                return null
                            }
                        }),
                    )
                    if (cancelled) return
                    const toAdd = downloads.filter(Boolean) as { name: string; content: string }[]
                    if (toAdd.length === 0) return
                    setFiles((prev) => {
                        const existing = new Set(prev.map((p) => p.name))
                        const merged = [...prev]
                        for (const f of toAdd) {
                            if (existing.has(f.name)) continue
                            merged.push({
                                name: f.name,
                                content: f.content,
                                size: new Blob([f.content]).size,
                                readOnly: true,
                                origin: 'utility',
                            })
                        }
                        return merged
                    })
                } catch {
                    // ignore
                }
            })()
        return () => { cancelled = true }
    }, [supplementaryFiles])

    /* ===== Run Code ===== */

    const runCode = () => {
        if (!files.length) {
            toast({ title: 'No files', description: 'Create or upload a file first.', variant: 'destructive', silent: true })
            return
        }
        const emptyFiles = files.filter(f => !f.content.trim())
        if (emptyFiles.length === files.length) {
            toast({ title: 'Empty files', description: 'Write some code before running.', variant: 'destructive', silent: true })
            return
        }

        setPanelOpen(true)
        setActivePanel('output')

        startInteractiveTerminal(files.map(f => ({ name: f.name, content: f.content })))
        setTimeout(() => terminalRef.current?.focusInput(), 300)
    }

    const runCustomInput = async () => {
        if (!files.length) {
            toast({ title: 'No files', description: 'Create or upload a file first.', variant: 'destructive', silent: true })
            return
        }
        const emptyFiles = files.filter(f => !f.content.trim())
        if (emptyFiles.length === files.length) {
            toast({ title: 'Empty files', description: 'Write some code before running custom input.', variant: 'destructive', silent: true })
            return
        }
        // Exactly one source: either stdin text or one input file, not both
        if (datasetInputMode === 'stdin') {
            if (!hasStdinInput) {
                toast({ title: 'No stdin', description: 'Enter stdin text before running custom input.', variant: 'destructive', silent: true })
                return
            }
        } else {
            if (uploadedDatasets.length === 0) {
                toast({ title: 'No input file', description: 'Upload one input file before running custom input.', variant: 'destructive', silent: true })
                return
            }
        }

        closeInteractiveTerminal()

        setIsRunning(true)
        setError(null)
        setPanelOpen(true)
        setActivePanel('output')
        setInteractiveOutput([{ type: 'stdout', text: 'Running with custom input...\n' }])
        setInteractiveExitCode(null)

        try {
            // Decide stdin to send based on mode
            let stdinPayload = ''
            if (datasetInputMode === 'stdin') {
                stdinPayload = customInput
            } else {
                // Use first uploaded file content as stdin
                stdinPayload = uploadedDatasets[0]?.content || ''
            }

            const r = await apiClient.runCode(assignmentId, files, { stdin: stdinPayload })

            setDatasetRunResults([{
                name: datasetInputMode === 'stdin' ? 'stdin' : (uploadedDatasets[0]?.name || 'input.txt'),
                stdout: r.stdout ?? undefined,
                stderr: r.stderr ?? undefined,
                compilation_status: r.compilation_status,
                success: r.success && (r.compilation_status === 'Compiled Successfully'),
            }])

            // Also mirror the custom run output into the terminal area for immediate feedback
            if (r.stdout) {
                setInteractiveOutput(prev => [...prev, { type: 'stdout', text: r.stdout }])
            }
            if (r.stderr) {
                setInteractiveOutput(prev => [...prev, { type: 'stderr', text: r.stderr }])
            }

            if (!r.success || r.compilation_status !== 'Compiled Successfully') {
                const msg = r.message || r.compilation_status || 'Failed to run with custom input'
                toast({ title: 'Custom Input Run', description: msg, variant: 'destructive', silent: true })
            }

        } catch (err: any) {
            const raw = err?.response?.data?.detail
            const msg = typeof raw === 'string' ? raw
                : Array.isArray(raw) ? raw.map((e: { msg?: string }) => e?.msg || JSON.stringify(e)).join('. ') || 'Failed to run with custom input'
                    : raw?.message || 'Failed to run with custom input'
            setError(msg)
            toast({ title: 'Custom Input Failed', description: msg, variant: 'destructive', silent: true })
        } finally {
            setIsRunning(false)
        }
    }

    const runTestCases = async () => {
        if (!files.length) {
            toast({ title: 'No files', description: 'Create or upload a file first.', variant: 'destructive', silent: true })
            return
        }
        const emptyFiles = files.filter(f => !f.content.trim())
        if (emptyFiles.length === files.length) {
            toast({ title: 'Empty files', description: 'Write some code before running tests.', variant: 'destructive', silent: true })
            return
        }

        setIsRunning(true)
        setRunResult(null)
        setDatasetRunResults([])
        setError(null)
        setPanelOpen(true)
        setActivePanel('tests')

        const stdinToSend = testInputMode === 'stdin' ? (customInput.trim() || undefined) : undefined
        const hasInputFile = testInputMode === 'file' && inputFileContent.trim() && (inputFileName.trim() || 'input.txt')
        const inputFileToSend = hasInputFile
            ? { name: (inputFileName.trim() || 'input.txt'), content: inputFileContent }
            : undefined

        const runPromises: Promise<RunCodeResult>[] = [
            apiClient.runCode(assignmentId, files, {}),
        ]

        try {
            const results = await Promise.all(runPromises)
            const professorResult = results[0] as RunCodeResult
            // Keep the user on the Tests tab; just update test data
            setRunResult(professorResult)
            if (professorResult.compilation_status === 'Time Exceeds') {
                toast({ title: 'Time Exceeds', description: 'Your code took too long to run.', variant: 'destructive', silent: true })
            } else if (professorResult.compilation_status === 'Not Compiled Successfully') {
                toast({ title: 'Code error', description: 'Check the Tests / Output panel for details.', variant: 'destructive', silent: true })
            } else if (professorResult.compilation_status === 'Compiled Successfully' && professorResult.results.length > 0) {
                const p = professorResult.tests_passed, t = professorResult.tests_total
                if (p === t) setShowConfetti(true)
                else toast({ title: `${p}/${t} Tests Passed`, variant: 'destructive', silent: true })
            } else if (professorResult.compilation_status === 'Compiled Successfully') {
                toast({ title: 'Compiled Successfully', description: 'Your code ran without errors.', silent: true })
            }
        } catch (err: any) {
            const raw = err?.response?.data?.detail
            const msg = typeof raw === 'string' ? raw
                : Array.isArray(raw) ? raw.map((e: { msg?: string }) => e?.msg || JSON.stringify(e)).join('. ') || 'Failed to run code'
                    : raw?.message || 'Failed to run code'
            setError(msg)
            setRunResult({
                success: false, results: [], total_score: 0, max_score: 0,
                tests_passed: 0, tests_total: 0, message: msg, compilation_status: 'Not Compiled Successfully'
            })
            toast({ title: 'Execution Failed', description: msg, variant: 'destructive', silent: true })
        } finally {
            setIsRunning(false)
        }
    }

    /* ===== Submit ===== */

    const handleSubmit = () => {
        const studentFiles = files.filter(f => f.origin !== 'utility' && !f.readOnly)
        if (!studentFiles.length) {
            toast({ title: 'No files', description: 'Upload your code files before submitting.', variant: 'destructive' }); return
        }
        const emptyFiles = studentFiles.filter(f => !f.content.trim())
        if (emptyFiles.length > 0) {
            const names = emptyFiles.map(f => f.name).join(', ')
            toast({ title: 'Empty file detected', description: `Please add code to: ${names}`, variant: 'destructive' }); return
        }
        if (attemptsLeft <= 0) {
            toast({ title: 'No attempts left', description: `You've used all ${maxAttempts} attempts.`, variant: 'destructive' }); return
        }
        setSubmitPhase('confirm')
        setShowSubmitDialog(true)
    }

    const submitCode = async () => {
        if (!assignment) return
        setIsSubmitting(true)
        setError(null)
        setSubmitPhase('loading')
        // Capture attempt number before query invalidation refreshes the data
        const capturedAttemptNum = attemptsUsed + 1
        setSubmittedAttemptNum(capturedAttemptNum)

        try {
            // Only submit student-authored files (not read-only utility/support files)
            const studentFiles = files.filter(f => f.origin !== 'utility' && !f.readOnly)
            const fileObjects = studentFiles.map((f) => {
                const blob = new Blob([f.content], { type: 'text/plain' })
                return new File([blob], f.name)
            })
            await apiClient.createSubmission(assignmentId, fileObjects, myGroup?.id ?? undefined)
            await queryClient.invalidateQueries({ queryKey: ['submissions', assignmentId] })
            setSubmitPhase('success')
            // Auto-redirect to course page after 2.5s
            setTimeout(() => {
                router.push(`/student/courses/${assignment.course.id}`)
            }, 2500)
        } catch (err: any) {
            const raw = err?.response?.data?.detail
            const msg = typeof raw === 'string' ? raw
                : Array.isArray(raw) ? raw.map((e: { msg?: string; loc?: unknown[] }) => e?.msg || JSON.stringify(e)).join('. ') || 'Submission failed'
                    : raw?.message || 'Submission failed'
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
                e.preventDefault(); if (!isRunning && files.length > 0) runTestCases()
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
            <div className="flex flex-col h-screen bg-gradient-to-b from-[#1b1d1f] via-[#1e1e1e] to-[#1b1d1f] text-[#cccccc] overflow-hidden">

                {/* ===== Title Bar ===== */}
                <div className="flex items-center justify-between bg-gradient-to-r from-[#2b2c2d] via-[#323233] to-[#2b2c2d] px-4 py-1.5 border-b border-[#3c3c3c] select-none shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <Button variant="ghost" size="sm" onClick={() => router.back()}
                            className="h-6 px-2 text-[#cccccc] hover:text-white hover:bg-[#505050] text-xs shrink-0">
                            <ArrowLeft className="w-3 h-3 mr-1" /> Back
                        </Button>
                        <div className="h-3 w-px bg-[#5a5a5a]" />
                        <span className="text-xs text-[#cccccc] font-medium truncate">
                            {assignment.course?.code} &mdash; {assignment.title}
                        </span>
                        {isGraded
                            ? <span className="text-[10px] px-2 py-0.5 rounded bg-[#4ec9b0]/20 text-[#4ec9b0] font-semibold border border-[#4ec9b0]/30 shrink-0">
                                ✓ Graded {latestSubmission?.final_score != null ? `${Number(latestSubmission.final_score).toFixed(1)}/${assignment.max_score}` : ''}
                            </span>
                            : isAwaitingGrade
                                ? <span className="text-[10px] px-2 py-0.5 rounded bg-[#dcdcaa]/20 text-[#dcdcaa] font-medium border border-[#dcdcaa]/30 shrink-0">
                                    Awaiting Grade
                                </span>
                                : isOverdue
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
                <div className="flex items-center justify-between bg-[#252526] px-3 py-1 border-b border-[#3c3c3c] shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.03)] shrink-0">
                    <div className="flex items-center gap-2">
                        {latestSubmission && (
                            <span className={`text-[10px] px-2 py-0.5 rounded ${isGraded ? 'bg-[#4ec9b0]/15 text-[#4ec9b0] border border-[#4ec9b0]/25' : 'bg-[#333] text-[#858585]'}`}>
                                {isGraded
                                    ? `Score: ${Number(latestSubmission.final_score ?? 0).toFixed(1)} / ${assignment.max_score}`
                                    : `Attempt #${latestSubmission.attempt_number} · Awaiting grade`
                                }
                            </span>
                        )}
                        {files.filter(f => f.origin === 'utility').length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#505050] text-[#858585]" title="Utility files are automatically included in all runs">
                                📎 {files.filter(f => f.origin === 'utility').length} util file{files.filter(f => f.origin === 'utility').length !== 1 ? 's' : ''} included
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
                        {isSubmitted && (
                            <button
                                onClick={() => setRightPanel(rightPanel === 'grading' ? null : 'grading')}
                                className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'grading'
                                    ? 'bg-[#094771] text-white'
                                    : isGraded
                                        ? 'text-[#4ec9b0] hover:bg-[#505050] font-semibold'
                                        : 'text-[#cccccc] hover:bg-[#505050]'
                                    }`}
                            >
                                <Target className="w-3 h-3" />
                                {isGraded ? 'Graded ✓' : 'Grading'}
                            </button>
                        )}
                        <button onClick={() => setRightPanel(rightPanel === 'supplementary' ? null : 'supplementary')}
                            className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'supplementary' ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#505050]'}`}>
                            <Paperclip className="w-3 h-3" /> Files
                            {supplementaryFiles.length > 0 && <span className="px-1 py-0 text-[9px] bg-[#505050] rounded">{supplementaryFiles.length}</span>}
                        </button>
                        <button onClick={() => setRightPanel(rightPanel === 'custom' ? null : 'custom')}
                            className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'custom' ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#505050]'}`}>
                            <UploadIcon className="w-3 h-3" /> Custom Input
                            {uploadedDatasets.length > 0 && <span className="px-1 py-0 text-[9px] bg-[#505050] rounded">{uploadedDatasets.length}</span>}
                        </button>
                        {assignment.allow_groups && (
                            <button onClick={() => setRightPanel(rightPanel === 'group' ? null : 'group')}
                                className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'group' ? 'bg-[#094771] text-white' : myGroup ? 'text-[#4ec9b0] hover:bg-[#505050]' : 'text-[#dcdcaa] hover:bg-[#505050]'}`}>
                                <Users className="w-3 h-3" /> Group
                                {myGroup && <span className="px-1 py-0 text-[9px] bg-[#505050] rounded">{myGroup.members.length}</span>}
                            </button>
                        )}
                        <div className="w-px h-4 bg-[#5a5a5a] mx-1" />
                        <Button onClick={runCode} disabled={isRunning || files.length === 0} size="sm"
                            className="h-6 px-3 text-[10px] bg-[#0e639c] hover:bg-[#1177bb] text-white border-0">
                            <Play className="w-3 h-3 mr-1" /> Run Code
                        </Button>
                        <Button onClick={runTestCases} disabled={isRunning || files.length === 0} size="sm"
                            className="h-6 px-3 text-[10px] bg-[#0e639c] hover:bg-[#1177bb] text-white border-0">
                            {isRunning
                                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running Tests...</>
                                : <>Run Test Cases</>
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
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="h-7 px-3 rounded-md bg-gradient-to-r from-[#0e639c] to-[#1177bb] hover:from-[#1177bb] hover:to-[#1588cc] text-white text-[11px] font-semibold inline-flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
                                        title="Upload files"
                                    >
                                        <UploadIcon className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5" />
                                        <span>Upload</span>
                                    </button>
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

                            <div
                                className="flex-1 overflow-y-auto px-1"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
                            >
                                {files.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-center px-3">
                                        <div className="w-12 h-12 rounded-xl bg-[#0e639c]/15 flex items-center justify-center mb-3 border border-[#0e639c]/25">
                                            <UploadIcon className="w-6 h-6 text-[#4fc1ff]" />
                                        </div>
                                        <p className="text-[12px] text-[#e6e6e6] font-medium">Upload your files to start</p>
                                        <p className="text-[11px] text-[#bdbdbd] mt-1">
                                            Drag & drop here, or click upload. Max {maxFileSizeMB}MB per file.
                                        </p>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="mt-4 h-9 px-4 rounded-lg bg-gradient-to-r from-[#0e639c] to-[#1177bb] hover:from-[#1177bb] hover:to-[#1588cc] text-white text-[12px] font-semibold inline-flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
                                        >
                                            <UploadIcon className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
                                            <span>Upload files</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2 pl-4">
                                        {(() => {
                                            const studentFiles = files.filter((f) => f.origin !== 'utility')
                                            const utilityFiles = files.filter((f) => f.origin === 'utility')
                                            return (
                                                <>
                                                    <div className="space-y-0.5">
                                                        {studentFiles.map((file) => (
                                                            <div
                                                                key={file.name}
                                                                onClick={() => setSelectedFile(file)}
                                                                className={`group flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-[12px] ${selectedFile?.name === file.name
                                                                    ? 'bg-[#094771] text-white'
                                                                    : 'text-[#cccccc] hover:bg-[#2a2d2e]'
                                                                    }`}
                                                            >
                                                                <span className="text-xs shrink-0">{getFileIcon(file.name)}</span>
                                                                {editingFileName === file.name ? (
                                                                    <input
                                                                        type="text"
                                                                        value={renameDraft}
                                                                        ref={renameInputRef}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onChange={(e) => { e.stopPropagation(); setRenameDraft(e.target.value) }}
                                                                        onBlur={() => { renameFile(file.name, renameDraft.trim()) }}
                                                                        onKeyDown={(e) => {
                                                                            e.stopPropagation()
                                                                            if (e.key === 'Enter') {
                                                                                renameFile(file.name, renameDraft.trim())
                                                                                    ; (e.target as HTMLInputElement).blur()
                                                                            }
                                                                            if (e.key === 'Escape') {
                                                                                setRenameDraft(file.name)
                                                                                setEditingFileName(null)
                                                                                    ; (e.target as HTMLInputElement).blur()
                                                                            }
                                                                        }}
                                                                        autoFocus
                                                                        className="flex-1 min-w-0 bg-[#1e1e1e] border border-[#0e639c] rounded px-1 py-0.5 font-mono text-[12px] text-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#0e639c]"
                                                                    />
                                                                ) : (
                                                                    <span
                                                                        className="flex-1 truncate font-mono text-[12px]"
                                                                        onDoubleClick={(e) => { e.stopPropagation(); startRenameFile(file.name) }}
                                                                        title="Double-click to rename"
                                                                    >
                                                                        {file.name}
                                                                    </span>
                                                                )}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); removeFile(file.name) }}
                                                                    className={`opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/30 text-[#858585] hover:text-red-400 shrink-0 ${file.readOnly || file.origin === 'utility' ? 'hidden' : ''}`}
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {utilityFiles.length > 0 && (
                                                        <div className="pt-2">
                                                            <div className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#bdbdbd] uppercase tracking-wider">
                                                                <ChevronDown className="w-3 h-3" />
                                                                <Paperclip className="w-3 h-3" />
                                                                <span className="font-semibold">Utility files (read-only)</span>
                                                            </div>
                                                            <div className="space-y-0.5 pl-4">
                                                                {utilityFiles.map((file) => (
                                                                    <div
                                                                        key={file.name}
                                                                        onClick={() => setSelectedFile(file)}
                                                                        className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-[12px] ${selectedFile?.name === file.name
                                                                            ? 'bg-[#094771] text-white'
                                                                            : 'text-[#cfcfcf] hover:bg-[#2a2d2e]'
                                                                            }`}
                                                                    >
                                                                        <span className="text-xs shrink-0">{getFileIcon(file.name)}</span>
                                                                        <span className="flex-1 truncate font-mono text-[12px]">{file.name}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )
                                        })()}

                                        {uploadedDatasets.length > 0 && (
                                            <div className="mt-3">
                                                <div className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#777777] uppercase tracking-wider">
                                                    <ChevronDown className="w-3 h-3" />
                                                    <span className="font-semibold">Run input</span>
                                                </div>
                                                <div className="pl-4 space-y-0.5">
                                                    <div className="flex items-center gap-2 px-2 py-1 rounded text-[11px] text-[#cccccc]">
                                                        <UploadIcon className="w-3 h-3" />
                                                        <span className="flex-1 truncate font-mono text-[11px]">
                                                            {uploadedDatasets.length} dataset{uploadedDatasets.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
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
                                    className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-[12px] border-r border-[#3c3c3c] shrink-0 min-w-0 max-w-[180px] ${selectedFile?.name === file.name ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#0e639c]' : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#2d2d2d]/80'}`}>
                                    <span className="text-xs shrink-0">{getFileIcon(file.name)}</span>
                                    {editingFileName === file.name ? (
                                        <input
                                            type="text"
                                            value={renameDraft}
                                            ref={renameInputRef}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => { e.stopPropagation(); setRenameDraft(e.target.value) }}
                                            onBlur={() => { renameFile(file.name, renameDraft.trim()) }}
                                            onKeyDown={(e) => {
                                                e.stopPropagation()
                                                if (e.key === 'Enter') { renameFile(file.name, renameDraft.trim()); (e.target as HTMLInputElement).blur() }
                                                if (e.key === 'Escape') { setRenameDraft(file.name); setEditingFileName(null); (e.target as HTMLInputElement).blur() }
                                            }}
                                            autoFocus
                                            className="flex-1 min-w-0 max-w-[120px] bg-[#1e1e1e] border border-[#0e639c] rounded px-1 py-0.5 font-mono text-[11px] text-[#d4d4d4] focus:outline-none focus:ring-1 focus:ring-[#0e639c]"
                                        />
                                    ) : (
                                        <span
                                            className="flex-1 truncate font-mono"
                                            onDoubleClick={(e) => { e.stopPropagation(); startRenameFile(file.name) }}
                                            title="Double-click to rename"
                                        >
                                            {file.name}
                                        </span>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeFile(file.name) }}
                                        className={`ml-1 p-0.5 rounded hover:bg-[#505050] shrink-0 ${file.readOnly || file.origin === 'utility' ? 'hidden' : ''}`}
                                    >
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
                                                {files.length > 0 ? 'Select a file to start editing' : 'Upload files to get started'}
                                            </p>
                                            {files.length === 0 && (
                                                <div className="flex gap-2 justify-center">
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

                                    <div className="flex-1 overflow-y-auto p-3 font-mono text-[12px] flex flex-col min-h-0">
                                        {activePanel === 'output' ? (
                                            <div className="flex flex-col min-h-0 flex-1">
                                                <InteractiveTerminal
                                                    ref={terminalRef}
                                                    output={interactiveOutput}
                                                    running={interactiveRunning}
                                                    exitCode={interactiveExitCode}
                                                    onSendStdin={sendInteractiveStdin}
                                                    outputEndRef={interactiveOutputEndRef}
                                                />
                                                {/* Removed pre-configured test stdin/file section to rely purely on interactive terminal input */}
                                                {isRunning && !interactiveRunning && (
                                                    <div className="flex items-center gap-2 text-[#569cd6] shrink-0 mt-2">
                                                        <Loader2 className="w-4 h-4 animate-spin" /> Running professor tests and your datasets...
                                                    </div>
                                                )}
                                                {(runResult || datasetRunResults.length > 0) ? (
                                                    <div className="space-y-3 flex-1 min-h-0 overflow-y-auto mt-3">
                                                        {/* Compilation status (from professor run) */}
                                                        {runResult && (
                                                            <div className={`flex items-center gap-3 p-3 rounded-lg shrink-0 ${runResult.compilation_status === 'Compiled Successfully'
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
                                                                    {runResult.results.length > 0 && (
                                                                        <p className="text-[11px] text-[#858585] mt-0.5">Professor tests: {runResult.tests_passed}/{runResult.tests_total}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {runResult?.message && runResult.compilation_status !== 'Compiled Successfully' && (
                                                            <pre className="text-[#f44747] whitespace-pre-wrap text-[11px] leading-relaxed bg-[#2d0000] p-3 rounded border border-[#5c1e1e] shrink-0">{runResult.message}</pre>
                                                        )}
                                                        {runResult && runResult.results.length > 0 && (
                                                            <div className="pt-2 border-t border-[#3c3c3c] shrink-0">
                                                                <div className="text-[#858585] text-[11px] mb-2">Professor test results</div>
                                                                {runResult.results.map((r) => (
                                                                    <div key={r.id} className={`flex items-center gap-2 py-0.5 ${r.passed ? 'text-[#4ec9b0]' : 'text-[#f44747]'}`}>
                                                                        {r.passed ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                                                                        <span>{r.name} {r.passed ? 'passed' : 'failed'}{r.error && r.error !== 'Output does not match expected' ? ` — ${r.error}` : ''}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {/* User-uploaded dataset run results */}
                                                        {datasetRunResults.length > 0 && (
                                                            <div className="pt-2 border-t border-[#3c3c3c] space-y-3 shrink-0">
                                                                <div className="text-[#858585] text-[11px] uppercase tracking-wider">Your test datasets</div>
                                                                {datasetRunResults.map((dr, idx) => (
                                                                    <div key={idx} className="rounded-lg border border-[#3c3c3c] bg-[#252526] overflow-hidden">
                                                                        <div className="px-3 py-1.5 border-b border-[#3c3c3c] flex items-center gap-2">
                                                                            <span className="text-[11px] font-medium text-[#cccccc]">{dr.name}</span>
                                                                            {dr.success ? <CheckCircle2 className="w-3.5 h-3.5 text-[#4ec9b0]" /> : <XCircle className="w-3.5 h-3.5 text-[#f44747]" />}
                                                                        </div>
                                                                        <div className="p-3 space-y-1">
                                                                            {dr.stdout && <pre className="whitespace-pre-wrap text-[#d4d4d4] text-[11px] leading-relaxed">{dr.stdout}</pre>}
                                                                            {dr.stderr && <pre className="whitespace-pre-wrap text-[#f44747] text-[11px] leading-relaxed">{dr.stderr}</pre>}
                                                                            {dr.compilation_status && dr.compilation_status !== 'Compiled Successfully' && (
                                                                                <p className="text-[11px] text-[#f44747]">{dr.compilation_status}</p>
                                                                            )}
                                                                            {dr.success && !dr.stdout && !dr.stderr && <p className="text-[11px] text-[#858585]">(no output)</p>}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : null}
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
                                                        {runResult.results.map((test) => {
                                                            const isExpanded = expandedTests.has(test.id)
                                                            const hasDiffView = true
                                                            return (
                                                                <div key={test.id} className={`px-3 py-2 rounded border ${test.passed ? 'border-[#2ea04366] bg-[#2ea04310]' : 'border-[#f4474766] bg-[#f4474710]'} space-y-1`}>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${test.passed ? 'bg-[#2ea043] text-white' : 'bg-[#f44747] text-white'}`}>
                                                                            {test.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className={`text-[12px] font-medium truncate ${test.passed ? 'text-[#4ec9b0]' : 'text-[#f44747]'}`}>
                                                                                {test.name} &mdash; {test.passed ? 'passed' : 'failed'}
                                                                            </div>
                                                                            {test.error && test.error !== 'Output does not match expected' && (
                                                                                <div className="text-[10px] text-[#f44747] mt-0.5 truncate">{test.error}</div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 shrink-0">
                                                                            <div className="text-[10px] text-[#858585]">{test.score}/{test.max_score} pts</div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => toggleTestDetails(test.id)}
                                                                                className="flex items-center gap-1 text-[10px] text-[#858585] hover:text-[#cccccc]"
                                                                            >
                                                                                <span>Details</span>
                                                                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    {isExpanded && (
                                                                        <div className="mt-2 space-y-2 text-[11px]">
                                                                            {test.error && test.error !== 'Output does not match expected' && (
                                                                                <pre className="bg-[#2d0000] border border-[#5c1e1e] text-[#f44747] rounded p-2 whitespace-pre-wrap max-h-28 overflow-auto">
                                                                                    {test.error}
                                                                                </pre>
                                                                            )}
                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                <div>
                                                                                    <div className="flex items-center gap-1 mb-1 text-[#858585]">
                                                                                        <CheckCircle2 className="w-2.5 h-2.5 text-[#4ec9b0]" />
                                                                                        <span className="text-[9px] uppercase tracking-wider">Expected</span>
                                                                                    </div>
                                                                                    <pre className="max-h-36 overflow-auto bg-[#0d2818] border border-[#2ea04333] rounded p-2 whitespace-pre-wrap text-[#d4d4d4] leading-relaxed">
                                                                                        {(test.expected_output ?? '').trim() || '(empty)'}
                                                                                    </pre>
                                                                                </div>
                                                                                <div>
                                                                                    <div className="flex items-center gap-1 mb-1 text-[#858585]">
                                                                                        {test.passed
                                                                                            ? <CheckCircle2 className="w-2.5 h-2.5 text-[#4ec9b0]" />
                                                                                            : <XCircle className="w-2.5 h-2.5 text-[#f44747]" />
                                                                                        }
                                                                                        <span className="text-[9px] uppercase tracking-wider">Your Output</span>
                                                                                    </div>
                                                                                    <pre className={`max-h-36 overflow-auto rounded p-2 whitespace-pre-wrap leading-relaxed ${test.passed
                                                                                        ? 'bg-[#0d2818] border border-[#2ea04333] text-[#d4d4d4]'
                                                                                        : 'bg-[#2d0000] border border-[#5c1e1e] text-[#f4a0a0]'
                                                                                        }`}>
                                                                                        {(test.output ?? '').trim() || '(no output)'}
                                                                                    </pre>
                                                                                </div>
                                                                            </div>
                                                                            {test.execution_time != null && (
                                                                                <p className="text-[10px] text-[#606060]">
                                                                                    ⏱ {test.execution_time.toFixed(3)}s
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
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
                                                            {runResult.compilation_status === 'Compiled Successfully' ? 'Compiled Successfully' : 'Code Error'}
                                                        </p>
                                                        <p className="text-[11px] text-[#858585]">
                                                            {runResult.compilation_status === 'Compiled Successfully'
                                                                ? 'No test cases for this assignment. Your code ran without errors.'
                                                                : 'Your code has errors. Check the Output tab for details.'}
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
                                <div className="flex items-center gap-2 text-[14px] font-semibold text-white">
                                    {rightPanel === 'description' && <><BookOpen className="w-4 h-4 text-[#569cd6]" /> Description</>}
                                    {rightPanel === 'instructions' && <><Info className="w-4 h-4 text-[#dcdcaa]" /> Instructions</>}
                                    {rightPanel === 'rubric' && <><ClipboardList className="w-4 h-4 text-[#c586c0]" /> Rubric</>}
                                    {rightPanel === 'grading' && <><Target className="w-4 h-4 text-[#4ec9b0]" /> Grading</>}
                                    {rightPanel === 'supplementary' && <><Paperclip className="w-4 h-4 text-[#dcdcaa]" /> Supplementary Files</>}
                                    {rightPanel === 'custom' && <><UploadIcon className="w-4 h-4 text-[#4ec9b0]" /> Custom Input</>}
                                    {rightPanel === 'group' && <><Users className="w-4 h-4 text-[#4ec9b0]" /> My Group</>}
                                </div>
                                <button onClick={() => setRightPanel(null)} className="p-1 rounded hover:bg-[#505050] text-[#858585]">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 text-[14px] leading-relaxed">
                                {rightPanel === 'description' && (
                                    <div className="space-y-4">
                                        {assignment.allow_groups && (
                                            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[#4fc1ff]/30 bg-[#0e639c]/10">
                                                <Users className="w-4 h-4 text-[#4fc1ff] shrink-0" />
                                                <div>
                                                    <p className="text-[11px] font-semibold text-[#4fc1ff]">Group Assignment</p>
                                                    <p className="text-[10px] text-[#858585]">Groups up to {assignment.max_group_size} members. One submission per group.</p>
                                                </div>
                                            </div>
                                        )}
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
                                                <p className="text-[12px] text-[#bdbdbd]">
                                                    Your submission will be evaluated against these criteria.
                                                </p>
                                                <div className="rounded-lg border border-[#3c3c3c] overflow-hidden">
                                                    <div className="px-3 py-2.5 bg-[#1e1e1e] border-b border-[#3c3c3c] flex items-center justify-between">
                                                        <span className="text-[11px] font-semibold text-[#cccccc] uppercase tracking-wider">Criteria</span>
                                                        <span className="text-[11px] text-[#dcdcaa] font-semibold">
                                                            {assignment.rubric.total_points} pts total
                                                        </span>
                                                    </div>
                                                    <div className="divide-y divide-[#3c3c3c]">
                                                        {assignment.rubric.items?.map((item: any, idx: number) => {
                                                            const hasScale = item.min_points != null && item.max_points != null
                                                            // Find graded score for this item if available
                                                            const gradedScore = latestSubmissionDetail?.rubric_scores?.find(
                                                                rs => rs.rubric_item_id === item.id
                                                            )
                                                            return (
                                                                <div key={item.id ?? idx} className="px-3 py-3 hover:bg-[#2a2d2e]">
                                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                                        <span className="text-[12px] font-medium text-white leading-tight">{item.name}</span>
                                                                        <span className="text-[11px] text-[#dcdcaa] font-semibold shrink-0">
                                                                            {gradedScore != null
                                                                                ? `${Number(gradedScore.score).toFixed(1)} / ${item.points ?? item.max_points ?? '?'}`
                                                                                : `${item.points ?? item.max_points ?? '?'} pts`
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    {item.description && (
                                                                        <p className="text-[11px] text-[#858585] mt-0.5 leading-relaxed">{item.description}</p>
                                                                    )}
                                                                    {hasScale && (
                                                                        <p className="text-[10px] text-[#606060] mt-1">
                                                                            Scale: {item.min_points} – {item.max_points} → 0 – {item.points} pts
                                                                        </p>
                                                                    )}
                                                                    {gradedScore?.comment && (
                                                                        <p className="mt-1.5 text-[11px] text-[#a0a0a0] bg-[#1e1e1e] rounded p-1.5 border border-[#3c3c3c]">
                                                                            💬 {gradedScore.comment}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8">
                                                <ClipboardList className="w-10 h-10 mx-auto text-[#505050] mb-3" />
                                                <p className="text-[#858585]">No rubric for this assignment.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {rightPanel === 'grading' && (
                                    <div className="space-y-4">
                                        {!isGraded ? (
                                            <div className="text-center py-10 space-y-4">
                                                <div className="w-16 h-16 mx-auto rounded-full bg-[#dcdcaa]/10 border border-[#dcdcaa]/20 flex items-center justify-center">
                                                    <Clock className="w-7 h-7 text-[#dcdcaa]" />
                                                </div>
                                                <div>
                                                    <p className="text-[#cfcfcf] font-semibold text-[14px]">Awaiting Grade</p>
                                                    <p className="text-[12px] text-[#858585] mt-1">Submitted on attempt #{latestSubmission?.attempt_number}.</p>
                                                    <p className="text-[11px] text-[#606060] mt-1">Your instructor will grade this soon.</p>
                                                </div>
                                                {latestSubmission?.is_late && (
                                                    <div className="rounded-lg border border-[#665500] bg-[#332b00] p-3 text-left">
                                                        <p className="text-[11px] font-semibold text-[#dcdcaa]">⚠ Late Submission</p>
                                                        <p className="text-[10px] text-[#cccccc] mt-1">
                                                            A {latestSubmission.late_penalty_applied ?? 0}% penalty may be applied.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                {/* Final score hero */}
                                                {(() => {
                                                    const finalScore = latestSubmissionDetail?.final_score ?? latestSubmission?.final_score ?? 0
                                                    const maxScore = assignment.max_score
                                                    const pct = maxScore > 0 ? Math.round((Number(finalScore) / maxScore) * 100) : 0
                                                    const scoreColor = pct >= 90 ? '#4ec9b0' : pct >= 70 ? '#dcdcaa' : pct >= 50 ? '#ce9178' : '#f44747'
                                                    const rubricScore = latestSubmissionDetail?.rubric_score ?? 0
                                                    const latePenalty = latestSubmissionDetail?.late_penalty_applied ?? latestSubmission?.late_penalty_applied ?? 0
                                                    return (
                                                        <>
                                                            {/* Score hero block */}
                                                            <div className="rounded-xl border border-[#3c3c3c] bg-gradient-to-br from-[#1e1e1e] to-[#252526] p-4 text-center">
                                                                <p className="text-[10px] text-[#858585] uppercase tracking-widest mb-2">Final Score</p>
                                                                <div className="flex items-end justify-center gap-1">
                                                                    <span className="text-4xl font-bold" style={{ color: scoreColor }}>
                                                                        {Number(finalScore).toFixed(1)}
                                                                    </span>
                                                                    <span className="text-[#858585] text-[14px] mb-1.5">/ {maxScore}</span>
                                                                </div>
                                                                <div className="mt-3 h-2 bg-[#333] rounded-full overflow-hidden">
                                                                    <div className="h-full rounded-full transition-all duration-700"
                                                                        style={{ width: `${pct}%`, backgroundColor: scoreColor }} />
                                                                </div>
                                                                <p className="mt-1.5 text-[11px]" style={{ color: scoreColor }}>{pct}%</p>
                                                            </div>

                                                            {/* Score breakdown */}
                                                            <div className="rounded-lg border border-[#3c3c3c] overflow-hidden">
                                                                <div className="px-3 py-2 bg-[#1e1e1e] border-b border-[#3c3c3c]">
                                                                    <span className="text-[10px] font-semibold text-[#bdbdbd] uppercase tracking-wider">Score Breakdown</span>
                                                                </div>
                                                                <div className="divide-y divide-[#3c3c3c]">
                                                                    <div className="px-3 py-2.5">
                                                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                                                            <span className="text-[12px] text-[#4fc1ff]">Possible Points</span>
                                                                            <span className="text-[12px] text-white font-semibold">{Number(maxScore).toFixed(1)} pts</span>
                                                                        </div>
                                                                        <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
                                                                            <div className="h-full bg-[#4fc1ff] rounded-full" style={{ width: '100%' }} />
                                                                        </div>
                                                                    </div>
                                                                    <div className="px-3 py-2.5">
                                                                        <div className="flex items-center justify-between gap-2 mb-1.5">
                                                                            <span className="text-[12px] text-[#c586c0]">Rubric</span>
                                                                            <span className="text-[12px] text-white font-semibold">{Number(rubricScore).toFixed(1)} pts</span>
                                                                        </div>
                                                                        <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
                                                                            <div className="h-full bg-[#c586c0] rounded-full"
                                                                                style={{ width: `${maxScore > 0 ? Math.min(100, (Number(rubricScore) / maxScore) * 100) : 0}%` }} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Rubric item breakdown */}
                                                            {latestSubmissionDetail?.rubric_scores && latestSubmissionDetail.rubric_scores.length > 0 && (
                                                                <div className="rounded-lg border border-[#3c3c3c] overflow-hidden">
                                                                    <div className="px-3 py-2 bg-[#1e1e1e] border-b border-[#3c3c3c]">
                                                                        <span className="text-[10px] font-semibold text-[#bdbdbd] uppercase tracking-wider">Rubric Criteria</span>
                                                                    </div>
                                                                    <div className="divide-y divide-[#3c3c3c]">
                                                                        {latestSubmissionDetail.rubric_scores.map((rs, idx) => {
                                                                            const rubricItem = assignment?.rubric?.items?.find((item: any) => item?.id === rs.rubric_item_id)
                                                                            const rubricScaleMax = Number(rubricItem?.max_points ?? rs?.item?.max_points ?? 0)
                                                                            const criterionMaxPoints = Number(rubricItem?.points ?? rs.max_score ?? 0)
                                                                            const itemScore = Number(rs.score ?? 0)
                                                                            const weightedCriterionScore = rubricScaleMax > 0
                                                                                ? (itemScore / rubricScaleMax) * criterionMaxPoints
                                                                                : itemScore
                                                                            const itemPct = criterionMaxPoints > 0 ? (weightedCriterionScore / criterionMaxPoints) * 100 : 0
                                                                            const itemColor = itemPct >= 90 ? '#4ec9b0' : itemPct >= 70 ? '#dcdcaa' : itemPct >= 50 ? '#ce9178' : '#f44747'
                                                                            return (
                                                                                <div key={`${rs.rubric_item_id}-${idx}`} className="px-3 py-3 hover:bg-[#2a2d2e]">
                                                                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                                                                        <span className="text-[12px] font-medium text-white truncate">
                                                                                            {rs?.item?.name || `Criterion ${idx + 1}`}
                                                                                        </span>
                                                                                        <span className="text-[11px] font-semibold shrink-0" style={{ color: itemColor }}>
                                                                                            {weightedCriterionScore.toFixed(1)}/{criterionMaxPoints.toFixed(1)}
                                                                                        </span>
                                                                                    </div>
                                                                                    {rubricScaleMax > 0 && criterionMaxPoints > 0 && (
                                                                                        <p className="text-[10px] text-[#9a9a9a] mb-1.5">
                                                                                            {itemScore.toFixed(1)}/{rubricScaleMax.toFixed(1)} × {criterionMaxPoints.toFixed(1)} = {weightedCriterionScore.toFixed(1)} pts
                                                                                        </p>
                                                                                    )}
                                                                                    <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
                                                                                        <div className="h-full rounded-full transition-all duration-500"
                                                                                            style={{ width: `${itemPct}%`, backgroundColor: itemColor }} />
                                                                                    </div>
                                                                                    {rs.comment && (
                                                                                        <p className="mt-2 text-[11px] text-[#a0a0a0] whitespace-pre-wrap leading-relaxed bg-[#1e1e1e] rounded p-2 border border-[#3c3c3c]">
                                                                                            {rs.comment}
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Feedback */}
                                                            <div className="rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] p-3">
                                                                <p className="text-[10px] font-semibold text-[#bdbdbd] uppercase tracking-wider mb-2">Instructor Feedback</p>
                                                                <p className="text-[13px] text-[#e6e6e6] whitespace-pre-wrap leading-relaxed">
                                                                    {latestSubmissionDetail?.feedback?.trim() ? latestSubmissionDetail.feedback : '— No feedback provided.'}
                                                                </p>
                                                            </div>

                                                            {/* Submission metadata */}
                                                            <div className="rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] p-3 text-[11px] text-[#858585] space-y-1">
                                                                <div className="flex justify-between">
                                                                    <span>Attempt</span>
                                                                    <span className="text-[#cccccc]">#{latestSubmission?.attempt_number ?? 1}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Tests passed</span>
                                                                    <span className="text-[#cccccc]">{latestSubmission?.tests_passed}/{latestSubmission?.tests_total}</span>
                                                                </div>
                                                                {latestSubmission?.is_late && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-[#f44747]">Late submission</span>
                                                                        <span className="text-[#f44747]">-{Number(latePenalty).toFixed(0)}%</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </>
                                                    )
                                                })()}
                                            </>
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

                                {rightPanel === 'custom' && (
                                    <div className="space-y-4">
                                        <p className="text-[11px] text-[#858585]">
                                            Provide custom input to run your code interactively or as batch runs. You can use stdin text, multiple input files, or both.
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-[#707070] uppercase tracking-wider">Input files used as</span>
                                            <button
                                                type="button"
                                                onClick={() => setDatasetInputMode('stdin')}
                                                className={`px-2 py-0.5 text-[10px] rounded border ${datasetInputMode === 'stdin'
                                                    ? 'bg-[#0e639c]/20 border-[#0e639c] text-white'
                                                    : 'border-[#3c3c3c] text-[#858585] hover:bg-[#2a2d2e]'
                                                    }`}
                                            >
                                                Stdin
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDatasetInputMode('file')}
                                                className={`px-2 py-0.5 text-[10px] rounded border ${datasetInputMode === 'file'
                                                    ? 'bg-[#0e639c]/20 border-[#0e639c] text-white'
                                                    : 'border-[#3c3c3c] text-[#858585] hover:bg-[#2a2d2e]'
                                                    }`}
                                            >
                                                Input file
                                            </button>
                                        </div>
                                        {/* Custom stdin textarea */}
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-[#707070] uppercase tracking-wider">Standard input (stdin)</p>
                                            <textarea
                                                value={customInput}
                                                onChange={(e) => setCustomInput(e.target.value)}
                                                placeholder="Type or paste stdin here. Leave empty to skip stdin."
                                                className="w-full min-h-[80px] px-3 py-2 bg-[#1e1e1e] border border-[#3c3c3c] rounded text-[#d4d4d4] placeholder-[#505050] text-[11px] resize-y focus:outline-none focus:ring-1 focus:ring-[#0e639c]"
                                                spellCheck={false}
                                            />
                                        </div>
                                        <input
                                            ref={datasetFileInputRef}
                                            type="file"
                                            multiple
                                            accept=".txt,.in,.dat,text/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const fileList = e.target.files
                                                if (!fileList?.length) return
                                                const toAdd: { name: string; content: string }[] = []
                                                let done = 0
                                                const total = fileList.length
                                                Array.from(fileList).forEach((file) => {
                                                    const reader = new FileReader()
                                                    reader.onload = (ev) => {
                                                        const content = (ev.target?.result ?? '') as string
                                                        const name = file.name || `input_${toAdd.length + 1}.txt`
                                                        toAdd.push({ name, content })
                                                        done++
                                                        if (done === total) {
                                                            setUploadedDatasets((prev) => {
                                                                const names = new Set(prev.map((d) => d.name))
                                                                const newOnes = toAdd.filter((d) => !names.has(d.name))
                                                                newOnes.forEach((d) => names.add(d.name))
                                                                return [...prev, ...newOnes]
                                                            })
                                                        }
                                                    }
                                                    reader.readAsText(file)
                                                })
                                                e.target.value = ''
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => datasetFileInputRef.current?.click()}
                                            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-[#3c3c3c] text-[#858585] hover:border-[#0e639c] hover:text-[#569cd6] transition-colors text-[12px]"
                                        >
                                            <UploadIcon className="w-4 h-4" />
                                            Upload input file(s)
                                        </button>
                                        {uploadedDatasets.length === 0 ? (
                                            <div className="text-center py-6 rounded-lg bg-[#1e1e1e] border border-[#3c3c3c]">
                                                <p className="text-[11px] text-[#606060]">No input files yet</p>
                                                <p className="text-[10px] text-[#505050] mt-1">Upload .txt or similar files to run as custom input</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {uploadedDatasets.map((ds, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center gap-3 p-3 rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] group"
                                                    >
                                                        <FileCode className="w-4 h-4 text-[#569cd6] shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[12px] font-medium text-white truncate">{ds.name}</p>
                                                            <p className="text-[10px] text-[#858585]">{(ds.content.length / 1024).toFixed(1)} KB</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setUploadedDatasets((prev) => prev.filter((_, i) => i !== idx))}
                                                            className="p-1.5 rounded hover:bg-[#f44747]/20 text-[#858585] hover:text-[#f44747] opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={runCustomInput}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#0e639c] hover:bg-[#1177bb] text-white text-[12px] font-medium mt-2"
                                        >
                                            <Play className="w-3.5 h-3.5" />
                                            Run Custom Input
                                        </button>
                                    </div>
                                )}

                                {rightPanel === 'group' && (
                                    <div className="space-y-4">
                                        {!myGroup ? (
                                            <div className="text-center py-10 space-y-3">
                                                <div className="w-14 h-14 mx-auto rounded-full bg-[#dcdcaa]/10 border border-[#dcdcaa]/20 flex items-center justify-center">
                                                    <Users className="w-7 h-7 text-[#dcdcaa]" />
                                                </div>
                                                <p className="text-[#cfcfcf] font-semibold text-[14px]">Not in a Group</p>
                                                <p className="text-[11px] text-[#858585]">This is a group assignment. Your instructor will assign you to a group.</p>
                                                <div className="rounded-lg border border-[#665500] bg-[#332b00] p-3 text-left mt-2">
                                                    <p className="text-[11px] font-semibold text-[#dcdcaa]">⚠ Group Required</p>
                                                    <p className="text-[10px] text-[#cccccc] mt-1">You can still submit individually. Contact your instructor to be added to a group.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="rounded-xl border border-[#3c3c3c] bg-gradient-to-br from-[#1e1e1e] to-[#252526] p-4">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="w-10 h-10 rounded-xl bg-[#0e639c]/20 flex items-center justify-center border border-[#0e639c]/30 shrink-0">
                                                            <Users className="w-5 h-5 text-[#4fc1ff]" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[14px] font-bold text-white">{myGroup.name}</p>
                                                            <p className="text-[10px] text-[#858585]">{myGroup.members.length} / {myGroup.max_members} members</p>
                                                        </div>
                                                    </div>
                                                    <div className="h-1 bg-[#333] rounded-full overflow-hidden mb-1">
                                                        <div className="h-full bg-[#4fc1ff] rounded-full"
                                                            style={{ width: `${(myGroup.members.length / myGroup.max_members) * 100}%` }} />
                                                    </div>
                                                </div>

                                                <div className="rounded-lg border border-[#3c3c3c] overflow-hidden">
                                                    <div className="px-3 py-2 bg-[#1e1e1e] border-b border-[#3c3c3c]">
                                                        <span className="text-[10px] font-semibold text-[#bdbdbd] uppercase tracking-wider">Members</span>
                                                    </div>
                                                    <div className="divide-y divide-[#3c3c3c]">
                                                        {myGroup.members.map((member) => (
                                                            <div key={member.user_id} className="px-3 py-2.5 flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-[#333] flex items-center justify-center shrink-0">
                                                                    <span className="text-[11px] font-bold text-[#cccccc]">
                                                                        {member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                                    </span>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[12px] font-medium text-white truncate">{member.full_name}</span>
                                                                        {member.is_leader && (
                                                                            <Crown className="w-3 h-3 text-[#dcdcaa] shrink-0" />
                                                                        )}
                                                                    </div>
                                                                    {member.student_id && (
                                                                        <p className="text-[10px] text-[#858585]">{member.student_id}</p>
                                                                    )}
                                                                </div>
                                                                {member.is_leader && (
                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#dcdcaa]/15 text-[#dcdcaa] border border-[#dcdcaa]/25 shrink-0">Leader</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] p-3 text-[11px] text-[#858585] space-y-1.5">
                                                    <p className="text-[#4fc1ff] font-medium text-[12px]">How group submission works:</p>
                                                    <p>• Any member can submit on behalf of the group.</p>
                                                    <p>• The grade applies to all group members equally.</p>
                                                    <p>• All members are notified when the submission is graded.</p>
                                                </div>
                                            </>
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
                            {myGroup && (
                                <div className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-600 shrink-0" />
                                    <p className="text-xs text-blue-800">
                                        Submitting for group <strong>{myGroup.name}</strong> — this grade applies to all {myGroup.members.length} members.
                                    </p>
                                </div>
                            )}
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
                                This will use attempt <strong>{attemptsUsed + 1}</strong> of <strong>{maxAttempts}</strong>.
                            </p>
                        )}
                        {latestSubmission && (
                            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-start gap-2">
                                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-blue-800">
                                    This will <strong>replace</strong> your previous submission (attempt #{latestSubmission.attempt_number}).
                                </p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700">
                                Your files ({files.filter(f => f.origin !== 'utility').length}):
                            </p>
                            <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg border border-gray-200 p-2">
                                {files.filter(f => f.origin !== 'utility').map(f => (
                                    <div key={f.name} className="flex items-center justify-between px-2 py-1.5 rounded bg-gray-50 text-sm">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span>{getFileIcon(f.name)}</span>
                                            <span className="font-mono text-xs truncate">{f.name}</span>
                                        </div>
                                        <span className="text-xs text-gray-500 shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                ))}
                            </div>
                            {files.filter(f => f.origin === 'utility').length > 0 && (
                                <p className="text-xs text-gray-400">
                                    + {files.filter(f => f.origin === 'utility').length} utility file(s) included automatically
                                </p>
                            )}
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
                                Your code has been submitted for grading. You'll be notified once it's graded.
                            </p>
                        </div>
                        {maxAttempts > 0 && submittedAttemptNum !== null && (
                            <p className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                                Attempt {submittedAttemptNum} of {maxAttempts}
                            </p>
                        )}
                        <p className="text-xs text-gray-400">Redirecting to course...</p>
                        <Button onClick={goToCourse} className="bg-primary hover:bg-primary-700 text-white w-full sm:w-auto">
                            Go to Course
                        </Button>
                    </div>
                )}
            </Modal>

            {/* Confetti Popup for All Tests Passed */}
            <ConfettiPopup
                isOpen={showConfetti}
                onClose={() => setShowConfetti(false)}
                title="All Tests Passed!"
                message={`Congratulations! You passed all ${runResult?.tests_total || 0} test cases.`}
                description="Your code is working perfectly. Ready to submit?"
                acknowledgeLabel="Awesome!"
            />
        </ProtectedRoute>
    )
}
