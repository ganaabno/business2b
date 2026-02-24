import * as XLSX from "xlsx";
import { supabase } from "../supabaseClient";
import { FLIGHT_DATA_COLUMNS } from "./columnOrder";

const BATCH_SIZE = 50;
const DOWNLOAD_URL =
  "https://erthub.mn/statistic/detail/?indicatorId=14995832&offset=1&pageSize=50"; // Base URL

// Simulate download (use fetch or puppeteer for real)
export const autoDownloadAndUpload = async (currentUser: any) => {
  try {
    // Step 1: Fetch page (real: use puppeteer for JS-rendered download)
    const response = await fetch(DOWNLOAD_URL);
    if (!response.ok) throw new Error("Failed to fetch page");

    const html = await response.text();

    // Step 2: Find Excel download link (parse HTML for <a download="..."> or API)
    const excelLinkMatch = html.match(/href="([^"]*\.xlsx[^"]*)"/i);
    if (!excelLinkMatch) throw new Error("Excel link not found — check site");

    const excelUrl = new URL(excelLinkMatch[1], DOWNLOAD_URL).href;

    // Step 3: Download Excel
    const excelResponse = await fetch(excelUrl);
    if (!excelResponse.ok) throw new Error("Failed to download Excel");

    const buffer = await excelResponse.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (json.length === 0) throw new Error("No data in Excel");

    // Step 4: Reorder
    const orderedData = json.map((row) => {
      const orderedRow: any = {};
      FLIGHT_DATA_COLUMNS.forEach((col) => {
        orderedRow[col] = row[col] !== undefined ? row[col] : "";
      });
      return orderedRow;
    });

    // Step 5: Batch upload
    for (let i = 0; i < orderedData.length; i += BATCH_SIZE) {
      const batch = orderedData.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("flight_data").insert({
        data: batch,
        uploaded_by: currentUser.id,
        source: "auto_erthub", // Tag as auto
      });
      if (error) throw error;
    }

    return orderedData.length;
  } catch (err: any) {
    console.error("Auto-upload error:", err);
    throw err;
  }
};
