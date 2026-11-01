import { useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  BarChart3,
  Check,
  ChevronsUpDown,
  FileText,
  History,
  LogOut,
  Menu,
  Moon,
  Package,
  Plus,
  Receipt,
  Settings,
  Sun,
  Users,
} from "lucide-react"
import { useAuth, useSession } from "@/features/auth"
import { initials, ROLE_LABELS } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Logo, LogoMark } from "@/components/logo"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

const NAV = [
  { to: "/", label: "Overview", icon: BarChart3, end: true },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/products", label: "Products", icon: Package },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/activity", label: "Activity", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="grid gap-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-[0.92rem] font-medium transition-colors",
              isActive
                ? "bg-accent text-primary"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )
          }
        >
          <Icon className="size-[18px]" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function WorkspaceSwitcher() {
  const session = useSession()
  const { switchWorkspace } = useAuth()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const change = async (id: string) => {
    if (id === session.organization.id) return
    try {
      await switchWorkspace(id)
      navigate("/")
      toast.success("Switched workspace")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t switch workspace")
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/60"
            aria-label="Switch workspace"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-xs font-bold">
              {initials(session.organization.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{session.organization.name}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_LABELS[session.role]}</span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Your workspaces</DropdownMenuLabel>
          {session.workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onSelect={() => change(w.id)} className="gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary text-[0.7rem] font-bold">
                {initials(w.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{w.name}</span>
                <span className="block text-xs text-muted-foreground">{ROLE_LABELS[w.role]}</span>
              </span>
              {w.id === session.organization.id && <Check className="size-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreating(true)}>
            <Plus />
            Create a workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateWorkspaceDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}

function CreateWorkspaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { createWorkspace } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return
    setBusy(true)
    try {
      await createWorkspace(name.trim())
      onOpenChange(false)
      setName("")
      navigate("/")
      toast.success(`Created ${name.trim()}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn’t create the workspace")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Create a workspace</DialogTitle>
            <DialogDescription>
              A separate set of customers, invoices and expenses, for another business. You’ll be its owner.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <label htmlFor="ws-name" className="text-sm font-medium">
              Business name
            </label>
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={150} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || name.trim().length < 2}>
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function UserMenu({ compact = false }: { compact?: boolean }) {
  const session = useSession()
  const { logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-3 rounded-lg text-left transition-colors hover:bg-accent/60",
            compact ? "p-1" : "w-full px-2 py-2",
          )}
          aria-label="Account menu"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {initials(session.user.fullName)}
          </span>
          {!compact && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{session.user.fullName}</span>
              <span className="block truncate text-xs text-muted-foreground">{session.user.email}</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-56">
        <DropdownMenuLabel>
          <span className="block truncate">{session.user.fullName}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{session.user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun /> : <Moon />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await logout()
            navigate("/login")
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-svh flex-col gap-5 border-r bg-sidebar px-4 py-5 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <WorkspaceSwitcher />
        <NavItems />
        <div className="mt-auto border-t pt-3">
          <UserMenu />
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile top bar */}
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-sidebar/95 px-3 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[19rem] gap-5 bg-sidebar p-4" aria-describedby={undefined}>
              <SheetTitle className="px-2 pt-1">
                <Logo />
              </SheetTitle>
              <WorkspaceSwitcher />
              <NavItems onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <LogoMark className="size-7" />
          <span className="font-bold">Hisab</span>
          <div className="ml-auto flex items-center gap-1">
            <UserMenu compact />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
