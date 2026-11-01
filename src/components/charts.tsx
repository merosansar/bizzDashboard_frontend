import { useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { formatAxis, formatMoney, formatMoneyShort, formatMonth, niceTicks } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Tooltip as Hint, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/* ---- Money in and out: grouped columns, 12 months --------------------------------
   Two series on one NPR axis (never a second axis). Colours were validated for
   colour-blind separation and contrast in both themes (see index.css).            */

export interface CashMonth {
  month: string
  revenue: number
  expenses: number
  profit: number
}

const SERIES = [
  { key: "revenue", label: "Received", color: "var(--chart-revenue)" },
  { key: "expenses", label: "Spent", color: "var(--chart-expenses)" },
] as const

export function CashFlowChart({ data, currency, currentMonth }: { data: CashMonth[]; currency: string; currentMonth: string }) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const ticks = niceTicks(Math.max(...data.map((d) => Math.max(d.revenue, d.expenses)), 0))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-2">
        <ul className="flex gap-4 text-sm text-muted-foreground" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
        <div className="inline-flex rounded-md border p-0.5 text-xs" role="group" aria-label="View as">
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "rounded px-2.5 py-1 font-medium capitalize transition-colors",
                view === v ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "chart" ? (
        <div className="h-[290px] px-2 pb-3" role="img" aria-label="Money received and spent per month for the last 12 months">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="24%" margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="month"
                tickFormatter={(m: string) => formatMonth(m)}
                tickLine={false}
                axisLine={{ stroke: "var(--chart-grid)" }}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                interval={0}
                minTickGap={2}
              />
              <YAxis
                ticks={ticks}
                domain={[0, ticks[ticks.length - 1]]}
                tickFormatter={(v: number) => formatAxis(v, currency)}
                tickLine={false}
                axisLine={false}
                width={46}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "var(--accent)", opacity: 0.7 }}
                content={(props) => (
                  <CashTooltip
                    active={props.active}
                    payload={props.payload as TooltipPayload}
                    label={props.label}
                    currency={currency}
                    currentMonth={currentMonth}
                  />
                )}
              />
              {SERIES.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={s.color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={18}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="max-h-[290px] overflow-auto px-5 pb-4">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
              <tr className="border-b border-rule">
                <th className="py-2 font-medium">Month</th>
                <th className="py-2 text-right font-medium">Received</th>
                <th className="py-2 text-right font-medium">Spent</th>
                <th className="py-2 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {[...data].reverse().map((m) => (
                <tr key={m.month} className="border-b border-rule last:border-0">
                  <td className="py-2">
                    {formatMonth(m.month, true)}
                    {m.month === currentMonth && <span className="text-muted-foreground"> (so far)</span>}
                  </td>
                  <td className="py-2 text-right">{formatMoney(m.revenue, currency, { symbol: false })}</td>
                  <td className="py-2 text-right">{formatMoney(m.expenses, currency, { symbol: false })}</td>
                  <td className={cn("py-2 text-right", m.profit < 0 && "text-[var(--status-overdue)]")}>
                    {formatMoney(m.profit, currency, { symbol: false })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type TooltipPayload = ReadonlyArray<{ payload?: unknown }> | undefined

function CashTooltip({
  active,
  payload,
  label,
  currency,
  currentMonth,
}: {
  active?: boolean
  payload: TooltipPayload
  label?: unknown
  currency: string
  currentMonth: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as CashMonth | undefined
  if (!row) return null
  return (
    <div className="min-w-48 rounded-lg border bg-popover px-3 py-2.5 text-sm text-popover-foreground shadow-lg">
      <p className="mb-1.5 text-xs text-muted-foreground">
        {formatMonth(String(label), true)}
        {row.month === currentMonth && " (so far)"}
      </p>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
            {s.label}
          </span>
          <span className="tabular font-semibold">{formatMoneyShort(row[s.key], currency)}</span>
        </div>
      ))}
      <div className="mt-1.5 flex items-center justify-between gap-6 border-t pt-1.5">
        <span className="text-muted-foreground">Profit</span>
        <span className={cn("tabular font-semibold", row.profit < 0 && "text-[var(--status-overdue)]")}>
          {formatMoneyShort(row.profit, currency)}
        </span>
      </div>
    </div>
  )
}

/* ---- Horizontal bar list: one row per item, value at the bar tip ------------------ */

export interface BarItem {
  key: string
  label: React.ReactNode
  value: number
  color: string
  /** Extra line under the label */
  note?: React.ReactNode
  /** Tooltip text on the bar */
  hint?: string
}

export function BarList({ items, currency, empty }: { items: BarItem[]; currency: string; empty?: React.ReactNode }) {
  const max = Math.max(...items.map((i) => i.value), 0)
  if (items.length === 0 || max === 0) {
    return <p className="px-5 pb-5 text-sm text-muted-foreground">{empty ?? "Nothing to show yet."}</p>
  }
  return (
    <ul className="px-5 pb-4">
      {items.map((item) => {
        const pct = (item.value / max) * 100
        return (
          <li key={item.key} className="border-b border-rule py-2.5 last:border-0">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="shrink-0 font-semibold">{formatMoneyShort(item.value, currency)}</span>
            </div>
            <Hint>
              <TooltipTrigger asChild>
                <div
                  className="mt-1.5 h-2.5 rounded-full bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  tabIndex={0}
                  aria-label={item.hint ?? formatMoney(item.value, currency)}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(pct, item.value > 0 ? 2 : 0)}%`, backgroundColor: item.color }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>{item.hint ?? formatMoney(item.value, currency)}</TooltipContent>
            </Hint>
            {item.note && <div className="mt-1 text-xs text-muted-foreground">{item.note}</div>}
          </li>
        )
      })}
    </ul>
  )
}
