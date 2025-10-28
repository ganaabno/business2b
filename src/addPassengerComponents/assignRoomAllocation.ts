import type { Passenger } from "../types/type";

const ROOM_CAPACITY: Record<string, number> = {
  Single: 1,
  Double: 2,
  Twin: 2,
  Triple: 3,
  Quad: 4,
  Family: 5,
  "": 5,
};

export const assignRoomAllocation = (
  allPassengers: Passenger[],
  currentPassenger: Passenger,
  departureDate: string
): string => {
  const sameDatePax = allPassengers.filter(
    (p) => p.departure_date === departureDate
  );

  const groupId = currentPassenger.main_passenger_id
    ? allPassengers.find((p) => p.id === currentPassenger.main_passenger_id)
        ?.serial_no
    : currentPassenger.serial_no;

  if (!groupId) return "M1";

  // === 1. Try to extend current group's room ===
  const mainInGroup = sameDatePax.find(
    (p) => p.serial_no === groupId && !p.main_passenger_id
  );

  if (mainInGroup?.room_allocation) {
    const paxInRoom = sameDatePax.filter(
      (p) => p.room_allocation === mainInGroup.room_allocation
    );
    const capacity = ROOM_CAPACITY[paxInRoom[0]?.roomType || ""] || 5;
    if (paxInRoom.length < capacity) {
      return mainInGroup.room_allocation;
    }
  }

  // === 2. Reuse any empty room (from deleted groups) ===
  const usedRooms = [
    ...new Set(sameDatePax.map((p) => p.room_allocation).filter(Boolean)),
  ];
  for (const room of usedRooms) {
    const count = sameDatePax.filter((p) => p.room_allocation === room).length;
    if (count === 0) return room;
  }

  // === 3. Create next room number ===
  const numbers = usedRooms
    .map((r) => parseInt(r.replace("M", ""), 10))
    .filter((n) => !isNaN(n));
  const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `M${nextNum}`;
};
