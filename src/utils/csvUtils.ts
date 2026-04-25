export const downloadTemplate = (
  showNotification: (type: "success" | "error", message: string) => void
) => {
  const headers = [
    "Serial No",
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Emergency Phone",
    "Date of Birth",
    "Age",
    "Gender",
    "Nationality",
    "Passport Number",
    "Passport Expiry",
    "Room Type",
    "Room Allocation",
    "Hotel",
    "Additional Services",
    "Allergies",
    "Status",
  ];

  const csv = [headers.join(","), ""].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "passenger_template.csv";
  a.click();
  window.URL.revokeObjectURL(url);
  showNotification("success", "Template downloaded successfully");
};
