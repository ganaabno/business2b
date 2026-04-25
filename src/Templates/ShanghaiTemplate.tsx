import type { TourFormData } from "../types/type";

interface ShanghaiTemplateProps {
  onSelect: (data: Partial<TourFormData>) => void;
}

const SHANGHAI_TEMPLATE: Partial<TourFormData> = {
  title: "Shanghai Tour",
  description:
    "Classic Shanghai city itinerary with historical waterfront and skyline highlights.",
  country: "China",
  genre: "City",
  hotel: "Shanghai HOTEL",
  country_temperature: "18",
  duration_day: "7",
  duration_night: "6",
  group_size: "+20",
  seats: "20",
  is_featured: true,
  airlines: "MIAT",
  hotels: "Golden Hotel, Apart Hotel",
  services: "City tour, Museum pass",
  image_key:
    "https://res.cloudinary.com/dgl5ewohj/image/upload/v1769488976/Shanghai_cqld9b_xkpbwx.png",
};

export default function ShanghaiTemplate({ onSelect }: ShanghaiTemplateProps) {
  return (
    <button
      onClick={() => onSelect(SHANGHAI_TEMPLATE)}
      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center"
    >
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Apply Shanghai Template
    </button>
  );
}
