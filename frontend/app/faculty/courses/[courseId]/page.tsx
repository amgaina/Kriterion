"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import apiClient from '@/lib/api-client';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Course {
    id: number;
    code: string;
    name: string;
    description?: string | null;
    semester: string;
    year: number;
    status: string;
    is_active: boolean;
    created_at: string;
}

export default function CourseOverviewPage() {
    const params = useParams();
    const courseId = Number(params?.courseId);
    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                const data = await apiClient.getCourse(courseId);
                setCourse(data);
            } catch (e: any) {
                setError(e?.response?.data?.detail || e?.message || 'Failed to load course');
            } finally {
                setLoading(false);
            }
        }
        if (courseId) load();
    }, [courseId]);

    if (loading) return <p>Loading...</p>;
    if (error) return <p className="text-red-600">{error}</p>;
    if (!course) return <p>Course not found.</p>;

    return (
        <ProtectedRoute allowedRoles={["FACULTY"]}>
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-semibold">{course.code} — {course.name}</h2>
                    <p className="text-gray-600">{course.semester} {course.year}</p>
                </div>
                {course.description && (
                    <div className="prose">
                        <p>{course.description}</p>
                    </div>
                )}
                <div className="flex gap-3">
                    <Link href={`/faculty/courses/${courseId}/assignments`} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">View Assignments</Link>
                    <Link href={`/faculty/courses/${courseId}/assignments/new`} className="px-3 py-2 border rounded">Add Assignment</Link>
                </div>
            </div>
        </ProtectedRoute>
    );
}
