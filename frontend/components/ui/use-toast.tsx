'use client'

import * as React from 'react'

type ToastActionElement = React.ReactElement<any>

export interface Toast {
    id: string
    title?: string
    description?: string
    action?: ToastActionElement
    variant?: 'default' | 'destructive'
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

    const toast = React.useCallback((props: Omit<Toast, 'id'>) => {
        const id = `toast-${++toastCount}`
        const newToast: Toast = { ...props, id }
        
        setToasts((prev) => [...prev, newToast])

        // Auto dismiss after 5 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id))
        }, 5000)
    }, [])

    const dismiss = React.useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ toasts, toast, dismiss }}>
            {children}
            <ToastContainer toasts={toasts} dismiss={dismiss} />
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

function ToastContainer({ toasts, dismiss }: { toasts: Toast[], dismiss: (id: string) => void }) {
    if (toasts.length === 0) return null

    return (
        <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px] gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all ${
                        toast.variant === 'destructive'
                            ? 'border-destructive bg-destructive text-destructive-foreground'
                            : 'border bg-background text-foreground'
                    } animate-in slide-in-from-bottom-full`}
                >
                    <div className="grid gap-1">
                        {toast.title && (
                            <div className="text-sm font-semibold">{toast.title}</div>
                        )}
                        {toast.description && (
                            <div className="text-sm opacity-90">{toast.description}</div>
                        )}
                    </div>
                    {toast.action}
                    <button
                        onClick={() => dismiss(toast.id)}
                        className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        <span className="sr-only">Close</span>
                    </button>
                </div>
            ))}
        </div>
    )
}
