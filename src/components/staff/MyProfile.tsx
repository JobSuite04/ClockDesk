import { useAuth } from '../../context/AuthContext'
import { formatDate, formatCurrency } from '../../lib/utils'

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0 flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value ?? '—'}</span>
    </div>
  )
}

export function MyProfile() {
  const { profile } = useAuth()

  if (!profile) return null

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-5 border-b border-gray-100">
          <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-2xl font-bold">
            {profile.full_name.charAt(0)}
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{profile.full_name}</p>
            <p className="text-sm text-gray-500">{profile.email}</p>
          </div>
        </div>

        <div className="px-6">
          <Field label="Job title" value={profile.job_title} />
          <Field label="Department" value={profile.department} />
          <Field label="Start date" value={profile.start_date ? formatDate(profile.start_date) : null} />
          <Field label="Employment type" value={profile.employment_type === 'hourly' ? 'Hourly' : 'Salaried'} />
          {profile.employment_type === 'hourly' && (
            <Field
              label="Hourly rate"
              value={profile.hourly_rate !== null ? `${formatCurrency(profile.hourly_rate)}/hr` : null}
            />
          )}
          <Field
            label="Overtime threshold"
            value={`${profile.overtime_threshold_hours} hrs/week (then ×${profile.overtime_multiplier})`}
          />
          <Field label="Annual leave allowance" value={`${profile.annual_leave_allowance} days`} />
          <Field label="Account status" value={profile.is_active ? 'Active' : 'Inactive'} />
        </div>
      </div>

      <p className="text-xs text-gray-400">
        To update your profile details, please contact your administrator.
      </p>
    </div>
  )
}
