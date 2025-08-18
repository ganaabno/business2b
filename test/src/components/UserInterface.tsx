import { useState, useCallback, useEffect } from "react";
import { supabase } from "../supabaseClient";
import type { Tour, Order, User as UserType, Passenger, ValidationError } from "../types/type";
import Header from "../Parts/Header";
import Notification from "../Parts/Notification";
import ProgressSteps from "../Parts/ProgressSteps";
import ErrorSummary from "../Parts/ErrorSummary";
import TourSelection from "../Parts/TourSelection";
import PassengerForm from "../Parts/PassengerForm";
import BookingSummary from "../Parts/BookingSummary";
import AdminOverview from "../Parts/AdminOverview";

interface UserInterfaceProps {
  tours: Tour[];
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  currentUser: UserType;
  onLogout: () => void;
}

function UserInterface({ tours, orders, setOrders, currentUser, onLogout }: UserInterfaceProps) {
  const [selectedTour, setSelectedTour] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [activeStep, setActiveStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState("");

  // Filter tours to remove available_seats for regular users
  const filteredTours = currentUser.role === "user"
    ? tours.map(({ available_seats, ...rest }) => rest)
    : tours;

  // Reset departureDate when selectedTour changes
  useEffect(() => {
    setDepartureDate("");
  }, [selectedTour]);

  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const validatePassenger = (passenger: Passenger, departureDate: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!passenger.first_name.trim()) errors.push({ field: 'first_name', message: 'First name is required' });
    if (!passenger.last_name.trim()) errors.push({ field: 'last_name', message: 'Last name is required' });
    if (!passenger.email.trim() || !/\S+@\S+\.\S+/.test(passenger.email)) errors.push({ field: 'email', message: 'Valid email is required' });
    if (!passenger.phone.trim()) errors.push({ field: 'phone', message: 'Phone number is required' });
    if (!passenger.nationality) errors.push({ field: 'nationality', message: 'Nationality is required' });
    if (!passenger.gender) errors.push({ field: 'gender', message: 'Gender is required' });
    if (!passenger.passport_number.trim()) errors.push({ field: 'passport_number', message: 'Passport number is required' });
    if (!passenger.passport_expiry) errors.push({ field: 'passport_expiry', message: 'Passport expiry date is required' });
    else {
      const expiryDate = new Date(passenger.passport_expiry);
      const minDate = new Date(departureDate);
      minDate.setMonth(minDate.getMonth() + 6);
      if (expiryDate < minDate) errors.push({ field: 'passport_expiry', message: 'Passport must be valid for at least 6 months from departure date' });
    }
    if (!passenger.roomType) errors.push({ field: 'roomType', message: 'Room type is required' });
    if (!passenger.hotel) errors.push({ field: 'hotel', message: 'Hotel selection is required' });
    return errors;
  };

  const calculateAge = (dateOfBirth: string): number => {
    if (!dateOfBirth) return 0;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  };

  const calculateServicePrice = (services: string[], tourData: Tour): number => {
    return services.reduce((sum, serviceName) => {
      const service = tourData.services.find(s => s.name === serviceName);
      return sum + (service ? service.price : 0);
    }, 0);
  };

  const getPassportExpiryColor = (expiryDate: string): string => {
    if (!expiryDate) return 'border-gray-300';
    const expiry = new Date(expiryDate);
    const today = new Date();
    const monthsRemaining = (expiry.getFullYear() - today.getFullYear()) * 12 + (expiry.getMonth() - today.getMonth());
    if (monthsRemaining <= 0) return 'border-red-500 bg-red-50';
    if (monthsRemaining <= 1) return 'border-red-400 bg-red-50';
    if (monthsRemaining <= 3) return 'border-orange-400 bg-orange-50';
    if (monthsRemaining <= 7) return 'border-yellow-400 bg-yellow-50';
    return 'border-green-400 bg-green-50';
  };

  const addPassenger = () => {
    const newPassenger: Passenger = {
      id: `passenger-${Date.now()}-${passengers.length}`,
      order_id: "",
      user_id: currentUser.id,
      name: "",
      room_allocation: "",
      serial_no: (passengers.length + 1).toString(),
      last_name: "",
      first_name: "",
      date_of_birth: "",
      age: 0,
      gender: "",
      passport_number: "",
      passport_expiry: "",
      nationality: "Mongolia",
      roomType: passengers.length > 0 && passengers[passengers.length - 1].roomType === "Double" 
        ? passengers[passengers.length - 1].roomType 
        : "",
      hotel: "",
      additional_services: [],
      price: 0,
      email: "",
      phone: "",
      passport_upload: "",
      allergy: "",
      emergency_phone: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setPassengers([...passengers, newPassenger]);
  };

  const updatePassenger = async (index: number, field: keyof Passenger, value: any) => {
    const updatedPassengers = [...passengers];
    updatedPassengers[index] = { ...updatedPassengers[index], [field]: value };

    if (field === "date_of_birth" && value) {
      updatedPassengers[index].age = calculateAge(value);
    }

    if (field === "additional_services") {
      const tour = tours.find((t) => t.title === selectedTour);
      if (tour) {
        updatedPassengers[index].price = calculateServicePrice(value as string[], tour);
      }
    }

    if (field === "first_name" || field === "last_name") {
      const first = updatedPassengers[index].first_name;
      const last = updatedPassengers[index].last_name;
      updatedPassengers[index].name = isGroup ? `${groupName} - ${first} ${last}`.trim() : `${first} ${last}`.trim();
    }

    if (field === "passport_upload" && value instanceof File) {
      try {
        setLoading(true);
        const fileExt = value.name.split('.').pop();
        const fileName = `passport_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { data, error } = await supabase.storage.from('passports').upload(fileName, value);
        if (error) {
          showNotification('error', `Passport upload failed: ${error.message}`);
        } else {
          updatedPassengers[index].passport_upload = data.path;
          showNotification('success', 'Passport uploaded successfully');
        }
      } catch (error) {
        showNotification('error', 'Failed to upload passport');
      } finally {
        setLoading(false);
      }
    }

    updatedPassengers[index].updated_at = new Date().toISOString();
    setPassengers(updatedPassengers);
  };

  const removePassenger = (index: number) => {
    if (passengers.length === 1) {
      showNotification('error', 'At least one passenger is required');
      return;
    }
    setPassengers(passengers.filter((_, i) => i !== index));
  };

  const validateBooking = (): boolean => {
    const allErrors: ValidationError[] = [];
    if (!selectedTour) allErrors.push({ field: 'tour', message: 'Please select a tour' });
    if (!departureDate) allErrors.push({ field: 'departure', message: 'Please select a departure date' });
    if (passengers.length === 0) allErrors.push({ field: 'passengers', message: 'At least one passenger is required' });
    if (!paymentMethod) allErrors.push({ field: 'payment', message: 'Please select a payment method' });

    passengers.forEach((passenger, index) => {
      const passengerErrors = validatePassenger(passenger, departureDate);
      passengerErrors.forEach(error => {
        allErrors.push({ field: `passenger_${index}_${error.field}`, message: `Passenger ${index + 1}: ${error.message}` });
      });
    });

    setErrors(allErrors);
    return allErrors.length === 0;
  };

  const saveOrder = async () => {
    if (!validateBooking()) {
      showNotification('error', 'Please fix the validation errors before proceeding');
      return;
    }

    const tourData = tours.find((t) => t.title === selectedTour);
    if (!tourData) {
      showNotification('error', 'Selected tour not found');
      return;
    }

    if (tourData.available_seats !== undefined && tourData.available_seats < passengers.length) {
      showNotification('error', 'Cannot save booking. The tour is fully booked.');
      return;
    }

    setLoading(true);

    try {
      const totalPrice = passengers.reduce((sum, p) => sum + p.price, 0);
      const commission = totalPrice * 0.05;

      const newOrder: Omit<Order, "id" | "passengers"> = {
        user_id: currentUser.id,
        tour_id: tourData.id,
        phone: passengers[0].phone,
        last_name: passengers[0].last_name,
        first_name: passengers[0].first_name,
        age: passengers[0].age,
        gender: passengers[0].gender,
        passport_number: passengers[0].passport_number,
        passport_expire: passengers[0].passport_expiry,
        passport_copy: passengers[0].passport_upload,
        commission,
        created_by: currentUser.id,
        createdBy: currentUser.username || currentUser.email,
        tour: tourData.title,
        edited_by: null,
        edited_at: null,
        travel_choice: selectedTour,
        status: "pending",
        hotel: passengers[0].hotel,
        room_number: passengers[0].room_allocation,
        payment_method: paymentMethod,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        departureDate: departureDate,
        total_price: totalPrice,
      };

      const { data: orderData, error: orderError } = await supabase.from('orders').insert(newOrder).select().single();
      if (orderError) throw new Error(orderError.message);

      const orderId = orderData.id;
      const passengersWithOrderId = passengers.map((p) => {
        const { id, ...rest } = p;
        return { ...rest, order_id: orderId };
      });

      const { error: passengerError } = await supabase.from('passengers').insert(passengersWithOrderId);
      if (passengerError) throw new Error(passengerError.message);

      if (tourData.available_seats !== undefined) {
        const { error: tourUpdateError } = await supabase
          .from('tours')
          .update({ available_seats: tourData.available_seats - passengers.length, updated_at: new Date().toISOString() })
          .eq('id', tourData.id);
        if (tourUpdateError) console.warn('Failed to update tour seats:', tourUpdateError.message);
      }

      setOrders([...orders, { ...orderData, passengers: passengersWithOrderId }]);
      showNotification('success', 'Booking saved successfully!');

      setPassengers([]);
      setSelectedTour("");
      setDepartureDate("");
      setPaymentMethod("");
      setActiveStep(1);
      setErrors([]);
      setIsGroup(false);
      setGroupName("");
    } catch (error) {
      showNotification('error', `Error saving booking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (passengers.length === 0) {
      showNotification('error', 'No passengers to export');
      return;
    }

    const headers = [
      "Room Allocation", "Serial No", "Last Name", "First Name", "Date of Birth", "Age",
      "Gender", "Passport Number", "Passport Expiry", "Nationality", "Room Type", "Hotel",
      "Additional Services", "Price", "Email", "Phone", "Allergy", "Emergency Phone"
    ];

    const rows = passengers.map((p) =>
      [
        p.room_allocation, p.serial_no, p.last_name, p.first_name, p.date_of_birth, p.age,
        p.gender, p.passport_number, p.passport_expiry, p.nationality, p.roomType, p.hotel,
        p.additional_services.join(","), p.price, p.email, p.phone, p.allergy || "", p.emergency_phone || ""
      ].map((v) => `"${v}"`).join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `booking_${selectedTour}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showNotification('success', 'CSV downloaded successfully');
  };

  const downloadTemplate = () => {
    const headers = [
      "Room Allocation", "Serial No", "Last Name", "First Name", "Date of Birth", "Age",
      "Gender", "Passport Number", "Passport Expiry", "Nationality", "Room Type", "Hotel",
      "Additional Services", "Price", "Email", "Phone", "Allergy", "Emergency Phone"
    ];
    const sampleRow = [
      "101", "1", "Doe", "John", "1990-01-01", "33", "Male", "A12345678", "2030-01-01",
      "Mongolia", "Single", "Hotel A", "Service1,Service2", "100", "john@email.com",
      "+976 99999999", "None", "+976 88888888"
    ];
    const csv = [headers.join(","), sampleRow.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "passenger_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    showNotification('success', 'Template downloaded successfully');
  };

  const handleUploadCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showNotification('error', 'Please upload a CSV file');
      return;
    }

    const tourData = tours.find((t) => t.title === selectedTour);
    if (!tourData) {
      showNotification('error', 'No tour selected');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter(line => line.trim());
        if (lines.length < 2) {
          showNotification('error', 'CSV file must contain at least a header and one data row');
          return;
        }

        const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
        const data = lines.slice(1).map((line) => {
          const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
          return headers.reduce((obj: Record<string, string>, header, i) => {
            obj[header] = values[i] || "";
            return obj;
          }, {});
        });

        if (tourData.available_seats !== undefined && data.length + passengers.length > tourData.available_seats) {
          showNotification('error', 'Cannot import passengers. The tour is fully booked.');
          return;
        }

        const newPassengers = data.map((row, idx) => {
          const passenger: Passenger = {
            id: `passenger-${Date.now()}-${idx}`,
            order_id: "",
            user_id: currentUser.id,
            name: `${row["First Name"]} ${row["Last Name"]}`.trim(),
            room_allocation: row["Room Allocation"] || "",
            serial_no: row["Serial No"] || (idx + 1).toString(),
            last_name: row["Last Name"] || "",
            first_name: row["First Name"] || "",
            date_of_birth: row["Date of Birth"] || "",
            age: calculateAge(row["Date of Birth"]),
            gender: row["Gender"] || "",
            passport_number: row["Passport Number"] || "",
            passport_expiry: row["Passport Expiry"] || "",
            nationality: row["Nationality"] || "Mongolia",
            roomType: row["Room Type"] || "",
            hotel: row["Hotel"] || "",
            additional_services: row["Additional Services"] ? row["Additional Services"].split(",").map((s: string) => s.trim()).filter(Boolean) : [],
            price: 0,
            email: row["Email"] || "",
            phone: row["Phone"] || "",
            passport_upload: "",
            allergy: row["Allergy"] || "",
            emergency_phone: row["Emergency Phone"] || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          if (tourData && passenger.additional_services.length > 0) {
            passenger.price = calculateServicePrice(passenger.additional_services, tourData);
          }

          return passenger;
        });

        setPassengers(newPassengers);
        showNotification('success', `Successfully imported ${newPassengers.length} passengers`);
      }
      catch (error) {
        showNotification('error', 'Failed to parse CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const selectedTourData = tours.find((t) => t.title === selectedTour);
  const totalPrice = passengers.reduce((sum, p) => sum + p.price, 0);

  if (currentUser.role !== "user") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header currentUser={currentUser} onLogout={onLogout} isUserRole={false} />
        <AdminOverview orders={orders} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Notification notification={notification} setNotification={setNotification} />
      <Header currentUser={currentUser} onLogout={onLogout} isUserRole={true} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProgressSteps activeStep={activeStep} />
        <ErrorSummary errors={errors} />
        {activeStep === 1 && (
          <TourSelection
            tours={filteredTours}
            selectedTour={selectedTour}
            setSelectedTour={setSelectedTour}
            departureDate={departureDate}
            setDepartureDate={setDepartureDate}
            errors={errors}
            setActiveStep={setActiveStep}
            userRole={currentUser.role}
          />
        )}
        {activeStep === 2 && (
          <PassengerForm
            passengers={passengers}
            setPassengers={setPassengers}
            selectedTourData={selectedTourData}
            errors={errors}
            updatePassenger={updatePassenger}
            removePassenger={removePassenger}
            downloadTemplate={downloadTemplate}
            handleUploadCSV={handleUploadCSV}
            addPassenger={addPassenger}
            setActiveStep={setActiveStep}
            isGroup={isGroup}
            setIsGroup={setIsGroup}
            groupName={groupName}
            setGroupName={setGroupName}
            showNotification={showNotification}
          />
        )}
        {activeStep === 3 && (
          <BookingSummary
            selectedTour={selectedTour}
            departureDate={departureDate}
            passengers={passengers}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            errors={errors}
            downloadCSV={downloadCSV}
            saveOrder={saveOrder}
            setActiveStep={setActiveStep}
            loading={loading}
          />
        )}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:hidden z-40">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">Step {activeStep} of 3</div>
          <div className="text-sm font-medium text-gray-900">
            {passengers.length > 0 && (
              <span>{passengers.length} passenger{passengers.length !== 1 ? 's' : ''} • ${totalPrice.toLocaleString()}</span>
            )}
          </div>
        </div>
        {activeStep < 3 && (
          <div className="mt-2">
            <button
              onClick={() => {
                if (activeStep === 1 && selectedTour && departureDate) setActiveStep(2);
                else if (activeStep === 2 && passengers.length > 0) setActiveStep(3);
              }}
              disabled={(activeStep === 1 && (!selectedTour || !departureDate)) || (activeStep === 2 && passengers.length === 0)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {activeStep === 1 ? 'Continue to Passengers' : 'Review Booking'}
            </button>
          </div>
        )}
      </div>
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-900">Processing your request...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserInterface;