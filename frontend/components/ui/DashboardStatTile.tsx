import type { ElementType } from 'react';

type DashboardStatTileProps = {
    label: string;
    value?: number | string;
    icon: ElementType;
    loading: boolean;
    color: string;
    bg: string;
    highlight?: boolean;
    sub?: string;
};

export function DashboardStatTile({
    label,
    value,
    icon: Icon,
    loading,
    color,
    bg,
    highlight,
    sub,
}: DashboardStatTileProps) {
    return (
        <div className={`rounded-xl border px-3.5 py-3 ${highlight ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100 bg-white'}`}>
            <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
            </div>
            <p className={`text-xl font-bold ${highlight ? 'text-amber-700' : 'text-gray-900'}`}>
                {loading ? <span className="inline-block w-6 h-6 bg-gray-100 rounded animate-pulse" /> : (value ?? 0)}
            </p>
            {sub ? <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p> : null}
        </div>
    );
}