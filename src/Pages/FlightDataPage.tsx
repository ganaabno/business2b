import { useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useFlightStore } from "../utils/flightStore";
import DataTable from "../Parts/DataTable.";
import FileUploader from "../Parts/FileUploader";

export default function FlightDataTab() {
  const { flightData, isLoading, setFlightData, setLoading } = useFlightStore();

  useEffect(() => {
    // Хэрвээ өгөгдөл аль хэдийн татагдсан бол → дахиж битгий тат
    if (flightData) {
      setLoading(false);
      return;
    }

    // ЗӨВХӨН НЭГ УДАА татна
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("flight_data")
        .select("data")
        .order("uploaded_at", { ascending: false });

      if (error) {
        console.error("Татахад алдаа:", error);
        setLoading(false);
        return;
      }

      const flatData = data.map((row) => row.data);
      setFlightData(flatData);
    };

    fetchData();
  }, [flightData, setFlightData, setLoading]);

  // Upload амжилттай бол шинэчлэх
  const handleUploadComplete = () => {
    // Дахин татах эсвэл local state шинэчлэх
    window.location.reload(); // эсвэл доорхи аргаар realtime хийж болно
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-xl text-gray-600">Өгөгдөл татаж байна...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FileUploader onUploadComplete={handleUploadComplete} currentUser={{ id: "temp" }} />
      {flightData && <DataTable data={flightData} />}
    </div>
  );
}