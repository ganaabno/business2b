// src/components/tours/TourTabs.tsx
import { useState } from "react";
import TourList from "./TourList";
import type { Tour, TourFormData } from "../../types/type";

type Status = "active" | "inactive" | "full" | "completed";

interface TourTabsProps {
  tours: Tour[];
  editingId: string | null;
  editForm: TourFormData;
  setEditForm: React.Dispatch<React.SetStateAction<TourFormData>>;
  onStartEdit: (tour: Tour) => void;
  onSaveEdit: () => Promise<void>;
  onCancelEdit: () => void;
  onDelete: (id: string) => Promise<void>;
  showDeleteConfirm: string | null;
  setShowDeleteConfirm: React.Dispatch<React.SetStateAction<string | null>>;
  onRefresh: () => Promise<void>;
  onStatusChange: (id: string, status: Status) => Promise<void>;
}

export default function TourTabs({
  tours,
  editingId,
  editForm,
  setEditForm,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  showDeleteConfirm,
  setShowDeleteConfirm,
  onRefresh,
  onStatusChange,
}: TourTabsProps) {
  const [activeTab, setActiveTab] = useState<Status>("active");

  const validStatuses: Status[] = ["active", "inactive", "full", "completed"];

  const tabData = {
    active: tours.filter((t) => t.status === "active"),
    inactive: tours.filter(
      (t) =>
        !t.status ||
        t.status === "inactive" ||
        t.status === "hidden" ||
        t.status === "pending"
    ),
    full: tours.filter((t) => t.status === "full"),
    completed: tours.filter((t) => t.status === "completed"),
  };

  const currentTours = tabData[activeTab];

  const tabs = [
    {
      label: "Active",
      status: "active" as const,
      count: tabData.active.length,
    },
    {
      label: "Inactive",
      status: "inactive" as const,
      count: tabData.inactive.length,
    },
    { label: "Full", status: "full" as const, count: tabData.full.length },
    {
      label: "Completed",
      status: "completed" as const,
      count: tabData.completed.length,
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex border-b border-gray-200 mb-6 items-center">
        {tabs.map((tab) => (
          <button
            key={tab.status}
            onClick={() => setActiveTab(tab.status)}
            className={`px-5 py-2.5 font-medium text-sm transition-all duration-200 relative flex items-center gap-2 ${
              activeTab === tab.status
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            <span
              className={`px-2.5 py-0.5 text-xs font-bold rounded-full min-w-[1.5rem] ${
                activeTab === tab.status
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 flex items-center gap-2 transition text-sm font-medium shadow-sm"
        >
          Refresh
        </button>
      </div>

      <TourList
        tours={currentTours}
        editingId={editingId}
        editForm={editForm}
        setEditForm={setEditForm}
        onStartEdit={onStartEdit}
        onSaveEdit={onSaveEdit}
        onCancelEdit={onCancelEdit}
        onDelete={onDelete}
        showDeleteConfirm={showDeleteConfirm}
        setShowDeleteConfirm={setShowDeleteConfirm}
        onRefresh={onRefresh}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}
