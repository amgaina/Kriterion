'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

import { RubricGrader, TestDataCreator } from './GradingEnhancements';
import { InteractiveTerminal, type InteractiveTerminalRef } from '@/components/InteractiveTerminal';
import { useInteractiveTerminal } from '@/hooks/useInteractiveTerminal';

import {
    ArrowLeft,
    Play,
    FileCode,
    Target,
    X,
    AlertCircle,
    Loader2,
    CheckCircle2,
    XCircle,
    Terminal,
    Code,
    ChevronDown,
    Clock,
    Save,
    User,
    MessageSquare,
    ClipboardList,
    FolderOpen,
    CheckSquare,
    Square,
    AlertTriangle,
    Eye,
    Info,
    BookOpen,
    FileText,
    Calendar,
    Shield,
    ArrowLeftRight,
    Users,
    Upload as UploadIcon,
} from 'lucide-react';

/* ====================================================================
   TYPES
   ==================================================================== */

interface StudentInfo {
    id: number;
    full_name: string;
    email: string;
    student_id?: string;
}

interface SubmissionFileOut {
    id: number;
    filename: string;
    original_filename?: string;
    file_path: string;
    is_main_file?: boolean;
}

interface TestResultOut {
    id: number;
    test_case_id: number;
    passed: boolean;
    points_awarded: number;
    actual_output?: string;
    expected_output?: string;
    error_message?: string;
    timed_out?: boolean;
}

interface SubmissionItem {
    id: number;
    assignment_id: number;
    student_id: number;
    student?: StudentInfo;
    attempt_number: number;
    status: string;
    submitted_at: string;
    is_late: boolean;
    late_penalty_applied: number;
    tests_passed: number;
    tests_total: number;
    test_score: number | null;
    rubric_score: number | null;
    raw_score: number | null;
    final_score: number | null;
    max_score: number;
    override_score: number | null;
    feedback: string | null;
    plagiarism_checked: boolean;
    plagiarism_score: number | null;
    plagiarism_flagged: boolean;
    plagiarism_report: any;
    ai_checked: boolean;
    ai_score: number | null;
    ai_flagged: boolean;
    error_message: string | null;
    files: SubmissionFileOut[];
    test_results: TestResultOut[];
}

interface RubricItemFlat {
    id: number;
    name: string;
    description?: string | null;
    weight: number;
    points: number;
}

interface RubricFlat {
    items: RubricItemFlat[];
    total_points: number;
}

interface Assignment {
    id: number;
    title: string;
    description?: string;
    instructions?: string;
    due_date?: string;
    max_score: number;
    passing_score: number;
    allow_late?: boolean;
    late_penalty_per_day?: number;
    max_late_days?: number;
    max_attempts?: number;
    max_file_size_mb?: number;
    allowed_file_extensions?: string[];
    enable_plagiarism_check?: boolean;
    enable_ai_detection?: boolean;
    starter_code?: string;
    is_published?: boolean;
    language?: { id: number; name: string; display_name: string; file_extension: string };
    course?: { id: number; name: string; code: string };
    rubric?: RubricFlat;
    test_cases?: {
        id: number;
        name: string;
        description?: string;
        input_data?: string;
        expected_output?: string;
        points: number;
        is_hidden: boolean;
        ignore_whitespace?: boolean;
        ignore_case?: boolean;
        time_limit_seconds?: number;
        order?: number;
    }[];
}

interface FileContent {
    id: number;
    filename: string;
    content: string;
}

interface RunTestResult {
    id: number;
    name: string;
    passed: boolean;
    score: number;
    max_score: number;
    output?: string | null;
    error?: string | null;
    expected_output?: string | null;
    execution_time?: number | null;
}

interface RunResult {
    success: boolean;
    results: RunTestResult[];
    compilation_status?: string;
    message?: string;
    tests_passed: number;
    tests_total: number;
    total_score: number;
    max_score: number;
    stdout?: string | null;
    stderr?: string | null;
}

interface GradeState {
    testOverrides: Record<number, { points_awarded: number; passed: boolean }>;
    feedback: string;
    finalScore: string;
}

const getScoreColor = (score: number | null, max: number) => {
    if (score === null) return 'text-[#858585]';
    const pct = (score / max) * 100;
    if (pct >= 90) return 'text-[#4ec9b0]';
    if (pct >= 70) return 'text-[#569cd6]';
    if (pct >= 50) return 'text-[#dcdcaa]';
    return 'text-[#f44747]';
};

/* ====================================================================
   COMPONENT - Shared between Faculty and Assistant (grading only)
   ==================================================================== */

interface GradingPageProps {
    courseId: number;
    assignmentId: number;
    studentId: number;
    /** URL to navigate back to assignment list (role-specific) */
    assignmentListHref: string;
    /** When true, hide plagiarism tab (assistants cannot access plagiarism match details API) */
    isAssistant?: boolean;
}

export function GradingPageContent({ courseId, assignmentId, studentId, assignmentListHref, isAssistant = false }: GradingPageProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const goBack = () => router.push(assignmentListHref);

    // State
    const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
    const [fileContents, setFileContents] = useState<Record<number, FileContent>>({});
    const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
    const [loadingFile, setLoadingFile] = useState(false);
    const [rightPanel, setRightPanel] = useState<'grading' | 'feedback' | 'tests' | 'description' | 'rubric' | 'plagiarism' | 'custom'>('grading');
    const [checkingPlagiarism, setCheckingPlagiarism] = useState(false);
    const [plagiarismMatches, setPlagiarismMatches] = useState<any[]>([]);
    const [panelOpen, setPanelOpen] = useState(true);
    const [activePanel, setActivePanel] = useState<'output' | 'tests'>('output');
    const [isRunning, setIsRunning] = useState(false);
    const [runResult, setRunResult] = useState<RunResult | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [gradeSaved, setGradeSaved] = useState(false);
    const [explorerOpen, setExplorerOpen] = useState(true);
    const [selectedTestCases, setSelectedTestCases] = useState<Set<number>>(new Set());
    const [testInputMode, setTestInputMode] = useState<'stdin' | 'file'>('stdin');
    const [customInput, setCustomInput] = useState('');
    const [inputFileName, setInputFileName] = useState('input.txt');
    const [inputFileContent, setInputFileContent] = useState('');
    const [datasetInputMode, setDatasetInputMode] = useState<'stdin' | 'file'>('stdin');
    const [uploadedDatasets, setUploadedDatasets] = useState<{ name: string; content: string }[]>([]);
    const [datasetRunResults, setDatasetRunResults] = useState<{ name: string; stdout?: string; stderr?: string; compilation_status?: string; success: boolean }[]>([]);
    const [viewingTestResult, setViewingTestResult] = useState<TestResultOut | null>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const testFileInputRef = useRef<HTMLInputElement>(null);
    const datasetFileInputRef = useRef<HTMLInputElement>(null);
    const customTestFileInputRef = useRef<HTMLInputElement>(null);

    const terminalRef = useRef<InteractiveTerminalRef>(null);
    const {
        output: interactiveOutput,
        running: interactiveRunning,
        exitCode: interactiveExitCode,
        start: startInteractiveTerminal,
        sendStdin: sendInteractiveStdin,
        outputEndRef: interactiveOutputEndRef,
    } = useInteractiveTerminal({ assignmentId });

    const [gradeState, setGradeState] = useState<GradeState>({
        testOverrides: {},
        feedback: '',
        finalScore: '',
    });

    // Rubric grading state
    const [rubricScores, setRubricScores] = useState<Record<number, number>>({});
    const [rubricTotalScore, setRubricTotalScore] = useState<number>(0);

    const handleRubricScoreChange = (itemId: number, score: number) => {
        setRubricScores(prev => ({ ...prev, [itemId]: score }));
    };

    const handleRubricTotalChange = (total: number) => {
        setRubricTotalScore(total);
    };

    const handleTestCaseAdded = async (payload: any) => {
        try {
            // Submit test case to backend
            await apiClient.createTestCase(assignmentId, payload);

            // Refresh test cases
            queryClient.invalidateQueries({ queryKey: ['assignment', assignmentId] });
            toast({ title: 'Test case added', description: 'New test case has been created.' });
        } catch (error) {
            console.error('Error creating test case:', error);
            toast({
                title: 'Error',
                description: 'Failed to create test case. Please try again.',
                variant: 'destructive'
            });
        }
    };

    // Custom test run state
    const [customTestMode, setCustomTestMode] = useState<'stdin' | 'file'>('stdin');
    const [customStdin, setCustomStdin] = useState('');
    const [customInputFiles, setCustomInputFiles] = useState<{ name: string; content: string }[]>([]);
    const [isRunningCustomTest, setIsRunningCustomTest] = useState(false);

    const runCustomTest = async () => {
        if (!selectedSub || !assignment) {
            toast({
                title: 'Error',
                description: 'No submission selected',
                variant: 'destructive'
            });
            return;
        }

        // Validate input
        if (customTestMode === 'stdin' && !customStdin.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter input for stdin mode',
                variant: 'destructive'
            });
            return;
        }

        if (customTestMode === 'file' && customInputFiles.length === 0) {
            toast({
                title: 'Error',
                description: 'Please select an input file',
                variant: 'destructive'
            });
            return;
        }

        // Collect submission files
        const fileList: { name: string; content: string }[] = [];
        try {
            for (const f of (selectedSub?.files || [])) {
                try {
                    if (fileContents[f.id]) {
                        fileList.push({
                            name: fileContents[f.id].filename,
                            content: fileContents[f.id].content
                        });
                    } else {
                        const data = await apiClient.getSubmissionFileContent(selectedSub.id, f.id);
                        setFileContents(prev => ({ ...prev, [f.id]: data }));
                        fileList.push({
                            name: data.filename,
                            content: data.content
                        });
                    }
                } catch (err) {
                    console.warn(`Failed to load file ${f.filename}:`, err);
                    // Continue with other files
                }
            }

            if (fileList.length === 0) {
                toast({
                    title: 'No files loaded',
                    description: 'Could not load any submission files to run test with.',
                    variant: 'destructive'
                });
                return;
            }
        } catch (err) {
            toast({
                title: 'Error loading files',
                description: 'Failed to load submission files',
                variant: 'destructive'
            });
            return;
        }

        setIsRunningCustomTest(true);
        setRunResult(null);
        setPanelOpen(true);
        setActivePanel('tests');

        try {
            // Prepare run options based on mode
            const runOptions = customTestMode === 'stdin'
                ? { stdin: customStdin || undefined }
                : customInputFiles.length > 0
                    ? { inputFiles: customInputFiles }
                    : {};

            // Execute the code
            const result = await apiClient.runCode(assignmentId, fileList, runOptions);

            setRunResult(result);

            // Show appropriate success message
            if (result.success) {
                toast({
                    title: '✅ Test Completed',
                    description: result.stdout
                        ? `Output: ${result.stdout.split('\n')[0].substring(0, 60)}...`
                        : 'Test ran successfully',
                });
            } else {
                toast({
                    title: '⚠️ Test Failed',
                    description: result.message || `Compilation: ${result.compilation_status}`,
                    variant: 'destructive'
                });
            }
        } catch (err: any) {
            const msg = err?.response?.data?.detail
                || err?.message
                || 'Custom test failed - please try again';

            setRunResult({
                success: false,
                results: [],
                compilation_status: 'Error',
                message: msg,
                tests_passed: 0,
                tests_total: 0,
                total_score: 0,
                max_score: 0,
                stderr: msg,
            });

            toast({
                title: '❌ Run Failed',
                description: msg,
                variant: 'destructive'
            });
            console.error('Custom test error:', err);
        } finally {
            setIsRunningCustomTest(false);
        }
    };

    // Compare mode for plagiarism side-by-side
    const [compareMode, setCompareMode] = useState<{
        matchId: number;
        matchedSubId: number;
        matchedStudentName: string;
        similarity: number;
        sourceSnippet?: string;
        matchedSnippet?: string;
    } | null>(null);
    const [compareFiles, setCompareFiles] = useState<Record<number, FileContent>>({});
    const [compareFileList, setCompareFileList] = useState<SubmissionFileOut[]>([]);
    const [compareSelectedFileId, setCompareSelectedFileId] = useState<number | null>(null);
    const [loadingCompare, setLoadingCompare] = useState(false);
    const compareGutterRef = useRef<HTMLDivElement>(null);
    const compareEditorRef = useRef<HTMLDivElement>(null);

    // API
    const { data: assignment, isLoading: loadingAssignment } = useQuery<Assignment>({
        queryKey: ['assignment', assignmentId],
        queryFn: () => apiClient.getAssignment(assignmentId),
        enabled: !!assignmentId,
    });

    const { data: allSubs = [], isLoading: loadingSubs } = useQuery<SubmissionItem[]>({
        queryKey: ['assignment-submissions', assignmentId],
        queryFn: () => apiClient.getAssignmentSubmissions(assignmentId),
        enabled: !!assignmentId,
    });

    // Filter to this student
    const studentSubs = useMemo(() =>
        allSubs
            .filter(s => s.student_id === studentId)
            .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()),
        [allSubs, studentId]
    );

    const student = useMemo(() =>
        studentSubs[0]?.student || { id: studentId, full_name: 'Student', email: '' },
        [studentSubs, studentId]
    );

    const hasStdinInput = customInput.trim().length > 0;
    const hasTestFileInput = inputFileContent.trim().length > 0;

    // Auto-select latest submission
    useEffect(() => {
        if (studentSubs.length > 0 && !selectedSubId) {
            setSelectedSubId(studentSubs[0].id);
        }
    }, [studentSubs, selectedSubId]);

    // Fetch full submission detail (with files + test_results) for the selected submission
    const { data: selectedSub, isLoading: loadingDetail } = useQuery<SubmissionItem>({
        queryKey: ['submission-detail', selectedSubId],
        queryFn: () => apiClient.getSubmission(selectedSubId!),
        enabled: !!selectedSubId,
    });

    // When selected submission detail loads, initialize grade state and load first file
    useEffect(() => {
        if (!selectedSub) return;
        setFileContents({});
        setSelectedFileId(null);
        setRunResult(null);

        const files = selectedSub.files || [];
        const testResults = selectedSub.test_results || [];

        const overrides: Record<number, { points_awarded: number; passed: boolean }> = {};
        testResults.forEach(tr => {
            overrides[tr.id] = { points_awarded: tr.points_awarded, passed: tr.passed };
        });
        setGradeState({
            testOverrides: overrides,
            feedback: selectedSub.feedback || '',
            finalScore: selectedSub.final_score !== null ? selectedSub.final_score.toString() : '',
        });

        if (files.length > 0) {
            const mainFile = files.find(f => f.is_main_file) || files[0];
            loadFileContent(selectedSub.id, mainFile.id);
            setSelectedFileId(mainFile.id);
        }
    }, [selectedSub?.id]);

    const loadFileContent = useCallback(async (subId: number, fileId: number) => {
        if (fileContents[fileId]) return;
        setLoadingFile(true);
        try {
            const data = await apiClient.getSubmissionFileContent(subId, fileId);
            setFileContents(prev => ({ ...prev, [fileId]: data }));
        } catch {
            toast({ title: 'Error', description: 'Failed to load file content.', variant: 'destructive' });
        } finally {
            setLoadingFile(false);
        }
    }, [fileContents, toast]);

    const updateFileContent = useCallback((fileId: number, newContent: string) => {
        setFileContents(prev => {
            const existing = prev[fileId];
            if (!existing) return prev;
            return { ...prev, [fileId]: { ...existing, content: newContent } };
        });
    }, []);

    const selectFile = useCallback((fileId: number) => {
        setSelectedFileId(fileId);
        if (selectedSub && !fileContents[fileId]) {
            loadFileContent(selectedSub.id, fileId);
        }
    }, [selectedSub, fileContents, loadFileContent]);

    /* ===== Run Code ===== */
    const loadPlagiarismData = async () => {
        if (!selectedSub) return;
        setCheckingPlagiarism(true);
        try {
            const matches = await apiClient.getPlagiarismMatches(selectedSub.id);
            setPlagiarismMatches(matches || []);
        } catch {
            setPlagiarismMatches([]);
        } finally {
            setCheckingPlagiarism(false);
        }
    };

    /* ===== Plagiarism Compare Mode ===== */
    const enterCompareMode = async (match: any) => {
        if (!match.matched_submission_id) {
            toast({ title: 'Cannot compare', description: 'No matched submission to compare.', variant: 'destructive' });
            return;
        }

        // Resolve matched student name from allSubs
        const matchedSub = allSubs.find(s => s.id === match.matched_submission_id);
        const matchedStudentName = matchedSub?.student?.full_name || match.matched_source || `Submission #${match.matched_submission_id}`;

        setCompareMode({
            matchId: match.id,
            matchedSubId: match.matched_submission_id,
            matchedStudentName,
            similarity: match.similarity_percentage,
            sourceSnippet: match.source_code_snippet,
            matchedSnippet: match.matched_code_snippet,
        });

        setLoadingCompare(true);
        try {
            const detail = await apiClient.getSubmission(match.matched_submission_id);
            const files: SubmissionFileOut[] = detail.files || [];
            setCompareFileList(files);

            if (files.length > 0) {
                const mainFile = files.find((f: SubmissionFileOut) => f.is_main_file) || files[0];
                const content = await apiClient.getSubmissionFileContent(match.matched_submission_id, mainFile.id);
                setCompareFiles({ [mainFile.id]: content });
                setCompareSelectedFileId(mainFile.id);
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to load matched submission.', variant: 'destructive' });
            setCompareMode(null);
        } finally {
            setLoadingCompare(false);
        }
    };

    const exitCompareMode = () => {
        setCompareMode(null);
        setCompareFiles({});
        setCompareFileList([]);
        setCompareSelectedFileId(null);
    };

    const loadCompareFile = async (fileId: number) => {
        if (!compareMode) return;
        setCompareSelectedFileId(fileId);
        if (compareFiles[fileId]) return;
        setLoadingCompare(true);
        try {
            const content = await apiClient.getSubmissionFileContent(compareMode.matchedSubId, fileId);
            setCompareFiles(prev => ({ ...prev, [fileId]: content }));
        } catch {
            toast({ title: 'Error', description: 'Failed to load file.', variant: 'destructive' });
        } finally {
            setLoadingCompare(false);
        }
    };

    const currentCompareFile = compareSelectedFileId ? compareFiles[compareSelectedFileId] : null;
    const compareEditorLines = (currentCompareFile?.content || '').split('\n');

    const runPlagiarismCheck = async () => {
        if (!selectedSub) return;
        setCheckingPlagiarism(true);
        try {
            const result = await apiClient.checkPlagiarism(selectedSub.id);
            const matches = await apiClient.getPlagiarismMatches(selectedSub.id);
            setPlagiarismMatches(matches || []);
            queryClient.invalidateQueries({ queryKey: ['submission-detail', selectedSub.id] });
            queryClient.invalidateQueries({ queryKey: ['assignment-submissions', assignmentId] });
            toast({
                title: 'Plagiarism Check Complete',
                description: `Similarity score: ${result.plagiarism_score?.toFixed(1) ?? 0}%${result.plagiarism_flagged ? ' - FLAGGED' : ''}`,
            });
        } catch (err: any) {
            toast({ title: 'Check Failed', description: err?.response?.data?.detail || 'Plagiarism check failed', variant: 'destructive' });
        } finally {
            setCheckingPlagiarism(false);
        }
    };

    const runCode = async () => {
        if (!selectedSub || !assignment) return;

        const fileList: { name: string; content: string }[] = [];
        for (const f of (selectedSub?.files || [])) {
            if (fileContents[f.id]) {
                fileList.push({ name: fileContents[f.id].filename, content: fileContents[f.id].content });
            } else {
                try {
                    const data = await apiClient.getSubmissionFileContent(selectedSub.id, f.id);
                    setFileContents(prev => ({ ...prev, [f.id]: data }));
                    fileList.push({ name: data.filename, content: data.content });
                } catch {
                    /* skip */
                }
            }
        }

        if (fileList.length === 0) {
            toast({ title: 'No files loaded', description: 'Cannot run code.', variant: 'destructive' });
            return;
        }

        setPanelOpen(true);
        setActivePanel('output');
        setRunResult(null);
        setDatasetRunResults([]);

        startInteractiveTerminal(fileList);
        setTimeout(() => terminalRef.current?.focusInput(), 300);
    };

    const runAllTests = async () => {
        if (!selectedSub || !assignment) return;

        const fileList: { name: string; content: string }[] = [];
        for (const f of (selectedSub?.files || [])) {
            if (fileContents[f.id]) {
                fileList.push({ name: fileContents[f.id].filename, content: fileContents[f.id].content });
            } else {
                try {
                    const data = await apiClient.getSubmissionFileContent(selectedSub.id, f.id);
                    setFileContents(prev => ({ ...prev, [f.id]: data }));
                    fileList.push({ name: data.filename, content: data.content });
                } catch {
                    /* skip */
                }
            }
        }

        if (fileList.length === 0) {
            toast({ title: 'No files loaded', description: 'Cannot run tests.', variant: 'destructive' });
            return;
        }

        setIsRunning(true);
        setRunResult(null);
        setPanelOpen(true);
        setActivePanel('tests');

        try {
            let testCaseIds: number[] | undefined;
            if (selectedTestCases.size > 0) {
                testCaseIds = Array.from(selectedTestCases);
            }

            const stdinToSend = testInputMode === 'stdin' ? (customInput.trim() || undefined) : undefined;
            const hasInputFile = testInputMode === 'file' && inputFileContent.trim() && (inputFileName.trim() || 'input.txt');
            const inputFileToSend = hasInputFile
                ? { name: (inputFileName.trim() || 'input.txt'), content: inputFileContent }
                : undefined;
            setDatasetRunResults([]);

            const runPromises: Promise<RunResult>[] = [
                apiClient.runCode(assignmentId, fileList, { testCaseIds, stdin: stdinToSend, inputFile: inputFileToSend }),
                ...uploadedDatasets.map(ds =>
                    apiClient.runCode(
                        assignmentId,
                        fileList,
                        datasetInputMode === 'file'
                            ? { inputFile: { name: ds.name || 'input.txt', content: ds.content } }
                            : { stdin: ds.content }
                    )
                ),
            ];

            const results = await Promise.all(runPromises);
            const mainResult = results[0] as RunResult;
            setRunResult(mainResult);
            const datasetResults = results.slice(1).map((r, i) => ({
                name: uploadedDatasets[i]?.name || `dataset_${i + 1}`,
                stdout: r.stdout ?? undefined,
                stderr: r.stderr ?? undefined,
                compilation_status: r.compilation_status,
                success: r.success && (r.compilation_status === 'Compiled Successfully'),
            }));
            setDatasetRunResults(datasetResults);
        } catch (err: any) {
            const msg = err?.response?.data?.detail || 'Run failed';
            setRunResult({
                success: false, results: [], compilation_status: 'Not Compiled Successfully',
                message: msg, tests_passed: 0, tests_total: 0, total_score: 0, max_score: 0,
            });
            toast({ title: 'Run Failed', description: msg, variant: 'destructive' });
        } finally {
            setIsRunning(false);
        }
    };

    /* ===== Save Grade ===== */
    const saveGrade = async () => {
        if (!selectedSub) return;
        setIsSaving(true);
        try {
            const overrides = Object.entries(gradeState.testOverrides).map(([id, val]) => ({
                id: Number(id), ...val,
            }));

            await apiClient.saveManualGrade(selectedSub.id, {
                final_score: gradeState.finalScore ? parseFloat(gradeState.finalScore) : undefined,
                feedback: gradeState.feedback || undefined,
                test_overrides: overrides.length > 0 ? overrides : undefined,
            });

            await queryClient.invalidateQueries({ queryKey: ['assignment-submissions', assignmentId] });
            setGradeSaved(true);
        } catch (err: any) {
            toast({ title: 'Error', description: err?.response?.data?.detail || 'Failed to save grade.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    /* ===== Test case selection ===== */
    const toggleTestCase = (id: number) => {
        setSelectedTestCases(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const selectAllTests = () => {
        if (!assignment?.test_cases) return;
        setSelectedTestCases(new Set(assignment.test_cases.map(tc => tc.id)));
    };
    const deselectAllTests = () => setSelectedTestCases(new Set());

    const getTestCaseSpec = (testCaseId: number) => {
        return assignment?.test_cases?.find(tc => tc.id === testCaseId);
    };

    const updateTestOverride = (trId: number, field: 'points_awarded' | 'passed', value: number | boolean) => {
        setGradeState(prev => ({
            ...prev,
            testOverrides: {
                ...prev.testOverrides,
                [trId]: { ...prev.testOverrides[trId], [field]: value },
            },
        }));
    };

    const currentFile = selectedFileId ? fileContents[selectedFileId] : null;
    const editorLines = (currentFile?.content || '').split('\n');
    const subFiles = selectedSub?.files || [];
    const subTestResults = selectedSub?.test_results || [];
    const testCaseResultsById = useMemo(() => {
        const map = new Map<number, TestResultOut>();
        for (const tr of subTestResults) map.set(tr.test_case_id, tr);
        return map;
    }, [subTestResults]);
    const assignmentTestCases = useMemo(() => {
        const list = assignment?.test_cases ? [...assignment.test_cases] : [];
        list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id);
        return list;
    }, [assignment?.test_cases]);

    // Plagiarism-highlighted line numbers for the current student's code
    const sourceFlaggedLines = useMemo(() => {
        const lines = new Set<number>();
        for (const m of plagiarismMatches) {
            if (m.source_line_start != null && m.source_line_end != null) {
                for (let i = m.source_line_start; i <= m.source_line_end; i++) lines.add(i);
            }
        }
        return lines;
    }, [plagiarismMatches]);

    // Plagiarism-highlighted line numbers for the matched student's code (compare mode)
    const matchedFlaggedLines = useMemo(() => {
        if (!compareMode) return new Set<number>();
        const lines = new Set<number>();
        for (const m of plagiarismMatches) {
            if (m.matched_submission_id === compareMode.matchedSubId &&
                m.matched_line_start != null && m.matched_line_end != null) {
                for (let i = m.matched_line_start; i <= m.matched_line_end; i++) lines.add(i);
            }
        }
        return lines;
    }, [plagiarismMatches, compareMode]);

    // Unified plagiarism match list: merge DB records + report JSON into one clickable list
    const unifiedPlagiarismMatches = useMemo(() => {
        // Start with DB matches (have full snippet data)
        const bySubId = new Map<number, any>();

        // Group DB matches by matched_submission_id (pick highest similarity per student)
        for (const m of plagiarismMatches) {
            const key = m.matched_submission_id;
            if (!key) continue;
            const existing = bySubId.get(key);
            if (!existing || m.similarity_percentage > existing.similarity_percentage) {
                bySubId.set(key, { ...m, _source: 'db' });
            }
        }

        // Merge report summary matches (fill in gaps the DB doesn't have)
        const reportMatches = selectedSub?.plagiarism_report?.matches || [];
        for (const rm of reportMatches) {
            const key = rm.matched_submission_id;
            if (!key) continue;
            if (!bySubId.has(key)) {
                bySubId.set(key, {
                    id: `report-${key}`,
                    matched_submission_id: rm.matched_submission_id,
                    similarity_percentage: rm.similarity_percentage,
                    matched_source: rm.student_name,
                    student_name: rm.student_name,
                    student_id_field: rm.student_id,
                    _source: 'report',
                });
            }
        }

        return Array.from(bySubId.values())
            .sort((a, b) => b.similarity_percentage - a.similarity_percentage);
    }, [plagiarismMatches, selectedSub?.plagiarism_report]);

    /* ===== RENDER ===== */

    if (loadingAssignment || loadingSubs) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#1e1e1e]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 mx-auto animate-spin text-[#862733]" />
                    <p className="text-sm text-[#858585]">Loading grading workspace...</p>
                </div>
            </div>
        );
    }

    if (!assignment || studentSubs.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#1e1e1e]">
                <div className="text-center space-y-6 p-8 border border-[#3c3c3c] rounded-xl bg-[#252526] max-w-md">
                    <AlertCircle className="w-16 h-16 mx-auto text-[#f44747]" />
                    <h2 className="text-xl font-bold text-[#cccccc]">No Submissions Found</h2>
                    <p className="text-sm text-[#858585]">This student hasn&apos;t submitted anything for this assignment.</p>
                    <Button onClick={goBack} className="bg-[#862733] hover:bg-[#a03040] text-white">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gradient-to-b from-[#1b1d1f] via-[#1e1e1e] to-[#1b1d1f] text-[#cccccc] overflow-hidden">
            {/* ===== Title Bar ===== */}
            <div className="flex items-center justify-between bg-gradient-to-r from-[#2b2c2d] via-[#323233] to-[#2b2c2d] px-4 py-1.5 border-b border-[#3c3c3c] select-none shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <Button variant="ghost" size="sm" onClick={goBack}
                        className="h-6 px-2 text-[#cccccc] hover:text-white hover:bg-[#505050] text-xs shrink-0">
                        <ArrowLeft className="w-3 h-3 mr-1" /> Back
                    </Button>
                    <div className="h-3 w-px bg-[#5a5a5a]" />
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-[#862733]/30 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-[#862733]" />
                        </div>
                        <span className="text-xs text-white font-medium truncate">{student.full_name}</span>
                        <span className="text-[10px] text-[#858585] truncate">{student.email}</span>
                    </div>
                    <div className="h-3 w-px bg-[#5a5a5a]" />
                    <span className="text-xs text-[#cccccc] truncate">
                        {assignment.course?.code} &mdash; {assignment.title}
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-[#858585]">{assignment.language?.display_name || 'N/A'}</span>
                    <div className="h-3 w-px bg-[#5a5a5a]" />
                    <span className="text-[10px] text-[#858585]">{assignment.max_score} pts</span>
                </div>
            </div>

            {/* ===== Toolbar ===== */}
            <div className="flex items-center justify-between bg-[#252526] px-3 py-1 border-b border-[#3c3c3c] shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.03)] shrink-0">
                <div className="flex items-center gap-2">
                    {/* Submission selector */}
                    <div className="relative">
                        <select
                            value={selectedSubId || ''}
                            onChange={(e) => setSelectedSubId(Number(e.target.value))}
                            className="h-6 pl-2 pr-6 text-[10px] rounded bg-[#3c3c3c] text-[#cccccc] border border-[#505050] appearance-none cursor-pointer focus:outline-none focus:border-[#862733]"
                        >
                            {studentSubs.map((sub, idx) => (
                                <option key={sub.id} value={sub.id}>
                                    Attempt #{sub.attempt_number}{idx === 0 ? ' (Latest)' : ''} - {format(new Date(sub.submitted_at), 'MMM dd, hh:mm a')}
                                    {sub.final_score !== null ? ` · ${sub.final_score.toFixed(1)}pts` : ''}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#858585] pointer-events-none" />
                    </div>
                    {selectedSub?.is_late && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#665500]/30 text-[#dcdcaa]">
                            <Clock className="w-3 h-3 inline mr-0.5" /> Late ({selectedSub.late_penalty_applied}%)
                        </span>
                    )}
                    {selectedSub && (selectedSub.plagiarism_flagged || selectedSub.ai_flagged) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5c1e1e]/30 text-[#f44747]">
                            <AlertTriangle className="w-3 h-3 inline mr-0.5" /> Flagged
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setRightPanel('grading')}
                        className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'grading' ? 'bg-[#862733]/30 text-white' : 'text-[#cccccc] hover:bg-[#505050]'}`}>
                        <ClipboardList className="w-3 h-3" /> Grading
                    </button>
                    <button onClick={() => setRightPanel('tests')}
                        className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'tests' ? 'bg-[#862733]/30 text-white' : 'text-[#cccccc] hover:bg-[#505050]'}`}>
                        <Target className="w-3 h-3" /> Tests
                        {selectedSub && selectedSub.tests_total > 0 && (
                            <span className="px-1 py-0 text-[9px] bg-[#505050] rounded">{selectedSub.tests_passed}/{selectedSub.tests_total}</span>
                        )}
                    </button>
                    <button onClick={() => setRightPanel('feedback')}
                        className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'feedback' ? 'bg-[#862733]/30 text-white' : 'text-[#cccccc] hover:bg-[#505050]'}`}>
                        <MessageSquare className="w-3 h-3" /> Feedback
                    </button>
                    <button onClick={() => setRightPanel('custom')}
                        className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'custom' ? 'bg-[#862733]/30 text-white' : 'text-[#cccccc] hover:bg-[#505050]'}`}>
                        <UploadIcon className="w-3 h-3" /> Custom Input
                    </button>
                    <div className="w-px h-4 bg-[#5a5a5a]" />
                    <button onClick={() => setRightPanel('description')}
                        className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'description' ? 'bg-[#862733]/30 text-white' : 'text-[#cccccc] hover:bg-[#505050]'}`}>
                        <BookOpen className="w-3 h-3" /> Info
                    </button>
                    <button onClick={() => setRightPanel('rubric')}
                        className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'rubric' ? 'bg-[#862733]/30 text-white' : 'text-[#cccccc] hover:bg-[#505050]'}`}>
                        <FileText className="w-3 h-3" /> Rubric
                    </button>
                    {!isAssistant && (
                        <button onClick={() => { setRightPanel('plagiarism'); if (selectedSub && plagiarismMatches.length === 0) loadPlagiarismData(); }}
                            className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${rightPanel === 'plagiarism' ? 'bg-purple-500/30 text-white' : 'text-[#cccccc] hover:bg-[#505050]'}`}>
                            <Shield className="w-3 h-3" /> Plagiarism
                            {selectedSub?.plagiarism_flagged && <span className="w-1.5 h-1.5 rounded-full bg-[#f44747]" />}
                        </button>
                    )}
                    <div className="w-px h-4 bg-[#5a5a5a] mx-1" />
                    <Button onClick={runCode} disabled={interactiveRunning || !selectedSub} size="sm"
                        className="h-6 px-3 text-[10px] bg-[#0e639c] hover:bg-[#1177bb] text-white border-0">
                        <Play className="w-3 h-3 mr-1" /> Run Code
                    </Button>
                    <Button onClick={runAllTests} disabled={isRunning || !selectedSub} size="sm"
                        className="h-6 px-3 text-[10px] bg-[#0e639c] hover:bg-[#1177bb] text-white border-0">
                        {isRunning
                            ? (<><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running Tests...</>)
                            : (<>{selectedTestCases.size > 0 ? `Run ${selectedTestCases.size} Test${selectedTestCases.size > 1 ? 's' : ''}` : 'Run All Tests'}</>)
                        }
                    </Button>
                    <Button onClick={saveGrade} disabled={isSaving || !selectedSub} size="sm"
                        className="h-6 px-3 text-[10px] bg-[#862733] hover:bg-[#a03040] text-white border-0">
                        {isSaving
                            ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving...</>
                            : <><Save className="w-3 h-3 mr-1" /> Save Grade</>
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
                    <button onClick={() => { setPanelOpen(true); setActivePanel('output'); }} title="Output"
                        className={`w-10 h-10 flex items-center justify-center rounded hover:bg-[#505050] ${panelOpen && activePanel === 'output' ? 'text-white border-l-2 border-white' : 'text-[#858585]'}`}>
                        <Terminal className="w-5 h-5" />
                    </button>
                    <button onClick={() => { setPanelOpen(true); setActivePanel('tests'); }} title="Tests"
                        className={`w-10 h-10 flex items-center justify-center rounded hover:bg-[#505050] ${panelOpen && activePanel === 'tests' ? 'text-white border-l-2 border-white' : 'text-[#858585]'}`}>
                        <Target className="w-5 h-5" />
                    </button>
                </div>

                {/* Explorer Sidebar */}
                {explorerOpen && selectedSub && (
                    <div className="w-56 bg-[#252526] border-r border-[#3c3c3c] flex flex-col min-h-0 shrink-0">
                        <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb]">
                            Submitted Files
                        </div>
                        <div className="px-2 py-1">
                            <select
                                value={selectedSubId ?? studentSubs[0]?.id ?? ''}
                                onChange={(e) => setSelectedSubId(Number(e.target.value))}
                                className="w-full px-2 py-1.5 text-[11px] text-[#cccccc] bg-[#1e1e1e] border border-[#3c3c3c] rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#569cd6]"
                            >
                                {studentSubs.map((sub, idx) => (
                                    <option key={sub.id} value={sub.id} className="bg-[#252526] text-white">
                                        Attempt {sub.attempt_number}{idx === 0 ? ' (Latest)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1 overflow-y-auto px-1">
                            {subFiles.length === 0 ? (
                                <div className="py-8 text-center text-[11px] text-[#858585]">No files</div>
                            ) : (
                                <div className="space-y-0.5 pl-4">
                                    {subFiles.map(file => (
                                        <div key={file.id} onClick={() => selectFile(file.id)}
                                            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-[12px] ${selectedFileId === file.id ? 'bg-[#862733]/30 text-white' : 'text-[#cccccc] hover:bg-[#2a2d2e]'
                                                }`}>
                                            <FileCode className="w-3.5 h-3.5 text-[#858585] shrink-0" />
                                            <span className="flex-1 truncate font-mono text-[12px]">{file.filename}</span>
                                            {file.is_main_file && (
                                                <span className="text-[9px] px-1 bg-[#0e639c]/30 text-[#569cd6] rounded">main</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Allowed File Extension */}
                        <div className="border-t border-[#3c3c3c] shrink-0 px-3 py-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#858585] mb-1.5">
                                Allowed File Extension
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {assignment?.allowed_file_extensions && assignment.allowed_file_extensions.length > 0 ? (
                                    assignment.allowed_file_extensions.map(ext => (
                                        <span key={ext} className="text-[10px] px-1.5 py-0.5 rounded bg-[#3c3c3c] text-[#d4d4d4]">{ext}</span>
                                    ))
                                ) : (
                                    <span className="text-[10px] text-[#858585]">Any</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== Center: Editor + Bottom Panel ===== */}
                <div className="flex-1 flex flex-col min-h-0 min-w-0">

                    {/* Compare Mode Banner */}
                    {compareMode && (
                        <div className="bg-gradient-to-r from-purple-900/40 via-[#252526] to-red-900/40 border-b border-purple-500/30 px-4 py-2 flex items-center gap-3 shrink-0">
                            <ArrowLeftRight className="w-4 h-4 text-purple-400 shrink-0" />
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                                <span className="text-[11px] font-semibold text-white truncate">{student.full_name}</span>
                                <span className="text-[10px] text-[#858585]">vs</span>
                                <span className="text-[11px] font-semibold text-purple-300 truncate">{compareMode.matchedStudentName}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${compareMode.similarity >= 50 ? 'bg-[#f44747]/20 text-[#f44747]' :
                                    compareMode.similarity >= 30 ? 'bg-[#dcdcaa]/20 text-[#dcdcaa]' :
                                        'bg-[#858585]/20 text-[#858585]'
                                    }`}>
                                    {compareMode.similarity.toFixed(1)}% similar
                                </span>
                            </div>
                            <button onClick={exitCompareMode}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#3c3c3c] hover:bg-[#505050] text-[11px] text-[#cccccc] transition-colors shrink-0">
                                <X className="w-3 h-3" /> Exit Compare
                            </button>
                        </div>
                    )}

                    {/* Editor Tabs - normal mode */}
                    {!compareMode && (
                        <div className="bg-[#252526] border-b border-[#3c3c3c] flex items-center min-h-[35px] overflow-x-auto shrink-0">
                            {subFiles.map(file => (
                                <div key={file.id} onClick={() => selectFile(file.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer text-[12px] border-r border-[#3c3c3c] shrink-0 ${selectedFileId === file.id ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#862733]' : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#2d2d2d]/80'
                                        }`}>
                                    <FileCode className="w-3.5 h-3.5 text-[#858585]" />
                                    <span className="font-mono">{file.filename}</span>
                                </div>
                            ))}
                            {subFiles.length === 0 && (
                                <div className="px-3 py-1.5 text-[12px] text-[#858585]">No files</div>
                            )}
                        </div>
                    )}

                    {/* Editor Tabs - compare mode (split headers) */}
                    {compareMode && (
                        <div className="flex shrink-0 border-b border-[#3c3c3c]">
                            {/* Left tabs: current student */}
                            <div className="flex-1 bg-[#252526] flex items-center min-h-[35px] overflow-x-auto border-r border-purple-500/30">
                                <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-[#858585] shrink-0 border-r border-[#3c3c3c]">
                                    <User className="w-3 h-3 inline mr-1" />{student.full_name?.split(' ')[0]}
                                </div>
                                {subFiles.map(file => (
                                    <div key={file.id} onClick={() => selectFile(file.id)}
                                        className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer text-[11px] border-r border-[#3c3c3c] shrink-0 ${selectedFileId === file.id ? 'bg-[#1e1e1e] text-white border-t-2 border-t-[#862733]' : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#2d2d2d]/80'
                                            }`}>
                                        <FileCode className="w-3 h-3 text-[#858585]" />
                                        <span className="font-mono">{file.filename}</span>
                                    </div>
                                ))}
                            </div>
                            {/* Right tabs: matched student */}
                            <div className="flex-1 bg-[#252526] flex items-center min-h-[35px] overflow-x-auto">
                                <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-purple-400 shrink-0 border-r border-[#3c3c3c]">
                                    <Users className="w-3 h-3 inline mr-1" />{compareMode.matchedStudentName.split(' ')[0]}
                                </div>
                                {compareFileList.map(file => (
                                    <div key={file.id} onClick={() => loadCompareFile(file.id)}
                                        className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer text-[11px] border-r border-[#3c3c3c] shrink-0 ${compareSelectedFileId === file.id ? 'bg-[#1e1e1e] text-white border-t-2 border-t-purple-500' : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#2d2d2d]/80'
                                            }`}>
                                        <FileCode className="w-3 h-3 text-purple-400/60" />
                                        <span className="font-mono">{file.filename}</span>
                                    </div>
                                ))}
                                {compareFileList.length === 0 && loadingCompare && (
                                    <div className="px-2 py-1.5 text-[11px] text-[#858585]"><Loader2 className="w-3 h-3 inline animate-spin" /> Loading...</div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Code Editor - normal mode */}
                        {!compareMode && (
                            <div className={`${panelOpen ? 'flex-[6]' : 'flex-1'} min-h-0 overflow-hidden`}>
                                {loadingDetail ? (
                                    <div className="h-full flex items-center justify-center bg-[#1e1e1e]">
                                        <div className="text-center space-y-3">
                                            <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#862733]" />
                                            <p className="text-sm text-[#858585]">Loading submission...</p>
                                        </div>
                                    </div>
                                ) : loadingFile ? (
                                    <div className="h-full flex items-center justify-center bg-[#1e1e1e]">
                                        <Loader2 className="w-6 h-6 animate-spin text-[#862733]" />
                                    </div>
                                ) : currentFile ? (
                                    <div className="h-full flex overflow-hidden">
                                        <div
                                            ref={gutterRef}
                                            className="bg-[#1e1e1e] text-[#858585] text-right pr-3 pl-4 pt-2 select-none overflow-hidden font-mono text-[13px] leading-[20px] border-r border-[#3c3c3c] min-w-[50px] shrink-0"
                                        >
                                            {editorLines.map((_, i) => {
                                                const lineNum = i + 1;
                                                const isFlagged = sourceFlaggedLines.has(lineNum);
                                                return (
                                                    <div key={i} className="h-[20px] flex items-center justify-end" style={isFlagged ? { background: 'rgba(244,71,71,0.15)' } : undefined}>
                                                        {isFlagged && <div className="w-[3px] h-full bg-[#f44747]/60 absolute left-0" style={{ position: 'absolute', left: 0 }} />}
                                                        <span className={isFlagged ? 'text-[#f44747]/80' : ''}>{lineNum}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex-1 relative overflow-hidden">
                                            {/* Highlight overlay behind textarea */}
                                            <div
                                                className="absolute inset-0 pt-2 pointer-events-none font-mono text-[13px] leading-[20px] overflow-hidden"
                                                style={{ paddingLeft: '16px' }}
                                                ref={(el) => {
                                                    if (el && editorRef.current) {
                                                        el.scrollTop = editorRef.current.scrollTop;
                                                    }
                                                }}
                                            >
                                                {editorLines.map((_, i) => {
                                                    const isFlagged = sourceFlaggedLines.has(i + 1);
                                                    return <div key={i} className="h-[20px]" style={isFlagged ? { background: 'rgba(244,71,71,0.10)' } : undefined} />;
                                                })}
                                            </div>
                                            <textarea
                                                ref={editorRef}
                                                value={currentFile.content}
                                                readOnly
                                                onScroll={() => {
                                                    if (editorRef.current && gutterRef.current) {
                                                        gutterRef.current.scrollTop = editorRef.current.scrollTop;
                                                    }
                                                }}
                                                className="relative w-full h-full bg-transparent text-[#d4d4d4] p-2 pl-4 font-mono text-[13px] leading-[20px] outline-none resize-none overflow-auto"
                                                style={{ background: 'transparent' }}
                                                spellCheck={false}
                                                autoCapitalize="off"
                                                autoCorrect="off"
                                                data-gramm="false"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center bg-[#1e1e1e]">
                                        <div className="text-center space-y-3">
                                            <Code className="w-16 h-16 mx-auto text-[#505050]" />
                                            <p className="text-sm text-[#858585]">Select a file to view code</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Code Editor - Compare (side-by-side) mode */}
                        {compareMode && (
                            <div className={`${panelOpen ? 'flex-[6]' : 'flex-1'} min-h-0 overflow-hidden flex`}>
                                {/* Left pane: current student */}
                                <div className="flex-1 flex flex-col min-w-0 border-r border-purple-500/30">
                                    {loadingDetail || loadingFile ? (
                                        <div className="flex-1 flex items-center justify-center bg-[#1e1e1e]">
                                            <Loader2 className="w-6 h-6 animate-spin text-[#862733]" />
                                        </div>
                                    ) : currentFile ? (
                                        <div className="flex-1 flex overflow-hidden">
                                            <div
                                                ref={gutterRef}
                                                className="bg-[#1e1e1e] text-[#858585] text-right pr-2 pl-2 pt-2 select-none overflow-hidden font-mono text-[12px] leading-[19px] border-r border-[#3c3c3c] min-w-[40px] shrink-0"
                                            >
                                                {editorLines.map((_, i) => {
                                                    const isFlagged = sourceFlaggedLines.has(i + 1);
                                                    return (
                                                        <div key={i} className="h-[19px]" style={isFlagged ? { background: 'rgba(244,71,71,0.18)' } : undefined}>
                                                            <span className={isFlagged ? 'text-[#f44747]' : ''}>{i + 1}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div
                                                className="flex-1 bg-[#1e1e1e] p-2 pl-3 font-mono text-[12px] leading-[19px] overflow-auto"
                                                onScroll={(e) => {
                                                    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                                                }}
                                            >
                                                {editorLines.map((line, i) => {
                                                    const isFlagged = sourceFlaggedLines.has(i + 1);
                                                    return (
                                                        <div key={i} className="h-[19px] whitespace-pre" style={isFlagged ? { background: 'rgba(244,71,71,0.10)', borderLeft: '2px solid rgba(244,71,71,0.5)', paddingLeft: '6px', marginLeft: '-8px' } : undefined}>
                                                            <span className={isFlagged ? 'text-[#f4a0a0]' : 'text-[#d4d4d4]'}>{line}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center bg-[#1e1e1e]">
                                            <p className="text-[12px] text-[#858585]">Select a file from the left tabs</p>
                                        </div>
                                    )}
                                </div>

                                {/* Right pane: matched student */}
                                <div className="flex-1 flex flex-col min-w-0">
                                    {loadingCompare ? (
                                        <div className="flex-1 flex items-center justify-center bg-[#1e1e1e]">
                                            <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                                        </div>
                                    ) : currentCompareFile ? (
                                        <div className="flex-1 flex overflow-hidden">
                                            <div
                                                ref={compareGutterRef}
                                                className="bg-[#1e1e1e] text-[#858585] text-right pr-2 pl-2 pt-2 select-none overflow-hidden font-mono text-[12px] leading-[19px] border-r border-[#3c3c3c] min-w-[40px] shrink-0"
                                            >
                                                {compareEditorLines.map((_, i) => {
                                                    const isFlagged = matchedFlaggedLines.has(i + 1);
                                                    return (
                                                        <div key={i} className="h-[19px]" style={isFlagged ? { background: 'rgba(192,120,255,0.18)' } : undefined}>
                                                            <span className={isFlagged ? 'text-purple-400' : ''}>{i + 1}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div
                                                className="flex-1 bg-[#1e1e1e] p-2 pl-3 font-mono text-[12px] leading-[19px] overflow-auto"
                                                onScroll={(e) => {
                                                    if (compareGutterRef.current) compareGutterRef.current.scrollTop = e.currentTarget.scrollTop;
                                                }}
                                            >
                                                {compareEditorLines.map((line, i) => {
                                                    const isFlagged = matchedFlaggedLines.has(i + 1);
                                                    return (
                                                        <div key={i} className="h-[19px] whitespace-pre" style={isFlagged ? { background: 'rgba(192,120,255,0.10)', borderLeft: '2px solid rgba(192,120,255,0.5)', paddingLeft: '6px', marginLeft: '-8px' } : undefined}>
                                                            <span className={isFlagged ? 'text-purple-300' : 'text-[#d4d4d4]'}>{line}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center bg-[#1e1e1e]">
                                            <p className="text-[12px] text-[#858585]">
                                                {compareFileList.length === 0 ? 'No files in matched submission' : 'Select a file from the right tabs'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Bottom Panel */}
                        {panelOpen && (
                            <div className="flex-[3] min-h-[120px] border-t border-[#3c3c3c] flex flex-col bg-[#1e1e1e]">
                                <div className="flex items-center bg-[#252526] border-b border-[#3c3c3c] px-2 shrink-0">
                                    <button onClick={() => setActivePanel('output')}
                                        className={`px-3 py-1.5 text-[11px] font-medium border-b-2 ${activePanel === 'output' ? 'border-[#862733] text-white' : 'border-transparent text-[#858585] hover:text-[#cccccc]'}`}>
                                        <Terminal className="w-3 h-3 inline mr-1" /> OUTPUT
                                    </button>
                                    <button onClick={() => setActivePanel('tests')}
                                        className={`px-3 py-1.5 text-[11px] font-medium border-b-2 ${activePanel === 'tests' ? 'border-[#862733] text-white' : 'border-transparent text-[#858585] hover:text-[#cccccc]'}`}>
                                        <Target className="w-3 h-3 inline mr-1" /> RUN RESULTS
                                    </button>
                                    <div className="flex-1" />
                                    <button onClick={() => setPanelOpen(false)} className="p-1 rounded hover:bg-[#505050] text-[#858585]"><X className="w-3 h-3" /></button>
                                </div>
                                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                                    {activePanel === 'output' ? (
                                        <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c0c] overflow-y-auto">
                                            {/* Enhanced Terminal with input at TOP */}
                                            <InteractiveTerminal
                                                ref={terminalRef}
                                                output={interactiveOutput}
                                                running={interactiveRunning}
                                                exitCode={interactiveExitCode}
                                                onSendStdin={sendInteractiveStdin}
                                                outputEndRef={interactiveOutputEndRef}
                                                minHeight="320px"
                                            />

                                            {/* Test input + Run result: scrollable below terminal */}
                                            <div className="flex-1 min-h-0 overflow-y-auto shrink-0 border-t border-[#3c3c3c]">
                                                {/* Run result (compilation + test results from HTTP run) */}
                                                <div className="flex-1 flex flex-col min-h-0 overflow-hidden font-mono text-[13px]">
                                                    <div className="flex-1 overflow-auto p-4 min-h-0">
                                                        {isRunning && !interactiveRunning ? (
                                                            <div className="flex items-center gap-2 text-[#569cd6] text-[12px]">
                                                                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                                                <span>Running tests…</span>
                                                            </div>
                                                        ) : runResult ? (
                                                            <div className="space-y-0">
                                                                {(runResult.stdout != null || runResult.stderr != null || runResult.message) && runResult.results.length === 0 ? (
                                                                    <>
                                                                        <div className="space-y-2">
                                                                            {runResult.stdout != null && runResult.stdout !== '' && (
                                                                                <pre className="whitespace-pre-wrap break-words text-[#d4d4d4] leading-[1.6] text-[12px] bg-[#1e1e1e] border border-[#3c3c3c] rounded p-3">{runResult.stdout}</pre>
                                                                            )}
                                                                            {runResult.stderr != null && runResult.stderr !== '' && (
                                                                                <pre className="whitespace-pre-wrap break-words text-[#f44747] leading-[1.6] text-[12px] bg-[#2d0000]/80 border border-[#5c1e1e] rounded p-3">{runResult.stderr}</pre>
                                                                            )}
                                                                            {(runResult.stdout == null || runResult.stdout === '') && (runResult.stderr == null || runResult.stderr === '') && runResult.message && (
                                                                                <pre className={`whitespace-pre-wrap break-words leading-[1.6] text-[12px] rounded p-3 ${runResult.compilation_status === 'Compiled Successfully' ? 'text-[#d4d4d4] bg-[#1e1e1e] border border-[#3c3c3c]' : 'text-[#f44747] bg-[#2d0000]/80 border border-[#5c1e1e]'}`}>{runResult.message}</pre>
                                                                            )}
                                                                            {(runResult.stdout == null || runResult.stdout === '') && (runResult.stderr == null || runResult.stderr === '') && !runResult.message && (
                                                                                <span className="text-[#606060] text-[12px]">No output</span>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                ) : null}
                                                                {/* Status badge for test runs */}
                                                                {runResult.results.length > 0 && (
                                                                    <div className={`flex items-center gap-2 p-2.5 rounded-b-lg border border-t-0 border-[#3c3c3c] ${runResult.tests_passed === runResult.tests_total ? 'bg-[#0d2818]' : 'bg-[#2d0000]'}`}>
                                                                        {runResult.tests_passed === runResult.tests_total ? <CheckCircle2 className="w-4 h-4 text-[#4ec9b0]" /> : <XCircle className="w-4 h-4 text-[#f44747]" />}
                                                                        <span className={`font-semibold text-[12px] ${runResult.tests_passed === runResult.tests_total ? 'text-[#4ec9b0]' : 'text-[#f44747]'}`}>
                                                                            {runResult.tests_passed}/{runResult.tests_total} passed
                                                                        </span>
                                                                        <span className="text-[10px] text-[#858585]">{runResult.total_score}/{runResult.max_score} pts</span>
                                                                    </div>
                                                                )}

                                                                {/* Per-test details in output */}
                                                                {runResult.results.length > 0 && (
                                                                    <div className="pt-2 border-t border-[#3c3c3c] space-y-2 max-h-[50vh] overflow-y-auto pr-2">
                                                                        {runResult.results.map(r => (
                                                                            <div key={r.id} className={`rounded-lg border p-2.5 ${r.passed ? 'border-[#2ea04340] bg-[#2ea04308]' : 'border-[#f4474740] bg-[#f4474708]'}`}>
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    {r.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-[#4ec9b0]" /> : <XCircle className="w-3.5 h-3.5 text-[#f44747]" />}
                                                                                    <span className={`font-semibold text-[12px] ${r.passed ? 'text-[#4ec9b0]' : 'text-[#f44747]'}`}>{r.name}</span>
                                                                                    <span className="text-[10px] text-[#858585] ml-auto">{r.score}/{r.max_score} pts</span>
                                                                                    {r.execution_time != null && <span className="text-[10px] text-[#858585]">{r.execution_time.toFixed(0)}ms</span>}
                                                                                </div>
                                                                                {r.error && (
                                                                                    <div className="mt-1">
                                                                                        <p className="text-[9px] text-[#858585] uppercase tracking-wider mb-0.5">Error</p>
                                                                                        <pre className="text-[11px] text-[#f44747] whitespace-pre-wrap bg-[#2d0000] p-2 rounded border border-[#5c1e1e] max-h-40 overflow-y-auto">{r.error}</pre>
                                                                                    </div>
                                                                                )}
                                                                                {r.output && (
                                                                                    <div className="mt-1">
                                                                                        <p className="text-[9px] text-[#858585] uppercase tracking-wider mb-0.5">Actual Output</p>
                                                                                        <pre className="text-[11px] text-[#d4d4d4] whitespace-pre-wrap bg-[#1a1a2e] p-2 rounded border border-[#3c3c3c] max-h-40 overflow-y-auto">{r.output}</pre>
                                                                                    </div>
                                                                                )}
                                                                                {r.expected_output && !r.passed && (
                                                                                    <div className="mt-1">
                                                                                        <p className="text-[9px] text-[#858585] uppercase tracking-wider mb-0.5">Expected Output</p>
                                                                                        <pre className="text-[11px] text-[#4ec9b0] whitespace-pre-wrap bg-[#0d2818] p-2 rounded border border-[#2ea04340] max-h-40 overflow-y-auto">{r.expected_output}</pre>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {datasetRunResults.length > 0 && (
                                                                    <div className="pt-3 border-t border-[#3c3c3c] space-y-2">
                                                                        <div className="text-[10px] text-[#858585] uppercase tracking-wider">Dataset runs</div>
                                                                        {datasetRunResults.map((dr, idx) => (
                                                                            <div key={idx} className="rounded-lg border border-[#3c3c3c] bg-[#1e1e1e] overflow-hidden">
                                                                                <div className="px-3 py-2 flex items-center gap-2 border-b border-[#3c3c3c]">
                                                                                    <span className="text-[11px] font-medium text-[#cccccc]">{dr.name}</span>
                                                                                    {dr.success ? <CheckCircle2 className="w-3.5 h-3.5 text-[#4ec9b0]" /> : <XCircle className="w-3.5 h-3.5 text-[#f44747]" />}
                                                                                    {dr.compilation_status && (
                                                                                        <span className="text-[10px] text-[#858585]">{dr.compilation_status}</span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="p-3 space-y-1">
                                                                                    {dr.stdout && <pre className="whitespace-pre-wrap text-[#d4d4d4] text-[11px] leading-relaxed">{dr.stdout}</pre>}
                                                                                    {dr.stderr && <pre className="whitespace-pre-wrap text-[#f44747] text-[11px] leading-relaxed">{dr.stderr}</pre>}
                                                                                    {dr.success && !dr.stdout && !dr.stderr && <p className="text-[11px] text-[#858585]">(no output)</p>}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="text-[#6e7681] text-[11px]">{"› "}Ready · <span className="text-[#862733]">Run</span> to start terminal and run tests</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* RUN RESULTS tab - detailed cards */
                                        <div className="flex flex-col min-h-0 flex-1">
                                            {runResult && runResult.results.length > 0 ? (
                                                <div className="space-y-2 overflow-y-auto pr-2 flex-1">
                                                    <div className="flex items-center gap-3 mb-3 pb-2 border-b border-[#3c3c3c]">
                                                        <span className={`text-sm font-bold ${runResult.tests_passed === runResult.tests_total ? 'text-[#4ec9b0]' : 'text-[#f44747]'}`}>
                                                            {runResult.tests_passed === runResult.tests_total ? 'All Tests Passed' : `${runResult.tests_passed}/${runResult.tests_total} Passed`}
                                                        </span>
                                                        <div className="flex-1 h-1.5 bg-[#333] rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full ${runResult.tests_passed === runResult.tests_total ? 'bg-[#4ec9b0]' : 'bg-[#f44747]'}`}
                                                                style={{ width: `${runResult.tests_total > 0 ? (runResult.tests_passed / runResult.tests_total) * 100 : 0}%` }} />
                                                        </div>
                                                        <span className="text-[10px] text-[#858585]">{runResult.total_score}/{runResult.max_score} pts</span>
                                                    </div>
                                                    {runResult.results.map(r => (
                                                        <div key={r.id} className={`rounded-lg border overflow-hidden ${r.passed ? 'border-[#2ea04340]' : 'border-[#f4474740]'}`}>
                                                            <div className={`flex items-center gap-3 px-3 py-2 ${r.passed ? 'bg-[#2ea04315]' : 'bg-[#f4474715]'}`}>
                                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${r.passed ? 'bg-[#2ea043] text-white' : 'bg-[#f44747] text-white'}`}>
                                                                    {r.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                                                </div>
                                                                <span className={`flex-1 font-semibold ${r.passed ? 'text-[#4ec9b0]' : 'text-[#f44747]'}`}>
                                                                    {r.name} - {r.passed ? 'passed' : 'failed'}
                                                                </span>
                                                                <span className="text-[10px] text-[#858585]">{r.score}/{r.max_score} pts</span>
                                                                {r.execution_time != null && <span className="text-[10px] text-[#858585]">{r.execution_time.toFixed(0)}ms</span>}
                                                            </div>
                                                            {(r.error || r.output || (!r.passed && r.expected_output)) && (
                                                                <div className="px-3 py-2 bg-[#1e1e1e] space-y-1.5 text-[11px]">
                                                                    {r.error && (
                                                                        <div>
                                                                            <span className="text-[9px] text-[#858585] uppercase tracking-wider">Error</span>
                                                                            <pre className="text-[#f44747] whitespace-pre-wrap mt-0.5 max-h-32 overflow-y-auto">{r.error}</pre>
                                                                        </div>
                                                                    )}
                                                                    {r.output && (
                                                                        <div>
                                                                            <span className="text-[9px] text-[#858585] uppercase tracking-wider">Actual Output</span>
                                                                            <pre className="text-[#d4d4d4] whitespace-pre-wrap mt-0.5 max-h-32 overflow-y-auto">{r.output}</pre>
                                                                        </div>
                                                                    )}
                                                                    {!r.passed && r.expected_output && (
                                                                        <div>
                                                                            <span className="text-[9px] text-[#858585] uppercase tracking-wider">Expected</span>
                                                                            <pre className="text-[#4ec9b0] whitespace-pre-wrap mt-0.5 max-h-32 overflow-y-auto">{r.expected_output}</pre>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 text-[#858585]">
                                                    <Target className="w-8 h-8 mx-auto text-[#505050] mb-2" />
                                                    <p className="text-[12px]">Run the code to see test results</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ===== Right Panel - Grading / Tests / Feedback ===== */}
                <div className="w-80 bg-[#252526] border-l border-[#3c3c3c] flex flex-col min-h-0 shrink-0">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#3c3c3c] shrink-0">
                        <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
                            {rightPanel === 'grading' && <><ClipboardList className="w-4 h-4 text-[#862733]" /> Grading</>}
                            {rightPanel === 'tests' && <><Target className="w-4 h-4 text-[#862733]" /> Test Cases</>}
                            {rightPanel === 'feedback' && <><MessageSquare className="w-4 h-4 text-[#862733]" /> Feedback</>}
                            {rightPanel === 'description' && <><BookOpen className="w-4 h-4 text-[#862733]" /> Assignment Info</>}
                            {rightPanel === 'rubric' && <><FileText className="w-4 h-4 text-[#862733]" /> Rubric</>}
                            {rightPanel === 'plagiarism' && <><Shield className="w-4 h-4 text-purple-500" /> Plagiarism</>}
                            {rightPanel === 'custom' && <><UploadIcon className="w-4 h-4 text-[#862733]" /> Custom Input</>}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 text-[13px] leading-relaxed">
                        {rightPanel === 'grading' && selectedSub && (
                            <div className="space-y-5">
                                {/* Score Summary */}
                                <div className="bg-[#1e1e1e] rounded-xl p-4 border border-[#3c3c3c]">
                                    <p className="text-[11px] text-[#858585] uppercase tracking-wider mb-3">Score Summary</p>
                                    <div className="flex items-end gap-1 mb-3">
                                        <input
                                            type="number"
                                            value={gradeState.finalScore}
                                            onChange={(e) => setGradeState(p => ({ ...p, finalScore: e.target.value }))}
                                            placeholder="-"
                                            step="0.1"
                                            min="0"
                                            max={assignment.max_score}
                                            className="w-20 bg-[#3c3c3c] border border-[#505050] rounded px-2 py-1 text-2xl font-bold text-white text-center focus:outline-none focus:border-[#862733]"
                                        />
                                        <span className="text-lg text-[#858585] pb-1">/ {assignment.max_score}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="bg-[#333] rounded p-2">
                                            <span className="text-[#858585]">Test Score</span>
                                            <p className="text-white font-semibold">{selectedSub.test_score !== null ? selectedSub.test_score.toFixed(1) : '-'}</p>
                                        </div>
                                        <div className="bg-[#333] rounded p-2">
                                            <span className="text-[#858585]">Status</span>
                                            <p className="text-white font-semibold capitalize">{selectedSub.status}</p>
                                        </div>
                                        <div className="bg-[#333] rounded p-2">
                                            <span className="text-[#858585]">Late Penalty</span>
                                            <p className={`font-semibold ${selectedSub.late_penalty_applied > 0 ? 'text-[#dcdcaa]' : 'text-[#858585]'}`}>
                                                {selectedSub.late_penalty_applied > 0 ? `-${selectedSub.late_penalty_applied}%` : 'None'}
                                            </p>
                                        </div>
                                        <div className="bg-[#333] rounded p-2">
                                            <span className="text-[#858585]">Submitted</span>
                                            <p className="text-white font-semibold">{format(new Date(selectedSub.submitted_at), 'MMM dd')}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* (Auto-graded per-test details removed from grading panel to keep grading focused on final score and rubric) */}

                                {/* Flags */}
                                {(selectedSub.plagiarism_flagged || selectedSub.ai_flagged) && (
                                    <div className="bg-[#5c1e1e]/20 border border-[#f44747]/30 rounded-lg p-3">
                                        <p className="text-[11px] font-semibold text-[#f44747] flex items-center gap-1 mb-1">
                                            <AlertTriangle className="w-3.5 h-3.5" /> Integrity Flags
                                        </p>
                                        {selectedSub.plagiarism_flagged && <p className="text-[10px] text-[#f44747]">Plagiarism flagged</p>}
                                        {selectedSub.ai_flagged && <p className="text-[10px] text-[#f44747]">AI-generated content detected</p>}
                                    </div>
                                )}

                                {/* Rubric Grader - if assignment has rubric */}
                                {assignment.rubric && assignment.rubric.items?.length > 0 && (
                                    <div className="border-t border-[#3c3c3c] pt-4">
                                        <div className="mb-3">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <p className="text-[11px] text-[#858585] uppercase tracking-wider font-semibold">Rubric-Based Grading</p>
                                                <span className="text-[11px] text-white font-medium">/{assignment.rubric.total_points} pts</span>
                                            </div>
                                            <p className="text-[10px] text-[#858585]">Evaluate based on rubric criteria</p>
                                        </div>
                                        <RubricGrader
                                            rubricItems={assignment.rubric.items.map(item => ({
                                                itemId: item.id,
                                                name: item.name,
                                                description: `${item.weight > 0 ? `${item.weight}%` : item.points ? `${item.points} pts` : 'N/A'} • ${item.description || 'No description'}`,
                                                weight: item.weight,
                                                maxPoints: item.points,
                                                earnedPoints: Math.min(rubricScores[item.id] || 0, item.points),
                                            }))}
                                            mode={assignment.rubric.items.some(i => i.weight > 0) ? 'weight' : 'points'}
                                            maxScore={assignment.max_score}
                                            onScoreChange={(itemId, score) => {
                                                const item = assignment.rubric?.items.find(i => i.id === itemId);
                                                const maxScore = item?.points || 0;
                                                handleRubricScoreChange(itemId, Math.min(Math.max(0, score), maxScore));
                                            }}
                                            onTotalScoreChange={handleRubricTotalChange}
                                            onCalculate={() => {
                                                // Calculate and set as the final score
                                                setGradeState(prev => ({ ...prev, finalScore: rubricTotalScore.toFixed(1) }));
                                                toast({
                                                    title: '✅ Score Calculated',
                                                    description: `Rubric total: ${rubricTotalScore.toFixed(1)}/${assignment.max_score} pts`
                                                });
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {rightPanel === 'tests' && selectedSub && (
                            <div className="space-y-4">
                                {/* Test Data Creator - Add new test cases */}
                                <div className="bg-[#1e1e1e] rounded-lg border border-[#3c3c3c] p-3">
                                    <p className="text-[11px] text-[#858585] uppercase tracking-wider mb-2">Add Test Case</p>
                                    <TestDataCreator
                                        assignmentId={assignmentId}
                                        onTestCaseAdded={handleTestCaseAdded}
                                    />
                                </div>

                                {/* Select/Deselect all for tests */}
                                <div className="flex items-center gap-2">
                                    <button onClick={selectAllTests} className="text-[10px] px-2 py-1 rounded bg-[#3c3c3c] text-[#cccccc] hover:bg-[#505050] flex items-center gap-1">
                                        <CheckSquare className="w-3 h-3" /> Select All
                                    </button>
                                    <button onClick={deselectAllTests} className="text-[10px] px-2 py-1 rounded bg-[#3c3c3c] text-[#cccccc] hover:bg-[#505050] flex items-center gap-1">
                                        <Square className="w-3 h-3" /> Deselect
                                    </button>
                                    <span className="text-[10px] text-[#858585] ml-auto">{selectedTestCases.size} selected</span>
                                </div>

                                {assignmentTestCases.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {assignmentTestCases.map(tc => {
                                            const isSelected = selectedTestCases.has(tc.id);
                                            return (
                                                <div
                                                    key={tc.id}
                                                    className={`group flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${isSelected
                                                        ? 'border-[#862733] bg-[#862733]/10'
                                                        : 'border-[#3c3c3c] bg-[#1e1e1e] hover:bg-[#2a2d2e]'
                                                        }`}
                                                    onClick={() => toggleTestCase(tc.id)}
                                                >
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-[#862733] border-[#862733] text-white' : 'border-[#505050]'
                                                        }`}>
                                                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <p className="text-[12px] font-medium text-[#cccccc] truncate flex-1 min-w-0">{tc.name || `Test #${tc.id}`}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Target className="w-10 h-10 mx-auto text-[#505050] mb-3" />
                                        <p className="text-[12px] text-[#858585]">No test cases for this assignment</p>
                                        <p className="text-[10px] text-[#606060] mt-1">Create tests to run and evaluate submissions</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {rightPanel === 'custom' && selectedSub && (
                            <div className="space-y-4">
                                {/* Custom Input Runner */}
                                <div className="bg-[#1e1e1e] rounded-lg border border-[#862733]/30 p-4 space-y-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-[11px] text-[#862733] uppercase tracking-wider font-semibold">Custom Input</p>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => { setCustomTestMode('stdin'); setCustomInputFiles([]); }}
                                                className={`px-2 py-1 text-[10px] rounded border transition-colors ${customTestMode === 'stdin'
                                                    ? 'bg-[#862733]/20 border-[#862733] text-white'
                                                    : 'border-[#3c3c3c] text-[#858585] hover:bg-[#2a2d2e]'
                                                    }`}
                                            >
                                                Stdin
                                            </button>
                                            <button
                                                onClick={() => { setCustomTestMode('file'); setCustomStdin(''); }}
                                                className={`px-2 py-1 text-[10px] rounded border transition-colors ${customTestMode === 'file'
                                                    ? 'bg-[#862733]/20 border-[#862733] text-white'
                                                    : 'border-[#3c3c3c] text-[#858585] hover:bg-[#2a2d2e]'
                                                    }`}
                                            >
                                                File(s)
                                            </button>
                                        </div>
                                    </div>

                                    {/* Stdin mode */}
                                    {customTestMode === 'stdin' ? (
                                        <div className="space-y-2">
                                            <textarea
                                                value={customStdin}
                                                onChange={(e) => setCustomStdin(e.target.value)}
                                                placeholder="Paste standard input here..."
                                                className="w-full h-20 px-3 py-2 bg-[#252526] border border-[#3c3c3c] rounded text-[#d4d4d4] placeholder-[#505050] text-[12px] resize-y min-h-[60px] focus:outline-none focus:ring-1 focus:ring-[#862733] font-mono"
                                                spellCheck={false}
                                            />
                                            <p className="text-[10px] text-[#858585]">{customStdin.length} chars</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <input
                                                ref={customTestFileInputRef}
                                                type="file"
                                                multiple
                                                hidden
                                                onChange={(e) => {
                                                    const files = e.target.files;
                                                    if (!files) return;
                                                    const newFiles: { name: string; content: string }[] = [];
                                                    let loadedCount = 0;

                                                    Array.from(files).forEach((file, idx) => {
                                                        const reader = new FileReader();
                                                        reader.onload = (ev) => {
                                                            const content = (ev.target?.result ?? '') as string;
                                                            newFiles.push({ name: file.name || `input_${idx}.txt`, content });
                                                            loadedCount++;
                                                            if (loadedCount === files.length) {
                                                                setCustomInputFiles(prev => [...prev, ...newFiles]);
                                                            }
                                                        };
                                                        reader.readAsText(file);
                                                    });
                                                    e.target.value = '';
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => customTestFileInputRef.current?.click()}
                                                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-[#3c3c3c] text-[#858585] hover:border-[#862733] hover:text-[#d4d4d4] transition-colors text-[11px]"
                                            >
                                                <UploadIcon className="w-4 h-4" />
                                                Add Input File(s)
                                            </button>
                                            {customInputFiles.length > 0 && (
                                                <div className="space-y-1">
                                                    {customInputFiles.map((f, idx) => (
                                                        <div key={idx} className="flex items-center justify-between px-2 py-1.5 rounded bg-[#252526] border border-[#3c3c3c]">
                                                            <span className="text-[10px] text-[#cccccc] font-mono truncate">{f.name}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setCustomInputFiles(prev => prev.filter((_, i) => i !== idx))}
                                                                className="text-[#858585] hover:text-[#f44747]"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Run Custom Input Button */}
                                    <Button
                                        onClick={runCustomTest}
                                        disabled={isRunningCustomTest || !selectedSub || (customTestMode === 'stdin' && !customStdin.trim()) || (customTestMode === 'file' && customInputFiles.length === 0)}
                                        className="w-full h-9 bg-[#0e639c] hover:bg-[#1177bb] text-white text-[12px] font-medium"
                                    >
                                        {isRunningCustomTest ? (
                                            <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Running...</>
                                        ) : (
                                            <><Play className="w-3.5 h-3.5 mr-2" /> Run Custom Input</>
                                        )}
                                    </Button>

                                    {/* Custom Test Result Display */}
                                    {runResult && (runResult.stdout || runResult.stderr || runResult.message) && runResult.results.length === 0 && (
                                        <div className="space-y-3 mt-3 pt-3 border-t border-[#3c3c3c] max-h-[50vh] overflow-y-auto pr-2">
                                            {/* Test Execution Header */}
                                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${runResult.success
                                                ? 'bg-[#0d2818] border-[#2ea043]'
                                                : 'bg-[#2d0000] border-[#f44747]'
                                                }`}>
                                                {runResult.success ? (
                                                    <CheckCircle2 className="w-4 h-4 text-[#4ec9b0]" />
                                                ) : (
                                                    <AlertCircle className="w-4 h-4 text-[#f44747]" />
                                                )}
                                                <div className="flex-1">
                                                    <p className={`text-[11px] font-semibold ${runResult.success ? 'text-[#4ec9b0]' : 'text-[#f44747]'
                                                        }`}>
                                                        {runResult.success ? 'Test Passed' : 'Test Failed'}
                                                    </p>
                                                    {runResult.compilation_status && (
                                                        <p className="text-[10px] text-[#858585]">{runResult.compilation_status}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Input Section */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-semibold text-[#858585] uppercase tracking-wider">📥 Input</span>
                                                    <span className="text-[9px] text-[#505050]">
                                                        {customTestMode === 'stdin'
                                                            ? `${customStdin.length} chars`
                                                            : customInputFiles.length > 0
                                                                ? `${customInputFiles.length} file(s) (${customInputFiles.reduce((sum, f) => sum + f.content.length, 0)} bytes total)`
                                                                : 'N/A'
                                                        }
                                                    </span>
                                                </div>
                                                <div className="bg-[#0c0c0c] border border-[#3c3c3c] rounded px-3 py-2 max-h-24 overflow-y-auto space-y-2">
                                                    {customTestMode === 'stdin' ? (
                                                        <pre className="text-[11px] text-[#569cd6] font-mono whitespace-pre-wrap break-words leading-relaxed">
                                                            {customStdin || '(empty)'}
                                                        </pre>
                                                    ) : (
                                                        customInputFiles.map((f, idx) => (
                                                            <div key={idx} className="border-b border-[#3c3c3c] pb-2 last:border-b-0 last:pb-0">
                                                                <p className="text-[9px] text-[#858585] mb-1">📄 {f.name}</p>
                                                                <pre className="text-[10px] text-[#569cd6] font-mono whitespace-pre-wrap break-words leading-tight max-h-12 overflow-hidden">
                                                                    {f.content}
                                                                </pre>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            {/* Output Section */}
                                            {runResult.stdout && (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-semibold text-[#858585] uppercase tracking-wider">📤 Output</span>
                                                        <span className="text-[9px] text-[#505050]">{runResult.stdout.length} chars</span>
                                                    </div>
                                                    <div className="bg-[#1a1a2e] border border-[#3c3c3c] rounded px-3 py-2 max-h-32 overflow-y-auto">
                                                        <pre className="text-[11px] text-[#d4d4d4] font-mono whitespace-pre-wrap break-words leading-relaxed">
                                                            {runResult.stdout}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Error Section */}
                                            {runResult.stderr && (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-semibold text-[#f44747] uppercase tracking-wider">⚠️ Stderr</span>
                                                        <span className="text-[9px] text-[#505050]">{runResult.stderr.length} chars</span>
                                                    </div>
                                                    <div className="bg-[#2d0000] border border-[#5c1e1e] rounded px-3 py-2 max-h-32 overflow-y-auto">
                                                        <pre className="text-[11px] text-[#f44747] font-mono whitespace-pre-wrap break-words leading-relaxed">
                                                            {runResult.stderr}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Message Section */}
                                            {runResult.message && !runResult.stdout && (
                                                <div className="space-y-1.5">
                                                    <span className="text-[10px] font-semibold text-[#858585] uppercase tracking-wider">💬 Message</span>
                                                    <div className={`px-3 py-2 rounded border ${runResult.compilation_status === 'Compiled Successfully'
                                                        ? 'bg-[#1a1a2e] border-[#3c3c3c]'
                                                        : 'bg-[#2d0000] border-[#5c1e1e]'
                                                        }`}>
                                                        <pre className={`text-[11px] font-mono whitespace-pre-wrap break-words leading-relaxed ${runResult.compilation_status === 'Compiled Successfully'
                                                            ? 'text-[#d4d4d4]'
                                                            : 'text-[#f44747]'
                                                            }`}>
                                                            {runResult.message}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Clear button */}
                                            <button
                                                type="button"
                                                onClick={() => setRunResult(null)}
                                                className="w-full text-[10px] px-2 py-1.5 rounded border border-[#3c3c3c] text-[#858585] hover:bg-[#252526] hover:border-[#505050] transition-colors"
                                            >
                                                Clear Output
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {rightPanel === 'feedback' && selectedSub && (
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[11px] text-[#858585] uppercase tracking-wider mb-2">Feedback to Student</p>
                                    <textarea
                                        value={gradeState.feedback}
                                        onChange={(e) => setGradeState(p => ({ ...p, feedback: e.target.value }))}
                                        placeholder="Write feedback for the student..."
                                        rows={12}
                                        className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg p-3 text-[13px] text-[#d4d4d4] placeholder-[#505050] resize-none focus:outline-none focus:border-[#862733] leading-relaxed"
                                    />
                                </div>
                                <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg p-3">
                                    <p className="text-[11px] text-[#858585] uppercase tracking-wider mb-2">Quick Feedback</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[
                                            'Great work!',
                                            'Good effort.',
                                            'Needs improvement.',
                                            'Check edge cases.',
                                            'Code style issues.',
                                            'Missing comments.',
                                            'Efficient solution.',
                                            'Review time complexity.',
                                        ].map(text => (
                                            <button key={text} onClick={() => setGradeState(p => ({
                                                ...p,
                                                feedback: p.feedback ? `${p.feedback}\n${text}` : text,
                                            }))}
                                                className="text-[10px] px-2 py-1 rounded-full bg-[#3c3c3c] text-[#cccccc] hover:bg-[#505050] transition-colors">
                                                {text}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {selectedSub.error_message && (
                                    <div className="bg-[#5c1e1e]/20 border border-[#f44747]/30 rounded-lg p-3">
                                        <p className="text-[11px] font-semibold text-[#f44747] mb-1">Submission Error</p>
                                        <pre className="text-[10px] text-[#f44747] whitespace-pre-wrap">{selectedSub.error_message}</pre>
                                    </div>
                                )}
                            </div>
                        )}

                        {rightPanel === 'description' && (
                            <div className="space-y-4">
                                {/* Description */}
                                <div>
                                    <p className="text-[11px] text-[#858585] uppercase tracking-wider mb-2">Description</p>
                                    <p className="text-[12px] text-[#cccccc] whitespace-pre-wrap leading-relaxed">
                                        {assignment.description || 'No description provided.'}
                                    </p>
                                </div>

                                {/* Instructions */}
                                {assignment.instructions && (
                                    <div>
                                        <p className="text-[11px] text-[#858585] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <Info className="w-3.5 h-3.5" /> Instructions
                                        </p>
                                        <pre className="whitespace-pre-wrap text-[12px] text-[#cccccc] leading-relaxed font-sans bg-[#1e1e1e] rounded-lg p-3 border border-[#3c3c3c]">
                                            {assignment.instructions}
                                        </pre>
                                    </div>
                                )}

                                {/* Quick Stats */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-[#1e1e1e] p-2.5 rounded-lg border border-[#3c3c3c]">
                                        <p className="text-[10px] text-[#858585] uppercase">Language</p>
                                        <p className="text-[12px] text-white font-medium mt-0.5">{assignment.language?.display_name || 'N/A'}</p>
                                    </div>
                                    <div className="bg-[#1e1e1e] p-2.5 rounded-lg border border-[#3c3c3c]">
                                        <p className="text-[10px] text-[#858585] uppercase">Max Score</p>
                                        <p className="text-[12px] text-white font-medium mt-0.5">{assignment.max_score} pts</p>
                                    </div>
                                    <div className="bg-[#1e1e1e] p-2.5 rounded-lg border border-[#3c3c3c]">
                                        <p className="text-[10px] text-[#858585] uppercase">Passing</p>
                                        <p className="text-[12px] text-white font-medium mt-0.5">{assignment.passing_score} pts</p>
                                    </div>
                                </div>

                                {/* Due Date */}
                                {assignment.due_date && (
                                    <div className="bg-[#1e1e1e] rounded-lg p-3 border border-[#3c3c3c] flex items-center gap-2.5">
                                        <Calendar className="w-4 h-4 text-[#862733] shrink-0" />
                                        <div>
                                            <p className="text-[10px] text-[#858585] uppercase">Due Date</p>
                                            <p className="text-[12px] text-white font-medium">{format(new Date(assignment.due_date), 'MMMM dd, yyyy h:mm a')}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Max Attempts */}
                                {(assignment.max_attempts !== undefined && assignment.max_attempts > 0) && (
                                    <div className="bg-[#1e1e1e] rounded-lg p-3 border border-[#3c3c3c]">
                                        <p className="text-[10px] text-[#858585] uppercase">Max Attempts</p>
                                        <p className="text-[12px] text-white font-medium mt-0.5">{assignment.max_attempts}</p>
                                    </div>
                                )}

                                {/* Late Policy */}
                                {assignment.allow_late && (
                                    <div className="bg-[#332b00] border border-[#665500] rounded-lg p-3">
                                        <p className="text-[11px] font-medium text-[#dcdcaa] flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" /> Late Policy
                                        </p>
                                        <p className="text-[11px] text-[#cccccc] mt-1">
                                            {assignment.late_penalty_per_day}% penalty per day, up to {assignment.max_late_days} days
                                        </p>
                                    </div>
                                )}

                                {/* File Requirements */}
                                <div className="bg-[#1e1e1e] rounded-lg p-3 border border-[#3c3c3c]">
                                    <p className="text-[11px] text-[#858585] uppercase tracking-wider mb-2">File Settings</p>
                                    <div className="space-y-1.5 text-[11px]">
                                        <p className="text-[#cccccc]">Max file size: <span className="text-white font-medium">{assignment.max_file_size_mb || 10} MB</span></p>
                                        {assignment.allowed_file_extensions && assignment.allowed_file_extensions.length > 0 && (
                                            <div>
                                                <p className="text-[#cccccc] mb-1">Allowed extensions:</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {assignment.allowed_file_extensions.map(ext => (
                                                        <span key={ext} className="text-[10px] px-1.5 py-0.5 rounded bg-[#3c3c3c] text-[#d4d4d4]">{ext}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Integrity Settings */}
                                <div className="bg-[#1e1e1e] rounded-lg p-3 border border-[#3c3c3c]">
                                    <p className="text-[11px] text-[#858585] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Shield className="w-3.5 h-3.5" /> Integrity Checks
                                    </p>
                                    <div className="space-y-1.5 text-[11px]">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[#cccccc]">Plagiarism Check</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${assignment.enable_plagiarism_check ? 'bg-[#2ea043]/20 text-[#7ee787]' : 'bg-[#3c3c3c] text-[#858585]'}`}>
                                                {assignment.enable_plagiarism_check ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[#cccccc]">AI Detection</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${assignment.enable_ai_detection ? 'bg-[#2ea043]/20 text-[#7ee787]' : 'bg-[#3c3c3c] text-[#858585]'}`}>
                                                {assignment.enable_ai_detection ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {rightPanel === 'rubric' && (
                            <div className="space-y-4">
                                {assignment.rubric && assignment.rubric.items?.length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="bg-[#1e1e1e] rounded-lg p-3 border border-[#3c3c3c]">
                                            <p className="text-[12px] text-[#cccccc]">
                                                Total Rubric Points:{' '}
                                                <span className="text-white font-semibold">
                                                    {assignment.rubric.total_points}
                                                </span>
                                            </p>
                                            <p className="text-[10px] text-[#858585] mt-1">
                                                {assignment.rubric.items.length} grading criteria
                                            </p>
                                        </div>
                                        <div className="bg-[#1e1e1e] rounded-lg border border-[#3c3c3c] divide-y divide-[#3c3c3c]">
                                            {assignment.rubric.items.map((item, idx) => (
                                                <div
                                                    key={item.id ?? idx}
                                                    className="px-3 py-2 flex items-start justify-between gap-2"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-medium text-[#d4d4d4]">
                                                            {item.name}
                                                        </p>
                                                        {item.description && (
                                                            <p className="text-[10px] text-[#858585] mt-0.5">
                                                                {item.description}
                                                            </p>
                                                        )}
                                                        <p className="text-[10px] text-[#858585] mt-0.5">
                                                            Weight: <span className="text-[#4ec9b0] font-semibold">{item.weight}%</span>
                                                            {typeof item.points === 'number' && (
                                                                <> · Points: <span className="text-[#4ec9b0] font-semibold">{item.points}</span></>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <FileText className="w-10 h-10 mx-auto text-[#505050] mb-3" />
                                        <p className="text-[12px] text-[#858585]">No rubric for this assignment</p>
                                    </div>
                                )}

                                {/* Test Cases Summary (reference only; grading is rubric-based) */}
                                {assignment.test_cases && assignment.test_cases.length > 0 && (
                                    <div className="bg-[#1e1e1e] rounded-lg p-3 border border-[#3c3c3c]">
                                        <p className="text-[11px] text-[#858585] uppercase tracking-wider mb-2">Test Cases ({assignment.test_cases.length})</p>
                                        <div className="space-y-1">
                                            {assignment.test_cases.map(tc => (
                                                <div key={tc.id} className="flex items-center justify-between text-[11px]">
                                                    <span className="text-[#cccccc] truncate flex-1">{tc.name}</span>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {tc.is_hidden && <span className="text-[9px] px-1 py-0.5 rounded bg-[#505050] text-[#858585]">Hidden</span>}
                                                        <span className="text-[#4ec9b0] font-medium">{tc.points} pts</span>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="border-t border-[#3c3c3c] pt-1 mt-1 flex justify-between text-[11px]">
                                                <span className="text-[#858585]">Total</span>
                                                <span className="text-white font-semibold">{assignment.test_cases.reduce((s, tc) => s + tc.points, 0)} pts</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {rightPanel === 'plagiarism' && selectedSub && (
                            <div className="space-y-4">
                                {isAssistant ? (
                                    <div className="rounded-lg p-4 bg-[#252526] border border-[#3c3c3c] text-center">
                                        <p className="text-sm text-[#858585]">Plagiarism details are available to faculty only. You can still grade this submission using the Grading tab.</p>
                                        {selectedSub.plagiarism_flagged && (
                                            <p className="text-xs text-[#f44747] mt-2">This submission has been flagged for plagiarism review.</p>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        {/* Summary */}
                                        <div className={`rounded-lg p-3 border ${selectedSub.plagiarism_flagged ? 'bg-[#5c1e1e]/20 border-[#f44747]/30' : 'bg-[#1e1e1e] border-[#3c3c3c]'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[11px] text-[#858585] uppercase tracking-wider">Similarity Score</p>
                                                {selectedSub.plagiarism_flagged && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#f44747]/20 text-[#f44747] font-semibold">FLAGGED</span>
                                                )}
                                            </div>
                                            <p className={`text-2xl font-bold ${selectedSub.plagiarism_flagged ? 'text-[#f44747]' : selectedSub.plagiarism_score && selectedSub.plagiarism_score > 20 ? 'text-[#dcdcaa]' : 'text-[#4ec9b0]'}`}>
                                                {selectedSub.plagiarism_checked && selectedSub.plagiarism_score !== null
                                                    ? `${selectedSub.plagiarism_score.toFixed(1)}%`
                                                    : 'Not checked'}
                                            </p>
                                            {!selectedSub.plagiarism_checked && (
                                                <p className="text-[10px] text-[#858585] mt-1">Run a plagiarism check to compare against other submissions</p>
                                            )}
                                        </div>

                                        {/* Run Check Button */}
                                        <button
                                            onClick={runPlagiarismCheck}
                                            disabled={checkingPlagiarism}
                                            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-400 hover:bg-purple-600/30 transition-colors text-[11px] font-medium disabled:opacity-50"
                                        >
                                            {checkingPlagiarism
                                                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking...</>
                                                : <><Shield className="w-3.5 h-3.5" /> {selectedSub.plagiarism_checked ? 'Re-run Check' : 'Run Plagiarism Check'}</>}
                                        </button>

                                        {/* Compare mode indicator */}
                                        {compareMode && (
                                            <div className="rounded-lg p-2.5 bg-purple-900/30 border border-purple-500/30">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400" />
                                                    <span className="text-[11px] font-semibold text-purple-300">Comparing in Editor</span>
                                                </div>
                                                <p className="text-[10px] text-[#858585]">
                                                    vs <span className="text-purple-300">{compareMode.matchedStudentName}</span> - {compareMode.similarity.toFixed(1)}%
                                                </p>
                                                <button onClick={exitCompareMode}
                                                    className="mt-2 w-full py-1 rounded bg-[#3c3c3c] hover:bg-[#505050] text-[10px] text-[#cccccc] transition-colors">
                                                    Exit Compare Mode
                                                </button>
                                            </div>
                                        )}

                                        {/* Unified Matched Students List */}
                                        {unifiedPlagiarismMatches.length > 0 ? (
                                            <div>
                                                <p className="text-[11px] text-[#858585] uppercase tracking-wider mb-2">
                                                    Matched Students ({unifiedPlagiarismMatches.length})
                                                </p>
                                                <div className="space-y-2">
                                                    {unifiedPlagiarismMatches.map((m: any) => {
                                                        const matchedSub = allSubs.find(s => s.id === m.matched_submission_id);
                                                        const matchedName = matchedSub?.student?.full_name || m.matched_source || m.student_name || `Submission #${m.matched_submission_id}`;
                                                        const isActive = compareMode?.matchedSubId === m.matched_submission_id;

                                                        return (
                                                            <div key={m.id}
                                                                className={`rounded-lg border overflow-hidden transition-all cursor-pointer ${isActive
                                                                    ? 'bg-purple-900/30 border-purple-500/50 ring-1 ring-purple-500/30'
                                                                    : 'bg-[#1e1e1e] border-[#3c3c3c] hover:border-[#505050]'
                                                                    }`}
                                                                onClick={() => {
                                                                    if (!isActive && m.matched_submission_id) enterCompareMode(m);
                                                                }}
                                                            >
                                                                <div className="p-2.5">
                                                                    {/* Student header */}
                                                                    <div className="flex items-center gap-2 mb-1.5">
                                                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${m.similarity_percentage >= 50
                                                                            ? 'bg-[#f44747]/20 text-[#f44747]'
                                                                            : m.similarity_percentage >= 30
                                                                                ? 'bg-[#dcdcaa]/20 text-[#dcdcaa]'
                                                                                : 'bg-[#4ec9b0]/20 text-[#4ec9b0]'
                                                                            }`}>
                                                                            {matchedName.charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-[11px] font-medium text-[#cccccc] truncate">{matchedName}</p>
                                                                            {matchedSub?.student?.student_id && (
                                                                                <p className="text-[9px] text-[#858585]">ID: {matchedSub.student.student_id}</p>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                                                                            <span className={`text-[13px] font-bold ${m.similarity_percentage >= 50 ? 'text-[#f44747]'
                                                                                : m.similarity_percentage >= 30 ? 'text-[#dcdcaa]'
                                                                                    : 'text-[#4ec9b0]'
                                                                                }`}>
                                                                                {m.similarity_percentage.toFixed(1)}%
                                                                            </span>
                                                                            {m.is_reviewed && (
                                                                                <span className={`text-[8px] px-1 py-0.5 rounded ${m.is_confirmed ? 'bg-[#f44747]/20 text-[#f44747]' : 'bg-[#2ea043]/20 text-[#7ee787]'
                                                                                    }`}>
                                                                                    {m.is_confirmed ? 'Confirmed' : 'Dismissed'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Similarity bar */}
                                                                    <div className="mb-2">
                                                                        <div className="h-1.5 rounded-full bg-[#333] overflow-hidden">
                                                                            <div
                                                                                className={`h-full rounded-full transition-all ${m.similarity_percentage >= 50 ? 'bg-[#f44747]'
                                                                                    : m.similarity_percentage >= 30 ? 'bg-[#dcdcaa]'
                                                                                        : 'bg-[#4ec9b0]'
                                                                                    }`}
                                                                                style={{ width: `${Math.min(m.similarity_percentage, 100)}%` }}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    {/* Action row */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (isActive) exitCompareMode();
                                                                            else if (m.matched_submission_id) enterCompareMode(m);
                                                                        }}
                                                                        className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-medium transition-colors ${isActive
                                                                            ? 'bg-purple-600/30 border border-purple-500/40 text-purple-300 hover:bg-purple-600/40'
                                                                            : 'bg-[#2a2d2e] border border-[#3c3c3c] text-[#cccccc] hover:bg-[#3c3c3c] hover:text-white'
                                                                            }`}
                                                                    >
                                                                        <ArrowLeftRight className="w-3 h-3" />
                                                                        {isActive ? 'Exit Compare' : 'Compare Code Side-by-Side'}
                                                                    </button>
                                                                </div>

                                                                {/* Code snippet preview (only for DB matches with snippets, not in compare mode) */}
                                                                {m.source_code_snippet && !isActive && (
                                                                    <div className="border-t border-[#3c3c3c]" onClick={(e) => e.stopPropagation()}>
                                                                        <div className="grid grid-cols-2 divide-x divide-[#3c3c3c]">
                                                                            <div className="p-2">
                                                                                <p className="text-[9px] text-[#858585] mb-1">This student (L{m.source_line_start}–{m.source_line_end})</p>
                                                                                <pre className="text-[10px] text-[#d4d4d4] font-mono whitespace-pre-wrap max-h-16 overflow-y-auto">{m.source_code_snippet}</pre>
                                                                            </div>
                                                                            <div className="p-2">
                                                                                <p className="text-[9px] text-[#858585] mb-1">Match (L{m.matched_line_start}–{m.matched_line_end})</p>
                                                                                <pre className="text-[10px] text-[#ffa198] font-mono whitespace-pre-wrap max-h-16 overflow-y-auto">{m.matched_code_snippet}</pre>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ) : selectedSub.plagiarism_checked ? (
                                            <div className="text-center py-6">
                                                <CheckCircle2 className="w-8 h-8 mx-auto text-[#2ea043] mb-2" />
                                                <p className="text-[12px] text-[#cccccc]">No significant matches found</p>
                                                <p className="text-[10px] text-[#858585] mt-1">This submission appears to be original</p>
                                            </div>
                                        ) : null}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Save button at bottom of right panel */}
                    <div className="px-4 py-3 border-t border-[#3c3c3c] shrink-0">
                        <Button onClick={saveGrade} disabled={isSaving} className="w-full bg-[#862733] hover:bg-[#a03040] text-white h-9 text-[12px]">
                            {isSaving
                                ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Saving...</>
                                : <><Save className="w-3.5 h-3.5 mr-2" /> Save Grade</>
                            }
                        </Button>
                    </div>
                </div>
            </div>

            {/* ===== Test Case Detail Dialog ===== */}
            <Dialog open={!!viewingTestResult} onOpenChange={(open) => { if (!open) setViewingTestResult(null); }}>
                <DialogContent className="bg-[#252526] border-[#3c3c3c] text-[#cccccc] max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                    {viewingTestResult && (() => {
                        const spec = getTestCaseSpec(viewingTestResult.test_case_id);
                        return (
                            <>
                                <DialogHeader className="shrink-0">
                                    <DialogTitle className="text-[#d4d4d4] flex items-center gap-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${viewingTestResult.passed ? 'bg-[#2ea043]' : 'bg-[#f44747]'} text-white`}>
                                            {viewingTestResult.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                        </div>
                                        {spec?.name || `Test Case #${viewingTestResult.test_case_id}`}
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="overflow-y-auto flex-1 space-y-4 pr-1">
                                    {/* Summary row */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <div className="bg-[#1e1e1e] rounded-lg p-2.5 border border-[#3c3c3c]">
                                            <p className="text-[10px] text-[#858585] mb-0.5">Status</p>
                                            <p className={`text-[13px] font-semibold ${viewingTestResult.passed ? 'text-[#2ea043]' : 'text-[#f44747]'}`}>
                                                {viewingTestResult.passed ? 'Passed' : viewingTestResult.timed_out ? 'Timed Out' : 'Failed'}
                                            </p>
                                        </div>
                                        <div className="bg-[#1e1e1e] rounded-lg p-2.5 border border-[#3c3c3c]">
                                            <p className="text-[10px] text-[#858585] mb-0.5">Points</p>
                                            <p className="text-[13px] font-semibold text-[#d4d4d4]">{viewingTestResult.points_awarded} / {spec?.points ?? '?'}</p>
                                        </div>
                                        <div className="bg-[#1e1e1e] rounded-lg p-2.5 border border-[#3c3c3c]">
                                            <p className="text-[10px] text-[#858585] mb-0.5">Visibility</p>
                                            <p className="text-[13px] font-semibold text-[#d4d4d4]">{spec?.is_hidden ? 'Hidden' : 'Visible'}</p>
                                        </div>
                                        {spec?.time_limit_seconds && (
                                            <div className="bg-[#1e1e1e] rounded-lg p-2.5 border border-[#3c3c3c]">
                                                <p className="text-[10px] text-[#858585] mb-0.5">Time Limit</p>
                                                <p className="text-[13px] font-semibold text-[#d4d4d4]">{spec.time_limit_seconds}s</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Description */}
                                    {spec?.description && (
                                        <div>
                                            <p className="text-[11px] font-semibold text-[#858585] uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Description</p>
                                            <div className="bg-[#1e1e1e] rounded-lg p-3 border border-[#3c3c3c] text-[12px] text-[#cccccc]">{spec.description}</div>
                                        </div>
                                    )}

                                    {/* Comparison flags */}
                                    {spec && (
                                        <div className="flex flex-wrap gap-2">
                                            {spec.ignore_whitespace && (
                                                <span className="text-[10px] px-2 py-1 rounded-full bg-[#1e1e1e] border border-[#3c3c3c] text-[#858585]">Ignores Whitespace</span>
                                            )}
                                            {spec.ignore_case && (
                                                <span className="text-[10px] px-2 py-1 rounded-full bg-[#1e1e1e] border border-[#3c3c3c] text-[#858585]">Case Insensitive</span>
                                            )}
                                        </div>
                                    )}

                                    {/* Input Data */}
                                    {spec?.input_data && (
                                        <div>
                                            <p className="text-[11px] font-semibold text-[#858585] uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5" /> Input</p>
                                            <pre className="bg-[#0d1117] rounded-lg p-3 border border-[#3c3c3c] text-[12px] text-[#79c0ff] font-mono overflow-auto max-h-[120px]">{spec.input_data}</pre>
                                        </div>
                                    )}

                                    {/* Expected Output */}
                                    {(spec?.expected_output || viewingTestResult.expected_output) && (
                                        <div>
                                            <p className="text-[11px] font-semibold text-[#858585] uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Expected Output</p>
                                            <pre className="bg-[#0d1117] rounded-lg p-3 border border-[#3c3c3c] text-[12px] text-[#7ee787] font-mono overflow-auto max-h-[120px]">{spec?.expected_output || viewingTestResult.expected_output}</pre>
                                        </div>
                                    )}

                                    {/* Actual Output */}
                                    {viewingTestResult.actual_output && (
                                        <div>
                                            <p className="text-[11px] font-semibold text-[#858585] uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><Code className="w-3.5 h-3.5" /> Actual Output</p>
                                            <pre className={`bg-[#0d1117] rounded-lg p-3 border text-[12px] font-mono overflow-auto max-h-[120px] ${viewingTestResult.passed ? 'border-[#2ea043]/30 text-[#7ee787]' : 'border-[#f44747]/30 text-[#ffa198]'}`}>{viewingTestResult.actual_output}</pre>
                                        </div>
                                    )}

                                    {/* Error Message */}
                                    {viewingTestResult.error_message && (
                                        <div>
                                            <p className="text-[11px] font-semibold text-[#f44747] uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Error</p>
                                            <pre className="bg-[#5c1e1e]/20 rounded-lg p-3 border border-[#f44747]/30 text-[12px] text-[#ffa198] font-mono overflow-auto max-h-[150px] whitespace-pre-wrap">{viewingTestResult.error_message}</pre>
                                        </div>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* ===== Status Bar ===== */}
            <div className="flex items-center justify-between bg-[#862733] px-3 py-0.5 text-white text-[11px] select-none shrink-0">
                <div className="flex items-center gap-3">
                    {isRunning ? (
                        <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Running...</span>
                    ) : runResult ? (
                        <span className="flex items-center gap-1">
                            {runResult.compilation_status === 'Compiled Successfully' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {runResult.compilation_status}
                            {runResult.results.length > 0 && ` · ${runResult.tests_passed}/${runResult.tests_total} tests`}
                        </span>
                    ) : <span>Grading Workspace</span>}
                </div>
                <div className="flex items-center gap-3">
                    {selectedSub && <span>Attempt #{selectedSub.attempt_number}</span>}
                    {selectedSub && <span>{subFiles.length} file{subFiles.length !== 1 ? 's' : ''}</span>}
                    <span>{assignment.language?.display_name || 'N/A'}</span>
                </div>
            </div>

            {/* ===== Grade Saved Overlay ===== */}
            {gradeSaved && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#252526] border border-[#3c3c3c] rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                        <div className="w-16 h-16 rounded-full bg-[#2ea043]/20 flex items-center justify-center mx-auto mb-5">
                            <CheckCircle2 className="w-9 h-9 text-[#2ea043]" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Grade Saved!</h2>
                        <p className="text-sm text-[#858585] mb-6">
                            The grade has been saved successfully.
                            {gradeState.finalScore && <> Final score: <span className="text-white font-semibold">{gradeState.finalScore}/{assignment.max_score}</span></>}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setGradeSaved(false)}
                                className="flex-1 px-4 py-2.5 rounded-lg border border-[#505050] text-[#cccccc] text-sm font-medium hover:bg-[#3c3c3c] transition-colors"
                            >
                                Continue Grading
                            </button>
                            <button
                                onClick={goBack}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-[#862733] text-white text-sm font-medium hover:bg-[#a03040] transition-colors"
                            >
                                Back to Assignment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
