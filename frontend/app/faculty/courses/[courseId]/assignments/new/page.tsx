'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assignmentCreateSchema } from '@/lib/validation';
import type { z } from 'zod';

type AssignmentCreateForm = z.infer<typeof assignmentCreateSchema>;

import {
    FileText,
    Code,
    Calendar,
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
    input_data: string;
    expected_output: string;
    points: number;
    is_hidden: boolean;
    is_sample: boolean;
    ignore_whitespace: boolean;
    ignore_case: boolean;
    time_limit_seconds: number | null;
    memory_limit_mb: number | null;
    order: number;
};

type RubricItem = {
    name: string;
    description: string;
    max_points: number;
    order: number;
};

type RubricCategory = {
    name: string;
    description: string;
    weight: number;
    order: number;
    items: RubricItem[];
};

type AttachmentFile = {
    file: File;
    id: string;
};

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

    // Rubric
    const [rubricEnabled, setRubricEnabled] = useState(false);
    const [rubricCategories, setRubricCategories] = useState<RubricCategory[]>([]);

    // File uploads
    const [starterFile, setStarterFile] = useState<File | null>(null);
    const [solutionFile, setSolutionFile] = useState<File | null>(null);
    const [attachmentFiles, setAttachmentFiles] = useState<AttachmentFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const attachmentInputRef = useRef<HTMLInputElement>(null);

    const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<AssignmentCreateForm>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(assignmentCreateSchema) as any,
        defaultValues: {
            course_id: courseId,
            title: '',
            language_id: undefined as unknown as number,
            description: '',
            instructions: '',
            due_date: '',
            max_score: 100,
            passing_score: 60,
            difficulty: 'medium',
            allow_late: true,
            late_penalty_per_day: 10,
            max_late_days: 7,
            max_attempts: 10,
            max_file_size_mb: 10,
            allowedExtensionsStr: '',
            requiredFilesStr: '',
            allow_groups: false,
            max_group_size: 4,
            enable_plagiarism_check: true,
            plagiarism_threshold: 30,
            enable_ai_detection: true,
            ai_detection_threshold: 50,
            test_weight: 70,
            rubric_weight: 30,
            is_published: false,
        }
    });

    const watchTestWeight = watch('test_weight');
    const watchRubricWeight = watch('rubric_weight');

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

    useEffect(() => {
        if (courseId > 0) setValue('course_id', courseId);
    }, [courseId, setValue]);

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
            input_data: '',
            expected_output: '',
            points: 10,
            is_hidden: false,
            is_sample: false,
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

    // ─── Rubric Management ───
    const maxScore = watch('max_score') ?? 100;
    const rubricWeightPct = watch('rubric_weight') ?? 30;
    const totalRubricPoints = Math.round(maxScore * (rubricWeightPct / 100) * 100) / 100;

    const addRubricCategory = () => {
        setRubricCategories(prev => {
            const n = prev.length + 1;
            const baseWeight = Math.round((100 / n) * 10) / 10;
            const lastWeight = 100 - baseWeight * (n - 1);
            const rebalanced = prev.map((c) => ({ ...c, weight: baseWeight }));
            const newCatWeight = n === 1 ? 100 : lastWeight;
            const catPoints = Math.round(totalRubricPoints * (newCatWeight / 100) * 100) / 100;
            rebalanced.push({
                name: `Category ${n}`,
                description: '',
                weight: newCatWeight,
                order: n - 1,
                items: [{ name: 'Criterion 1', description: '', max_points: Math.max(1, Math.round(catPoints)), order: 0 }],
            });
            return rebalanced;
        });
    };

    const removeRubricCategory = (catIndex: number) => {
        setRubricCategories(prev => {
            const next = prev.filter((_, i) => i !== catIndex);
            if (next.length === 0) return next;
            const baseWeight = Math.round((100 / next.length) * 10) / 10;
            const lastWeight = 100 - baseWeight * (next.length - 1);
            return next.map((c, i) => ({
                ...c,
                weight: i === next.length - 1 ? lastWeight : baseWeight,
            }));
        });
    };

    const updateRubricCategory = (catIndex: number, field: keyof Omit<RubricCategory, 'items'>, value: string | number) => {
        setRubricCategories(prev => {
            const updated = [...prev];
            updated[catIndex] = { ...updated[catIndex], [field]: value };
            return updated;
        });
    };

    const addRubricItem = (catIndex: number) => {
        setRubricCategories(prev => {
            const updated = [...prev];
            const cat = { ...updated[catIndex] };
            const catPoints = Math.round(totalRubricPoints * ((cat.weight || 0) / 100) * 100) / 100;
            const currentSum = cat.items.reduce((s, i) => s + (i.max_points || 0), 0);
            const remaining = Math.max(0, Math.round((catPoints - currentSum) * 100) / 100);
            const defaultPts = cat.items.length === 0 ? catPoints : (remaining > 0 ? remaining : 0);
            cat.items = [...cat.items, {
                name: `Criterion ${cat.items.length + 1}`,
                description: '',
                max_points: defaultPts,
                order: cat.items.length,
            }];
            updated[catIndex] = cat;
            return updated;
        });
    };

    const removeRubricItem = (catIndex: number, itemIndex: number) => {
        setRubricCategories(prev => {
            const updated = [...prev];
            const cat = { ...updated[catIndex] };
            cat.items = cat.items.filter((_, i) => i !== itemIndex);
            updated[catIndex] = cat;
            return updated;
        });
    };

    const updateRubricItem = (catIndex: number, itemIndex: number, field: keyof RubricItem, value: string | number) => {
        setRubricCategories(prev => {
            const updated = [...prev];
            const cat = { ...updated[catIndex] };
            cat.items = [...cat.items];
            cat.items[itemIndex] = { ...cat.items[itemIndex], [field]: value };
            updated[catIndex] = cat;
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

    // ─── Computed totals ───
    const totalTestPoints = testCases.reduce((sum, tc) => sum + (tc.points || 0), 0);

    // ─── Form Submit ───
    const onSubmit = async (values: AssignmentCreateForm) => {
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

            const maxScore = values.max_score ?? 100;
            const rubricPct = values.rubric_weight ?? 30;
            const totalRubricPts = Math.round(maxScore * (rubricPct / 100) * 100) / 100;

            if ((values.test_weight ?? 0) > 0 && testCases.length === 0) {
                setError('Add at least one test case when test case weight is greater than 0%.');
                setErrorModalOpen(true);
                setLoading(false);
                return;
            }

            if (rubricEnabled && rubricCategories.length > 0) {
                const weightSum = rubricCategories.reduce((s, c) => s + (c.weight || 0), 0);
                if (Math.abs(weightSum - 100) > 0.01) {
                    setError(`Rubric category weights must sum to 100% (current: ${weightSum.toFixed(1)}%).`);
                    setErrorModalOpen(true);
                    setLoading(false);
                    return;
                }
                for (const cat of rubricCategories) {
                    const catPoints = Math.round(totalRubricPts * ((cat.weight || 0) / 100) * 100) / 100;
                    const itemSum = cat.items.reduce((s, i) => s + (i.max_points || 0), 0);
                    if (Math.abs(itemSum - catPoints) > 0.01) {
                        setError(`Category "${cat.name}": criteria points must sum to ${catPoints} (got ${itemSum}).`);
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

            const required_files = (values.requiredFilesStr || '')
                .split(',').map(s => s.trim()).filter(Boolean);

            const payload: Record<string, unknown> = {
                course_id: courseId,
                title: values.title.trim(),
                description: values.description.trim(),
                instructions: values.instructions?.trim() || undefined,
                language_id: parseInt(String(values.language_id), 10),
                due_date: dueDateISO,
                max_score: values.max_score,
                passing_score: values.passing_score,
                difficulty: values.difficulty,
                allow_late: values.allow_late,
                late_penalty_per_day: values.late_penalty_per_day,
                max_late_days: values.max_late_days,
                max_attempts: values.max_attempts,
                max_file_size_mb: values.max_file_size_mb,
                allowed_file_extensions: allowed_file_extensions.length ? allowed_file_extensions : undefined,
                required_files: required_files.length ? required_files : undefined,
                allow_groups: values.allow_groups,
                max_group_size: values.max_group_size,
                enable_plagiarism_check: values.enable_plagiarism_check,
                plagiarism_threshold: values.plagiarism_threshold,
                enable_ai_detection: values.enable_ai_detection,
                ai_detection_threshold: values.ai_detection_threshold,
                test_weight: values.test_weight,
                rubric_weight: values.rubric_weight,
                starter_code,
                solution_code,
                is_published: values.is_published,
                test_cases: testCases.map((tc, idx) => ({
                    name: tc.name,
                    description: tc.description || null,
                    input_data: tc.input_data || null,
                    expected_output: tc.expected_output,
                    points: tc.points,
                    is_hidden: tc.is_hidden,
                    is_sample: tc.is_sample,
                    ignore_whitespace: tc.ignore_whitespace,
                    ignore_case: tc.ignore_case,
                    time_limit_seconds: tc.time_limit_seconds,
                    order: idx,
                })),
            };

            if (rubricEnabled && rubricCategories.length > 0) {
                payload.rubric = {
                    total_points: totalRubricPts,
                    categories: rubricCategories.map((cat, ci) => ({
                        name: cat.name,
                        description: cat.description || null,
                        weight: cat.weight,
                        order: ci,
                        items: cat.items.map((item, ii) => ({
                            name: item.name,
                            description: item.description || null,
                            max_points: item.max_points,
                            order: ii,
                        })),
                    })),
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
        ...((watchTestWeight ?? 0) > 0 ? [{ label: 'Test Cases', done: testCases.length > 0 }] : []),
    ];
    const completedCount = completionSteps.filter(s => s.done).length;
    const completionPct = Math.round((completedCount / completionSteps.length) * 100);

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

                                        <Select
                                            label="Difficulty Level"
                                            {...register('difficulty')}
                                            error={errors.difficulty?.message}
                                            options={[
                                                { value: 'easy', label: 'Easy' },
                                                { value: 'medium', label: 'Medium' },
                                                { value: 'hard', label: 'Hard' },
                                            ]}
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
                                    icon={Calendar}
                                    title="Timing & Scoring"
                                    subtitle="Due date, score limits, and late submission policy"
                                />
                            </CardHeader>
                            {expandedSections.has('timing') && (
                                <CardContent className="pt-2 pb-6 space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Input
                                            label="Due Date & Time"
                                            type="datetime-local"
                                            {...register('due_date')}
                                            error={errors.due_date?.message}
                                            required
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

                        {/* ━━━ 3. Grading Weights ━━━ */}
                        <Card className="overflow-hidden border-gray-200 shadow-sm">
                            <CardHeader className="pb-0">
                                <SectionHeader
                                    id="weights"
                                    icon={Award}
                                    title="Grading Weights"
                                    subtitle="Distribution between automated tests and manual rubric"
                                    badge={
                                        (watchTestWeight + watchRubricWeight) !== 100 ? (
                                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-800">Must sum to 100%</span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-800">Valid</span>
                                        )
                                    }
                                />
                            </CardHeader>
                            {expandedSections.has('weights') && (
                                <CardContent className="pt-2 pb-6">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                        <div className="flex items-start gap-2">
                                            <Target className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                            <p className="text-xs text-blue-700">
                                                Test weight covers automated test case scoring. Rubric weight covers manual grading criteria. Both must total 100%.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="Test Case Weight (%)"
                                            type="number"
                                            min={0}
                                            max={100}
                                            {...register('test_weight', { valueAsNumber: true })}
                                            error={errors.test_weight?.message}
                                            placeholder="70"
                                            helpText="Automated test cases"
                                        />
                                        <Input
                                            label="Manual Rubric Weight (%)"
                                            type="number"
                                            min={0}
                                            max={100}
                                            {...register('rubric_weight', { valueAsNumber: true })}
                                            error={errors.rubric_weight?.message}
                                            placeholder="30"
                                            helpText="Manual rubric grading"
                                        />
                                    </div>

                                    {/* Visual bar */}
                                    <div className="mt-4 flex rounded-full overflow-hidden h-3 bg-gray-100">
                                        <div
                                            className="bg-primary transition-all duration-300"
                                            style={{ width: `${Math.min(watchTestWeight, 100)}%` }}
                                            title={`Tests: ${watchTestWeight}%`}
                                        />
                                        <div
                                            className="bg-blue-400 transition-all duration-300"
                                            style={{ width: `${Math.min(watchRubricWeight, 100)}%` }}
                                            title={`Rubric: ${watchRubricWeight}%`}
                                        />
                                    </div>
                                    <div className="flex justify-between mt-1.5 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Tests: {watchTestWeight}%
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Rubric: {watchRubricWeight}%
                                        </span>
                                    </div>
                                </CardContent>
                            )}
                        </Card>

                        {/* ━━━ 4. Test Cases ━━━ */}
                        <Card className="overflow-hidden border-gray-200 shadow-sm">
                            <CardHeader className="pb-0">
                                <SectionHeader
                                    id="testcases"
                                    icon={FlaskConical}
                                    title="Test Cases"
                                    subtitle="Automated tests to grade student submissions"
                                    badge={testCases.length > 0 ? (
                                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-[#862733]/10 text-[#862733]">
                                            {testCases.length} test{testCases.length !== 1 ? 's' : ''} &middot; {totalTestPoints} pts
                                        </span>
                                    ) : undefined}
                                />
                            </CardHeader>
                            {expandedSections.has('testcases') && (
                                <CardContent className="pt-2 pb-6 space-y-4">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <p className="text-xs text-blue-700 flex items-start gap-2">
                                            <FlaskConical className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                            Hidden tests are revealed after grading. Sample tests are visible to students to help them understand requirements.
                                        </p>
                                    </div>

                                    {testCases.length === 0 ? (
                                        <div className="text-center py-10 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50">
                                            <FlaskConical className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                            <p className="text-sm text-gray-600 mb-1">No test cases yet</p>
                                            {(watchTestWeight ?? 0) === 0 ? (
                                                <p className="text-xs text-amber-600">Set Test Case Weight &gt; 0% above to add test cases</p>
                                            ) : (
                                                <>
                                                    <p className="text-xs text-gray-400 mb-4">Add test cases to enable automated grading</p>
                                                    <Button type="button" onClick={addTestCase} className="gap-2 h-9 rounded-md px-3">
                                                        <Plus className="w-4 h-4" /> Add First Test Case
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {testCases.map((tc, index) => (
                                                <div key={index} className="border border-gray-200 rounded-xl bg-white shadow-sm">
                                                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-t-xl border-b border-gray-200">
                                                        <div className="flex items-center gap-3">
                                                            <GripVertical className="w-4 h-4 text-gray-400" />
                                                            <span className="font-semibold text-sm text-gray-900">
                                                                Test Case {index + 1}
                                                            </span>
                                                            <div className="flex gap-1.5">
                                                                {tc.is_hidden && (
                                                                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-yellow-100 text-yellow-800">
                                                                        <EyeOff className="w-3 h-3 mr-0.5" /> Hidden
                                                                    </span>
                                                                )}
                                                                {tc.is_sample && (
                                                                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-800">
                                                                        <Eye className="w-3 h-3 mr-0.5" /> Sample
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium border border-gray-300 text-gray-700">{tc.points} pts</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => removeTestCase(index)}
                                                                className="inline-flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0 rounded-md transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="p-4 space-y-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div className="md:col-span-2">
                                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                                    Test Name <span className="text-red-500">*</span>
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={tc.name}
                                                                    onChange={(e) => updateTestCase(index, 'name', e.target.value)}
                                                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                    placeholder="e.g., Basic Addition Test"
                                                                />
                                                            </div>

                                                            <div className="md:col-span-2">
                                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                                    Description
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={tc.description}
                                                                    onChange={(e) => updateTestCase(index, 'description', e.target.value)}
                                                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                    placeholder="What this test validates"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                                    Input Data <span className="text-gray-400 text-xs">(stdin)</span>
                                                                </label>
                                                                <textarea
                                                                    value={tc.input_data}
                                                                    onChange={(e) => updateTestCase(index, 'input_data', e.target.value)}
                                                                    className="w-full min-h-[80px] rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                                                                    placeholder="5 3"
                                                                />
                                                            </div>

                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                                    Expected Output <span className="text-red-500">*</span> <span className="text-gray-400 text-xs">(stdout)</span>
                                                                </label>
                                                                <textarea
                                                                    value={tc.expected_output}
                                                                    onChange={(e) => updateTestCase(index, 'expected_output', e.target.value)}
                                                                    className="w-full min-h-[80px] rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                                                                    placeholder="8"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Points</label>
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    step={0.5}
                                                                    value={tc.points}
                                                                    onChange={(e) => updateTestCase(index, 'points', parseFloat(e.target.value) || 0)}
                                                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Time Limit (sec)</label>
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    value={tc.time_limit_seconds ?? ''}
                                                                    onChange={(e) => updateTestCase(index, 'time_limit_seconds', e.target.value ? parseInt(e.target.value) : null)}
                                                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                    placeholder="Default"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Memory Limit (MB)</label>
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    value={tc.memory_limit_mb ?? ''}
                                                                    onChange={(e) => updateTestCase(index, 'memory_limit_mb', e.target.value ? parseInt(e.target.value) : null)}
                                                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                    placeholder="Default"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="pt-3 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-3">
                                                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={tc.is_hidden}
                                                                    onChange={(e) => updateTestCase(index, 'is_hidden', e.target.checked)}
                                                                    className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                                                                />
                                                                Hidden Test
                                                            </label>
                                                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={tc.is_sample}
                                                                    onChange={(e) => updateTestCase(index, 'is_sample', e.target.checked)}
                                                                    className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                                                                />
                                                                Sample Test
                                                            </label>
                                                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={tc.ignore_whitespace}
                                                                    onChange={(e) => updateTestCase(index, 'ignore_whitespace', e.target.checked)}
                                                                    className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                                                                />
                                                                Ignore Whitespace
                                                            </label>
                                                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={tc.ignore_case}
                                                                    onChange={(e) => updateTestCase(index, 'ignore_case', e.target.checked)}
                                                                    className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                                                                />
                                                                Ignore Case
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            <Button
                                                type="button"
                                                onClick={addTestCase}
                                                disabled={(watchTestWeight ?? 0) === 0}
                                                className="w-full gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Plus className="w-4 h-4" /> Add Another Test Case
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            )}
                        </Card>

                        {/* ━━━ 5. Rubric Builder ━━━ */}
                        <Card className="overflow-hidden border-gray-200 shadow-sm">
                            <CardHeader className="pb-0">
                                <SectionHeader
                                    id="rubric"
                                    icon={BookOpen}
                                    title="Manual Grading Rubric"
                                    subtitle="Define criteria for manual evaluation beyond automated tests"
                                    badge={rubricEnabled && rubricCategories.length > 0 ? (
                                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-[#862733]/10 text-[#862733]">
                                            {rubricCategories.length} categor{rubricCategories.length !== 1 ? 'ies' : 'y'} &middot; {totalRubricPoints} pts ({rubricWeightPct}%)
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
                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                                <p className="text-xs text-amber-700 flex items-start gap-2">
                                                    <BookOpen className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                                    Category weights must sum to 100%. Total rubric points = {totalRubricPoints} (max score × rubric weight {rubricWeightPct}%). Item points per category must sum to that category&apos;s share.
                                                </p>
                                            </div>

                                            {rubricCategories.length === 0 ? (
                                                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50">
                                                    <Layers className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                                    <p className="text-sm text-gray-600 mb-4">No rubric categories yet</p>
                                                    <Button type="button" onClick={addRubricCategory} className="gap-2 h-9 rounded-md px-3">
                                                        <Plus className="w-4 h-4" /> Add Category
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {rubricCategories.map((cat, catIndex) => (
                                                        <div key={catIndex} className="border border-gray-200 rounded-xl bg-white shadow-sm">
                                                            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-t-xl border-b border-gray-200">
                                                                <div className="flex items-center gap-3">
                                                                    <Layers className="w-4 h-4 text-primary" />
                                                                    <span className="font-semibold text-sm text-gray-900">
                                                                        Category {catIndex + 1}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeRubricCategory(catIndex)}
                                                                    className="inline-flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0 rounded-md transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>

                                                            <div className="p-4 space-y-4">
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Category Name</label>
                                                                        <input
                                                                            type="text"
                                                                            value={cat.name}
                                                                            onChange={(e) => updateRubricCategory(catIndex, 'name', e.target.value)}
                                                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                            placeholder="e.g., Code Quality"
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                                                                        <input
                                                                            type="text"
                                                                            value={cat.description ?? ''}
                                                                            onChange={(e) => updateRubricCategory(catIndex, 'description', e.target.value)}
                                                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                            placeholder="Optional"
                                                                        />
                                                                    </div>
                                                                    <div className="md:col-span-1">
                                                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Weight (%)</label>
                                                                        <input
                                                                            type="number"
                                                                            min={0}
                                                                            max={100}
                                                                            step={0.1}
                                                                            value={cat.weight}
                                                                            onChange={(e) => updateRubricCategory(catIndex, 'weight', parseFloat(e.target.value) || 0)}
                                                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                        />
                                                                        <p className="text-xs text-gray-500 mt-1">
                                                                            {Math.round(totalRubricPoints * (cat.weight / 100) * 100) / 100} pts
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                {/* Items */}
                                                                <div className="space-y-2">
                                                                    <label className="block text-sm font-medium text-gray-700">Criteria</label>
                                                                    {cat.items.map((item, itemIndex) => (
                                                                        <div key={itemIndex} className="flex items-start gap-2 bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2">
                                                                                <input
                                                                                    type="text"
                                                                                    value={item.name}
                                                                                    onChange={(e) => updateRubricItem(catIndex, itemIndex, 'name', e.target.value)}
                                                                                    className="md:col-span-4 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                                    placeholder="Criterion name"
                                                                                />
                                                                                <input
                                                                                    type="text"
                                                                                    value={item.description}
                                                                                    onChange={(e) => updateRubricItem(catIndex, itemIndex, 'description', e.target.value)}
                                                                                    className="md:col-span-6 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                                    placeholder="Description (optional)"
                                                                                />
                                                                                <input
                                                                                    type="number"
                                                                                    min={0}
                                                                                    step={0.5}
                                                                                    value={item.max_points}
                                                                                    onChange={(e) => updateRubricItem(catIndex, itemIndex, 'max_points', parseFloat(e.target.value) || 0)}
                                                                                    className="md:col-span-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                                                                    placeholder="Points"
                                                                                />
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => removeRubricItem(catIndex, itemIndex)}
                                                                                className={cn(
                                                                                    "inline-flex items-center justify-center h-8 w-8 p-0 rounded-md transition-colors flex-shrink-0",
                                                                                    cat.items.length <= 1
                                                                                        ? "text-gray-300 cursor-not-allowed"
                                                                                        : "text-red-400 hover:text-red-600 hover:bg-red-50"
                                                                                )}
                                                                                disabled={cat.items.length <= 1}
                                                                            >
                                                                                <X className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => addRubricItem(catIndex)}
                                                                        className="inline-flex items-center gap-1 text-primary hover:text-primary/80 text-xs font-medium h-9 px-3 rounded-md hover:bg-accent transition-colors"
                                                                    >
                                                                        <Plus className="w-3.5 h-3.5" /> Add Criterion
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    <Button
                                                        type="button"
                                                        onClick={addRubricCategory}
                                                        className="w-full gap-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                                    >
                                                        <Plus className="w-4 h-4" /> Add Another Category
                                                    </Button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </CardContent>
                            )}
                        </Card>

                        {/* ━━━ 6. Submission Settings ━━━ */}
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

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="Allowed File Extensions"
                                            {...register('allowedExtensionsStr')}
                                            error={errors.allowedExtensionsStr?.message}
                                            placeholder=".py, .txt, .md"
                                            helpText="Auto-filled from language. Add more comma-separated (e.g. .py, .txt)"
                                        />
                                        <Input
                                            label="Required Files"
                                            {...register('requiredFilesStr')}
                                            error={errors.requiredFilesStr?.message}
                                            placeholder="main.py, utils.py"
                                            helpText="Exact filenames students must submit"
                                        />
                                    </div>
                                </CardContent>
                            )}
                        </Card>

                        {/* ━━━ 7. Groups & Academic Integrity ━━━ */}
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
                                        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                                            isDragging
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
                                    {testCases.length} test case{testCases.length !== 1 ? 's' : ''}
                                    {rubricEnabled && rubricCategories.length > 0 && ` | ${rubricCategories.length} rubric categor${rubricCategories.length !== 1 ? 'ies' : 'y'}`}
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
    );
}
