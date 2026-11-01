/**
 * Same rounding as the API (backend/src/invoices/invoice-calculator.ts), so the totals
 * shown while editing are exactly what the server will save.
 */
function roundDiv(numerator: number, denominator: number) {
  const sign = Math.sign(numerator)
  const n = Math.abs(numerator)
  return sign * Math.floor((2 * n + denominator) / (2 * denominator))
}

export function lineTotals(line: { quantity: number; unitPrice: number; taxRate: number }) {
  const qty = Math.round((Number.isFinite(line.quantity) ? line.quantity : 0) * 100)
  const price = Math.round((Number.isFinite(line.unitPrice) ? line.unitPrice : 0) * 100)
  const rate = Math.round((Number.isFinite(line.taxRate) ? line.taxRate : 0) * 100)
  const subtotal = roundDiv(qty * price, 100)
  const tax = roundDiv(subtotal * rate, 10_000)
  return { subtotalCents: subtotal, taxCents: tax, totalCents: subtotal + tax }
}

export function invoiceTotals(lines: { quantity: number; unitPrice: number; taxRate: number }[]) {
  const totals = lines.map(lineTotals)
  const sum = (key: keyof (typeof totals)[number]) => totals.reduce((s, t) => s + t[key], 0) / 100
  return {
    lines: totals.map((t) => ({ subtotal: t.subtotalCents / 100, tax: t.taxCents / 100, total: t.totalCents / 100 })),
    subtotal: sum("subtotalCents"),
    tax: sum("taxCents"),
    total: sum("totalCents"),
  }
}
