import type { Passenger } from "../types/type";

export const assignRoomAllocation = (
  passengers: Passenger[],
  currentIndex: number,
  roomType: string
): string => {
  if (currentIndex < 0 || currentIndex >= passengers.length) return "M1";
  const currentPassenger = passengers[currentIndex];

  // If this is a sub-passenger, inherit the main passenger's room_allocation
  if (currentPassenger.main_passenger_id) {
    const mainPassenger = passengers.find(
      (p) => p.id === currentPassenger.main_passenger_id
    );
    if (mainPassenger) {
      return mainPassenger.room_allocation || "M1";
    }
  }

  // Count main passengers (those without main_passenger_id) up to currentIndex
  let mainPassengerCount = 0;
  for (let i = 0; i <= currentIndex; i++) {
    if (!passengers[i].main_passenger_id) {
      mainPassengerCount++;
    }
  }

  // Assign M<mainPassengerCount> (e.g., M1 for first main, M2 for second, etc.)
  return `M${mainPassengerCount}`;
};
