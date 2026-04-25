import type { Tour } from "../types/type";

type TourDateSource = {
  dates?: unknown;
  departure_date?: Tour["departure_date"] | null;
  departuredate?: string | null;
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeTourDateValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isoCandidate = trimmed.slice(0, 10);
  if (ISO_DATE_RE.test(isoCandidate)) {
    return isoCandidate;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

export function extractTourDepartureDates(
  tour: TourDateSource | null | undefined,
): string[] {
  if (!tour) {
    return [];
  }

  const unique = new Set<string>();

  if (Array.isArray(tour.dates)) {
    for (const dateValue of tour.dates) {
      const normalized = normalizeTourDateValue(dateValue);
      if (normalized) {
        unique.add(normalized);
      }
    }
  } else if (typeof tour.dates === "string" && tour.dates.trim()) {
    const rawDates = tour.dates.trim();

    if (rawDates.startsWith("[")) {
      try {
        const parsed = JSON.parse(rawDates);
        if (Array.isArray(parsed)) {
          for (const dateValue of parsed) {
            const normalized = normalizeTourDateValue(dateValue);
            if (normalized) {
              unique.add(normalized);
            }
          }
        }
      } catch {
        // Fallback to split parser below.
      }
    }

    if (unique.size === 0) {
      const splitCandidates = rawDates
        .split(/[\n,]/g)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

      for (const dateValue of splitCandidates) {
        const normalized = normalizeTourDateValue(dateValue);
        if (normalized) {
          unique.add(normalized);
        }
      }
    }
  }

  const fallbackDates = [tour.departure_date, tour.departuredate];
  for (const fallback of fallbackDates) {
    const normalized = normalizeTourDateValue(fallback);
    if (normalized) {
      unique.add(normalized);
    }
  }

  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

export function getPrimaryTourDepartureDate(
  tour: TourDateSource | null | undefined,
): string | null {
  const dates = extractTourDepartureDates(tour);
  return dates.length > 0 ? dates[0] : null;
}
