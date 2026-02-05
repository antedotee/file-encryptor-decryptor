export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "—"
  const units = ["B", "KB", "MB", "GB"] as const
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  const decimals = i === 0 ? 0 : i === 1 ? 1 : 2
  return `${value.toFixed(decimals)} ${units[i]}`
}

