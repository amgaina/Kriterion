'use client';

import { SettingsPage } from '@/components/SettingsPage';

export default function AssistantSettingsPage() {
    return <SettingsPage allowedRoles={['ASSISTANT']} />;
}
