import { FileText, MapPin, Users } from 'lucide-react';
import type { Order, Tour } from '../../types/type';

interface StatsCardsProps {
  orders: Order[];
  tours: Tour[];
}

export default function StatsCards({ orders, tours }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Orders</p>
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
              {orders.reduce((sum, order) => sum + (order.passenger_count || 0), 0)}
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
            <p className="text-sm font-medium text-gray-600">Available Tours</p>
            <p className="text-2xl font-bold text-gray-900">{tours.length}</p>
          </div>
          <div className="p-3 bg-purple-100 rounded-lg">
            <MapPin className="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </div>
    </div>
  );
}