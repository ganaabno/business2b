// utils/assignGroupColors.ts
import type { Passenger } from "../types/type";

const COLOR_PALETTE = [
  "#ff0000", // red
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#84cc16", // lime
  "#00b0ff", // sky
  "#3b82f6", // blue
  "#f43f5e", // rose
  "#10b981", // emerald
  "#6366f1", // indigo
  "#f97316", // orange
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#d946ef", // magenta
  "#ec4899", // pink
] as const;

export const assignGroupColors = (passengers: Passenger[]): Passenger[] => {
  const result: Passenger[] = passengers.map((p) => ({ ...p })); // deep clone objects
  const usedColors = new Set<string>();

  let carryOverColor: string | null = null;
  let colorIndex = 0;

  for (let i = 0; i < result.length; i++) {
    const pax = result[i];

    // Skip sub-passengers — they inherit from main
    if (pax.main_passenger_id) {
      const main = result.find((m) => m.id === pax.main_passenger_id);
      if (main?.group_color) {
        pax.group_color = main.group_color;
      }
      continue;
    }

    // === MAIN PASSENGER ===
    let assignedColor: string;

    if (pax.group_color) {
      // Already has saved color → keep it forever
      assignedColor = pax.group_color;
    } else if (carryOverColor) {
      // Previous main had "Link to next" → reuse same color
      assignedColor = carryOverColor;
    } else {
      // New group → pick next unused color
      let color: string;
      do {
        color = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
        colorIndex++;
      } while (usedColors.has(color));
      assignedColor = color;
    }

    // Mark color as used
    usedColors.add(assignedColor);

    // Apply color to this main passenger
    pax.group_color = assignedColor;

    // If "Link to next" is checked → next main gets same color
    carryOverColor = pax.is_related_to_next ? assignedColor : null;
  }

  // Second pass: make sure all sub-passengers have their main's color
  for (const pax of result) {
    if (pax.main_passenger_id) {
      const main = result.find((m) => m.id === pax.main_passenger_id);
      if (main?.group_color) {
        pax.group_color = main.group_color;
      }
    }
  }

  return result;
};
