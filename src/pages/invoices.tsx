import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Download, FileText, Plus, Search } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, formatMoney } from "@/lib/format"
import type { InvoiceFilter } from "@/lib/types"
import { useDebounced } from "@/lib/use-debounced"
import { cn } from "@/lib/utils"
import { useAuth, useSession } from "@/features/auth"
import { EmptyState, ErrorState, PageHeader, Pagination, Panel, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

const TABS: { value: InvoiceFilter | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "unpaid", label: "Unpaid" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
]

export default function InvoicesPage() {
  const session = useSession()
  const { can } = useAuth()
  const navigate = useNavigate()
  const currency = session.organization.currency
  const [params, setParams] = useSearchParams()
  const status = (params.get("status") as InvoiceFilter | null) ?? "all"
  const page = Number(params.get("page") ?? 1)
  const from = params.get("from") ?? ""
  const to = params.get("to") ?? ""
  const [search, setSearch] = useState(params.get("q") ?? "")
  const q = useDebounced(search.trim())
  const [exporting, setExporting] = useState(false)

  // Keep the search in the URL (so it survives a reload) and start again from page 1.
  useEffect(() => {
    setParams(
      (current) => {
        if ((current.get("q") ?? "") === q) return current
        const next = new URLSearchParams(current)
        if (q) next.set("q", q)
        else next.delete("q")
        next.delete("page")
        return next
      },
      { replace: true },
    )
  }, [q, setParams])

  const query = { status: status === "all" ? undefined : status, search: q, from, to, page, pageSize: 20 }
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["invoices", query],
    queryFn: () => api.invoices.list(query),
    placeholderData: keepPreviousData,
  })

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!("page" in changes)) next.delete("page")
    setParams(next, { replace: true })
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const res = await api.invoices.exportCsv({ ...query, page: undefined, pageSize: undefined })
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement("a")
      a.href = url
      a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t export")
    } finally {
      setExporting(false)
    }
  }

  const filtered = status !== "all" || q || from || to

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Everything you’ve billed, and what’s still owed."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={exporting || !data?.total}>
              <Download />
              Export CSV
            </Button>
            {can("member") && (
              <Button asChild>
                <Link to="/invoices/new">
                  <Plus />
                  New invoice
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* Filters: one row above the list */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-card p-1" role="tablist" aria-label="Status">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={status === t.value}
              onClick={() => update({ status: t.value === "all" ? null : t.value })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                status === t.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search number or customer"
            className="pl-9"
            aria-label="Search invoices"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Input type="date" value={from} onChange={(e) => update({ from: e.target.value })} className="w-[9.5rem]" aria-label="Issued from" />
          to
          <Input type="date" value={to} onChange={(e) => update({ to: e.target.value })} className="w-[9.5rem]" aria-label="Issued to" />
        </div>
      </div>

      <Panel className={cn(isFetching && !isLoading && "opacity-70 transition-opacity")}>
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <div className="grid gap-2 p-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={filtered ? "No invoices match" : "No invoices yet"}
            action={
              filtered ? (
                <Button variant="outline" onClick={() => { setSearch(""); setParams({}, { replace: true }) }}>
                  Clear filters
                </Button>
              ) : (
                can("member") && (
                  <Button asChild>
                    <Link to="/invoices/new">Create an invoice</Link>
                  </Button>
                )
              )
            }
          >
            {filtered ? "Try another status, a different date range or a shorter search." : "Invoices you create appear here."}
          </EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-b px-5 py-3 text-sm">
              <span>
                <span className="text-muted-foreground">Total billed </span>
                <span className="tabular font-semibold">{formatMoney(data.summary.total, currency)}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Still owed </span>
                <span className="tabular font-semibold">{formatMoney(data.summary.balance, currency)}</span>
              </span>
            </div>
            {/* Phones: one stacked row per invoice */}
            <ul className="sm:hidden">
              {data.items.map((inv) => (
                <li key={inv.id} className="border-b border-rule last:border-0">
                  <Link to={`/invoices/${inv.id}`} className="block px-4 py-3 active:bg-accent/60">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{inv.number}</span>
                      <span className="tabular font-semibold">{formatMoney(inv.total, currency)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-muted-foreground">{inv.customer.name}</span>
                      <StatusBadge status={inv.displayStatus} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Issued {formatDate(inv.issueDate)}, due {formatDate(inv.dueDate)}
                      {inv.balance > 0 && inv.status !== "void" && inv.balance !== inv.total && (
                        <>, {formatMoney(inv.balance, currency)} still owed</>
                      )}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="relative hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2.5 pl-5 font-medium">Number</th>
                    <th className="py-2.5 font-medium">Customer</th>
                    <th className="py-2.5 font-medium">Issued</th>
                    <th className="py-2.5 font-medium">Due</th>
                    <th className="py-2.5 text-right font-medium">Total</th>
                    <th className="py-2.5 text-right font-medium">Owed</th>
                    <th className="py-2.5 pr-5 pl-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((inv) => (
                    <tr
                      key={inv.id}
                      className="cursor-pointer border-b border-rule last:border-0 hover:bg-accent/40"
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                    >
                      <td className="py-2.5 pl-5">
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="font-semibold hover:text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {inv.number}
                        </Link>
                      </td>
                      <td className="max-w-[16rem] truncate py-2.5">{inv.customer.name}</td>
                      <td className="py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(inv.issueDate)}</td>
                      <td
                        className={cn(
                          "py-2.5 whitespace-nowrap",
                          inv.displayStatus === "overdue" ? "text-[var(--status-overdue)]" : "text-muted-foreground",
                        )}
                      >
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="tabular py-2.5 text-right whitespace-nowrap">{formatMoney(inv.total, currency, { symbol: false })}</td>
                      <td className="tabular py-2.5 text-right whitespace-nowrap">
                        {inv.balance > 0 && inv.status !== "void" ? formatMoney(inv.balance, currency, { symbol: false }) : "—"}
                      </td>
                      <td className="py-2.5 pr-5 pl-4">
                        <StatusBadge status={inv.displayStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              noun={data.total === 1 ? "invoice" : "invoices"}
              onPage={(p) => update({ page: String(p) })}
            />
          </>
        )}
      </Panel>
    </>
  )
}
