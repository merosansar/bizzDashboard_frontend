import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { api, onSessionChange, refreshSession, setAccessToken } from "@/lib/api"
import type { Role, Session } from "@/lib/types"
import { FullPageSpinner } from "@/components/common"

const RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 }

/** Not a secret: just remembers that a refresh cookie probably exists, so first-time visitors skip the refresh call. */
const HINT = "hisab-signed-in"
const hint = {
  get: () => {
    try {
      return localStorage.getItem(HINT) === "1"
    } catch {
      return true
    }
  },
  set: (on: boolean) => {
    try {
      if (on) localStorage.setItem(HINT, "1")
      else localStorage.removeItem(HINT)
    } catch {
      /* storage blocked */
    }
  },
}

interface AuthValue {
  session: Session | null
  status: "loading" | "signed-in" | "signed-out"
  login: (email: string, password: string) => Promise<void>
  register: (body: { fullName: string; email: string; password: string; organizationName: string }) => Promise<void>
  logout: () => Promise<void>
  switchWorkspace: (organizationId: string) => Promise<void>
  createWorkspace: (name: string) => Promise<void>
  /** Does the signed-in person have at least this role in the current workspace? */
  can: (role: Role) => boolean
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthValue["status"]>(() => (hint.get() ? "loading" : "signed-out"))
  const queryClient = useQueryClient()

  const apply = useCallback((next: Session | null) => {
    setAccessToken(next?.accessToken ?? null)
    hint.set(!!next)
    setSession(next)
    setStatus(next ? "signed-in" : "signed-out")
  }, [])

  // Restore the session from the refresh cookie on first load.
  useEffect(() => {
    onSessionChange(apply)
    if (hint.get()) void refreshSession().then(apply)
  }, [apply])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      status,
      login: async (email, password) => apply(await api.auth.login(email, password)),
      register: async (body) => apply(await api.auth.register(body)),
      logout: async () => {
        try {
          await api.auth.logout()
        } finally {
          apply(null)
          queryClient.clear()
        }
      },
      switchWorkspace: async (organizationId) => {
        const next = await api.auth.switchOrganization(organizationId)
        queryClient.clear()
        apply(next)
      },
      createWorkspace: async (name) => {
        const next = await api.auth.createOrganization(name)
        queryClient.clear()
        apply(next)
      },
      can: (role) => !!session && RANK[session.role] >= RANK[role],
    }),
    [session, status, apply, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}

/** The current session; only use inside <RequireAuth>. */
export function useSession(): Session {
  const { session } = useAuth()
  if (!session) throw new Error("useSession needs a signed-in user")
  return session
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === "loading") return <FullPageSpinner />
  if (status === "signed-out") return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  if (status === "loading") return <FullPageSpinner />
  if (status === "signed-in") return <Navigate to="/" replace />
  return <>{children}</>
}
