import type { Tour } from "../types/type";

export function isTourBookableInB2B(tour: Pick<Tour, "source_tag">) {
  return (tour.source_tag ?? "local") !== "global";
}
