'use client';

import { SettingsPage } from '@/components/SettingsPage';

export default function StudentSettingsPage() {
    return <SettingsPage allowedRoles={['STUDENT']} />;
}
