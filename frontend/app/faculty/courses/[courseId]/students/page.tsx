"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import apiClient from '@/lib/api-client';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Student {
    id: number;
    email: string;
    full_name: string;
    student_id?: string | null;
    enrolled_at?: string;
    status?: string;
}

export default function CourseStudentsPage() {
    const params = useParams();
    const courseId = Number(params?.courseId);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                const data = await apiClient.getCourseStudents(courseId);
                setStudents(data || []);
            } catch (e: any) {
                setError(e?.response?.data?.detail || e?.message || 'Failed to load students');
            } finally {
                setLoading(false);
            }
        }
        if (courseId) load();
    }, [courseId]);

    return (
        <ProtectedRoute allowedRoles={["FACULTY"]}>
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Enrolled Students</h2>
                {loading && <p>Loading...</p>}
                {error && <p className="text-red-600">{error}</p>}
                {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-4 py-2 text-left">Name</th>
                                    <th className="px-4 py-2 text-left">Email</th>
                                    <th className="px-4 py-2 text-left">Student ID</th>
                                    <th className="px-4 py-2 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s) => (
                                    <tr key={s.id} className="border-t">
                                        <td className="px-4 py-2">{s.full_name}</td>
                                        <td className="px-4 py-2">{s.email}</td>
                                        <td className="px-4 py-2">{s.student_id || '-'}</td>
                                        <td className="px-4 py-2">{s.status || '-'}</td>
                                    </tr>
                                ))}
                                {students.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-6 text-center text-gray-500">No students enrolled.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}
