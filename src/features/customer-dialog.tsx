import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { api } from "@/lib/api"
import type { Customer, CustomerInput } from "@/lib/types"
import { Field } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const optional = z.string().trim().max(250).optional()
const schema = z.object({
  name: z.string().trim().min(2, "Enter the customer’s name.").max(150),
  email: z.union([z.literal(""), z.email("Enter a valid email address.")]).optional(),
  phone: z.string().trim().max(40).optional(),
  address: optional,
  city: z.string().trim().max(80).optional(),
  panNumber: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9A-Za-z-]*$/, "Use only digits and letters.")
    .optional(),
  notes: z.string().trim().max(2000).optional(),
})
type Values = z.infer<typeof schema>

const toInput = (v: Values): CustomerInput => ({
  name: v.name,
  email: v.email || null,
  phone: v.phone || null,
  address: v.address || null,
  city: v.city || null,
  panNumber: v.panNumber || null,
  notes: v.notes || null,
})

export function CustomerDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this customer; omit to add a new one. */
  customer?: Customer
  onSaved?: (customer: Customer) => void
}) {
  const queryClient = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      name: customer?.name ?? "",
      email: customer?.email ?? "",
      phone: customer?.phone ?? "",
      address: customer?.address ?? "",
      city: customer?.city ?? "",
      panNumber: customer?.panNumber ?? "",
      notes: customer?.notes ?? "",
    },
  })
  const { errors } = form.formState

  const save = useMutation({
    mutationFn: (values: Values) =>
      customer ? api.customers.update(customer.id, toInput(values)) : api.customers.create(toInput(values)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] })
      queryClient.invalidateQueries({ queryKey: ["customer", saved.id] })
      toast.success(customer ? "Customer updated" : `Added ${saved.name}`)
      onSaved?.(saved)
      onOpenChange(false)
      form.reset()
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{customer ? "Edit customer" : "Add a customer"}</DialogTitle>
            <DialogDescription>Who you bill. Their details appear on the invoice.</DialogDescription>
          </DialogHeader>

          <Field label="Name" htmlFor="c-name" error={errors.name?.message}>
            <Input id="c-name" autoFocus placeholder="Business or person" {...form.register("name")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="c-email" error={errors.email?.message}>
              <Input id="c-email" type="email" {...form.register("email")} />
            </Field>
            <Field label="Phone" htmlFor="c-phone" error={errors.phone?.message}>
              <Input id="c-phone" type="tel" placeholder="+977 98…" {...form.register("phone")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="Address" htmlFor="c-address" error={errors.address?.message}>
              <Input id="c-address" {...form.register("address")} />
            </Field>
            <Field label="City" htmlFor="c-city" error={errors.city?.message}>
              <Input id="c-city" {...form.register("city")} />
            </Field>
          </div>
          <Field label="PAN / VAT number" htmlFor="c-pan" error={errors.panNumber?.message} hint="Printed on invoices, if they have one.">
            <Input id="c-pan" inputMode="numeric" {...form.register("panNumber")} />
          </Field>
          <Field label="Notes" htmlFor="c-notes" error={errors.notes?.message}>
            <Textarea id="c-notes" rows={2} placeholder="Only you and your team see these" {...form.register("notes")} />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              {customer ? "Save changes" : "Add customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
