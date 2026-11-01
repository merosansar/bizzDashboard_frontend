import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Archive, ArchiveRestore, ArrowLeft, FileText, Pencil, Plus } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAuth, useSession } from "@/features/auth"
import { CustomerDialog } from "@/features/customer-dialog"
import { Detail, EmptyState, ErrorState, PageHeader, Pagination, Panel, Spinner, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui/button"

export default function CustomerDetailPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const currency = useSession().organization.currency
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [page, setPage] = useState(1)

  const customer = useQuery({ queryKey: ["customer", id], queryFn: () => api.customers.get(id!) })
  const invoices = useQuery({
    queryKey: ["invoices", { customerId: id, page }],
    queryFn: () => api.invoices.list({ customerId: id, page, pageSize: 10 }),
  })

  const archive = useMutation({
    mutationFn: (archived: boolean) => api.customers.update(id!, { archived }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["customer", id], saved)
      queryClient.invalidateQueries({ queryKey: ["customers"] })
      toast.success(saved.archived ? `${saved.name} archived` : `${saved.name} restored`)
    },
    onError: (e) => toast.error(e.message),
  })

  if (customer.error) return <ErrorState error={customer.error} onRetry={() => customer.refetch()} />
  if (!customer.data) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    )
  }
  const c = customer.data

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground" asChild>
        <Link to="/customers">
          <ArrowLeft />
          Customers
        </Link>
      </Button>
      <PageHeader
        title={c.name}
        description={
          <>
            {c.city ?? "No city"}, customer since {formatDate(c.createdAt.slice(0, 10))}
            {c.archived && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">Archived</span>}
          </>
        }
        actions={
          can("member") && (
            <>
              <Button
                variant="outline"
                onClick={() => archive.mutate(!c.archived)}
                disabled={archive.isPending}
              >
                {c.archived ? <ArchiveRestore /> : <Archive />}
                {c.archived ? "Restore" : "Archive"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                Edit
              </Button>
              {!c.archived && (
                <Button
                  onClick={() =>
                    navigate(`/invoices/new?customer=${c.id}&customerName=${encodeURIComponent(c.name)}`)
                  }
                >
                  <Plus />
                  New invoice
                </Button>
              )}
            </>
          )
        }
      />

      <section className="mb-5 grid grid-cols-2 overflow-hidden rounded-xl border bg-card sm:grid-cols-4">
        <Stat label="Billed" value={formatMoney(c.stats.totalBilled, currency)} />
        <Stat label="Paid" value={formatMoney(c.stats.totalPaid, currency)} />
        <Stat label="Still owes" value={formatMoney(c.stats.outstanding, currency)} strong />
        <Stat
          label="Overdue"
          value={formatMoney(c.stats.overdue, currency)}
          tone={c.stats.overdue > 0 ? "bad" : undefined}
          note={c.stats.lastInvoiceDate ? `Last invoiced ${formatDate(c.stats.lastInvoiceDate)}` : "Not invoiced yet"}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <Panel title="Details" bodyClassName="px-5 pb-5">
          <dl className="grid gap-3 text-sm">
            <Detail label="Email">{c.email}</Detail>
            <Detail label="Phone">{c.phone}</Detail>
            <Detail label="Address">{[c.address, c.city].filter(Boolean).join(", ") || null}</Detail>
            <Detail label="PAN / VAT number">{c.panNumber}</Detail>
            {c.notes && <Detail label="Notes">{c.notes}</Detail>}
          </dl>
        </Panel>

        <Panel title="Invoices" description={invoices.data ? `${invoices.data.total} in total` : undefined}>
          {invoices.error ? (
            <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />
          ) : !invoices.data ? (
            <div className="p-6">
              <Spinner />
            </div>
          ) : invoices.data.items.length === 0 ? (
            <EmptyState icon={FileText} title="No invoices yet">
              Invoices you create for {c.name} show up here.
            </EmptyState>
          ) : (
            <>
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-y text-left text-xs text-muted-foreground">
                      <th className="py-2 pl-5 font-medium">Number</th>
                      <th className="py-2 font-medium">Issued</th>
                      <th className="py-2 text-right font-medium">Total</th>
                      <th className="py-2 text-right font-medium">Owed</th>
                      <th className="py-2 pr-5 pl-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.data.items.map((inv) => (
                      <tr key={inv.id} className="border-b border-rule last:border-0 hover:bg-accent/40">
                        <td className="py-2.5 pl-5">
                          <Link to={`/invoices/${inv.id}`} className="font-semibold hover:text-primary hover:underline">
                            {inv.number}
                          </Link>
                        </td>
                        <td className="py-2.5 text-muted-foreground">{formatDate(inv.issueDate)}</td>
                        <td className="tabular py-2.5 text-right">{formatMoney(inv.total, currency, { symbol: false })}</td>
                        <td className="tabular py-2.5 text-right">
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
                page={invoices.data.page}
                totalPages={invoices.data.totalPages}
                total={invoices.data.total}
                noun="invoices"
                onPage={setPage}
              />
            </>
          )}
        </Panel>
      </div>

      <CustomerDialog open={editing} onOpenChange={setEditing} customer={c} />
    </>
  )
}

function Stat({
  label,
  value,
  strong,
  tone,
  note,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: "bad"
  note?: string
}) {
  return (
    <div className="border-b border-rule p-4 odd:border-r sm:border-b-0 sm:border-r sm:last:border-r-0 sm:p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tabular mt-1 text-lg font-semibold",
          strong && "font-bold",
          tone === "bad" && "text-[var(--status-overdue)]",
        )}
      >
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}
