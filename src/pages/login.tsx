import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/features/auth"
import { Field } from "@/components/common"
import { AuthLayout, PasswordInput } from "@/components/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
})
type Values = z.infer<typeof schema>

const DEMO = [
  { email: "demo@hisab.local", name: "Aarav", role: "Owner", note: "everything" },
  { email: "bikash@hisab.local", name: "Bikash", role: "Member", note: "day-to-day work" },
  { email: "anjali@hisab.local", name: "Anjali", role: "Viewer", note: "read only" },
]

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } })
  const busy = form.formState.isSubmitting

  const onSubmit = async (values: Values) => {
    setError(null)
    try {
      await login(values.email, values.password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== "/login" ? from : "/", { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t sign in.")
    }
  }

  const signInAs = (email: string) => {
    form.setValue("email", email, { shouldValidate: true })
    form.setValue("password", "Demo@1234", { shouldValidate: true })
    void form.handleSubmit(onSubmit)()
  }

  return (
    <AuthLayout title="Sign in" subtitle="Invoices, payments and cash flow for your business.">
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus {...form.register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" {...form.register("password")} />
        </Field>
        {error && (
          <p className="rounded-md bg-[var(--status-overdue-bg)] px-3 py-2 text-sm text-[var(--status-overdue)]" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-1" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          Sign in
        </Button>
      </form>

      <div className="mt-7 border-t pt-5">
        <p className="text-sm font-medium">Try the demo as</p>
        <div className="mt-3 grid gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              disabled={busy}
              onClick={() => signInAs(d.email)}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent/60 disabled:opacity-60"
            >
              <span>
                <span className="font-medium">{d.name}</span>
                <span className="text-muted-foreground">, {d.role.toLowerCase()}</span>
              </span>
              <span className="text-xs text-muted-foreground">{d.note}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Demo password for everyone: Demo@1234</p>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
