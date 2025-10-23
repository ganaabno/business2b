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
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Set<number>>(new Set());
  const [filterStatus, setFilterStatus] = useState<
    "all" | "deployed" | "draft"
  >("all");

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

      // Add initial columns
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
      showNotification(
        "success",
        "Custom table meta created. You can now manage columns."
      );
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

      showNotification("success", "Table updated successfully! ✓");
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

      showNotification("success", `Deleted ${selectedTables.size} table(s)`);
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

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white shadow-lg rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <span className="text-4xl">🗂️</span>
                Custom Tables
              </h2>
              <p className="text-gray-600 mt-1">
                Manage your database tables with ease
              </p>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              disabled={editingRow !== null}
              className={`px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 font-semibold ${
                editingRow !== null ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {showCreateForm ? "✕ Cancel" : "+ New Table"}
            </button>
          </div>

          {/* Stats Dashboard */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">
                {stats.total}
              </div>
              <div className="text-sm text-blue-600">Total Tables</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                {stats.deployed}
              </div>
              <div className="text-sm text-green-600">Deployed</div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
              <div className="text-2xl font-bold text-amber-700">
                {stats.draft}
              </div>
              <div className="text-sm text-amber-600">Draft</div>
            </div>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <form
              onSubmit={handleCreateMeta}
              className="bg-gray-50 rounded-lg p-6 border-2 border-blue-200 space-y-4 mb-6"
            >
              <div className="grid md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Table Name *
                  </label>
                  <input
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-lg shadow-sm py-2 px-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="e.g., customer_orders"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use lowercase, underscores, start with a letter
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <input
                    value={newTableDescription}
                    onChange={(e) => setNewTableDescription(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-lg shadow-sm py-2 px-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="What's this table for?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Initial Columns
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={initialColumns}
                    onChange={(e) =>
                      setInitialColumns(parseInt(e.target.value) || 0)
                    }
                    className="w-full border-2 border-gray-300 rounded-lg shadow-sm py-2 px-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="e.g., 5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Initial Rows
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={initialRows}
                    onChange={(e) =>
                      setInitialRows(parseInt(e.target.value) || 0)
                    }
                    className="w-full border-2 border-gray-300 rounded-lg shadow-sm py-2 px-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="e.g., 10"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg shadow-lg hover:shadow-xl font-semibold transition-all ${
                  isLoading
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:scale-[1.02]"
                }`}
              >
                {isLoading ? "🔄 Creating..." : "✓ Create Table"}
              </button>
            </form>
          )}

          {/* Advanced Controls */}
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 Search tables..."
                disabled={editingRow !== null}
                className={`w-full pl-4 pr-10 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                  editingRow !== null ? "opacity-50 cursor-not-allowed" : ""
                }`}
              />
              {searchQuery && editingRow === null && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              disabled={editingRow !== null}
              className={`px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                editingRow !== null ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <option value="all">All Tables</option>
              <option value="deployed">Deployed Only</option>
              <option value="draft">Draft Only</option>
            </select>

            <div className="flex gap-2 bg-gray-200 rounded-lg p-1">
              <button
                onClick={() => setViewMode("list")}
                disabled={editingRow !== null}
                className={`px-4 py-2 rounded-md transition ${
                  viewMode === "list"
                    ? "bg-white shadow-md text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                } ${
                  editingRow !== null ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                📋 List
              </button>
              <button
                onClick={() => setViewMode("grid")}
                disabled={editingRow !== null}
                className={`px-4 py-2 rounded-md transition ${
                  viewMode === "grid"
                    ? "bg-white shadow-md text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                } ${
                  editingRow !== null ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                ⊞ Grid
              </button>
            </div>
          </div>

          {selectedTables.size > 0 && (
            <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg flex items-center justify-between">
              <span className="font-semibold text-blue-900">
                {selectedTables.size} table(s) selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTables(new Set())}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Clear
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={editingRow !== null}
                  className={`px-4 py-2 bg-red-600 text-white rounded-lg transition ${
                    editingRow !== null
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-red-700"
                  }`}
                >
                  🗑️ Delete Selected
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tables Display */}
        <div className="bg-white shadow-lg rounded-xl p-6">
          {filteredAndSortedTables.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-xl text-gray-500">
                {searchQuery || filterStatus !== "all"
                  ? "No tables match your filters"
                  : "No custom tables created yet"}
              </p>
              <p className="text-gray-400 mt-2">
                {!showCreateForm && "Click 'New Table' to get started!"}
              </p>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-100 rounded-lg font-semibold text-sm text-gray-700">
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
                    className="w-4 h-4"
                  />
                </div>
                <div
                  className={`col-span-4 flex items-center gap-1 ${
                    editingRow === null
                      ? "cursor-pointer hover:text-blue-600"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                  onClick={() => editingRow === null && toggleSort("name")}
                >
                  Name{" "}
                  {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </div>
                <div className="col-span-3">Description</div>
                <div
                  className={`col-span-2 flex items-center gap-1 ${
                    editingRow === null
                      ? "cursor-pointer hover:text-blue-600"
                      : "opacity-50 cursor-not-allowed"
                  }`}
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

              {filteredAndSortedTables.map((table) => (
                <div
                  key={table.id}
                  className={`grid grid-cols-12 gap-4 px-4 py-4 border-2 rounded-lg hover:shadow-md transition-all ${
                    selectedTables.has(table.id!) || editingRow === table.id
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="col-span-1 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selectedTables.has(table.id!)}
                      onChange={() => toggleTableSelection(table.id!)}
                      className="w-4 h-4"
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
                        className="w-full border-2 border-gray-300 rounded-lg shadow-sm py-1 px-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        placeholder="Table name"
                      />
                    ) : (
                      <>
                        <span className="font-semibold text-gray-900">
                          {table.name}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full w-fit mt-1 ${
                            table.physical_table_name
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {table.physical_table_name ? "✓ Deployed" : "○ Draft"}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="col-span-3 text-sm text-gray-600 truncate">
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
                        className="w-full border-2 border-gray-300 rounded-lg shadow-sm py-1 px-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                        placeholder="Table description"
                      />
                    ) : (
                      table.description || "-"
                    )}
                  </div>
                  <div className="col-span-2 text-sm text-gray-500">
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
                          className={`px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition ${
                            isLoading || !editForm?.name.trim()
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          ✓ Save
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-3 py-1 bg-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-400 transition"
                        >
                          ✕ Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEditing(table)}
                          className="px-3 py-1 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 transition"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => setEditingTable(table)}
                          className="px-3 py-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-md text-sm hover:shadow-lg transition transform hover:scale-105"
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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndSortedTables.map((table) => (
                <div
                  key={table.id}
                  className={`border-2 rounded-xl p-5 hover:shadow-xl transition-all ${
                    selectedTables.has(table.id!)
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedTables.has(table.id!)}
                        onChange={() => toggleTableSelection(table.id!)}
                        className="w-4 h-4"
                        disabled={editingRow !== null}
                      />
                      <div className="text-2xl">
                        {table.physical_table_name ? "📊" : "📝"}
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        table.physical_table_name
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {table.physical_table_name ? "Deployed" : "Draft"}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">
                    {table.name}
                  </h4>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {table.description || "No description"}
                  </p>
                  <div className="text-xs text-gray-400 mb-4">
                    {table.created_at
                      ? new Date(table.created_at).toLocaleDateString()
                      : "-"}
                  </div>
                  <button
                    onClick={() => setEditingTable(table)}
                    className="w-full px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition transform hover:scale-105"
                    disabled={editingRow !== null}
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
          showNotification={showNotification}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
