import { IMAGE_MAP } from "../constants/imageMap";
import DefaultImage from "../assets/tours/default.jpg";

export const getImageSrc = (key: string | null | undefined): string => {
  if (!key?.trim()) return DefaultImage;
  const k = key.trim();
  if (k in IMAGE_MAP) return IMAGE_MAP[k as keyof typeof IMAGE_MAP];
  const lower = Object.keys(IMAGE_MAP).find(
    (m) => m.toLowerCase() === k.toLowerCase()
  );
  return lower ? IMAGE_MAP[lower as keyof typeof IMAGE_MAP] : DefaultImage;
};
