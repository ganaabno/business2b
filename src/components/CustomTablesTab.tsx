import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import CustomTableEditor from "./CustomTableEditor";
import type { User as UserType } from "../types/type";

interface CustomTable {
  id?: number;
  name: string;
  description?: string;
  provider_can_view: boolean;
  user_can_view: boolean;
  created_by: string;
  physical_table_name?: string | null;
  created_at?: string;
  initial_rows?: number;
}

interface Props {
  currentUser: UserType;
  showNotification: (type: "success" | "error", message: string) => void;
}

type SortField = "name" | "created_at" | "physical_table_name";
type SortOrder = "asc" | "desc";
type ViewMode = "grid" | "list";

export default function CustomTablesTab({
  currentUser,
  showNotification,
}: Props) {
  const [tables, setTables] = useState<CustomTable[]>([]);
  const [newTableName, setNewTableName] = useState("");
  const [newTableDescription, setNewTableDescription] = useState("");
  const [initialColumns, setInitialColumns] = useState(0);
  const [initialRows, setInitialRows] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [editingTable, setEditingTable] = useState<CustomTable | null>(null);
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    id: number;
    name: string;
    description?: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = useState<
    "all" | "deployed" | "draft"
  >("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchTables();

    const subscription = supabase
      .channel("custom_tables_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "custom_tables",
          filter: `created_by=eq.${currentUser.id}`,
        },
        () => fetchTables()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [currentUser.id]);

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase
        .from("custom_tables")
        .select("*")
        .eq("created_by", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTables(data || []);
    } catch (error: any) {
      showNotification("error", `Failed to fetch tables: ${error.message}`);
    }
  };

  const filteredAndSortedTables = useMemo(() => {
    let result = tables.filter((table) => {
      const matchesSearch =
        table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        table.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter =
        filterStatus === "all" ||
        (filterStatus === "deployed" && table.physical_table_name) ||
        (filterStatus === "draft" && !table.physical_table_name);

      return matchesSearch && matchesFilter;
    });

    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === "created_at") {
        aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
        bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
      }

      if (aVal == null || aVal === "") return 1;
      if (bVal == null || bVal === "") return -1;

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [tables, searchQuery, sortField, sortOrder, filterStatus]);

  const handleCreateMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) {
      showNotification("error", "Table name is required");
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(newTableName.trim())) {
      showNotification(
        "error",
        "Table name must start with a letter and contain only letters, numbers, and underscores"
      );
      return;
    }
    if (
      tables.some(
        (t) => t.name.toLowerCase() === newTableName.trim().toLowerCase()
      )
    ) {
      showNotification("error", "A table with this name already exists");
      return;
    }

    setIsLoading(true);
    try {
      const payload: Partial<CustomTable> = {
        name: newTableName.trim(),
        description: newTableDescription.trim() || undefined,
        provider_can_view: false,
        user_can_view: false,
        created_by: currentUser.id,
        initial_rows: initialRows,
      };

      const { data, error } = await supabase
        .from("custom_tables")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;

      for (let i = 1; i <= initialColumns; i++) {
        const colPayload = {
          table_id: data.id,
          name: `column_${i}`,
          type: "text",
          required: false,
        };
        const { error: colError } = await supabase
          .from("custom_columns")
          .insert([colPayload]);
        if (colError) throw colError;
      }

      setNewTableName("");
      setNewTableDescription("");
      setInitialColumns(0);
      setInitialRows(0);
      setShowCreateForm(false);
      showNotification("success", "✨ Table created successfully!");
      setEditingTable(data as CustomTable);
    } catch (error: any) {
      showNotification("error", `Failed to create table: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTable = async (tableId: number) => {
    if (!editForm || !editForm.name.trim()) {
      showNotification("error", "Table name is required");
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(editForm.name.trim())) {
      showNotification(
        "error",
        "Table name must start with a letter and contain only letters, numbers, and underscores"
      );
      return;
    }
    if (
      tables.some(
        (t) =>
          t.name.toLowerCase() === editForm.name.trim().toLowerCase() &&
          t.id !== tableId
      )
    ) {
      showNotification("error", "A table with this name already exists");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("custom_tables")
        .update({
          name: editForm.name.trim(),
          description: editForm.description?.trim() || null,
        })
        .eq("id", tableId);

      if (error) throw error;

      showNotification("success", "✓ Table updated successfully!");
      setEditingRow(null);
      setEditForm(null);
      fetchTables();
    } catch (error: any) {
      showNotification("error", `Failed to update table: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTables.size === 0) return;

    if (!confirm(`Delete ${selectedTables.size} table(s)?`)) return;

    try {
      const { error } = await supabase
        .from("custom_tables")
        .delete()
        .in("id", Array.from(selectedTables));

      if (error) throw error;

      showNotification("success", `🗑️ Deleted ${selectedTables.size} table(s)`);
      setSelectedTables(new Set());
      fetchTables();
    } catch (error: any) {
      showNotification("error", `Failed to delete: ${error.message}`);
    }
  };

  const toggleTableSelection = (id: number) => {
    const newSelection = new Set(selectedTables);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedTables(newSelection);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const startEditing = (table: CustomTable) => {
    setEditingRow(table.id!);
    setEditForm({
      id: table.id!,
      name: table.name,
      description: table.description || "",
    });
  };

  const cancelEditing = () => {
    setEditingRow(null);
    setEditForm(null);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    tableId: number
  ) => {
    if (e.key === "Enter") {
      handleUpdateTable(tableId);
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const stats = useMemo(
    () => ({
      total: tables.length,
      deployed: tables.filter((t) => t.physical_table_name).length,
      draft: tables.filter((t) => !t.physical_table_name).length,
    }),
    [tables]
  );

  function success(
    type: "error" | "success" | "warning",
    message: string
  ): void {
    throw new Error("Function not implemented.");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-6 lg:p-8">
      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-slide-in-up {
          animation: slideInUp 0.5s ease-out forwards;
        }
        .animate-slide-in-down {
          animation: slideInDown 0.5s ease-out forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
        .animate-scale-in {
          animation: scaleIn 0.4s ease-out forwards;
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .glass-effect {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .card-gradient {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
        }
        .stagger-1 { animation-delay: 0.1s; }
        .stagger-2 { animation-delay: 0.2s; }
        .stagger-3 { animation-delay: 0.3s; }
      `}</style>

      <div className="max-w-7xl mx-auto">
        {/* Hero Header */}
        <div
          className={`glass-effect rounded-3xl p-8 mb-8 shadow-2xl ${
            mounted ? "animate-slide-in-down" : "opacity-0"
          }`}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-4 mb-3">
                <span className="text-6xl animate-float">🗂️</span>
                <h1 className="text-5xl font-black bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                  Custom Tables
                </h1>
              </div>
              <p className="text-gray-300 text-lg ml-20">
                Design, deploy, and dominate your data architecture
              </p>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              disabled={editingRow !== null}
              className={`group relative px-8 py-4 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white rounded-2xl font-bold text-lg shadow-2xl hover:shadow-purple-500/50 transform hover:scale-105 transition-all duration-300 ${
                editingRow !== null
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:-translate-y-1"
              }`}
            >
              <span className="relative z-10 flex items-center gap-2">
                {showCreateForm ? "✕ Cancel" : "✨ New Table"}
              </span>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl"></div>
            </button>
          </div>

          {/* Stats Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              className={`card-gradient rounded-2xl p-6 border border-purple-500/30 transform hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 ${
                mounted ? "animate-scale-in stagger-1" : "opacity-0"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-4xl">📊</span>
                <div className="text-right">
                  <div className="text-4xl font-black text-purple-400">
                    {stats.total}
                  </div>
                  <div className="text-sm text-purple-300 font-medium">
                    Total Tables
                  </div>
                </div>
              </div>
              <div className="h-2 bg-purple-900/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                  style={{ width: "100%" }}
                ></div>
              </div>
            </div>

            <div
              className={`card-gradient rounded-2xl p-6 border border-emerald-500/30 transform hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/20 ${
                mounted ? "animate-scale-in stagger-2" : "opacity-0"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-4xl">✅</span>
                <div className="text-right">
                  <div className="text-4xl font-black text-emerald-400">
                    {stats.deployed}
                  </div>
                  <div className="text-sm text-emerald-300 font-medium">
                    Deployed
                  </div>
                </div>
              </div>
              <div className="h-2 bg-emerald-900/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full"
                  style={{
                    width: `${
                      stats.total ? (stats.deployed / stats.total) * 100 : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>

            <div
              className={`card-gradient rounded-2xl p-6 border border-amber-500/30 transform hover:scale-105 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/20 ${
                mounted ? "animate-scale-in stagger-3" : "opacity-0"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-4xl">📝</span>
                <div className="text-right">
                  <div className="text-4xl font-black text-amber-400">
                    {stats.draft}
                  </div>
                  <div className="text-sm text-amber-300 font-medium">
                    Draft
                  </div>
                </div>
              </div>
              <div className="h-2 bg-amber-900/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                  style={{
                    width: `${
                      stats.total ? (stats.draft / stats.total) * 100 : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <form
              onSubmit={handleCreateMeta}
              className="mt-8 glass-effect rounded-2xl p-6 border-2 border-purple-500/30 animate-slide-in-up"
            >
              <div className="grid md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-bold text-purple-300 mb-2">
                    Table Name *
                  </label>
                  <input
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    className="w-full bg-slate-800/50 border-2 border-purple-500/30 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
                    placeholder="customer_orders"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Start with letter, use lowercase & underscores
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-purple-300 mb-2">
                    Description
                  </label>
                  <input
                    value={newTableDescription}
                    onChange={(e) => setNewTableDescription(e.target.value)}
                    className="w-full bg-slate-800/50 border-2 border-purple-500/30 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
                    placeholder="What's this for?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-purple-300 mb-2">
                    Initial Columns
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={initialColumns}
                    onChange={(e) =>
                      setInitialColumns(parseInt(e.target.value) || 0)
                    }
                    className="w-full bg-slate-800/50 border-2 border-purple-500/30 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
                    placeholder="5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-purple-300 mb-2">
                    Initial Rows
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={initialRows}
                    onChange={(e) =>
                      setInitialRows(parseInt(e.target.value) || 0)
                    }
                    className="w-full bg-slate-800/50 border-2 border-purple-500/30 rounded-xl px-4 py-3 text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all"
                    placeholder="10"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full px-6 py-4 bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-600 text-white rounded-xl font-bold text-lg shadow-xl ${
                  isLoading
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:shadow-emerald-500/50 transform hover:scale-[1.02] transition-all duration-300"
                }`}
              >
                {isLoading ? "🔄 Creating..." : "✨ Create Table"}
              </button>
            </form>
          )}

          {/* Controls */}
          <div className="mt-6 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search tables..."
                disabled={editingRow !== null}
                className={`w-full pl-4 pr-12 py-3 bg-slate-800/50 border-2 border-purple-500/30 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all ${
                  editingRow !== null ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
              {searchQuery && editingRow === null && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              disabled={editingRow !== null}
              className={`px-4 py-3 bg-slate-800/50 border-2 border-purple-500/30 rounded-xl text-white focus:border-purple-500 transition-all ${
                editingRow !== null ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <option value="all">All Tables</option>
              <option value="deployed">Deployed Only</option>
              <option value="draft">Draft Only</option>
            </select>

            <div className="flex gap-2 bg-slate-800/50 rounded-xl p-1 border-2 border-purple-500/30">
              <button
                onClick={() => setViewMode("list")}
                disabled={editingRow !== null}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  viewMode === "list"
                    ? "bg-purple-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                } ${
                  editingRow !== null ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                📋 List
              </button>
              <button
                onClick={() => setViewMode("grid")}
                disabled={editingRow !== null}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  viewMode === "grid"
                    ? "bg-purple-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-white"
                } ${
                  editingRow !== null ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                ⊞ Grid
              </button>
            </div>
          </div>

          {/* Selection Actions */}
          {selectedTables.size > 0 && (
            <div className="mt-4 glass-effect rounded-xl p-4 border-2 border-blue-500/30 flex items-center justify-between animate-slide-in-up">
              <span className="font-bold text-blue-300 text-lg">
                {selectedTables.size} table(s) selected
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedTables(new Set())}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all font-semibold"
                >
                  Clear
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={editingRow !== null}
                  className={`px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-lg transition-all font-semibold ${
                    editingRow !== null
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:shadow-lg hover:shadow-red-500/50"
                  }`}
                >
                  🗑️ Delete Selected
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tables Display */}
        <div
          className={`glass-effect rounded-3xl p-8 shadow-2xl ${
            mounted ? "animate-fade-in" : "opacity-0"
          }`}
        >
          {filteredAndSortedTables.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-8xl mb-6 animate-float">📭</div>
              <p className="text-3xl font-bold text-gray-300 mb-2">
                {searchQuery || filterStatus !== "all"
                  ? "No tables match your filters"
                  : "No custom tables created yet"}
              </p>
              <p className="text-gray-500 text-lg">
                {!showCreateForm && "Click '✨ New Table' to get started!"}
              </p>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-800/50 rounded-xl font-bold text-sm text-purple-300 border border-purple-500/30">
                <div className="col-span-1 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={
                      selectedTables.size === filteredAndSortedTables.length &&
                      editingRow === null
                    }
                    onChange={(e) => {
                      if (editingRow !== null) return;
                      if (e.target.checked) {
                        setSelectedTables(
                          new Set(filteredAndSortedTables.map((t) => t.id!))
                        );
                      } else {
                        setSelectedTables(new Set());
                      }
                    }}
                    className="w-5 h-5"
                  />
                </div>
                <div
                  className={`col-span-4 flex items-center gap-2 ${
                    editingRow === null
                      ? "cursor-pointer hover:text-purple-400"
                      : "opacity-50 cursor-not-allowed"
                  } transition-colors`}
                  onClick={() => editingRow === null && toggleSort("name")}
                >
                  Name{" "}
                  {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </div>
                <div className="col-span-3">Description</div>
                <div
                  className={`col-span-2 flex items-center gap-2 ${
                    editingRow === null
                      ? "cursor-pointer hover:text-purple-400"
                      : "opacity-50 cursor-not-allowed"
                  } transition-colors`}
                  onClick={() =>
                    editingRow === null && toggleSort("created_at")
                  }
                >
                  Created{" "}
                  {sortField === "created_at" &&
                    (sortOrder === "asc" ? "↑" : "↓")}
                </div>
                <div className="col-span-2">Actions</div>
              </div>

              {filteredAndSortedTables.map((table, index) => (
                <div
                  key={table.id}
                  className={`grid grid-cols-12 gap-4 px-6 py-4 border-2 rounded-xl hover:shadow-xl transition-all duration-300 animate-scale-in ${
                    selectedTables.has(table.id!) || editingRow === table.id
                      ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20"
                      : "border-purple-500/20 hover:border-purple-500/50"
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="col-span-1 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selectedTables.has(table.id!)}
                      onChange={() => toggleTableSelection(table.id!)}
                      className="w-5 h-5"
                      disabled={editingRow !== null}
                    />
                  </div>
                  <div className="col-span-4 flex flex-col">
                    {editingRow === table.id ? (
                      <input
                        value={editForm?.name || ""}
                        onChange={(e) =>
                          setEditForm(
                            editForm
                              ? { ...editForm, name: e.target.value }
                              : null
                          )
                        }
                        onKeyDown={(e) => handleKeyDown(e, table.id!)}
                        className="w-full bg-slate-800/50 border-2 border-purple-500 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 transition-all"
                        placeholder="Table name"
                      />
                    ) : (
                      <>
                        <span className="font-bold text-white text-lg">
                          {table.name}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full w-fit mt-1 font-semibold ${
                            table.physical_table_name
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {table.physical_table_name ? "✓ Deployed" : "○ Draft"}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="col-span-3 text-sm text-gray-400 truncate flex items-center">
                    {editingRow === table.id ? (
                      <input
                        value={editForm?.description || ""}
                        onChange={(e) =>
                          setEditForm(
                            editForm
                              ? { ...editForm, description: e.target.value }
                              : null
                          )
                        }
                        onKeyDown={(e) => handleKeyDown(e, table.id!)}
                        className="w-full bg-slate-800/50 border-2 border-purple-500 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 transition-all"
                        placeholder="Description"
                      />
                    ) : (
                      table.description || "-"
                    )}
                  </div>
                  <div className="col-span-2 text-sm text-gray-500 flex items-center">
                    {table.created_at
                      ? new Date(table.created_at).toLocaleDateString()
                      : "-"}
                  </div>
                  <div className="col-span-2 flex gap-2">
                    {editingRow === table.id ? (
                      <>
                        <button
                          onClick={() => handleUpdateTable(table.id!)}
                          disabled={isLoading || !editForm?.name.trim()}
                          className={`px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg text-sm font-semibold transition-all ${
                            isLoading || !editForm?.name.trim()
                              ? "opacity-50 cursor-not-allowed"
                              : "hover:shadow-lg hover:shadow-emerald-500/50 transform hover:scale-105"
                          }`}
                        >
                          ✓ Save
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-600 transition-all"
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEditing(table)}
                          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-indigo-500/50 transition-all transform hover:scale-105"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => setEditingTable(table)}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all transform hover:scale-105"
                          disabled={editingRow !== null}
                        >
                          ⚙️ Manage
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedTables.map((table, index) => (
                <div
                  key={table.id}
                  className={`card-gradient rounded-2xl p-6 border-2 transform hover:scale-105 hover:-translate-y-2 transition-all duration-300 cursor-pointer group animate-scale-in ${
                    selectedTables.has(table.id!)
                      ? "border-purple-500 shadow-xl shadow-purple-500/30"
                      : "border-purple-500/20 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/20"
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTables.has(table.id!)}
                        onChange={() => toggleTableSelection(table.id!)}
                        disabled={editingRow !== null}
                        className="w-5 h-5 rounded border-purple-500 focus:ring-purple-500 cursor-pointer"
                      />
                      <div className="text-4xl group-hover:scale-110 transition-transform">
                        {table.physical_table_name ? "📊" : "📝"}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        table.physical_table_name
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {table.physical_table_name ? "✓ Live" : "○ Draft"}
                    </span>
                  </div>

                  <h3 className="text-2xl font-black text-white mb-2 group-hover:text-purple-400 transition-colors">
                    {table.name}
                  </h3>
                  <p className="text-gray-400 mb-4 line-clamp-2 min-h-[3rem]">
                    {table.description || "No description provided"}
                  </p>
                  <div className="text-xs text-gray-500 mb-4 flex items-center gap-2">
                    <span>📅</span>
                    {table.created_at
                      ? new Date(table.created_at).toLocaleDateString()
                      : "-"}
                  </div>

                  <button
                    onClick={() => setEditingTable(table)}
                    disabled={editingRow !== null}
                    className={`w-full px-4 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white rounded-xl font-bold transition-all duration-300 ${
                      editingRow !== null
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:shadow-lg hover:shadow-purple-500/50 transform hover:scale-105"
                    }`}
                  >
                    ⚙️ Manage Columns
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingTable && (
        <CustomTableEditor
          key={editingTable.id}
          tableMeta={editingTable}
          onClose={() => {
            setEditingTable(null);
            fetchTables();
          }}
          showNotification={success}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
