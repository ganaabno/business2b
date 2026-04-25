// Parts/FileUploader.tsx
import { useState } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  Download,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { useNotifications } from "../hooks/useNotifications";
import { FLIGHT_DATA_COLUMNS } from "../utils/columnOrder";

// Helper: Convert Excel serial date → YYYY-MM-DD
const excelDateToJSDate = (serial: number): string => {
  if (!serial || serial < 1) return "";
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  const year = date_info.getFullYear();
  const month = String(date_info.getMonth() + 1).padStart(2, "0");
  const day = String(date_info.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type Props = {
  onUploadStart?: () => void;
  onUploadComplete?: () => void;
  currentUser: any;
};

const BATCH_SIZE = 1000;

export default function FileUploader({
  onUploadStart,
  onUploadComplete,
  currentUser,
}: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { showNotification } = useNotifications();

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError("Зөвхөн Excel файл оруулна уу!");
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(0);
    onUploadStart?.();

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary", cellText: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

        // Read headers
        const headerRow: string[] = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
          headerRow.push(
            cell ? (cell.w || cell.v || "").toString().trim() : ""
          );
        }

        // Read rows
        const rows: any[] = [];
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          const row: any = {};
          let hasData = false;
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
            const value = cell
              ? (cell.w || cell.v || "").toString().trim()
              : "";
            row[headerRow[C]] = value;
            if (value) hasData = true;
          }
          if (hasData) rows.push(row);
        }

        if (rows.length === 0) throw new Error("Файлд өгөгдөл алга!");

        // Map to standard columns + generate unique ID
        // orderedData map-ийг БҮРЭЭ доорх кодоор солиорой
        const orderedData = rows.map((row, idx) => {
          const ordered: any = {};

          // ГОЛ ЗАСВАР: №-г яг Excel-ийн дарааллаар 1, 2, 3... болгоно
          ordered["№"] = idx + 1; // <—— ЭНЭ НЭГ МӨР БҮГДИЙГ ЗАСНА!!!

          // Огноо
          const dateCell = row["Огноо"] || row[Object.keys(row)[1]];
          ordered["Огноо"] =
            typeof dateCell === "number"
              ? excelDateToJSDate(dateCell)
              : String(dateCell || "").trim();

          // Бусад баганууд
          const map = {
            "Агаарын тээвэрлэгч": ["Агаарын тээвэрлэгч"],
            Хотоор: ["Хотоор"],
            "Нислэгийн чиглэл": ["Нислэгийн чиглэл"],
            "Суудал эзэлсэн зорчигч": ["Суудал эзэлсэн зорчигч"],
            Гараг: ["Гараг"],
          };

          Object.entries(map).forEach(([target, sources]) => {
            const key = Object.keys(row).find((k) =>
              sources.some((s) => k.includes(s))
            );
            ordered[target] = key ? String(row[key] || "").trim() : "";
          });

          // Ирсэн/Явсан
          const dir = row["(1)-явсан / (0)-ирсэн"] ?? "0";
          ordered["(1)-явсан / (0)-ирсэн"] = dir === "1" ? "1" : "0";

          // ID — № + Огноо (№ нь 1,2,3... учраас дараалал алдагдахгүй!)
          ordered._id = `${idx + 1}-${ordered["Огноо"]}-${
            ordered["Агаарын тээвэрлэгч"] || "unknown"
          }`;

          return ordered;
        });

        // 🚨 FIX: Remove duplicates before upsert
        const uniqueMap = new Map<string, any>();
        for (const r of orderedData) {
          if (!uniqueMap.has(r._id)) {
            uniqueMap.set(r._id, r);
          }
        }
        const cleanedData = Array.from(uniqueMap.values());

        showNotification(
          "success",
          `${cleanedData.length} мөрийг хадгалж байна...`
        );

        let uploaded = 0;
        for (let i = 0; i < cleanedData.length; i += BATCH_SIZE) {
          const batch = cleanedData.slice(i, i + BATCH_SIZE);

          const { error } = await supabase.from("flight_data").upsert(
            batch.map((row) => ({
              id: row._id,
              data: Object.fromEntries(
                Object.entries(row).filter(
                  ([k]) => !["_index", "_id"].includes(k)
                )
              ),
              uploaded_by: currentUser.id,
              uploaded_at: new Date().toISOString(),
            })),
            { onConflict: "id" }
          );

          if (error) throw error;

          uploaded += batch.length;
          setProgress((uploaded / cleanedData.length) * 100);
        }

        showNotification(
          "success",
          `${cleanedData.length} мөр амжилттай хадгалагдлаа!`
        );
        onUploadComplete?.();
      } catch (err: any) {
        const msg = err.message || "Алдаа гарлаа";
        setError("Алдаа: " + msg);
        showNotification("error", msg);
      } finally {
        setLoading(false);
        setProgress(0);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <a
          href="https://erthub.mn/statistic/detail/?indicatorId=14995832"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-md"
        >
          <Download className="w-5 h-5" /> Сайтаас Excel татах
        </a>
        <p className="text-xs text-gray-500 mt-2">
          "Excel татах" дээр дарж → Файлыг энд чирнэ
        </p>
      </div>

      <div className="flex items-center justify-center text-gray-400">
        <div className="flex-1 border-t border-gray-300"></div>
        <span className="px-4 text-sm">ЭСВЭЛ</span>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
          dragActive ? "border-emerald-500 bg-emerald-50" : "border-gray-300"
        } ${loading ? "opacity-75" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
          disabled={loading}
        />

        {loading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mb-4" />
            <p className="text-gray-700 font-medium mb-2">
              Хадгалж байна... ({Math.round(progress)}%)
            </p>
            <div className="w-full max-w-md bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-600 h-3 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <>
            <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700">
              Excel файлаа энд чирж оруулна уу
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Шинэчлэгдэж, давхардахгүй
            </p>
            <button className="mt-6 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center mx-auto">
              <Upload className="w-5 h-5 mr-2" /> Файл сонгох
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
