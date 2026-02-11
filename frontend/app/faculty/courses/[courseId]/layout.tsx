import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function CourseLayout({ children, params }: { children: React.ReactNode, params: { courseId: string } }) {
    const { courseId } = params;
    
    const navItems = [
        { label: 'Overview', href: `/faculty/courses/${courseId}` },
        { label: 'Assignments', href: `/faculty/courses/${courseId}/assignments` },
        { label: 'Students', href: `/faculty/courses/${courseId}/students` },
    ];

    return (
        <div>
            {/* Navigation Tabs */}
            <nav className="border-b border-gray-200 mb-6">
                <div className="flex items-center space-x-1 overflow-x-auto">
                    {navItems.map((item, idx) => (
                        <React.Fragment key={item.href}>
                            <Link 
                                href={item.href}
                                className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 border-b-2 border-transparent hover:border-gray-300 transition-colors whitespace-nowrap"
                            >
                                {item.label}
                            </Link>
                            {idx < navItems.length - 1 && (
                                <div className="text-gray-300">|</div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </nav>

            {/* Page Content */}
            <div>{children}</div>
        </div>
    );
}
