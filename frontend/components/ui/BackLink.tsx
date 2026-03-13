import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type BackLinkProps = {
    href: string;
    label: string;
    className?: string;
    inverted?: boolean;
};

export function BackLink({ href, label, className = '', inverted = false }: BackLinkProps) {
    return (
        <Link
            href={href}
            className={`inline-flex items-center gap-1.5 text-sm transition-colors ${inverted ? 'text-white/80 hover:text-white' : 'text-gray-500 hover:text-gray-900'} ${className}`}
        >
            <ArrowLeft className="w-4 h-4" /> {label}
        </Link>
    );
}