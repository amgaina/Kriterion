'use client';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    message?: string;
    fullScreen?: boolean;
}

const sizeClasses = {
    sm: 'h-6 w-6 border-2',
    md: 'h-12 w-12 border-4',
    lg: 'h-16 w-16 border-4',
};

export function LoadingSpinner({ 
    size = 'md', 
    message = 'Loading...', 
    fullScreen = true 
}: LoadingSpinnerProps) {
    const content = (
        <div className="text-center">
            <div 
                className={`inline-block animate-spin rounded-full border-[#862733] border-t-transparent ${sizeClasses[size]}`}
            />
            {message && (
                <p className="mt-4 text-sm text-gray-600">{message}</p>
            )}
        </div>
    );

    if (fullScreen) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                {content}
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center py-12">
            {content}
        </div>
    );
}

export default LoadingSpinner;
