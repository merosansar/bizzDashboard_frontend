import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, ArrowDownRight, ArrowUpRight, FileText, Plus } from "lucide-react"
import { api } from "@/lib/api"
import { EXPENSE_CATEGORY_LABELS, formatDate, formatMoney, formatMoneyShort, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAuth, useSession } from "@/features/auth"
import { BarList, CashFlowChart } from "@/components/charts"
import { EmptyState, ErrorState, PageHeader, Panel, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  const session = useSession()
  const { can } = useAuth()
  const currency = session.organization.currency
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard })

  const monthName = data
    ? new Date(`${data.today}T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : ""

  return (
    <>
      <PageHeader
        title={session.organization.name}
        description={data ? `${monthName}, as of ${formatDate(data.today)}. All amounts in ${currency}.` : " "}
        actions={
          can("member") && (
            <>
              <Button variant="outline" asChild>
                <Link to="/expenses?new=1">Add expense</Link>
              </Button>
              <Button asChild>
                <Link to="/invoices/new">
                  <Plus />
                  New invoice
                </Link>
              </Button>
            </>
          )
        }
      />

      {error ? (
        <Panel>
          <ErrorState error={error} onRetry={() => refetch()} />
        </Panel>
      ) : isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-5">
          <MoneyBand data={data} currency={currency} />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel title="Money in and out" description="Payments received and expenses, last 12 months">
              <CashFlowChart data={data.monthly} currency={currency} currentMonth={data.today.slice(0, 7)} />
            </Panel>
            <Panel
              title="Who owes you"
              description={`${formatMoney(data.kpis.outstanding, currency)} across ${data.kpis.outstandingCount} invoices`}
              action={
                data.kpis.overdueCount > 0 && (
                  <Button variant="link" size="sm" className="h-auto px-0" asChild>
                    <Link to="/invoices?status=overdue">See overdue</Link>
                  </Button>
                )
              }
            >
              <p className="px-5 pb-1 text-xs text-muted-foreground">Unpaid balance by how late it is</p>
              <BarList
                currency={currency}
                empty="Nothing outstanding. Every sent invoice is paid."
                items={data.aging.map((b, i) => ({
                  key: b.bucket,
                  label: b.bucket === "Not yet due" ? "Not due yet" : `${b.bucket} late`,
                  value: b.amount,
                  color: `var(--aging-${i + 1})`,
                  hint:
                    data.kpis.outstanding > 0
                      ? `${formatMoney(b.amount, currency)}, ${Math.round((b.amount / data.kpis.outstanding) * 100)}% of what’s owed`
                      : undefined,
                }))}
              />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <Panel title="Best customers" description="Payments received, last 12 months">
              <BarList
                currency={currency}
                empty="No payments yet."
                items={data.topCustomers.map((c) => ({
                  key: c.id,
                  label: (
                    <Link to={`/customers/${c.id}`} className="font-medium hover:text-primary hover:underline">
                      {c.name}
                    </Link>
                  ),
                  value: c.revenue,
                  color: "var(--chart-revenue)",
                  note: c.outstanding > 0 ? `${formatMoneyShort(c.outstanding, currency)} still owed` : "Nothing owed",
                }))}
              />
            </Panel>
            <Panel title="Where the money went" description="Expenses by category, last 12 months">
              <BarList
                currency={currency}
                empty="No expenses recorded yet."
                items={data.expensesByCategory.slice(0, 6).map((e) => ({
                  key: e.category,
                  label: EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
                  value: e.total,
                  color: "var(--chart-expenses)",
                }))}
              />
            </Panel>
            <Panel
              title="Latest activity"
              className="lg:col-span-2 xl:col-span-1"
              action={
                <Button variant="link" size="sm" className="h-auto px-0" asChild>
                  <Link to="/activity">See all</Link>
                </Button>
              }
            >
              {data.activity.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted-foreground">Nothing has happened yet.</p>
              ) : (
                <ul className="px-5 pb-3">
                  {data.activity.map((a) => (
                    <li key={a.id} className="border-b border-rule py-2.5 text-sm last:border-0">
                      <p className="leading-snug">{a.summary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.actorName}, {timeAgo(a.createdAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel
            title="Recent invoices"
            action={
              <Button variant="link" size="sm" className="h-auto px-0" asChild>
                <Link to="/invoices">All invoices</Link>
              </Button>
            }
          >
            {data.recentInvoices.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No invoices yet"
                action={
                  can("member") && (
                    <Button asChild>
                      <Link to="/invoices/new">Create your first invoice</Link>
                    </Button>
                  )
                }
              >
                Add a customer and send your first invoice. Payments you record show up here and on the charts.
              </EmptyState>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <tbody>
                    {data.recentInvoices.map((inv) => (
                      <tr key={inv.id} className="border-t border-rule hover:bg-accent/40">
                        <td className="py-2.5 pl-5">
                          <Link to={`/invoices/${inv.id}`} className="font-semibold hover:text-primary hover:underline">
                            {inv.number}
                          </Link>
                        </td>
                        <td className="py-2.5">{inv.customerName}</td>
                        <td className="py-2.5 text-muted-foreground">{formatDate(inv.issueDate)}</td>
                        <td className="tabular py-2.5 text-right">{formatMoney(inv.total, currency)}</td>
                        <td className="py-2.5 pr-5 pl-4 text-right">
                          <StatusBadge status={inv.displayStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  )
}

/** The one headline figure, money received this month, with the rest of the month's position beside it. */
function MoneyBand({ data, currency }: { data: NonNullable<Awaited<ReturnType<typeof api.dashboard>>>; currency: string }) {
  const k = data.kpis
  const base = k.revenueLastMonthToDate
  const change = base > 0 ? (k.revenueThisMonth - base) / base : null
  const day = Number(data.today.slice(8, 10))

  return (
    <section className="grid overflow-hidden rounded-xl border bg-card lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
      <div className="border-b p-5 sm:p-6 lg:border-r lg:border-b-0">
        <h2 className="text-sm font-medium text-muted-foreground">Received this month</h2>
        <p className="mt-2 flex items-baseline gap-2 leading-none font-bold tracking-tight">
          <span className="text-xl text-muted-foreground">{currency}</span>
          <span className="text-[2.6rem] sm:text-5xl">{formatMoneyShort(k.revenueThisMonth, currency, { symbol: false })}</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{formatMoney(k.revenueThisMonth, currency)}</p>
        {change !== null && (
          <p className="mt-4 flex items-center gap-1.5 text-sm">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                change >= 0
                  ? "bg-[var(--status-paid-bg)] text-[var(--status-paid)]"
                  : "bg-[var(--status-overdue-bg)] text-[var(--status-overdue)]",
              )}
            >
              {change >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(Math.round(change * 100))}%
            </span>
            <span className="text-muted-foreground">
              {change >= 0 ? "more" : "less"} than days 1–{day} of last month
            </span>
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4">
        <Figure label="Spent this month" value={formatMoneyShort(k.expensesThisMonth, currency, { symbol: false })}>
          <Link to="/expenses" className="hover:text-foreground hover:underline">
            See expenses
          </Link>
        </Figure>
        <Figure
          label="Profit this month"
          value={formatMoneyShort(k.profitThisMonth, currency, { symbol: false })}
          tone={k.profitThisMonth < 0 ? "bad" : undefined}
        >
          Received minus spent
        </Figure>
        <Figure label="Waiting to be paid" value={formatMoneyShort(k.outstanding, currency, { symbol: false })}>
          <Link to="/invoices?status=unpaid" className="hover:text-foreground hover:underline">
            {k.outstandingCount} {k.outstandingCount === 1 ? "invoice" : "invoices"}
          </Link>
          {k.avgDaysToPay !== null && <span className="block">Paid in {Math.round(k.avgDaysToPay)} days on average</span>}
        </Figure>
        <Figure
          label="Overdue"
          value={formatMoneyShort(k.overdue, currency, { symbol: false })}
          tone={k.overdueCount > 0 ? "bad" : undefined}
          icon={k.overdueCount > 0}
        >
          <Link to="/invoices?status=overdue" className="hover:text-foreground hover:underline">
            {k.overdueCount} {k.overdueCount === 1 ? "invoice" : "invoices"} past due
          </Link>
        </Figure>
      </dl>
    </section>
  )
}

function Figure({
  label,
  value,
  tone,
  icon,
  children,
}: {
  label: string
  value: string
  tone?: "bad"
  icon?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="border-b border-rule p-5 odd:border-r sm:border-b-0 sm:border-r sm:last:border-r-0 sm:p-6">
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {icon && <AlertCircle className="size-4 text-[var(--status-overdue)]" aria-hidden="true" />}
        {label}
      </dt>
      <dd className={cn("mt-2 text-xl font-bold tracking-tight whitespace-nowrap xl:text-2xl", tone === "bad" && "text-[var(--status-overdue)]")}>
        {value}
      </dd>
      {children && <dd className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{children}</dd>}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5">
      <Skeleton className="h-44 rounded-xl" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  )
}
