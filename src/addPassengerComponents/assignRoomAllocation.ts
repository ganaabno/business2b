// src/addPassengerComponents/roomAllocationLogic.ts
import type { Passenger } from "../types/type";
import { supabase } from "../supabaseClient";

const ROOM_CAPACITY: Record<string, number> = {
  Single: 50,
  King: 50,
  Double: 50,
  Twin: 50,
  Family: 50,
  "Twin + Extra Bed": 50,
  "King + Extra Bed": 50,
  "": 60, // fallback
};

type RoomPassenger = Pick<
  Passenger,
  | "id"
  | "serial_no"
  | "main_passenger_id"
  | "roomType"
  | "departure_date"
  | "room_allocation"
>;

interface RoomSlot {
  roomNo: string;
  used: number;
  capacity: number;
  roomType: string;
}

// Helper: Group passengers by main passenger
const buildGroups = (
  passengers: RoomPassenger[]
): { main: RoomPassenger; members: RoomPassenger[] }[] => {
  const groups: { main: RoomPassenger; members: RoomPassenger[] }[] = [];
  const passengerMap = new Map<string | number, RoomPassenger>();
  passengers.forEach((p) => passengerMap.set(p.id, p));
  const processed = new Set<string | number>();

  for (const pax of passengers) {
    if (processed.has(pax.id)) continue;

    const rootId = pax.main_passenger_id || pax.id;
    const mainPax = passengerMap.get(rootId);
    if (!mainPax) continue;

    const members: RoomPassenger[] = [];
    for (const p of passengers) {
      if ((p.main_passenger_id || p.id) === rootId) {
        members.push(p);
        processed.add(p.id);
      }
    }

    // Sort: main first, then subs
    members.sort((a, b) => {
      if (a.id === rootId) return -1;
      if (b.id === rootId) return 1;
      return (a.serial_no || "").localeCompare(b.serial_no || "");
    });

    groups.push({ main: mainPax, members });
  }

  // Sort groups by main's serial_no
  groups.sort((a, b) =>
    (a.main.serial_no || "").localeCompare(b.main.serial_no || "")
  );
  return groups;
};

export const assignRoomAllocation = async (
  allPassengers: Passenger[],
  currentPassenger: Passenger,
  departureDate: string
): Promise<string> => {
  // === 1. Fetch DB passengers ===
  const { data: dbData, error } = await supabase
    .from("passengers")
    .select(
      "id, serial_no, main_passenger_id, roomType, departure_date, room_allocation"
    )
    .eq("departure_date", departureDate);

  if (error) {
    return "M1";
  }

  const dbPax: RoomPassenger[] = (dbData || []).map((p) => ({
    ...p,
    room_allocation: p.room_allocation ?? "",
  }));

  // === 2. Local passengers (unsaved) ===
  const localSameDate: RoomPassenger[] = allPassengers
    .filter((p) => p.departure_date === departureDate)
    .map((p) => ({
      id: p.id,
      serial_no: p.serial_no,
      main_passenger_id: p.main_passenger_id,
      roomType: p.roomType,
      departure_date: p.departure_date,
      room_allocation: p.room_allocation ?? "",
    }));

  // === 3. Merge DB + local (local wins on conflict) ===
  const passengerMap = new Map<string | number, RoomPassenger>();
  [...dbPax, ...localSameDate].forEach((p) => passengerMap.set(p.id, p));
  const allPax: RoomPassenger[] = Array.from(passengerMap.values());

  // === 4. Build groups ===
  const groups = buildGroups(allPax);

  // === 5. Track available room slots (for reuse) ===
  const roomSlots: RoomSlot[] = [];

  // Extract existing room usage
  allPax.forEach((p) => {
    if (!p.room_allocation) return;
    const existing = roomSlots.find((r) => r.roomNo === p.room_allocation);
    const capacity = ROOM_CAPACITY[p.roomType || ""] || 20;
    if (existing) {
      existing.used += 1;
      existing.capacity = capacity; // enforce correct type
    } else if (p.room_allocation) {
      roomSlots.push({
        roomNo: p.room_allocation,
        used: 1,
        capacity,
        roomType: p.roomType || "",
      });
    }
  });

  let nextRoomNumber = 1;
  const usedNumbers = roomSlots
    .map((r) => parseInt(r.roomNo.replace("M", ""), 10))
    .filter((n) => !isNaN(n));
  while (usedNumbers.includes(nextRoomNumber)) nextRoomNumber++;

  // === 6. Assign rooms to each group ===
  for (const group of groups) {
    const roomType = group.main.roomType || "";
    const capacity = ROOM_CAPACITY[roomType] || 20;
    let remaining = group.members.length;
    let memberIdx = 0;

    // Try to fill existing under-used rooms of same type
    while (remaining > 0) {
      const availableSlot = roomSlots.find(
        (r) => r.roomType === roomType && r.used < r.capacity
      );

      if (
        availableSlot &&
        availableSlot.used + remaining <= availableSlot.capacity
      ) {
        // Fit entire remaining group
        for (let i = 0; i < remaining; i++) {
          group.members[memberIdx++].room_allocation = availableSlot.roomNo;
        }
        availableSlot.used += remaining;
        remaining = 0;
      } else if (availableSlot) {
        // Fill partial
        const canFit = availableSlot.capacity - availableSlot.used;
        for (let i = 0; i < canFit; i++) {
          group.members[memberIdx++].room_allocation = availableSlot.roomNo;
        }
        availableSlot.used = availableSlot.capacity;
        remaining -= canFit;
      } else {
        // Need new room
        const roomNo = `M${nextRoomNumber++}`;
        const canFit = Math.min(remaining, capacity);
        for (let i = 0; i < canFit; i++) {
          group.members[memberIdx++].room_allocation = roomNo;
        }
        roomSlots.push({
          roomNo,
          used: canFit,
          capacity,
          roomType,
        });
        remaining -= canFit;
      }
    }
  }

  // === 7. Return current passenger's room ===
  const currentPax = allPax.find((p) => p.id === currentPassenger.id);
  return currentPax?.room_allocation || "M1";
};
