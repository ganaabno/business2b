import { useState, useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  Tour,
  Passenger,
  ValidationError,
  User as UserType,
} from "../../types/type";
import { checkSeatLimit } from "../../utils/seatLimitChecks";

interface PassengerManagementStepProps {
  tours: Tour[];
  selectedTour: string;
  departureDate: string;
  setDepartureDate: Dispatch<SetStateAction<string>>;
  passengers: Passenger[];
  setPassengers: Dispatch<SetStateAction<Passenger[]>>;
  errors: ValidationError[];
  setValidationErrors: Dispatch<SetStateAction<ValidationError[]>>;
  showNotification: (type: "success" | "error", message: string) => void;
  currentUser: UserType;
  setActiveStep: Dispatch<SetStateAction<number>>;
  newPassengerRef: React.MutableRefObject<HTMLDivElement | null>;
  expandedPassengerId: string | null;
  setExpandedPassengerId: Dispatch<SetStateAction<string | null>>;
  setShowConfirmModal: Dispatch<
    SetStateAction<{
      action: "clearAll" | "resetForm" | null;
      message: string;
    } | null>
  >;
  bookingPassengers: Passenger[];
}

const MAX_PASSENGERS = 20;

const generatePassengerId = (): string =>
  `passenger_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

const createNewPassenger = (
  currentUser: UserType,
  existingPassengers: Passenger[],
  selectedTourData?: Tour
): Passenger => {
  const serialNo = (existingPassengers.length + 1).toString();
  const lastPassenger = existingPassengers[existingPassengers.length - 1];

  const defaultRoomType = (() => {
    if (existingPassengers.length === 0) return "";
    if (
      lastPassenger?.roomType === "Double" &&
      existingPassengers.length % 2 === 1
    ) {
      return "Double";
    }
    return "";
  })();

  const inheritedDetails = lastPassenger
    ? {
        nationality: lastPassenger.nationality,
        hotel: lastPassenger.hotel,
        emergency_phone: lastPassenger.emergency_phone,
      }
    : {
        nationality: "Mongolia",
        hotel: "",
        emergency_phone: "",
      };

  return {
    id: generatePassengerId(),
    order_id: "",
    user_id: currentUser.userId,
    tour_title: selectedTourData?.title || "",
    departure_date: "",
    name: "",
    room_allocation: "",
    serial_no: serialNo,
    last_name: "",
    first_name: "",
    date_of_birth: "",
    age: 0,
    gender: "",
    passport_number: "",
    passport_expire: "",
    nationality: inheritedDetails.nationality,
    roomType: defaultRoomType,
    hotel: inheritedDetails.hotel,
    additional_services: [],
    price: selectedTourData?.base_price || 0,
    email: "",
    phone: "",
    passport_upload: "",
    allergy: "",
    emergency_phone: inheritedDetails.emergency_phone,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "pending",
    is_blacklisted: false,
    blacklisted_date: new Date().toISOString(),
    notes: "",
    seat_count: 1,
    tour_id: "",
    passenger_number: "",
    main_passenger_id: "", // <-- added
    sub_passenger_count: 0, // <-- added
    has_sub_passengers: false, // <-- added
  };
};

export default function PassengerManagementStep({
  tours,
  selectedTour,
  departureDate,
  setDepartureDate,
  passengers,
  setPassengers,
  errors,
  setValidationErrors,
  showNotification,
  currentUser,
  setActiveStep,
  newPassengerRef,
  expandedPassengerId,
  setExpandedPassengerId,
  setShowConfirmModal,
  bookingPassengers,
}: PassengerManagementStepProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [remainingSeats, setRemainingSeats] = useState<number | undefined>(
    undefined
  );
  // Add state for passengerFormData
  const [passengerFormData, setPassengerFormData] = useState<{
    seat_count: number;
    tour_id: string;
    departure_date: string;
  } | null>(null);

  const selectedTourData = tours.find((t) => t.title === selectedTour);

  // Update passengerFormData when selectedTour or departureDate changes
  useEffect(() => {
    if (selectedTour && selectedTourData?.id && departureDate) {
      setPassengerFormData({
        seat_count: bookingPassengers.length || 1, // Default to 1 or use bookingPassengers length
        tour_id: selectedTourData.id,
        departure_date: departureDate,
      });
    } else {
      setPassengerFormData(null);
    }
  }, [selectedTour, selectedTourData, departureDate, bookingPassengers.length]);

  useEffect(() => {
    if (selectedTourData?.id && departureDate) {
      checkSeatLimit(selectedTourData.id, departureDate)
        .then(({ seats }) => {
          console.log(
            `Updated remaining seats for tour ${selectedTourData.id}: ${seats}`
          );
          setRemainingSeats(seats);
        })
        .catch((error) => {
          console.error("Error fetching remaining seats:", error);
          setRemainingSeats(0);
        });
    } else {
      setRemainingSeats(undefined);
    }
  }, [selectedTourData, departureDate]);

  const canAddPassenger = () => {
    if (bookingPassengers.length >= MAX_PASSENGERS) return false;
    if (!selectedTourData) return false;
    if (remainingSeats === undefined) return true;
    return remainingSeats > 0;
  };

  const calculateAge = (dateOfBirth: string): number => {
    if (!dateOfBirth) return 0;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()))
      age--;
    return age;
  };

  const calculateServicePrice = (
    services: string[],
    tourData: Tour
  ): number => {
    return services.reduce((sum, serviceName) => {
      const service = tourData.services.find((s) => s.name === serviceName);
      return sum + (service ? service.price : 0);
    }, tourData.base_price || 0);
  };

  const addPassenger = useCallback(async () => {
    if (isAdding || !canAddPassenger()) {
      if (bookingPassengers.length >= MAX_PASSENGERS) {
        showNotification(
          "error",
          `Maximum ${MAX_PASSENGERS} passengers allowed per booking`
        );
      } else {
        showNotification(
          "error",
          "Cannot add passenger. Tour is fully booked or invalid."
        );
      }
      return;
    }

    setIsAdding(true);
    try {
      const newPassenger = createNewPassenger(
        currentUser,
        bookingPassengers,
        selectedTourData
      );
      setPassengers((prev) => [
        ...prev.filter(
          (p) =>
            p.order_id !== "" || !bookingPassengers.some((bp) => bp.id === p.id)
        ),
        {
          ...newPassenger,
          tour_title: selectedTourData?.title || "Unknown Tour",
          departure_date: departureDate,
        },
      ]);
      setExpandedPassengerId(newPassenger.id);
      showNotification("success", `Passenger added`);
      newPassengerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      if (selectedTourData?.id && departureDate) {
        const { isValid, message } = await checkSeatLimit(
          selectedTourData.id,
          departureDate
        );
        showNotification(isValid ? "success" : "error", message);
      }
    } catch (error) {
      console.error("Error adding passenger:", error);
      showNotification("error", "Failed to add passenger");
    } finally {
      setIsAdding(false);
    }
  }, [
    bookingPassengers,
    currentUser,
    selectedTourData,
    departureDate,
    showNotification,
    setPassengers,
    isAdding,
  ]);

  const addMultiplePassengers = useCallback(
    async (count: number) => {
      if (
        isAdding ||
        !canAddPassenger() ||
        bookingPassengers.length + count > MAX_PASSENGERS
      ) {
        showNotification(
          "error",
          `Cannot add ${count} passengers. Maximum ${MAX_PASSENGERS} allowed.`
        );
        return;
      }
      if (
        selectedTourData?.seats !== undefined &&
        bookingPassengers.length + count > selectedTourData.seats
      ) {
        showNotification(
          "error",
          "Cannot add passengers. Tour is fully booked."
        );
        return;
      }

      setIsAdding(true);
      try {
        const newPassengers = Array.from({ length: count }, () =>
          createNewPassenger(currentUser, bookingPassengers, selectedTourData)
        ).map((p, idx) => ({
          ...p,
          serial_no: (bookingPassengers.length + idx + 1).toString(),
          tour_title: selectedTourData?.title || "Unknown Tour",
          departure_date: departureDate,
        }));
        setPassengers((prev) => [
          ...prev.filter(
            (p) =>
              p.order_id !== "" ||
              !bookingPassengers.some((bp) => bp.id === p.id)
          ),
          ...newPassengers,
        ]);
        setExpandedPassengerId(newPassengers[newPassengers.length - 1].id);
        showNotification("success", `${count} passengers added`);
        newPassengerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        if (selectedTourData?.id && departureDate) {
          const { isValid, message } = await checkSeatLimit(
            selectedTourData.id,
            departureDate
          );
          showNotification(isValid ? "success" : "error", message);
        }
      } catch (error) {
        console.error("Error adding passengers:", error);
        showNotification("error", `Failed to add ${count} passengers`);
      } finally {
        setIsAdding(false);
      }
    },
    [
      bookingPassengers,
      currentUser,
      selectedTourData,
      departureDate,
      showNotification,
      setPassengers,
      isAdding,
    ]
  );

  const updatePassenger = async (
    passengerId: string,
    field: keyof Passenger,
    value: any
  ) => {
    const updatedPassengers = [...passengers];
    const passengerIndex = passengers.findIndex(
      (p) => p.id === passengerId && p.user_id === currentUser.userId
    );
    if (passengerIndex === -1) {
      showNotification("error", "Passenger not found or not owned by user");
      return;
    }

    updatedPassengers[passengerIndex] = {
      ...updatedPassengers[passengerIndex],
      [field]: value,
    };

    if (field === "date_of_birth" && value) {
      updatedPassengers[passengerIndex].age = calculateAge(value);
    }

    if (field === "additional_services") {
      const tour = tours.find((t) => t.title === selectedTour);
      if (tour) {
        updatedPassengers[passengerIndex].price = calculateServicePrice(
          value as string[],
          tour
        );
      }
    }

    if (field === "first_name" || field === "last_name") {
      const first = updatedPassengers[passengerIndex].first_name || "";
      const last = updatedPassengers[passengerIndex].last_name || "";
      updatedPassengers[passengerIndex].name = `${first} ${last}`.trim();
    }

    updatedPassengers[passengerIndex].updated_at = new Date().toISOString();
    setPassengers(updatedPassengers);
  };

  const removePassenger = useCallback(
    (passengerId: string) => {
      const passengerIndex = passengers.findIndex(
        (p) => p.id === passengerId && p.user_id === currentUser.userId
      );
      if (passengerIndex === -1) {
        showNotification("error", "Passenger not found or not owned by user");
        return;
      }

      if (
        bookingPassengers.length === 1 &&
        passengers[passengerIndex].order_id === ""
      ) {
        showNotification(
          "error",
          "At least one passenger is required for a new booking"
        );
        return;
      }

      try {
        const updatedPassengers = passengers.filter(
          (p) => p.id !== passengerId
        );
        const reNumberedPassengers = updatedPassengers.map((passenger, i) => ({
          ...passenger,
          serial_no:
            passenger.user_id === currentUser.userId &&
            passenger.order_id === ""
              ? (i + 1).toString()
              : passenger.serial_no,
          updated_at: new Date().toISOString(),
        }));
        setPassengers(reNumberedPassengers);
        if (expandedPassengerId === passengerId) {
          setExpandedPassengerId(null);
        }
        showNotification("success", `Passenger removed`);

        if (selectedTourData?.id && departureDate) {
          checkSeatLimit(selectedTourData.id, departureDate).then(
            ({ isValid, message }) => {
              showNotification(isValid ? "success" : "error", message);
            }
          );
        }
      } catch (error) {
        console.error("Error removing passenger:", error);
        showNotification("error", "Failed to remove passenger");
      }
    },
    [
      bookingPassengers,
      passengers,
      expandedPassengerId,
      currentUser.userId,
      selectedTourData,
      departureDate,
      showNotification,
      setPassengers,
    ]
  );

  const clearAllPassengers = useCallback(() => {
    setShowConfirmModal({
      action: "clearAll",
      message: `Are you sure you want to remove all ${bookingPassengers.length} unsubmitted passengers?`,
    });
  }, [bookingPassengers.length, setShowConfirmModal]);

  const validatePassenger = (
    passenger: Passenger,
    departureDate: string
  ): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!passenger.first_name.trim())
      errors.push({
        field: `passenger_${passenger.id}_first_name`,
        message: "First name is required",
      });
    if (!passenger.last_name.trim())
      errors.push({
        field: `passenger_${passenger.id}_last_name`,
        message: "Last name is required",
      });
    if (!passenger.email.trim() || !/\S+@\S+\.\S+/.test(passenger.email))
      errors.push({
        field: `passenger_${passenger.id}_email`,
        message: "Valid email is required",
      });
    if (!passenger.phone.trim())
      errors.push({
        field: `passenger_${passenger.id}_phone`,
        message: "Phone number is required",
      });
    if (!passenger.nationality)
      errors.push({
        field: `passenger_${passenger.id}_nationality`,
        message: "Nationality is required",
      });
    if (!passenger.gender)
      errors.push({
        field: `passenger_${passenger.id}_gender`,
        message: "Gender is required",
      });
    if (!passenger.passport_number.trim())
      errors.push({
        field: `passenger_${passenger.id}_passport_number`,
        message: "Passport number is required",
      });
    if (!passenger.passport_expire)
      errors.push({
        field: `passenger_${passenger.id}_passport_expiry`,
        message: "Passport expiry date is required",
      });
    else {
      const expiryDate = new Date(passenger.passport_expire);
      const minDate = new Date(departureDate);
      minDate.setMonth(minDate.getMonth() + 6);
      if (expiryDate < minDate)
        errors.push({
          field: `passenger_${passenger.id}_passport_expiry`,
          message:
            "Passport must be valid for at least 6 months from departure date",
        });
    }
    if (!passenger.roomType)
      errors.push({
        field: `passenger_${passenger.id}_roomType`,
        message: "Room type is required",
      });
    if (!passenger.hotel)
      errors.push({
        field: `passenger_${passenger.id}_hotel`,
        message: "Hotel selection is required",
      });
    return errors;
  };

  const validateBooking = (): boolean => {
    const allErrors: ValidationError[] = [];
    if (!selectedTour)
      allErrors.push({ field: "tour", message: "Please select a tour" });
    if (!departureDate)
      allErrors.push({
        field: "departure",
        message: "Please select a departure date",
      });
    if (bookingPassengers.length === 0)
      allErrors.push({
        field: "passengers",
        message: "At least one passenger is required",
      });

    bookingPassengers.forEach((passenger) => {
      const passengerErrors = validatePassenger(passenger, departureDate);
      allErrors.push(...passengerErrors);
    });

    setValidationErrors(allErrors);
    return allErrors.length === 0;
  };

  const handleUploadCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      showNotification("error", "Please upload a CSV file");
      return;
    }

    const tourData = tours.find((t) => t.title === selectedTour);
    if (!tourData) {
      showNotification("error", "No tour selected");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((line) => line.trim());
        if (lines.length < 2) {
          showNotification(
            "error",
            "CSV file must contain at least a header and one data row"
          );
          return;
        }

        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().replace(/"/g, ""));
        const requiredHeaders = [
          "Room Allocation",
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
          "Additional Services",
          "Price",
          "Email",
          "Phone",
          "Allergy",
          "Emergency Phone",
        ];
        if (!requiredHeaders.every((h) => headers.includes(h))) {
          showNotification("error", "CSV file is missing required headers");
          return;
        }

        const data = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
          return headers.reduce((obj: Record<string, string>, header, i) => {
            obj[header] = values[i] || "";
            return obj;
          }, {});
        });

        if (
          tourData.seats !== undefined &&
          data.length + bookingPassengers.length > tourData.seats
        ) {
          showNotification(
            "error",
            "Cannot import passengers. The tour is fully booked."
          );
          return;
        }

        const newPassengers = data.map((row, idx) => {
          const passenger: Passenger = {
            id: generatePassengerId(),
            order_id: "",
            user_id: currentUser.userId,
            tour_title: tourData.title,
            departure_date: departureDate,
            name: `${row["First Name"]} ${row["Last Name"]}`.trim(),
            room_allocation: row["Room Allocation"] || "",
            serial_no: (bookingPassengers.length + idx + 1).toString(),
            last_name: row["Last Name"] || "",
            first_name: row["First Name"] || "",
            date_of_birth: row["Date of Birth"] || "",
            age: calculateAge(row["Date of Birth"]),
            gender: row["Gender"] || "",
            passport_number: row["Passport Number"] || "",
            passport_expire: row["Passport Expiry"] || "",
            nationality: row["Nationality"] || "Mongolia",
            roomType: row["Room Type"] || "",
            hotel: row["Hotel"] || "",
            additional_services: row["Additional Services"]
              ? row["Additional Services"]
                  .split(",")
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : [],
            price: parseFloat(row["Price"]) || tourData.base_price || 0,
            email: row["Email"] || "",
            phone: row["Phone"] || "",
            passport_upload: "",
            allergy: row["Allergy"] || "",
            emergency_phone: row["Emergency Phone"] || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: "pending",
            is_blacklisted: false,
            blacklisted_date: new Date().toISOString(),
            notes: "",
            seat_count: 1,
            tour_id: tourData.id,
            passenger_number: (bookingPassengers.length + idx + 1).toString(),
            main_passenger_id: "", // <-- added
            sub_passenger_count: 0, // <-- added
            has_sub_passengers: false, // <-- added
          };
          if (tourData && passenger.additional_services.length > 0) {
            passenger.price = calculateServicePrice(
              passenger.additional_services,
              tourData
            );
          }
          return passenger;
        });

        setPassengers((prev) => [
          ...prev.filter(
            (p) =>
              p.order_id !== "" ||
              !bookingPassengers.some((bp) => bp.id === p.id)
          ),
          ...newPassengers,
        ]);
        setExpandedPassengerId(newPassengers[newPassengers.length - 1].id);
        showNotification(
          "success",
          `${newPassengers.length} passengers imported from CSV`
        );
        newPassengerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        if (tourData.id && departureDate) {
          checkSeatLimit(tourData.id, departureDate).then(
            ({ isValid, message }) => {
              showNotification(isValid ? "success" : "error", message);
            }
          );
        }
      } catch (error) {
        console.error("Error parsing CSV:", error);
        showNotification(
          "error",
          "Failed to parse CSV file. Please check the format."
        );
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
   0
  );
}
