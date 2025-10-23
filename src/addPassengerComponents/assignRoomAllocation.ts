import type { Passenger } from "../types/type";

interface RoomConfig {
  maxOccupancy: number;
}

/**
 * Room type configuration with maximum occupancy
 */
const ROOM_CONFIG: Record<string, RoomConfig> = {
  Single: { maxOccupancy: 1 },
  King: { maxOccupancy: 1 },
  Double: { maxOccupancy: 2 },
  Twin: { maxOccupancy: 2 },
  Family: { maxOccupancy: 4 },
};

/**
 * Assign room allocation for a passenger, respecting room capacity
 * @param passengers - Array of passengers
 * @param index - Index of the passenger to assign
 * @param roomType - Selected room type
 * @param reassignSubsequent - Whether to reassign subsequent passengers (e.g., for Family rooms)
 * @returns Room allocation string or empty string if invalid
 */
export const assignRoomAllocation = (
  passengers: Passenger[],
  index: number,
  roomType: string,
  reassignSubsequent: boolean = false
): string => {
  if (!roomType || !ROOM_CONFIG[roomType]) return "";

  // Count existing allocations for the room type
  const roomCounts: Record<string, number> = {};
  passengers.forEach((p, i) => {
    if (i < index && p.room_allocation && p.roomType === roomType) {
      roomCounts[p.room_allocation] = (roomCounts[p.room_allocation] || 0) + 1;
    }
  });

  // Find the next available room number
  let roomNumber = 1;
  while (
    roomCounts[`${roomType}-${roomNumber}`] >=
    ROOM_CONFIG[roomType].maxOccupancy
  ) {
    roomNumber++;
  }

  const allocation = `${roomType}-${roomNumber}`;

  // If reassignSubsequent is true (e.g., Family room), assign the same room to subsequent passengers
  if (reassignSubsequent && roomType === "Family") {
    const maxToAssign = Math.min(
      index + ROOM_CONFIG.Family.maxOccupancy - 1,
      passengers.length
    );
    for (let i = index + 1; i < maxToAssign; i++) {
      if (passengers[i]) {
        passengers[i].room_allocation = allocation;
        passengers[i].roomType = roomType;
      }
    }
  }

  return allocation;
};

/**
 * Validate room allocation for all passengers
 * @param passengers - Array of passengers
 * @returns Array of validation errors
 */
export const validateRoomAllocations = (
  passengers: Passenger[]
): { index: number; message: string }[] => {
  const errors: { index: number; message: string }[] = [];
  const roomCounts: Record<string, number> = {};

  passengers.forEach((p, index) => {
    if (!p.roomType || !ROOM_CONFIG[p.roomType]) {
      errors.push({
        index,
        message: `Passenger ${index + 1}: Invalid room type`,
      });
      return;
    }

    if (!p.room_allocation) {
      errors.push({
        index,
        message: `Passenger ${index + 1}: Room allocation missing`,
      });
      return;
    }

    roomCounts[p.room_allocation] = (roomCounts[p.room_allocation] || 0) + 1;
    if (roomCounts[p.room_allocation] > ROOM_CONFIG[p.roomType].maxOccupancy) {
      errors.push({
        index,
        message: `Passenger ${index + 1}: Room ${
          p.room_allocation
        } exceeds capacity (${ROOM_CONFIG[p.roomType].maxOccupancy})`,
      });
    }
  });

  return errors;
};
