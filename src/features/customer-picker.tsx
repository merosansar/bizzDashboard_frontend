import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react"
import { api } from "@/lib/api"
import { useDebounced } from "@/lib/use-debounced"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/common"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CustomerDialog } from "./customer-dialog"

/** Searchable customer chooser with "add a new customer" built in. */
export function CustomerPicker({
  id,
  value,
  label,
  onChange,
  invalid,
}: {
  id: string
  value: string
  /** Name of the selected customer (known by the caller when editing). */
  label: string
  onChange: (customer: { id: string; name: string }) => void
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState("")
  const q = useDebounced(search.trim(), 200)
  const { data, isFetching } = useQuery({
    queryKey: ["customers", "picker", q],
    queryFn: () => api.customers.list({ search: q, pageSize: 8, sort: q ? "name" : "totalBilled" }),
    enabled: open,
  })

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? label : "Choose a customer"}</span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers"
              className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Search customers"
            />
            {isFetching && <Spinner className="size-4" />}
          </div>
          <ul className="max-h-64 overflow-y-auto p-1" role="listbox" aria-label="Customers">
            {data?.items.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">No customers match “{q}”.</li>
            )}
            {data?.items.map((c) => (
              <li key={c.id} role="option" aria-selected={c.id === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ id: c.id, name: c.name })
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    {c.city && <span className="block text-xs text-muted-foreground">{c.city}</span>}
                  </span>
                  {c.id === value && <Check className="size-4 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t p-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setAdding(true)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-primary hover:bg-accent"
            >
              <Plus className="size-4" />
              Add a new customer
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <CustomerDialog open={adding} onOpenChange={setAdding} onSaved={(c) => onChange({ id: c.id, name: c.name })} />
    </>
  )
}
