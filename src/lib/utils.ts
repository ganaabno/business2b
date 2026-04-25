type ClassValue = string | number | boolean | undefined | null | ClassValue[] | Record<string, unknown> | bigint

function clsx(...inputs: ClassValue[]): string {
  let result = ""
  for (const input of inputs) {
    if (!input || typeof input === "bigint") continue
    if (typeof input === "string" || typeof input === "number") {
      result += (result ? " " : "") + String(input)
    } else if (Array.isArray(input)) {
      const inner = clsx(...input)
      if (inner) result += (result ? " " : "") + inner
    } else if (typeof input === "object") {
      for (const [key, value] of Object.entries(input)) {
        if (value) result += (result ? " " : "") + key
      }
    }
  }
  return result
}

export function cn(...inputs: ClassValue[]) {
  return clsx(...inputs)
}

export function formatCurrency(amount: number, currency = "MNT"): string {
  return new Intl.NumberFormat("mn-MN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("mn-MN", options || {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(date, { month: "short", day: "numeric" })
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + "..."
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}