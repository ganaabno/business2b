import type { TourFormData } from "../types/type";

export type TemplateLanguage = "en" | "mn";

export type TourTemplate = {
  id: string;
  label: string;
  toneClass: string;
  data: Partial<TourFormData>;
};

export const TOUR_TEMPLATES: TourTemplate[] = [
  {
    id: "hainan",
    label: "Hainan",
    toneClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
    data: {
      title: "Hainan Island Tour",
      description:
        "Direct Hainan package with beach, city, and sightseeing experiences.",
      country: "China",
      genre: "Beach",
      hotel: "Phoenix Island Resort",
      hotels:
        "Phoenix Island Hotel, Gentl Grown Hotel, Golden Palm Hotel, Yalong Bei Villas & SPA, Sanya Conifer Resort, Hyatt Regency Hainan Ocean Paradise",
      country_temperature: "23.7",
      seats: "20",
      group_size: "+20",
      duration_day: "9",
      duration_night: "9",
      airlines: "MIAT, Hainan Airlines",
      is_featured: true,
      image_key:
        "https://res.cloudinary.com/dgl5ewohj/image/upload/v1769079572/hainan_zg6ml8.avif",
      services: "Airport transfer, City tour, Yacht cruise",
    },
  },
  {
    id: "bali",
    label: "Bali",
    toneClass: "bg-amber-600 hover:bg-amber-700 text-white",
    data: {
      title: "Bali Tour",
      description:
        "8D/7N Bali program via Hanoi with beach and cultural spots.",
      country: "Indonesia",
      genre: "Beach",
      hotel:
        "J4 Hotel Legian, Bintang Kuta, Bintang Bali Resort, Kuta Beach Heritage, Aryaduta Bali",
      hotels:
        "J4 Hotel Legian, Bintang Kuta, Bintang Bali Resort, Kuta Beach Heritage, Aryaduta Bali",
      country_temperature: "33",
      seats: "20",
      group_size: "+20",
      duration_day: "8",
      duration_night: "7",
      airlines: "MIAT",
      is_featured: true,
      image_key:
        "https://res.cloudinary.com/dgl5ewohj/image/upload/v1769077091/bali_hi71o9.avif",
      services: "Airport transfer, City tour",
    },
  },
  {
    id: "halong-bay",
    label: "Halong Bay",
    toneClass: "bg-sky-600 hover:bg-sky-700 text-white",
    data: {
      title: "Halong Bay Tour",
      description: "Direct flight package, 8D/8N Halong Bay itinerary.",
      country: "Vietnam",
      genre: "Beach",
      hotel: "CAPTIAL GARDEN, NOVOTEL HALONG BAY",
      hotels: "CAPTIAL GARDEN, NOVOTEL HALONG BAY",
      country_temperature: "22",
      seats: "20",
      group_size: "+20",
      duration_day: "8",
      duration_night: "8",
      airlines: "MIAT",
      is_featured: true,
      services: "Airport transfer, Cruise tour",
    },
  },
  {
    id: "hochiminh-phuquoc",
    label: "HCM + Phu Quoc",
    toneClass: "bg-cyan-600 hover:bg-cyan-700 text-white",
    data: {
      title: "Ho Chi Minh - Phu Quoc Tour",
      description: "Combined city + island package for Vietnam.",
      country: "Vietnam",
      genre: "City + Beach",
      hotel: "Vinholidays Fiesta Phu Quoc",
      hotels: "Vinholidays Fiesta Phu Quoc",
      country_temperature: "31",
      seats: "20",
      group_size: "+20",
      duration_day: "7",
      duration_night: "7",
      airlines: "MIAT",
      is_featured: true,
      image_key:
        "https://res.cloudinary.com/dgl5ewohj/image/upload/v1769079680/hochiminhphuquoc_a3d54m.avif",
      services: "Airport transfer, City tour",
    },
  },
  {
    id: "janjieje",
    label: "Zhangjiajie",
    toneClass: "bg-violet-600 hover:bg-violet-700 text-white",
    data: {
      title: "Zhangjiajie Tour",
      description: "Mountain and nature-focused China itinerary.",
      country: "China",
      genre: "Nature",
      hotel: "Zhangjiajie Hotel",
      hotels: "Zhangjiajie Hotel",
      country_temperature: "20",
      seats: "20",
      group_size: "+20",
      duration_day: "7",
      duration_night: "6",
      airlines: "MIAT",
      is_featured: true,
      services: "Airport transfer, Guide",
    },
  },
  {
    id: "beijing-zhangjiajie",
    label: "Beijing + Zhangjiajie",
    toneClass: "bg-indigo-600 hover:bg-indigo-700 text-white",
    data: {
      title: "Beijing + Zhangjiajie Tour",
      description: "Combined Beijing city and Zhangjiajie nature program.",
      country: "China",
      genre: "City + Nature",
      hotel: "Beijing Zhangjiajie Hotel",
      hotels: "Beijing Zhangjiajie Hotel",
      country_temperature: "18",
      seats: "20",
      group_size: "+20",
      duration_day: "8",
      duration_night: "7",
      airlines: "MIAT",
      is_featured: true,
      services: "Airport transfer, Guide",
    },
  },
  {
    id: "japan",
    label: "Japan",
    toneClass: "bg-rose-600 hover:bg-rose-700 text-white",
    data: {
      title: "Japan Tour",
      description: "Tokyo and Mt. Fuji package, 6D/5N itinerary.",
      country: "Japan",
      genre: "City",
      hotel: "Japan Hotel",
      hotels: "Japan Hotel",
      country_temperature: "4",
      seats: "20",
      group_size: "+20",
      duration_day: "6",
      duration_night: "5",
      airlines: "MIAT",
      is_featured: true,
      image_key:
        "https://res.cloudinary.com/dgl5ewohj/image/upload/v1769079764/japan_nhtime.avif",
      services: "Airport transfer, Guide",
    },
  },
  {
    id: "nhatrang",
    label: "Nha Trang",
    toneClass: "bg-teal-600 hover:bg-teal-700 text-white",
    data: {
      title: "Nha Trang Tour",
      description: "Direct-flight beach holiday in Nha Trang.",
      country: "Vietnam",
      genre: "Beach",
      hotel: "Vesna",
      hotels: "Vesna",
      country_temperature: "28",
      seats: "20",
      group_size: "+20",
      duration_day: "7",
      duration_night: "6",
      airlines: "MIAT",
      is_featured: true,
      image_key:
        "https://res.cloudinary.com/dvnzk53kp/image/upload/v1766815290/nha-trang_ocwlhc.avif",
      services: "Airport transfer, City tour",
    },
  },
  {
    id: "phuquoc",
    label: "Phu Quoc",
    toneClass: "bg-lime-600 hover:bg-lime-700 text-white",
    data: {
      title: "Phu Quoc Tour",
      description: "Direct-flight Phu Quoc island package.",
      country: "Vietnam",
      genre: "Beach",
      hotel:
        "Wyndham Garden, Wyndham Grand, Vinpearl Melia Villa, Vinpearl Resort, Vinpearl Wonderworld",
      hotels:
        "Wyndham Garden, Wyndham Grand, Vinpearl Melia Villa, Vinpearl Resort, Vinpearl Wonderworld",
      country_temperature: "30",
      seats: "20",
      group_size: "+20",
      duration_day: "7",
      duration_night: "6",
      airlines: "MIAT",
      is_featured: true,
      image_key:
        "https://res.cloudinary.com/dvnzk53kp/image/upload/v1766814618/phu-quoc_esdojz.avif",
      services: "Airport transfer, Island tour",
    },
  },
  {
    id: "shanghai",
    label: "Shanghai",
    toneClass: "bg-fuchsia-600 hover:bg-fuchsia-700 text-white",
    data: {
      title: "Shanghai Tour",
      description:
        "Shanghai city package with historical and skyline highlights.",
      country: "China",
      genre: "City",
      hotel: "Shanghai HOTEL",
      hotels: "Shanghai HOTEL",
      country_temperature: "18",
      seats: "20",
      group_size: "+20",
      duration_day: "7",
      duration_night: "6",
      airlines: "MIAT",
      is_featured: true,
      image_key:
        "https://res.cloudinary.com/dgl5ewohj/image/upload/v1769488976/Shanghai_cqld9b_xkpbwx.png",
      services: "Airport transfer, City tour",
    },
  },
  {
    id: "singapore",
    label: "Singapore",
    toneClass: "bg-cyan-700 hover:bg-cyan-800 text-white",
    data: {
      title: "Singapore Tour",
      description: "Singapore and Bintan combined package.",
      country: "Singapore",
      genre: "City + Beach",
      hotel: "Angsana Bintan",
      hotels: "Traveltine Hotel, Angsana Hotel - Bintan 4*",
      country_temperature: "31",
      seats: "20",
      group_size: "+20",
      duration_day: "8",
      duration_night: "7",
      airlines: "MIAT",
      is_featured: true,
      image_key:
        "https://res.cloudinary.com/dgl5ewohj/image/upload/v1769079913/singapore_pjhhor.avif",
      services: "Airport transfer, Ferry transfer",
    },
  },
  {
    id: "thailand-bangkok",
    label: "Thailand Bangkok",
    toneClass: "bg-orange-600 hover:bg-orange-700 text-white",
    data: {
      title: "Thailand - Bangkok Tour",
      description: "Bangkok and Pattaya mixed city + beach itinerary.",
      country: "Thailand",
      genre: "City + Beach",
      hotel: "The Sukosol, Fifth Pattaya Jomtien",
      hotels: "The Sukosol, Fifth Pattaya Jomtien",
      country_temperature: "30",
      seats: "20",
      group_size: "+20",
      duration_day: "7",
      duration_night: "7",
      airlines: "MIAT",
      is_featured: true,
      image_key:
        "https://res.cloudinary.com/dgl5ewohj/image/upload/v1769080400/barnkok_bv5t4t.png",
      services: "Airport transfer, City tour",
    },
  },
  {
    id: "turkey",
    label: "Turkey",
    toneClass: "bg-red-700 hover:bg-red-800 text-white",
    data: {
      title: "Turkey Tour",
      description: "Historic Turkey itinerary with coastal and spa hotels.",
      country: "Turkey",
      genre: "Culture",
      hotel: "MARVIDA FAMILY ULTRA ALL, ADEMPIRA SPA, QUA COMFORT",
      hotels:
        "Marvida Family Eco Ultra All Inclusive, Adempira Termal & Spa Hotel, Qua Comfort Hotel",
      country_temperature: "11",
      seats: "20",
      group_size: "+20",
      duration_day: "8",
      duration_night: "7",
      airlines: "MIAT",
      is_featured: true,
      image_key:
        "https://res.cloudinary.com/dgl5ewohj/image/upload/v1769477059/turk_trmkkm.avif",
      services: "Airport transfer, Guide",
    },
  },
  {
    id: "phuket",
    label: "Phuket",
    toneClass: "bg-yellow-600 hover:bg-yellow-700 text-white",
    data: {
      title: "Thailand - Phuket Tour",
      description: "Andaman Sea beach package to Phuket.",
      country: "Thailand",
      genre: "Beach",
      hotel: "The Nature Phuket, Patong Resort",
      hotels: "Nature Phuket Hotel, Patong Resort Hotel",
      country_temperature: "31",
      seats: "20",
      group_size: "+20",
      duration_day: "8",
      duration_night: "7",
      airlines: "MIAT",
      is_featured: true,
      services: "Airport transfer, Island hopping",
    },
  },
  {
    id: "dalyan",
    label: "Dalyan",
    toneClass: "bg-stone-600 hover:bg-stone-700 text-white",
    data: {
      title: "Dalyan Tour",
      description: "Default package template for Dalyan route.",
      country: "Turkey",
      genre: "Culture",
      hotel: "Dalyan Hotel",
      hotels: "Dalyan Hotel",
      country_temperature: "25",
      seats: "20",
      group_size: "+20",
      duration_day: "1",
      duration_night: "1",
      airlines: "MIAT",
      is_featured: false,
      services: "Airport transfer",
    },
  },
  {
    id: "sanya",
    label: "Sanya",
    toneClass: "bg-blue-600 hover:bg-blue-700 text-white",
    data: {
      title: "Sanya Tour",
      description: "7-day Sanya package with beach and city highlights.",
      country: "China",
      genre: "Beach",
      hotel: "Sanya Conifer Resort",
      hotels: "Phoenix Island Hotel, Sanya Conifer Resort, Golden Palm Hotel",
      country_temperature: "24",
      seats: "20",
      group_size: "+20",
      duration_day: "7",
      duration_night: "6",
      airlines: "MIAT",
      is_featured: true,
      services: "Airport transfer, City tour",
    },
  },
];

const MN_TEMPLATE_LABELS: Record<string, string> = {
  hainan: "Хайнан",
  bali: "Бали",
  "halong-bay": "Халонг Бэй",
  "hochiminh-phuquoc": "Хо Ши Мин + Фукуок",
  janjieje: "Жанжиажэ",
  "beijing-zhangjiajie": "Бээжин + Жанжиажэ",
  japan: "Япон",
  nhatrang: "Натранг",
  phuquoc: "Фукуок",
  shanghai: "Шанхай",
  singapore: "Сингапур",
  "thailand-bangkok": "Тайланд Бангкок",
  turkey: "Турк",
  phuket: "Пүкет",
  dalyan: "Далянь",
  sanya: "Санья",
};

const MN_TEMPLATE_OVERRIDES: Record<string, Partial<TourFormData>> = {
  hainan: {
    title: "Хайнан арал аялал",
    description:
      "Хайнан арал руу шууд нислэгтэй, далайн эрэг болон хотын аялал хосолсон багц.",
    country: "Хятад",
    genre: "Далайн",
  },
  bali: {
    title: "Бали аялал",
    description: "Ханойгоор дамжих Бали арлын 8 өдөр 7 шөнийн аяллын хөтөлбөр.",
    country: "Индонез",
    genre: "Далайн",
  },
  "halong-bay": {
    title: "Халонг бэй аялал",
    description: "Шууд нислэгтэй 8 өдөр 8 шөнийн аялал.",
    country: "Вьетнам",
    genre: "Далайн",
  },
  "hochiminh-phuquoc": {
    title: "Хо Ши Мин - Фукуок аялал",
    description: "Хот + арал хосолсон Вьетнам аяллын багц.",
    country: "Вьетнам",
    genre: "Хот + Далайн",
  },
  janjieje: {
    title: "Жанжиажэ аялал",
    description: "Уул, байгалийн үзэсгэлэнт чиглэлийн аяллын хөтөлбөр.",
    country: "Хятад",
    genre: "Байгаль",
  },
  "beijing-zhangjiajie": {
    title: "Бээжин - Жанжиажэ аялал",
    description: "Бээжин хот болон Жанжиажэгийн хосолсон аялал.",
    country: "Хятад",
    genre: "Хот + Байгаль",
  },
  japan: {
    title: "Япон аялал",
    description: "Токио, Фүжи уулын 6 өдөр 5 шөнийн аяллын багц.",
    country: "Япон",
    genre: "Хот",
  },
  nhatrang: {
    title: "Натранг аялал",
    description: "Шууд нислэгтэй далайн эргийн амралтын багц.",
    country: "Вьетнам",
    genre: "Далайн",
  },
  phuquoc: {
    title: "Фукуок аялал",
    description: "Шууд нислэгтэй Фукуок арлын аяллын багц.",
    country: "Вьетнам",
    genre: "Далайн",
  },
  shanghai: {
    title: "Шанхай аялал",
    description: "Шанхай хотын түүхэн болон орчин үеийн чиглэлийн аялал.",
    country: "Хятад",
    genre: "Хот",
  },
  singapore: {
    title: "Сингапур аялал",
    description: "Сингапур болон Бинтан арлыг хослуулсан аяллын багц.",
    country: "Сингапур",
    genre: "Хот + Далайн",
  },
  "thailand-bangkok": {
    title: "Тайланд - Бангкок аялал",
    description: "Бангкок болон Паттая хотыг хослуулсан аяллын хөтөлбөр.",
    country: "Тайланд",
    genre: "Хот + Далайн",
  },
  turkey: {
    title: "Турк аялал",
    description: "Түүх, амралт, рашаан бүхий Турк аяллын багц.",
    country: "Турк",
    genre: "Соёл",
  },
  phuket: {
    title: "Тайланд - Пүкет аялал",
    description: "Пүкет арлын далайн эргийн амралтын багц.",
    country: "Тайланд",
    genre: "Далайн",
  },
  dalyan: {
    title: "Далянь аялал",
    description: "Далянь чиглэлийн үндсэн загвар багц.",
    country: "Турк",
    genre: "Соёл",
  },
  sanya: {
    title: "Санья аялал",
    description: "Санья хотын 7 өдрийн далайн аяллын багц.",
    country: "Хятад",
    genre: "Далайн",
  },
};

export function getTemplateLabel(
  template: TourTemplate,
  language: TemplateLanguage,
) {
  if (language === "mn") {
    return MN_TEMPLATE_LABELS[template.id] || template.label;
  }

  return template.label;
}

export function getTemplateData(
  template: TourTemplate,
  language: TemplateLanguage,
) {
  if (language === "mn") {
    return {
      ...template.data,
      ...(MN_TEMPLATE_OVERRIDES[template.id] || {}),
    };
  }

  return template.data;
}
