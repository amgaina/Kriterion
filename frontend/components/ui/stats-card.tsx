import * as React from "react"
import { cn } from "@/lib/utils"
import {
    TrendingUp,
    TrendingDown,
    Minus,
    LucideIcon
} from "lucide-react"

interface StatsCardProps {
    title: string
    value: string | number
    subtitle?: string
    icon?: LucideIcon
    trend?: {
        value: number
        label: string
    }
    className?: string
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
    /** icon size in pixels (controls visual weight for empty-space balancing) */
    iconSize?: number
}

const variantStyles = {
    default: {
        container: 'bg-white',
        icon: 'bg-gray-100 text-gray-600',
        value: 'text-gray-900'
    },
    primary: {
        container: 'bg-white',
        icon: 'bg-[#862733]/10 text-[#862733]',
        value: 'text-[#862733]'
    },
    success: {
        container: 'bg-white',
        icon: 'bg-green-100 text-green-600',
        value: 'text-green-600'
    },
    warning: {
        container: 'bg-white',
        icon: 'bg-yellow-100 text-yellow-600',
        value: 'text-yellow-600'
    },
    danger: {
        container: 'bg-white',
        icon: 'bg-red-100 text-red-600',
        value: 'text-red-600'
    }
}

export function StatsCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    className,
    variant = 'default',
    iconSize = 24
}: StatsCardProps) {
    const styles = variantStyles[variant]

    const iconWrapperSize = typeof iconSize === 'number' ? iconSize + 16 : 40

    const TrendIcon = trend
        ? trend.value > 0
            ? TrendingUp
            : trend.value < 0
                ? TrendingDown
                : Minus
        : null

    const trendColor = trend
        ? trend.value > 0
            ? 'text-green-600'
            : trend.value < 0
                ? 'text-red-600'
                : 'text-gray-500'
        : ''

    return (
        <div className={cn(
            "rounded-xl border border-gray-200 p-6 shadow-sm",
            styles.container,
            className
        )}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    <p className={cn("text-3xl font-bold mt-2", styles.value)}>
                        {value}
                    </p>
                    {subtitle && (
                        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
                    )}
                    {trend && TrendIcon && (
                        <div className={cn("flex items-center gap-1 mt-2", trendColor)}>
                            <TrendIcon className="w-4 h-4" />
                            <span className="text-sm font-medium">
                                {trend.value > 0 ? '+' : ''}{trend.value}%
                            </span>
                            <span className="text-xs text-gray-500 ml-1">{trend.label}</span>
                        </div>
                    )}
                </div>
                {Icon && (
                    <div className={cn("p-3 rounded-xl flex items-center justify-center", styles.icon)} style={{ width: iconWrapperSize, height: iconWrapperSize }}>
                        <Icon style={{ width: iconSize, height: iconSize }} />
                    </div>
                )} 
            </div>
        </div>
    )
}
