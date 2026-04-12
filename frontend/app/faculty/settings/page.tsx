'use client';

import { SettingsPage } from '@/components/SettingsPage';

export default function FacultySettingsPage() {
    return <SettingsPage allowedRoles={['FACULTY']} />;
}
