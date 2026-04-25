// hooks/useTourNameMap.ts
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export const useTourNameMap = () => {
  const [map, setMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("tours")
        .select("id, title, name, tour_number");

      const newMap = new Map();
      data?.forEach((t) => {
        newMap.set(t.id, t.title || t.name || t.tour_number || "Unknown");
      });
      setMap(newMap);
    };
    fetch();
  }, []);

  return map;
};
