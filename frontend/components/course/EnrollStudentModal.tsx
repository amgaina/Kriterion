'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CourseLoadingSpinner } from '@/components/course/CourseLoading';
import { UserPlus, Search } from 'lucide-react';

interface SystemStudent {
    id: number;
    email: string;
    full_name: string;
    student_id?: string | null;
}

export interface EnrollStudentModalProps {
    courseId: number;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (data: { enrolled?: boolean; student_not_found?: boolean; message?: string }) => void;
    onError?: (error: unknown) => void;
    courseInfo?: { code: string; name: string };
    invalidateKeys?: readonly (readonly unknown[])[];
    // IDs of students already enrolled, to exclude from the list
    enrolledStudentIds?: number[];
}

export function EnrollStudentModal({
    courseId,
    isOpen,
    onClose,
    onSuccess,
    onError,
    courseInfo,
    invalidateKeys = [],
    enrolledStudentIds = [],
}: EnrollStudentModalProps) {
    const [search, setSearch] = useState('');
    const [selectedEmail, setSelectedEmail] = useState('');
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!isOpen) {
            setSearch('');
            setSelectedEmail('');
        }
    }, [isOpen]);

    const { data: allStudents = [], isLoading: studentsLoading } = useQuery<SystemStudent[]>({
        queryKey: ['system-students'],
        queryFn: () => apiClient.getFacultyStudents() as Promise<SystemStudent[]>,
        enabled: isOpen,
        staleTime: 60_000,
    });

    const availableStudents = useMemo(() => {
        const enrolledSet = new Set(enrolledStudentIds);
        return allStudents.filter((s) => !enrolledSet.has(s.id));
    }, [allStudents, enrolledStudentIds]);

    const filteredStudents = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return availableStudents;
        return availableStudents.filter(
            (s) =>
                s.full_name.toLowerCase().includes(q) ||
                s.email.toLowerCase().includes(q) ||
                (s.student_id ?? '').toLowerCase().includes(q),
        );
    }, [availableStudents, search]);

    const enrollMutation = useMutation({
        mutationFn: (email: string) =>
            apiClient.enrollStudentByEmail(courseId, email) as Promise<{
                enrolled?: boolean;
                student_not_found?: boolean;
                message?: string;
            }>,
        onSuccess: (data) => {
            invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: [...key] }));
            onSuccess?.(data);
            onClose();
        },
        onError: (err) => onError?.(err),
    });

    const handleEnroll = () => {
        const email = selectedEmail.trim();
        if (!email || !email.includes('@')) return;
        enrollMutation.mutate(email);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Enroll Student" size="md">
            <div className="space-y-4">
                {courseInfo && (
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Course</p>
                        <p className="mt-0.5 font-semibold text-gray-900">
                            {courseInfo.code} – {courseInfo.name}
                        </p>
                    </div>
                )}

                {/* Search box */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Search students
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Name, email, or student ID..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setSelectedEmail('');
                            }}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Student list */}
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {studentsLoading ? (
                        <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
                            <CourseLoadingSpinner size="sm" label="Loading students..." />
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-400">
                            {availableStudents.length === 0
                                ? 'All system students are already enrolled.'
                                : 'No students match your search.'}
                        </div>
                    ) : (
                        <ul className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                            {filteredStudents.map((s) => {
                                const selected = selectedEmail === s.email;
                                return (
                                    <li key={s.id}>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedEmail(selected ? '' : s.email)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                                selected
                                                    ? 'bg-[#862733]/8 border-l-2 border-[#862733]'
                                                    : 'hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                                                selected ? 'bg-[#862733] text-white' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {s.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-900 truncate">{s.full_name}</p>
                                                <p className="text-xs text-gray-500 truncate">{s.email}</p>
                                            </div>
                                            {s.student_id && (
                                                <span className="text-xs text-gray-400 font-mono flex-shrink-0">{s.student_id}</span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {selectedEmail && (
                    <p className="text-xs text-gray-500">
                        Selected: <span className="font-medium text-gray-700">{selectedEmail}</span>
                    </p>
                )}

                <div className="flex justify-end gap-3 pt-1">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleEnroll}
                        disabled={!selectedEmail || enrollMutation.isPending}
                        className="bg-[#862733] hover:bg-[#a03040] text-white"
                    >
                        {enrollMutation.isPending ? (
                            <CourseLoadingSpinner size="sm" label="Enrolling..." />
                        ) : (
                            <>
                                <UserPlus className="w-4 h-4 mr-2" />
                                Enroll Student
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
