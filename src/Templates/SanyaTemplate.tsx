import type { TourFormData } from "../types/type";

interface SanyaTemplateProps {
  onSelect: (data: Partial<TourFormData>) => void;
}

const SANYA_TEMPLATE: Partial<TourFormData> = {
  title: "Sanya Tour",
  description: "7-day Sanya package with beach and city highlights.",
  country: "China",
  genre: "Beach",
  hotel: "Sanya Conifer Resort",
  country_temperature: "24",
  duration_day: "7",
  duration_night: "6",
  group_size: "+20",
  seats: "20",
  is_featured: true,
  airlines: "MIAT",
  hotels: "Phoenix Island Hotel, Sanya Conifer Resort, Golden Palm Hotel",
  services: "Airport transfer, City tour",
};

export default function SanyaTemplate({ onSelect }: SanyaTemplateProps) {
  return (
    <button
      onClick={() => onSelect(SANYA_TEMPLATE)}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
    >
      <svg
        className="w-4 h-4 mr-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      Apply Sanya Template
    </button>
  );
}
