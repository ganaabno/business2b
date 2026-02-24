import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Eye,
  Download,
  Baby,
  X,
  Calendar,
  Search,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import _ from "lodash";
import i18n from "../i18n";

// COLOR MAP — THIS MAKES TAILWIND HAPPY AND COLORS WORK IN PRODUCTION
const COLOR_CLASSES = {
  "#ff0000": "bg-red-500/20",
  "#8b5cf6": "bg-purple-500/20",
  "#f59e0b": "bg-amber-500/20",
  "#84cc16": "bg-lime-500/20",
  "#00b0ff": "bg-sky-500/20",
  "#3b82f6": "bg-blue-500/20",
  "#f43f5e": "bg-rose-500/20",
  "#10b981": "bg-emerald-500/20",
  "#6366f1": "bg-indigo-500/20",
  "#f97316": "bg-orange-500/20",
  "#a855f7": "bg-violet-500/20",
  "#06b6d4": "bg-cyan-500/20",
  "#d946ef": "bg-fuchsia-500/20",
  "#ec4899": "bg-pink-500/20",
} as const;

interface Passenger {
  is_related_to_next?: boolean;
  group_color: string | null;
  id: string;
  first_name: string;
  last_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  passport_number: string | null;
  passport_expire: string | null;
  nationality: string | null;
  notes: string | null;
  departure_date: string | null;
  order_id: string | null;
  booking_number: string | null;
  hotel: string | null;
  pax: number | null;
  roomType: string | null;
  room_allocation: string | null;
  status: "active" | "completed";
  tour_title: string;
  pax_type?: "Adult" | "Child" | "Infant";
  itinerary_status?:
    | "With itinerary"
    | "No itinerary"
    | "Hotel + itinerary"
    | "Hotel"
    | "Roundway ticket"
    | null;
  passport_upload?: string | null;
  has_baby_bed?: boolean;
}

interface PassengerTableProps {
  passengers: Passenger[];
  selectedDate?: string | null;
  refetch: () => void;
}

interface DateGroup {
  date: string;
  displayDate: string;
  tourTitle: string;
  orderGroups: OrderGroup[];
  isCompleted: boolean;
  key: string;
}

interface OrderGroup {
  orderId: string | null;
  displayId: string;
  passengers: Passenger[];
  roomAllocation: string | null;
  hotel: string | null;
  roomType: string | null;
  key: string;
}

const PassengerTable = ({
  passengers: initialPassengers,
  selectedDate,
  refetch,
}: PassengerTableProps) => {
  const { t } = useTranslation();
  const [passengers, setPassengers] = useState<Passenger[]>(initialPassengers);
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "all">(
    "active",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [groupNotes, setGroupNotes] = useState<{ [key: string]: string }>({});
  const [groupBookings, setGroupBookings] = useState<{ [key: string]: string }>(
    {},
  );
  const [completingKey, setCompletingKey] = useState<string | null>(null);
  const [undoingKey, setUndoingKey] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState<string | null>(null);

  const tableRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => setPassengers(initialPassengers), [initialPassengers]);

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "no-date";
    let cleaned = dateString.trim();
    if (cleaned.includes("T") || cleaned.includes(" ")) {
      cleaned = cleaned.split("T")[0].split(" ")[0];
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
    return "no-date";
  };

  const formatDisplayDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      type === "success"
        ? toast.success(message, { autoClose: 3000 })
        : toast.error(message, { autoClose: 5000 });
    },
    [],
  );

  const getItineraryDisplay = (status: Passenger["itinerary_status"]) => {
    if (!status || status === "No itinerary")
      return (
        <div className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
          No itinerary
        </div>
      );
    if (status === "Hotel + itinerary")
      return (
        <div className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
          Hotel + Itin
        </div>
      );
    if (status === "Roundway ticket")
      return (
        <div className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
          Roundway
        </div>
      );
    if (status === "Hotel")
      return (
        <div className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
          Hotel only
        </div>
      );
    return (
      <div className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
        {status}
      </div>
    );
  };

  const exportTourToExcel = async (dateGroup: DateGroup) => {
    if (dateGroup.orderGroups.flatMap((og) => og.passengers).length === 0) {
      toast.warn("No passengers in this tour!");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Passengers");

    worksheet.columns = [
      { header: "Departure Date", key: "departure_date", width: 16 },
      { header: "Tour Title", key: "tour_title", width: 35 },
      { header: "Order ID", key: "order_id", width: 15 },
      { header: "First Name", key: "first_name", width: 16 },
      { header: "Last Name", key: "last_name", width: 16 },
      { header: "DOB", key: "dob", width: 12 },
      { header: "Gender", key: "gender", width: 8 },
      { header: "Passport No", key: "passport_number", width: 16 },
      { header: "Expiry", key: "passport_expire", width: 12 },
      { header: "Nationality", key: "nationality", width: 14 },
      { header: "Type", key: "pax_type", width: 10 },
      { header: "Hotel", key: "hotel", width: 22 },
      { header: "Room Type", key: "room_type", width: 15 },
      { header: "Room", key: "room_allocation", width: 12 },
      { header: "Booking #", key: "booking_number", width: 16 },
      { header: "Notes", key: "notes", width: 35 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E40AF" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    dateGroup.orderGroups.forEach((orderGroup) => {
      orderGroup.passengers.forEach((p) => {
        worksheet.addRow({
          departure_date: dateGroup.displayDate,
          tour_title: dateGroup.tourTitle,
          order_id: orderGroup.displayId,
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          dob: p.date_of_birth ? formatDate(p.date_of_birth) : "",
          gender: p.gender || "",
          passport_number: p.passport_number || "",
          passport_expire: p.passport_expire
            ? formatDate(p.passport_expire)
            : "",
          nationality: p.nationality || "Mongolia",
          pax_type: p.pax_type || "Adult",
          hotel: orderGroup.hotel || "",
          room_type: orderGroup.roomType || "",
          room_allocation: orderGroup.roomAllocation || "",
          booking_number:
            groupBookings[orderGroup.key] || p.booking_number || "",
          notes: groupNotes[orderGroup.key] || p.notes || "",
        });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const safeTourName = dateGroup.tourTitle
      .replace(/[^a-zA-Z0-9]/g, "_")
      .substring(0, 30);
    const fileName = `${dateGroup.displayDate.replace(
      /[/ ]/g,
      "_",
    )}_${safeTourName}.xlsx`;

    saveAs(blob, fileName);
    toast.success(`Excel downloaded: ${dateGroup.tourTitle}`);
  };

  const exportTourToCSV = (dateGroup: DateGroup) => {
    const passengers = dateGroup.orderGroups.flatMap((og) => og.passengers);
    if (passengers.length === 0) {
      toast.warn("No data to export!");
      return;
    }

    const headers = [
      "Departure Date",
      "Tour Title",
      "Order ID",
      "First Name",
      "Last Name",
      "DOB",
      "Gender",
      "Passport No",
      "Expiry",
      "Nationality",
      "Type",
      "Hotel",
      "Room Type",
      "Room",
      "Booking #",
      "Notes",
    ];

    const rows = dateGroup.orderGroups.flatMap((orderGroup) =>
      orderGroup.passengers.map((p) => [
        dateGroup.displayDate,
        dateGroup.tourTitle,
        orderGroup.displayId,
        p.first_name || "",
        p.last_name || "",
        p.date_of_birth ? formatDate(p.date_of_birth) : "",
        p.gender || "",
        p.passport_number || "",
        p.passport_expire ? formatDate(p.passport_expire) : "",
        p.nationality || "Mongolia",
        p.pax_type || "Adult",
        orderGroup.hotel || "",
        orderGroup.roomType || "",
        orderGroup.roomAllocation || "",
        (groupBookings[orderGroup.key] || p.booking_number || "").replace(
          /,/g,
          " ",
        ),
        (groupNotes[orderGroup.key] || p.notes || "").replace(/,/g, " "),
      ]),
    );

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const safeTourName = dateGroup.tourTitle
      .replace(/[^a-zA-Z0-9]/g, "_")
      .substring(0, 30);
    const fileName = `${dateGroup.displayDate.replace(
      /[/ ]/g,
      "_",
    )}_${safeTourName}.csv`;

    saveAs(blob, fileName);
    toast.success(`CSV downloaded: ${dateGroup.tourTitle}`);
  };

  // ——— EXPORT WITH PHOTOS (Your Original) ———
  const exportToExcelByDepartureWithPhotos = async () => {
    if (passengers.length === 0) {
      toast.warn("No passengers to export!");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Tour Provider Pro";
    workbook.created = new Date();

    const grouped = _.groupBy(passengers, (p) => {
      const date = p.departure_date
        ? format(new Date(p.departure_date), "yyyy-MM-dd")
        : "no-date";
      return `${date}|||${p.tour_title || "Unknown Tour"}`;
    });

    for (const [key, group] of Object.entries(grouped)) {
      const [datePart, tourTitle] = key.split("|||");
      const sheetName =
        datePart === "no-date"
          ? "No Date"
          : `${format(
              new Date(datePart),
              "dd MMM yyyy",
            )} - ${tourTitle.substring(0, 20)}`;

      const worksheet = workbook.addWorksheet(sheetName.substring(0, 31));

      worksheet.columns = [
        { header: "No", key: "no", width: 6 },
        { header: "Name", key: "name", width: 22 },
        { header: "Passport No", key: "passport_number", width: 16 },
        { header: "Expiry", key: "passport_expire", width: 12 },
        { header: "Nationality", key: "nationality", width: 14 },
        { header: "Type", key: "pax_type", width: 10 },
        { header: "Hotel", key: "hotel", width: 16 },
        { header: "Room", key: "room_allocation", width: 12 },
        { header: "Order ID", key: "order_id", width: 12 },
        { header: "Passport Photo", key: "photo", width: 22 },
      ];

      worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E3A8A" },
      };
      worksheet.getRow(1).alignment = {
        vertical: "middle",
        horizontal: "center",
      };

      group.forEach((p, idx) => {
        const row = worksheet.addRow({
          no: idx + 1,
          name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "N/A",
          passport_number: p.passport_number || "",
          passport_expire: p.passport_expire
            ? format(new Date(p.passport_expire), "dd/MM/yyyy")
            : "",
          nationality: p.nationality || "Mongolia",
          pax_type: p.pax_type || "Adult",
          hotel: p.hotel || "",
          room_allocation: p.room_allocation || "",
          order_id: p.order_id || "",
          photo: p.passport_upload || "",
        });

        if (p.passport_upload) {
          fetch(p.passport_upload)
            .then((r) => r.blob())
            .then(async (blob) => {
              try {
                const buffer = await blob.arrayBuffer();
                const extension = blob.type.includes("png") ? "png" : "jpeg";
                const imageId = workbook.addImage({ buffer, extension });
                worksheet.addImage(imageId, {
                  tl: { col: 9.1, row: row.number - 0.9 },
                  ext: { width: 110, height: 140 },
                  editAs: "oneCell",
                });
              } catch {
                row.getCell("photo").value = "Failed";
              }
            })
            .catch(() => {
              row.getCell("photo").value = "Failed";
            });
        } else {
          row.getCell("photo").value = "No photo";
        }
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(
      blob,
      `Passengers_Photos_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`,
    );
    toast.success("Excel with photos exported!");
  };

  // ——— NEW: QUICK CLEAN EXPORT (Excel) ———
  const exportVisibleToExcel = async () => {
    if (visibleDateGroups.length === 0) {
      toast.warn("No data to export!");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Passengers");

    worksheet.columns = [
      { header: "Departure Date", key: "departure_date", width: 16 },
      { header: "Tour Title", key: "tour_title", width: 35 },
      { header: "Order ID", key: "order_id", width: 15 },
      { header: "First Name", key: "first_name", width: 16 },
      { header: "Last Name", key: "last_name", width: 16 },
      { header: "DOB", key: "dob", width: 12 },
      { header: "Gender", key: "gender", width: 8 },
      { header: "Passport No", key: "passport_number", width: 16 },
      { header: "Expiry", key: "passport_expire", width: 12 },
      { header: "Nationality", key: "nationality", width: 14 },
      { header: "Type", key: "pax_type", width: 10 },
      { header: "Hotel", key: "hotel", width: 22 },
      { header: "Room Type", key: "room_type", width: 15 },
      { header: "Room", key: "room_allocation", width: 12 },
      { header: "Booking #", key: "booking_number", width: 16 },
      { header: "Notes", key: "notes", width: 35 },
      { header: "Status", key: "status", width: 12 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E40AF" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    visibleDateGroups.forEach((dateGroup) => {
      dateGroup.orderGroups.forEach((orderGroup) => {
        orderGroup.passengers.forEach((p) => {
          worksheet.addRow({
            departure_date: dateGroup.displayDate,
            tour_title: dateGroup.tourTitle,
            order_id: orderGroup.displayId,
            first_name: p.first_name || "",
            last_name: p.last_name || "",
            dob: p.date_of_birth ? formatDate(p.date_of_birth) : "",
            gender: p.gender || "",
            passport_number: p.passport_number || "",
            passport_expire: p.passport_expire
              ? formatDate(p.passport_expire)
              : "",
            nationality: p.nationality || "Mongolia",
            pax_type: p.pax_type || "Adult",
            hotel: orderGroup.hotel || "",
            room_type: orderGroup.roomType || "",
            room_allocation: orderGroup.roomAllocation || "",
            booking_number:
              groupBookings[orderGroup.key] || p.booking_number || "",
            notes: groupNotes[orderGroup.key] || p.notes || "",
            status: dateGroup.isCompleted ? "Completed" : "Active",
          });
        });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(
      blob,
      `Tour_Passengers_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`,
    );
    toast.success("Quick export done!");
  };

  // ——— NEW: CSV EXPORT (Bonus!) ———
  const exportToCSV = () => {
    if (visibleDateGroups.length === 0) {
      toast.warn("No data to export!");
      return;
    }

    const headers = [
      "Departure Date",
      "Tour Title",
      "Order ID",
      "First Name",
      "Last Name",
      "DOB",
      "Gender",
      "Passport No",
      "Expiry",
      "Nationality",
      "Type",
      "Hotel",
      "Room Type",
      "Room",
      "Booking #",
      "Notes",
      "Status",
    ];

    const rows = visibleDateGroups.flatMap((dg) =>
      dg.orderGroups.flatMap((og) =>
        og.passengers.map((p) => [
          dg.displayDate,
          dg.tourTitle,
          og.displayId,
          p.first_name || "",
          p.last_name || "",
          p.date_of_birth ? formatDate(p.date_of_birth) : "",
          p.gender || "",
          p.passport_number || "",
          p.passport_expire ? formatDate(p.passport_expire) : "",
          p.nationality || "Mongolia",
          p.pax_type || "Adult",
          og.hotel || "",
          og.roomType || "",
          og.roomAllocation || "",
          (groupBookings[og.key] || p.booking_number || "").replace(/,/g, " "),
          dg.isCompleted ? "Completed" : "Active",
        ]),
      ),
    );

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `Passengers_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`);
    toast.success("CSV exported!");
  };

  const groupedData = useMemo(() => {
    const dateGroups: { [key: string]: DateGroup } = {};

    passengers.forEach((p) => {
      const depDate = formatDate(p.departure_date) || "no-date";
      const rawTitle = p.tour_title?.trim();
      const tourTitle =
        rawTitle && rawTitle !== "" ? rawTitle : t("unknownTour");
      const dateKey = `${depDate}|||${tourTitle}`;

      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = {
          date: depDate,
          displayDate: formatDisplayDate(depDate),
          tourTitle,
          orderGroups: [],
          isCompleted: false,
          key: dateKey,
        };
      }

      const orderId = p.order_id || "no-order";
      const orderKey = `${dateKey}|||${orderId}`;

      let orderGroup = dateGroups[dateKey].orderGroups.find(
        (g) => g.key === orderKey,
      );
      if (!orderGroup) {
        orderGroup = {
          orderId: p.order_id,
          displayId: p.order_id || "No Order",
          passengers: [],
          roomAllocation: p.room_allocation || null,
          hotel: p.hotel || null,
          roomType: p.roomType || null,
          key: orderKey,
        };
        dateGroups[dateKey].orderGroups.push(orderGroup);
      }

      orderGroup.passengers.push(p);
      if (!orderGroup.roomAllocation && p.room_allocation)
        orderGroup.roomAllocation = p.room_allocation;
      if (!orderGroup.hotel && p.hotel) orderGroup.hotel = p.hotel;
      if (!orderGroup.roomType && p.roomType) orderGroup.roomType = p.roomType;
      if (p.status === "completed") dateGroups[dateKey].isCompleted = true;
    });

    return Object.values(dateGroups);
  }, [passengers, t]);

  const allDateGroups = groupedData;
  const activeDateGroups = allDateGroups.filter((g) => !g.isCompleted);
  const completedDateGroups = allDateGroups.filter((g) => g.isCompleted);

  activeDateGroups.sort((a, b) => a.date.localeCompare(b.date));
  completedDateGroups.sort((a, b) => b.date.localeCompare(a.date));

  const visibleDateGroups = useMemo(() => {
    let filtered = groupedData;

    // Tab filter
    if (activeTab === "active")
      filtered = filtered.filter((g) => !g.isCompleted);
    if (activeTab === "completed")
      filtered = filtered.filter((g) => g.isCompleted);

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((g) => g.tourTitle.toLowerCase().includes(q));
    }

    // Date filter
    if (filterDate) {
      filtered = filtered.filter((g) => g.date === filterDate);
    }

    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  }, [groupedData, activeTab, searchQuery, filterDate]);

  useEffect(() => {
    const notes: { [k: string]: string } = {};
    const bookings: { [k: string]: string } = {};

    visibleDateGroups.forEach((dg) => {
      dg.orderGroups.forEach((og) => {
        og.passengers.forEach((p) => {
          if (p.notes && !notes[og.key]) notes[og.key] = p.notes;
          if (p.booking_number && !bookings[og.key])
            bookings[og.key] = p.booking_number;
        });
      });
    });

    setGroupNotes((prev) => ({ ...prev, ...notes }));
    setGroupBookings((prev) => ({ ...prev, ...bookings }));
  }, [visibleDateGroups]);

  const toggleDate = (key: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSaveOrder = async (orderGroup: OrderGroup) => {
    if (savingOrder || !orderGroup.orderId) return;
    setSavingOrder(orderGroup.key);
    const note = groupNotes[orderGroup.key] || null;
    const booking = groupBookings[orderGroup.key] || null;
    const ids = orderGroup.passengers.map((p) => p.id);

    try {
      const { error } = await supabase
        .from("passengers")
        .update({
          notes: note,
          booking_number: booking,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);
      if (error) throw error;
      showToast(t("notesAndBookingUpdated"));
      refetch();
    } catch (err: any) {
      showToast(t("failedToUpdateNotes"), "error");
    } finally {
      setSavingOrder(null);
    }
  };

  const handleCompleteDate = async (dateKey: string) => {
    if (completingKey) return;
    setCompletingKey(dateKey);
    const dateGroup = groupedData.find((g) => g.key === dateKey);
    if (!dateGroup) return;
    const ids = dateGroup.orderGroups.flatMap((og) =>
      og.passengers.map((p) => p.id),
    );

    try {
      const { error } = await supabase
        .from("passengers")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      showToast(t("tourMarkedCompleted"));
      refetch();
      setActiveTab("completed");
    } catch (err: any) {
      showToast(`${t("failedToComplete")}: ${err.message}`, "error");
    } finally {
      setCompletingKey(null);
    }
  };

  const handleUndoDate = async (dateKey: string) => {
    if (undoingKey) return;
    setUndoingKey(dateKey);
    const dateGroup = groupedData.find((g) => g.key === dateKey);
    if (!dateGroup) return;
    const ids = dateGroup.orderGroups.flatMap((og) =>
      og.passengers.map((p) => p.id),
    );

    try {
      const { error } = await supabase
        .from("passengers")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      showToast(t("tourReopened"));
      refetch();
      setActiveTab("active");
    } catch (err: any) {
      showToast(`${t("failedToUndo")}: ${err.message}`, "error");
    } finally {
      setUndoingKey(null);
    }
  };

  const downloadTourAsImage = async (key: string, dateGroup: DateGroup) => {
    const element = tableRefs.current[key];
    if (!element) {
      toast.error("Table not ready!");
      return;
    }

    toast.info("Generating tour image...", { autoClose: false });

    try {
      const html2canvas = (await import("html2canvas")).default;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        foreignObjectRendering: false,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll("*").forEach((node) => {
            const el = node as HTMLElement;
            if (!el) return;

            if (el.hasAttribute("style")) {
              const style = el.getAttribute("style") || "";
              if (style.includes("oklch") || style.includes("lch")) {
                el.removeAttribute("style");
              }
            }

            if (el.classList) {
              const classes = Array.from(el.classList);
              classes.forEach((cls) => {
                if (/^(bg|text|border|shadow)-\[oklch/.test(cls)) {
                  el.classList.remove(cls);
                }
              });
            }
          });

          clonedDoc.querySelectorAll("style").forEach((styleEl) => {
            if (styleEl.textContent?.includes("oklch")) {
              styleEl.remove();
            }
          });
        },
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const fileName = `${dateGroup.displayDate.replace(
          /[/ ]/g,
          "_",
        )}_${dateGroup.tourTitle
          .replace(/[^a-zA-Z0-9]/g, "_")
          .substring(0, 40)}.png`;
        saveAs(blob, fileName);
        toast.success("Tour downloaded perfectly!", { autoClose: 4000 });
      }, "image/png");
    } catch (err) {
      console.error("html2canvas failed:", err);
      toast.error("Capture failed — try again");
    }
  };

  const renderDateGroup = (dateGroup: DateGroup) => {
    const isExpanded = expandedDates.has(dateGroup.key);

    return (
      <div
        key={dateGroup.key}
        className="bg-white rounded-xl shadow-sm border border-gray-50 overflow-hidden"
      >
        {/* HEADER — untouched */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggleDate(dateGroup.key)}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") && toggleDate(dateGroup.key)
          }
          className="w-full px-4 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 transition cursor-pointer rounded-t-xl gap-4"
        >
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-800">
                {dateGroup.displayDate} — {dateGroup.tourTitle}
              </h3>
              <p className="text-sm text-gray-500">
                {dateGroup.orderGroups.reduce(
                  (s, og) => s + og.passengers.length,
                  0,
                )}{" "}
                {t("passengers")} • {dateGroup.orderGroups.length} orders
                {dateGroup.isCompleted && ` • ${t("completed")}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                exportTourToExcel(dateGroup);
              }}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 shadow-md hover:shadow-xl transition"
              title="Download this tour as Excel"
            >
              <Download className="w-4 h-4" /> Excel
            </button>

            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!isExpanded) {
                  toggleDate(dateGroup.key);
                  await new Promise((r) => setTimeout(r, 400));
                }
                downloadTourAsImage(dateGroup.key, dateGroup);
              }}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 shadow-md hover:shadow-xl transition"
            >
              <Download className="w-4 h-4" /> Image
            </button>

            {dateGroup.isCompleted ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUndoDate(dateGroup.key);
                }}
                disabled={undoingKey === dateGroup.key}
                className="bg-orange-600 text-white px-4 py-2 rounded-full text-sm hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1"
              >
                {undoingKey === dateGroup.key ? (
                  "..."
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" /> {t("undo")}
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCompleteDate(dateGroup.key);
                }}
                disabled={completingKey === dateGroup.key}
                className="bg-green-600 text-white px-4 py-2 rounded-full text-sm hover:bg-green-700"
              >
                {completingKey === dateGroup.key ? "..." : t("completeTour")}
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-gray-50 bg-white">
            <div className="lg:hidden p-3 text-center text-xs font-medium text-gray-600 bg-amber-50">
              Scroll horizontally • Pinch to zoom
            </div>

            <div className="mono-table-shell">
              <div className="mono-table-scroll">
                <div className="inline-block min-w-full">
                  <div
                    ref={(el) => {
                      tableRefs.current[dateGroup.key] = el;
                    }}
                    className="origin-top-left transition-transform duration-300 scale-[0.5] sm:scale-[0.75] md:scale-[0.90] lg:scale-100"
                  >
                    <div className="p-0">
                      <table className="min-w-full mono-table mono-table--compact">
                        <colgroup>
                          <col className="w-[4%]" />
                          <col className="w-[8%]" />
                          <col className="w-[9%]" />
                          <col className="w-[9%]" />
                          <col className="w-[8%]" />
                          <col className="w-[6%]" />
                          <col className="w-[10%]" />
                          <col className="w-[8%]" />
                          <col className="w-[8%]" />
                          <col className="w-[6%]" />
                          <col className="w-[7%]" />
                          <col className="w-[7%]" />
                          <col className="w-[8%]" />
                          <col className="w-[10%]" />
                          <col className="w-[8%]" />
                          <col className="w-[8%]" />
                          <col className="w-[14%]" />
                          <col className="w-[6%]" />
                        </colgroup>

                        <thead className="bg-gray-50">
                          <tr>
                            <th className="sticky left-0 z-30 bg-white px-3 py-2 text-xs font-medium text-gray-500 uppercase text-center border border-gray-50 bg-clip-padding">
                              #
                            </th>
                            <th className="sticky left-12 z-20 bg-white px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              Order ID
                            </th>
                            <th className="sticky left-16 z-10 bg-white px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              {t("lastName")}
                            </th>
                            <th className="sticky left-46 z-10 bg-white px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              {t("firstName")}
                            </th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              {t("dob")}
                            </th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              {t("gender")}
                            </th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              {t("passportNumber")}
                            </th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              {t("doe")}
                            </th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              {t("nationality")}
                            </th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              Type
                            </th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              Itinerary
                            </th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              Passport
                            </th>
                            <th className="px-4 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              {t("roomType")}
                            </th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              {t("bookingNumber")}
                            </th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              {t("hotel")}
                            </th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              Room
                            </th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase border border-gray-50 bg-clip-padding">
                              Baby Bed
                            </th>
                            <th className="px-5 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              {t("notes")}
                            </th>
                            <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase text-left border border-gray-50 bg-clip-padding">
                              {t("actions")}
                            </th>
                          </tr>
                        </thead>

                        <tbody className="bg-white relative">
                          {dateGroup.orderGroups.map(
                            (orderGroup, orderIndex) => {
                              return orderGroup.passengers.map((p, i) => {
                                const prevPassenger =
                                  i > 0 ? orderGroup.passengers[i - 1] : null;

                                const isFirstInOrder = i === 0;
                                const isGroupLinked =
                                  orderGroup.passengers.some(
                                    (pass) => pass.is_related_to_next,
                                  );
                                const groupColor =
                                  p.group_color ||
                                  prevPassenger?.group_color ||
                                  null;
                                const linkedRowBg =
                                  isGroupLinked && groupColor
                                    ? `${groupColor}20`
                                    : "#ffffff";
                                const rowCellStyle = {
                                  backgroundColor: linkedRowBg,
                                } as const;

                                return (
                                  <tr
                                    key={p.id}
                                    className="transition-all duration-100 relative hover:shadow-[inset_0_0_0_9999px_rgba(15,23,42,0.04)]"
                                    style={{
                                      backgroundColor: linkedRowBg,
                                      borderLeft:
                                        isGroupLinked && groupColor
                                          ? `4px solid ${groupColor}`
                                          : "4px solid transparent",
                                    }}
                                  >
                                    {isFirstInOrder && (
                                      <td
                                        rowSpan={orderGroup.passengers.length}
                                        className="sticky left-0 z-30 px-3 py-3 text-center font-semibold border border-gray-50 bg-clip-padding"
                                        style={rowCellStyle}
                                      >
                                        {orderIndex + 1}
                                      </td>
                                    )}
                                    {isFirstInOrder && (
                                      <td
                                        rowSpan={orderGroup.passengers.length}
                                        className="sticky left-12 z-20 px-4 py-3 font-bold text-gray-800 align-top shadow-sm border border-gray-50 bg-clip-padding"
                                        style={rowCellStyle}
                                      >
                                        <div className="flex items-center gap-3">
                                          {orderGroup.displayId}
                                        </div>
                                      </td>
                                    )}

                                    <td
                                      className="sticky left-16 z-10 px-3 py-3 font-medium border border-gray-50 bg-clip-padding"
                                      style={rowCellStyle}
                                    >
                                      {p.last_name || "—"}
                                    </td>
                                    <td
                                      className="sticky left-46 z-10 px-3 py-3 font-medium text-blue-900 border border-gray-50 bg-clip-padding"
                                      style={rowCellStyle}
                                    >
                                      {p.first_name || "—"}
                                      {p.has_baby_bed && (
                                        <Baby className="w-4 h-4 inline ml-2 text-pink-600" />
                                      )}
                                    </td>

                                    <td className="px-3 py-3 border border-gray-50 bg-clip-padding">
                                      {formatDate(p.date_of_birth) || "—"}
                                    </td>
                                    <td className="px-3 py-3 border border-gray-50 bg-clip-padding">
                                      {p.gender || "—"}
                                    </td>
                                    <td className="px-3 py-3 font-mono text-xs border border-gray-50 bg-clip-padding">
                                      {p.passport_number || "—"}
                                    </td>
                                    <td className="px-3 py-3 border border-gray-50 bg-clip-padding">
                                      {formatDate(p.passport_expire) || "—"}
                                    </td>
                                    <td className="px-3 py-3 border border-gray-50 bg-clip-padding">
                                      {p.nationality || "—"}
                                    </td>

                                    <td className="px-3 py-3 text-center border border-gray-50 bg-clip-padding">
                                      <span
                                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                                          p.pax_type === "Child"
                                            ? "bg-purple-100 text-purple-800"
                                            : p.pax_type === "Infant"
                                              ? "bg-pink-100 text-pink-800"
                                              : "bg-blue-100 text-blue-800"
                                        }`}
                                      >
                                        {p.pax_type || "Adult"}
                                      </span>
                                    </td>

                                    <td className="px-3 py-3 text-center border border-gray-50 bg-clip-padding">
                                      {getItineraryDisplay(p.itinerary_status)}
                                    </td>

                                    <td className="px-3 py-3 text-center border border-gray-50 bg-clip-padding">
                                      {p.passport_upload ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(
                                              p.passport_upload!,
                                              "_blank",
                                            );
                                          }}
                                          className="text-blue-500 hover:text-green-800 font-bold text-xs"
                                        >
                                          <Eye />
                                        </button>
                                      ) : (
                                        <span className="text-red-500 font-bold text-xs">
                                          MISSING
                                        </span>
                                      )}
                                    </td>

                                    {isFirstInOrder && (
                                      <>
                                        <td
                                          rowSpan={orderGroup.passengers.length}
                                          className="px-4 py-3 font-semibold text-indigo-700 border border-gray-50 bg-clip-padding"
                                        >
                                          {orderGroup.roomType || "—"}
                                        </td>
                                        <td
                                          rowSpan={orderGroup.passengers.length}
                                          className="px-3 py-3 border border-gray-50 bg-clip-padding"
                                        >
                                          <input
                                            type="text"
                                            value={
                                              groupBookings[orderGroup.key] ||
                                              ""
                                            }
                                            onChange={(e) =>
                                              setGroupBookings((prev) => ({
                                                ...prev,
                                                [orderGroup.key]:
                                                  e.target.value,
                                              }))
                                            }
                                            className="w-full px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                            placeholder="Booking #"
                                          />
                                        </td>
                                        <td
                                          rowSpan={orderGroup.passengers.length}
                                          className="px-4 py-3 font-medium border border-gray-50 bg-clip-padding"
                                        >
                                          {orderGroup.hotel || "—"}
                                        </td>
                                        <td
                                          rowSpan={orderGroup.passengers.length}
                                          className="px-4 py-3 font-bold text-indigo-600 text-center text-lg border border-gray-50 bg-clip-padding"
                                        >
                                          {orderGroup.roomAllocation || "—"}
                                        </td>
                                        <td
                                          rowSpan={orderGroup.passengers.length}
                                          className="px-3 py-3 text-center border border-gray-50 bg-clip-padding"
                                        >
                                          {p.has_baby_bed ? (
                                            <div className="w-8 h-8 bg-pink-100 text-pink-700 rounded-full flex items-center justify-center font-bold text-lg">
                                              BB
                                            </div>
                                          ) : (
                                            "—"
                                          )}
                                        </td>
                                        <td
                                          rowSpan={orderGroup.passengers.length}
                                          className="px-3 py-3 border border-gray-50 bg-clip-padding"
                                        >
                                          <textarea
                                            value={
                                              groupNotes[orderGroup.key] || ""
                                            }
                                            onChange={(e) =>
                                              setGroupNotes((prev) => ({
                                                ...prev,
                                                [orderGroup.key]:
                                                  e.target.value,
                                              }))
                                            }
                                            className="w-full px-3 py-2 border rounded-lg text-sm h-20 resize-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Group notes..."
                                          />
                                        </td>
                                        <td
                                          rowSpan={orderGroup.passengers.length}
                                          className="px-4 py-3 text-center border border-gray-50 bg-clip-padding"
                                        >
                                          <button
                                            onClick={() =>
                                              handleSaveOrder(orderGroup)
                                            }
                                            disabled={
                                              savingOrder === orderGroup.key
                                            }
                                            className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-full shadow hover:shadow-lg transition disabled:opacity-50"
                                          >
                                            {savingOrder === orderGroup.key
                                              ? "Saving..."
                                              : "SAVE"}
                                          </button>
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                );
                              });
                            },
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div dir={i18n.dir()} className="mono-stack">
      <div className="mono-card p-5">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="mono-nav min-w-max">
              {[
                {
                  id: "active",
                  label: "Active",
                  count: groupedData.filter((g) => !g.isCompleted).length,
                },
                {
                  id: "completed",
                  label: "Completed",
                  count: groupedData.filter((g) => g.isCompleted).length,
                },
                { id: "all", label: "All Tours", count: groupedData.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`mono-nav-item ${
                    activeTab === tab.id ? "mono-nav-item--active" : ""
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-1 flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search tour title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mono-input pl-10"
              />
            </div>
            <div className="relative sm:max-w-[220px]">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={filterDate || ""}
                onChange={(e) => setFilterDate(e.target.value || null)}
                className="mono-input pl-10 pr-10"
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate(null)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mono-stack">
        {visibleDateGroups.length === 0 ? (
          <div className="mono-card p-8 text-center text-gray-500">
            No tours found
          </div>
        ) : (
          visibleDateGroups.map(renderDateGroup)
        )}
      </div>
    </div>
  );
};

export default PassengerTable;
