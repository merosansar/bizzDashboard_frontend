import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Plus, Search, Users } from "lucide-react"
import { api } from "@/lib/api"
import { formatMoney } from "@/lib/format"
import { useDebounced } from "@/lib/use-debounced"
import { cn } from "@/lib/utils"
import { useAuth, useSession } from "@/features/auth"
import { CustomerDialog } from "@/features/customer-dialog"
import { EmptyState, ErrorState, PageHeader, Pagination, Panel } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"

const SORTS = [
  { value: "name", label: "Name, A to Z" },
  { value: "outstanding", label: "Owes the most" },
  { value: "totalBilled", label: "Billed the most" },
  { value: "createdAt", label: "Newest first" },
]

export default function CustomersPage() {
  const session = useSession()
  const { can } = useAuth()
  const navigate = useNavigate()
  const currency = session.organization.currency
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("name")
  const [archived, setArchived] = useState(false)
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const q = useDebounced(search.trim())

  const query = { search: q, sort, includeArchived: archived, page, pageSize: 25 }
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["customers", query],
    queryFn: () => api.customers.list(query),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <PageHeader
        title="Customers"
        description="Who you bill, what they’ve been billed and what they still owe."
        actions={
          can("member") && (
            <Button onClick={() => setAdding(true)}>
              <Plus />
              Add customer
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search name, email, phone or city"
            className="pl-9"
            aria-label="Search customers"
          />
        </div>
        <Select
          value={sort}
          onValueChange={(v) => {
            setSort(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-48" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch
            checked={archived}
            onCheckedChange={(v) => {
              setArchived(v)
              setPage(1)
            }}
          />
          Show archived
        </label>
      </div>

      <Panel className={cn(isFetching && !isLoading && "opacity-70 transition-opacity")}>
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <div className="grid gap-2 p-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q ? "No customers match" : "No customers yet"}
            action={!q && can("member") && <Button onClick={() => setAdding(true)}>Add your first customer</Button>}
          >
            {q ? "Try a shorter search." : "Add the businesses and people you bill."}
          </EmptyState>
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2.5 pl-5 font-medium">Customer</th>
                    <th className="py-2.5 font-medium">Contact</th>
                    <th className="py-2.5 text-right font-medium">Invoices</th>
                    <th className="py-2.5 text-right font-medium">Billed</th>
                    <th className="py-2.5 pr-5 text-right font-medium">Owes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr
                      key={c.id}
                      className="cursor-pointer border-b border-rule last:border-0 hover:bg-accent/40"
                      onClick={() => navigate(`/customers/${c.id}`)}
                    >
                      <td className="py-2.5 pl-5">
                        <Link
                          to={`/customers/${c.id}`}
                          className="font-semibold hover:text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {c.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {c.city ?? "No city"}
                          {c.archived && ", archived"}
                        </span>
                      </td>
                      <td className="max-w-[16rem] py-2.5 text-muted-foreground">
                        <span className="block truncate">{c.email ?? "—"}</span>
                        {c.phone && <span className="block text-xs">{c.phone}</span>}
                      </td>
                      <td className="tabular py-2.5 text-right">{c.invoiceCount}</td>
                      <td className="tabular py-2.5 text-right">{formatMoney(c.totalBilled, currency, { symbol: false })}</td>
                      <td className="tabular py-2.5 pr-5 text-right">
                        {c.outstanding > 0 ? (
                          <>
                            <span className="font-semibold">{formatMoney(c.outstanding, currency, { symbol: false })}</span>
                            {c.overdue > 0 && (
                              <span className="block text-xs text-[var(--status-overdue)]">
                                {formatMoney(c.overdue, currency, { symbol: false })} overdue
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} noun="customers" onPage={setPage} />
          </>
        )}
      </Panel>

      <CustomerDialog open={adding} onOpenChange={setAdding} onSaved={(c) => navigate(`/customers/${c.id}`)} />
    </>
  )
}
