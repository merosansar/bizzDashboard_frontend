// Shapes returned by the Hisab API.

export type Role = "owner" | "admin" | "member" | "viewer"

export interface Workspace {
  id: string
  name: string
  role: Role
}

export interface Session {
  accessToken: string
  expiresIn: number
  user: { id: string; fullName: string; email: string }
  organization: { id: string; name: string; currency: string }
  role: Role
  workspaces: Workspace[]
}

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "void"
export type DisplayStatus = InvoiceStatus | "overdue"
export type InvoiceFilter = DisplayStatus | "unpaid"

export interface InvoiceListItem {
  id: string
  number: string
  issueDate: string
  dueDate: string
  status: InvoiceStatus
  displayStatus: DisplayStatus
  subtotal: number
  taxTotal: number
  total: number
  amountPaid: number
  balance: number
  customer: { id: string; name: string }
}

export interface InvoiceList extends Page<InvoiceListItem> {
  summary: { count: number; total: number; balance: number }
}

export interface InvoiceLine {
  id: string
  productId: string | null
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  lineSubtotal: number
  lineTax: number
  lineTotal: number
}

export type PaymentMethod = "cash" | "bank_transfer" | "esewa" | "khalti" | "fonepay" | "cheque" | "card"

export interface PaymentRecord {
  id: string
  amount: number
  paidOn: string
  method: PaymentMethod
  reference: string | null
  note: string | null
  recordedBy: string | null
  createdAt: string
}

export interface InvoiceDetail {
  id: string
  number: string
  status: InvoiceStatus
  displayStatus: DisplayStatus
  issueDate: string
  dueDate: string
  daysOverdue: number
  subtotal: number
  taxTotal: number
  total: number
  amountPaid: number
  balance: number
  notes: string | null
  version: number
  sentAt: string | null
  paidAt: string | null
  voidedAt: string | null
  createdAt: string
  createdBy: { id: string; fullName: string } | null
  customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    panNumber: string | null
  }
  items: InvoiceLine[]
  payments: PaymentRecord[]
  organization: {
    name: string
    email: string | null
    phone: string | null
    address: string | null
    panNumber: string | null
    currency: string
    invoiceFooter: string | null
  }
}

export interface InvoiceInput {
  customerId: string
  issueDate: string
  dueDate?: string | null
  notes?: string | null
  items: { productId?: string | null; description: string; quantity: number; unitPrice: number; taxRate: number }[]
}

export interface CustomerListItem {
  id: string
  name: string
  email: string | null
  phone: string | null
  city: string | null
  archived: boolean
  createdAt: string
  invoiceCount: number
  totalBilled: number
  outstanding: number
  overdue: number
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  panNumber: string | null
  notes: string | null
  archived: boolean
  archivedAt: string | null
  createdAt: string
  stats: {
    invoiceCount: number
    totalBilled: number
    totalPaid: number
    outstanding: number
    overdue: number
    lastInvoiceDate: string | null
  }
}

export interface CustomerInput {
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  panNumber?: string | null
  notes?: string | null
}

export interface Product {
  id: string
  name: string
  sku: string | null
  description: string | null
  unit: string
  unitPrice: number
  taxRate: number
  isActive: boolean
}

export type ExpenseCategory =
  | "rent"
  | "salaries"
  | "inventory"
  | "utilities"
  | "marketing"
  | "travel"
  | "software"
  | "office"
  | "taxes"
  | "other"

export interface Expense {
  id: string
  spentOn: string
  category: ExpenseCategory
  vendor: string | null
  description: string | null
  amount: number
  paymentMethod: PaymentMethod
  createdAt: string
}

export interface ExpenseList extends Page<Expense> {
  summary: { total: number }
}

export interface Organization {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  panNumber: string | null
  currency: string
  invoicePrefix: string
  nextInvoiceNumber: number
  paymentTermsDays: number
  defaultTaxRate: number
  invoiceFooter: string | null
}

export interface Member {
  id: string
  userId: string
  fullName: string
  email: string
  role: Role
  joinedAt: string
  lastLoginAt: string | null
  isYou: boolean
}

export interface ActivityItem {
  id: string
  action: string
  entityType: string
  entityId: string | null
  summary: string
  actorName: string
  createdAt: string
}

export interface Dashboard {
  today: string
  kpis: {
    revenueThisMonth: number
    revenueLastMonth: number
    revenueLastMonthToDate: number
    expensesThisMonth: number
    expensesLastMonth: number
    profitThisMonth: number
    outstanding: number
    outstandingCount: number
    overdue: number
    overdueCount: number
    avgDaysToPay: number | null
    drafts: number
  }
  monthly: { month: string; revenue: number; expenses: number; invoiced: number; profit: number }[]
  aging: { bucket: string; amount: number }[]
  topCustomers: { id: string; name: string; revenue: number; outstanding: number }[]
  expensesByCategory: { category: ExpenseCategory; total: number }[]
  recentInvoices: {
    id: string
    number: string
    customerName: string
    issueDate: string
    total: number
    balance: number
    displayStatus: DisplayStatus
  }[]
  activity: ActivityItem[]
}
