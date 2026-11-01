import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, Lock, Trash2, UserPlus } from "lucide-react"
import { api } from "@/lib/api"
import { formatDate, ROLE_DESCRIPTIONS, ROLE_LABELS, timeAgo } from "@/lib/format"
import type { Member, Organization, Role } from "@/lib/types"
import { useAuth, useSession } from "@/features/auth"
import { ErrorState, Field, PageHeader, Panel, Spinner } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

const ROLES: Role[] = ["owner", "admin", "member", "viewer"]

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your business details, invoice defaults and the people who can use this workspace." />
      <Tabs defaultValue="business">
        <TabsList className="mb-5">
          <TabsTrigger value="business">Business and invoices</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>
        <TabsContent value="business">
          <BusinessSettings />
        </TabsContent>
        <TabsContent value="team">
          <TeamSettings />
        </TabsContent>
      </Tabs>
    </>
  )
}

/* ---- Business ------------------------------------------------------------------ */

const orgSchema = z.object({
  name: z.string().trim().min(2, "Enter the business name.").max(150),
  panNumber: z.string().trim().max(20),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email("Enter a valid email address.")]),
  address: z.string().trim().max(250),
  currency: z.string(),
  invoicePrefix: z.string().regex(/^[A-Z0-9]{1,10}$/, "1–10 capital letters or digits."),
  paymentTermsDays: z.number({ error: "Enter a number of days." }).int().min(0).max(180, "No more than 180 days."),
  defaultTaxRate: z.string(),
  invoiceFooter: z.string().max(1000),
})
type OrgValues = z.infer<typeof orgSchema>

function BusinessSettings() {
  const { can } = useAuth()
  const { data, error, refetch } = useQuery({ queryKey: ["organization"], queryFn: api.organization.get })
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!data) return <Spinner />
  return <BusinessForm org={data} readOnly={!can("admin")} />
}

function BusinessForm({ org, readOnly }: { org: Organization; readOnly: boolean }) {
  const queryClient = useQueryClient()
  const form = useForm<OrgValues>({
    resolver: zodResolver(orgSchema),
    values: {
      name: org.name,
      panNumber: org.panNumber ?? "",
      phone: org.phone ?? "",
      email: org.email ?? "",
      address: org.address ?? "",
      currency: org.currency,
      invoicePrefix: org.invoicePrefix,
      paymentTermsDays: org.paymentTermsDays,
      defaultTaxRate: String(org.defaultTaxRate),
      invoiceFooter: org.invoiceFooter ?? "",
    },
  })
  const { errors, isDirty } = form.formState
  const prefix = form.watch("invoicePrefix")

  const save = useMutation({
    mutationFn: (v: OrgValues) =>
      api.organization.update({
        ...v,
        panNumber: v.panNumber || null,
        phone: v.phone || null,
        email: v.email || null,
        address: v.address || null,
        invoiceFooter: v.invoiceFooter.trim() || null,
        defaultTaxRate: Number(v.defaultTaxRate),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["organization"], saved)
      queryClient.invalidateQueries({ queryKey: ["invoice"] })
      toast.success("Settings saved")
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
      {readOnly && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4" />
          Only owners and admins can change these settings.
        </p>
      )}
      <fieldset disabled={readOnly} className="grid grid-cols-1 gap-5">
        <Panel title="Business details" description="Printed at the top of every invoice." bodyClassName="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          <Field label="Business name" htmlFor="o-name" error={errors.name?.message} className="sm:col-span-2">
            <Input id="o-name" {...form.register("name")} />
          </Field>
          <Field label="PAN / VAT number" htmlFor="o-pan" error={errors.panNumber?.message}>
            <Input id="o-pan" inputMode="numeric" {...form.register("panNumber")} />
          </Field>
          <Field label="Phone" htmlFor="o-phone" error={errors.phone?.message}>
            <Input id="o-phone" type="tel" {...form.register("phone")} />
          </Field>
          <Field label="Email" htmlFor="o-email" error={errors.email?.message}>
            <Input id="o-email" type="email" {...form.register("email")} />
          </Field>
          <Field label="Address" htmlFor="o-address" error={errors.address?.message}>
            <Input id="o-address" {...form.register("address")} />
          </Field>
        </Panel>

        <Panel title="Invoice defaults" bodyClassName="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Number prefix"
            htmlFor="o-prefix"
            error={errors.invoicePrefix?.message}
            hint={`Next invoice: ${prefix || "INV"}-${String(org.nextInvoiceNumber).padStart(4, "0")}`}
          >
            <Input
              id="o-prefix"
              {...form.register("invoicePrefix", {
                setValueAs: (v: string) => v.toUpperCase(),
              })}
            />
          </Field>
          <Field label="Payment terms (days)" htmlFor="o-terms" error={errors.paymentTermsDays?.message} hint="Sets the due date on new invoices.">
            <Input id="o-terms" type="number" min="0" max="180" {...form.register("paymentTermsDays", { valueAsNumber: true })} />
          </Field>
          <Field label="VAT on new lines" htmlFor="o-vat">
            <Select value={form.watch("defaultTaxRate")} onValueChange={(v) => form.setValue("defaultTaxRate", v, { shouldDirty: true })}>
              <SelectTrigger id="o-vat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="13">13% (standard)</SelectItem>
                <SelectItem value="0">None (not VAT registered)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Currency" htmlFor="o-currency">
            <Select value={form.watch("currency")} onValueChange={(v) => form.setValue("currency", v, { shouldDirty: true })}>
              <SelectTrigger id="o-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["NPR", "INR", "USD", "EUR", "GBP", "AUD"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Invoice footer"
            htmlFor="o-footer"
            error={errors.invoiceFooter?.message}
            hint="Bank details or thank-you note, printed at the bottom."
            className="sm:col-span-2 lg:col-span-4"
          >
            <Textarea id="o-footer" rows={3} {...form.register("invoiceFooter")} />
          </Field>
        </Panel>
      </fieldset>

      {!readOnly && (
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={!isDirty} onClick={() => form.reset()}>
            Discard changes
          </Button>
          <Button type="submit" disabled={!isDirty || save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Save settings
          </Button>
        </div>
      )}
    </form>
  )
}

/* ---- Team ---------------------------------------------------------------------- */

function TeamSettings() {
  const session = useSession()
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Member | null>(null)
  const { data, error, refetch } = useQuery({ queryKey: ["members"], queryFn: api.members.list })

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api.members.update(id, role),
    onSuccess: (members) => {
      queryClient.setQueryData(["members"], members)
      toast.success("Role changed")
    },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: (m: Member) => api.members.remove(m.id),
    onSuccess: (_r, m) => {
      queryClient.invalidateQueries({ queryKey: ["members"] })
      setRemoving(null)
      toast.success(`Removed ${m.fullName}`)
    },
    onError: (e) => toast.error(e.message),
  })

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!data) return <Spinner />

  const isAdmin = can("admin")
  const roleOptions = (m: Member) =>
    ROLES.filter((r) => session.role === "owner" || (r !== "owner" && m.role !== "owner"))

  return (
    <>
      <Panel
        title="People in this workspace"
        description={`${data.length} ${data.length === 1 ? "person" : "people"}. Roles decide what each person can do.`}
        action={
          isAdmin && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <UserPlus />
              Add someone
            </Button>
          )
        }
      >
        <ul>
          {data.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule px-5 py-3">
              <div className="min-w-[12rem] flex-1">
                <p className="font-medium">
                  {m.fullName}
                  {m.isYou && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                </p>
                <p className="text-sm text-muted-foreground">{m.email}</p>
              </div>
              <p className="w-36 text-xs text-muted-foreground">
                Joined {formatDate(m.joinedAt.slice(0, 10))}
                <span className="block">{m.lastLoginAt ? `Last seen ${timeAgo(m.lastLoginAt)}` : "Hasn’t signed in yet"}</span>
              </p>
              {isAdmin && (session.role === "owner" || m.role !== "owner") ? (
                <Select value={m.role} onValueChange={(role) => changeRole.mutate({ id: m.id, role: role as Role })}>
                  <SelectTrigger className="w-32" size="sm" aria-label={`Role for ${m.fullName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions(m).map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="w-32 text-sm">{ROLE_LABELS[m.role]}</span>
              )}
              {(isAdmin || m.isYou) && (session.role === "owner" || m.role !== "owner") ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={m.isYou ? "Leave this workspace" : `Remove ${m.fullName}`}
                  onClick={() => setRemoving(m)}
                >
                  <Trash2 />
                </Button>
              ) : (
                <span className="size-9" />
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="What each role can do" className="mt-5" bodyClassName="px-5 pb-4">
        <dl className="grid gap-x-6 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r} className="flex gap-3 border-b border-rule py-2.5 text-sm">
              <dt className="w-16 shrink-0 font-semibold">{ROLE_LABELS[r]}</dt>
              <dd className="text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <AddMemberDialog open={adding} onOpenChange={setAdding} canAddOwner={session.role === "owner"} />

      <Dialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{removing?.isYou ? "Leave this workspace?" : `Remove ${removing?.fullName}?`}</DialogTitle>
            <DialogDescription>
              {removing?.isYou
                ? "You’ll lose access straight away. Someone with admin rights can add you back."
                : "They lose access straight away. Their past work stays in the records."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => removing && remove.mutate(removing)}>
              {remove.isPending && <Loader2 className="animate-spin" />}
              {removing?.isYou ? "Leave workspace" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

const memberSchema = z.object({
  fullName: z.string().trim().min(2, "Enter their name."),
  email: z.email("Enter a valid email address."),
  role: z.string(),
  password: z.string().min(8, "Use at least 8 characters."),
})
type MemberValues = z.infer<typeof memberSchema>

function AddMemberDialog({
  open,
  onOpenChange,
  canAddOwner,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  canAddOwner: boolean
}) {
  const queryClient = useQueryClient()
  const form = useForm<MemberValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { fullName: "", email: "", role: "member", password: "" },
  })
  const { errors } = form.formState
  const role = form.watch("role") as Role

  const add = useMutation({
    mutationFn: (v: MemberValues) => api.members.add({ ...v, role: v.role as Role }),
    onSuccess: (members, v) => {
      queryClient.setQueryData(["members"], members)
      toast.success(`Added ${v.fullName}`)
      form.reset()
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={form.handleSubmit((v) => add.mutate(v))} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Add someone</DialogTitle>
            <DialogDescription>
              They sign in with this email and the password you set here. If they already use Hisab, they keep their own
              password.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="m-name" error={errors.fullName?.message}>
              <Input id="m-name" autoFocus {...form.register("fullName")} />
            </Field>
            <Field label="Email" htmlFor="m-email" error={errors.email?.message}>
              <Input id="m-email" type="email" {...form.register("email")} />
            </Field>
          </div>
          <Field label="Role" htmlFor="m-role" hint={ROLE_DESCRIPTIONS[role]}>
            <Select value={role} onValueChange={(v) => form.setValue("role", v)}>
              <SelectTrigger id="m-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.filter((r) => canAddOwner || r !== "owner").map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Temporary password" htmlFor="m-password" error={errors.password?.message} hint="Share it with them privately.">
            <Input id="m-password" type="text" autoComplete="new-password" {...form.register("password")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending && <Loader2 className="animate-spin" />}
              Add to workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
