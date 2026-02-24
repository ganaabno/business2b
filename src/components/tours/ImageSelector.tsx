// components/tours/ImageSelector.tsx
import { IMAGE_MAP, DEFAULT_IMAGE } from "../../constants/imageMap";

interface ImageSelectorProps {
  value: string;
  onChange: (key: string) => void;
}

export default function ImageSelector({ value, onChange }: ImageSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
    >
      <option value="">Choose Image</option>
      {Object.keys(IMAGE_MAP).map((k) => (
        <option key={k} value={k}>
          {k}
        </option>
      ))}
    </select>
  );
}
