import type { BadgeProps } from '@/components/ui/badge';

export function getScoreBadgeVariant(
    percent: number,
    thresholds: { success?: number; warning?: number } = {},
): NonNullable<BadgeProps['variant']> {
    const success = thresholds.success ?? 80;
    const warning = thresholds.warning ?? 60;

    if (percent >= success) return 'success';
    if (percent >= warning) return 'warning';
    return 'danger';
}

export function getScoreTextColor(percent: number): string {
    if (percent >= 90) return 'text-green-600';
    if (percent >= 80) return 'text-blue-600';
    if (percent >= 70) return 'text-amber-600';
    if (percent >= 60) return 'text-orange-600';
    return 'text-red-600';
}

export function getScoreBgColor(percent: number): string {
    if (percent >= 90) return 'bg-green-50';
    if (percent >= 80) return 'bg-blue-50';
    if (percent >= 70) return 'bg-amber-50';
    if (percent >= 60) return 'bg-orange-50';
    return 'bg-red-50';
}