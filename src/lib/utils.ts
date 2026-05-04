import {
  format,
  parseISO,
  differenceInMinutes,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isWeekend,
  addDays,
} from 'date-fns'
import type { ClockEvent, TimesheetEntry, WeeklySummary } from '../types'

export function formatTime(iso: string): string {
  return format(parseISO(iso), 'HH:mm')
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'dd MMM yyyy')
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), 'dd MMM yyyy HH:mm')
}

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function buildWeeklySummary(
  events: ClockEvent[],
  weekStart: Date,
  hourlyRate: number | null,
  overtimeThreshold: number,
  overtimeMultiplier: number,
): WeeklySummary {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const entries: TimesheetEntry[] = days.map((day) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    const dayEvents = events
      .filter((e) => e.timestamp.startsWith(dayStr))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    const clockIn = dayEvents.find((e) => e.event_type === 'clock_in') ?? null
    const clockOut = dayEvents.find((e) => e.event_type === 'clock_out') ?? null

    let hoursWorked = 0
    if (clockIn && clockOut) {
      const mins = differenceInMinutes(parseISO(clockOut.timestamp), parseISO(clockIn.timestamp))
      hoursWorked = minutesToHours(mins)
    }

    return {
      date: dayStr,
      clockIn: clockIn?.timestamp ?? null,
      clockOut: clockOut?.timestamp ?? null,
      hoursWorked,
      isAdminEdited: clockIn?.is_admin_edited || clockOut?.is_admin_edited || false,
      note: clockOut?.note ?? clockIn?.note ?? null,
      editReason: clockIn?.edit_reason ?? clockOut?.edit_reason ?? null,
    }
  })

  const totalHours = entries.reduce((sum, e) => sum + e.hoursWorked, 0)
  const regularHours = Math.min(totalHours, overtimeThreshold)
  const overtimeHours = Math.max(0, totalHours - overtimeThreshold)

  let grossPay: number | null = null
  if (hourlyRate !== null) {
    grossPay = regularHours * hourlyRate + overtimeHours * hourlyRate * overtimeMultiplier
    grossPay = Math.round(grossPay * 100) / 100
  }

  return {
    weekStart: format(weekStart, 'yyyy-MM-dd'),
    weekEnd: format(weekEnd, 'yyyy-MM-dd'),
    totalHours,
    regularHours,
    overtimeHours,
    grossPay,
    entries,
  }
}

// UK bank holidays 2024–2026 (static list; extend as needed)
const UK_BANK_HOLIDAYS: string[] = [
  '2024-01-01', '2024-03-29', '2024-04-01', '2024-05-06', '2024-05-27',
  '2024-08-26', '2024-12-25', '2024-12-26',
  '2025-01-01', '2025-04-18', '2025-04-21', '2025-05-05', '2025-05-26',
  '2025-08-25', '2025-12-25', '2025-12-26',
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25',
  '2026-08-31', '2026-12-25', '2026-12-28',
]

export function isUKBankHoliday(dateStr: string): boolean {
  return UK_BANK_HOLIDAYS.includes(dateStr)
}

export function countWorkingDays(start: Date, end: Date): number {
  const days = eachDayOfInterval({ start, end })
  return days.filter((d) => {
    const str = format(d, 'yyyy-MM-dd')
    return !isWeekend(d) && !isUKBankHoliday(str)
  }).length
}

export function getWeekStart(date: Date = new Date()): Date {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount)
}
