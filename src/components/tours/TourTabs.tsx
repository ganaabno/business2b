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
    <div className="mono-card p-6">
      <div className="mono-nav mb-6 items-center">
        {tabs.map((tab) => (
          <button
            key={tab.status}
            onClick={() => setActiveTab(tab.status)}
            className={`mono-nav-item relative flex items-center gap-2 ${
              activeTab === tab.status ? "mono-nav-item--active" : ""
            }`}
          >
            {tab.label}
            <span
              className={`mono-badge min-w-[1.5rem] justify-center ${
                activeTab === tab.status
                  ? "!bg-white/20 !text-white !border-white/20"
                  : ""
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={onRefresh}
          className="mono-button mono-button--ghost flex items-center gap-2 text-sm"
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
