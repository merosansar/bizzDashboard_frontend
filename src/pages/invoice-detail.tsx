import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { ArrowLeft, Ban, Banknote, Loader2, MoreHorizontal, Pencil, Printer, Send, Trash2, X } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, formatDateTime, formatMoney, PAYMENT_METHOD_LABELS, todayInNepal } from "@/lib/format"
import type { InvoiceDetail, PaymentMethod } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useAuth } from "@/features/auth"
import { ErrorState, Field, Panel, Spinner, StatusBadge } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const { data: invoice, error, refetch } = useQuery({ queryKey: ["invoice", id], queryFn: () => api.invoices.get(id!) })

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!invoice) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    )
  }
  return <InvoiceView invoice={invoice} />
}

function useInvoiceAction(invoice: InvoiceDetail) {
  const queryClient = useQueryClient()
  return (saved: InvoiceDetail) => {
    queryClient.setQueryData(["invoice", invoice.id], saved)
    queryClient.invalidateQueries({ queryKey: ["invoices"] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    queryClient.invalidateQueries({ queryKey: ["customer", invoice.customer.id] })
    queryClient.invalidateQueries({ queryKey: ["activity"] })
  }
}

function InvoiceView({ invoice }: { invoice: InvoiceDetail }) {
  const { can } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const applySaved = useInvoiceAction(invoice)
  const [paying, setPaying] = useState(false)
  const [confirm, setConfirm] = useState<null | "void" | "delete">(null)
  const [removing, setRemoving] = useState<InvoiceDetail["payments"][number] | null>(null)
  const [stampKey, setStampKey] = useState(0)
  const currency = invoice.organization.currency

  const send = useMutation({
    mutationFn: () => api.invoices.send(invoice.id),
    onSuccess: (saved) => {
      applySaved(saved)
      toast.success(`${saved.number} marked as sent`)
    },
    onError: (e) => toast.error(e.message),
  })
  const voidIt = useMutation({
    mutationFn: () => api.invoices.void(invoice.id),
    onSuccess: (saved) => {
      applySaved(saved)
      setConfirm(null)
      setStampKey((k) => k + 1)
      toast.success(`${saved.number} voided`)
    },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => api.invoices.remove(invoice.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["invoice", invoice.id] })
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success(`Draft ${invoice.number} deleted`)
      navigate("/invoices")
    },
    onError: (e) => toast.error(e.message),
  })
  const deletePayment = useMutation({
    mutationFn: (paymentId: string) => api.invoices.deletePayment(invoice.id, paymentId),
    onSuccess: (saved) => {
      applySaved(saved)
      setRemoving(null)
      toast.success("Payment removed")
    },
    onError: (e) => toast.error(e.message),
  })

  const isDraft = invoice.status === "draft"
  const canPay = invoice.status === "sent" || invoice.status === "partial"

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
          <Link to="/invoices">
            <ArrowLeft />
            Invoices
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer />
            Print or save PDF
          </Button>
          {can("member") && isDraft && (
            <>
              <Button variant="outline" asChild>
                <Link to={`/invoices/${invoice.id}/edit`}>
                  <Pencil />
                  Edit
                </Link>
              </Button>
              <Button onClick={() => send.mutate()} disabled={send.isPending}>
                {send.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Mark as sent
              </Button>
            </>
          )}
          {can("member") && canPay && (
            <Button onClick={() => setPaying(true)}>
              <Banknote />
              Record payment
            </Button>
          )}
          {can("member") && (isDraft || (can("admin") && invoice.status !== "void")) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {can("admin") && invoice.status !== "void" && !isDraft && (
                  <DropdownMenuItem onSelect={() => setConfirm("void")} disabled={invoice.amountPaid > 0}>
                    <Ban />
                    Void invoice
                  </DropdownMenuItem>
                )}
                {isDraft && (
                  <>
                    <DropdownMenuSeparator className="first:hidden" />
                    <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("delete")}>
                      <Trash2 />
                      Delete draft
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <InvoicePaper invoice={invoice} stampKey={stampKey} />

        <aside className="no-print grid gap-5">
          <Panel title="Summary" bodyClassName="px-5 pb-5">
            <div className="mb-4">
              <StatusBadge status={invoice.displayStatus} />
              {invoice.displayStatus === "overdue" && (
                <p className="mt-2 text-sm text-[var(--status-overdue)]">
                  {invoice.daysOverdue} {invoice.daysOverdue === 1 ? "day" : "days"} past the due date
                </p>
              )}
            </div>
            <dl className="tabular grid gap-2 text-sm">
              <Row label="Total" value={formatMoney(invoice.total, currency)} />
              <Row label="Paid" value={formatMoney(invoice.amountPaid, currency)} />
              <Row
                label="Still owed"
                value={formatMoney(invoice.status === "void" ? 0 : invoice.balance, currency)}
                strong
              />
            </dl>
            <p className="mt-4 text-sm">
              <span className="text-muted-foreground">Customer </span>
              <Link to={`/customers/${invoice.customer.id}`} className="font-medium hover:text-primary hover:underline">
                {invoice.customer.name}
              </Link>
            </p>
          </Panel>

          <Panel title="Payments" description={invoice.payments.length === 0 ? "None recorded yet." : undefined}>
            {invoice.payments.length > 0 && (
              <ul className="px-5 pb-3">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 border-b border-rule py-2.5 last:border-0">
                    <div className="min-w-0 text-sm">
                      <p className="tabular font-semibold">{formatMoney(p.amount, currency)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(p.paidOn)}, {PAYMENT_METHOD_LABELS[p.method]}
                        {p.reference && <>, ref {p.reference}</>}
                      </p>
                      {p.recordedBy && <p className="text-xs text-muted-foreground">Recorded by {p.recordedBy}</p>}
                    </div>
                    {can("admin") && invoice.status !== "void" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove payment of ${formatMoney(p.amount, currency)}`}
                        disabled={deletePayment.isPending}
                        onClick={() => setRemoving(p)}
                      >
                        <X />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="History">
            <ol className="px-5 pb-4 text-sm">
              <TimelineItem when={invoice.createdAt}>
                Created{invoice.createdBy && <> by {invoice.createdBy.fullName}</>}
              </TimelineItem>
              {invoice.sentAt && <TimelineItem when={invoice.sentAt}>Marked as sent</TimelineItem>}
              {invoice.payments.map((p) => (
                <TimelineItem key={p.id} when={p.createdAt}>
                  {formatMoney(p.amount, currency)} received
                </TimelineItem>
              ))}
              {invoice.paidAt && <TimelineItem when={invoice.paidAt}>Paid in full</TimelineItem>}
              {invoice.voidedAt && <TimelineItem when={invoice.voidedAt}>Voided</TimelineItem>}
            </ol>
          </Panel>
        </aside>
      </div>

      <PaymentDialog
        invoice={invoice}
        open={paying}
        onOpenChange={setPaying}
        onSaved={(saved) => {
          applySaved(saved)
          if (saved.status === "paid") setStampKey((k) => k + 1)
        }}
      />

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this payment?</DialogTitle>
            <DialogDescription>
              {removing &&
                `${formatMoney(removing.amount, currency)} received on ${formatDate(removing.paidOn)}. The invoice goes back to owing this amount.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={deletePayment.isPending}
              onClick={() => removing && deletePayment.mutate(removing.id)}
            >
              {deletePayment.isPending && <Loader2 className="animate-spin" />}
              Remove payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm === "void" ? `Void ${invoice.number}?` : `Delete draft ${invoice.number}?`}</DialogTitle>
            <DialogDescription>
              {confirm === "void"
                ? "It stays in your records, marked void, and stops counting as money owed. This can’t be undone."
                : "The draft is removed for good. Its number won’t be reused."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={voidIt.isPending || remove.isPending}
              onClick={() => (confirm === "void" ? voidIt.mutate() : remove.mutate())}
            >
              {(voidIt.isPending || remove.isPending) && <Loader2 className="animate-spin" />}
              {confirm === "void" ? "Void invoice" : "Delete draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "border-t pt-2 font-bold")}>
      <dt className={cn(!strong && "text-muted-foreground")}>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function TimelineItem({ when, children }: { when: string; children: React.ReactNode }) {
  return (
    <li className="relative border-l border-rule py-1.5 pl-4 before:absolute before:top-3 before:-left-[4.5px] before:size-2 before:rounded-full before:bg-primary/60">
      <p>{children}</p>
      <p className="text-xs text-muted-foreground">{formatDateTime(when)}</p>
    </li>
  )
}

/* ---- The invoice as printed ------------------------------------------------------ */

const STAMPS: Partial<Record<InvoiceDetail["displayStatus"], { word: string; color: string }>> = {
  paid: { word: "Paid", color: "var(--stamp-paid)" },
  overdue: { word: "Overdue", color: "var(--stamp-overdue)" },
  void: { word: "Void", color: "var(--stamp-void)" },
  draft: { word: "Draft", color: "var(--stamp-draft)" },
}

function InvoicePaper({ invoice, stampKey }: { invoice: InvoiceDetail; stampKey: number }) {
  const org = invoice.organization
  const currency = org.currency
  const stamp = STAMPS[invoice.displayStatus]
  const stampDate =
    invoice.displayStatus === "paid" && invoice.paidAt
      ? formatDate(invoice.paidAt.slice(0, 10))
      : invoice.displayStatus === "void" && invoice.voidedAt
        ? formatDate(invoice.voidedAt.slice(0, 10))
        : null
  const vatRates = [...new Set(invoice.items.filter((i) => i.lineTax > 0).map((i) => i.taxRate))]

  return (
    <article
      className="print-area rounded-xl border bg-card p-6 shadow-[0_1px_0_var(--rule),0_16px_40px_-20px_rgb(23_32_58/0.25)] sm:p-10"
      aria-label={`Invoice ${invoice.number}`}
    >
      <header className="flex flex-col gap-6 border-b pb-6 sm:flex-row sm:justify-between">
        <div className="max-w-xs">
          <p className="text-lg font-bold">{org.name}</p>
          <address className="mt-1 text-sm leading-relaxed text-muted-foreground not-italic">
            {org.address && <span className="block">{org.address}</span>}
            {org.phone && <span className="block">{org.phone}</span>}
            {org.email && <span className="block">{org.email}</span>}
            {org.panNumber && <span className="block">PAN {org.panNumber}</span>}
          </address>
        </div>
        <div className="sm:text-right">
          <h1 className="text-2xl font-bold tracking-tight">{vatRates.length ? "Tax invoice" : "Invoice"}</h1>
          <dl className="mt-2 grid grid-cols-[auto_auto] justify-start gap-x-4 gap-y-0.5 text-sm sm:justify-end">
            <dt className="text-muted-foreground">Number</dt>
            <dd className="font-semibold">{invoice.number}</dd>
            <dt className="text-muted-foreground">Issued</dt>
            <dd>{formatDate(invoice.issueDate)}</dd>
            <dt className="text-muted-foreground">Due</dt>
            <dd>{formatDate(invoice.dueDate)}</dd>
          </dl>
        </div>
      </header>

      <section className="flex items-start justify-between gap-6 py-6">
        <div className="min-w-0">
        <h2 className="text-xs font-medium text-muted-foreground">Bill to</h2>
        <p className="mt-1 font-semibold">{invoice.customer.name}</p>
        <address className="text-sm leading-relaxed text-muted-foreground not-italic">
          {invoice.customer.address && <span className="block">{invoice.customer.address}</span>}
          {invoice.customer.city && !invoice.customer.address?.includes(invoice.customer.city) && (
            <span className="block">{invoice.customer.city}</span>
          )}
          {invoice.customer.email && <span className="block">{invoice.customer.email}</span>}
          {invoice.customer.panNumber && <span className="block">PAN {invoice.customer.panNumber}</span>}
        </address>
        </div>
        {stamp && (
          <div
            key={stampKey}
            className={cn("stamp pointer-events-none mt-3 mr-2 shrink-0 text-2xl sm:mr-6 sm:text-3xl", stampKey > 0 && "stamp-in")}
            style={{ color: stamp.color }}
            aria-hidden="true"
          >
            {stamp.word}
            {stampDate && <span className="text-[0.6rem] tracking-[0.08em]">{stampDate}</span>}
          </div>
        )}
      </section>

      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-y text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Description</th>
              <th className="py-2 pr-3 text-right font-medium">Qty</th>
              <th className="py-2 pr-3 text-right font-medium">Rate</th>
              <th className="py-2 pr-3 text-right font-medium">VAT</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {invoice.items.map((line) => (
              <tr key={line.id} className="border-b border-rule align-top">
                <td className="py-2.5 pr-3">{line.description}</td>
                <td className="py-2.5 pr-3 text-right">{line.quantity.toLocaleString("en-IN")}</td>
                <td className="py-2.5 pr-3 text-right">{formatMoney(line.unitPrice, currency, { symbol: false })}</td>
                <td className="py-2.5 pr-3 text-right">{line.taxRate > 0 ? `${line.taxRate}%` : "—"}</td>
                <td className="py-2.5 text-right">{formatMoney(line.lineSubtotal, currency, { symbol: false })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm text-sm text-muted-foreground">
          {invoice.notes && <p className="whitespace-pre-line">{invoice.notes}</p>}
        </div>
        <dl className="tabular grid min-w-[17rem] gap-1.5 text-sm">
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatMoney(invoice.subtotal, currency)}</dd>
          </div>
          <div className="flex justify-between gap-8">
            <dt className="text-muted-foreground">VAT{vatRates.length === 1 && ` (${vatRates[0]}%)`}</dt>
            <dd>{formatMoney(invoice.taxTotal, currency)}</dd>
          </div>
          <div className="flex justify-between gap-8 border-t pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd>{formatMoney(invoice.total, currency)}</dd>
          </div>
          {invoice.amountPaid > 0 && (
            <div className="flex justify-between gap-8">
              <dt className="text-muted-foreground">Paid</dt>
              <dd>−{formatMoney(invoice.amountPaid, currency)}</dd>
            </div>
          )}
          {invoice.status !== "void" && invoice.status !== "draft" && (
            <div className="flex justify-between gap-8 rounded-md bg-secondary px-3 py-2 font-bold">
              <dt>Balance due</dt>
              <dd>{formatMoney(invoice.balance, currency)}</dd>
            </div>
          )}
        </dl>
      </div>

      {org.invoiceFooter && <footer className="mt-10 border-t pt-4 text-xs leading-relaxed text-muted-foreground">{org.invoiceFooter}</footer>}
    </article>
  )
}

/* ---- Record a payment -------------------------------------------------------------- */

const METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]

function PaymentDialog({
  invoice,
  open,
  onOpenChange,
  onSaved,
}: {
  invoice: InvoiceDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (saved: InvoiceDetail) => void
}) {
  const currency = invoice.organization.currency
  const today = todayInNepal()
  const schema = z.object({
    amount: z
      .number({ error: "Enter an amount." })
      .refine((n) => n > 0, "Enter an amount more than 0.")
      .refine((n) => Math.round(n * 100) <= Math.round(invoice.balance * 100), `No more than the ${formatMoney(invoice.balance, currency)} owed.`),
    paidOn: z
      .string()
      .min(1, "Pick a date.")
      .refine((d) => d <= today, "Can’t be in the future.")
      .refine((d) => d >= invoice.issueDate, "Can’t be before the invoice date."),
    method: z.string(),
    reference: z.string().max(100),
  })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: { amount: invoice.balance, paidOn: today, method: "bank_transfer", reference: "" },
  })
  const { errors } = form.formState

  const save = useMutation({
    mutationFn: (v: Values) =>
      api.invoices.recordPayment(invoice.id, {
        amount: v.amount,
        paidOn: v.paidOn,
        method: v.method as PaymentMethod,
        reference: v.reference.trim() || null,
      }),
    onSuccess: (saved) => {
      onSaved(saved)
      onOpenChange(false)
      toast.success(saved.status === "paid" ? `${saved.number} is paid in full` : `Payment recorded for ${saved.number}`)
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              {invoice.number} for {invoice.customer.name}. {formatMoney(invoice.balance, currency)} is still owed.
            </DialogDescription>
          </DialogHeader>
          <Field label={`Amount (${currency})`} htmlFor="pay-amount" error={errors.amount?.message}>
            <Input
              id="pay-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              className="tabular"
              autoFocus
              {...form.register("amount", { valueAsNumber: true })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date received" htmlFor="pay-date" error={errors.paidOn?.message}>
              <Input id="pay-date" type="date" max={today} {...form.register("paidOn")} />
            </Field>
            <Field label="How they paid" htmlFor="pay-method">
              <Select value={form.watch("method")} onValueChange={(v) => form.setValue("method", v)}>
                <SelectTrigger id="pay-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Reference" htmlFor="pay-ref" hint="Transaction ID, cheque number or similar. Optional." error={errors.reference?.message}>
            <Input id="pay-ref" {...form.register("reference")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
