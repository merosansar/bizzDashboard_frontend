import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, Pencil, Plus, Receipt, Search, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { EXPENSE_CATEGORY_LABELS, formatDate, formatMoney, PAYMENT_METHOD_LABELS, todayInNepal } from "@/lib/format"
import type { Expense, ExpenseCategory, PaymentMethod } from "@/lib/types"
import { useDebounced } from "@/lib/use-debounced"
import { cn } from "@/lib/utils"
import { useAuth, useSession } from "@/features/auth"
import { EmptyState, ErrorState, Field, PageHeader, Pagination, Panel } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

const CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]
const METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]

/** Date-range presets, the filter people reach for first. */
function presets(today: string) {
  const [y, m] = today.split("-").map(Number)
  const pad = (n: number) => String(n).padStart(2, "0")
  const monthStart = `${y}-${pad(m)}-01`
  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }
  const prevStart = `${prev.y}-${pad(prev.m)}-01`
  const prevEnd = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10)
  return [
    { key: "month", label: "This month", from: monthStart, to: today },
    { key: "last", label: "Last month", from: prevStart, to: prevEnd },
    { key: "year", label: "This year", from: `${y}-01-01`, to: today },
    { key: "all", label: "All time", from: "", to: "" },
  ]
}

export default function ExpensesPage() {
  const session = useSession()
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const currency = session.organization.currency
  const today = todayInNepal()
  const ranges = presets(today)
  const [params, setParams] = useSearchParams()
  const [range, setRange] = useState("month")
  const [category, setCategory] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Expense | "new" | null>(params.get("new") ? "new" : null)
  const [deleting, setDeleting] = useState<Expense | null>(null)
  const q = useDebounced(search.trim())
  const r = ranges.find((x) => x.key === range) ?? ranges[0]

  const query = { from: r.from, to: r.to, category: category === "all" ? undefined : category, search: q, page, pageSize: 25 }
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["expenses", query],
    queryFn: () => api.expenses.list(query),
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: (e: Expense) => api.expenses.remove(e.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      setDeleting(null)
      toast.success("Expense deleted")
    },
    onError: (e) => toast.error(e.message),
  })

  const closeEditor = () => {
    setEditing(null)
    if (params.get("new")) setParams({}, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Money going out: rent, salaries, stock and everything else."
        actions={
          can("member") && (
            <Button onClick={() => setEditing("new")}>
              <Plus />
              Add expense
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-card p-1" role="group" aria-label="Date range">
          {ranges.map((x) => (
            <button
              key={x.key}
              aria-pressed={range === x.key}
              onClick={() => {
                setRange(x.key)
                setPage(1)
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                range === x.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-52" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search vendor or description"
            className="pl-9"
            aria-label="Search expenses"
          />
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
            icon={Receipt}
            title="No expenses here"
            action={can("member") && <Button onClick={() => setEditing("new")}>Add an expense</Button>}
          >
            Nothing recorded for {r.label.toLowerCase()}
            {category !== "all" && ` in ${EXPENSE_CATEGORY_LABELS[category as ExpenseCategory].toLowerCase()}`}.
          </EmptyState>
        ) : (
          <>
            <div className="border-b px-5 py-3 text-sm">
              <span className="text-muted-foreground">Total for {r.label.toLowerCase()} </span>
              <span className="tabular font-semibold">{formatMoney(data.summary.total, currency)}</span>
            </div>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2.5 pl-5 font-medium">Date</th>
                    <th className="py-2.5 font-medium">Category</th>
                    <th className="py-2.5 font-medium">Paid to</th>
                    <th className="py-2.5 font-medium">Paid by</th>
                    <th className="py-2.5 text-right font-medium">Amount</th>
                    <th className="py-2.5 pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((e) => (
                    <tr key={e.id} className="border-b border-rule last:border-0">
                      <td className="py-2.5 pl-5 whitespace-nowrap text-muted-foreground">{formatDate(e.spentOn)}</td>
                      <td className="py-2.5">{EXPENSE_CATEGORY_LABELS[e.category]}</td>
                      <td className="max-w-[18rem] py-2.5">
                        <span className="block truncate">{e.vendor ?? "—"}</span>
                        {e.description && <span className="block truncate text-xs text-muted-foreground">{e.description}</span>}
                      </td>
                      <td className="py-2.5 text-muted-foreground">{PAYMENT_METHOD_LABELS[e.paymentMethod]}</td>
                      <td className="tabular py-2.5 text-right font-medium whitespace-nowrap">{formatMoney(e.amount, currency)}</td>
                      <td className="py-2.5 pr-5 text-right whitespace-nowrap">
                        {can("member") && (
                          <>
                            <Button variant="ghost" size="icon" aria-label="Edit expense" onClick={() => setEditing(e)}>
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Delete expense"
                              onClick={() => setDeleting(e)}
                            >
                              <Trash2 />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} noun="expenses" onPage={setPage} />
          </>
        )}
      </Panel>

      <ExpenseDialog
        expense={editing === "new" ? undefined : (editing ?? undefined)}
        open={editing !== null}
        onOpenChange={(o) => !o && closeEditor()}
      />

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this expense?</DialogTitle>
            <DialogDescription>
              {deleting && `${EXPENSE_CATEGORY_LABELS[deleting.category]}, ${formatMoney(deleting.amount, currency)} on ${formatDate(deleting.spentOn)}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting)}>
              {remove.isPending && <Loader2 className="animate-spin" />}
              Delete expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ExpenseDialog({
  expense,
  open,
  onOpenChange,
}: {
  expense?: Expense
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const today = todayInNepal()
  const schema = z.object({
    spentOn: z.string().min(1, "Pick a date.").refine((d) => d <= today, "Can’t be in the future."),
    category: z.string().min(1, "Choose a category."),
    amount: z.number({ error: "Enter an amount." }).refine((n) => n > 0, "Enter an amount more than 0."),
    vendor: z.string().max(150),
    description: z.string().max(300),
    paymentMethod: z.string(),
  })
  type Values = z.infer<typeof schema>
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      spentOn: expense?.spentOn ?? today,
      category: expense?.category ?? "",
      amount: expense?.amount ?? (Number.NaN as number),
      vendor: expense?.vendor ?? "",
      description: expense?.description ?? "",
      paymentMethod: expense?.paymentMethod ?? "bank_transfer",
    },
  })
  const { errors } = form.formState

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        spentOn: v.spentOn,
        category: v.category as ExpenseCategory,
        amount: v.amount,
        vendor: v.vendor.trim() || null,
        description: v.description.trim() || null,
        paymentMethod: v.paymentMethod as PaymentMethod,
      }
      return expense ? api.expenses.update(expense.id, body) : api.expenses.create(body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success(expense ? "Expense saved" : "Expense added")
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{expense ? "Edit expense" : "Add an expense"}</DialogTitle>
            <DialogDescription>It counts against this month’s profit on the overview.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date" htmlFor="e-date" error={errors.spentOn?.message}>
              <Input id="e-date" type="date" max={today} {...form.register("spentOn")} />
            </Field>
            <Field label="Amount" htmlFor="e-amount" error={errors.amount?.message}>
              <Input id="e-amount" type="number" step="0.01" min="0" className="tabular" autoFocus {...form.register("amount", { valueAsNumber: true })} />
            </Field>
          </div>
          <Field label="Category" htmlFor="e-category" error={errors.category?.message}>
            <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v, { shouldValidate: true })}>
              <SelectTrigger id="e-category" aria-invalid={!!errors.category || undefined}>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Paid to" htmlFor="e-vendor" error={errors.vendor?.message}>
              <Input id="e-vendor" placeholder="Shop, person or company" {...form.register("vendor")} />
            </Field>
            <Field label="Paid by" htmlFor="e-method">
              <Select value={form.watch("paymentMethod")} onValueChange={(v) => form.setValue("paymentMethod", v)}>
                <SelectTrigger id="e-method">
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
          <Field label="What it was for" htmlFor="e-desc" error={errors.description?.message}>
            <Input id="e-desc" {...form.register("description")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              {expense ? "Save changes" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
