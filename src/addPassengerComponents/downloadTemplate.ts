export const downloadTemplate = () => {
  // Fixed headers - removed duplicate Room Allocation and Actions
  const headers = [
    "Serial No",
    "Last Name",
    "First Name",
    "Date of Birth",
    "Age",
    "Gender",
    "Passport Number",
    "Passport Expiry",
    "Nationality",
    "Room Type",
    "Hotel",
    "Room Allocation",
    "Additional Services",
    "Price",
    "Email",
    "Phone",
    "Allergy",
    "Emergency Phone"
  ];

  // Create sample data with auto-generated serial numbers
  const sampleData = [
    // Header row
    headers.join(","),
    // Sample row 1
    [
      "1",
      "Doe",
      "John",
      "1990-05-15",
      "34",
      "Male",
      "AB1234567",
      "2030-12-31",
      "USA",
      "Single",
      "Grand Hotel",
      "M1",
      "",
      "1500",
      "john.doe@email.com",
      "+1-555-0123",
      "",
      "+1-555-0124"
    ].map(v => `"${v}"`).join(","),
    // Sample row 2
    [
      "2",
      "Smith",
      "Jane",
      "1985-08-22",
      "39",
      "Female",
      "CD7654321",
      "2028-06-30",
      "Canada",
      "Double",
      "Grand Hotel",
      "M2",
      "Breakfast",
      "1600",
      "jane.smith@email.com",
      "+1-555-0456",
      "Peanuts",
      "+1-555-0457"
    ].map(v => `"${v}"`).join(",")
  ].join("\n");

  const blob = new Blob([sampleData], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `passenger_template_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  
  // Simple console notification - you can replace this with your notification system
  console.log("✅ Template downloaded successfully");
};