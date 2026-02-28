'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CourseLoadingSpinner } from '@/components/course/CourseLoading';
import { UserPlus } from 'lucide-react';

export interface EnrollStudentModalProps {
    courseId: number;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (data: { enrolled?: boolean; student_not_found?: boolean; message?: string }) => void;
    onError?: (error: unknown) => void;
    courseInfo?: { code: string; name: string };
    invalidateKeys?: readonly (readonly unknown[])[];
}

export function EnrollStudentModal({
    courseId,
    isOpen,
    onClose,
    onSuccess,
    onError,
    courseInfo,
    invalidateKeys = [],
}: EnrollStudentModalProps) {
    const [email, setEmail] = useState('');
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!isOpen) setEmail('');
    }, [isOpen]);

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

    const handleSubmit = () => {
        const trimmed = email.trim();
        if (!trimmed || !trimmed.includes('@')) return;
        enrollMutation.mutate(trimmed);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Enroll Student" size="md">
            <div className="space-y-4">
                {courseInfo && (
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Course</p>
                        <p className="mt-0.5 font-semibold text-gray-900">
                            {courseInfo.code} – {courseInfo.name}
                        </p>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Student Email</label>
                    <Input
                        type="email"
                        placeholder="student@example.edu"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    />
                    <p className="text-xs text-gray-500 mt-1.5">
                        Student must exist in the system. If not, a request will be sent to the admin.
                    </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!email.trim() || !email.includes('@') || enrollMutation.isPending}
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
