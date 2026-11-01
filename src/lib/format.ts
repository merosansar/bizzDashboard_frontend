import type { ExpenseCategory, PaymentMethod, Role } from "./types"

const usesLakh = (currency: string) => currency === "NPR" || currency === "INR"

/** Full amount, e.g. "NPR 1,25,000.00". NPR and INR use lakh grouping. */
export function formatMoney(amount: number, currency = "NPR", { symbol = true } = {}) {
  const value = new Intl.NumberFormat(usesLakh(currency) ? "en-IN" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return symbol ? `${currency} ${value}` : value
}

/** Short amount for headlines: "NPR 23.4 lakh", "NPR 1.2 crore", "NPR 85,400". */
export function formatMoneyShort(amount: number, currency = "NPR", { symbol = true } = {}) {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? "−" : ""
  const prefix = symbol ? `${currency} ` : ""
  if (usesLakh(currency)) {
    if (abs >= 1_00_00_000) return `${sign}${prefix}${trim(abs / 1_00_00_000)} crore`
    if (abs >= 1_00_000) return `${sign}${prefix}${trim(abs / 1_00_000)} lakh`
    return `${sign}${prefix}${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(abs)}`
  }
  return `${sign}${prefix}${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(abs)}`
}

/** Evenly spaced axis ticks on round numbers (1, 2, 2.5 or 5 × a power of ten). */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow
  const top = Math.ceil(max / step) * step
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
}

/** Axis ticks: 0, 5L, 10L, 1Cr (lakh-based currencies) or 0, 50K, 1M. */
export function formatAxis(amount: number, currency = "NPR") {
  if (amount === 0) return "0"
  if (usesLakh(currency)) {
    if (amount >= 1_00_00_000) return `${trim(amount / 1_00_00_000)}Cr`
    if (amount >= 1_00_000) return `${trim(amount / 1_00_000)}L`
    return `${trim(amount / 1000)}K`
  }
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(amount)
}

function trim(n: number) {
  return (Math.round(n * 10) / 10).toString()
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

/** "2026-10-28" → "28 Oct 2026" */
export function formatDate(date: string | null | undefined, opts: { year?: boolean } = {}) {
  if (!date) return "—"
  const [y, m, d] = date.slice(0, 10).split("-").map(Number)
  return opts.year === false ? `${d} ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]} ${y}`
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—"
  const d = new Date(iso)
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${time}`
}


/** "2026-10" → "Oct" (or "October 2026") */
export function formatMonth(month: string, withYear = false) {
  const [y, m] = month.split("-").map(Number)
  return withYear ? `${MONTHS_LONG[m - 1]} ${y}` : MONTHS[m - 1]
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

export function timeAgo(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  const abs = Math.abs(seconds)
  if (abs < 60) return "just now"
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute")
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), "hour")
  if (abs < 86_400 * 7) return relative.format(Math.round(seconds / 86_400), "day")
  return formatDate(iso.slice(0, 10))
}

/** Today's date (YYYY-MM-DD) in Nepal, matching the API. */
export function todayInNepal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(new Date())
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  esewa: "eSewa",
  khalti: "Khalti",
  fonepay: "Fonepay QR",
  cheque: "Cheque",
  card: "Card",
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: "Rent",
  salaries: "Salaries",
  inventory: "Stock and materials",
  utilities: "Utilities",
  marketing: "Marketing",
  travel: "Travel and transport",
  software: "Software",
  office: "Office supplies",
  taxes: "Taxes and fees",
  other: "Other",
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Everything, including other owners",
  admin: "Settings, team, voiding invoices",
  member: "Invoices, payments, customers, expenses",
  viewer: "Can look but not change anything",
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}
