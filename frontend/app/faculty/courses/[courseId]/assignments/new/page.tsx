'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assignmentCreateSchema } from '@/lib/validation';
import type { z } from 'zod';
import { format as formatDate } from 'date-fns';

type AssignmentCreateForm = z.infer<typeof assignmentCreateSchema>;

import {
    FileText,
    Code,
    Calendar as CalendarIcon,
    Award,
    Settings,
    Users,
    Shield,
    Upload,
    FileCode,
    Clock,
    Target,
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Save,
    X,
    Plus,
    Trash2,
    FlaskConical,
    Paperclip,
    GripVertical,
    Eye,
    EyeOff,
    File as FileIcon,
    BookOpen,
    Layers,
    PartyPopper,
} from 'lucide-react';

type Language = {
    id: number;
    name: string;
    version?: string;
    allowed_extensions?: string[];
};

type TestCase = {
    name: string;
    description: string;
    input_type: 'stdin' | 'file';
    input_data: string;
    inputFiles: File[];
    input_filenames?: string[];
    expected_output_type: 'text' | 'file';
    expected_output: string;
    expectedFiles: File[];
    is_hidden: boolean;
    ignore_whitespace: boolean;
    ignore_case: boolean;
    time_limit_seconds: number | null;
    memory_limit_mb: number | null;
    order: number;
};

type RubricItem = {
    name: string;
    description: string;
    weight: number;
    points: number;
    libraryItemId?: number;
};
type RubricLibraryItem = {
    id: number;
    name: string;
    description?: string | null;
};

type AttachmentFile = {
    file: File;
    id: string;
};

const parseDateTimeInput = (value?: string): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const toDateTimeInput = (date: Date): string => formatDate(date, "yyyy-MM-dd'T'HH:mm");

export default function NewAssignmentPage() {
    const router = useRouter();
    const params = useParams();
    const courseParam = params?.courseId as string | string[] | undefined;
    const courseIdStr = Array.isArray(courseParam) ? (courseParam[0] ?? '') : (courseParam ?? '');
    const courseId = useMemo(() => parseInt(courseIdStr, 10), [courseIdStr]);

    const [languages, setLanguages] = useState<Language[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(['basic', 'timing'])
    );

    // Test cases
    const [testCases, setTestCases] = useState<TestCase[]>([]);
    const [testInputMode, setTestInputMode] = useState<'stdin' | 'file'>('stdin');

    // Rubric: 'weight' = criteria weights sum to 100%; 'points' = criteria points sum to max_score
    const [rubricEnabled, setRubricEnabled] = useState(false);
    const [rubricMode, setRubricMode] = useState<'weight' | 'points'>('weight');
    const [rubricItems, setRubricItems] = useState<RubricItem[]>([]);
    const [rubricLibrary, setRubricLibrary] = useState<RubricLibraryItem[]>([]);

    // Load reusable rubric items for selection
    useEffect(() => {
        let isMounted = true;
        apiClient
            .getRubricItems()
            .then((data) => {
                if (!isMounted) return;
                const items = Array.isArray(data)
                    ? data
                        .filter((item): item is RubricLibraryItem => !!item && typeof item.id === 'number' && typeof item.name === 'string')
                        .sort((a, b) => a.name.localeCompare(b.name))
                    : [];
                setRubricLibrary(items);
            })
            .catch(() => {
                // Silently ignore; rubric library is an enhancement
            });
        return () => {
            isMounted = false;
        };
    }, []);

    // File uploads
    const [starterFile, setStarterFile] = useState<File | null>(null);
    const [solutionFile, setSolutionFile] = useState<File | null>(null);
    const [attachmentFiles, setAttachmentFiles] = useState<AttachmentFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const attachmentInputRef = useRef<HTMLInputElement>(null);

    const { register, control, handleSubmit, formState: { errors }, watch, setValue } = useForm<AssignmentCreateForm>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(assignmentCreateSchema) as any,
        defaultValues: {
            title: '',
            language_id: undefined as unknown as number,
            description: '',
            instructions: '',
            due_date: '',
            max_score: 100,
            passing_score: 60,
            allow_late: true,
            late_penalty_per_day: 10,
            max_late_days: 7,
            max_attempts: 10,
            max_file_size_mb: 10,
            allowedExtensionsStr: '',
            allow_groups: false,
            max_group_size: 4,
            enable_plagiarism_check: true,
            plagiarism_threshold: 30,
            enable_ai_detection: true,
            ai_detection_threshold: 50,
            is_published: false,
        }
    });

    useEffect(() => {
        const loadLanguages = async () => {
            try {
                const list = await apiClient.getLanguages();
                setLanguages(list || []);
            } catch (e) {
                console.error('Failed to load languages', e);
            }
        };
        loadLanguages();
    }, []);

    const watchLangId = watch('language_id');
    useEffect(() => {
        const langId = watchLangId ? Number(watchLangId) : undefined;
        if (!langId || languages.length === 0) return;
        const lang = languages.find((l) => Number(l.id) === langId);
        if (lang?.allowed_extensions?.length) {
            const extStr = lang.allowed_extensions.join(', ');
            setValue('allowedExtensionsStr', extStr, { shouldValidate: false });
        }
    }, [watchLangId, languages, setValue]);

    // ─── Test Case Management ───
    const addTestCase = () => {
        setTestCases(prev => [...prev, {
            name: `Test Case ${prev.length + 1}`,
            description: '',
            input_type: testInputMode,
            input_data: '',
            inputFiles: [],
            input_filenames: [],
            expected_output_type: 'text',
            expected_output: '',
            expectedFiles: [],
            is_hidden: false,
            ignore_whitespace: true,
            ignore_case: false,
            time_limit_seconds: null,
            memory_limit_mb: null,
            order: prev.length,
        }]);
    };

    const removeTestCase = (index: number) => {
        setTestCases(prev => prev.filter((_, i) => i !== index));
    };

    const updateTestCase = (index: number, field: keyof TestCase, value: TestCase[keyof TestCase]) => {
        setTestCases(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const addFilesToTestCase = (index: number, field: 'inputFiles' | 'expectedFiles', newFiles: File[]) => {
        setTestCases(prev => {
            const updated = [...prev];
            const tc = { ...updated[index] };
            const existing = tc[field] || [];
            const existingNames = new Set(existing.map(f => f.name));
            const deduped = newFiles.filter(f => !existingNames.has(f.name));
            tc[field] = [...existing, ...deduped];
            if (field === 'inputFiles') {
                tc.input_filenames = tc.inputFiles.map(f => f.name);
            }
            updated[index] = tc;
            return updated;
        });
    };

    const removeFileFromTestCase = (index: number, field: 'inputFiles' | 'expectedFiles', fileName: string) => {
        setTestCases(prev => {
            const updated = [...prev];
            const tc = { ...updated[index] };
            tc[field] = (tc[field] || []).filter(f => f.name !== fileName);
            if (field === 'inputFiles') {
                tc.input_filenames = tc.inputFiles.map(f => f.name);
            }
            updated[index] = tc;
            return updated;
        });
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // ─── Rubric Management (flat list of items) ───
    const addRubricItem = () => {
        setRubricItems(prev => [
            ...prev,
            {
                name: `Criterion ${prev.length + 1}`,
                description: '',
                weight: 0,
                points: 0,
            },
        ]);
    };

    const removeRubricItem = (index: number) => {
        setRubricItems(prev => prev.filter((_, i) => i !== index));
    };

    const updateRubricItem = (index: number, field: keyof RubricItem, value: string | number) => {
        setRubricItems(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    // ─── Attachment Management ───
    const addAttachments = (fileList: FileList | File[]) => {
        const newFiles: AttachmentFile[] = Array.from(fileList).map(file => ({
            file,
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        }));
        setAttachmentFiles(prev => [...prev, ...newFiles]);
    };

    const removeAttachment = (id: string) => {
        setAttachmentFiles(prev => prev.filter(f => f.id !== id));
    };

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
        if (e.dataTransfer.files.length > 0) {
            addAttachments(e.dataTransfer.files);
        }
    }, []);

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // ─── Form Submit ───
    const onSubmit: SubmitHandler<AssignmentCreateForm> = async (values: AssignmentCreateForm) => {
        setError(null);
        setErrorModalOpen(false);
        setLoading(true);
        try {
            const dueDateISO = new Date(values.due_date).toISOString();

            const selectedLanguage = languages.find(lang => String(lang.id) === String(values.language_id));
            if (!selectedLanguage) {
                setError('Please select a valid programming language.');
                setErrorModalOpen(true);
                setLoading(false);
                return;
            }

            if (rubricEnabled && rubricItems.length > 0) {
                const maxScore = Number(values.max_score) || 100;
                if (rubricMode === 'weight') {
                    const weightSum = rubricItems.reduce((s, i) => s + (i.weight || 0), 0);
                    if (Math.abs(weightSum - 100) > 0.01) {
                        setError(`Weights must sum to 100% (current total: ${weightSum.toFixed(1)}%).`);
                        setErrorModalOpen(true);
                        setLoading(false);
                        return;
                    }
                } else {
                    const pointsSum = rubricItems.reduce((s, i) => s + (i.points || 0), 0);
                    if (Math.abs(pointsSum - maxScore) > 0.01) {
                        setError(`Points must sum to the assignment max score (${maxScore}). Current total: ${pointsSum.toFixed(1)}.`);
                        setErrorModalOpen(true);
                        setLoading(false);
                        return;
                    }
                }
            }

            const starter_code = '';
            const solution_code = '';

            const allowed_file_extensions = (values.allowedExtensionsStr || '')
                .split(',').map(s => s.trim()).filter(Boolean)
                .map(ext => (ext.startsWith('.') ? ext : `.${ext}`));

            const payload: Record<string, unknown> = {
                course_id: courseId,
                title: values.title.trim(),
                description: values.description.trim(),
                instructions: values.instructions?.trim() || undefined,
                language_id: parseInt(String(values.language_id), 10),
                due_date: dueDateISO,
                max_score: values.max_score,
                passing_score: values.passing_score,
                allow_late: values.allow_late,
                late_penalty_per_day: values.late_penalty_per_day,
                max_late_days: values.max_late_days,
                max_attempts: values.max_attempts,
                max_file_size_mb: values.max_file_size_mb,
                allowed_file_extensions: allowed_file_extensions.length ? allowed_file_extensions : undefined,
                allow_groups: values.allow_groups,
                max_group_size: values.max_group_size,
                enable_plagiarism_check: values.enable_plagiarism_check,
                plagiarism_threshold: values.plagiarism_threshold,
                enable_ai_detection: values.enable_ai_detection,
                ai_detection_threshold: values.ai_detection_threshold,
                starter_code,
                solution_code,
                is_published: values.is_published,
            };

            const fileToBase64 = async (file: File | null | undefined): Promise<string | undefined> => {
                if (!file) return undefined;
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = reader.result;
                        if (typeof result === 'string') {
                            const commaIndex = result.indexOf(',');
                            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
                        } else {
                            reject(new Error('Failed to read file'));
                        }
                    };
                    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
                    reader.readAsDataURL(file);
                });
            };

            const filesToBase64List = async (files: File[] | undefined): Promise<{ filename: string; content_base64: string }[]> => {
                if (!files || files.length === 0) return [];
                const results: { filename: string; content_base64: string }[] = [];
                for (const file of files) {
                    const content_base64 = await fileToBase64(file);
                    if (content_base64) {
                        results.push({ filename: file.name, content_base64 });
                    }
                }
                return results;
            };

            if (testCases.length > 0) {
                const testCasePayloads = [];
                for (let index = 0; index < testCases.length; index++) {
                    const tc = testCases[index];
                    const base: any = {
                        name: tc.name.trim(),
                        description: tc.description?.trim() || undefined,
                        input_type: tc.input_type,
                        expected_output_type: tc.expected_output_type,
                        is_hidden: tc.is_hidden,
                        ignore_whitespace: tc.ignore_whitespace,
                        ignore_case: tc.ignore_case,
                        time_limit_seconds: tc.time_limit_seconds || undefined,
                        memory_limit_mb: tc.memory_limit_mb || undefined,
                        order: index,
                    };

                    if (tc.input_type === 'stdin') {
                        base.input_data = tc.input_data;
                    } else {
                        const inputFilesList = await filesToBase64List(tc.inputFiles);
                        base.input_files = inputFilesList;
                    }

                    if (tc.expected_output_type === 'text') {
                        base.expected_output = tc.expected_output;
                    } else {
                        const expectedFilesList = await filesToBase64List(tc.expectedFiles);
                        if (expectedFilesList.length > 0) {
                            // For now, send the first file via the existing field for compatibility
                            base.expected_output_file_base64 = expectedFilesList[0].content_base64;
                            base.expected_output_filename = expectedFilesList[0].filename;
                            // Also include full list for future backend support
                            base.expected_output_files = expectedFilesList;
                        }
                    }

                    testCasePayloads.push(base);
                }
                payload.test_cases = testCasePayloads;
            }

            if (rubricEnabled && rubricItems.length > 0) {
                const maxScore = Number(values.max_score) || 100;
                payload.rubric = {
                    items: rubricItems.map(item => {
                        if (rubricMode === 'weight') {
                            const w = item.weight ?? 0;
                            return {
                                name: item.name.trim(),
                                description: (item.description || '').trim() || undefined,
                                weight: w,
                                points: (w / 100) * maxScore,
                            };
                        }
                        const p = item.points ?? 0;
                        return {
                            name: item.name.trim(),
                            description: (item.description || '').trim() || undefined,
                            weight: maxScore > 0 ? (p / maxScore) * 100 : 0,
                            points: p,
                        };
                    }),
                };
            }

            const supplementaryFiles = attachmentFiles.map(af => af.file);
            await apiClient.createAssignment(payload, {
                starterFile: starterFile ?? undefined,
                solutionFile: solutionFile ?? undefined,
                supplementaryFiles: supplementaryFiles.length > 0 ? supplementaryFiles : undefined,
            });

            setSuccessModalOpen(true);
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: string | { msg?: string }[] } }; message?: string };
            console.error('Create assignment failed', err);
            const detail = axiosErr?.response?.data?.detail;
            let msg = 'Failed to create assignment.';
            if (typeof detail === 'string') {
                msg = detail;
            } else if (Array.isArray(detail)) {
                msg = detail.map((d) => d.msg || String(d)).join(', ');
            } else if (axiosErr?.message) {
                msg = axiosErr.message;
            }
            setError(msg);
            setErrorModalOpen(true);
        } finally {
            setLoading(false);
        }
    };

    // ─── Section toggle ───
    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(section)) newSet.delete(section);
            else newSet.add(section);
            return newSet;
        });
    };

    const SectionHeader = ({ id, icon: Icon, title, subtitle, badge }: {
        id: string; icon: React.ElementType; title: string; subtitle: string; badge?: React.ReactNode;
    }) => (
        <button
            type="button"
            onClick={() => toggleSection(id)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50/80 transition-colors rounded-lg group"
        >
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/15 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{title}</h3>
                        {badge}
                    </div>
                    <p className="text-sm text-gray-500">{subtitle}</p>
                </div>
            </div>
            {expandedSections.has(id) ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
        </button>
    );

    // ─── Completion indicator ───
    const watchTitle = watch('title');
    const watchDesc = watch('description');
    const watchDueDate = watch('due_date');

    const completionSteps = [
        { label: 'Title', done: !!watchTitle?.trim() },
        { label: 'Language', done: !!watchLangId },
        { label: 'Description', done: !!watchDesc?.trim() },
        { label: 'Due Date', done: !!watchDueDate },
    ];
    const completedCount = completionSteps.filter(s => s.done).length;
    const completionPct = Math.round((completedCount / completionSteps.length) * 100);

    return (
        <div className="h-full flex flex-col">
            <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 overflow-y-auto">
                {/* ─── Header ─── */}
                <div className="mb-8">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                                <div className="p-2.5 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg shadow-primary/20">
                                    <FileText className="w-7 h-7 text-white" />
                                </div>
                                Create New Assignment
                            </h1>
                            <p className="mt-2 text-gray-600">
                                Design a comprehensive programming assignment for your students
                            </p>
                        </div>
                        <Button
                            type="button"
                            onClick={() => router.back()}
                            className="gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        >
                            <X className="w-4 h-4" />
                            Cancel
                        </Button>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Setup Progress</span>
                            <span className="text-sm font-semibold text-primary">{completionPct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                            <div
                                className="bg-gradient-to-r from-primary to-primary/80 h-2 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${completionPct}%` }}
                            />
                        </div>
                        <div className="flex flex-wrap gap-3 mt-3">
                            {completionSteps.map((step) => (
                                <div key={step.label} className="flex items-center gap-1.5 text-xs">
                                    {step.done ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                    ) : (
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300" />
                                    )}
                                    <span className={step.done ? 'text-green-700 font-medium' : 'text-gray-500'}>{step.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ─── Error Modal ─── */}
                <Modal
                    isOpen={errorModalOpen}
                    onClose={() => { setErrorModalOpen(false); setError(null); }}
                    title="Error Creating Assignment"
                    description="Something went wrong. Please fix the issues below and try again."
                    size="md"
                >
                    <div className="space-y-4">
                        <div className="flex items-start gap-4 rounded-xl bg-red-50 border border-red-200 p-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-red-900">What went wrong</p>
                                <p className="mt-1 text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                        <ModalFooter>
                            <Button
                                type="button"
                                onClick={() => { setErrorModalOpen(false); setError(null); }}
                                className="bg-primary hover:bg-primary/90 text-white px-6"
                            >
                                Got it
                            </Button>
                        </ModalFooter>
                    </div>
                </Modal>

                {/* ─── Success Modal ─── */}
                <Modal
                    isOpen={successModalOpen}
                    onClose={() => {
                        setSuccessModalOpen(false);
                        router.push(`/faculty/courses/${courseId}/assignments`);
                    }}
                    size="md"
                >
                    <div className="py-2">
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-in zoom-in-50 duration-500">
                                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                                </div>
                                <div className="absolute -top-1 -right-1">
                                    <PartyPopper className="w-8 h-8 text-amber-500 animate-in spin-in-180 duration-700" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold text-gray-900">Assignment created successfully!</h3>
                                <p className="text-sm text-gray-600 max-w-sm">
                                    Your assignment has been saved. Students will see it once you publish it.
                                </p>
                            </div>
                            <ModalFooter className="border-t-0 pt-0 justify-center">
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setSuccessModalOpen(false);
                                        router.push(`/faculty/courses/${courseId}/assignments`);
                                    }}
                                    className="bg-primary hover:bg-primary/90 text-white px-8 gap-2"
                                >
                                    <FileText className="w-4 h-4" />
                                    View Assignments
                                </Button>
                            </ModalFooter>
                        </div>
                    </div>
                </Modal>

                {/* ─── Form ─── */}
                <form
                    onSubmit={handleSubmit(onSubmit, (err) => {
                        const msgs = Object.entries(err).map(([, v]) => (v as { message?: string })?.message).filter(Boolean);
                        setError(msgs.length ? msgs.join('. ') : 'Please fix the form errors before submitting.');
                        setErrorModalOpen(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    })}
                    className="space-y-5"
                >

                    {/* ━━━ 1. Basic Information ━━━ */}
                    <Card className="overflow-hidden border-gray-200 shadow-sm">
                        <CardHeader className="pb-0">
                            <SectionHeader
                                id="basic"
                                icon={FileText}
                                title="Basic Information"
                                subtitle="Assignment title, language, and description"
                            />
                        </CardHeader>
                        {expandedSections.has('basic') && (
                            <CardContent className="pt-2 pb-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <Input
                                            label="Assignment Title"
                                            {...register('title')}
                                            error={errors.title?.message}
                                            placeholder="e.g., Binary Search Tree Implementation"
                                            required
                                        />
                                    </div>

                                    <Select
                                        label="Programming Language"
                                        {...register('language_id', { valueAsNumber: true })}
                                        error={errors.language_id?.message}
                                        options={languages.map((l) => ({
                                            value: String(l.id),
                                            label: l.version ? `${l.name} (${l.version})` : l.name
                                        }))}
                                        placeholder="Select language"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Description <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        className="w-full min-h-[120px] rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-y"
                                        {...register('description')}
                                        placeholder="Describe what students need to accomplish in this assignment..."
                                    />
                                    {errors.description?.message && (
                                        <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {errors.description.message}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Detailed Instructions <span className="text-gray-400 text-xs font-normal">(Markdown supported)</span>
                                    </label>
                                    <textarea
                                        className="w-full min-h-[140px] rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-y"
                                        {...register('instructions')}
                                        placeholder={"## Requirements\n- Implement the `insert` method\n- Implement the `search` method\n\n## Constraints\n- Time complexity: O(log n) average"}
                                    />
                                </div>
                            </CardContent>
                        )}
                    </Card>

                    {/* ━━━ 2. Timing & Scoring ━━━ */}
                    <Card className="overflow-hidden border-gray-200 shadow-sm">
                        <CardHeader className="pb-0">
                            <SectionHeader
                                id="timing"
                                icon={CalendarIcon}
                                title="Timing & Scoring"
                                subtitle="Start date, due date, score limits, and late submission policy"
                            />
                        </CardHeader>
                        {expandedSections.has('timing') && (
                            <CardContent className="pt-2 pb-6 space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                    <Controller
                                        name="due_date"
                                        control={control}
                                        render={({ field }) => (
                                            <Calendar
                                                label="Due Date & Time"
                                                selectedDate={parseDateTimeInput(field.value)}
                                                onDateChange={(date) => field.onChange(date ? toDateTimeInput(date) : '')}
                                                includeTime
                                                error={errors.due_date?.message}
                                                required
                                            />
                                        )}
                                    />
                                    <Input
                                        label="Maximum Score"
                                        type="number"
                                        min={0}
                                        step={1}
                                        {...register('max_score', { valueAsNumber: true })}
                                        error={errors.max_score?.message}
                                        placeholder="100"
                                    />
                                    <Input
                                        label="Passing Score"
                                        type="number"
                                        min={0}
                                        step={1}
                                        {...register('passing_score', { valueAsNumber: true })}
                                        error={errors.passing_score?.message}
                                        placeholder="60"
                                    />
                                </div>

                                {/* Late Policy */}
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Clock className="w-4 h-4 text-primary" />
                                        <h4 className="text-sm font-semibold text-gray-900">Late Submission Policy</h4>
                                    </div>
                                    <div className="flex items-center mb-3">
                                        <input
                                            type="checkbox"
                                            id="allow_late"
                                            {...register('allow_late')}
                                            className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                                        />
                                        <label htmlFor="allow_late" className="ml-2 text-sm text-gray-700">
                                            Allow late submissions
                                        </label>
                                    </div>
                                    {watch('allow_late') && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-primary/20">
                                            <Input
                                                label="Penalty per Day (%)"
                                                type="number"
                                                min={0}
                                                max={100}
                                                {...register('late_penalty_per_day', { valueAsNumber: true })}
                                                error={errors.late_penalty_per_day?.message}
                                                placeholder="10"
                                                helpText="Percentage deducted per day late"
                                            />
                                            <Input
                                                label="Maximum Late Days"
                                                type="number"
                                                min={1}
                                                {...register('max_late_days', { valueAsNumber: true })}
                                                error={errors.max_late_days?.message}
                                                placeholder="7"
                                                helpText="After this, no submissions accepted"
                                            />
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        )}
                    </Card>

                    {/* ━━━ 3. Test Cases ━━━ */}
                    <Card className="overflow-hidden border-gray-200 shadow-sm">
                        <CardHeader className="pb-0">
                            <SectionHeader
                                id="tests"
                                icon={Target}
                                title="Test Cases"
                                subtitle="Define automated tests used for auto-grading"
                                badge={testCases.length > 0 ? (
                                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700">
                                        {testCases.length} test{testCases.length !== 1 ? 's' : ''}
                                    </span>
                                ) : undefined}
                            />
                        </CardHeader>
                        {expandedSections.has('tests') && (
                            <CardContent className="pt-2 pb-6 space-y-4">
                                {testCases.length === 0 ? (
                                    <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50">
                                        <Target className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                        <p className="text-sm text-gray-600 mb-4">
                                            No test cases yet. Add a few to automatically check student code.
                                        </p>
                                        <Button
                                            type="button"
                                            onClick={addTestCase}
                                            className="gap-2 h-9 rounded-md px-3"
                                        >
                                            <Plus className="w-4 h-4" /> Add test case
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-gray-700">
                                                    Test cases
                                                </p>
                                                <span className="text-[11px] text-gray-500">
                                                    All inputs use{' '}
                                                    <span className="font-semibold">
                                                        {testInputMode === 'stdin' ? 'stdin' : 'file'} input
                                                    </span>
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1 text-[11px]">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (testInputMode === 'stdin') return;
                                                            setTestInputMode('stdin');
                                                            setTestCases(prev => prev.map(tc => ({
                                                                ...tc,
                                                                input_type: 'stdin',
                                                                inputFiles: [],
                                                                input_filenames: [],
                                                            })));
                                                        }}
                                                        className={`px-3 py-1 rounded-full transition-colors ${testInputMode === 'stdin'
                                                                ? 'bg-white text-gray-900 shadow-sm'
                                                                : 'text-gray-500 hover:text-gray-800'
                                                            }`}
                                                    >
                                                        Stdin input
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (testInputMode === 'file') return;
                                                            setTestInputMode('file');
                                                            setTestCases(prev => prev.map(tc => ({
                                                                ...tc,
                                                                input_type: 'file',
                                                                input_data: '',
                                                                inputFiles: [],
                                                                input_filenames: [],
                                                            })));
                                                        }}
                                                        className={`px-3 py-1 rounded-full transition-colors ${testInputMode === 'file'
                                                                ? 'bg-white text-gray-900 shadow-sm'
                                                                : 'text-gray-500 hover:text-gray-800'
                                                            }`}
                                                    >
                                                        File input
                                                    </button>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 gap-1.5"
                                                    onClick={addTestCase}
                                                >
                                                    <Plus className="w-4 h-4" /> Add test case
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            {testCases.map((tc, index) => (
                                                <div
                                                    key={index}
                                                    className="border border-gray-200 rounded-lg bg-gray-50/60"
                                                >
                                                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white/70 rounded-t-lg">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-medium">
                                                                {index + 1}
                                                            </span>
                                                            <input
                                                                type="text"
                                                                value={tc.name}
                                                                onChange={(e) => updateTestCase(index, 'name', e.target.value)}
                                                                className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-w-[160px]"
                                                                placeholder="Test case name"
                                                            />
                                                            <div className="flex items-center gap-2 ml-2">
                                                                <label className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={tc.is_hidden}
                                                                        onChange={(e) => updateTestCase(index, 'is_hidden', e.target.checked)}
                                                                        className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                                                                    />
                                                                    <span>Hidden</span>
                                                                </label>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeTestCase(index)}
                                                                className="inline-flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0 rounded-md transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="px-3 py-3 space-y-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                Description <span className="text-gray-400 font-normal">(optional)</span>
                                                            </label>
                                                            <textarea
                                                                value={tc.description}
                                                                onChange={(e) => updateTestCase(index, 'description', e.target.value)}
                                                                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                                                                rows={2}
                                                                placeholder="Explain what this test is checking..."
                                                            />
                                                        </div>
                                                        <div className="flex flex-col md:flex-row md:items-stretch md:gap-4">
                                                            {/* ── Input side ── */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1.5">
                                                                    <label className="text-xs font-medium text-gray-600">
                                                                        {testInputMode === 'stdin' ? 'Input (stdin)' : 'Input files'}
                                                                    </label>
                                                                    {testInputMode === 'file' && tc.inputFiles.length > 0 && (
                                                                        <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[10px] font-medium">
                                                                            {tc.inputFiles.length} file{tc.inputFiles.length !== 1 ? 's' : ''}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {testInputMode === 'stdin' ? (
                                                                    <textarea
                                                                        value={tc.input_data}
                                                                        onChange={(e) => updateTestCase(index, 'input_data', e.target.value)}
                                                                        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs md:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                                                                        rows={3}
                                                                        placeholder="What gets passed to stdin..."
                                                                    />
                                                                ) : (
                                                                    <div className="rounded-md border border-gray-200 bg-white">
                                                                        {tc.inputFiles.length > 0 && (
                                                                            <div className="p-2 flex flex-wrap gap-1.5">
                                                                                {tc.inputFiles.map((file) => (
                                                                                    <span
                                                                                        key={file.name}
                                                                                        className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 border border-gray-200 pl-2.5 pr-1 py-1 text-[11px] text-gray-700 group"
                                                                                    >
                                                                                        <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                                                        <span className="truncate max-w-[120px]" title={file.name}>{file.name}</span>
                                                                                        <span className="text-gray-400 text-[10px]">{formatBytes(file.size)}</span>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => removeFileFromTestCase(index, 'inputFiles', file.name)}
                                                                                            className="ml-0.5 p-0.5 rounded hover:bg-red-100 hover:text-red-600 text-gray-400 transition-colors"
                                                                                        >
                                                                                            <X className="w-3 h-3" />
                                                                                        </button>
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                        <label className={`flex items-center justify-center gap-2 cursor-pointer py-2.5 text-[11px] text-gray-500 hover:text-primary hover:bg-gray-50/60 transition-colors ${tc.inputFiles.length > 0 ? 'border-t border-gray-100' : ''}`}>
                                                                            <Upload className="w-3.5 h-3.5" />
                                                                            <span>{tc.inputFiles.length > 0 ? 'Add more files' : 'Choose files'}</span>
                                                                            <input
                                                                                type="file"
                                                                                multiple
                                                                                className="sr-only"
                                                                                onChange={(e) => {
                                                                                    if (e.target.files) {
                                                                                        addFilesToTestCase(index, 'inputFiles', Array.from(e.target.files));
                                                                                    }
                                                                                    e.target.value = '';
                                                                                }}
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* ── Expected output side ── */}
                                                            <div className="flex-1 min-w-0 mt-3 md:mt-0">
                                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                                    <div className="flex items-center gap-2">
                                                                        <label className="text-xs font-medium text-gray-600">
                                                                            Expected output
                                                                        </label>
                                                                        {tc.expected_output_type === 'file' && tc.expectedFiles.length > 0 && (
                                                                            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-medium">
                                                                                {tc.expectedFiles.length} file{tc.expectedFiles.length !== 1 ? 's' : ''}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-0.5 text-[11px]">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateTestCase(index, 'expected_output_type', 'text')}
                                                                            className={`px-2.5 py-1 rounded-full transition-colors ${tc.expected_output_type === 'text'
                                                                                    ? 'bg-white text-gray-900 shadow-sm'
                                                                                    : 'text-gray-500 hover:text-gray-800'
                                                                                }`}
                                                                        >
                                                                            Stdout
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => updateTestCase(index, 'expected_output_type', 'file')}
                                                                            className={`px-2.5 py-1 rounded-full transition-colors ${tc.expected_output_type === 'file'
                                                                                    ? 'bg-white text-gray-900 shadow-sm'
                                                                                    : 'text-gray-500 hover:text-gray-800'
                                                                                }`}
                                                                        >
                                                                            File
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                {tc.expected_output_type === 'text' ? (
                                                                    <textarea
                                                                        value={tc.expected_output}
                                                                        onChange={(e) => updateTestCase(index, 'expected_output', e.target.value)}
                                                                        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs md:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                                                                        rows={3}
                                                                        placeholder="Exact output expected from the program..."
                                                                    />
                                                                ) : (
                                                                    <div className="rounded-md border border-gray-200 bg-white">
                                                                        {tc.expectedFiles.length > 0 && (
                                                                            <div className="p-2 flex flex-wrap gap-1.5">
                                                                                {tc.expectedFiles.map((file) => (
                                                                                    <span
                                                                                        key={file.name}
                                                                                        className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 border border-gray-200 pl-2.5 pr-1 py-1 text-[11px] text-gray-700 group"
                                                                                    >
                                                                                        <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                                                        <span className="truncate max-w-[120px]" title={file.name}>{file.name}</span>
                                                                                        <span className="text-gray-400 text-[10px]">{formatBytes(file.size)}</span>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => removeFileFromTestCase(index, 'expectedFiles', file.name)}
                                                                                            className="ml-0.5 p-0.5 rounded hover:bg-red-100 hover:text-red-600 text-gray-400 transition-colors"
                                                                                        >
                                                                                            <X className="w-3 h-3" />
                                                                                        </button>
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                        <label className={`flex items-center justify-center gap-2 cursor-pointer py-2.5 text-[11px] text-gray-500 hover:text-primary hover:bg-gray-50/60 transition-colors ${tc.expectedFiles.length > 0 ? 'border-t border-gray-100' : ''}`}>
                                                                            <Upload className="w-3.5 h-3.5" />
                                                                            <span>{tc.expectedFiles.length > 0 ? 'Add more files' : 'Choose files'}</span>
                                                                            <input
                                                                                type="file"
                                                                                multiple
                                                                                className="sr-only"
                                                                                onChange={(e) => {
                                                                                    if (e.target.files) {
                                                                                        addFilesToTestCase(index, 'expectedFiles', Array.from(e.target.files));
                                                                                    }
                                                                                    e.target.value = '';
                                                                                }}
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-4">
                                                            <label className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={tc.ignore_whitespace}
                                                                    onChange={(e) => updateTestCase(index, 'ignore_whitespace', e.target.checked)}
                                                                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                                                                />
                                                                <span>Ignore whitespace differences</span>
                                                            </label>
                                                            <label className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={tc.ignore_case}
                                                                    onChange={(e) => updateTestCase(index, 'ignore_case', e.target.checked)}
                                                                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                                                                />
                                                                <span>Case-insensitive</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        )}
                    </Card>

                    {/* ━━━ 4. Rubric (manual grading only) ━━━ */}
                    {/* ━━━ Rubric (manual grading) ━━━ */}
                    <Card className="overflow-hidden border-gray-200 shadow-sm">
                        <CardHeader className="pb-0">
                            <SectionHeader
                                id="rubric"
                                icon={BookOpen}
                                title="Manual Grading Rubric"
                                subtitle="Define criteria for manual evaluation beyond automated tests"
                                badge={rubricEnabled && rubricItems.length > 0 ? (
                                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-[#862733]/10 text-[#862733]">
                                        {rubricItems.length} criteria
                                    </span>
                                ) : undefined}
                            />
                        </CardHeader>
                        {expandedSections.has('rubric') && (
                            <CardContent className="pt-2 pb-6 space-y-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <input
                                        type="checkbox"
                                        id="rubric_enabled"
                                        checked={rubricEnabled}
                                        onChange={(e) => setRubricEnabled(e.target.checked)}
                                        className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                                    />
                                    <label htmlFor="rubric_enabled" className="text-sm font-medium text-gray-700">
                                        Enable manual grading rubric
                                    </label>
                                </div>

                                {rubricEnabled && (
                                    <>
                                        {/* Mode: Weight (%) vs Points */}
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700">Scoring type</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const maxScore = Number(watch('max_score')) || 100;
                                                        setRubricMode('weight');
                                                        if (maxScore > 0 && rubricItems.some((i) => (i.points ?? 0) > 0)) {
                                                            setRubricItems((prev) =>
                                                                prev.map((i) => ({
                                                                    ...i,
                                                                    weight: ((i.points ?? 0) / maxScore) * 100,
                                                                }))
                                                            );
                                                        }
                                                    }}
                                                    className={`relative flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all ${rubricMode === 'weight'
                                                            ? 'border-primary bg-primary/5 shadow-sm'
                                                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                                                        }`}
                                                >
                                                    {rubricMode === 'weight' && (
                                                        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                                                    )}
                                                    <span className="text-sm font-semibold text-gray-900">By weight</span>
                                                    <span className="text-xs text-gray-500 mt-0.5">Criteria weights must total 100%</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const maxScore = Number(watch('max_score')) || 100;
                                                        setRubricMode('points');
                                                        if (rubricItems.some((i) => (i.weight ?? 0) > 0)) {
                                                            setRubricItems((prev) =>
                                                                prev.map((i) => ({
                                                                    ...i,
                                                                    points: ((i.weight ?? 0) / 100) * maxScore,
                                                                }))
                                                            );
                                                        }
                                                    }}
                                                    className={`relative flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all ${rubricMode === 'points'
                                                            ? 'border-primary bg-primary/5 shadow-sm'
                                                            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                                                        }`}
                                                >
                                                    {rubricMode === 'points' && (
                                                        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                                                    )}
                                                    <span className="text-sm font-semibold text-gray-900">By points</span>
                                                    <span className="text-xs text-gray-500 mt-0.5">
                                                        Criteria points must total max score ({watch('max_score') ?? 100})
                                                    </span>
                                                </button>
                                            </div>
                                        </div>

                                        {rubricMode === 'weight' ? (
                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                                <p className="text-xs text-amber-700 flex items-start gap-2">
                                                    <BookOpen className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                                    Enter a weight (%) for each criterion. The total must equal <span className="font-semibold">100%</span>.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                <p className="text-xs text-blue-700 flex items-start gap-2">
                                                    <BookOpen className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                                    Enter points per criterion. The total must equal the assignment <span className="font-semibold">max score ({watch('max_score') ?? 100})</span>.
                                                </p>
                                            </div>
                                        )}

                                        {rubricItems.length === 0 ? (
                                            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50">
                                                <Layers className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                                <p className="text-sm text-gray-600 mb-4">Add grading criteria for manual scoring</p>
                                                <Button type="button" onClick={addRubricItem} className="gap-2 h-9 rounded-md px-3">
                                                    <Plus className="w-4 h-4" /> Add grading criteria
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <label className="block text-sm font-medium text-gray-700">Criteria</label>
                                                    {rubricItems.length > 0 && (
                                                        <span className="text-[11px] text-gray-600">
                                                            {rubricMode === 'weight' ? (
                                                                <>Total:{' '}
                                                                    <span className={(() => {
                                                                        const sum = rubricItems.reduce((s, i) => s + (i.weight || 0), 0);
                                                                        if (Math.abs(sum - 100) < 0.01) return 'text-emerald-600 font-semibold';
                                                                        if (sum > 100) return 'text-red-600 font-semibold';
                                                                        return 'text-amber-600 font-semibold';
                                                                    })()}>
                                                                        {rubricItems.reduce((s, i) => s + (i.weight || 0), 0).toFixed(1)}% / 100%
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <>Total:{' '}
                                                                    <span className={(() => {
                                                                        const maxScore = Number(watch('max_score')) || 100;
                                                                        const sum = rubricItems.reduce((s, i) => s + (i.points || 0), 0);
                                                                        if (Math.abs(sum - maxScore) < 0.01) return 'text-emerald-600 font-semibold';
                                                                        if (sum > maxScore) return 'text-red-600 font-semibold';
                                                                        return 'text-amber-600 font-semibold';
                                                                    })()}>
                                                                        {rubricItems.reduce((s, i) => s + (i.points || 0), 0).toFixed(1)} / {Number(watch('max_score')) || 100} pts
                                                                    </span>
                                                                </>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                                {rubricItems.map((item, index) => (
                                                    <div key={index} className="flex items-start gap-2 bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <div className="flex-1 space-y-1.5">
                                                            {rubricLibrary.length > 0 && (
                                                                <select
                                                                    value={item.libraryItemId ?? ''}
                                                                    onChange={(e) => {
                                                                        const selectedId = e.target.value ? Number(e.target.value) : undefined;
                                                                        if (!selectedId) {
                                                                            updateRubricItem(index, 'libraryItemId', undefined as unknown as number);
                                                                            return;
                                                                        }
                                                                        const selected = rubricLibrary.find((ri) => ri.id === selectedId);
                                                                        updateRubricItem(index, 'libraryItemId', selectedId);
                                                                        if (selected) {
                                                                            updateRubricItem(index, 'name', selected.name);
                                                                            updateRubricItem(index, 'description', selected.description ?? '');
                                                                        }
                                                                    }}
                                                                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white"
                                                                >
                                                                    <option value="">Choose from library (optional)</option>
                                                                    {rubricLibrary.map((ri) => (
                                                                        <option key={ri.id} value={ri.id}>
                                                                            {ri.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={item.name}
                                                                        onChange={(e) => updateRubricItem(index, 'name', e.target.value)}
                                                                        className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                        placeholder="Criterion name"
                                                                    />
                                                                    {rubricMode === 'weight' ? (
                                                                        <div className="flex items-center gap-1.5 sm:w-28">
                                                                            <span className="text-[11px] text-gray-500 whitespace-nowrap">Weight %</span>
                                                                            <input
                                                                                type="number"
                                                                                min={0}
                                                                                max={100}
                                                                                step={0.5}
                                                                                value={item.weight}
                                                                                onChange={(e) =>
                                                                                    updateRubricItem(
                                                                                        index,
                                                                                        'weight',
                                                                                        isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value),
                                                                                    )
                                                                                }
                                                                                className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                                placeholder="25"
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1.5 sm:w-28">
                                                                            <span className="text-[11px] text-gray-500 whitespace-nowrap">Points</span>
                                                                            <input
                                                                                type="number"
                                                                                min={0}
                                                                                step={0.5}
                                                                                value={item.points}
                                                                                onChange={(e) =>
                                                                                    updateRubricItem(
                                                                                        index,
                                                                                        'points',
                                                                                        isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value),
                                                                                    )
                                                                                }
                                                                                className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                                placeholder="25"
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    value={item.description}
                                                                    onChange={(e) => updateRubricItem(index, 'description', e.target.value)}
                                                                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                    placeholder="Description (optional)"
                                                                />
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeRubricItem(index)}
                                                            className="inline-flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0 rounded-md transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <div className="pt-1">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={addRubricItem}
                                                        className="h-8 gap-1.5 text-xs rounded-md"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" /> Add another criterion
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        )}
                    </Card>

                    {/* ━━━ Submission Settings ━━━ */}
                    <Card className="overflow-hidden border-gray-200 shadow-sm">
                        <CardHeader className="pb-0">
                            <SectionHeader
                                id="submission"
                                icon={Settings}
                                title="Submission Settings"
                                subtitle="Attempts, file constraints, and required files"
                            />
                        </CardHeader>
                        {expandedSections.has('submission') && (
                            <CardContent className="pt-2 pb-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Maximum Attempts"
                                        type="number"
                                        min={0}
                                        {...register('max_attempts', { valueAsNumber: true })}
                                        error={errors.max_attempts?.message}
                                        placeholder="10"
                                        helpText="0 for unlimited"
                                    />
                                    <Input
                                        label="Max File Size (MB)"
                                        type="number"
                                        min={1}
                                        step={1}
                                        {...register('max_file_size_mb', { valueAsNumber: true })}
                                        error={errors.max_file_size_mb?.message}
                                        placeholder="10"
                                    />
                                </div>

                                <Input
                                    label="Allowed File Extensions"
                                    {...register('allowedExtensionsStr')}
                                    error={errors.allowedExtensionsStr?.message}
                                    placeholder=".py, .txt, .md"
                                    helpText="Auto-filled from language. Add more comma-separated (e.g. .py, .txt)"
                                />
                            </CardContent>
                        )}
                    </Card>

                    {/* ━━━ Groups & Academic Integrity ━━━ */}
                    <Card className="overflow-hidden border-gray-200 shadow-sm">
                        <CardHeader className="pb-0">
                            <SectionHeader
                                id="integrity"
                                icon={Shield}
                                title="Groups & Academic Integrity"
                                subtitle="Group work settings and plagiarism/AI detection"
                            />
                        </CardHeader>
                        {expandedSections.has('integrity') && (
                            <CardContent className="pt-2 pb-6 space-y-5">
                                {/* Group work */}
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Users className="w-4 h-4 text-primary" />
                                        <h4 className="text-sm font-semibold text-gray-900">Group Work</h4>
                                    </div>
                                    <div className="flex items-center mb-3">
                                        <input
                                            type="checkbox"
                                            id="allow_groups"
                                            {...register('allow_groups')}
                                            className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                                        />
                                        <label htmlFor="allow_groups" className="ml-2 text-sm text-gray-700">
                                            Allow group submissions
                                        </label>
                                    </div>
                                    {watch('allow_groups') && (
                                        <div className="pl-6 border-l-2 border-primary/20">
                                            <Input
                                                label="Maximum Group Size"
                                                type="number"
                                                min={2}
                                                {...register('max_group_size', { valueAsNumber: true })}
                                                error={errors.max_group_size?.message}
                                                placeholder="4"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Plagiarism */}
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Shield className="w-4 h-4 text-primary" />
                                        <h4 className="text-sm font-semibold text-gray-900">Plagiarism Detection</h4>
                                    </div>
                                    <div className="flex items-center mb-3">
                                        <input
                                            type="checkbox"
                                            id="enable_plagiarism_check"
                                            {...register('enable_plagiarism_check')}
                                            className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                                        />
                                        <label htmlFor="enable_plagiarism_check" className="ml-2 text-sm text-gray-700">
                                            Enable plagiarism detection
                                        </label>
                                    </div>
                                    {watch('enable_plagiarism_check') && (
                                        <div className="pl-6 border-l-2 border-primary/20">
                                            <Input
                                                label="Similarity Threshold (%)"
                                                type="number"
                                                min={0}
                                                max={100}
                                                {...register('plagiarism_threshold', { valueAsNumber: true })}
                                                error={errors.plagiarism_threshold?.message}
                                                placeholder="30"
                                                helpText="Flag submissions above this similarity percentage"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* AI Detection */}
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <AlertCircle className="w-4 h-4 text-primary" />
                                        <h4 className="text-sm font-semibold text-gray-900">AI Detection</h4>
                                    </div>
                                    <div className="flex items-center mb-3">
                                        <input
                                            type="checkbox"
                                            id="enable_ai_detection"
                                            {...register('enable_ai_detection')}
                                            className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                                        />
                                        <label htmlFor="enable_ai_detection" className="ml-2 text-sm text-gray-700">
                                            Enable AI-generated code detection
                                        </label>
                                    </div>
                                    {watch('enable_ai_detection') && (
                                        <div className="pl-6 border-l-2 border-primary/20">
                                            <Input
                                                label="AI Detection Threshold (%)"
                                                type="number"
                                                min={0}
                                                max={100}
                                                {...register('ai_detection_threshold', { valueAsNumber: true })}
                                                error={errors.ai_detection_threshold?.message}
                                                placeholder="50"
                                                helpText="Flag submissions above this AI probability"
                                            />
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        )}
                    </Card>

                    {/* ━━━ 8. Code Files ━━━ */}
                    <Card className="overflow-hidden border-gray-200 shadow-sm">
                        <CardHeader className="pb-0">
                            <SectionHeader
                                id="files"
                                icon={FileCode}
                                title="Starter & Solution Code"
                                subtitle="Template code for students and your reference solution"
                            />
                        </CardHeader>
                        {expandedSections.has('files') && (
                            <CardContent className="pt-2 pb-6 space-y-5">
                                {/* Starter Code */}
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <FileCode className="w-4 h-4 text-primary" />
                                        <span className="text-sm font-semibold text-gray-900">Starter Code File</span>
                                    </div>
                                    <input
                                        type="file"
                                        accept=".py,.java,.cpp,.c,.js,.ts,.rb,.go,.rs,.php,.h,.hpp"
                                        onChange={(e) => setStarterFile(e.target.files?.[0] || null)}
                                        className="block w-full text-sm text-gray-600
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-lg file:border-0
                                                file:text-sm file:font-semibold
                                                file:bg-primary file:text-white
                                                hover:file:bg-primary/90
                                                file:transition-colors file:cursor-pointer
                                                cursor-pointer border border-gray-300 rounded-lg
                                                focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                    {starterFile && (
                                        <div className="mt-2 flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span className="font-medium truncate">{starterFile.name}</span>
                                            <span className="text-green-500 text-xs">({formatFileSize(starterFile.size)})</span>
                                            <button type="button" onClick={() => setStarterFile(null)} className="ml-auto text-red-500 hover:text-red-700">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                    <p className="mt-2 text-xs text-gray-500">Template code students will start with</p>
                                </div>

                                {/* Solution Code */}
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Code className="w-4 h-4 text-primary" />
                                        <span className="text-sm font-semibold text-gray-900">Solution Code File</span>
                                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-yellow-100 text-yellow-800">Faculty only</span>
                                    </div>
                                    <input
                                        type="file"
                                        accept=".py,.java,.cpp,.c,.js,.ts,.rb,.go,.rs,.php,.h,.hpp"
                                        onChange={(e) => setSolutionFile(e.target.files?.[0] || null)}
                                        className="block w-full text-sm text-gray-600
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-lg file:border-0
                                                file:text-sm file:font-semibold
                                                file:bg-primary file:text-white
                                                hover:file:bg-primary/90
                                                file:transition-colors file:cursor-pointer
                                                cursor-pointer border border-gray-300 rounded-lg
                                                focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                    {solutionFile && (
                                        <div className="mt-2 flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span className="font-medium truncate">{solutionFile.name}</span>
                                            <span className="text-green-500 text-xs">({formatFileSize(solutionFile.size)})</span>
                                            <button type="button" onClick={() => setSolutionFile(null)} className="ml-auto text-red-500 hover:text-red-700">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                    <p className="mt-2 text-xs text-gray-500">Reference solution (never visible to students)</p>
                                </div>
                            </CardContent>
                        )}
                    </Card>

                    {/* ━━━ 9. Attachments (S3 Upload) ━━━ */}
                    <Card className="overflow-hidden border-gray-200 shadow-sm">
                        <CardHeader className="pb-0">
                            <SectionHeader
                                id="attachments"
                                icon={Paperclip}
                                title="Supplementary Materials"
                                subtitle="Upload PDFs, images, datasets, or any files students need"
                                badge={attachmentFiles.length > 0 ? (
                                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-[#862733]/10 text-[#862733]">
                                        {attachmentFiles.length} file{attachmentFiles.length !== 1 ? 's' : ''}
                                    </span>
                                ) : undefined}
                            />
                        </CardHeader>
                        {expandedSections.has('attachments') && (
                            <CardContent className="pt-2 pb-6 space-y-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                    <p className="text-xs text-blue-700 flex items-start gap-2">
                                        <Upload className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                        Files are uploaded to secure cloud storage (AWS S3). Students will be able to download these materials from the assignment page.
                                    </p>
                                </div>

                                {/* Drop zone */}
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => attachmentInputRef.current?.click()}
                                    className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${isDragging
                                            ? 'border-primary bg-primary/5 scale-[1.01]'
                                            : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50'
                                        }`}
                                >
                                    <input
                                        ref={attachmentInputRef}
                                        type="file"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files) addAttachments(e.target.files);
                                            e.target.value = '';
                                        }}
                                    />
                                    <Upload className={`w-8 h-8 mx-auto mb-3 ${isDragging ? 'text-primary' : 'text-gray-400'}`} />
                                    <p className="text-sm font-medium text-gray-700">
                                        {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        PDF, images, datasets, ZIP archives, etc.
                                    </p>
                                </div>

                                {/* File list */}
                                {attachmentFiles.length > 0 && (
                                    <div className="space-y-2">
                                        {attachmentFiles.map((af) => (
                                            <div key={af.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200">
                                                <FileIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-800 truncate">{af.file.name}</p>
                                                    <p className="text-xs text-gray-400">{formatFileSize(af.file.size)}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeAttachment(af.id)}
                                                    className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors flex-shrink-0"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        )}
                    </Card>

                    {/* ━━━ 10. Publishing ━━━ */}
                    <Card className="overflow-hidden border-gray-200 shadow-sm">
                        <CardHeader className="pb-0">
                            <SectionHeader
                                id="publish"
                                icon={CheckCircle2}
                                title="Publishing"
                                subtitle="Control assignment visibility to students"
                            />
                        </CardHeader>
                        {expandedSections.has('publish') && (
                            <CardContent className="pt-2 pb-6">
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <div className="flex items-center mb-2">
                                                <input
                                                    id="isPublished"
                                                    type="checkbox"
                                                    {...register('is_published')}
                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <label htmlFor="isPublished" className="ml-2 text-sm font-medium text-gray-900">
                                                    Publish immediately
                                                </label>
                                            </div>
                                            <p className="text-xs text-amber-700">
                                                If unchecked, the assignment will be saved as a draft and won&apos;t be visible to students until you publish it.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        )}
                    </Card>

                    {/* ━━━ Action Buttons ━━━ */}
                    <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mt-8 rounded-b-lg transition-opacity duration-300">
                        <div className="flex items-center justify-between max-w-5xl mx-auto">
                            <p className="text-xs text-gray-500 hidden sm:block">
                                {rubricEnabled && rubricItems.length > 0 && `${rubricItems.length} grading criteria`}
                                {attachmentFiles.length > 0 && ` | ${attachmentFiles.length} attachment${attachmentFiles.length !== 1 ? 's' : ''}`}
                            </p>
                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    onClick={() => router.back()}
                                    disabled={loading}
                                    className="gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <X className="w-4 h-4" />
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="relative overflow-hidden bg-primary hover:bg-primary/90 text-white px-8 py-2.5 gap-2.5 rounded-lg shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 disabled:opacity-90 disabled:cursor-wait"
                                >
                                    {loading && (
                                        <span className="absolute inset-0 bg-primary/20 animate-pulse" aria-hidden />
                                    )}
                                    {loading ? (
                                        <span className="relative flex items-center gap-2.5">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span className="animate-pulse">Creating...</span>
                                        </span>
                                    ) : (
                                        <span className="relative flex items-center gap-2.5">
                                            <Save className="w-4 h-4" />
                                            Create Assignment
                                        </span>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
