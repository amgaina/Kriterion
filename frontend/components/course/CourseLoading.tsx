'use client';

/**
 * Reusable loading components for the faculty course section.
 * Use across courses list, new/edit form, and modals.
 */

import { cn } from '@/lib/utils';

export interface CourseLoadingSkeletonProps {
    /** Number of skeleton cards to show (default 3) */
    count?: number;
    className?: string;
}

/** Skeleton loader for course cards grid */
export function CourseLoadingSkeleton({ count = 3, className }: CourseLoadingSkeletonProps) {
    return (
        <div className={cn('grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6', className)}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-gray-100 shadow-sm animate-pulse">
                    <div className="h-36 bg-gradient-to-br from-gray-100 to-gray-200" />
                    <div className="p-4 space-y-3">
                        <div className="h-5 bg-gray-200 rounded w-3/4" />
                        <div className="h-4 bg-gray-200 rounded w-1/2" />
                        <div className="h-4 bg-gray-200 rounded w-full" />
                        <div className="flex gap-2 pt-3">
                            <div className="h-8 bg-gray-200 rounded flex-1" />
                            <div className="h-8 bg-gray-200 rounded flex-1" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export interface CourseLoadingSpinnerProps {
    /** Size: sm (button), md (inline), lg (page) */
    size?: 'sm' | 'md' | 'lg';
    /** Optional label beside spinner */
    label?: string;
    className?: string;
}

/** Spinner for buttons and inline loading states */
export function CourseLoadingSpinner({ size = 'md', label, className }: CourseLoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'w-4 h-4 border-2',
        md: 'w-6 h-6 border-2',
        lg: 'w-10 h-10 border-[3px]',
    };
    return (
        <span className={cn('inline-flex items-center gap-2', className)}>
            <span
                className={cn(
                    'rounded-full border-[#862733]/30 border-t-[#862733] animate-spin',
                    sizeClasses[size]
                )}
            />
            {label && (
                <span className="text-sm font-medium text-gray-600">{label}</span>
            )}
        </span>
    );
}

export interface CourseLoadingPageProps {
    /** Message to show (default "Loading..." ) */
    message?: string;
    className?: string;
}

/** Full-page or section loading state */
export function CourseLoadingPage({ message = 'Loading...', className }: CourseLoadingPageProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center py-16 gap-4',
                className
            )}
        >
            <CourseLoadingSpinner size="lg" />
            <p className="text-sm text-gray-500">{message}</p>
        </div>
    );
}
