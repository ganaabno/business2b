// utils/autoFetchFlightData.ts
import { supabase } from "../supabaseClient";
import { FLIGHT_DATA_COLUMNS } from "./columnOrder";

const PROXY = "https://corsproxy.io/?";
const API_URL =
  "https://erthub.mn/api/get-indicator?command=kpiIndicatorDataList&parameters=";
const INDICATOR_ID = 14995832; // Fixed: No quotes
const PAGE_SIZE = 50;
const BATCH_SIZE = 100;

interface ApiResponse {
  response: {
    text: string;
    status: string;
    data?: {
      total: number;
      columns: string[];
      rows: any[];
    };
  };
}

export const autoFetchAndUploadFlightData = async (
  currentUser: any,
  onProgress?: (p: number) => void
): Promise<number> => {
  let allRows: any[] = [];
  let total = 0;
  let offset = 1;

  try {

    // Step 1: Get config/total (use kpiIndicatorDataListConfig if needed, but data command has it)
    const configParams = encodeURIComponent(
      JSON.stringify({ indicatorId: INDICATOR_ID })
    );
    const configUrl =
      PROXY +
      API_URL.replace("kpiIndicatorDataList", "kpiIndicatorDataListConfig") +
      configParams;
    const configRes = await fetch(configUrl);
    if (!configRes.ok) throw new Error("Config fetch failed");
    const configJson: ApiResponse = await configRes.json();

    if (configJson.response.status !== "success")
      throw new Error("API config error: " + configJson.response.text);

    // Step 2: Paginate data
    while (true) {
      const params = encodeURIComponent(
        JSON.stringify({
          indicatorId: INDICATOR_ID,
          offset,
          pageSize: PAGE_SIZE,
        })
      );
      const url = PROXY + API_URL + params;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Data fetch failed at offset ${offset}`);
      const json: ApiResponse = await res.json();

      if (json.response.status !== "success")
        throw new Error("API data error: " + json.response.text);

      const { total: pageTotal, rows } = json.response.data || {
        total: 0,
        rows: [],
      };
      total = pageTotal || total;
      allRows.push(...rows);

      onProgress?.(Math.min(80, (allRows.length / total) * 80));

      if (rows.length < PAGE_SIZE) break; // End of data
      offset += PAGE_SIZE;
      await new Promise((r) => setTimeout(r, 500)); // Polite delay
    }

    // Step 3: Reorder to your columns
    const orderedData = allRows.map((row) => {
      const ordered: any = {};
      FLIGHT_DATA_COLUMNS.forEach((col) => {
        ordered[col] = row[col] ?? "";
      });
      return ordered;
    });

    // Step 4: Upload
    for (let i = 0; i < orderedData.length; i += BATCH_SIZE) {
      const batch = orderedData.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("flight_data").insert({
        data: batch,
        uploaded_by: currentUser.id,
        source: "api_direct",
        uploaded_at: new Date().toISOString(),
      });
      if (error) throw error;

      onProgress?.(80 + ((i + batch.length) / orderedData.length) * 20);
    }

    return orderedData.length;
  } catch (err: any) {
    console.error("API fetch failed:", err);
    throw err;
  }
};
