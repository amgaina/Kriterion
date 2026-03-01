import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const badgeVariants = cva(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
    {
        variants: {
            variant: {
                default: "bg-gray-100 text-gray-800",
                secondary: "bg-gray-200 text-gray-900 hover:bg-gray-200/80",
                primary: "bg-[#862733]/10 text-[#862733]",
                success: "bg-green-100 text-green-800",
                warning: "bg-yellow-100 text-yellow-800",
                danger: "bg-red-100 text-red-800",
                destructive: "bg-red-100 text-red-800",
                info: "bg-blue-100 text-blue-800",
                outline: "border border-gray-300 text-gray-700",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
