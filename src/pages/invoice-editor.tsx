import { useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { api, ApiError } from "@/lib/api"
import { addDays, formatMoney, todayInNepal } from "@/lib/format"
import { invoiceTotals } from "@/lib/invoice-math"
import type { InvoiceDetail, InvoiceInput, Organization, Product } from "@/lib/types"
import { useAuth, useSession } from "@/features/auth"
import { CustomerPicker } from "@/features/customer-picker"
import { EmptyState, ErrorState, Field, PageHeader, Panel, Spinner } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Lock } from "lucide-react"

const DATE = /^\d{4}-\d{2}-\d{2}$/
const amount = (message: string) => z.number({ error: message }).refine(Number.isFinite, message)

const lineSchema = z.object({
  productId: z.string().nullable(),
  description: z.string().trim().min(1, "Describe this line.").max(300),
  quantity: amount("Enter a quantity.").refine((n) => n > 0, "More than 0."),
  unitPrice: amount("Enter a price.").refine((n) => n >= 0, "Can’t be negative."),
  taxRate: amount("Enter VAT %.").refine((n) => n >= 0 && n <= 100, "0 to 100."),
})

const schema = z
  .object({
    customerId: z.string().min(1, "Choose a customer."),
    issueDate: z.string().regex(DATE, "Pick a date."),
    dueDate: z.string().regex(DATE, "Pick a date."),
    notes: z.string().max(2000),
    items: z.array(lineSchema).min(1, "Add at least one line."),
  })
  .refine((v) => v.dueDate >= v.issueDate, { path: ["dueDate"], message: "Can’t be before the issue date." })

type Values = z.infer<typeof schema>

export default function InvoiceEditorPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const invoice = useQuery({ queryKey: ["invoice", id], queryFn: () => api.invoices.get(id!), enabled: !!id })
  const org = useQuery({ queryKey: ["organization"], queryFn: api.organization.get })
  const products = useQuery({
    queryKey: ["products", "catalogue"],
    queryFn: () => api.products.list({ activeOnly: true, pageSize: 100 }),
  })

  if (!can("member")) {
    return (
      <Panel>
        <EmptyState icon={Lock} title="You can’t create invoices">
          Viewers can look but not change anything. Ask an admin for member access.
        </EmptyState>
      </Panel>
    )
  }
  const error = invoice.error ?? org.error
  if (error) return <ErrorState error={error} onRetry={() => { invoice.refetch(); org.refetch() }} />
  if ((id && !invoice.data) || !org.data) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner />
      </div>
    )
  }
  if (invoice.data && invoice.data.status !== "draft") {
    return (
      <Panel>
        <EmptyState
          icon={Lock}
          title={`${invoice.data.number} can’t be edited`}
          action={
            <Button asChild variant="outline">
              <Link to={`/invoices/${invoice.data.id}`}>Back to the invoice</Link>
            </Button>
          }
        >
          Only drafts can be edited. Once an invoice is sent, void it and create a new one instead.
        </EmptyState>
      </Panel>
    )
  }
  return <Editor key={invoice.data?.id ?? "new"} invoice={invoice.data} org={org.data} products={products.data?.items ?? []} />
}

const blankLine = (taxRate: number) => ({ productId: null, description: "", quantity: 1, unitPrice: 0, taxRate })

function Editor({ invoice, org, products }: { invoice?: InvoiceDetail; org: Organization; products: Product[] }) {
  const session = useSession()
  const currency = session.organization.currency
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const today = todayInNepal()
  const [customerName, setCustomerName] = useState(invoice?.customer.name ?? params.get("customerName") ?? "")
  const [dueTouched, setDueTouched] = useState(!!invoice)

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: invoice
      ? {
          customerId: invoice.customer.id,
          issueDate: invoice.issueDate,
          dueDate: invoice.dueDate,
          notes: invoice.notes ?? "",
          items: invoice.items.map((i) => ({
            productId: i.productId,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxRate: i.taxRate,
          })),
        }
      : {
          customerId: params.get("customer") ?? "",
          issueDate: today,
          dueDate: addDays(today, org.paymentTermsDays),
          notes: "",
          items: [blankLine(org.defaultTaxRate)],
        },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const items = useWatch({ control: form.control, name: "items" })
  const totals = invoiceTotals(items ?? [])
  const { errors } = form.formState

  const save = useMutation({
    mutationFn: async ({ values, send }: { values: Values; send: boolean }) => {
      const body: InvoiceInput = {
        customerId: values.customerId,
        issueDate: values.issueDate,
        dueDate: values.dueDate,
        notes: values.notes.trim() || null,
        items: values.items.map((i) => ({ ...i, description: i.description.trim() })),
      }
      let saved = invoice
        ? await api.invoices.update(invoice.id, { ...body, version: invoice.version })
        : await api.invoices.create(body)
      if (send) saved = await api.invoices.send(saved.id)
      return { saved, send }
    },
    onSuccess: ({ saved, send }) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.setQueryData(["invoice", saved.id], saved)
      toast.success(send ? `${saved.number} saved and marked as sent` : invoice ? `${saved.number} saved` : `Draft ${saved.number} created`)
      navigate(`/invoices/${saved.id}`)
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(e.message, {
          action: { label: "Reload", onClick: () => queryClient.invalidateQueries({ queryKey: ["invoice", invoice?.id] }) },
        })
      } else toast.error(e.message)
    },
  })

  const submit = (send: boolean) => form.handleSubmit((values) => save.mutate({ values, send }))

  const pickProduct = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    form.setValue(`items.${index}.productId`, product.id)
    form.setValue(`items.${index}.description`, product.name, { shouldValidate: true })
    form.setValue(`items.${index}.unitPrice`, product.unitPrice, { shouldValidate: true })
    form.setValue(`items.${index}.taxRate`, product.taxRate, { shouldValidate: true })
  }

  return (
    <form onSubmit={submit(false)} noValidate>
      <PageHeader
        title={invoice ? `Edit ${invoice.number}` : "New invoice"}
        description={invoice ? "Drafts can be changed until you mark them as sent." : "Saved as a draft until you mark it as sent."}
      />

      <div className="grid grid-cols-1 gap-5">
        <Panel bodyClassName="grid gap-4 p-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Controller
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <Field label="Bill to" htmlFor="customer" error={errors.customerId?.message}>
                <CustomerPicker
                  id="customer"
                  value={field.value}
                  label={customerName || "Selected customer"}
                  invalid={!!errors.customerId}
                  onChange={(c) => {
                    field.onChange(c.id)
                    setCustomerName(c.name)
                  }}
                />
              </Field>
            )}
          />
          <Field label="Issue date" htmlFor="issueDate" error={errors.issueDate?.message}>
            <Input
              id="issueDate"
              type="date"
              {...form.register("issueDate", {
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  if (!dueTouched && DATE.test(e.target.value)) {
                    form.setValue("dueDate", addDays(e.target.value, org.paymentTermsDays), { shouldValidate: true })
                  }
                },
              })}
            />
          </Field>
          <Field
            label="Due date"
            htmlFor="dueDate"
            error={errors.dueDate?.message}
            hint={!dueTouched ? `${org.paymentTermsDays} days, your usual terms` : undefined}
          >
            <Input id="dueDate" type="date" {...form.register("dueDate", { onChange: () => setDueTouched(true) })} />
          </Field>
        </Panel>

        <Panel title="What you’re billing for">
          <div className="hidden grid-cols-[minmax(0,1fr)_6rem_8rem_6.5rem_8.5rem_2.5rem] gap-3 border-y bg-muted/40 px-5 py-2 text-xs font-medium text-muted-foreground md:grid">
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Price</span>
            <span>VAT</span>
            <span className="text-right">Amount</span>
            <span className="sr-only">Remove</span>
          </div>
          <ol>
            {fields.map((field, index) => {
              const lineErrors = errors.items?.[index]
              return (
                <li
                  key={field.id}
                  className="grid gap-3 border-b border-rule px-5 py-4 md:grid-cols-[minmax(0,1fr)_6rem_8rem_6.5rem_8.5rem_2.5rem] md:items-start md:py-3"
                >
                  <div className="grid gap-2">
                    {products.length > 0 && (
                      <Select value={items?.[index]?.productId ?? ""} onValueChange={(v) => pickProduct(index, v)}>
                        <SelectTrigger size="sm" aria-label={`Line ${index + 1} product`} className="text-muted-foreground">
                          <SelectValue placeholder="Pick from your products (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} · {formatMoney(p.unitPrice, currency)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      placeholder="Description"
                      aria-label={`Line ${index + 1} description`}
                      aria-invalid={!!lineErrors?.description || undefined}
                      {...form.register(`items.${index}.description`)}
                    />
                    {lineErrors?.description && <p className="text-xs text-destructive">{lineErrors.description.message}</p>}
                  </div>
                  <LineNumber
                    label="Qty"
                    ariaLabel={`Line ${index + 1} quantity`}
                    error={lineErrors?.quantity?.message}
                    {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                  />
                  <LineNumber
                    label="Price"
                    ariaLabel={`Line ${index + 1} price`}
                    error={lineErrors?.unitPrice?.message}
                    {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                  />
                  <div className="grid gap-1">
                    <span className="text-xs text-muted-foreground md:hidden">VAT</span>
                    <Controller
                      control={form.control}
                      name={`items.${index}.taxRate`}
                      render={({ field: rate }) => (
                        <Select value={String(rate.value)} onValueChange={(v) => rate.onChange(Number(v))}>
                          <SelectTrigger aria-label={`Line ${index + 1} VAT`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="13">13%</SelectItem>
                            <SelectItem value="0">None</SelectItem>
                            {![13, 0].includes(rate.value) && <SelectItem value={String(rate.value)}>{rate.value}%</SelectItem>}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="flex items-center justify-between md:block md:pt-2.5 md:text-right">
                    <span className="text-xs text-muted-foreground md:hidden">Amount</span>
                    <span className="tabular font-semibold">{formatMoney(totals.lines[index]?.total ?? 0, currency, { symbol: false })}</span>
                    {(totals.lines[index]?.tax ?? 0) > 0 && (
                      <span className="tabular block text-xs text-muted-foreground">
                        incl. {formatMoney(totals.lines[index].tax, currency, { symbol: false })} VAT
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="justify-self-end text-muted-foreground hover:text-destructive"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <Trash2 />
                  </Button>
                </li>
              )
            })}
          </ol>
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between">
            <Button type="button" variant="outline" onClick={() => append(blankLine(org.defaultTaxRate))}>
              <Plus />
              Add a line
            </Button>
            <dl className="tabular grid min-w-[16rem] gap-1.5 text-sm">
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatMoney(totals.subtotal, currency)}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">VAT</dt>
                <dd>{formatMoney(totals.tax, currency)}</dd>
              </div>
              <div className="mt-1 flex justify-between gap-8 border-t pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd>{formatMoney(totals.total, currency)}</dd>
              </div>
            </dl>
          </div>
        </Panel>

        <Panel bodyClassName="p-5">
          <Field label="Notes on the invoice" htmlFor="notes" error={errors.notes?.message} hint="Printed under the lines, e.g. delivery details.">
            <Textarea id="notes" rows={3} {...form.register("notes")} />
          </Field>
        </Panel>

        <div className="no-print sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          <span className="mr-auto text-sm text-muted-foreground">
            Total <span className="tabular font-semibold text-foreground">{formatMoney(totals.total, currency)}</span>
          </span>
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" variant="outline" disabled={save.isPending}>
            {save.isPending && !save.variables?.send && <Loader2 className="animate-spin" />}
            Save draft
          </Button>
          <Button type="button" onClick={submit(true)} disabled={save.isPending}>
            {save.isPending && save.variables?.send && <Loader2 className="animate-spin" />}
            Save and mark as sent
          </Button>
        </div>
      </div>
    </form>
  )
}

function LineNumber({
  label,
  ariaLabel,
  error,
  ...props
}: { label: string; ariaLabel: string; error?: string } & React.ComponentProps<"input">) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground md:hidden">{label}</span>
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        aria-label={ariaLabel}
        aria-invalid={!!error || undefined}
        className="tabular text-right"
        {...props}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
