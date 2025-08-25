import type { Passenger } from "../types/type";

export const downloadCSV = (passengers: Passenger[], selectedTour: string, showNotification: (type: "success" | "error", message: string) => void) => {
  if (passengers.length === 0) {
    showNotification("error", "No passengers to export");
    return;
  }

  const headers = [
    "Room Allocation",
    "Serial No",
    "Last Name",
    "First Name",
    "Date of Birth",
    // ... other headers
  ];

  const rows = passengers.map((p) =>
    [
      p.room_allocation || "",
      p.serial_no || "",
      p.last_name || "",
      p.first_name || "",
      p.date_of_birth || "",
      // ... other fields
    ].map((v) => `"${v}"`).join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `passengers_${selectedTour}_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
  showNotification("success", "CSV downloaded successfully");
};

export const downloadTemplate = (showNotification: (type: "success" | "error", message: string) => void) => {
  const headers = [
    "Room Allocation",
    "Serial No",
    "Last Name",
    "First Name",
    "Date of Birth",
    // ... other headers
  ];
  const sampleRow = [
    "101",
    "1",
    "Doe",
    "John",
    "1990-01-01",
    // ... other sample data
  ];
  const csv = [headers.join(","), sampleRow.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "passenger_template.csv";
  a.click();
  window.URL.revokeObjectURL(url);
  showNotification("success", "Template downloaded successfully");
};