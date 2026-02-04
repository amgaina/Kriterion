'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import apiClient from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { assignmentCreateSchema, type AssignmentCreateForm } from '@/lib/validation';

type Language = {
    id: number;
    name: string;
    version?: string;
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

    const onSubmit = async (values: AssignmentCreateForm) => {
        setError(null);
        setLoading(true);
        try {
            const allowed_file_extensions = (values.allowedExtensionsStr || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((ext) => (ext.startsWith('.') ? ext : `.${ext}`));

            const required_files = (values.requiredFilesStr || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

            const dueDateISO = new Date(values.due_date).toISOString();

            const payload = {
                course_id: courseId,
                title: values.title.trim(),
                description: values.description.trim(),
                instructions: values.instructions?.trim() || undefined,
                language_id: values.language_id,
                starter_code: values.starter_code || undefined,
                solution_code: values.solution_code || undefined,
                max_score: values.max_score,
                passing_score: values.passing_score,
                difficulty: values.difficulty,
                due_date: dueDateISO,
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
                is_published: values.is_published,
            };

            await apiClient.createAssignment(payload);
            router.push(`/faculty/courses/${courseId}/assignments`);
        } catch (err: any) {
            console.error('Create assignment failed', err);
            const msg = err?.response?.data?.detail || 'Failed to create assignment.';
            setError(Array.isArray(msg) ? msg.join(', ') : msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ProtectedRoute allowedRoles={["FACULTY"]}>
            <div className="max-w-5xl mx-auto px-4 py-8">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-gray-900">New Assignment</h1>
                    <p className="text-sm text-gray-600">Create a programming assignment for this course.</p>
                </div>

                {error && (
                    <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-red-700 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                    {/* Basic Info */}
                    <section>
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
                                placeholder="Describe the assignment requirements"
                                required
                            />
                            {errors.description?.message && (
                                <p className="mt-1.5 text-sm text-red-500">{errors.description.message}</p>
                            )}
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Instructions (Markdown)</label>
                            <textarea
                                className="w-full min-h-[100px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733]"
                                {...register('instructions')}
                                placeholder="Optional detailed instructions"
                            />
                        </div>
                    </section>

                    {/* Timing & Scoring */}
                    <section>
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Timing & Scoring</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input label="Due Date" type="datetime-local" {...register('due_date')} error={errors.due_date?.message} required />
                            <Input
                                label="Max Score"
                                type="number"
                                min={0}
                                {...register('max_score', { valueAsNumber: true })}
                                error={errors.max_score?.message}
                            />
                            <Input
                                label="Passing Score"
                                type="number"
                                min={0}
                                {...register('passing_score', { valueAsNumber: true })}
                                error={errors.passing_score?.message}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <Select
                                label="Difficulty"
                                {...register('difficulty')}
                                error={errors.difficulty?.message}
                                options={[
                                    { value: 'easy', label: 'Easy' },
                                    { value: 'medium', label: 'Medium' },
                                    { value: 'hard', label: 'Hard' },
                                ]}
                            />
                            <Input
                                label="Test Weight (%)"
                                type="number"
                                min={0}
                                max={100}
                                {...register('test_weight', { valueAsNumber: true })}
                                error={errors.test_weight?.message}
                            />
                            <Input
                                label="Rubric Weight (%)"
                                type="number"
                                min={0}
                                max={100}
                                {...register('rubric_weight', { valueAsNumber: true })}
                                error={errors.rubric_weight?.message}
                            />
                        </div>
                    </section>

                    {/* Submission Settings */}
                    <section>
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Submission Settings</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                label="Max Attempts (0 = unlimited)"
                                type="number"
                                min={0}
                                {...register('max_attempts', { valueAsNumber: true })}
                                error={errors.max_attempts?.message}
                            />
                            <Input
                                label="Max File Size (MB)"
                                type="number"
                                min={1}
                                {...register('max_file_size_mb', { valueAsNumber: true })}
                                error={errors.max_file_size_mb?.message}
                            />
                            <div className="flex items-center gap-2 mt-6">
                                <input
                                    id="allowLate"
                                    type="checkbox"
                                    {...register('allow_late')}
                                    className="h-4 w-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]"
                                />
                                <label htmlFor="allowLate" className="text-sm text-gray-700">Allow Late Submissions</label>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <Input
                                label="Late Penalty per Day (%)"
                                type="number"
                                min={0}
                                max={100}
                                {...register('late_penalty_per_day', { valueAsNumber: true })}
                                error={errors.late_penalty_per_day?.message}
                            />
                            <Input
                                label="Max Late Days"
                                type="number"
                                min={0}
                                {...register('max_late_days', { valueAsNumber: true })}
                                error={errors.max_late_days?.message}
                            />
                            <div />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <Input
                                label="Allowed File Extensions (comma separated)"
                                placeholder="e.g. .py, .java"
                                {...register('allowedExtensionsStr')}
                                error={errors.allowedExtensionsStr?.message}
                            />
                            <Input
                                label="Required Files (comma separated)"
                                placeholder="e.g. main.py, helper.py"
                                {...register('requiredFilesStr')}
                                error={errors.requiredFilesStr?.message}
                            />
                        </div>
                    </section>

                    {/* Group & Integrity Settings */}
                    <section>
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Groups & Integrity</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex items-center gap-2">
                                <input
                                    id="allowGroups"
                                    type="checkbox"
                                    {...register('allow_groups')}
                                    className="h-4 w-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]"
                                />
                                <label htmlFor="allowGroups" className="text-sm text-gray-700">Allow Groups</label>
                            </div>
                            <Input
                                label="Max Group Size"
                                type="number"
                                min={1}
                                {...register('max_group_size', { valueAsNumber: true })}
                                error={errors.max_group_size?.message}
                            />
                            <div />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="flex items-center gap-2">
                                <input
                                    id="enablePlagiarism"
                                    type="checkbox"
                                    {...register('enable_plagiarism_check')}
                                    className="h-4 w-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]"
                                />
                                <label htmlFor="enablePlagiarism" className="text-sm text-gray-700">Enable Plagiarism Check</label>
                            </div>
                            <Input
                                label="Plagiarism Threshold (%)"
                                type="number"
                                min={0}
                                max={100}
                                {...register('plagiarism_threshold', { valueAsNumber: true })}
                                error={errors.plagiarism_threshold?.message}
                            />
                            <div />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="flex items-center gap-2">
                                <input
                                    id="enableAiDetection"
                                    type="checkbox"
                                    {...register('enable_ai_detection')}
                                    className="h-4 w-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]"
                                />
                                <label htmlFor="enableAiDetection" className="text-sm text-gray-700">Enable AI Detection</label>
                            </div>
                            <Input
                                label="AI Detection Threshold (%)"
                                type="number"
                                min={0}
                                max={100}
                                {...register('ai_detection_threshold', { valueAsNumber: true })}
                                error={errors.ai_detection_threshold?.message}
                            />
                            <div />
                        </div>
                    </section>

                    {/* Starter/Solution Code */}
                    <section>
                        <h2 className="text-lg font-medium text-gray-900 mb-4">Starter & Solution Code</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Starter Code</label>
                                <textarea
                                    className="w-full min-h-[160px] rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#862733]"
                                    {...register('starter_code')}
                                    placeholder="Optional starter code for students"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Solution Code (faculty only)</label>
                                <textarea
                                    className="w-full min-h-[160px] rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#862733]"
                                    {...register('solution_code')}
                                    placeholder="Optional reference solution"
                                />
                            </div>
                        </div>
                    </section>

                    {/* Publish Option */}
                    <section>
                        <div className="flex items-center gap-2">
                            <input
                                id="publishNow"
                                type="checkbox"
                                {...register('is_published')}
                                className="h-4 w-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]"
                            />
                            <label htmlFor="publishNow" className="text-sm text-gray-700">Publish immediately</label>
                        </div>
                    </section>

                    <div className="flex items-center gap-3">
                        <Button type="submit" disabled={loading} className="bg-[#862733] hover:bg-[#6f1f29] text-white">
                            {loading ? 'Creating…' : 'Create Assignment'}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => router.back()}>
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>
        </ProtectedRoute>
    );
}

