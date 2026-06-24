// A small dependency-free password strength estimate for the register form.
// Mirrors the server's spirit (length + variety) without trying to be a full
// zxcvbn — it's a hint, the server's AUTH_PASSWORD_VALIDATORS are the gate.
const LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']
const COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#16a34a']

export function passwordStrength(pw) {
  const s = String(pw || '')
  if (!s) return { score: 0, label: '', color: '#e5e7eb', percent: 0 }
  let score = 0
  if (s.length >= 8) score += 1
  if (s.length >= 12) score += 1
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score += 1
  if (/\d/.test(s)) score += 1
  if (/[^A-Za-z0-9]/.test(s)) score += 1
  // Too-short passwords can never read above "Weak".
  if (s.length < 8) score = Math.min(score, 1)
  score = Math.max(0, Math.min(score, 4))
  return { score, label: LABELS[score], color: COLORS[score], percent: ((score + 1) / 5) * 100 }
}
