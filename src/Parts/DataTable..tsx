import { useState, useMemo, useDeferredValue } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
  Calendar,
} from "lucide-react";
import { FLIGHT_DATA_COLUMNS } from "../utils/columnOrder";

type Props = { data: any[] };
const ROWS_PER_PAGE = 50;

const excelDateToJSDate = (serial: number): string => {
  if (!serial || serial < 1) return String(serial);
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  const year = date_info.getFullYear();
  const month = String(date_info.getMonth() + 1).padStart(2, "0");
  const day = String(date_info.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function DataTable({ data }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [airlineFilter, setAirlineFilter] = useState("all");
  const [destinationFilter, setDestinationFilter] = useState("all");

  // ШИНЭЭР НЭМЭГДСЭН: ОГНОО ШҮҮЛТ
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Deferred → хурдан ажиллана
  const deferredSearch = useDeferredValue(searchTerm);
  const deferredStatus = useDeferredValue(statusFilter);
  const deferredType = useDeferredValue(typeFilter);
  const deferredAirline = useDeferredValue(airlineFilter);
  const deferredDest = useDeferredValue(destinationFilter);
  const deferredDateFrom = useDeferredValue(dateFrom);
  const deferredDateTo = useDeferredValue(dateTo);

  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    data.forEach((row) => {
      const v = row["(1)-явсан / (0)-ирсэн"];
      if (v === "1") set.add("явсан");
      if (v === "0") set.add("ирсэн");
    });
    return Array.from(set).sort();
  }, [data]);

  const uniqueTypes = useMemo(
    () =>
      Array.from(
        new Set(data.map((r) => r["Нислэгийн төрөл"]?.trim()).filter(Boolean))
      ).sort(),
    [data]
  );
  const uniqueAirlines = useMemo(
    () =>
      Array.from(
        new Set(
          data.map((r) => r["Агаарын тээвэрлэгч"]?.trim()).filter(Boolean)
        )
      ).sort(),
    [data]
  );
  const uniqueDestinations = useMemo(
    () =>
      Array.from(
        new Set(data.map((r) => r["Хотоор"]?.trim()).filter(Boolean))
      ).sort(),
    [data]
  );

  // ГОЛ ФИЛЬТР – ОГНОО + БҮХ ШҮҮЛТ
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      // 1. Хайлт
      if (deferredSearch) {
        const match = FLIGHT_DATA_COLUMNS.some((col) => {
          const val = row[col];
          return (
            val != null &&
            String(val).toLowerCase().includes(deferredSearch.toLowerCase())
          );
        });
        if (!match) return false;
      }

      // 2. Огноо шүүлт
      if (deferredDateFrom || deferredDateTo) {
        const cellDate = row["Огноо"];
        if (!cellDate) return false;

        let rowDateStr: string;
        if (typeof cellDate === "number") {
          rowDateStr = excelDateToJSDate(cellDate);
        } else {
          rowDateStr = String(cellDate).trim();
          // Хэрвээ YYYY-MM-DD биш бол хөрвүүлэх гэж оролдоно
          if (!/^\d{4}-\d{2}-\d{2}$/.test(rowDateStr)) {
            try {
              const d = new Date(rowDateStr);
              rowDateStr = `${d.getFullYear()}-${String(
                d.getMonth() + 1
              ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            } catch {
              return false;
            }
          }
        }

        if (deferredDateFrom && rowDateStr < deferredDateFrom) return false;
        if (deferredDateTo && rowDateStr > deferredDateTo) return false;
      }

      // 3. Бусад шүүлтүүд
      if (deferredStatus !== "all") {
        const status = row["(1)-явсан / (0)-ирсэн"];
        const text = status === "1" ? "явсан" : status === "0" ? "ирсэн" : "";
        if (text !== deferredStatus) return false;
      }
      if (
        deferredType !== "all" &&
        (row["Нислэгийн төрөл"]?.trim() || "") !== deferredType
      )
        return false;
      if (
        deferredAirline !== "all" &&
        (row["Агаарын тээвэрлэгч"]?.trim() || "") !== deferredAirline
      )
        return false;
      if (
        deferredDest !== "all" &&
        (row["Хотоор"]?.trim() || "") !== deferredDest
      )
        return false;

      return true;
    });
  }, [
    data,
    deferredSearch,
    deferredStatus,
    deferredType,
    deferredAirline,
    deferredDest,
    deferredDateFrom,
    deferredDateTo,
  ]);

  const sortedData = useMemo(() => {
    return filteredData.sort((a, b) => {
      return Number(a["№"]) - Number(b["№"]);
    });
  }, [filteredData]);

  // ШҮҮГДСЭН ДАРАА ХЭДЭН НИСЛЭГ ЯВСАН/ИРСЭН ГЭДЭГ ТОО
  const stats = useMemo(() => {
    const departed = filteredData.filter(
      (r) => r["(1)-явсан / (0)-ирсэн"] === "1"
    ).length;
    const arrived = filteredData.filter(
      (r) => r["(1)-явсан / (0)-ирсэн"] === "0"
    ).length;
    return { total: filteredData.length, departed, arrived };
  }, [filteredData]);

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / ROWS_PER_PAGE);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
  const paginatedData = sortedData.slice(startIdx, startIdx + ROWS_PER_PAGE);
  
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTypeFilter("all");
    setAirlineFilter("all");
    setDestinationFilter("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchTerm ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    airlineFilter !== "all" ||
    destinationFilter !== "all" ||
    dateFrom ||
    dateTo;

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">Өгөгдөл байхгүй.</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mono-panel p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Хайх..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="mono-input pl-11"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="mono-input pl-11"
              />
            </div>
            <span className="text-gray-500">→</span>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="mono-input pl-11"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mono-button mono-button--ghost mono-button--sm"
            >
              <X className="w-4 h-4" /> Бүгдийг цэвэрлэх
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="mono-select min-w-[190px]"
          >
            <option value="all">Бүгд (явсан/ирсэн)</option>
            {uniqueStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="mono-select min-w-[180px]"
          >
            <option value="all">Бүгд (төрөл)</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            value={airlineFilter}
            onChange={(e) => {
              setAirlineFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="mono-select min-w-[220px]"
          >
            <option value="all">Бүгд (агаарын тээвэрлэгч)</option>
            {uniqueAirlines.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <select
            value={destinationFilter}
            onChange={(e) => {
              setDestinationFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="mono-select min-w-[180px]"
          >
            <option value="all">Бүгд (хотоор)</option>
            {uniqueDestinations.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
          <span>
            Нийт шүүгдсэн: <strong>{totalItems.toLocaleString()}</strong> мөр
            {hasActiveFilters && ` (нийт ${data.length.toLocaleString()} мөрөөс)`}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mono-badge">
              Нийт: {stats.total.toLocaleString()}
            </span>
            <span className="mono-badge mono-badge--success">
              Явсан: {stats.departed.toLocaleString()}
            </span>
            <span className="mono-badge mono-badge--warning">
              Ирсэн: {stats.arrived.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="mono-table-shell">
        <div className="mono-table-scroll">
          <table className="mono-table mono-table--compact mono-table--sticky min-w-max">
            <thead>
              <tr>
                {FLIGHT_DATA_COLUMNS.map((header, idx) => (
                  <th
                    key={header}
                    className={`mono-table-cell ${
                      idx < 3 ? "mono-sticky mono-sticky--header" : ""
                    } ${
                      idx === 0
                        ? "left-0"
                        : idx === 1
                        ? "left-16"
                        : idx === 2
                        ? "left-40"
                        : ""
                    }`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, i) => (
                <tr key={startIdx + i} className="transition-colors">
                  {FLIGHT_DATA_COLUMNS.map((header, idx) => {
                    let cellValue = row[header] ?? "-";
                    if (header === "Огноо" && typeof cellValue === "number") {
                      cellValue = excelDateToJSDate(cellValue);
                    } else if (header === "(1)-явсан / (0)-ирсэн") {
                      cellValue =
                        cellValue === "1"
                          ? "явсан"
                          : cellValue === "0"
                          ? "ирсэн"
                          : String(cellValue);
                    } else {
                      cellValue = String(cellValue);
                    }

                    return (
                      <td
                        key={header}
                        title={cellValue}
                        className={`mono-table-cell ${
                          idx < 3 ? "mono-sticky" : ""
                        } ${
                          idx === 0
                            ? "left-0"
                            : idx === 1
                            ? "left-16"
                            : idx === 2
                            ? "left-40"
                            : ""
                        }`}
                      >
                        {cellValue}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Хуудас: <strong>{currentPage}</strong> / {totalPages || 1}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="mono-button mono-button--ghost mono-button--sm"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="mono-button mono-button--ghost mono-button--sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const pageNum =
                currentPage <= 3
                  ? i + 1
                  : currentPage >= totalPages - 2
                  ? totalPages - 4 + i
                  : currentPage - 2 + i;
              if (pageNum < 1 || pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  className={`mono-button mono-button--sm ${
                    currentPage === pageNum
                      ? ""
                      : "mono-button--ghost"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="mono-button mono-button--ghost mono-button--sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="mono-button mono-button--ghost mono-button--sm"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
