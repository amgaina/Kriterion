'use client';

import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

export type AcknowledgementType = 'success' | 'error' | 'warning';

interface AcknowledgementPopupProps {
    isOpen: boolean;
    onClose: () => void;
    type: AcknowledgementType;
    title?: string;
    message: string;
    description?: string;
    acknowledgeLabel?: string;
}

export function AcknowledgementPopup({
    isOpen,
    onClose,
    type,
    title,
    message,
    description = 'Please review the message below and acknowledge to continue.',
    acknowledgeLabel = 'Acknowledge',
}: AcknowledgementPopupProps) {
    const resolvedTitle = title || (type === 'success' ? 'Success' : type === 'warning' ? 'Warning' : 'Error');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={resolvedTitle}
            description={description}
            size="md"
        >
            <div className="space-y-4">
                <div
                    className={`rounded-lg border p-4 flex items-start gap-3 ${
                        type === 'success'
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : type === 'warning'
                                ? 'bg-amber-50 border-amber-200 text-amber-900'
                                : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                >
                    {type === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : type === 'warning' ? (
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm leading-relaxed">{message}</p>
                </div>

                <div className="flex justify-end pt-2 border-t border-gray-100">
                    <Button
                        onClick={onClose}
                        className="bg-[#862733] hover:bg-[#a03040] text-white"
                    >
                        {acknowledgeLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
