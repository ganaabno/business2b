import { MapPin, Calendar, Users, DollarSign, CreditCard, Eye, AlertTriangle, Download, Save, User } from "lucide-react";
import type { Passenger, ValidationError } from "../types/type";

interface BookingSummaryProps {
  selectedTour: string;
  departureDate: string;
  passengers: Passenger[];
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  errors: ValidationError[];
  downloadCSV: () => void;
  saveOrder: () => void;
  setActiveStep: (value: number) => void;
  loading: boolean;
}

export default function BookingSummary({ selectedTour, departureDate, passengers, paymentMethod, setPaymentMethod, errors, downloadCSV, saveOrder, setActiveStep, loading }: BookingSummaryProps) {
  const totalPrice = passengers.reduce((sum, p) => sum + p.price, 0);
  const paymentMethods = [
    "Cash", "Bank Transfer", "StorePay", "Pocket", "DariFinance",
    "Hutul Nomuun", "MonPay", "Barter", "Loan", "Credit Card"
  ];

  return (
    <div className="space-y-6">
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
                  {new Date(departureDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
      <div className="border-t pt-6">
        <h4 className="font-medium text-gray-900 mb-4">Payment Method</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {paymentMethods.map((method) => (
            <label
              key={method}
              className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === method ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-gray-400'}`}
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
                  <p className="font-medium text-gray-900">{passenger.name}</p>
                  <p className="text-sm text-gray-600">{passenger.nationality} • {passenger.gender} • Age: {passenger.age}</p>
                  <p className="text-sm text-gray-600">Room: {passenger.roomType} • Hotel: {passenger.hotel}</p>
                  {passenger.additional_services.length > 0 && (
                    <p className="text-xs text-gray-500">Services: {passenger.additional_services.join(', ')}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900">${passenger.price}</p>
                <p className="text-sm text-gray-600">{passenger.additional_services.length} services</p>
              </div>
            </div>
          ))}
        </div>
      </div>
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
  );
}