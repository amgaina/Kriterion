'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationItem {
    id: number;
    type: string;
    title: string;
    message: string;
    link?: string | null;
    course_id?: number | null;
    assignment_id?: number | null;
    submission_id?: number | null;
    is_read: boolean;
    created_at: string;
}

function timeAgo(iso: string): string {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const seconds = Math.max(1, Math.floor((now - then) / 1000));

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export function NotificationsBell() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const roleLower = (user?.role || '').toLowerCase();

    const notificationsQuery = useQuery({
        queryKey: ['notifications', user?.id],
        queryFn: () => apiClient.getNotifications(0, 30),
        enabled: !!user,
        refetchInterval: 45000,
    });

    const notifications = (notificationsQuery.data || []) as NotificationItem[];
    const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

    const markReadMutation = useMutation({
        mutationFn: (notificationId: number) => apiClient.markNotificationAsRead(notificationId, true),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
        },
    });

    const markAllReadMutation = useMutation({
        mutationFn: () => apiClient.markAllNotificationsAsRead(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
        },
    });

    React.useEffect(() => {
        const onClickOutside = (event: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        if (open) {
            document.addEventListener('mousedown', onClickOutside);
        }

        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [open]);

    const getNotificationHref = (n: NotificationItem): string | null => {
        if (n.link) return n.link;

        if (roleLower === 'student') {
            if (n.assignment_id) return `/student/assignments/${n.assignment_id}`;
            if (n.course_id) return `/student/courses/${n.course_id}`;
            return null;
        }

        if (roleLower === 'faculty') {
            if (n.course_id && n.assignment_id) return `/faculty/courses/${n.course_id}/assignments/${n.assignment_id}`;
            if (n.course_id) return `/faculty/courses/${n.course_id}`;
            if (n.submission_id) return `/faculty/submissions/${n.submission_id}`;
            return null;
        }

        if (roleLower === 'assistant') {
            if (n.submission_id) return `/assistant/submissions/${n.submission_id}`;
            if (n.course_id) return `/assistant/courses`;
            return null;
        }

        if (roleLower === 'admin') {
            if (n.course_id) return `/admin/courses`;
            if (n.assignment_id) return `/admin/courses`;
            return `/admin/dashboard`;
        }

        return null;
    };

    const handleNotificationClick = async (n: NotificationItem) => {
        if (!n.is_read) {
            await markReadMutation.mutateAsync(n.id);
        }
        const href = getNotificationHref(n);
        setOpen(false);
        if (href) router.push(href);
    };

    return (
        <div className="relative" ref={panelRef}>
            <button
                onClick={() => setOpen((prev) => !prev)}
                className="relative rounded-full p-1.5 sm:p-2 text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Notifications"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <>
                        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
                        <span className="absolute -right-1 -top-1 min-w-[16px] h-4 px-1 rounded-full bg-[#862733] text-white text-[10px] flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-1rem)] rounded-lg border border-gray-200 bg-white shadow-lg z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">Notifications</p>
                        <button
                            onClick={() => markAllReadMutation.mutate()}
                            disabled={unreadCount === 0 || markAllReadMutation.isPending}
                            className="text-xs text-[#862733] font-medium disabled:text-gray-400"
                        >
                            Mark all read
                        </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {notificationsQuery.isLoading ? (
                            <p className="px-4 py-6 text-sm text-gray-500 text-center">Loading notifications...</p>
                        ) : notifications.length === 0 ? (
                            <p className="px-4 py-6 text-sm text-gray-500 text-center">No notifications yet.</p>
                        ) : (
                            notifications.map((n) => (
                                <button
                                    key={n.id}
                                    onClick={() => handleNotificationClick(n)}
                                    className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${n.is_read ? 'bg-white' : 'bg-[#862733]/5'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <p className="text-sm font-semibold text-gray-900 line-clamp-1">{n.title}</p>
                                        <span className="text-[11px] text-gray-500 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{n.message}</p>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}