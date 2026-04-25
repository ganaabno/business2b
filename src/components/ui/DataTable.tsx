import { useState, useMemo, type ReactNode } from "react"
import { cn } from "../../lib/utils"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Filter, Download } from "lucide-react"
import { Button } from "./primitives"

interface Column<T> {
  key: keyof T | string
  header: string
  width?: string
  render?: (row: T) => ReactNode
  sortable?: boolean
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyField: keyof T
  loading?: boolean
  searchable?: boolean
  filterable?: boolean
  paginated?: boolean
  pageSize?: number
  actions?: ReactNode
  onRowClick?: (row: T) => void
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyField,
  loading,
  searchable,
  filterable,
  paginated = true,
  pageSize = 10,
  actions,
  onRowClick,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    let result = [...data]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((row) =>
        columns.some((col) => String(row[col.key]).toLowerCase().includes(q))
      )
    }
    return result
  }, [data, search, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal === bVal) return 0
      const cmp = aVal! < bVal! ? -1 : 1
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const paged = useMemo(() => {
    if (!paginated) return sorted
    const start = (page - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize, paginated])

  const totalPages = Math.ceil(sorted.length / pageSize)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  return (
    <div className="bg-[var(--mono-surface)] rounded-2xl border border-[var(--mono-border)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--mono-border)] gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--mono-text-soft)]" />
              <input
                type="text"
                placeholder="Хайх..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="h-9 pl-9 pr-3 rounded-lg border border-[var(--mono-border)] bg-[var(--mono-surface-muted)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--mono-ring)]"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4" />
            Экспорт
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--mono-surface-muted)]">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={cn(
                    "px-4 py-3 text-left text-sm font-medium text-[var(--mono-text)]",
                    col.sortable && "cursor-pointer hover:bg-[var(--mono-border)]",
                    col.width
                  )}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span className="text-[var(--mono-accent)]">
                        {sortDir === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center">
                  <div className="flex items-center justify-center gap-2 text-[var(--mono-text-soft)]">
                    <div className="w-5 h-5 border-2 border-[var(--mono-border)] border-t-[var(--mono-accent)] rounded-full animate-spin" />
                    Ачаалж байна...
                  </div>
                </td>
              </tr>
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-[var(--mono-text-soft)]">
                  Мэдээлэл олдсонгүй
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr
                  key={String(row[keyField])}
                  className={cn(
                    "border-b border-[var(--mono-border)] hover:bg-[var(--mono-surface-muted)] transition",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 text-sm text-[var(--mono-text)]">
                      {col.render ? col.render(row) : String(row[col.key] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {paginated && totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-[var(--mono-border)]">
          <p className="text-sm text-[var(--mono-text-soft)]">
            Нийт {sorted.length} / Хуудас {page}/{totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(1)}
              disabled={page === 1}
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = i + 1
              return (
                <Button
                  key={p}
                  variant={page === p ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              )
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}