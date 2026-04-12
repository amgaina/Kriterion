'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
	addDays,
	addMonths,
	endOfMonth,
	endOfWeek,
	format,
	isAfter,
	isBefore,
	isSameDay,
	isSameMonth,
	startOfDay,
	startOfMonth,
	startOfWeek,
	subMonths,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CalendarProps {
	label?: string;
	selectedDate?: Date | null;
	onDateChange: (date: Date | null) => void;
	minDate?: Date;
	maxDate?: Date;
	error?: string;
	required?: boolean;
	placeholder?: string;
	disabled?: boolean;
	includeTime?: boolean;
	id?: string;
}

const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (value: number) => String(value).padStart(2, '0');

const toTwelveHour = (hour24: number) => {
	if (hour24 === 0) return { hour: 12, period: 'AM' as const };
	if (hour24 < 12) return { hour: hour24, period: 'AM' as const };
	if (hour24 === 12) return { hour: 12, period: 'PM' as const };
	return { hour: hour24 - 12, period: 'PM' as const };
};

const toTwentyFourHour = (hour12: number, period: 'AM' | 'PM') => {
	if (period === 'AM') return hour12 === 12 ? 0 : hour12;
	return hour12 === 12 ? 12 : hour12 + 12;
};

export function Calendar({
	label,
	selectedDate = null,
	onDateChange,
	minDate,
	maxDate,
	error,
	required,
	placeholder = 'Select date',
	disabled,
	includeTime = false,
	id,
}: CalendarProps) {
	const triggerRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [viewMonth, setViewMonth] = useState<Date>(() =>
		selectedDate ? startOfMonth(selectedDate) : startOfMonth(new Date())
	);
	const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0, width: 320 });

	const normalizedMin = minDate ? startOfDay(minDate) : undefined;
	const normalizedMax = maxDate ? startOfDay(maxDate) : undefined;

	useEffect(() => {
		if (selectedDate) {
			setViewMonth(startOfMonth(selectedDate));
		}
	}, [selectedDate]);

	const panelHeight = includeTime ? 402 : 358;
	const panelWidth = 320;

	const updatePanelPosition = useCallback(() => {
		const trigger = triggerRef.current;
		if (!trigger) return;

		const rect = trigger.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const gap = 8;

		const spaceBelow = viewportHeight - rect.bottom;
		const shouldOpenAbove = spaceBelow < panelHeight + gap && rect.top > panelHeight + gap;

		const top = shouldOpenAbove
			? Math.max(8, rect.top - panelHeight - gap)
			: Math.min(viewportHeight - panelHeight - 8, rect.bottom + gap);

		const left = Math.min(Math.max(8, rect.left), viewportWidth - panelWidth - 8);
		setPanelPosition({ top, left, width: panelWidth });
	}, [panelHeight]);

	useLayoutEffect(() => {
		if (!isOpen) return;

		updatePanelPosition();

		const handleReposition = () => updatePanelPosition();
		window.addEventListener('resize', handleReposition);
		window.addEventListener('scroll', handleReposition, true);

		return () => {
			window.removeEventListener('resize', handleReposition);
			window.removeEventListener('scroll', handleReposition, true);
		};
	}, [isOpen, updatePanelPosition]);

	useEffect(() => {
		if (!isOpen) return;

		const handleOutsideClick = (event: MouseEvent) => {
			const target = event.target as Node;
			if (triggerRef.current?.contains(target)) return;
			if (panelRef.current?.contains(target)) return;
			setIsOpen(false);
		};

		document.addEventListener('mousedown', handleOutsideClick);
		return () => document.removeEventListener('mousedown', handleOutsideClick);
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;

		const onEsc = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setIsOpen(false);
		};

		window.addEventListener('keydown', onEsc);
		return () => window.removeEventListener('keydown', onEsc);
	}, [isOpen]);

	const days = useMemo(() => {
		const monthStart = startOfMonth(viewMonth);
		const monthEnd = endOfMonth(viewMonth);
		const calendarStart = startOfWeek(monthStart);
		const calendarEnd = endOfWeek(monthEnd);

		const result: Date[] = [];
		let current = calendarStart;
		while (!isAfter(current, calendarEnd)) {
			result.push(current);
			current = addDays(current, 1);
		}
		return result;
	}, [viewMonth]);

	const isDayDisabled = (day: Date) => {
		const date = startOfDay(day);
		if (normalizedMin && isBefore(date, normalizedMin)) return true;
		if (normalizedMax && isAfter(date, normalizedMax)) return true;
		return false;
	};

	const selectDay = (day: Date) => {
		if (isDayDisabled(day)) return;

		const nextDate = new Date(day);
		if (includeTime && selectedDate) {
			nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
		}

		onDateChange(nextDate);
		if (!includeTime) setIsOpen(false);
	};

	const handleTimeChange = (hour12: number, minute: number, period: 'AM' | 'PM') => {
		if (!selectedDate) return;
		const hour24 = toTwentyFourHour(hour12, period);

		const nextDate = new Date(selectedDate);
		nextDate.setHours(hour24, minute, 0, 0);
		onDateChange(nextDate);
	};

	const displayValue = selectedDate
		? format(selectedDate, includeTime ? 'MMM d, yyyy • h:mm a' : 'MMM d, yyyy')
		: placeholder;

	const currentHour24 = selectedDate ? selectedDate.getHours() : 0;
	const currentMinute = selectedDate ? selectedDate.getMinutes() : 0;
	const { hour: currentHour12, period: currentPeriod } = toTwelveHour(currentHour24);

	const inputId = id || label?.toLowerCase().replace(/\s+/g, '-') || 'calendar-input';

	const calendarPanel = isOpen ? (
		<div
			ref={panelRef}
			className="fixed z-[9999] rounded-xl border border-gray-200 bg-white p-3 shadow-xl"
			style={{
				top: panelPosition.top,
				left: panelPosition.left,
				width: panelPosition.width,
			}}
		>
			<div className="mb-3 flex items-center justify-between">
				<button
					type="button"
					onClick={() => setViewMonth((prev) => subMonths(prev, 1))}
					className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
					aria-label="Previous month"
				>
					<ChevronLeft className="h-4 w-4" />
				</button>

				<p className="text-sm font-semibold text-gray-800">{format(viewMonth, 'MMMM yyyy')}</p>

				<button
					type="button"
					onClick={() => setViewMonth((prev) => addMonths(prev, 1))}
					className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
					aria-label="Next month"
				>
					<ChevronRight className="h-4 w-4" />
				</button>
			</div>

			<div className="grid grid-cols-7 gap-1.5">
				{weekdayLabels.map((day) => (
					<div
						key={day}
						className="py-1 text-center text-[11px] font-medium uppercase tracking-wide text-gray-400"
					>
						{day}
					</div>
				))}

				{days.map((day) => {
					const dayDisabled = isDayDisabled(day);
					const isSelected = !!selectedDate && isSameDay(day, selectedDate);
					const inCurrentMonth = isSameMonth(day, viewMonth);

					return (
						<button
							key={day.toISOString()}
							type="button"
							onClick={() => selectDay(day)}
							disabled={dayDisabled}
							className={cn(
								'h-9 rounded-md text-sm transition-colors',
								'hover:bg-gray-100',
								!inCurrentMonth && 'text-gray-300',
								inCurrentMonth && 'text-gray-700',
								isSelected && 'bg-[#862733] text-white hover:bg-[#862733]',
								dayDisabled && 'cursor-not-allowed text-gray-300 hover:bg-transparent'
							)}
						>
							{format(day, 'd')}
						</button>
					);
				})}
			</div>

			<div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
				{includeTime ? (
					<div className="flex items-center gap-2">
						<select
							aria-label="Hour"
							value={String(currentHour12)}
							disabled={!selectedDate}
							onChange={(e) => handleTimeChange(Number.parseInt(e.target.value, 10), currentMinute, currentPeriod)}
							className="h-9 rounded-md border border-gray-300 px-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#862733] disabled:bg-gray-50 disabled:text-gray-400"
						>
							{Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
								<option key={hour} value={hour}>{hour}</option>
							))}
						</select>

						<span className="text-sm text-gray-500">:</span>

						<select
							aria-label="Minute"
							value={pad(currentMinute)}
							disabled={!selectedDate}
							onChange={(e) => handleTimeChange(currentHour12, Number.parseInt(e.target.value, 10), currentPeriod)}
							className="h-9 rounded-md border border-gray-300 px-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#862733] disabled:bg-gray-50 disabled:text-gray-400"
						>
							{Array.from({ length: 60 }, (_, i) => i).map((minute) => (
								<option key={minute} value={pad(minute)}>{pad(minute)}</option>
							))}
						</select>

						<select
							aria-label="AM/PM"
							value={currentPeriod}
							disabled={!selectedDate}
							onChange={(e) => handleTimeChange(currentHour12, currentMinute, e.target.value as 'AM' | 'PM')}
							className="h-9 rounded-md border border-gray-300 px-2.5 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#862733] disabled:bg-gray-50 disabled:text-gray-400"
						>
							<option value="AM">AM</option>
							<option value="PM">PM</option>
						</select>
					</div>
				) : (
					<button
						type="button"
						onClick={() => {
							setViewMonth(startOfMonth(new Date()));
						}}
						className="text-xs font-medium text-gray-500 hover:text-gray-700"
					>
						Today
					</button>
				)}

				{selectedDate && (
					<button
						type="button"
						onClick={() => {
							onDateChange(null);
							if (!includeTime) setIsOpen(false);
						}}
						className="text-xs font-medium text-primary hover:underline"
					>
						Clear
					</button>
				)}
			</div>
		</div>
	) : null;

	return (
		<div className="w-full">
			{label && (
				<label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1.5">
					{label} {required && <span className="text-red-500">*</span>}
				</label>
			)}

			<button
				id={inputId}
				ref={triggerRef}
				type="button"
				disabled={disabled}
				onClick={() => setIsOpen((prev) => !prev)}
				className={cn(
					'flex h-10 w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-all duration-200',
					'focus:outline-none focus:ring-2 focus:ring-[#862733] focus:border-transparent',
					'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
					!selectedDate && 'text-gray-400',
					error && 'border-red-500 focus:ring-red-500'
				)}
			>
				<span className="truncate text-left">{displayValue}</span>
				<CalendarDays className="h-4 w-4 text-gray-500" />
			</button>

			{isOpen && typeof document !== 'undefined' ? createPortal(calendarPanel, document.body) : null}

			{error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
		</div>
	);
}

