'use client'

import * as React from 'react'
import { AcknowledgementPopup, AcknowledgementType } from '@/components/ui/acknowledgement-popup'

type ToastActionElement = React.ReactElement<any>

export interface Toast {
    id: string
    title?: string
    description?: string
    action?: ToastActionElement
    variant?: 'default' | 'destructive'
    silent?: boolean // When true, skip showing AcknowledgementPopup
}

interface ToastContextType {
    toasts: Toast[]
    toast: (props: Omit<Toast, 'id'>) => void
    dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

let toastCount = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([])
    // Filter out silent toasts when looking for active toast to show popup
    const activeToast = toasts.find(t => !t.silent)

    const mapVariantToType = React.useCallback((variant?: Toast['variant']): AcknowledgementType => {
        if (variant === 'destructive') return 'error'
        return 'success'
    }, [])

    const toast = React.useCallback((props: Omit<Toast, 'id'>) => {
        const id = `toast-${++toastCount}`
        const newToast: Toast = { ...props, id }

        setToasts((prev) => [...prev, newToast])

        // Auto-dismiss silent toasts after a short delay
        if (props.silent) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id))
            }, 100)
        }
    }, [])

    const dismiss = React.useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ toasts, toast, dismiss }}>
            {children}
            {activeToast && (
                <AcknowledgementPopup
                    isOpen={true}
                    onClose={() => dismiss(activeToast.id)}
                    type={mapVariantToType(activeToast.variant)}
                    title={activeToast.title}
                    message={activeToast.description || activeToast.title || 'Notification'}
                />
            )}
        </ToastContext.Provider>
    )
}

export function useToast() {
    const context = React.useContext(ToastContext)
    if (!context) {
        // Return a no-op function if not within provider
        // This prevents errors during development
        return {
            toast: (props: Omit<Toast, 'id'>) => console.warn('Toast called outside of ToastProvider', props),
            dismiss: (id: string) => {},
            toasts: []
        }
    }
    return context
}
