'use client';

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface Column<T> {
    key: string
    header: string | React.ReactNode
    cell?: (row: T) => React.ReactNode
    sortable?: boolean
    className?: string
}

interface DataTableProps<T> {
    columns: Column<T>[]
    data: T[]
    isLoading?: boolean
    emptyMessage?: string
    onRowClick?: (row: T) => void
    pagination?: {
        currentPage: number
        totalPages: number
        onPageChange: (page: number) => void
    }
    selectedRows?: T[]
    onSelectRow?: (row: T) => void
    onSelectAll?: () => void
    rowKey?: keyof T | ((row: T) => string | number)
}

export function DataTable<T extends Record<string, any>>({
    columns,
    data,
    isLoading,
    emptyMessage = "No data available",
    onRowClick,
    pagination,
    selectedRows,
    onSelectRow,
    onSelectAll,
    rowKey = 'id'
}: DataTableProps<T>) {
    const getRowKey = (row: T, index: number): string | number => {
        if (typeof rowKey === 'function') {
            return rowKey(row)
        }
        return row[rowKey] ?? index
    }

    const isRowSelected = (row: T): boolean => {
        if (!selectedRows) return false
        const key = getRowKey(row, 0)
        return selectedRows.some((r, i) => getRowKey(r, i) === key)
    }

    const allSelected = selectedRows && data.length > 0 && selectedRows.length === data.length

    return (
        <div className="w-full">
            <div className="overflow-auto max-h-[32rem] rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            {onSelectRow && (
                                <th className="w-12 px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={onSelectAll}
                                        className="w-4 h-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]"
                                    />
                                </th>
                            )}
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className={cn(
                                        "px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider",
                                        column.className
                                    )}
                                >
                                    {column.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {isLoading ? (
                            <tr>
                                <td
                                    colSpan={columns.length + (onSelectRow ? 1 : 0)}
                                    className="px-4 py-8 text-center"
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-[#862733] border-t-transparent rounded-full animate-spin" />
                                        <span className="text-gray-500">Loading...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length + (onSelectRow ? 1 : 0)}
                                    className="px-4 py-8 text-center text-gray-500"
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            data.map((row, index) => (
                                <tr
                                    key={getRowKey(row, index)}
                                    className={cn(
                                        "hover:bg-gray-50 transition-colors",
                                        onRowClick && "cursor-pointer",
                                        isRowSelected(row) && "bg-[#862733]/5"
                                    )}
                                    onClick={() => onRowClick?.(row)}
                                >
                                    {onSelectRow && (
                                        <td className="w-12 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isRowSelected(row)}
                                                onChange={() => onSelectRow(row)}
                                                className="w-4 h-4 rounded border-gray-300 text-[#862733] focus:ring-[#862733]"
                                            />
                                        </td>
                                    )}
                                    {columns.map((column) => (
                                        <td
                                            key={column.key}
                                            className={cn("px-4 py-3 text-gray-700", column.className)}
                                        >
                                            {column.cell ? column.cell(row) : row[column.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white rounded-b-lg">
                    <div className="text-sm text-gray-500">
                        Page {pagination.currentPage} of {pagination.totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
                            disabled={pagination.currentPage <= 1}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
                            disabled={pagination.currentPage >= pagination.totalPages}
                            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
