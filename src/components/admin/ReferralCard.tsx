import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

export function ReferralCard() {
  const { organisation } = useAuth()
  const [copied, setCopied] = useState(false)

  const referralUrl = organisation?.referral_code
    ? `${window.location.origin}/register?ref=${organisation.referral_code}`
    : null

  async function copy() {
    if (!referralUrl) return
    await navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!referralUrl) return null

  return (
    <div className="bg-blue-900 rounded-xl p-5 text-white">
      <p className="text-xs font-mono text-blue-300 uppercase tracking-widest mb-2">Referral Programme</p>
      <h3 className="font-bold text-lg mb-1">Give a month. Get a month.</h3>
      <p className="text-blue-200 text-sm mb-4">
        Share your link. When a business signs up and converts to paid, you both get one month free — no cap.
      </p>
      <div className="flex items-center gap-2 bg-blue-800 rounded-lg px-3 py-2">
        <span className="text-blue-100 text-xs font-mono flex-1 truncate">{referralUrl}</span>
        <button
          onClick={copy}
          className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-md transition-colors flex-shrink-0"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
