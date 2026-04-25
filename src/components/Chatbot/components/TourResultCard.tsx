import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Users, ArrowRight, Clock } from 'lucide-react';
import type { TourResult } from '../types';

interface TourResultCardProps {
  tours: TourResult[];
  onSelectTour?: (tour: TourResult) => void;
  locale?: 'en' | 'mn';
}

const TourResultCard: React.FC<TourResultCardProps> = ({ tours, onSelectTour, locale = 'mn' }) => {
  const formatPrice = (price: number) => {
    return (price || 0).toLocaleString(locale === 'mn' ? 'mn-MN' : 'en-US');
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return locale === 'mn' ? 'Тодорхойгүй' : 'TBD';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(locale === 'mn' ? 'mn-MN' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getDestinationEmoji = (destination: string | null | undefined) => {
    if (!destination) return '📍';
    const d = destination.toLowerCase();
    if (d.includes('thailand') || d.includes('тайланд')) return '🇹🇭';
    if (d.includes('japan') || d.includes('солонгос') || d.includes(' japan')) return '🇯🇵';
    if (d.includes('vietnam') || d.includes('вьетнам')) return '🇻🇳';
    if (d.includes('china') || d.includes('хятад')) return '🇨🇳';
    if (d.includes('korea')) return '🇰🇷';
    if (d.includes('singapore')) return '🇸🇬';
    if (d.includes('dubai') || d.includes('дубай')) return '🇦🇪';
    if (d.includes('turkey') || d.includes('турк')) return '🇹🇷';
    if (d.includes('mongolia') || d.includes('монгол')) return '🇲🇳';
    return '🌏';
  };

  if (tours.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-xl text-center">
        <p className="text-gray-500 text-sm">
          {locale === 'mn' ? 'Аял олдсонгүй' : 'No tours found'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tours.map((tour, index) => (
        <motion.div
          key={tour.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className="group relative bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
          onClick={() => onSelectTour?.(tour)}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">{getDestinationEmoji(tour.destination)}</span>
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                {tour.title}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-blue-600">
                {formatPrice(tour.base_price)}₮
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              <span>{tour.destination || '-'}</span>
            </div>
            
            <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span>{formatDate(tour.departure_date)}</span>
            </div>
            
            <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>{tour.duration_day} {locale === 'mn' ? 'хоног' : 'nights'}</span>
            </div>
            
            <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg">
              <Users className="w-3.5 h-3.5 text-gray-400" />
              <span>{tour.seats} {locale === 'mn' ? 'суудал' : 'seats'}</span>
            </div>
          </div>

          {/* Select Button */}
          <div className="mt-3 flex items-center justify-end">
            <button className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors opacity-0 group-hover:opacity-100">
              {locale === 'mn' ? 'Сонгох' : 'Select'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      ))}

      {/* Summary */}
      <div className="pt-2 text-center">
        <p className="text-xs text-gray-500">
          {locale === 'mn' 
            ? `${tours.length} аял олдлоо` 
            : `Showing ${tours.length} tours`}
        </p>
      </div>
    </div>
  );
};

export default TourResultCard;