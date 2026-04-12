import { Badge } from '@/components/ui/badge';

type AssignmentAttentionBadgesProps = {
    ungradedCount?: number;
    missingCount?: number;
    notSubmittedCount?: number;
    compact?: boolean;
    className?: string;
};

export function AssignmentAttentionBadges({
    ungradedCount = 0,
    missingCount = 0,
    notSubmittedCount = 0,
    compact = false,
    className = '',
}: AssignmentAttentionBadgesProps) {
    const rowClass = compact ? 'gap-1.5 text-[11px]' : 'gap-2';
    const missingLabel = compact ? 'missing' : 'missing submissions';

    return (
        <div className={`flex flex-wrap items-center ${rowClass} ${className}`.trim()}>
            <Badge variant="warning">{ungradedCount} needs grading</Badge>
            <Badge variant="destructive">{missingCount} {missingLabel}</Badge>
            {notSubmittedCount > 0 ? <Badge variant="outline">{notSubmittedCount} not submitted</Badge> : null}
        </div>
    );
}