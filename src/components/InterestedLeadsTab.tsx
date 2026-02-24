// src/components/InterestedLeadsTab.tsx
import React, { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  PhoneIncoming,
  UserCheck,
  Trash2,
  Loader2,
  Filter,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import TourSelection from "../Parts/TourSelection";
import { useTours } from "../hooks/useTours";
import { toast } from "react-hot-toast";

export const INTERESTED_STATUSES = [
  "new",
  "Information given",
  "Need to give information",
  "Need to tell got a seat/in waiting",
  "Need to conclude a contract",
  "Concluded a contract",
  "Postponed the travel",
  "Interested in other travel",
  "Paid the advance payment",
  "Need to meet",
  "Sent a claim",
  "Fam Tour",
  "Has taken seat from another company",
  "Swapped seat with another company",
  "Gave seat to another company",
  "Cancelled and bought travel from another country",
  "Completed",
  "cancelled",
] as const;

type InterestedStatus = (typeof INTERESTED_STATUSES)[number];

interface InterestedLead {
  id: string;
  tour_id: string | null;
  tour_name: string | null;
  tour_title: string | null;
  departure_date: string | null;
  name: string;
  phone: string;
  passenger_count: number;
  notes: string | null;
  status: InterestedStatus;
  created_at: string;
  manager_id: string;
}

type TabView = "active" | "completed";

export default function InterestedLeadsTab({
  currentUser,
  showNotification,
}: {
  currentUser: any;
  showNotification: (type: "success" | "error", msg: string) => void;
}) {
  const [leads, setLeads] = useState<InterestedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<TabView>("active");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form state
  const [selectedTour, setSelectedTour] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [passengerCount, setPassengerCount] = useState("1");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { tours, loading: toursLoading } = useTours({
    userRole: currentUser.role,
  });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("interested_leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) showNotification("error", "Failed to load leads");
    else setLeads(data || []);
    setLoading(false);
  }, [showNotification]);

  useEffect(() => {
    fetchLeads();

    const channel = supabase
      .channel("interested_leads_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interested_leads" },
        (payload) => {
          if (payload.eventType === "INSERT")
            setLeads((prev) => [payload.new as InterestedLead, ...prev]);
          if (payload.eventType === "UPDATE")
            setLeads((prev) =>
              prev.map((l) =>
                l.id === (payload.new as InterestedLead).id
                  ? (payload.new as InterestedLead)
                  : l
              )
            );
          if (payload.eventType === "DELETE")
            setLeads((prev) =>
              prev.filter((l) => l.id !== (payload.old as any).id)
            );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeads]);

  // Listen for successful booking → auto-set to Completed
  useEffect(() => {
    const handler = (e: any) => {
      const { leadId } = e.detail || {};
      if (leadId) {
        updateLead(leadId, { status: "Completed" } as Partial<InterestedLead>);
        toast.success("Lead marked as Completed!", { duration: 5000 });
      }
    };
    window.addEventListener("booking-completed-from-lead", handler);
    return () =>
      window.removeEventListener("booking-completed-from-lead", handler);
  }, []);

  const updateLead = async (id: string, updates: Partial<InterestedLead>) => {
    setUpdatingId(id);
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );

    const { error } = await supabase
      .from("interested_leads")
      .update(updates)
      .eq("id", id);

    if (error) {
      showNotification("error", "Update failed");
      fetchLeads();
    }
    setUpdatingId(null);
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    const { error } = await supabase
      .from("interested_leads")
      .delete()
      .eq("id", id);
    if (error) fetchLeads();
    else toast.success("Lead deleted");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTour.trim())
      return showNotification("error", "Select a tour!");
    if (!name.trim() || !phone.trim())
      return showNotification("error", "Name & phone required!");

    setSaving(true);
    const { error } = await supabase.from("interested_leads").insert({
      tour_name: selectedTour.trim(),
      tour_title: selectedTour.trim(),
      departure_date: departureDate || null,
      name: name.trim(),
      phone: phone.trim(),
      passenger_count: parseInt(passengerCount),
      notes: notes.trim() || null,
      status: "new",
      manager_id: currentUser.id,
    });

    if (error) showNotification("error", error.message);
    else {
      toast.success(`${name} added to leads!`);
      setName("");
      setPhone("");
      setNotes("");
      setSelectedTour("");
      setDepartureDate("");
      setPassengerCount("1");
    }
    setSaving(false);
  };

  const getTourIdFromLead = (lead: InterestedLead): string | null => {
    if (lead.tour_id && tours.some((t) => t.id === lead.tour_id))
      return lead.tour_id;
    const terms = [lead.tour_title, lead.tour_name].filter(Boolean);
    for (const term of terms) {
      const found = tours.find((t: any) => {
        const candidates = [t.title, t.name, t.tour_number?.toString()].filter(
          Boolean
        );
        return candidates.some(
          (c) =>
            c?.toLowerCase().includes(term!.toLowerCase()) ||
            term!.toLowerCase().includes(c!.toLowerCase())
        );
      });
      if (found) return found.id;
    }
    return null;
  };

  const startBookingFromLead = async (lead: InterestedLead) => {
    const cleanDate = lead.departure_date?.split("T")[0];
    if (!cleanDate) {
      toast.error("No departure date");
      return;
    }

    // IMMEDIATELY MARK AS COMPLETED
    await updateLead(lead.id, {
      status: "Completed",
    } as Partial<InterestedLead>);
    toast.success(`${lead.name} → Registered! Moved to Completed tab.`);

    // Then open the booking form
    const tourId = getTourIdFromLead(lead);

    window.dispatchEvent(
      new CustomEvent("force-prefill-booking", {
        detail: {
          tourId: tourId || lead.tour_title || lead.tour_name || "",
          departureDate: cleanDate,
          name: lead.name.trim(),
          phone: lead.phone.trim(),
          passengerCount: lead.passenger_count,
          notes: lead.notes || "",
        },
      })
    );
  };

  const getStatusColor = (s: string) => {
    const map: Record<string, string> = {
      new: "bg-red-100 text-red-700 border-red-300",
      "Information given": "bg-blue-100 text-blue-800",
      "Paid the advance payment": "bg-emerald-100 text-emerald-800",
      Completed: "bg-green-100 text-green-800",
      cancelled: "bg-gray-200 text-gray-600",
    };
    return map[s] || "bg-gray-100 text-gray-700 border-gray-300";
  };

  // FILTERED LEADS
  const filteredLeads = leads
    .filter((lead) => {
      if (activeView === "completed") return lead.status === "Completed";
      if (activeView === "active")
        return lead.status !== "Completed" && lead.status !== "cancelled";
      return true;
    })
    .filter((lead) => {
      if (statusFilter === "all") return true;
      return lead.status === statusFilter;
    });

  return (
    <div className="space-y-8 pb-20">
      {/* ADD NEW LEAD */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <PhoneIncoming className="w-8 h-8 text-emerald-600" />
          Add Interested Lead
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-dashed border-blue-300">
            <TourSelection
              tours={tours}
              selectedTour={selectedTour}
              setSelectedTour={setSelectedTour}
              departure_date={departureDate}
              setDepartureDate={setDepartureDate}
              errors={[]}
              setActiveStep={() => {}}
              userRole={currentUser.role}
              showAvailableSeats={true}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full Name"
              className="px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
            <input
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+976..."
              className="px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
            <select
              value={passengerCount}
              onChange={(e) => setPassengerCount(e.target.value)}
              className="px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n} {n > 1 ? "people" : "person"}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes (FB name, link, etc.)"
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500"
          />

          <button
            type="submit"
            disabled={saving || toursLoading}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                Saving... <Loader2 className="w-5 h-5 animate-spin" />
              </>
            ) : (
              <>
                Save Lead & Call Later <UserCheck className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* TABS + FILTER */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border">
        <div className="px-8 py-6 bg-slate-100 border-b flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-2xl font-bold">
              Interested Leads ({filteredLeads.length})
            </h3>
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button
                onClick={() => setActiveView("active")}
                className={`px-5 py-2 rounded-md font-medium transition ${
                  activeView === "active"
                    ? "bg-white shadow-sm text-blue-700"
                    : "text-gray-600"
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setActiveView("completed")}
                className={`px-5 py-2 rounded-md font-medium transition ${
                  activeView === "completed"
                    ? "bg-white shadow-sm text-green-700"
                    : "text-gray-600"
                }`}
              >
                Completed
              </button>
            </div>
          </div>

          {activeView === "active" && (
            <div className="flex items-center gap-3">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Status</option>
                {INTERESTED_STATUSES.filter(
                  (s) => s !== "Completed" && s !== "cancelled"
                ).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-16 text-center">Loading...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            {activeView === "completed"
              ? "No completed leads"
              : "No active leads"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full mono-table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">
                    Phone
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">
                    Pax
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">
                    Tour
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-600 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                          {lead.name[0]?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <div className="font-bold">{lead.name}</div>
                          {lead.notes && (
                            <div className="text-xs text-gray-500 italic">
                              {lead.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">{lead.phone}</td>
                    <td className="px-6 py-5 text-center font-bold text-emerald-600">
                      {lead.passenger_count}
                    </td>
                    <td className="px-6 py-5 font-medium">
                      {lead.tour_title || lead.tour_name || "—"}
                    </td>
                    <td className="px-6 py-5 text-sm text-gray-600">
                      {format(new Date(lead.created_at), "MMM dd, HH:mm")}
                    </td>

                    <td className="px-6 py-5">
                      {updatingId === lead.id ? (
                        <div className="px-4 py-2 bg-gray-200 rounded-full text-xs animate-pulse">
                          saving...
                        </div>
                      ) : (
                        <select
                          value={lead.status}
                          onChange={(e) =>
                            updateLead(lead.id, {
                              status: e.target.value as InterestedStatus,
                            })
                          }
                          className={`px-4 py-2 rounded-full text-xs font-bold border-2 ${getStatusColor(
                            lead.status
                          )} cursor-pointer`}
                        >
                          {INTERESTED_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    <td className="px-6 py-5 text-center space-x-3">
                      {lead.status !== "Completed" &&
                        lead.status !== "cancelled" && (
                          <button
                            onClick={() => startBookingFromLead(lead)}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg hover:scale-105 transition text-sm"
                          >
                            Register Here
                          </button>
                        )}
                      <button
                        onClick={() => deleteLead(lead.id)}
                        className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
