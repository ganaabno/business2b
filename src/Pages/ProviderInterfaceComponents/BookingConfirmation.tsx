import { useState } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../../supabaseClient';
import type { Order, User as UserType } from '../../types/type';

interface BookingConfirmationTabProps {
  orders: Order[];
  currentUser: UserType;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  formatDate: (dateString: string | null) => string;
}

interface BookingConfirmationInput {
  bus_number: string;
  guide_name: string;
  weather_emergency: string;
}

const BookingConfirmationTab: React.FC<BookingConfirmationTabProps> = ({
  orders,
  currentUser,
  setOrders,
  formatDate,
}) => {
  const [inputs, setInputs] = useState<{ [orderId: string]: BookingConfirmationInput }>({});
  const [activeTab, setActiveTab] = useState<'pending' | 'confirmed'>('pending');
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const handleInputChange = (
    orderId: string,
    field: keyof BookingConfirmationInput,
    value: string
  ) => {
    setInputs((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId] ?? { bus_number: '', guide_name: '', weather_emergency: '' },
        [field]: value,
      },
    }));
  };

  const handleConfirmBooking = async (orderId: string) => {
    const input = inputs[orderId];
    if (!input?.bus_number || !input?.guide_name) {
      toast.error('Bus Number and Guide Name are required!');
      return;
    }

    try {
      const { error } = await supabase
        .from('booking_confirmations')
        .upsert(
          {
            order_id: orderId,
            bus_number: input.bus_number,
            guide_name: input.guide_name,
            weather_emergency: input.weather_emergency || null,
            updated_by: currentUser.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'order_id' }
        );

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
              ...order,
              booking_confirmation: {
                order_id: orderId,
                bus_number: input.bus_number,
                guide_name: input.guide_name,
                weather_emergency: input.weather_emergency || null,
                updated_by: currentUser.id,
                updated_at: new Date().toISOString(),
              },
            }
            : order
        )
      );
      toast.success('Booking confirmed successfully!');
    } catch (error) {
      console.error('Error confirming booking:', JSON.stringify(error, null, 2));
      toast.error('Failed to confirm booking.');
    }
  };

  const handleEditBooking = async (orderId: string) => {
    const input = inputs[orderId];
    if (!input?.bus_number || !input?.guide_name) {
      toast.error('Bus Number and Guide Name are required!');
      return;
    }

    try {
      const { error } = await supabase
        .from('booking_confirmations')
        .update({
          bus_number: input.bus_number,
          guide_name: input.guide_name,
          weather_emergency: input.weather_emergency || null,
          updated_by: currentUser.id,
          updated_at: new Date().toISOString(),
        })
        .eq('order_id', orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
              ...order,
              booking_confirmation: {
                ...order.booking_confirmation!,
                bus_number: input.bus_number,
                guide_name: input.guide_name,
                weather_emergency: input.weather_emergency || null,
                updated_by: currentUser.id,
                updated_at: new Date().toISOString(),
              },
            }
            : order
        )
      );
      setEditingOrderId(null); // Reset editing state after saving
      toast.success('Booking updated successfully!');
    } catch (error) {
      console.error('Error updating booking:', JSON.stringify(error, null, 2));
      toast.error('Failed to update booking.');
    }
  };

  const handleButtonClick = (orderId: string) => {
    if (editingOrderId === orderId) {
      handleEditBooking(orderId); // Save changes
    } else {
      setEditingOrderId(orderId); // Enter edit mode
    }
  };

  const fields: { label: string; key: keyof BookingConfirmationInput; placeholder: string; required: boolean }[] = [
    { label: 'Bus Number', key: 'bus_number', placeholder: 'e.g. BUS-001', required: true },
    { label: 'Guide Name', key: 'guide_name', placeholder: 'e.g. John Smith', required: true },
    { label: 'Weather/Emergency', key: 'weather_emergency', placeholder: 'Optional notes', required: false },
  ];

  const pendingOrders = orders.filter((order) => !order.booking_confirmation);
  const confirmedOrders = orders.filter((order) => order.booking_confirmation);

  return (
    <div className="my-10 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <h2 className="text-3xl font-semibold text-gray-900 mb-2 tracking-tight">
          Booking Confirmations
        </h2>
        <div className="h-1 w-[1200px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded mb-6"></div>

        {/* Tabs */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setActiveTab('pending')}
            className={`
                relative px-6 py-2.5 rounded-xl font-medium text-sm
                transition-all duration-300 ease-out
      ${activeTab === 'pending'
                ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-50 hover:shadow-md hover:scale-102 shadow-sm'
              } active:scale-95` }
          >
            Pending Confirmation ({pendingOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('confirmed')}
            className={`
                relative px-6 py-2.5 rounded-xl font-medium text-sm
                transition-all duration-300 ease-out
      ${activeTab === 'confirmed'
                ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-50 hover:shadow-md hover:scale-102 shadow-sm'
              } active:scale-95`}
          >
            Confirmed Bookings ({confirmedOrders.length})
          </button>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {(activeTab === 'pending' ? pendingOrders : confirmedOrders).length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-24 space-y-4">
              <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center animate-pulse">
                <svg
                  className="w-10 h-10 text-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <p className="text-black text-md font-semibold">
                {activeTab === 'pending'
                  ? 'No orders available for confirmation'
                  : 'No confirmed bookings available'}
              </p>
            </div>
          ) : (
            (activeTab === 'pending' ? pendingOrders : confirmedOrders).map((order) => (
              <div
                key={order.id}
                className="group bg-white rounded-3xl p-8 border border-gray-100 hover:border-indigo-200 hover:shadow-2xl transition-all duration-300"
              >
                <div className="space-y-2">
                  {/* Tour Info */}
                  <div className="border-b border-gray-50">
                    <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                      Tour Package
                    </p>
                    <p className="text-lg font-semibold text-gray-900">{order.travel_choice || 'N/A'}</p>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4 text-gray-700">
                    <div>
                      <p className="text-xs mb-1">Departure</p>
                      <p className="text-sm font-medium">{formatDate(order.departureDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs mb-1">Passengers</p>
                      <p className="text-sm font-medium">{order.passenger_count}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs mb-1">Created By</p>
                      <p className="text-sm font-medium">{order.createdBy || order.created_by || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Input Fields */}
                  <div className="space-y-2 pt-2">
                    {fields.map(({ label, key, placeholder, required }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-500 mb-2">
                          {label} {required && <span className="text-indigo-400">*</span>}
                        </label>
                        <input
                          type="text"
                          value={inputs[order.id]?.[key] ?? order.booking_confirmation?.[key] ?? ''}
                          onChange={(e) => handleInputChange(order.id, key, e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all outline-none text-sm shadow-sm hover:shadow-md"
                          placeholder={placeholder}
                          disabled={activeTab === 'confirmed' && editingOrderId !== order.id}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Button */}
                  <div className="pt-4">
                    <button
                      onClick={() =>
                        order.booking_confirmation
                          ? handleButtonClick(order.id)
                          : handleConfirmBooking(order.id)
                      }
                      className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white py-3.5 rounded-2xl font-semibold text-sm hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 transition-all duration-300 shadow-md hover:shadow-lg"
                    >
                      {order.booking_confirmation && editingOrderId !== order.id
                        ? 'Edit'
                        : 'Confirm Booking'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmationTab;