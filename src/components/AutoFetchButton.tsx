import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { FLIGHT_DATA_COLUMNS } from "../utils/columnOrder";

const PROXY_URL = "https://corsproxy.io/?";
const API_BASE = "https://erthub.mn/statistic/detail/";
const INDICATOR_ID = 14995832;
const PAGE_SIZE = 50;
const BATCH_SIZE = 100;

export default function AutoFetchButton({
  currentUser,
  onSuccess,
}: {
  currentUser: any;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleClick = async () => {
    if (!currentUser) return alert("No user detected");
    setLoading(true);
    try {
      const count = await autoFetchFlightData(currentUser, (p) =>
        setProgress(Math.round(p))
      );
      alert(`SUCCESS: ${count} rows imported!`);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      alert(`Failed: ${err.message}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`px-4 py-2 rounded-lg text-white font-medium transition-all ${
        loading
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-emerald-600 hover:bg-emerald-700"
      }`}
    >
      {loading ? `Импортлож байна... ${progress}%` : "Auto Import"}
    </button>
  );
}

// --- KEEPING ALL YOUR ORIGINAL LOGIC BELOW ---
async function autoFetchFlightData(
  currentUser: any,
  onProgress?: (progress: number) => void
): Promise<number> {
  let allRows: any[] = [];
  let offset = 1;
  let total = 17000;

  try {
    const firstPath = `${API_BASE}?indicatorId=${INDICATOR_ID}&offset=1&pageSize=${PAGE_SIZE}`;
    const firstUrl = PROXY_URL + encodeURIComponent(firstPath);
    const firstRes = await fetch(firstUrl);
    if (!firstRes.ok) throw new Error(`Fetch failed: ${firstRes.status}`);

    const firstHtml = await firstRes.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(firstHtml, "text/html");
    if (!doc) throw new Error("HTML parse failed");

    const table = doc.querySelector("table");
    if (!table) throw new Error("No table found — site changed?");

    const headerRow =
      table.querySelector("thead tr") || table.querySelector("tr");
    const headers = Array.from(headerRow?.querySelectorAll("th") || [])
      .map((th: Element) => (th as HTMLElement).textContent?.trim() || "")
      .filter(Boolean);

    const rows = Array.from(table.querySelectorAll("tbody tr"));
    const firstPageData = rows.map((row: Element) => {
      const cells = Array.from(row.querySelectorAll("td")).map(
        (td: Element) => (td as HTMLElement).textContent?.trim() || ""
      );
      const rowObj: any = {};
      headers.forEach((header, idx) => {
        rowObj[header] = cells[idx] || "";
      });
      return rowObj;
    });

    allRows = firstPageData;

    const pagText = doc.body.textContent || "";
    const totalMatchRaw =
      pagText.match(/of\s*([\d,]+)/i) || pagText.match(/(\d{1,3}(?:,\d{3})*)/g);

    let totalMatch: string | null = null;

    if (totalMatchRaw) {
      if (Array.isArray(totalMatchRaw)) {
        const numbers = totalMatchRaw
          .map((m) => m.replace(/,/g, ""))
          .filter((n) => /^\d+$/.test(n))
          .map(Number);
        totalMatch =
          numbers.length > 0 ? Math.max(...numbers).toString() : null;
      } else {
        totalMatch = totalMatchRaw[1] || totalMatchRaw[0];
      }
    }

    total = totalMatch ? parseInt(totalMatch.replace(/,/g, ""), 10) : 17000;

    onProgress?.(10);

    while (offset < total) {
      const path = `${API_BASE}?indicatorId=${INDICATOR_ID}&offset=${
        offset + 1
      }&pageSize=${PAGE_SIZE}`;
      const url = PROXY_URL + encodeURIComponent(path);
      const res = await fetch(url);
      if (!res.ok)
        throw new Error(`Page fetch failed at offset ${offset}: ${res.status}`);

      const html = await res.text();
      const pageDoc = parser.parseFromString(html, "text/html");
      const pageTable = pageDoc.querySelector("table");
      if (!pageTable) throw new Error("No table on paginated page");

      const pageRows = Array.from(pageTable.querySelectorAll("tbody tr"));
      const pageData = pageRows.map((row: Element) => {
        const cells = Array.from(row.querySelectorAll("td")).map(
          (td: Element) => (td as HTMLElement).textContent?.trim() || ""
        );
        const rowObj: any = {};
        headers.forEach((header, idx) => {
          rowObj[header] = cells[idx] || "";
        });
        return rowObj;
      });

      allRows = allRows.concat(pageData);
      offset += PAGE_SIZE;

      const fetchProgress = Math.min(80, (allRows.length / total) * 80);
      onProgress?.(fetchProgress);
      await new Promise((r) => setTimeout(r, 1500));
    }

    const orderedData = allRows.map((row) => {
      const ordered: any = {};
      FLIGHT_DATA_COLUMNS.forEach((col) => {
        const matchedKey =
          headers.find(
            (h) =>
              h.includes(col.split(" ")[0]) || col.includes(h.split(" ")[0])
          ) || col;
        ordered[col] = row[matchedKey] ?? "";
      });
      return ordered;
    });


    for (let i = 0; i < orderedData.length; i += BATCH_SIZE) {
      const batch = orderedData.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("flight_data").insert({
        data: batch,
        uploaded_by: currentUser.id,
        source: "auto_proxy_scrape",
        uploaded_at: new Date().toISOString(),
      });
      if (error) throw error;

      const uploadProgress =
        80 + Math.min(20, ((i + batch.length) / orderedData.length) * 20);
      onProgress?.(uploadProgress);
    }

    return orderedData.length;
  } catch (err: any) {
    console.error("Auto-fetch failed:", err);
    throw new Error(
      `Import failed: ${err.message}. Check console for details.`
    );
  }
}
