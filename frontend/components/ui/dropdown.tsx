'use client';

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

export interface DropdownItem {
    label?: string
    value?: string
    icon?: React.ReactNode
    danger?: boolean
    disabled?: boolean
    divider?: boolean
    onClick?: () => void
    className?: string
}

interface DropdownProps {
    trigger: React.ReactNode
    items: DropdownItem[]
    onSelect?: (value: string) => void
    align?: 'left' | 'right'
    className?: string
}

export function Dropdown({
    trigger,
    items,
    onSelect,
    align = 'left',
    className
}: DropdownProps) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [menuPosition, setMenuPosition] = React.useState<{ top: number; left: number; openUpward: boolean } | null>(null)
    const dropdownRef = React.useRef<HTMLDivElement>(null)
    const menuRef = React.useRef<HTMLDivElement>(null)

    const updateMenuPosition = React.useCallback(() => {
        if (!dropdownRef.current) return

        const rect = dropdownRef.current.getBoundingClientRect()
        const menuWidth = 180
        const viewportPadding = 8
        const gap = 8

        // Estimate menu height based on items (each item ~40px, dividers ~9px)
        const estimatedMenuHeight = items.reduce((acc, item) => acc + (item.divider ? 9 : 40), 8)

        // Calculate available space above and below
        const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
        const spaceAbove = rect.top - viewportPadding

        // Decide whether to open upward
        const openUpward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow

        const desiredLeft = align === 'right' ? rect.right - menuWidth : rect.left
        const clampedLeft = Math.min(
            Math.max(desiredLeft, viewportPadding),
            window.innerWidth - menuWidth - viewportPadding
        )

        setMenuPosition({
            top: openUpward ? rect.top - gap : rect.bottom + gap,
            left: clampedLeft,
            openUpward,
        })
    }, [align, items])

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            const clickedOutsideTrigger = dropdownRef.current && !dropdownRef.current.contains(target)
            const clickedOutsideMenu = menuRef.current && !menuRef.current.contains(target)
            if (clickedOutsideTrigger && clickedOutsideMenu) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    React.useEffect(() => {
        if (!isOpen) return

        updateMenuPosition()

        const handleViewportChange = () => updateMenuPosition()
        window.addEventListener('resize', handleViewportChange)
        window.addEventListener('scroll', handleViewportChange, true)

        return () => {
            window.removeEventListener('resize', handleViewportChange)
            window.removeEventListener('scroll', handleViewportChange, true)
        }
    }, [isOpen, updateMenuPosition])

    const menu = isOpen && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
                ref={menuRef}
                style={{
                    top: menuPosition.openUpward ? 'auto' : menuPosition.top,
                    bottom: menuPosition.openUpward ? `${window.innerHeight - menuPosition.top}px` : 'auto',
                    left: menuPosition.left
                }}
                className="fixed z-50 min-w-[180px] py-1 bg-white rounded-lg border border-gray-200 shadow-lg"
            >
                {items.map((item, index) => {
                    if (item.divider) {
                        return <div key={index} className="my-1 border-t border-gray-200" />
                    }

                    return (
                        <button
                            key={item.value || index}
                            onClick={() => {
                                if (!item.disabled) {
                                    if (item.onClick) {
                                        item.onClick()
                                    } else if (onSelect && item.value) {
                                        onSelect(item.value)
                                    }
                                    setIsOpen(false)
                                }
                            }}
                            disabled={item.disabled}
                            className={cn(
                                "w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors",
                                item.disabled
                                    ? "text-gray-400 cursor-not-allowed"
                                    : item.danger
                                        ? "text-red-600 hover:bg-red-50"
                                        : "text-gray-700 hover:bg-gray-50",
                                item.className
                            )}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    )
                })}
            </div>,
            document.body
        )
        : null

    return (
        <div className={cn("relative inline-block", className)} ref={dropdownRef}>
            <div onClick={() => setIsOpen(!isOpen)}>
                {trigger}
            </div>
            {menu}
        </div>
    )
}

// Dropdown with button trigger
interface DropdownButtonProps {
    label: string
    items: DropdownItem[]
    onSelect: (value: string) => void
    variant?: 'default' | 'outline'
    size?: 'sm' | 'md'
    className?: string
}

export function DropdownButton({
    label,
    items,
    onSelect,
    variant = 'default',
    size = 'md',
    className
}: DropdownButtonProps) {
    const buttonStyles = {
        default: "bg-[#862733] text-white hover:bg-[#6d1f2a]",
        outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
    }

    const sizeStyles = {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm"
    }

    return (
        <Dropdown
            trigger={
                <button className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
                    buttonStyles[variant],
                    sizeStyles[size],
                    className
                )}>
                    {label}
                    <ChevronDown className="w-4 h-4" />
                </button>
            }
            items={items}
            onSelect={onSelect}
            align="right"
        />
    )
}
