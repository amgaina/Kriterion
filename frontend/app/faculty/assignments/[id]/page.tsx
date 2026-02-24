'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function FacultyAssignmentRedirect() {
    const params = useParams();
    const router = useRouter();
    const id = params.id;

    useEffect(() => {
        if (id) {
            // Redirect to the student assignment detail route which contains the full UI
            router.replace(`/student/assignments/${id}`);
        }
    }, [id, router]);

    return (
        <div className="flex items-center justify-center h-72">
            <p className="text-gray-600">Redirecting to assignment details...</p>
        </div>
    );
}
