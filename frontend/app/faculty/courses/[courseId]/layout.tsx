'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { LayoutDashboard, FileText, Users, UserCog } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CourseLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const courseId = params?.courseId as string;
    const pathname = usePathname();

    const isGradingPage = pathname?.includes('/grade/') === true;
    if (isGradingPage) {
        return <>{children}</>;
    }

    const navItems = [
        { label: 'Overview', href: `/faculty/courses/${courseId}`, icon: LayoutDashboard },
        { label: 'Assignments', href: `/faculty/courses/${courseId}/assignments`, icon: FileText },
        { label: 'Students', href: `/faculty/courses/${courseId}/students`, icon: Users },
        { label: 'Assistants', href: `/faculty/courses/${courseId}/assistants`, icon: UserCog },
    ];

    const isActive = (href: string) => {
        if (href === `/faculty/courses/${courseId}`) {
            return pathname === href || pathname === `/faculty/courses/${courseId}/`;
        }
        return pathname.startsWith(href);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-center overflow-x-auto py-1">
                <nav className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-gray-100/80 border border-gray-200/80 shadow-sm min-w-0">
                    {navItems.map((item) => {
                        const active = isActive(item.href);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="relative block active:scale-[0.98] transition-transform"
                            >
                                <span
                                    className={`
                                        relative z-10 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                                        transition-all duration-200 ease-out
                                        ${active
                                            ? 'text-white'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                                        }
                                    `}
                                >
                                    <Icon className="w-4 h-4 flex-shrink-0" />
                                    {item.label}
                                </span>
                                <AnimatePresence>
                                    {active && (
                                        <motion.span
                                            layoutId="course-tab"
                                            className="absolute inset-0 z-0 rounded-xl bg-[#862733] shadow-md"
                                            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                            initial={false}
                                        />
                                    )}
                                </AnimatePresence>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="w-full">{children}</div>
        </div>
    );
}
