'use client';

/**
 * Create or Edit Course
 * Form for faculty to set up a new course or edit an existing one.
 * Use ?edit=123 to load and edit course with id 123.
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useMutationWithInvalidation } from '@/lib/use-mutation-with-invalidation';
import apiClient from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { CourseLoadingPage, CourseLoadingSpinner } from '@/components/course/CourseLoading';
import { ArrowLeft, AlertCircle } from 'lucide-react';

const SEMESTERS = ['Fall', 'Spring', 'Summer', 'Winter'];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear + i);

interface FormData {
    code: string;
    name: string;
    description: string;
    section: string;
    semester: string;
    year: number;
    start_date: string;
    end_date: string;
    color: string;
    status: 'draft' | 'active' | 'archived';
    allow_late_submissions: boolean;
    default_late_penalty: number;
}

const toDateInput = (s: string | null | undefined): string => {
    if (!s) return '';
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

const toLocalDateInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const fromDateInput = (value: string): Date | null => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
};

const today = () => new Date().toISOString().slice(0, 10);

const initialForm: FormData = {
    code: '',
    name: '',
    description: '',
    section: '',
    semester: 'Spring',
    year: currentYear,
    start_date: '',
    end_date: '',
    color: '#862733',
    status: 'draft',
    allow_late_submissions: true,
    default_late_penalty: 10,
};

export default function NewCoursePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('edit') ? parseInt(searchParams.get('edit')!, 10) : null;
    const isEdit = Boolean(editId && !isNaN(editId));

    const [form, setForm] = useState<FormData>(initialForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formLoaded, setFormLoaded] = useState(!isEdit);

    const todayDate = fromDateInput(today()) || new Date();
    const minStartDate = isEdit ? undefined : todayDate;
    const minEndDate = form.start_date
        ? fromDateInput(form.start_date) || (isEdit ? undefined : todayDate)
        : (isEdit ? undefined : todayDate);

    const { data: course } = useQuery({
        queryKey: ['course', editId],
        queryFn: () => apiClient.getCourse(editId!),
        enabled: isEdit && !!editId,
    });

    useEffect(() => {
        if (isEdit && course) {
            setForm({
                code: course.code,
                name: course.name,
                description: course.description || '',
                section: course.section || '',
                semester: course.semester,
                year: course.year,
                start_date: toDateInput(course.start_date),
                end_date: toDateInput(course.end_date),
                color: course.color || '#862733',
                status: course.status || 'draft',
                allow_late_submissions: course.allow_late_submissions ?? true,
                default_late_penalty: course.default_late_penalty ?? 10,
            });
            setFormLoaded(true);
        }
    }, [isEdit, course]);

    const createMutation = useMutationWithInvalidation({
        mutationFn: (data: FormData) => {
            const payload: Record<string, unknown> = {
                code: data.code.trim().toUpperCase(),
                name: data.name.trim(),
                description: data.description.trim() || undefined,
                section: data.section.trim() || undefined,
                semester: data.semester,
                year: data.year,
                color: data.color || undefined,
                status: data.status,
                allow_late_submissions: data.allow_late_submissions,
                default_late_penalty: data.default_late_penalty,
            };
            if (data.start_date) payload.start_date = new Date(data.start_date).toISOString();
            if (data.end_date) payload.end_date = new Date(data.end_date).toISOString();
            return apiClient.createCourse(payload);
        },
        invalidateGroups: ['allCourses', 'allDashboards'],
        onSuccess: () => {
            router.push('/faculty/courses');
        },
        onError: (err: any) => {
            const detail = err?.response?.data?.detail;
            if (typeof detail === 'string') {
                setErrors({ submit: detail });
            } else if (Array.isArray(detail)) {
                const fieldErrors: Record<string, string> = {};
                detail.forEach((d: any) => {
                    const loc = d?.loc?.[1] ?? 'submit';
                    fieldErrors[loc] = d?.msg ?? 'Invalid';
                });
                setErrors(fieldErrors);
            } else {
                setErrors({ submit: err?.message ?? 'Failed to create course' });
            }
        },
    });

    const updateMutation = useMutationWithInvalidation({
        mutationFn: (data: FormData) => {
            const payload: Record<string, unknown> = {
                code: data.code.trim().toUpperCase(),
                name: data.name.trim(),
                description: data.description.trim() || null,
                section: data.section.trim() || null,
                semester: data.semester,
                year: data.year,
                status: data.status,
                is_active: data.status === 'active',
                color: data.color || null,
                allow_late_submissions: data.allow_late_submissions,
                default_late_penalty: data.default_late_penalty,
            };
            if (data.start_date) payload.start_date = new Date(data.start_date).toISOString();
            else payload.start_date = null;
            if (data.end_date) payload.end_date = new Date(data.end_date).toISOString();
            else payload.end_date = null;
            return apiClient.updateCourse(editId!, payload);
        },
        invalidateGroups: ['allCourses', 'allDashboards'],
        onSuccess: () => {
            router.push('/faculty/courses');
        },
        onError: (err: any) => {
            const detail = err?.response?.data?.detail;
            if (typeof detail === 'string') {
                setErrors({ submit: detail });
            } else if (Array.isArray(detail)) {
                const fieldErrors: Record<string, string> = {};
                detail.forEach((d: any) => {
                    const loc = d?.loc?.[1] ?? 'submit';
                    fieldErrors[loc] = d?.msg ?? 'Invalid';
                });
                setErrors(fieldErrors);
            } else {
                setErrors({ submit: err?.message ?? 'Failed to update course' });
            }
        },
    });

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!form.code.trim()) e.code = 'Course code is required';
        if (!form.name.trim()) e.name = 'Course name is required';
        if (!form.semester) e.semester = 'Semester is required';
        if (!form.year || form.year < 2000 || form.year > 2100) e.year = 'Valid year is required';

        const todayStr = today();
        if (form.start_date && form.start_date < todayStr && !isEdit) {
            e.start_date = 'Start date must be today or later';
        }
        if (form.start_date && form.end_date && form.end_date < form.start_date) {
            e.end_date = 'End date must be on or after start date';
        }

        const penalty = Number(form.default_late_penalty);
        if (isNaN(penalty) || penalty < 0 || penalty > 100) {
            e.default_late_penalty = 'Late penalty must be 0–100';
        }

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        setErrors({});
        if (isEdit) {
            updateMutation.mutate(form);
        } else {
            createMutation.mutate(form);
        }
    };

    const isPending = createMutation.isPending || updateMutation.isPending;

    const update = (key: keyof FormData, value: string | number | boolean) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        if (errors[key as string]) setErrors((prev) => ({ ...prev, [key]: '' }));

        if (key === 'start_date' && form.end_date && typeof value === 'string' && value && value > form.end_date) {
            setForm((prev) => ({ ...prev, end_date: '' }));
        }
    };

    const handleLatePenaltyChange = (v: string) => {
        const num = v === '' ? 0 : parseFloat(v);
        if (v === '' || (!isNaN(num) && num >= 0 && num <= 100)) {
            update('default_late_penalty', v === '' ? 0 : num);
        }
    };

    return (
        <div className="max-w-2xl mx-auto pb-12 px-4 sm:px-0">
            <div className="mb-6">
                <Link
                    href="/faculty/courses"
                    className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to courses
                </Link>
            </div>

            <h1 className="text-xl font-semibold text-gray-900 mb-1">
                {isEdit ? 'Edit Course' : 'New Course'}
            </h1>
            <p className="text-sm text-gray-500 mb-6">
                {isEdit
                    ? 'Update course details below.'
                    : 'Draft courses are hidden from students until you publish.'}
            </p>

            {errors.submit && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{errors.submit}</p>
                </div>
            )}

            {isEdit && !formLoaded && (
                <CourseLoadingPage message="Loading course..." />
            )}

            {formLoaded && (
                <form onSubmit={handleSubmit} className="space-y-6 animate-slide-up">
                    <Card className="border-0 shadow-md">
                        <CardContent className="p-4 sm:p-6 space-y-4">
                            {/* Visibility */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
                                <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="status"
                                            checked={form.status === 'draft'}
                                            onChange={() => update('status', 'draft')}
                                            className="w-4 h-4 text-[#862733] border-gray-300 focus:ring-[#862733]"
                                        />
                                        <span className="text-sm">Draft</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="status"
                                            checked={form.status === 'active'}
                                            onChange={() => update('status', 'active')}
                                            className="w-4 h-4 text-[#862733] border-gray-300 focus:ring-[#862733]"
                                        />
                                        <span className="text-sm">Publish</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="status"
                                            checked={form.status === 'archived'}
                                            onChange={() => update('status', 'archived')}
                                            className="w-4 h-4 text-[#862733] border-gray-300 focus:ring-[#862733]"
                                        />
                                        <span className="text-sm">Archive</span>
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Draft: only you see it. <br />
                                    Publish: visible to enrolled students.<br />
                                    Archive: past course.
                                </p>
                            </div>

                            {/* Code, Section, Name */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input
                                    label="Course Code"
                                    placeholder="CS101"
                                    value={form.code}
                                    onChange={(e) => update('code', e.target.value.toUpperCase())}
                                    error={errors.code}
                                />
                                <Input
                                    label="Section"
                                    placeholder="A"
                                    value={form.section}
                                    onChange={(e) => update('section', e.target.value)}
                                />
                            </div>

                            <Input
                                label="Course Name"
                                placeholder="Introduction to Programming"
                                value={form.name}
                                onChange={(e) => update('name', e.target.value)}
                                error={errors.name}
                            />

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                                <textarea
                                    className="w-full min-h-[80px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733] focus:border-transparent resize-y"
                                    placeholder="Optional"
                                    value={form.description}
                                    onChange={(e) => update('description', e.target.value)}
                                />
                            </div>

                            {/* Semester & Year */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Semester</label>
                                    <select
                                        className="w-full h-10 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733] focus:border-transparent"
                                        value={form.semester}
                                        onChange={(e) => update('semester', e.target.value)}
                                    >
                                        {SEMESTERS.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Year</label>
                                    <select
                                        className="w-full h-10 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733] focus:border-transparent"
                                        value={form.year}
                                        onChange={(e) => update('year', parseInt(e.target.value))}
                                    >
                                        {YEARS.map((y) => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Calendar
                                    label="Start Date"
                                    selectedDate={fromDateInput(form.start_date)}
                                    onDateChange={(date) => update('start_date', date ? toLocalDateInput(date) : '')}
                                    minDate={minStartDate}
                                    maxDate={form.end_date ? (fromDateInput(form.end_date) || undefined) : undefined}
                                    error={errors.start_date}
                                />
                                <Calendar
                                    label="End Date"
                                    selectedDate={fromDateInput(form.end_date)}
                                    onDateChange={(date) => update('end_date', date ? toLocalDateInput(date) : '')}
                                    minDate={minEndDate}
                                    error={errors.end_date}
                                />
                            </div>

                            {/* Late submission settings */}
                            <div className="pt-3 border-t border-gray-100 space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.allow_late_submissions}
                                        onChange={(e) => update('allow_late_submissions', e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Allow late submissions</span>
                                </label>
                                {form.allow_late_submissions && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                            Late penalty (% per day)
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            step={0.5}
                                            value={form.default_late_penalty}
                                            onChange={(e) => handleLatePenaltyChange(e.target.value)}
                                            className="w-full max-w-[120px] h-10 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#862733] focus:border-transparent"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">0–100. Default: 10% per day.</p>
                                        {errors.default_late_penalty && (
                                            <p className="text-sm text-red-500 mt-1">{errors.default_late_penalty}</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Color */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Card color</label>
                                <div className="flex gap-2 flex-wrap">
                                    {['#862733', '#1E40AF', '#065F46', '#7C2D12', '#581C87'].map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => update('color', c)}
                                            className={`w-8 h-8 rounded-full border-2 transition-colors ${form.color === c ? 'border-gray-900 ring-1 ring-gray-400' : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                        <Link href="/faculty/courses" className="sm:order-2">
                            <Button type="button" variant="outline" className="w-full sm:w-auto">
                                Cancel
                            </Button>
                        </Link>
                    <Button
                        type="submit"
                        disabled={isPending || (isEdit && !formLoaded)}
                        className="w-full sm:w-auto bg-[#862733] hover:bg-[#a03040] sm:order-1 transition-all duration-200"
                    >
                        {isPending ? (
                            <CourseLoadingSpinner size="sm" label={isEdit ? 'Saving...' : 'Creating...'} />
                        ) : (
                            isEdit ? 'Save' : 'Create Course'
                        )}
                    </Button>
                    </div>
                </form>
            )}
        </div>
    );
}
