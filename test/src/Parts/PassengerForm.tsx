import { Users, Download, Upload, Plus, Trash2, DollarSign } from "lucide-react";
import type { Passenger, Tour, ValidationError } from "../types/type";

interface PassengerFormProps {
  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  selectedTourData: Tour | undefined;
  errors: ValidationError[];
  updatePassenger: (index: number, field: keyof Passenger, value: any) => void;
  removePassenger: (index: number) => void;
  downloadTemplate: () => void;
  handleUploadCSV: (e: React.ChangeEvent<HTMLInputElement>) => void;
  addPassenger: () => void;
  setActiveStep: (value: number) => void;
  isGroup: boolean;
  setIsGroup: (value: boolean) => void;
  groupName: string;
  setGroupName: (value: string) => void;
  showNotification: (type: 'success' | 'error', message: string) => void;
}

// Helper function to calculate months remaining and return Tailwind classes
const getPassportExpiryClasses = (passportExpiry: string): string => {
  if (!passportExpiry) return 'border-gray-300'; // Default if no expiry date

  const expiryDate = new Date(passportExpiry);
  const today = new Date();
  const monthsRemaining = Math.round(
    (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.42)
  );

  if (monthsRemaining <= 0) return 'border-red-500 bg-red-400'; // Expired
  if (monthsRemaining <= 1) return 'border-red-400 bg-red-400'; // 1 month or less
  if (monthsRemaining <= 3) return 'border-orange-400 bg-orange-400'; // 1-3 months
  if (monthsRemaining <= 7) return 'border-yellow-400 bg-yellow-300'; // 3-7 months
  return 'border-green-400 bg-lime-400'; // 7+ months
};

export default function PassengerForm({
  passengers,
  setPassengers,
  selectedTourData,
  errors,
  updatePassenger,
  removePassenger,
  downloadTemplate,
  handleUploadCSV,
  addPassenger,
  setActiveStep,
  isGroup,
  setIsGroup,
  groupName,
  setGroupName,
  showNotification,
}: PassengerFormProps) {
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

  // Check if adding a passenger is allowed (without exposing seat count)
  const canAddPassenger = () => {
    if (!selectedTourData?.available_seats) return true; // No seat limit defined
    return passengers.length < selectedTourData.available_seats;
  };

  const handleAddPassenger = () => {
    if (canAddPassenger()) {
      addPassenger();
    } else {
      showNotification('error', 'Cannot add more passengers. The tour is fully booked.');
    }
  };

  return (
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
            <input type="file" className="hidden" accept=".csv" onChange={handleUploadCSV} />
          </label>
          <button
            onClick={handleAddPassenger}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            disabled={!canAddPassenger()}
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
                if (canAddPassenger()) {
                  addPassenger();
                } else {
                  showNotification('error', 'Cannot add passengers. The tour is fully booked.');
                }
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              disabled={!canAddPassenger()}
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
                    if (canAddPassenger()) {
                      addPassenger();
                    } else {
                      showNotification('error', 'Cannot add passengers. The tour is fully booked.');
                    }
                  } else {
                    showNotification('error', 'Group name is required');
                  }
                }}
                className="mt-2 w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={!canAddPassenger()}
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
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_first_name`) ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="John"
                    value={passenger.first_name}
                    onChange={(e) => updatePassenger(index, "first_name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_last_name`) ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="Doe"
                    value={passenger.last_name}
                    onChange={(e) => updatePassenger(index, "last_name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_email`) ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="john@example.com"
                    value={passenger.email}
                    onChange={(e) => updatePassenger(index, "email", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_phone`) ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="+976 99999999"
                    value={passenger.phone}
                    onChange={(e) => updatePassenger(index, "phone", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date of Birth</label>
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Gender *</label>
                  <select
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_gender`) ? 'border-red-300' : 'border-gray-300'}`}
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nationality *</label>
                  <select
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_nationality`) ? 'border-red-300' : 'border-gray-300'}`}
                    value={passenger.nationality}
                    onChange={(e) => updatePassenger(index, "nationality", e.target.value)}
                  >
                    <option value="">Select Country</option>
                    {countries.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Passport Number *</label>
                  <input
                    type="text"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_passport_number`) ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="A12345678"
                    value={passenger.passport_number}
                    onChange={(e) => updatePassenger(index, "passport_number", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Passport Expiry *</label>
                  <input
                    type="date"
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_passport_expiry`) ? 'border-red-300' : getPassportExpiryClasses(passenger.passport_expiry)}`}
                    value={passenger.passport_expiry}
                    onChange={(e) => updatePassenger(index, "passport_expiry", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Room Type *</label>
                  <select
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_roomType`) ? 'border-red-300' : 'border-gray-300'}`}
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hotel *</label>
                  <select
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.some(e => e.field === `passenger_${index}_hotel`) ? 'border-red-300' : 'border-gray-300'}`}
                    value={passenger.hotel}
                    onChange={(e) => updatePassenger(index, "hotel", e.target.value)}
                  >
                    <option value="">Select Hotel</option>
                    {selectedTourData?.hotels.map((hotel) => (
                      <option key={hotel} value={hotel}>{hotel}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Room Allocation</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Room #"
                    value={passenger.room_allocation}
                    onChange={(e) => updatePassenger(index, "room_allocation", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Serial No</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Serial #"
                    value={passenger.serial_no}
                    onChange={(e) => updatePassenger(index, "serial_no", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Additional Services</label>
                  <select
                    multiple
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20"
                    value={passenger.additional_services}
                    onChange={(e) => updatePassenger(index, "additional_services", Array.from(e.target.selectedOptions, (option) => option.value))}
                  >
                    {selectedTourData?.services.map((service) => (
                      <option key={service.name} value={service.name}>{service.name} (${service.price})</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Passport Upload</label>
                  <div className="relative">
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept="image/*,.pdf"
                      onChange={(e) => updatePassenger(index, "passport_upload", e.target.files ? e.target.files[0] : undefined)}
                    />
                    <div className="flex items-center justify-center px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer">
                      <Upload className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-gray-600">{passenger.passport_upload ? "Uploaded" : "Upload"}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Allergy</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Any allergies?"
                    value={passenger.allergy || ""}
                    onChange={(e) => updatePassenger(index, "allergy", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Emergency Phone</label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Emergency contact"
                    value={passenger.emergency_phone || ""}
                    onChange={(e) => updatePassenger(index, "emergency_phone", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Service Price</label>
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
  );
}