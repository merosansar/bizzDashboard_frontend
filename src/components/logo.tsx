import { cn } from "@/lib/utils"

// "हि", the first letter of हिसाब (hisab, "accounts"), drawn from Mukta Bold so it
// renders the same everywhere without loading a Devanagari font.
const GLYPH =
  "M7.2 0L7.2-54.5L-1-54.5L-1-63.9L6.8-63.9Q6.4-64.8 6-66.4Q5.6-67.9 5.6-69.6Q5.6-77.1 11.9-81.7Q18.2-86.2 29.5-86.2Q36.8-86.2 43.1-84Q49.4-81.7 54.6-78.2Q59.7-74.7 63.6-70.5Q67.5-66.2 70.1-62.1L70.7-61.2L62.8-56.1L61.9-57.5Q59.6-60.8 56.4-64.2Q53.2-67.6 49.3-70.3Q45.3-73 40.6-74.7Q35.8-76.4 30.6-76.4Q24.2-76.4 21.1-73.7Q18-70.9 18-67Q18-66.2 18.1-65.5Q18.1-64.7 18.4-63.9L27.5-63.9L27.5-54.5L19.5-54.5L19.5 0L7.2 0M64.1 2.1L61.5 11.7Q54.7 11.5 49 9.9Q43.3 8.2 39.1 5.2Q34.9 2.1 32.5-2.2Q30.2-6.6 30.2-12.3Q30.2-16.5 31.9-19.6Q33.5-22.6 35.3-24.1Q34.5-24.9 33.6-26Q32.7-27.1 31.9-28.5Q31.1-29.9 30.6-31.6Q30-33.3 30-35.3Q30-38.1 31.1-40.4Q32.1-42.6 33.9-44.2Q35.7-45.7 38.1-46.5Q40.6-47.3 43.4-47.3L55.7-47.3L55.7-54.5L25.5-54.5L25.5-63.9L78.1-63.9L78.1-54.5L67.9-54.5L67.9-37.9L48.1-37.9Q45.7-37.9 44.1-36.9Q42.5-35.8 42.5-33.5Q42.5-32.1 43-30.9Q43.6-29.6 44.3-29Q48.2-30.6 53.3-30.6Q62.6-30.6 68-26.1Q73.4-21.6 73.4-13.9Q73.4-10.6 72-7.7Q70.6-4.9 69.2-3.7L59.5-8.4Q60.3-9.3 61-10.7Q61.7-12 61.7-13.6Q61.7-16.7 59.6-18.8Q57.4-20.9 52.8-20.9Q48.2-20.9 45.5-18.4Q42.7-16 42.7-11.8Q42.7-5.6 48.3-2.1Q53.9 1.3 64.1 2.1"

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="-34.9 -110.7 146.9 146.9" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <rect x="-34.9" y="-110.7" width="146.9" height="146.9" rx="32" className="fill-primary" />
      <path d={GLYPH} className="fill-primary-foreground" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[1.15rem] font-bold tracking-tight">Hisab</span>
    </span>
  )
}
