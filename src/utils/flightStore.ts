// stores/flightStore.ts
import { create } from "zustand";

type FlightData = any[];

type FlightStore = {
  flightData: FlightData | null;
  isLoading: boolean;
  setFlightData: (data: FlightData) => void;
  setLoading: (loading: boolean) => void;
};

export const useFlightStore = create<FlightStore>((set) => ({
  flightData: null,
  isLoading: true,
  setFlightData: (data) => set({ flightData: data, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
