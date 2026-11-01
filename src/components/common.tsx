import type { LucideIcon } from "lucide-react"
import { AlertCircle, Ban, Check, ChevronLeft, ChevronRight, CircleDashed, Clock, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DisplayStatus } from "@/lib/types"

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const STATUS: Record<DisplayStatus, { label: string; icon: LucideIcon; tone: string }> = {
  draft: { label: "Draft", icon: CircleDashed, tone: "draft" },
  sent: { label: "Awaiting payment", icon: Send, tone: "sent" },
  partial: { label: "Partly paid", icon: Clock, tone: "partial" },
  paid: { label: "Paid", icon: Check, tone: "paid" },
  overdue: { label: "Overdue", icon: AlertCircle, tone: "overdue" },
  void: { label: "Void", icon: Ban, tone: "draft" },
}

export function statusLabel(status: DisplayStatus) {
  return STATUS[status].label
}

/** Status always shows an icon and a word, never colour alone. */
export function StatusBadge({ status, className }: { status: DisplayStatus; className?: string }) {
  const s = STATUS[status]
  const Icon = s.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        status === "void" && "line-through decoration-1",
        className,
      )}
      style={{ color: `var(--status-${s.tone})`, backgroundColor: `var(--status-${s.tone}-bg)` }}
    >
      <Icon className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
      {s.label}
    </span>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center" role="alert">
      <span className="grid size-12 place-items-center rounded-full bg-[var(--status-overdue-bg)] text-[var(--status-overdue)]">
        <AlertCircle className="size-5" />
      </span>
      <h3 className="mt-4 font-semibold">Couldn’t load this</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {error instanceof Error ? error.message : "Something went wrong."}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-muted-foreground", className)} aria-label="Loading" />
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-svh place-items-center">
      <Spinner className="size-6" />
    </div>
  )
}

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
  noun = "items",
}: {
  page: number
  totalPages: number
  total: number
  onPage: (page: number) => void
  noun?: string
}) {
  if (total === 0) return null
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:px-5">
      <span className="tabular">
        {total.toLocaleString("en-IN")} {noun}
        {totalPages > 1 && (
          <>
            , page {page} of {totalPages}
          </>
        )}
      </span>
      {totalPages > 1 && (
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft />
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            Next
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  )
}

/** A panel: hairline border, no shadow. Lists inside use ledger rules. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border bg-card text-card-foreground", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn(!title && !action && "pt-1", bodyClassName)}>{children}</div>
    </section>
  )
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

/** Small "Definition" pair used in detail panels. */
export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words">{children ?? "—"}</dd>
    </div>
  )
}
