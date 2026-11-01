import { useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, Package, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { formatMoney } from "@/lib/format"
import type { Product } from "@/lib/types"
import { useDebounced } from "@/lib/use-debounced"
import { cn } from "@/lib/utils"
import { useAuth, useSession } from "@/features/auth"
import { EmptyState, ErrorState, Field, PageHeader, Pagination, Panel } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

export default function ProductsPage() {
  const session = useSession()
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const currency = session.organization.currency
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Product | "new" | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const q = useDebounced(search.trim())

  const query = { search: q, page, pageSize: 25 }
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["products", query],
    queryFn: () => api.products.list(query),
    placeholderData: keepPreviousData,
  })

  const toggle = useMutation({
    mutationFn: (p: Product) => api.products.update(p.id, { isActive: !p.isActive }),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success(p.isActive ? `${p.name} is available again` : `${p.name} hidden from new invoices`)
    },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (p: Product) => api.products.remove(p.id),
    onSuccess: (_r, p) => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      setDeleting(null)
      toast.success(`Deleted ${p.name}`)
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <>
      <PageHeader
        title="Products and services"
        description="What you sell. Pick them when writing an invoice to fill in the price and VAT."
        actions={
          can("member") && (
            <Button onClick={() => setEditing("new")}>
              <Plus />
              Add product
            </Button>
          )
        }
      />

      <div className="mb-4 max-w-md">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search name or SKU"
            className="pl-9"
            aria-label="Search products"
          />
        </div>
      </div>

      <Panel className={cn(isFetching && !isLoading && "opacity-70 transition-opacity")}>
        {error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <div className="grid gap-2 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={Package}
            title={q ? "No products match" : "No products yet"}
            action={!q && can("member") && <Button onClick={() => setEditing("new")}>Add a product</Button>}
          >
            {q ? "Try a shorter search." : "Add what you sell so invoices take seconds to write."}
          </EmptyState>
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2.5 pl-5 font-medium">Name</th>
                    <th className="py-2.5 font-medium">SKU</th>
                    <th className="py-2.5 text-right font-medium">Price</th>
                    <th className="py-2.5 text-right font-medium">VAT</th>
                    <th className="py-2.5 pl-6 font-medium">On new invoices</th>
                    <th className="py-2.5 pr-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((p) => (
                    <tr key={p.id} className={cn("border-b border-rule last:border-0", !p.isActive && "text-muted-foreground")}>
                      <td className="py-2.5 pl-5">
                        <span className="font-medium">{p.name}</span>
                        {p.description && <span className="block max-w-md truncate text-xs text-muted-foreground">{p.description}</span>}
                      </td>
                      <td className="py-2.5 text-muted-foreground">{p.sku ?? "—"}</td>
                      <td className="tabular py-2.5 text-right whitespace-nowrap">
                        {formatMoney(p.unitPrice, currency)}
                        <span className="text-muted-foreground"> / {p.unit}</span>
                      </td>
                      <td className="tabular py-2.5 text-right">{p.taxRate > 0 ? `${p.taxRate}%` : "None"}</td>
                      <td className="py-2.5 pl-6">
                        <Switch
                          checked={p.isActive}
                          disabled={!can("member") || toggle.isPending}
                          onCheckedChange={() => toggle.mutate(p)}
                          aria-label={`${p.name} available on new invoices`}
                        />
                      </td>
                      <td className="py-2.5 pr-5 text-right whitespace-nowrap">
                        {can("member") && (
                          <>
                            <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}>
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Delete ${p.name}`}
                              onClick={() => setDeleting(p)}
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
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} noun="products" onPage={setPage} />
          </>
        )}
      </Panel>

      <ProductDialog product={editing === "new" ? undefined : (editing ?? undefined)} open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} />

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              Invoices that already use it keep their lines. To stop offering it without deleting, switch off “On new
              invoices” instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting)}>
              {remove.isPending && <Loader2 className="animate-spin" />}
              Delete product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

const schema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(150),
  sku: z.string().trim().max(40),
  unit: z.string().trim().min(1, "Enter a unit, like pcs or hour.").max(20),
  unitPrice: z.number({ error: "Enter a price." }).min(0, "Can’t be negative."),
  taxRate: z.string(),
  description: z.string().max(2000),
})
type Values = z.infer<typeof schema>

function ProductDialog({
  product,
  open,
  onOpenChange,
}: {
  product?: Product
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      unit: product?.unit ?? "pcs",
      unitPrice: product?.unitPrice ?? 0,
      taxRate: String(product?.taxRate ?? 13),
      description: product?.description ?? "",
    },
  })
  const { errors } = form.formState

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        name: v.name,
        sku: v.sku || null,
        unit: v.unit,
        unitPrice: v.unitPrice,
        taxRate: Number(v.taxRate),
        description: v.description.trim() || null,
        isActive: product?.isActive ?? true,
      }
      return product ? api.products.update(product.id, body) : api.products.create(body)
    },
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast.success(product ? `Saved ${p.name}` : `Added ${p.name}`)
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{product ? "Edit product" : "Add a product or service"}</DialogTitle>
            <DialogDescription>The price and VAT fill in when you pick it on an invoice. You can still change them there.</DialogDescription>
          </DialogHeader>
          <Field label="Name" htmlFor="p-name" error={errors.name?.message}>
            <Input id="p-name" autoFocus {...form.register("name")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU" htmlFor="p-sku" hint="Your own code. Optional." error={errors.sku?.message}>
              <Input id="p-sku" {...form.register("sku")} />
            </Field>
            <Field label="Sold per" htmlFor="p-unit" error={errors.unit?.message}>
              <Input id="p-unit" placeholder="pcs, kg, hour" {...form.register("unit")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price before VAT" htmlFor="p-price" error={errors.unitPrice?.message}>
              <Input id="p-price" type="number" step="0.01" min="0" className="tabular" {...form.register("unitPrice", { valueAsNumber: true })} />
            </Field>
            <Field label="VAT" htmlFor="p-tax">
              <Select value={form.watch("taxRate")} onValueChange={(v) => form.setValue("taxRate", v)}>
                <SelectTrigger id="p-tax">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="13">13% (standard)</SelectItem>
                  <SelectItem value="0">None (exempt)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Description" htmlFor="p-desc" error={errors.description?.message}>
            <Textarea id="p-desc" rows={2} {...form.register("description")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              {product ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
