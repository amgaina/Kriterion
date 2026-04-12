import { Badge } from '@/components/ui/badge';
import { getScoreBadgeVariant } from '@/lib/score-utils';

type ScoreBadgeProps = {
    percent: number;
    children: React.ReactNode;
    successThreshold?: number;
    warningThreshold?: number;
};

export function ScoreBadge({
    percent,
    children,
    successThreshold,
    warningThreshold,
}: ScoreBadgeProps) {
    return (
        <Badge
            variant={getScoreBadgeVariant(percent, {
                success: successThreshold,
                warning: warningThreshold,
            })}
        >
            {children}
        </Badge>
    );
}