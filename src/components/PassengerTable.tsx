import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import { toast } from "react-toastify";

interface Passenger {
  id: string;
  orderId: string;
  first_name: string;
  last_name: string | null;
  age: number | null;
  date_of_birth: string | null;
  gender: string | null;
  passport_number: string | null;
  passport_expire: string | null;
  nationality: string | null;
  notes: string | null;
  tour: string | null;
  departureDate: string | null;
  room_allocation: string | null;
  booking_number: string | null;
  hotel: string | null;
  pax: number;
  roomType: string | null;
}

interface PassengerTableProps {
  passengers: Passenger[];
  selectedDate: string;
}

const PassengerTable = ({ passengers, selectedDate }: PassengerTableProps) => {
  const { t, i18n } = useTranslation();
  const [notes, setNotes] = useState<{ [key: string]: string }>({});
  const [bookingNumbers, setBookingNumbers] = useState<{
    [key: string]: string;
  }>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!passengers) {
      console.log("PassengerTable: No passengers provided");
      return;
    }

    setLoading(true);
    setNotes(
      passengers.reduce(
        (acc, passenger) => ({
          ...acc,
          [passenger.id + (passenger.first_name || "")]: passenger.notes || "",
        }),
        {}
      )
    );
    setBookingNumbers(
      passengers.reduce(
        (acc, passenger) => ({
          ...acc,
          [passenger.room_allocation || ""]: passenger.booking_number || "",
        }),
        {}
      )
    );
    setLoading(false);
  }, [passengers]);

  const handleNoteChange = (id: string, firstName: string, value: string) => {
    setNotes((prev) => ({
      ...prev,
      [id + firstName]: value,
    }));
  };

  const handleBookingNumberChange = (
    roomAllocation: string | null,
    value: string
  ) => {
    setBookingNumbers((prev) => ({
      ...prev,
      [roomAllocation || ""]: value,
    }));
  };

  const handleSave = async (
    id: string,
    firstName: string,
    roomAllocation: string | null
  ) => {
    const note = notes[id + firstName] || null;
    const bookingNumber = bookingNumbers[roomAllocation || ""] || null;

    try {
      const { data, error } = await supabase
        .from("passengers")
        .update({
          notes: note,
          booking_number: bookingNumber,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("id,notes,booking_number,date_of_birth");
      if (error) throw error;
      toast.success(t("notesUpdated"));
    } catch (error: any) {
      toast.error(t("failedToUpdateNotes"));
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString || dateString === "null") {
      return t("notSet");
    }
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return t("invalidDate");
      }
      return date.toISOString().split("T")[0]; // Consistent YYYY-MM-DD format
    } catch (error) {
      return t("invalidDate");
    }
  };

  // Sort passengers by room_allocation for grouping
  const filteredPassengers = passengers
    .filter((passenger) =>
      selectedDate
        ? formatDate(passenger.departureDate ?? null) === selectedDate
        : true
    )
    .sort((a, b) =>
      (a.room_allocation || "").localeCompare(b.room_allocation || "")
    );

  // Calculate rowspan for each room_allocation group
  const roomGroups: { [key: string]: number } = {};
  filteredPassengers.forEach((passenger) => {
    const key = passenger.room_allocation || "";
    roomGroups[key] = (roomGroups[key] || 0) + 1;
  });

  if (loading) {
    return <div className="text-center py-4">{t("loading")}</div>;
  }

  if (!passengers || passengers.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">{t("Passenger List")}</h2>
        <div className="text-center text-gray-500">{t("noPassengers")}</div>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      dir={i18n.dir()}
    >
      <style>
        {`
          .low-opacity-border {
            border: 1px solid rgba(0, 0, 0, 0.1);
          }
          .low-opacity-border th,
          .low-opacity-border td {
            border: 1px solid rgba(0, 0, 0, 0.1);
          }
          .dark .low-opacity-border,
          .dark .low-opacity-border th,
          .dark .low-opacity-border td {
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
        `}
      </style>
      <h2 className="text-xl font-bold mb-4">{t("Passenger List")}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed low-opacity-border">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[6%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[6%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-10 py-[5px] text-start text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] max-w-[200px]">
                {t("roomAllocation")}
              </th>
              <th className="px-10 py-[5px] text-start text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] max-w-[200px]">
                {t("lastName")}
              </th>
              <th className="px-10 py-[5px] text-start text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] max-w-[200px]">
                {t("firstName")}
              </th>
              <th className="px-10 py-[5px] text-start text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] max-w-[200px]">
                {t("dob")}
              </th>
              <th className="px-10 py-[5px] text-start text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px] max-w-[150px]">
                {t("gender")}
              </th>
              <th className="px-10 py-[5px] text-start text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] max-w-[200px]">
                {t("passportNumber")}
              </th>
              <th className="px-10 py-[5px] text-start text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] max-w-[200px]">
                {t("doe")}
              </th>
              <th className="px-10 py-[5px] text-start text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] max-w-[200px]">
                {t("nationality")}
              </th>
              <th className="px-10 py-[5px] text-start text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[80px] max-w-[150px]">
                {t("pax")}
              </th>
              <th className="px-8 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] max-w-[200px]">
                {t("roomType")}
              </th>
              <th className="px-12 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] max-w-[200px]">
                {t("bookingNumber")}
              </th>
              <th className="px-10 py-[5px] text-start text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] max-w-[200px]">
                {t("hotel")}
              </th>
              <th className="px-16 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] max-w-[250px]">
                {t("notes")}
              </th>
              <th className="px-10 py-[5px] text-start text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] max-w-[200px]">
                {t("actions")}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredPassengers.length > 0 ? (
              filteredPassengers.map((passenger, index) => {
                const isFirstInGroup =
                  index === 0 ||
                  passenger.room_allocation !==
                    filteredPassengers[index - 1].room_allocation;
                const rowspan =
                  roomGroups[passenger.room_allocation || ""] || 1;

                return (
                  <tr key={passenger.id + (passenger.first_name || "")}>
                    {isFirstInGroup ? (
                      <td
                        className="px-6 py-4 whitespace-normal break-words min-w-[100px] max-w-[200px]"
                        rowSpan={rowspan}
                      >
                        {passenger.room_allocation || "N/A"}
                      </td>
                    ) : null}
                    <td className="px-6 py-4 whitespace-normal break-words min-w-[100px] max-w-[200px]">
                      {passenger.last_name || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-normal break-words min-w-[100px] max-w-[200px]">
                      {passenger.first_name || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-normal break-words min-w-[100px] max-w-[200px]">
                      {formatDate(passenger.date_of_birth) || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-normal break-words min-w-[80px] max-w-[150px]">
                      {passenger.gender || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-normal break-words min-w-[100px] max-w-[200px]">
                      {passenger.passport_number || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-normal break-words min-w-[100px] max-w-[200px]">
                      {formatDate(passenger.passport_expire) || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-normal break-words min-w-[100px] max-w-[200px]">
                      {passenger.nationality || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-normal break-words min-w-[80px] max-w-[150px]">
                      {passenger.pax || "N/A"}
                    </td>
                    {isFirstInGroup ? (
                      <td
                        className="px-6 py-4 whitespace-normal break-words min-w-[100px] max-w-[200px]"
                        rowSpan={rowspan}
                      >
                        {passenger.roomType || "N/A"}
                      </td>
                    ) : null}
                    {isFirstInGroup ? (
                      <td
                        className="px-6 py-4 whitespace-normal break-words min-w-[100px] max-w-[200px]"
                        rowSpan={rowspan}
                      >
                        <input
                          type="text"
                          value={
                            bookingNumbers[passenger.room_allocation || ""] ||
                            ""
                          }
                          onChange={(e) =>
                            handleBookingNumberChange(
                              passenger.room_allocation,
                              e.target.value
                            )
                          }
                          className="border rounded px-2 py-1 w-full max-w-[200px]"
                        />
                      </td>
                    ) : null}
                    {isFirstInGroup ? (
                      <td
                        className="px-6 py-4 whitespace-normal break-words min-w-[100px] max-w-[200px]"
                        rowSpan={rowspan}
                      >
                        {passenger.hotel || "N/A"}
                      </td>
                    ) : null}
                    <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] max-w-[250px]">
                      <input
                        type="text"
                        value={
                          notes[passenger.id + (passenger.first_name || "")] ||
                          ""
                        }
                        onChange={(e) =>
                          handleNoteChange(
                            passenger.id,
                            passenger.first_name || "",
                            e.target.value
                          )
                        }
                        className="border rounded px-2 py-1 w-full max-w-[250px]"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-normal break-words min-w-[100px] max-w-[200px]">
                      <button
                        onClick={() =>
                          handleSave(
                            passenger.id,
                            passenger.first_name || "",
                            passenger.room_allocation
                          )
                        }
                        className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 transition"
                      >
                        {t("save")}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={14}
                  className="px-6 py-4 text-center text-gray-500"
                >
                  {t("noPassengers")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PassengerTable;
