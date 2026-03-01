'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redirect /assistant/grading to dashboard.
 * Grading is now accessed via: Dashboard → My Courses → Course → Assignment → Grade.
 */
export default function AssistantGradingRedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/assistant/dashboard');
    }, [router]);
    return (
        <div className="flex items-center justify-center min-h-[200px]">
            <p className="text-gray-500">Redirecting to dashboard...</p>
        </div>
    );
}
