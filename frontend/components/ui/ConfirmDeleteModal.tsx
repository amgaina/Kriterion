'use client';

import React, { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Trash2 } from 'lucide-react';

export interface ConfirmDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    confirmationPhrase: string;
    itemName?: string;
    title?: string;
    description?: string;
    confirmLabel?: string;
    confirmHint?: string;
    loadingLabel?: string;
    isLoading?: boolean;
    variant?: 'danger' | 'warning';
}

/**
 * Reusable confirmation modal that requires the user to type an exact phrase to enable delete.
 * Use for destructive actions (delete assignment, delete course, etc).
 */
export function ConfirmDeleteModal({
    isOpen,
    onClose,
    onConfirm,
    confirmationPhrase,
    itemName,
    title = 'Are you sure?',
    description,
    confirmLabel = 'Delete',
    confirmHint,
    loadingLabel = 'Deleting...',
    isLoading = false,
    variant = 'danger',
}: ConfirmDeleteModalProps) {
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        if (isOpen) setInputValue('');
    }, [isOpen]);

    const matches = inputValue.trim() === confirmationPhrase;
    const canConfirm = matches && !isLoading;

    const handleConfirm = () => {
        if (!canConfirm) return;
        onConfirm();
    };

    const defaultDescription = itemName
        ? `Are you sure you want to delete "${itemName}"? This action cannot be undone. Type "${confirmationPhrase}" to confirm.`
        : `This action cannot be undone. Type "${confirmationPhrase}" to confirm.`;

    const defaultHint = `Type ${confirmationPhrase} below to confirm.`;
    const hint = confirmHint ?? defaultHint;

    const isWarning = variant === 'warning';
    const bgClass = isWarning ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
    const iconBgClass = isWarning ? 'bg-amber-100' : 'bg-red-100';
    const iconClass = isWarning ? 'text-amber-600' : 'text-red-600';
    const textClass = isWarning ? 'text-amber-900' : 'text-red-900';
    const textMutedClass = isWarning ? 'text-amber-700' : 'text-red-700';
    const btnClass = isWarning
        ? 'bg-amber-600 hover:bg-amber-700 text-white'
        : 'bg-red-600 hover:bg-red-700 text-white';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            description={description ?? defaultDescription}
            size="md"
        >
            <div className="space-y-4">
                <div className={`rounded-xl border p-4 flex items-start gap-4 ${bgClass}`}>
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${iconBgClass}`}>
                        <AlertTriangle className={`w-5 h-5 ${iconClass}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${textClass}`}>Type to confirm</p>
                        <p className={`mt-0.5 text-xs ${textMutedClass}`}>
                            {hint}
                        </p>
                    </div>
                </div>

                <div>
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={confirmationPhrase}
                        className="font-mono"
                        autoComplete="off"
                        autoFocus
                        disabled={isLoading}
                        aria-label={`Type ${confirmationPhrase} to confirm`}
                    />
                </div>

                <ModalFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                        className="border-gray-300"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!canConfirm}
                        className={`${btnClass} gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {isLoading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                {loadingLabel}
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-4 h-4" />
                                {confirmLabel}
                            </>
                        )}
                    </Button>
                </ModalFooter>
            </div>
        </Modal>
    );
}
