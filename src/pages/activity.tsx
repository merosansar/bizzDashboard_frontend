import { useState } from "react"
import { Link } from "react-router-dom"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate } from "@/lib/format"
import type { ActivityItem } from "@/lib/types"
import { cn } from "@/lib/utils"
import { EmptyState, ErrorState, PageHeader, Pagination, Panel } from "@/components/common"
import { Skeleton } from "@/components/ui/skeleton"

const TYPES = [
  { value: "", label: "Everything" },
  { value: "invoice", label: "Invoices and payments" },
  { value: "customer", label: "Customers" },
  { value: "expense", label: "Expenses" },
  { value: "product", label: "Products" },
  { value: "member", label: "Team" },
  { value: "organization", label: "Settings" },
]

function link(a: ActivityItem): string | null {
  if (!a.entityId) return null
  if (a.entityType === "invoice") return `/invoices/${a.entityId}`
  if (a.entityType === "customer" && a.action !== "customer.deleted") return `/customers/${a.entityId}`
  return null
}

export default function ActivityPage() {
  const [type, setType] = useState("")
  const [page, setPage] = useState(1)
  const query = { entityType: type || undefined, page, pageSize: 40 }
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["activity", query],
    queryFn: () => api.activity(query),
    placeholderData: keepPreviousData,
  })

  // Group by day for a ledger-like read
  const days: { day: string; items: ActivityItem[] }[] = []
  for (const item of data?.items ?? []) {
    const day = new Date(item.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" })
    const last = days.at(-1)
    if (last?.day === day) last.items.push(item)
    else days.push({ day, items: [item] })
  }

  return (
    <>
      <PageHeader title="Activity" description="Who did what in this workspace, newest first." />

      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Show">
        {TYPES.map((t) => (
          <button
            key={t.value}
            aria-pressed={type === t.value}
            onClick={() => {
              setType(t.value)
              setPage(1)
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              type === t.value ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Panel className={cn(isFetching && !isLoading && "opacity-70 transition-opacity")}>
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <div className="grid gap-2 p-5">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState icon={History} title="Nothing here yet">
            Changes people make in this workspace are listed here.
          </EmptyState>
        ) : (
          <>
            {days.map((d) => (
              <section key={d.day}>
                <h2 className="border-b bg-muted/40 px-5 py-2 text-xs font-semibold text-muted-foreground">{formatDate(d.day)}</h2>
                <ul>
                  {d.items.map((a) => {
                    const href = link(a)
                    return (
                      <li key={a.id} className="flex items-baseline gap-4 border-b border-rule px-5 py-2.5 text-sm last:border-0">
                        <time className="tabular w-12 shrink-0 text-xs text-muted-foreground" dateTime={a.createdAt}>
                          {new Date(a.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </time>
                        <span className="min-w-0 flex-1">
                          {href ? (
                            <Link to={href} className="hover:text-primary hover:underline">
                              {a.summary}
                            </Link>
                          ) : (
                            a.summary
                          )}
                        </span>
                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{a.actorName}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} noun="events" onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  )
}
