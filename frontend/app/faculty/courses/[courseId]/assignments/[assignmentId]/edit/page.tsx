'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { AssignmentUpsertPage } from '../../new/page';

export default function EditAssignmentPage() {
    const params = useParams();
    const assignmentParam = params?.assignmentId as string | string[] | undefined;
    const assignmentIdStr = Array.isArray(assignmentParam) ? (assignmentParam[0] ?? '') : (assignmentParam ?? '');
    const assignmentId = useMemo(() => parseInt(assignmentIdStr, 10), [assignmentIdStr]);

    return <AssignmentUpsertPage mode="edit" assignmentId={assignmentId} />;
}

