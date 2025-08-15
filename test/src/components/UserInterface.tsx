import { useState, useEffect, useCallback } from "react";
import {
  MapPin,
  Calendar,
  Users,
  Plus,
  Trash2,
  Download,
  Save,
  Hotel,
  Mail,
  Phone,
  CreditCard,
  FileText,
  DollarSign,
  Upload,
  Eye,
  User,
  AlertTriangle,
  CheckCircle,
  Clock,
  X
} from "lucide-react";
import type { Tour, Order, User as UserType, Passenger, PassengerFormData, ValidationError } from "../types/type";
import { supabase } from "../supabaseClient";

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

  const countries = [
    "Mongolia", "Russia", "China", "Afghanistan", "Albania", "Algeria", "Argentina", "Armenia",
    "Australia", "Austria", "Azerbaijan", "Bangladesh", "Belarus", "Belgium", "Brazil", "Bulgaria",
    "Cambodia", "Canada", "Chile", "Colombia", "Czech Republic", "Denmark", "Egypt", "Estonia",
    "Finland", "France", "Georgia", "Germany", "Greece", "Hungary", "Iceland", "India", "Indonesia",
    "Iran", "Iraq", "Ireland", "Israel", "Italy", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kuwait",
    "Kyrgyzstan", "Latvia", "Lebanon", "Lithuania", "Luxembourg", "Malaysia", "Mexico", "Netherlands",
    "New Zealand", "Norway", "Pakistan", "Philippines", "Poland", "Portugal", "Qatar", "Romania",
    "Saudi Arabia", "Singapore", "Slovakia", "Slovenia", "South Africa", "South Korea", "Spain",
    "Sweden", "Switzerland", "Tajikistan", "Thailand", "Turkey", "Turkmenistan", "Ukraine",
    "United Arab Emirates", "United Kingdom", "United States", "Uzbekistan", "Vietnam", "Zimbabwe"
  ];

  const paymentMethods = [
    "Cash", "Bank Transfer", "StorePay", "Pocket", "DariFinance",
    "Hutul Nomuun", "MonPay", "Barter", "Loan", "Credit Card"
  ];

  // Show notification
  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Validate passenger data
  const validatePassenger = (passenger: Passenger, departureDate: string): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!passenger.first_name.trim()) {
      errors.push({ field: 'first_name', message: 'First name is required' });
    }
    if (!passenger.last_name.trim()) {
      errors.push({ field: 'last_name', message: 'Last name is required' });
    }
    if (!passenger.email.trim() || !/\S+@\S+\.\S+/.test(passenger.email)) {
      errors.push({ field: 'email', message: 'Valid email is required' });
    }
    if (!passenger.phone.trim()) {
      errors.push({ field: 'phone', message: 'Phone number is required' });
    }
    if (!passenger.nationality) {
      errors.push({ field: 'nationality', message: 'Nationality is required' });
    }
    if (!passenger.gender) {
      errors.push({ field: 'gender', message: 'Gender is required' });
    }
    if (!passenger.passport_number.trim()) {
      errors.push({ field: 'passport_number', message: 'Passport number is required' });
    }
    if (!passenger.passport_expiry) {
      errors.push({ field: 'passport_expiry', message: 'Passport expiry date is required' });
    } else {
      const expiryDate = new Date(passenger.passport_expiry);
      const minDate = new Date(departureDate);
      minDate.setMonth(minDate.getMonth() + 6);
      if (expiryDate < minDate) {
        errors.push({ field: 'passport_expiry', message: 'Passport must be valid for at least 6 months from departure date' });
      }
    }
    if (!passenger.roomType) {
      errors.push({ field: 'roomType', message: 'Room type is required' });
    }
    if (!passenger.hotel) {
      errors.push({ field: 'hotel', message: 'Hotel selection is required' });
    }

    return errors;
  };

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth: string): number => {
    if (!dateOfBirth) return 0;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  // Calculate service price
  const calculateServicePrice = (services: string[], tourData: Tour): number => {
    return services.reduce((sum, serviceName) => {
      const service = tourData.services.find(s => s.name === serviceName);
      return sum + (service ? service.price : 0);
    }, 0);
  };

  // Get passport expiry color based on months remaining
  const getPassportExpiryColor = (expiryDate: string): string => {
    if (!expiryDate) return 'border-gray-300';

    const expiry = new Date(expiryDate);
    const today = new Date();
    const monthsRemaining = (expiry.getFullYear() - today.getFullYear()) * 12 + (expiry.getMonth() - today.getMonth());

    if (monthsRemaining <= 0) return 'border-red-500 bg-red-50'; // Expired
    if (monthsRemaining <= 1) return 'border-red-400 bg-red-50'; // 1 month or less
    if (monthsRemaining <= 3) return 'border-orange-400 bg-orange-50'; // 1-3 months
    if (monthsRemaining <= 7) return 'border-yellow-400 bg-yellow-50'; // 3-7 months
    return 'border-green-400 bg-green-50'; // 7+ months
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
      nationality: "",
      roomType: "",
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

    // Auto-calculate age when date of birth changes
    if (field === "date_of_birth" && value) {
      updatedPassengers[index].age = calculateAge(value);
    }

    // Auto-calculate price when services change
    if (field === "additional_services") {
      const tour = tours.find((t) => t.title === selectedTour);
      if (tour) {
        updatedPassengers[index].price = calculateServicePrice(value as string[], tour);
      }
    }

    // Update full name when first or last name changes
    if (field === "first_name" || field === "last_name") {
      const first = updatedPassengers[index].first_name;
      const last = updatedPassengers[index].last_name;
      updatedPassengers[index].name = isGroup 
        ? `${groupName} - ${first} ${last}`.trim() 
        : `${first} ${last}`.trim();
    }

    // Handle file upload for passport
    if (field === "passport_upload" && value instanceof File) {
      try {
        setLoading(true);
        const fileExt = value.name.split('.').pop();
        const fileName = `passport_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('passports')
          .upload(fileName, value);

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

    if (!selectedTour) {
      allErrors.push({ field: 'tour', message: 'Please select a tour' });
    }
    if (!departureDate) {
      allErrors.push({ field: 'departure', message: 'Please select a departure date' });
    }
    if (passengers.length === 0) {
      allErrors.push({ field: 'passengers', message: 'At least one passenger is required' });
    }
    if (!paymentMethod) {
      allErrors.push({ field: 'payment', message: 'Please select a payment method' });
    }

    // Validate each passenger
    passengers.forEach((passenger, index) => {
      const passengerErrors = validatePassenger(passenger, departureDate);
      passengerErrors.forEach(error => {
        allErrors.push({
          field: `passenger_${index}_${error.field}`,
          message: `Passenger ${index + 1}: ${error.message}`
        });
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

    // Check available seats
    if (tourData.available_seats && tourData.available_seats < passengers.length) {
      showNotification('error', `Only ${tourData.available_seats} seats available for this tour`);
      return;
    }

    setLoading(true);

    try {
      const totalPrice = passengers.reduce((sum, p) => sum + p.price, 0);
      const commission = totalPrice * 0.05; // 5% commission

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
        "createdBy": currentUser.username || currentUser.email, // Quoted for exact case match
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
        departureDate: departureDate, // This should match your DB column exactly
        total_price: totalPrice,
      };

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert(newOrder)
        .select()
        .single();

      if (orderError) {
        throw new Error(orderError.message);
      }

      const orderId = orderData.id;

      // Updated: Omit 'id' from each passenger object
      const passengersWithOrderId = passengers.map((p) => {
        const { id, ...rest } = p; // Destructure to exclude 'id'
        return {
          ...rest,
          order_id: orderId,
        };
      });

      const { error: passengerError } = await supabase
        .from('passengers')
        .insert(passengersWithOrderId);

      if (passengerError) {
        throw new Error(passengerError.message);
      }

      // Update tour available seats
      if (tourData.available_seats) {
        const { error: tourUpdateError } = await supabase
          .from('tours')
          .update({
            available_seats: tourData.available_seats - passengers.length,
            updated_at: new Date().toISOString()
          })
          .eq('id', tourData.id);

        if (tourUpdateError) {
          console.warn('Failed to update tour seats:', tourUpdateError.message);
        }
      }

      setOrders([...orders, { ...orderData, passengers: passengersWithOrderId }]);
      showNotification('success', 'Booking saved successfully!');

      // Reset form
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
            nationality: row["Nationality"] || "",
            roomType: row["Room Type"] || "",
            hotel: row["Hotel"] || "",
            additional_services: row["Additional Services"] ?
              row["Additional Services"].split(",").map((s: string) => s.trim()).filter(Boolean) : [],
            price: 0,
            email: row["Email"] || "",
            phone: row["Phone"] || "",
            passport_upload: "",
            allergy: row["Allergy"] || "",
            emergency_phone: row["Emergency Phone"] || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          // Calculate price based on services
          const tour = tours.find((t) => t.title === selectedTour);
          if (tour && passenger.additional_services.length > 0) {
            passenger.price = calculateServicePrice(passenger.additional_services, tour);
          }

          return passenger;
        });

        setPassengers(newPassengers);
        showNotification('success', `Successfully imported ${newPassengers.length} passengers`);
      } catch (error) {
        showNotification('error', 'Failed to parse CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);

    // Reset file input
    e.target.value = '';
  };

  const selectedTourData = tours.find((t) => t.title === selectedTour);

  // Debug logging to understand the data structure
  console.log('=== DEBUG INFO ===');
  console.log('selectedTour value:', selectedTour);
  console.log('tours array:', tours);
  console.log('tours length:', tours.length);
  console.log('tour titles in array:', tours.map(t => t.title));
  console.log('selectedTourData:', selectedTourData);
  console.log('dates:', selectedTourData?.dates);
  console.log('dates type:', typeof selectedTourData?.dates);
  console.log('departure_date:', selectedTourData?.departureDate);
  console.log('departure_date type:', typeof selectedTourData?.departureDate);
  console.log('selectedTourData keys:', selectedTourData ? Object.keys(selectedTourData) : 'no selectedTourData');
  console.log('==================');
  const totalPrice = passengers.reduce((sum, p) => sum + p.price, 0);
  const hasErrors = errors.length > 0;

  // Non-user role view (simplified overview)
  if (currentUser.role !== "user") {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Booking Overview</h1>
                <p className="text-sm text-gray-600 mt-1">View all tour bookings</p>
              </div>
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                  <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Passengers</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {orders.reduce((sum, order) => sum + (order.passengers?.length || 0), 0)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Tours</p>
                  <p className="text-2xl font-bold text-gray-900">{tours.length}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <MapPin className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${orders.reduce((sum, order) => sum + (order.total_price || 0), 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Recent Bookings
              </h3>
            </div>

            <div className="overflow-x-auto">
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No bookings available yet.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Booking Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tour
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Departure
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Passengers
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.slice(0, 10).map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">#{order.id.slice(0, 8)}</div>
                              <div className="text-sm text-gray-500">
                                {new Date(order.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                            {order.travel_choice}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                            {new Date(order.departureDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Users className="w-3 h-3 mr-1" />
                            {order.passengers?.length || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                            {order.status === 'Confirmed' && <CheckCircle className="w-3 h-3 mr-1" />}
                            {order.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                            {order.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ${order.total_price?.toLocaleString() || '0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
          <div className="flex items-center">
            {notification.type === 'success' ?
              <CheckCircle className="w-5 h-5 mr-2" /> :
              <AlertTriangle className="w-5 h-5 mr-2" />
            }
            {notification.message}
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-white hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Book Your Adventure</h1>
              <p className="text-sm text-gray-600 mt-1">Plan your perfect tour experience</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Welcome, {currentUser.first_name} {currentUser.last_name}
              </div>
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            {[
              { step: 1, title: "Select Tour", icon: MapPin },
              { step: 2, title: "Add Passengers", icon: Users },
              { step: 3, title: "Review & Book", icon: CreditCard }
            ].map(({ step, title, icon: Icon }) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${activeStep >= step
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-gray-300 text-gray-400"
                  }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`ml-2 text-sm font-medium transition-colors ${activeStep >= step ? "text-blue-600" : "text-gray-400"
                  }`}>
                  {title}
                </span>
                {step < 3 && (
                  <div className={`w-16 h-0.5 ml-4 transition-colors ${activeStep > step ? "bg-blue-600" : "bg-gray-300"
                    }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Summary */}
        {hasErrors && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
            </div>
            <ul className="text-sm text-red-700 space-y-1">
              {errors.slice(0, 5).map((error, index) => (
                <li key={index}>• {error.message}</li>
              ))}
              {errors.length > 5 && (
                <li className="text-red-600 font-medium">... and {errors.length - 5} more errors</li>
              )}
            </ul>
          </div>
        )}

        {/* Step 1: Tour Selection */}
        {activeStep === 1 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              Choose Your Tour
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tour Package */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tour Package *
                </label>
                <select
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === 'tour') ? 'border-red-300' : 'border-gray-300'
                    }`}
                  value={selectedTour}
                  onChange={(e) => setSelectedTour(e.target.value)}
                >
                  <option value="">Select a tour...</option>
                  {tours
                    .filter(tour => tour.status !== 'inactive')
                    .map((tour) => (
                      <option key={tour.id} value={tour.title}>
                        {tour.title} ({tour.available_seats || tour.seats} seats available)
                      </option>
                    ))}
                </select>
                {errors.some(e => e.field === 'tour') && (
                  <p className="mt-1 text-sm text-red-600">Tour selection is required</p>
                )}
              </div>

              {/* Departure Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Departure Date *
                </label>
                <select
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === 'departure') ? 'border-red-300' : 'border-gray-300'
                    }`}
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  disabled={!selectedTour}
                >
                  <option value="">Select date...</option>
                  {selectedTourData?.dates ? (
                    Array.isArray(selectedTourData.dates) ? (
                      selectedTourData.dates.map((date) => (
                        <option key={date} value={date}>
                          {new Date(date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </option>
                      ))
                    ) : (
                      <option key={selectedTourData.dates} value={selectedTourData.dates}>
                        {new Date(selectedTourData.dates).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </option>
                    )
                  ) : (
                    selectedTourData?.departureDate && (
                      <option key={selectedTourData.departureDate} value={selectedTourData.departureDate}>
                        {new Date(selectedTourData.departureDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </option>
                    )
                  )}
                </select>
                {errors.some(e => e.field === 'departure') && (
                  <p className="mt-1 text-sm text-red-600">Departure date is required</p>
                )}
              </div>
            </div>

            {selectedTourData && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-3">Tour Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                  <div className="flex items-center">
                    <Hotel className="w-4 h-4 mr-2" />
                    <span>Hotels: {selectedTourData.hotels.join(', ')}</span>
                  </div>
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    <span>Available Seats: {selectedTourData.available_seats || selectedTourData.seats}</span>
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 mr-2" />
                    <span>Base Price: ${selectedTourData.price_base || 'Contact for pricing'}</span>
                  </div>
                  <div className="flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    <span>Services: {selectedTourData.services.length} available</span>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-sm text-blue-700">{selectedTourData.description}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setActiveStep(2)}
                disabled={!selectedTour || !departureDate}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Continue to Passengers
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Passenger Details */}
        {activeStep === 2 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Passenger Information
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={downloadTemplate}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Template
                </button>
                <label className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload CSV
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={handleUploadCSV}
                  />
                </label>
                <button
                  onClick={addPassenger}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isGroup ? 'Add Member' : 'Add Passenger'}
                </button>
              </div>
            </div>

            {passengers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">How would you like to add passengers?</p>
                <div className="flex justify-center gap-4">
                  <button 
                    onClick={() => {
                      setIsGroup(false);
                      addPassenger();
                    }} 
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    1 Person
                  </button>
                  <button 
                    onClick={() => setIsGroup(true)} 
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Group or Company
                  </button>
                </div>
                {isGroup && (
                  <div className="mt-4 max-w-md mx-auto">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Group or Company Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter group name"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        if (groupName.trim()) {
                          addPassenger();
                        } else {
                          showNotification('error', 'Group name is required');
                        }
                      }}
                      className="mt-2 w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Start Adding Members
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {passengers.map((passenger, index) => (
                  <div key={passenger.id} className="p-6 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium text-gray-900">Passenger {index + 1}</h4>
                      <button
                        onClick={() => removePassenger(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                        disabled={passengers.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {/* Basic Information */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          First Name *
                        </label>
                        <input
                          type="text"
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_first_name`) ? 'border-red-300' : 'border-gray-300'
                            }`}
                          placeholder="John"
                          value={passenger.first_name}
                          onChange={(e) => updatePassenger(index, "first_name", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_last_name`) ? 'border-red-300' : 'border-gray-300'
                            }`}
                          placeholder="Doe"
                          value={passenger.last_name}
                          onChange={(e) => updatePassenger(index, "last_name", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Email *
                        </label>
                        <input
                          type="email"
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_email`) ? 'border-red-300' : 'border-gray-300'
                            }`}
                          placeholder="john@example.com"
                          value={passenger.email}
                          onChange={(e) => updatePassenger(index, "email", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Phone *
                        </label>
                        <input
                          type="tel"
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_phone`) ? 'border-red-300' : 'border-gray-300'
                            }`}
                          placeholder="+976 99999999"
                          value={passenger.phone}
                          onChange={(e) => updatePassenger(index, "phone", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={passenger.date_of_birth}
                          onChange={(e) => updatePassenger(index, "date_of_birth", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Age</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50"
                          value={passenger.age || ""}
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Gender *
                        </label>
                        <select
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_gender`) ? 'border-red-300' : 'border-gray-300'
                            }`}
                          value={passenger.gender}
                          onChange={(e) => updatePassenger(index, "gender", e.target.value)}
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Nationality *
                        </label>
                        <select
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_nationality`) ? 'border-red-300' : 'border-gray-300'
                            }`}
                          value={passenger.nationality}
                          onChange={(e) => updatePassenger(index, "nationality", e.target.value)}
                        >
                          <option value="">Select Country</option>
                          {countries.map((country) => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Passport Information */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Passport Number *
                        </label>
                        <input
                          type="text"
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_passport_number`) ? 'border-red-300' : 'border-gray-300'
                            }`}
                          placeholder="A12345678"
                          value={passenger.passport_number}
                          onChange={(e) => updatePassenger(index, "passport_number", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Passport Expiry *
                        </label>
                        <input
                          type="date"
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${getPassportExpiryColor(passenger.passport_expiry)} ${errors.some(e => e.field === `passenger_${index}_passport_expiry`) ? 'border-red-300' : ''
                            }`}
                          value={passenger.passport_expiry}
                          onChange={(e) => updatePassenger(index, "passport_expiry", e.target.value)}
                        />
                      </div>

                      {/* Accommodation */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Room Type *
                        </label>
                        <select
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_roomType`) ? 'border-red-300' : 'border-gray-300'
                            }`}
                          value={passenger.roomType}
                          onChange={(e) => updatePassenger(index, "roomType", e.target.value)}
                        >
                          <option value="">Select</option>
                          <option value="Single">Single</option>
                          <option value="Double">Double</option>
                          <option value="Twin">Twin</option>
                          <option value="Suite">Suite</option>
                          <option value="Family">Family</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Hotel *
                        </label>
                        <select
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_hotel`) ? 'border-red-300' : 'border-gray-300'
                            }`}
                          value={passenger.hotel}
                          onChange={(e) => updatePassenger(index, "hotel", e.target.value)}
                        >
                          <option value="">Select Hotel</option>
                          {selectedTourData?.hotels.map((hotel) => (
                            <option key={hotel} value={hotel}>
                              {hotel}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Room Allocation
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Room #"
                          value={passenger.room_allocation}
                          onChange={(e) => updatePassenger(index, "room_allocation", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Serial No
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Serial #"
                          value={passenger.serial_no}
                          onChange={(e) => updatePassenger(index, "serial_no", e.target.value)}
                        />
                      </div>

                      {/* Additional Services */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Additional Services
                        </label>
                        <select
                          multiple
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20"
                          value={passenger.additional_services}
                          onChange={(e) =>
                            updatePassenger(
                              index,
                              "additional_services",
                              Array.from(e.target.selectedOptions, (option) => option.value)
                            )
                          }
                        >
                          {selectedTourData?.services.map((service) => (
                            <option key={service.name} value={service.name}>
                              {service.name} (${service.price})
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                      </div>

                      {/* File Upload */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Passport Upload
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            accept="image/*,.pdf"
                            onChange={(e) =>
                              updatePassenger(
                                index,
                                "passport_upload",
                                e.target.files ? e.target.files[0] : undefined
                              )
                            }
                          />
                          <div className="flex items-center justify-center px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer">
                            <Upload className="w-4 h-4 mr-2 text-gray-400" />
                            <span className="text-gray-600">
                              {passenger.passport_upload ? "Uploaded" : "Upload"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Optional Fields */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Allergy
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Any allergies?"
                          value={passenger.allergy || ""}
                          onChange={(e) => updatePassenger(index, "allergy", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Emergency Phone
                        </label>
                        <input
                          type="tel"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Emergency contact"
                          value={passenger.emergency_phone || ""}
                          onChange={(e) => updatePassenger(index, "emergency_phone", e.target.value)}
                        />
                      </div>

                      {/* Price Display */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Service Price
                        </label>
                        <div className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50">
                          <DollarSign className="w-4 h-4 mr-1 text-gray-400" />
                          <span className="font-medium">{passenger.price}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setActiveStep(1)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back to Tour Selection
              </button>
              <button
                onClick={() => setActiveStep(3)}
                disabled={passengers.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Review Booking
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Book */}
        {activeStep === 3 && (
          <div className="space-y-6">
            {/* Booking Summary */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                <Eye className="w-5 h-5 mr-2" />
                Booking Summary
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-blue-50 rounded-lg">
                    <MapPin className="w-8 h-8 text-blue-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">Tour Package</h4>
                      <p className="text-sm text-gray-600">{selectedTour}</p>
                    </div>
                  </div>

                  <div className="flex items-center p-4 bg-green-50 rounded-lg">
                    <Calendar className="w-8 h-8 text-green-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">Departure Date</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(departureDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-purple-50 rounded-lg">
                    <Users className="w-8 h-8 text-purple-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">Total Passengers</h4>
                      <p className="text-sm text-gray-600">{passengers.length} passengers</p>
                    </div>
                  </div>

                  <div className="flex items-center p-4 bg-orange-50 rounded-lg">
                    <DollarSign className="w-8 h-8 text-orange-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">Total Price</h4>
                      <p className="text-lg font-bold text-gray-900">${totalPrice.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Commission: ${(totalPrice * 0.05).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="border-t pt-6">
              <h4 className="font-medium text-gray-900 mb-4">Payment Method</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {paymentMethods.map((method) => (
                  <label
                    key={method}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === method
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                      }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="sr-only"
                    />
                    <CreditCard className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">{method}</span>
                  </label>
                ))}
              </div>
              {errors.some(e => e.field === 'payment') && (
                <p className="mt-2 text-sm text-red-600">Payment method is required</p>
              )}
            </div>

            {/* Passenger List */}
            <div className="border-t pt-6">
              <h4 className="font-medium text-gray-900 mb-4">Passenger Details</h4>
              <div className="space-y-3">
                {passengers.map((passenger, index) => (
                  <div key={passenger.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {passenger.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {passenger.nationality} • {passenger.gender} • Age: {passenger.age}
                        </p>
                        <p className="text-sm text-gray-600">
                          Room: {passenger.roomType} • Hotel: {passenger.hotel}
                        </p>
                        {passenger.additional_services.length > 0 && (
                          <p className="text-xs text-gray-500">
                            Services: {passenger.additional_services.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">${passenger.price}</p>
                      <p className="text-sm text-gray-600">
                        {passenger.additional_services.length} services
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setActiveStep(2)}
                  className="flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back to Passengers
                </button>

                <button
                  onClick={downloadCSV}
                  disabled={passengers.length === 0}
                  className="flex items-center justify-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </button>

                <button
                  onClick={saveOrder}
                  disabled={loading || !paymentMethod || passengers.length === 0}
                  className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-1"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Confirm Booking
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Important Notes:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Please ensure all passenger information is accurate before confirming</li>
                      <li>• All information should be entered in English or Latin characters only</li>
                      <li>• Passport must be valid for at least 6 months from departure date</li>
                      <li>• Changes after confirmation may incur additional fees</li>
                      <li>• You will receive a confirmation email once booking is processed</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions Bar - Fixed at bottom for mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:hidden z-40">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Step {activeStep} of 3
          </div>
          <div className="text-sm font-medium text-gray-900">
            {passengers.length > 0 && (
              <span>
                {passengers.length} passenger{passengers.length !== 1 ? 's' : ''} • ${totalPrice.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        {activeStep < 3 && (
          <div className="mt-2">
            <button
              onClick={() => {
                if (activeStep === 1 && selectedTour && departureDate) {
                  setActiveStep(2);
                } else if (activeStep === 2 && passengers.length > 0) {
                  setActiveStep(3);
                }
              }}
              disabled={
                (activeStep === 1 && (!selectedTour || !departureDate)) ||
                (activeStep === 2 && passengers.length === 0)
              }
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {activeStep === 1 ? 'Continue to Passengers' : 'Review Booking'}
            </button>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
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