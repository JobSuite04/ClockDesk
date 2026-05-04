export type Plan = 'trial' | 'starter' | 'growth' | 'pro' | 'expired'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'

export const PLAN_LIMITS: Record<Plan, number> = {
  trial:   20,
  starter: 20,
  growth:  75,
  pro:     Infinity,
  expired: 0,
}

export const PLAN_PRICES = {
  starter: { monthly: 29, annual: 249 },
  growth:  { monthly: 59, annual: 499 },
  pro:     { monthly: 99, annual: 849 },
}

export interface Organisation {
  id: string
  name: string
  slug: string
  plan: Plan
  trial_ends_at: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: SubscriptionStatus
  max_employees: number
  referral_code: string | null
  created_at: string
}

export type Role = 'admin' | 'staff'
export type EmploymentType = 'hourly' | 'salaried'
export type HolidayStatus = 'pending' | 'approved' | 'declined'
export type ClockEventType = 'clock_in' | 'clock_out'

export interface Profile {
  id: string
  full_name: string
  email: string
  job_title: string | null
  department: string | null
  start_date: string | null
  employment_type: EmploymentType
  hourly_rate: number | null
  overtime_multiplier: number
  overtime_threshold_hours: number
  annual_leave_allowance: number
  role: Role
  is_active: boolean
  organisation_id: string | null
  created_at: string
}

export interface ClockEvent {
  id: string
  user_id: string
  event_type: ClockEventType
  timestamp: string
  note: string | null
  is_admin_edited: boolean
  original_timestamp: string | null
  edit_reason: string | null
  edited_by: string | null
  edited_at: string | null
  created_at: string
  profile?: Profile
}

export interface HolidayRequest {
  id: string
  user_id: string
  start_date: string
  end_date: string
  days_requested: number
  note: string | null
  status: HolidayStatus
  admin_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  profile?: Profile
  reviewer?: Profile
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  is_read: boolean
  related_id: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  admin_id: string
  action: string
  target_user_id: string | null
  record_id: string | null
  table_name: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
  admin?: Profile
}

export interface TimesheetEntry {
  date: string
  clockIn: string | null
  clockOut: string | null
  hoursWorked: number
  isAdminEdited: boolean
  note: string | null
  editReason: string | null
}

export interface WeeklySummary {
  weekStart: string
  weekEnd: string
  totalHours: number
  regularHours: number
  overtimeHours: number
  grossPay: number | null
  entries: TimesheetEntry[]
}
