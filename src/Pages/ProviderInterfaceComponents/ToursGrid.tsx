import { MapPin, Calendar, Users } from 'lucide-react';
import type { Tour } from '../../types/type';

interface ToursGridProps {
  tours: Tour[];
  formatDate: (dateString: string | null) => string;
}

export default function ToursGrid({ tours, formatDate }: ToursGridProps) {
  return (
    <div className="mt-8 bg-white rounded-xl shadow-sm border p-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
          <MapPin className="w-5 h-5 mr-2" />
          Available Tours
        </h3>
      </div>
      <div className="h-1 w-[1200px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded mb-10"></div>

      {
        tours.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg font-medium mb-2">No tours available</p>
            <p className="text-gray-400 text-sm">Tours display unavailable.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tours.map((tour) => (
              <div key={tour.id} className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">
                      #{tour.id.slice(0, 3)}
                    </span>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${tour.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : tour.status === 'full'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                        }`}
                    >
                      {tour.status || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="mb-4">
                    <h4 className="text-lg font-bold text-gray-900 mb-2 flex items-center group-hover:text-blue-600 transition-colors">
                      <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                      {tour.title || 'Unnamed Tour'}
                    </h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                        <span className="text-sm text-gray-600">Departure</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatDate(tour.departure_date)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-2 text-green-500" />
                          <span className="text-xs text-gray-600">Total</span>
                        </div>
                        <span className="text-sm font-bold text-green-700">
                          {tour.seats || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-2 text-blue-500" />
                          <span className="text-xs text-gray-600">Available</span>
                        </div>
                        <span className="text-sm font-bold text-blue-700">
                          {tour.available_seats || 0}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <div className="text-left">
                        <p className="text-xs text-gray-500 mb-1">Created by</p>
                        <p className="text-sm font-medium text-gray-900">
                          {tour.creator_name || tour.created_by || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">Base Price</p>
                        <p className="text-lg font-bold text-indigo-600">
                          ${tour.base_price?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-5 pb-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${tour.seats > 0 ? ((tour.seats - (tour.available_seats || 0)) / tour.seats) * 100 : 0}%`
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Booked: {(tour.seats || 0) - (tour.available_seats || 0)}</span>
                    <span>{tour.seats > 0 ? Math.round(((tour.seats - (tour.available_seats || 0)) / tour.seats) * 100) : 0}% Full</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div >
  );
}