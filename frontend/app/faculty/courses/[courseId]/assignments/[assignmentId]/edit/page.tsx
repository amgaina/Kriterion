'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
    Loader2, ArrowLeft, Trash2, AlertCircle, Save, Eye, EyeOff,
    Clock, FileCode, Shield, Settings, ChevronDown, ChevronUp, CheckCircle2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assignmentCreateSchema, type AssignmentCreateForm } from '@/lib/validation';

type Language = { id: number; name: string; version?: string; display_name?: string };

export default function EditAssignmentPage() {
    const router = useRouter();
    const params = useParams();
    const queryClient = useQueryClient();
    const courseParam = params?.courseId as string | string[] | undefined;
    const assignmentParam = params?.assignmentId as string | string[] | undefined;
    const courseIdStr = Array.isArray(courseParam) ? (courseParam[0] ?? '') : (courseParam ?? '');
    const assignmentIdStr = Array.isArray(assignmentParam) ? (assignmentParam[0] ?? '') : (assignmentParam ?? '');
    const courseId = useMemo(() => parseInt(courseIdStr, 10), [courseIdStr]);
    const assignmentId = useMemo(() => parseInt(assignmentIdStr, 10), [assignmentIdStr]);

    const [languages, setLanguages] = useState<Language[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        basic: true, timing: true, submission: false, late: false, code: false, integrity: false, publish: true,
    });

    const toggleSection = (key: string) =>
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

    // Fetch this specific assignment via getAssignment (not the full list)
    const { data: assignment, isLoading: loadingAssignment, error: queryError } = useQuery({
        queryKey: ['assignment', assignmentId],
        queryFn: () => apiClient.getAssignment(assignmentId),
        enabled: !!assignmentId && !isNaN(assignmentId),
    });

    const { register, handleSubmit, formState: { errors, isDirty }, watch, setValue, reset } = useForm<AssignmentCreateForm>({
        resolver: zodResolver(assignmentCreateSchema),
        defaultValues: {
            course_id: courseId,
            title: '', description: '', instructions: '',
            language_id: undefined as unknown as number,
            starter_code: '', solution_code: '',
            max_score: 100, passing_score: 60, difficulty: 'medium',
            due_date: '', allow_late: true, late_penalty_per_day: 10,
            max_late_days: 7, max_attempts: 0, max_file_size_mb: 10,
            allowedExtensionsStr: '', requiredFilesStr: '',
            allow_groups: false, max_group_size: 4,
            enable_plagiarism_check: true, plagiarism_threshold: 30,
            enable_ai_detection: true, ai_detection_threshold: 50,
            test_weight: 70, rubric_weight: 30, is_published: false,
        },
    });

    useEffect(() => {
        (async () => {
            try {
                const list = await apiClient.getLanguages();
                setLanguages(list || []);
            } catch { /* ignore */ }
        })();
    }, []);

    useEffect(() => {
        if (!assignment) return;
        const a = assignment as any;
        setValue('title', a.title ?? '');
        setValue('description', a.description ?? '');
        setValue('instructions', a.instructions ?? '');
        setValue('language_id', a.language_id ?? a.language?.id);
        setValue('starter_code', a.starter_code ?? '');
        setValue('solution_code', a.solution_code ?? '');
        setValue('max_score', a.max_score ?? 100);
        setValue('passing_score', a.passing_score ?? 60);
        setValue('difficulty', a.difficulty ?? 'medium');
        if (a.due_date) setValue('due_date', new Date(a.due_date).toISOString().slice(0, 16));
        setValue('allow_late', a.allow_late ?? true);
        setValue('late_penalty_per_day', a.late_penalty_per_day ?? 10);
        setValue('max_late_days', a.max_late_days ?? 7);
        setValue('max_attempts', a.max_attempts ?? 0);
        setValue('max_file_size_mb', a.max_file_size_mb ?? 10);
        setValue('allowedExtensionsStr', (a.allowed_file_extensions ?? []).join(', '));
        setValue('requiredFilesStr', (a.required_files ?? []).join(', '));
        setValue('allow_groups', a.allow_groups ?? false);
        setValue('max_group_size', a.max_group_size ?? 4);
        setValue('enable_plagiarism_check', a.enable_plagiarism_check ?? true);
        setValue('plagiarism_threshold', a.plagiarism_threshold ?? 30);
        setValue('enable_ai_detection', a.enable_ai_detection ?? true);
        setValue('ai_detection_threshold', a.ai_detection_threshold ?? 50);
        setValue('test_weight', a.test_weight ?? 70);
        setValue('rubric_weight', a.rubric_weight ?? 30);
        setValue('is_published', a.is_published ?? false);
    }, [assignment, setValue]);

    const updateMutation = useMutation({
        mutationFn: async (values: AssignmentCreateForm) => {
            setError(null);
            setSuccess(null);
            const payload: Record<string, any> = {
                title: values.title.trim(),
                description: values.description.trim(),
                instructions: values.instructions?.trim() || undefined,
                language_id: parseInt(String(values.language_id), 10),
                starter_code: values.starter_code || undefined,
                solution_code: values.solution_code || undefined,
                max_score: values.max_score,
                passing_score: values.passing_score,
                difficulty: values.difficulty,
                due_date: new Date(values.due_date).toISOString(),
                allow_late: values.allow_late,
                late_penalty_per_day: values.late_penalty_per_day,
                max_late_days: values.max_late_days,
                max_attempts: values.max_attempts,
                max_file_size_mb: values.max_file_size_mb,
                allow_groups: values.allow_groups,
                max_group_size: values.max_group_size,
                enable_plagiarism_check: values.enable_plagiarism_check,
                plagiarism_threshold: values.plagiarism_threshold,
                enable_ai_detection: values.enable_ai_detection,
                ai_detection_threshold: values.ai_detection_threshold,
                test_weight: values.test_weight,
                rubric_weight: values.rubric_weight,
                is_published: values.is_published,
            };
            if (values.allowedExtensionsStr?.trim()) {
                payload.allowed_file_extensions = values.allowedExtensionsStr.split(',').map(s => s.trim()).filter(Boolean);
            }
            if (values.requiredFilesStr?.trim()) {
                payload.required_files = values.requiredFilesStr.split(',').map(s => s.trim()).filter(Boolean);
            }
            await apiClient.updateAssignment(assignmentId, payload);
        },
        onSuccess: () => {
            setSuccess('Assignment updated successfully!');
            queryClient.invalidateQueries({ queryKey: ['assignment', assignmentId] });
            queryClient.invalidateQueries({ queryKey: ['assignments'] });
            setTimeout(() => setSuccess(null), 4000);
        },
        onError: (err: any) => {
            const detail = err?.response?.data?.detail;
            let msg = 'Failed to update assignment.';
            if (typeof detail === 'string') msg = detail;
            else if (Array.isArray(detail)) msg = detail.map((d: any) => d.msg || d).join(', ');
            else if (err?.message) msg = err.message;
            setError(msg);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => apiClient.deleteAssignment(assignmentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assignments'] });
            router.push(`/faculty/courses/${courseId}/assignments`);
        },
        onError: (err: any) => {
            setError(err?.response?.data?.detail || 'Failed to delete assignment');
            setShowDeleteConfirm(false);
        },
    });

    const onSubmit = (values: AssignmentCreateForm) => updateMutation.mutate(values);

    if (loadingAssignment) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[#862733] mx-auto" />
                    <p className="text-sm text-gray-500">Loading assignment...</p>
                </div>
            </div>
        );
    }

    if (queryError || !assignment) {
        return (
            <div className="text-center py-20 max-w-md mx-auto">
                <div className="bg-red-50 rounded-2xl p-8 border border-red-100">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        {queryError ? 'Failed to load assignment' : 'Assignment not found'}
                    </h2>
                    <p className="text-gray-500 mb-6 text-sm">
                        {queryError ? (queryError as any)?.message || 'Unknown error' : 'Check if you have access.'}
                    </p>
                    <Button onClick={() => router.push(`/faculty/courses/${courseId}/assignments`)}
                        className="bg-[#862733] hover:bg-[#a03040] text-white">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Assignments
                    </Button>
                </div>
            </div>
        );
    }

    const SectionHeader = ({ id, icon: Icon, title, badge }: { id: string; icon: any; title: string; badge?: React.ReactNode }) => (
        <button type="button" onClick={() => toggleSection(id)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors rounded-t-xl">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#862733]/10"><Icon className="w-4 h-4 text-[#862733]" /></div>
                <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                {badge}
            </div>
            {expandedSections[id] ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>
    );

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {/* Header */}
            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-gray-500 hover:text-gray-900">
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Edit Assignment</h1>
                        <p className="text-sm text-gray-500 mt-0.5">Update "{(assignment as any).title}"</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)}
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300">
                    <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                </Button>
            </div>

            {/* Alerts */}
            {error && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-red-800">Error</p>
                        <p className="text-sm text-red-600 mt-0.5">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                </div>
            )}
            {success && (
                <div className="mb-4 rounded-xl bg-green-50 border border-green-200 p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium text-green-800">{success}</p>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Basic Info */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <SectionHeader id="basic" icon={FileCode} title="Basic Information" />
                    {expandedSections.basic && (
                        <div className="px-6 pb-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Title" {...register('title')} error={errors.title?.message} required />
                                <Select label="Language" {...register('language_id')} error={errors.language_id?.message}
                                    options={languages.map(l => ({ value: String(l.id), label: l.display_name || l.name }))} placeholder="Select language" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-red-500">*</span></label>
                                <textarea className="w-full min-h-[120px] rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733]/30 focus:border-[#862733] transition-all"
                                    {...register('description')} required placeholder="Describe the assignment..." />
                                {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Instructions</label>
                                <textarea className="w-full min-h-[100px] rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733]/30 focus:border-[#862733] transition-all"
                                    {...register('instructions')} placeholder="Step-by-step instructions for students..." />
                            </div>
                        </div>
                    )}
                </div>

                {/* Timing & Scoring */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <SectionHeader id="timing" icon={Clock} title="Timing & Scoring" />
                    {expandedSections.timing && (
                        <div className="px-6 pb-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                <Input label="Due Date" type="datetime-local" {...register('due_date')} error={errors.due_date?.message} required />
                                <Input label="Max Score" type="number" min={0} {...register('max_score', { valueAsNumber: true })} error={errors.max_score?.message} />
                                <Input label="Passing Score" type="number" min={0} {...register('passing_score', { valueAsNumber: true })} error={errors.passing_score?.message} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                <Select label="Difficulty" {...register('difficulty')} options={[
                                    { value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' },
                                ]} />
                                <Input label="Test Weight (%)" type="number" min={0} max={100} {...register('test_weight', { valueAsNumber: true })} />
                                <Input label="Rubric Weight (%)" type="number" min={0} max={100} {...register('rubric_weight', { valueAsNumber: true })} />
                            </div>
                            {errors.root && <p className="text-xs text-red-500">{errors.root.message}</p>}
                        </div>
                    )}
                </div>

                {/* Submission Settings */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <SectionHeader id="submission" icon={Settings} title="Submission Settings" />
                    {expandedSections.submission && (
                        <div className="px-6 pb-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input label="Max Attempts (0 = unlimited)" type="number" min={0} {...register('max_attempts', { valueAsNumber: true })} />
                                <Input label="Max File Size (MB)" type="number" min={1} {...register('max_file_size_mb', { valueAsNumber: true })} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input label="Allowed Extensions (comma-separated)" {...register('allowedExtensionsStr')} placeholder=".py, .java, .txt" />
                                <Input label="Required Files (comma-separated)" {...register('requiredFilesStr')} placeholder="main.py, utils.py" />
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" {...register('allow_groups')} className="w-4 h-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Allow Group Submissions</p>
                                        <p className="text-xs text-gray-500">Students can submit as a group</p>
                                    </div>
                                </label>
                                {watch('allow_groups') && (
                                    <div className="mt-3 ml-7">
                                        <Input label="Max Group Size" type="number" min={2} max={10} {...register('max_group_size', { valueAsNumber: true })} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Late Submission */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <SectionHeader id="late" icon={Clock} title="Late Submission Policy" />
                    {expandedSections.late && (
                        <div className="px-6 pb-6 space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" {...register('allow_late')} className="w-4 h-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Allow Late Submissions</p>
                                    <p className="text-xs text-gray-500">Students can submit after the due date with a penalty</p>
                                </div>
                            </label>
                            {watch('allow_late') && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ml-7 bg-amber-50 p-4 rounded-lg border border-amber-200">
                                    <Input label="Penalty Per Day (%)" type="number" min={0} max={100} {...register('late_penalty_per_day', { valueAsNumber: true })} />
                                    <Input label="Max Late Days" type="number" min={0} {...register('max_late_days', { valueAsNumber: true })} />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Code Templates */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <SectionHeader id="code" icon={FileCode} title="Code Templates" />
                    {expandedSections.code && (
                        <div className="px-6 pb-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Starter Code</label>
                                <textarea className="w-full min-h-[150px] rounded-xl border border-gray-300 px-4 py-3 text-sm font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#862733]/30 focus:border-[#862733]"
                                    {...register('starter_code')} placeholder="// Code provided to students..." />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Solution Code</label>
                                <textarea className="w-full min-h-[150px] rounded-xl border border-gray-300 px-4 py-3 text-sm font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#862733]/30 focus:border-[#862733]"
                                    {...register('solution_code')} placeholder="// Reference solution (not visible to students)..." />
                            </div>
                        </div>
                    )}
                </div>

                {/* Integrity Checks */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <SectionHeader id="integrity" icon={Shield} title="Integrity Checks" />
                    {expandedSections.integrity && (
                        <div className="px-6 pb-6 space-y-5">
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" {...register('enable_plagiarism_check')} className="w-4 h-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Plagiarism Detection</p>
                                        <p className="text-xs text-gray-500">Compare submissions against each other using n-gram fingerprinting</p>
                                    </div>
                                </label>
                                {watch('enable_plagiarism_check') && (
                                    <div className="mt-3 ml-7">
                                        <Input label="Similarity Threshold (%)" type="number" min={0} max={100}
                                            {...register('plagiarism_threshold', { valueAsNumber: true })} />
                                        <p className="text-xs text-gray-400 mt-1">Submissions above this threshold will be flagged</p>
                                    </div>
                                )}
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" {...register('enable_ai_detection')} className="w-4 h-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">AI-Generated Code Detection</p>
                                        <p className="text-xs text-gray-500">Flag potentially AI-generated submissions</p>
                                    </div>
                                </label>
                                {watch('enable_ai_detection') && (
                                    <div className="mt-3 ml-7">
                                        <Input label="AI Detection Threshold (%)" type="number" min={0} max={100}
                                            {...register('ai_detection_threshold', { valueAsNumber: true })} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Publishing */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <SectionHeader id="publish" icon={Eye} title="Publishing"
                        badge={watch('is_published')
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Published</span>
                            : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Draft</span>
                        } />
                    {expandedSections.publish && (
                        <div className="px-6 pb-6">
                            <label className="flex items-center gap-3 cursor-pointer p-4 rounded-lg border-2 transition-colors"
                                style={{ borderColor: watch('is_published') ? '#862733' : '#e5e7eb', backgroundColor: watch('is_published') ? 'rgba(134,39,51,0.04)' : 'transparent' }}>
                                <input type="checkbox" {...register('is_published')} className="w-5 h-5 rounded border-gray-300 text-[#862733] focus:ring-[#862733]" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">
                                        {watch('is_published') ? 'Published - Visible to students' : 'Draft - Hidden from students'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {watch('is_published') ? 'Students can view and submit to this assignment' : 'Only you can see this assignment'}
                                    </p>
                                </div>
                            </label>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2 pb-8">
                    <Button type="button" variant="outline" onClick={() => router.back()} className="sm:w-auto w-full">
                        Cancel
                    </Button>
                    <Button type="submit" disabled={updateMutation.isPending}
                        className="bg-[#862733] hover:bg-[#a03040] text-white sm:w-auto w-full">
                        {updateMutation.isPending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                            : <><Save className="w-4 h-4 mr-2" /> Save Changes</>
                        }
                    </Button>
                </div>
            </form>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Delete Assignment?</h3>
                            <p className="text-sm text-gray-500 text-center">
                                Are you sure you want to delete &ldquo;{(assignment as any).title}&rdquo;? All submissions and grades will be permanently removed.
                            </p>
                        </div>
                        <div className="flex gap-3 p-4 bg-gray-50 border-t border-gray-100">
                            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleteMutation.isPending} className="flex-1">
                                Cancel
                            </Button>
                            <Button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                                {deleteMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</> : 'Delete'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
