import type { Passenger } from "../types/type";

export const assignRoomAllocation = (
  passengers: Passenger[], 
  currentIndex: number, 
  roomType: string
): string => {
  if (currentIndex === 0 || !roomType) return "M1";

  const previousPassenger = passengers[currentIndex - 1];
  
  // Single/King/Double - assign M1 (single occupancy)
  if (["Single", "King", "Double"].includes(roomType)) {
    return "M1";
  }
  
  // Twin - assign M2 for pairs
  if (roomType === "Twin") {
    // Check if previous passenger was also Twin and in M2
    if (previousPassenger?.roomType === "Twin" && previousPassenger.room_allocation === "M2") {
      return "M2"; // Continue the pair
    }
    return "M2"; // Start new pair
  }
  
  // Family - assign same room to next 3 passengers
  if (roomType === "Family") {
    // Find the start of the current family group
    let familyStartIndex = currentIndex;
    for (let i = currentIndex; i >= 0; i--) {
      if (passengers[i]?.roomType === "Family") {
        familyStartIndex = i;
      } else {
        break;
      }
    }
    
    // Assign based on position in family group
    const positionInFamily = currentIndex - familyStartIndex + 1;
    if (positionInFamily <= 3) {
      return `F${familyStartIndex + 1}`; // Same room for family group
    }
    return `F${currentIndex + 1}`; // New family group
  }
  
  return "M1"; // Default fallback
};