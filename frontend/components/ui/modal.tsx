'use client';

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    description?: string
    children: React.ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw]'
}

export function Modal({
    isOpen,
    onClose,
    title,
    description,
    children,
    size = 'md'
}: ModalProps) {
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            document.body.style.overflow = 'hidden'
        }

        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, onClose])

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={onClose}
                        aria-hidden="true"
                    />
                    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden p-4">
                        <div className="flex min-h-full items-center justify-center">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                                className={cn(
                                    "relative w-full bg-white rounded-xl shadow-2xl",
                                    sizeClasses[size]
                                )}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {(title || description) && (
                                    <div className="px-6 py-4 border-b border-gray-100">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0">
                                                {title && (
                                                    <h2 className="text-lg font-semibold text-gray-900">
                                                        {title}
                                                    </h2>
                                                )}
                                                {description && (
                                                    <p className="mt-0.5 text-sm text-gray-500">
                                                        {description}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={onClose}
                                                className="shrink-0 p-2 -m-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                                aria-label="Close"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="px-6 py-5">
                                    {children}
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    )
}

interface ModalFooterProps {
    children: React.ReactNode
    className?: string
}

export function ModalFooter({ children, className }: ModalFooterProps) {
    return (
        <div className={cn("flex items-center justify-end gap-3 pt-4 border-t border-gray-200 mt-4", className)}>
            {children}
        </div>
    )
}
