import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { Profile, EmploymentType } from '../../types'

export interface StaffFormValues {
  full_name: string
  email: string
  job_title: string
  department: string
  start_date: string
  employment_type: EmploymentType
  hourly_rate: string
  overtime_multiplier: string
  overtime_threshold_hours: string
  annual_leave_allowance: string
  role: 'admin' | 'staff'
  is_active: boolean
}

interface Props {
  initial?: Partial<Profile>
  isNew?: boolean
  onSubmit: (values: StaffFormValues) => Promise<void>
  onCancel: () => void
}

export function StaffForm({ initial, isNew, onSubmit, onCancel }: Props) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting }, reset } = useForm<StaffFormValues>({
    defaultValues: {
      full_name: initial?.full_name ?? '',
      email: initial?.email ?? '',
      job_title: initial?.job_title ?? '',
      department: initial?.department ?? '',
      start_date: initial?.start_date ?? '',
      employment_type: initial?.employment_type ?? 'hourly',
      hourly_rate: initial?.hourly_rate?.toString() ?? '',
      overtime_multiplier: initial?.overtime_multiplier?.toString() ?? '1.5',
      overtime_threshold_hours: initial?.overtime_threshold_hours?.toString() ?? '40',
      annual_leave_allowance: initial?.annual_leave_allowance?.toString() ?? '25',
      role: initial?.role ?? 'staff',
      is_active: initial?.is_active ?? true,
    },
  })

  const empType = watch('employment_type')

  useEffect(() => { reset({
    full_name: initial?.full_name ?? '',
    email: initial?.email ?? '',
    job_title: initial?.job_title ?? '',
    department: initial?.department ?? '',
    start_date: initial?.start_date ?? '',
    employment_type: initial?.employment_type ?? 'hourly',
    hourly_rate: initial?.hourly_rate?.toString() ?? '',
    overtime_multiplier: initial?.overtime_multiplier?.toString() ?? '1.5',
    overtime_threshold_hours: initial?.overtime_threshold_hours?.toString() ?? '40',
    annual_leave_allowance: initial?.annual_leave_allowance?.toString() ?? '25',
    role: initial?.role ?? 'staff',
    is_active: initial?.is_active ?? true,
  }) }, [initial])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full name *</label>
          <input {...register('full_name', { required: 'Required' })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input type="email" {...register('email', { required: 'Required' })}
            disabled={!isNew}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500" />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Job title</label>
          <input {...register('job_title')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <input {...register('department')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
          <input type="date" {...register('start_date')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employment type</label>
          <select {...register('employment_type')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="hourly">Hourly</option>
            <option value="salaried">Salaried</option>
          </select>
        </div>
        {empType === 'hourly' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hourly rate (£)</label>
            <input type="number" step="0.01" min="0" {...register('hourly_rate')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Overtime threshold (hrs/week)</label>
          <input type="number" min="1" {...register('overtime_threshold_hours')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Overtime multiplier</label>
          <input type="number" step="0.1" min="1" {...register('overtime_multiplier')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Annual leave (days)</label>
          <input type="number" min="0" {...register('annual_leave_allowance')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select {...register('role')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {!isNew && (
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id="is_active" {...register('is_active')}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded" />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active account</label>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
          {isSubmitting ? 'Saving…' : isNew ? 'Send invite' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
