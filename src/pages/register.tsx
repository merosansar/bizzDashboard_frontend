import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/features/auth"
import { Field } from "@/components/common"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AuthLayout, PasswordInput } from "@/components/auth-layout"

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter your name."),
  organizationName: z.string().trim().min(2, "Enter your business name."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
})
type Values = z.infer<typeof schema>

export default function RegisterPage() {
  const { register: signUp } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", organizationName: "", email: "", password: "" },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = async (values: Values) => {
    setError(null)
    try {
      await signUp(values)
      navigate("/", { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t create your account.")
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="You’ll get an empty workspace for your business. It’s free.">
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        <Field label="Your name" htmlFor="fullName" error={errors.fullName?.message}>
          <Input id="fullName" autoComplete="name" autoFocus {...form.register("fullName")} />
        </Field>
        <Field label="Business name" htmlFor="organizationName" error={errors.organizationName?.message}>
          <Input id="organizationName" autoComplete="organization" {...form.register("organizationName")} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters.">
          <PasswordInput id="password" autoComplete="new-password" {...form.register("password")} />
        </Field>
        {error && (
          <p className="rounded-md bg-[var(--status-overdue-bg)] px-3 py-2 text-sm text-[var(--status-overdue)]" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-1" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
