'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/ui/use-toast';

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Shorter stale time - data is fresh for 30 seconds
                        staleTime: 30 * 1000,
                        // Cache persists for 5 minutes
                        gcTime: 5 * 60 * 1000,
                        // Refetch when component mounts if data is stale
                        refetchOnMount: true,
                        // Refetch when window regains focus
                        refetchOnWindowFocus: true,
                        // Don't retry failed requests too aggressively
                        retry: 1,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <ToastProvider>
                    {children}
                </ToastProvider>
            </AuthProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}
