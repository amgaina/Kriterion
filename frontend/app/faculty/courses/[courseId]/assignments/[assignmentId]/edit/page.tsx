'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Loader2, ArrowLeft, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assignmentCreateSchema, type AssignmentCreateForm } from '@/lib/validation';

type Language = {
    id: number;
    name: string;
    version?: string;
};

export default function EditAssignmentPage() {
    const router = useRouter();
    const params = useParams();
    const courseParam = params?.courseId as string | string[] | undefined;
    const assignmentParam = params?.assignmentId as string | string[] | undefined;
    
    const courseIdStr = Array.isArray(courseParam) ? (courseParam[0] ?? '') : (courseParam ?? '');
    const assignmentIdStr = Array.isArray(assignmentParam) ? (assignmentParam[0] ?? '') : (assignmentParam ?? '');
    
    const courseId = useMemo(() => parseInt(courseIdStr, 10), [courseIdStr]);
    const assignmentId = useMemo(() => parseInt(assignmentIdStr, 10), [assignmentIdStr]);

    const [languages, setLanguages] = useState<Language[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const { data: assignment, isLoading: fetchingAssignment } = useQuery({
        queryKey: ['assignment', assignmentId],
        queryFn: () => apiClient.getAssignment(assignmentId),
        enabled: !!assignmentId,
    });

    const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<AssignmentCreateForm>({
        resolver: zodResolver(assignmentCreateSchema),
        defaultValues: {
            course_id: courseId,
            title: '',
            description: '',
            instructions: '',
            language_id: undefined as unknown as number,
            starter_code: '',
            solution_code: '',
            max_score: 100,
            passing_score: 60,
            difficulty: 'medium',
            due_date: '',
            allow_late: true,
            late_penalty_per_day: 10,
            max_late_days: 7,
            max_attempts: 0,
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
        if (assignment) {
            setValue('title', assignment.title);
            setValue('description', assignment.description);
            setValue('instructions', assignment.instructions || '');
            setValue('language_id', assignment.language_id);
            setValue('starter_code', assignment.starter_code || '');
            setValue('solution_code', assignment.solution_code || '');
            setValue('max_score', assignment.max_score);
            setValue('passing_score', assignment.passing_score);
            setValue('difficulty', assignment.difficulty);
            setValue('test_weight', assignment.test_weight);
            setValue('rubric_weight', assignment.rubric_weight);
            
            if (assignment.due_date) {
                const date = new Date(assignment.due_date);
                setValue('due_date', date.toISOString().slice(0, 16));
            }
            
            setValue('allow_late', assignment.allow_late);
            setValue('late_penalty_per_day', assignment.late_penalty_per_day);
            setValue('max_late_days', assignment.max_late_days);
            setValue('max_attempts', assignment.max_attempts);
            setValue('max_file_size_mb', assignment.max_file_size_mb);
            setValue('allow_groups', assignment.allow_groups);
            setValue('max_group_size', assignment.max_group_size);
            setValue('enable_plagiarism_check', assignment.enable_plagiarism_check);
            setValue('plagiarism_threshold', assignment.plagiarism_threshold);
            setValue('enable_ai_detection', assignment.enable_ai_detection);
            setValue('ai_detection_threshold', assignment.ai_detection_threshold);
            setValue('is_published', assignment.is_published);
        }
    }, [assignment, setValue]);

    const updateMutation = useMutation({
        mutationFn: async (values: AssignmentCreateForm) => {
            setError(null);
            setLoading(true);
            try {
                const payload = {
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

                await apiClient.updateAssignment(assignmentId, payload);
                router.push(`/faculty/courses/${courseId}/assignments`);
            } catch (err: any) {
                console.error('Update assignment failed', err);
                const detail = err?.response?.data?.detail;
                let msg = 'Failed to update assignment.';
                
                if (typeof detail === 'string') {
                    msg = detail;
                } else if (Array.isArray(detail)) {
                    msg = detail.map((d: any) => d.msg || d).join(', ');
                } else if (err?.message) {
                    msg = err.message;
                }
                
                setError(msg);
            } finally {
                setLoading(false);
            }
        }
    });

    const deleteMutation = useMutation({
        mutationFn: () => apiClient.deleteAssignment(assignmentId),
        onSuccess: () => {
            router.push(`/faculty/courses/${courseId}/assignments`);
        },
        onError: (err: any) => {
            setError(err?.response?.data?.detail || 'Failed to delete assignment');
            setShowDeleteConfirm(false);
        },
    });

    if (fetchingAssignment) {
        return (
            <ProtectedRoute allowedRoles={["FACULTY"]}>
                <DashboardLayout>
                    <div className="flex items-center justify-center h-96">
                        <Loader2 className="w-8 h-8 animate-spin text-[#862733]" />
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    if (!assignment) {
        return (
            <ProtectedRoute allowedRoles={["FACULTY"]}>
                <DashboardLayout>
                    <Alert type="error">
                        Assignment not found.
                    </Alert>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    const onSubmit = (values: AssignmentCreateForm) => {
        updateMutation.mutate(values);
    };

    return (
        <ProtectedRoute allowedRoles={["FACULTY"]}>
            <DashboardLayout>
                <div className="max-w-5xl mx-auto px-4 py-8">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <Button variant="ghost" onClick={() => router.back()}>
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteConfirm(true)}
                            className="text-red-600 hover:bg-red-50"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Assignment
                        </Button>
                    </div>

                    <div className="mb-6">
                        <h1 className="text-2xl font-semibold text-gray-900">Edit Assignment</h1>
                        <p className="text-sm text-gray-600">Update the programming assignment details.</p>
                    </div>

                    {error && (
                        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                        {/* Basic Info */}
                        <section className="bg-white rounded-lg p-6 border border-gray-200">
                            <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Title" {...register('title')} error={errors.title?.message} required />
                                <Select
                                    label="Language"
                                    {...register('language_id')}
                                    error={errors.language_id?.message}
                                    options={languages.map((l) => ({ value: String(l.id), label: l.version ? `${l.name} (${l.version})` : l.name }))}
                                    placeholder="Select language"
                                />
                            </div>
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                                <textarea
                                    className="w-full min-h-[120px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733]"
                                    {...register('description')}
                                    required
                                />
                            </div>
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Instructions</label>
                                <textarea
                                    className="w-full min-h-[100px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733]"
                                    {...register('instructions')}
                                />
                            </div>
                        </section>

                        {/* Timing & Scoring */}
                        <section className="bg-white rounded-lg p-6 border border-gray-200">
                            <h2 className="text-lg font-medium text-gray-900 mb-4">Timing & Scoring</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Input label="Due Date" type="datetime-local" {...register('due_date')} required />
                                <Input label="Max Score" type="number" min={0} {...register('max_score', { valueAsNumber: true })} />
                                <Input label="Passing Score" type="number" min={0} {...register('passing_score', { valueAsNumber: true })} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                <Select label="Difficulty" {...register('difficulty')} options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
                                <Input label="Test Weight (%)" type="number" min={0} max={100} {...register('test_weight', { valueAsNumber: true })} />
                                <Input label="Rubric Weight (%)" type="number" min={0} max={100} {...register('rubric_weight', { valueAsNumber: true })} />
                            </div>
                        </section>

                        {/* Submission Settings */}
                        <section className="bg-white rounded-lg p-6 border border-gray-200">
                            <h2 className="text-lg font-medium text-gray-900 mb-4">Submission Settings</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="Max Attempts" type="number" min={0} {...register('max_attempts', { valueAsNumber: true })} />
                                <Input label="Max File Size (MB)" type="number" min={1} {...register('max_file_size_mb', { valueAsNumber: true })} />
                            </div>
                        </section>

                        {/* Late Submissions */}
                        <section className="bg-white rounded-lg p-6 border border-gray-200">
                            <h2 className="text-lg font-medium text-gray-900 mb-4">Late Submission Policy</h2>
                            <label className="flex items-center gap-2 cursor-pointer mb-4">
                                <input type="checkbox" {...register('allow_late')} className="w-4 h-4" />
                                <span className="text-sm font-medium text-gray-700">Allow Late Submissions</span>
                            </label>
                            {watch('allow_late') && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Late Penalty Per Day (%)" type="number" min={0} max={100} {...register('late_penalty_per_day', { valueAsNumber: true })} />
                                    <Input label="Max Late Days" type="number" min={0} {...register('max_late_days', { valueAsNumber: true })} />
                                </div>
                            )}
                        </section>

                        {/* Code Templates */}
                        <section className="bg-white rounded-lg p-6 border border-gray-200">
                            <h2 className="text-lg font-medium text-gray-900 mb-4">Code Templates</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Starter Code</label>
                                    <textarea
                                        className="w-full min-h-[150px] rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#862733]"
                                        {...register('starter_code')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Solution Code</label>
                                    <textarea
                                        className="w-full min-h-[150px] rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#862733]"
                                        {...register('solution_code')}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Integrity Checks */}
                        <section className="bg-white rounded-lg p-6 border border-gray-200">
                            <h2 className="text-lg font-medium text-gray-900 mb-4">Integrity Checks</h2>
                            <div className="space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" {...register('enable_plagiarism_check')} className="w-4 h-4" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Enable Plagiarism Check</p>
                                        <p className="text-xs text-gray-500">Detect copied code</p>
                                    </div>
                                </label>
                                {watch('enable_plagiarism_check') && (
                                    <Input label="Plagiarism Threshold (%)" type="number" min={0} max={100} {...register('plagiarism_threshold', { valueAsNumber: true })} />
                                )}
                                <label className="flex items-center gap-3 cursor-pointer mt-4">
                                    <input type="checkbox" {...register('enable_ai_detection')} className="w-4 h-4" />
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Enable AI Detection</p>
                                        <p className="text-xs text-gray-500">Detect AI-generated code</p>
                                    </div>
                                </label>
                                {watch('enable_ai_detection') && (
                                    <Input label="AI Detection Threshold (%)" type="number" min={0} max={100} {...register('ai_detection_threshold', { valueAsNumber: true })} />
                                )}
                            </div>
                        </section>

                        {/* Publishing */}
                        <section className="bg-white rounded-lg p-6 border border-gray-200">
                            <h2 className="text-lg font-medium text-gray-900 mb-4">Publishing</h2>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" {...register('is_published')} className="w-4 h-4" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Publish Assignment</p>
                                    <p className="text-xs text-gray-500">Make visible to students</p>
                                </div>
                            </label>
                        </section>

                        {/* Buttons */}
                        <div className="flex gap-3 justify-end">
                            <Button variant="outline" onClick={() => router.back()}>
                                Cancel
                            </Button>
                            <Button disabled={loading || updateMutation.isPending}>
                                {loading || updateMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Updating...
                                    </>
                                ) : (
                                    'Update Assignment'
                                )}
                            </Button>
                        </div>
                    </form>

                    {/* Delete Confirmation Modal */}
                    {showDeleteConfirm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                            <Card className="w-96 shadow-xl">
                                <CardHeader>
                                    <CardTitle className="text-red-600">Delete Assignment?</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-gray-600">
                                        Are you sure you want to delete "{assignment.title}"? This action cannot be undone.
                                    </p>
                                    <div className="flex gap-3 justify-end">
                                        <Button
                                            variant="outline"
                                            onClick={() => setShowDeleteConfirm(false)}
                                            disabled={deleteMutation.isPending}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            className="bg-red-600 hover:bg-red-700 text-white"
                                            onClick={() => deleteMutation.mutate()}
                                            disabled={deleteMutation.isPending}
                                        >
                                            {deleteMutation.isPending ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Deleting...
                                                </>
                                            ) : (
                                                'Delete'
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
