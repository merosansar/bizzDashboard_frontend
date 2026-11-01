import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Logo } from "@/components/logo"
import { Input } from "@/components/ui/input"

/** Sign-in and sign-up screens: a card on a ruled khata (ledger) page. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="ledger-paper flex min-h-svh flex-col items-center px-4 py-10 sm:py-16">
      <Logo className="mb-8" />
      <div className="w-full max-w-[25rem] rounded-xl border bg-card p-6 shadow-[0_1px_0_var(--rule),0_12px_32px_-12px_rgb(23_32_58/0.18)] sm:p-8">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

export function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-10" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
