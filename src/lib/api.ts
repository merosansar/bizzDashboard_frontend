import type {
  ActivityItem,
  Customer,
  CustomerInput,
  CustomerListItem,
  Dashboard,
  Expense,
  ExpenseList,
  InvoiceDetail,
  InvoiceInput,
  InvoiceList,
  Member,
  Organization,
  Page,
  PaymentMethod,
  Product,
  Role,
  Session,
} from "./types"

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/* ---- Session plumbing ---------------------------------------------------------
   The access token lives only in memory. The refresh token is an httpOnly cookie
   the browser sends to /api/auth/*, so JavaScript never sees it. When a request
   gets 401, we refresh once (shared by all requests in flight) and retry.        */

let accessToken: string | null = null
let sessionListener: ((session: Session | null) => void) | null = null
let refreshing: Promise<Session | null> | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

/** Lets the auth provider hear about refreshed or lost sessions. */
export function onSessionChange(listener: (session: Session | null) => void) {
  sessionListener = listener
}

export function refreshSession(): Promise<Session | null> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
    .then(async (res) => (res.ok ? ((await res.json()) as Session) : null))
    .catch(() => null)
    .then((session) => {
      accessToken = session?.accessToken ?? null
      return session
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

type Query = Record<string, string | number | boolean | undefined | null>

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  query?: Query
  /** Return the raw Response (for downloads). */
  raw?: boolean
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(`/api${path}`, window.location.origin)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value))
  }
  return url.pathname + url.search
}

async function send(path: string, options: RequestOptions) {
  return fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res: Response
  try {
    res = await send(path, options)
    if (res.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
      const session = await refreshSession()
      sessionListener?.(session)
      if (session) res = await send(path, options)
    }
  } catch {
    throw new ApiError(
      0,
      "Can’t reach the Hisab API. Make sure the API window is open and shows “API ready on http://localhost:4000”.",
    )
  }

  if (res.status === 502 || res.status === 504) {
    throw new ApiError(res.status, "The Hisab API isn’t running. Start it with start.bat (or npm run start:dev in backend).")
  }
  if (!res.ok) {
    let message = `Something went wrong (${res.status}).`
    try {
      const body = (await res.json()) as { message?: string | string[] }
      if (Array.isArray(body.message)) message = body.message.join(" ")
      else if (body.message) message = body.message
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message)
  }
  if (options.raw) return res as unknown as T
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/* ---- Endpoints --------------------------------------------------------------- */

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<Session>("/auth/login", { method: "POST", body: { email, password } }),
    register: (body: { fullName: string; email: string; password: string; organizationName: string }) =>
      request<Session>("/auth/register", { method: "POST", body }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
    switchOrganization: (organizationId: string) =>
      request<Session>("/auth/switch-organization", { method: "POST", body: { organizationId } }),
    createOrganization: (name: string) => request<Session>("/auth/organizations", { method: "POST", body: { name } }),
  },

  dashboard: () => request<Dashboard>("/dashboard"),

  invoices: {
    list: (query: Query) => request<InvoiceList>("/invoices", { query }),
    get: (id: string) => request<InvoiceDetail>(`/invoices/${id}`),
    create: (body: InvoiceInput) => request<InvoiceDetail>("/invoices", { method: "POST", body }),
    update: (id: string, body: InvoiceInput & { version: number }) =>
      request<InvoiceDetail>(`/invoices/${id}`, { method: "PATCH", body }),
    remove: (id: string) => request<{ deleted: true }>(`/invoices/${id}`, { method: "DELETE" }),
    send: (id: string) => request<InvoiceDetail>(`/invoices/${id}/send`, { method: "POST" }),
    void: (id: string) => request<InvoiceDetail>(`/invoices/${id}/void`, { method: "POST" }),
    recordPayment: (
      id: string,
      body: { amount: number; paidOn: string; method: PaymentMethod; reference?: string | null; note?: string | null },
    ) => request<InvoiceDetail>(`/invoices/${id}/payments`, { method: "POST", body }),
    deletePayment: (id: string, paymentId: string) =>
      request<InvoiceDetail>(`/invoices/${id}/payments/${paymentId}`, { method: "DELETE" }),
    exportCsv: (query: Query) => request<Response>("/invoices/export", { query, raw: true }),
  },

  customers: {
    list: (query: Query) => request<Page<CustomerListItem>>("/customers", { query }),
    get: (id: string) => request<Customer>(`/customers/${id}`),
    create: (body: CustomerInput) => request<Customer>("/customers", { method: "POST", body }),
    update: (id: string, body: Partial<CustomerInput> & { archived?: boolean }) =>
      request<Customer>(`/customers/${id}`, { method: "PATCH", body }),
    remove: (id: string) => request<{ deleted: boolean; archived: boolean }>(`/customers/${id}`, { method: "DELETE" }),
  },

  products: {
    list: (query: Query) => request<Page<Product>>("/products", { query }),
    create: (body: Omit<Product, "id">) => request<Product>("/products", { method: "POST", body }),
    update: (id: string, body: Partial<Omit<Product, "id">>) =>
      request<Product>(`/products/${id}`, { method: "PATCH", body }),
    remove: (id: string) => request<{ deleted: true }>(`/products/${id}`, { method: "DELETE" }),
  },

  expenses: {
    list: (query: Query) => request<ExpenseList>("/expenses", { query }),
    create: (body: Omit<Expense, "id" | "createdAt">) => request<Expense>("/expenses", { method: "POST", body }),
    update: (id: string, body: Partial<Omit<Expense, "id" | "createdAt">>) =>
      request<Expense>(`/expenses/${id}`, { method: "PATCH", body }),
    remove: (id: string) => request<{ deleted: true }>(`/expenses/${id}`, { method: "DELETE" }),
  },

  organization: {
    get: () => request<Organization>("/organization"),
    update: (body: Partial<Omit<Organization, "id" | "nextInvoiceNumber">>) =>
      request<Organization>("/organization", { method: "PATCH", body }),
  },

  members: {
    list: () => request<Member[]>("/members"),
    add: (body: { fullName: string; email: string; role: Role; password: string }) =>
      request<Member[]>("/members", { method: "POST", body }),
    update: (id: string, role: Role) => request<Member[]>(`/members/${id}`, { method: "PATCH", body: { role } }),
    remove: (id: string) => request<{ removed: true }>(`/members/${id}`, { method: "DELETE" }),
  },

  activity: (query: Query) => request<Page<ActivityItem>>("/activity", { query }),
}
