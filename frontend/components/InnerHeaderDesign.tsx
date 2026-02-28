'use client';

export interface InnerHeaderDesignProps {
    /** Main heading text */
    title: string;
    /** Optional subtitle — string or React node */
    subtitle?: React.ReactNode;
    /** Optional actions (e.g. buttons) to show on the right */
    actions?: React.ReactNode;
}

export function InnerHeaderDesign({ title, subtitle, actions }: InnerHeaderDesignProps) {
    return (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary to-primary-700 px-5 py-5 text-white">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-white/5 rounded-full" />
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
                    {subtitle != null && (
                        <p className="text-white/80 mt-1">{subtitle}</p>
                    )}
                </div>
                {actions != null && (
                    <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}
