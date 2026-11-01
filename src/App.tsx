import { lazy, Suspense } from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ApiError } from "@/lib/api"
import { AuthProvider, GuestOnly, RequireAuth } from "@/features/auth"
import { AppShell } from "@/components/app-shell"
import { FullPageSpinner, Spinner } from "@/components/common"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

const LoginPage = lazy(() => import("@/pages/login"))
const RegisterPage = lazy(() => import("@/pages/register"))
const DashboardPage = lazy(() => import("@/pages/dashboard"))
const InvoicesPage = lazy(() => import("@/pages/invoices"))
const InvoiceEditorPage = lazy(() => import("@/pages/invoice-editor"))
const InvoiceDetailPage = lazy(() => import("@/pages/invoice-detail"))
const CustomersPage = lazy(() => import("@/pages/customers"))
const CustomerDetailPage = lazy(() => import("@/pages/customer-detail"))
const ProductsPage = lazy(() => import("@/pages/products"))
const ExpensesPage = lazy(() => import("@/pages/expenses"))
const ActivityPage = lazy(() => import("@/pages/activity"))
const SettingsPage = lazy(() => import("@/pages/settings"))
const NotFoundPage = lazy(() => import("@/pages/not-found"))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Don't retry "not found" or "not allowed"; do retry network blips once.
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
    },
  },
})

function PageFallback() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <TooltipProvider delayDuration={150}>
              <Suspense fallback={<FullPageSpinner />}>
                <Routes>
                  <Route
                    path="/login"
                    element={
                      <GuestOnly>
                        <LoginPage />
                      </GuestOnly>
                    }
                  />
                  <Route
                    path="/register"
                    element={
                      <GuestOnly>
                        <RegisterPage />
                      </GuestOnly>
                    }
                  />
                  <Route
                    element={
                      <RequireAuth>
                        <AppShell />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<Lazy page={<DashboardPage />} />} />
                    <Route path="invoices" element={<Lazy page={<InvoicesPage />} />} />
                    <Route path="invoices/new" element={<Lazy page={<InvoiceEditorPage />} />} />
                    <Route path="invoices/:id" element={<Lazy page={<InvoiceDetailPage />} />} />
                    <Route path="invoices/:id/edit" element={<Lazy page={<InvoiceEditorPage />} />} />
                    <Route path="customers" element={<Lazy page={<CustomersPage />} />} />
                    <Route path="customers/:id" element={<Lazy page={<CustomerDetailPage />} />} />
                    <Route path="products" element={<Lazy page={<ProductsPage />} />} />
                    <Route path="expenses" element={<Lazy page={<ExpensesPage />} />} />
                    <Route path="activity" element={<Lazy page={<ActivityPage />} />} />
                    <Route path="settings" element={<Lazy page={<SettingsPage />} />} />
                    <Route path="*" element={<Lazy page={<NotFoundPage />} />} />
                  </Route>
                </Routes>
              </Suspense>
              <Toaster position="bottom-right" richColors closeButton />
            </TooltipProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

function Lazy({ page }: { page: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{page}</Suspense>
}
