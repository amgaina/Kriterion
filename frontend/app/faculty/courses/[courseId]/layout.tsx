import React from 'react';
import Link from 'next/link';

export default function CourseLayout({ children, params }: { children: React.ReactNode, params: { courseId: string } }) {
    const { courseId } = params;
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Course #{courseId}</h1>
            </div>
            <nav className="border-b mb-4">
                <ul className="flex space-x-4">
                    <li>
                        <Link className="hover:underline" href={`/faculty/courses/${courseId}`}>Overview</Link>
                    </li>
                    <li>
                        <Link className="hover:underline" href={`/faculty/courses/${courseId}/assignments`}>Assignments</Link>
                    </li>
                    <li>
                        <Link className="hover:underline" href={`/faculty/courses/${courseId}/students`}>Students</Link>
                    </li>
                </ul>
            </nav>
            <div>{children}</div>
        </div>
    );
}
