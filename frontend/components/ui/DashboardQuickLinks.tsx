import Link from 'next/link';
import type { ElementType } from 'react';
import { ArrowRight } from 'lucide-react';

type DashboardQuickLink = {
    label: string;
    href: string;
    icon: ElementType;
    gradientClass: string;
};

type DashboardQuickLinksProps = {
    items: DashboardQuickLink[];
};

export function DashboardQuickLinks({ items }: DashboardQuickLinksProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
            {items.map((item) => (
                <Link key={item.href} href={item.href}>
                    <div className="group flex items-center gap-2.5 rounded-lg border border-gray-100 bg-white px-3 py-2.5 hover:border-gray-200 hover:shadow-sm transition-all">
                        <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${item.gradientClass} flex items-center justify-center flex-shrink-0`}>
                            <item.icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-xs font-medium text-gray-700 group-hover:text-primary transition-colors">{item.label}</span>
                        <ArrowRight className="w-3 h-3 text-gray-200 group-hover:text-primary ml-auto flex-shrink-0 transition-colors" />
                    </div>
                </Link>
            ))}
        </div>
    );
}