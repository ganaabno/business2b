import type { TourFormData } from "../types/type";

interface HainanTemplateProps {
  onSelect: (data: Partial<TourFormData>) => void;
}

const HAINAN_TEMPLATE: Partial<TourFormData> = {
  title: "Hainan Island Tour",
  description:
    "Direct flight package to Hainan with beach, city, and sightseeing activities.",
  country: "China",
  genre: "Beach",
  hotel: "Phoenix Island Resort",
  country_temperature: "23.7",
  duration_day: "9",
  duration_night: "9",
  group_size: "+20",
  seats: "20",
  is_featured: true,
  airlines: "MIAT, Hainan Airlines",
  hotels:
    "Phoenix Island Hotel, Gentl Grown Hotel, Golden Palm Hotel, Yalong Bei Villas & SPA, Sanya Conifer Resort, Hyatt Regency Hainan Ocean Paradise",
  services:
    "Airport transfer, City tour, Yacht cruise, Atlantis water park",
  image_key:
    "https://res.cloudinary.com/dgl5ewohj/image/upload/v1769079572/hainan_zg6ml8.avif",
};

export default function HainanTemplate({ onSelect }: HainanTemplateProps) {
  return (
    <button
      onClick={() => onSelect(HAINAN_TEMPLATE)}
      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center"
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
      Apply Hainan Template
    </button>
  );
}
