'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { parseEmailsFromFile } from '@/lib/parse-emails';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { CourseLoadingSpinner } from '@/components/course/CourseLoading';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';

export interface BulkEnrollResult {
    enrolled: number;
    failed?: number;
    not_found?: string[];
    already_enrolled?: string[];
}

export interface BulkEnrollModalProps {
    courseId: number;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (data: BulkEnrollResult) => void;
    onError?: (error: unknown) => void;
    /** Optional - when provided, shows course context in the modal */
    courseInfo?: { code: string; name: string };
    /** Query keys to invalidate on success */
    invalidateKeys?: readonly (readonly unknown[])[];
}

export function BulkEnrollModal({
    courseId,
    isOpen,
    onClose,
    onSuccess,
    onError,
    courseInfo,
    invalidateKeys = [],
}: BulkEnrollModalProps) {
    const [bulkEmails, setBulkEmails] = useState('');
    const [bulkFile, setBulkFile] = useState<File | null>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!isOpen) {
            setBulkEmails('');
            setBulkFile(null);
        }
    }, [isOpen]);

    const bulkEnrollMutation = useMutation({
        mutationFn: (emails: string[]) => apiClient.bulkEnrollStudents(courseId, emails),
        onSuccess: (data: BulkEnrollResult) => {
            invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: [...key] }));
            onSuccess?.(data);
            onClose();
        },
        onError: (err) => {
            onError?.(err);
        },
    });

    const handleBulkEnroll = async () => {
        let emails: string[];
        if (bulkFile) {
            emails = await parseEmailsFromFile(bulkFile);
        } else {
            emails = bulkEmails
                .split(/[\n,;]+/)
                .map((e) => e.trim().toLowerCase())
                .filter((e) => e && e.includes('@'));
        }
        const unique = [...new Set(emails)];
        if (unique.length > 0) {
            bulkEnrollMutation.mutate(unique);
        }
    };

    const pasteEmailCount = bulkEmails.split(/[\n,;]+/).filter((e) => e.trim() && e.includes('@')).length;
    const hasEmails = bulkEmails.trim().length > 0 || bulkFile !== null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                setBulkEmails('');
                setBulkFile(null);
                onClose();
            }}
            title="Bulk Enroll Students"
            size="lg"
        >
            <div className="space-y-5">
                {courseInfo && (
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Course</p>
                        <p className="mt-0.5 font-semibold text-gray-900">
                            {courseInfo.code} – {courseInfo.name}
                        </p>
                    </div>
                )}

                {/* Template download */}
                <div className="flex flex-wrap items-center gap-3">
                    <a
                        href="/Bulk Enroll.xlsx"
                        download="Bulk Enroll.xlsx"
                        className="inline-flex items-center gap-2 text-sm text-[#862733] hover:underline"
                    >
                        <Download className="w-4 h-4" />
                        Excel template
                    </a>
                    <a
                        href="/bulk-enroll-template.csv"
                        download="bulk-enroll-template.csv"
                        className="inline-flex items-center gap-2 text-sm text-[#862733] hover:underline"
                    >
                        <Download className="w-4 h-4" />
                        CSV template
                    </a>
                    <span className="text-xs text-gray-500">Column A header: &quot;student email&quot;</span>
                </div>

                {/* File upload */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Upload Excel or CSV</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv,.txt"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                setBulkFile(f || null);
                                if (f) setBulkEmails('');
                            }}
                            className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                        />
                        {bulkFile && (
                            <span className="text-sm text-gray-600 truncate max-w-[180px]" title={bulkFile.name}>
                                {bulkFile.name}
                            </span>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Or paste emails</label>
                    <textarea
                        rows={6}
                        placeholder="student1@example.edu&#10;student2@example.edu"
                        value={bulkEmails}
                        onChange={(e) => {
                            setBulkEmails(e.target.value);
                            if (bulkFile) setBulkFile(null);
                        }}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#862733] focus:border-transparent font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">
                        Separate by new lines, commas, or semicolons. Students not in system will be skipped.
                    </p>
                </div>

                {/* Email counter */}
                {!bulkFile ? (
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2">
                        {pasteEmailCount > 0 ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                            <AlertCircle className="w-4 h-4 text-gray-400" />
                        )}
                        <p className="text-sm font-medium text-gray-700">
                            {pasteEmailCount} valid email{pasteEmailCount !== 1 ? 's' : ''} detected
                        </p>
                    </div>
                ) : (
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-[#862733]" />
                        <p className="text-sm font-medium text-gray-700">File ready: {bulkFile.name}</p>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                    <Button
                        variant="outline"
                        onClick={() => {
                            setBulkEmails('');
                            setBulkFile(null);
                            onClose();
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleBulkEnroll}
                        disabled={bulkEnrollMutation.isPending || !hasEmails}
                        className="bg-[#862733] hover:bg-[#a03040] text-white"
                    >
                        {bulkEnrollMutation.isPending ? (
                            <CourseLoadingSpinner size="sm" label="Enrolling..." />
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                Bulk Enroll
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
