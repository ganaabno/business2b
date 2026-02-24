"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import {
  Search,
  Download,
  RefreshCw,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";
import DataTable from "../Parts/DataTable.";
import { useFlightDataStore } from "../Parts/flightDataStore";
import FileUploader from "../Parts/FileUploader";
import DeleteFlightDataButton from "./DeleteFlightDataButton";

interface FlightDataTabProps {
  currentUser: any;
}

export default function FlightDataTab({ currentUser }: FlightDataTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [uploading, setUploading] = useState(false);

  const {
    data: flightData,
    lastUploadTime,
    isLoading,
    fetchFlightData,
    subscribeToFlightData,
    clear,
  } = useFlightDataStore();

  const isAdmin = ["admin", "superadmin"].includes(currentUser.role);

  const fetchMode = isAdmin ? "full" : "recent";
  const fetchLimit = isAdmin ? undefined : 50;

  const loadFlightData = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      try {
        const result = await fetchFlightData({
          mode: fetchMode,
          limit: fetchLimit,
          force,
        });
        if (result.source === "network") {
          toast.success(`${result.count.toLocaleString()} мөр ачаалагдлаа!`);
        }
      } catch (err: any) {
        toast.error("Алдаа: " + err.message);
      }
    },
    [fetchFlightData, fetchMode, fetchLimit],
  );

  useEffect(() => {
    void loadFlightData();
  }, [loadFlightData]);

  useEffect(() => {
    const unsubscribe = subscribeToFlightData({
      mode: fetchMode,
      limit: fetchLimit,
    });
    return unsubscribe;
  }, [subscribeToFlightData, fetchMode, fetchLimit]);

  const filteredFlightData = useMemo(() => {
    if (!searchTerm) return flightData;
    const term = searchTerm.toLowerCase();
    return flightData.filter((row) =>
      Object.values(row).some(
        (val) => val && String(val).toLowerCase().includes(term)
      )
    );
  }, [flightData, searchTerm]);

  const exportToCSV = () => {
    if (!filteredFlightData.length) return;
    const headers = Object.keys(filteredFlightData[0]);
    const csv = [
      headers,
      ...filteredFlightData.map((r) => headers.map((h) => r[h] ?? "")),
    ]
      .map((r) => r.join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flight-data-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <>
      <Toaster position="top-right" />
      <div className="space-y-6">
        {/* ADMIN CONTROLS */}
        {isAdmin && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DeleteFlightDataButton
              onSuccess={() => {
                clear();
                void loadFlightData({ force: true });
              }}
            />
            <button
              onClick={() => void loadFlightData({ force: true })}
              disabled={isLoading}
              className="mono-button flex items-center justify-center gap-2"
            >
              <RefreshCw
                className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`}
              />
              {isLoading ? "Татаж байна..." : "Шинэчлэх"}
            </button>
            <button
              onClick={exportToCSV}
              disabled={filteredFlightData.length === 0}
              className="mono-button mono-button--ghost flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" /> Export CSV
            </button>
          </div>
        )}

        {/* UPLOAD — ЗӨВХӨН ADMIN */}
        {isAdmin && (
          <FileUploader
            currentUser={currentUser}
            onUploadStart={() => setUploading(true)}
            onUploadComplete={() => {
              setUploading(false);
              void loadFlightData({ force: true });
            }}
          />
        )}

        {/* UPLOADING STATUS */}
        {uploading && isAdmin && (
          <div className="p-4 bg-emerald-50 rounded-lg flex items-center">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600 mr-3" />
            <p className="text-emerald-700">Файл боловсруулж байна...</p>
          </div>
        )}

        {/* ХАЙЛТ — БҮГДЭД */}
        {flightData.length > 0 && (
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Хайлт..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mono-input pl-10"
            />
          </div>
        )}

        {/* LOADING / EMPTY / TABLE */}
        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
            <p className="text-gray-600">Өгөгдөл татаж байна...</p>
          </div>
        ) : filteredFlightData.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl">
            <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-lg text-gray-500">Одоогоор өгөгдөл алга</p>
            {isAdmin && (
              <p className="text-sm text-gray-400 mt-1">Excel оруулна уу</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mono-header">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="mono-title text-lg">Нислэгийн Мэдээлэл</h3>
                {lastUploadTime && (
                  <span className="mono-badge">
                    Сүүлийн upload: {lastUploadTime}
                  </span>
                )}
              </div>
            </div>
            <DataTable data={filteredFlightData} />
          </div>
        )}
      </div>
    </>
  );
}
