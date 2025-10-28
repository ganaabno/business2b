import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import type { User as UserType } from "../types/type";
import {
  buildCreateTableSQL,
  buildAddColumnSQL,
  buildRenameColumnSQL,
  buildChangeTypeSQL,
  buildSetRequiredSQL,
  buildSetDefaultSQL,
  buildDropColumnSQL,
  sanitizeIdentifier,
  mapColumnTypeToSql,
} from "../services/supabaseSchemaService";

export interface ColumnDefinition {
  id?: number;
  table_id: number;
  name: string;
  type: string;
  required: boolean;
  created_at?: string;
  defaultValue?: string | null;
}

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
  tableMeta: CustomTable;
  onClose: () => void;
  showNotification: (
    type: "success" | "error" | "warning",
    message: string
  ) => void;
  currentUser: UserType;
}

type ColumnType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "email"
  | "url"
  | "phone"
  | "json"
  | "uuid";

const COLUMN_TYPES: {
  value: ColumnType;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    value: "text",
    label: "Text",
    icon: "📝",
    description: "Short or long text",
  },
  {
    value: "number",
    label: "Number",
    icon: "🔢",
    description: "Integer or decimal",
  },
  {
    value: "boolean",
    label: "Boolean",
    icon: "✓✗",
    description: "True or false",
  },
  { value: "date", label: "Date", icon: "📅", description: "Date and time" },
  { value: "email", label: "Email", icon: "📧", description: "Email address" },
  { value: "url", label: "URL", icon: "🔗", description: "Web link" },
  { value: "phone", label: "Phone", icon: "📱", description: "Phone number" },
  { value: "json", label: "JSON", icon: "{ }", description: "JSON object" },
  {
    value: "uuid",
    label: "UUID",
    icon: "🆔",
    description: "Unique identifier",
  },
];

export default function CustomTableEditor({
  tableMeta,
  onClose,
  showNotification,
  currentUser,
}: Props) {
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<ColumnType>("text");
  const [newColumnRequired, setNewColumnRequired] = useState(false);
  const [newColumnDefault, setNewColumnDefault] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [editingColumn, setEditingColumn] = useState<ColumnDefinition | null>(
    null
  );
  const [originalColumn, setOriginalColumn] = useState<ColumnDefinition | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<ColumnType | "all">("all");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [data, setData] = useState<any[]>([]);

  // Fetch columns and data on mount
  useEffect(() => {
    fetchColumns();
    if (tableMeta.physical_table_name) {
      fetchData();
    }

    // Set up subscription for custom_columns
    const channel = supabase
      .channel(`custom_columns_changes_${tableMeta.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "custom_columns",
          filter: `table_id=eq.${tableMeta.id}`,
        },
        (payload) => {
          console.log("Custom columns change:", payload);
          fetchColumns();
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.error("Custom columns subscription error:", error);
          showNotification(
            "error",
            `Real-time columns subscription failed: ${error.message}`
          );
        }
        console.log("Custom columns subscription status:", status);
      });

    return () => {
      console.log("Cleaning up custom_columns subscription");
      supabase.removeChannel(channel);
    };
  }, [tableMeta.id, tableMeta.physical_table_name, showNotification]);

  const fetchColumns = async () => {
    try {
      const { data, error } = await supabase
        .from("custom_columns")
        .select("*")
        .eq("table_id", tableMeta.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Fetch columns error:", error);
        throw error;
      }
      setColumns(data || []);
    } catch (error: any) {
      console.error("Fetch columns error:", error);
      showNotification("error", `Failed to fetch columns: ${error.message}`);
    }
  };

  const fetchData = async () => {
    if (!tableMeta.physical_table_name) return;
    setIsLoading(true);
    try {
      const { data: d, error } = await supabase
        .from(tableMeta.physical_table_name)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Fetch data error:", error);
        throw error;
      }
      setData(d || []);
    } catch (error: any) {
      console.error("Fetch data error:", error);
      showNotification("error", `Failed to fetch data: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredColumns = useMemo(() => {
    return columns.filter((col) => {
      const matchesSearch = col.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesType = filterType === "all" || col.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [columns, searchQuery, filterType]);

  const columnStats = useMemo(() => {
    const typeCount = columns.reduce((acc, col) => {
      acc[col.type] = (acc[col.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      total: columns.length,
      required: columns.filter((c) => c.required).length,
      optional: columns.filter((c) => !c.required).length,
      typeCount,
    };
  }, [columns]);

  const columnTypesMap = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.name, c.type])),
    [columns]
  );

  const handleDeploy = async () => {
    if (columns.length === 0) {
      showNotification("error", "Add at least one column before deploying");
      return;
    }
    setIsLoading(true);
    try {
      const physicalName = sanitizeIdentifier(
        `${tableMeta.name.toLowerCase()}_${currentUser.id}`
      );
      const sql = buildCreateTableSQL(physicalName, columns);
      const { error: sqlError } = await supabase.rpc("execute_sql", { sql });
      if (sqlError) {
        console.error("Create table SQL error:", sqlError);
        throw sqlError;
      }

      // Update custom_tables with physical_table_name
      const { error: updateError } = await supabase
        .from("custom_tables")
        .update({ physical_table_name: physicalName })
        .eq("id", tableMeta.id)
        .eq("created_by", currentUser.id); // Ensure RLS compliance
      if (updateError) {
        console.error("Update physical_table_name error:", updateError);
        throw updateError;
      }

      // Verify the update
      const { data: updatedTable, error: fetchError } = await supabase
        .from("custom_tables")
        .select("physical_table_name")
        .eq("id", tableMeta.id)
        .single();
      if (fetchError || !updatedTable?.physical_table_name) {
        console.error(
          "Verification failed: physical_table_name is null or fetch error:",
          fetchError
        );
        throw new Error(
          "physical_table_name not set after update. Check RLS policies."
        );
      }

      // Insert initial rows
      const initialRows = tableMeta.initial_rows || 0;
      if (initialRows > 0) {
        const inserts = Array(initialRows).fill({});
        const { error: insertError } = await supabase
          .from(physicalName)
          .insert(inserts);
        if (insertError) {
          console.error("Insert initial rows error:", insertError);
          throw insertError;
        }
      }

      showNotification("success", "Table deployed successfully! 🎉");
      onClose();
    } catch (error: any) {
      console.error("Deploy error:", error);
      showNotification("error", `Failed to deploy table: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnName.trim()) {
      showNotification("error", "Column name is required");
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(newColumnName.trim())) {
      showNotification(
        "error",
        "Column name must start with a letter and contain only letters, numbers, and underscores"
      );
      return;
    }
    if (
      columns.some(
        (c) => c.name.toLowerCase() === newColumnName.trim().toLowerCase()
      )
    ) {
      showNotification("error", "A column with this name already exists");
      return;
    }

    setIsLoading(true);
    try {
      const payload: Partial<ColumnDefinition> = {
        table_id: tableMeta.id!,
        name: newColumnName.trim(),
        type: newColumnType,
        required: newColumnRequired,
        defaultValue: newColumnDefault.trim() || undefined,
      };

      const { error: insertError } = await supabase
        .from("custom_columns")
        .insert([payload]);
      if (insertError) {
        console.error("Insert column error:", insertError);
        throw insertError;
      }

      if (tableMeta.physical_table_name) {
        const sql = buildAddColumnSQL(
          tableMeta.physical_table_name,
          payload as ColumnDefinition
        );
        const { error: sqlError } = await supabase.rpc("execute_sql", { sql });
        if (sqlError) {
          console.error("Add column SQL error:", sqlError);
          throw sqlError;
        }
      }

      setNewColumnName("");
      setNewColumnType("text");
      setNewColumnRequired(false);
      setNewColumnDefault("");
      setShowAdvanced(false);
      showNotification("success", "Column added successfully! 🎉");
      fetchColumns();
      if (tableMeta.physical_table_name) fetchData();
    } catch (error: any) {
      console.error("Add column error:", error);
      showNotification("error", `Failed to add column: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateColumn = async (column: ColumnDefinition) => {
    if (!column.id) {
      showNotification("error", "Column ID is missing");
      return;
    }
    try {
      const updates: Partial<ColumnDefinition> = {
        name: column.name,
        type: column.type,
        required: column.required,
        defaultValue: column.defaultValue,
      };
      const { error } = await supabase
        .from("custom_columns")
        .update(updates)
        .eq("id", column.id)
        .eq("table_id", tableMeta.id); // Ensure RLS compliance
      if (error) {
        console.error("Update column error:", error);
        throw error;
      }

      if (tableMeta.physical_table_name && originalColumn) {
        const sqls: string[] = [];
        if (column.name !== originalColumn.name) {
          sqls.push(
            buildRenameColumnSQL(
              tableMeta.physical_table_name,
              originalColumn.name,
              column.name
            )
          );
        }
        if (column.type !== originalColumn.type) {
          sqls.push(
            buildChangeTypeSQL(
              tableMeta.physical_table_name,
              column.name,
              column.type
            )
          );
        }
        if (column.required !== originalColumn.required) {
          sqls.push(
            buildSetRequiredSQL(
              tableMeta.physical_table_name,
              column.name,
              column.required
            )
          );
        }
        if (column.defaultValue !== originalColumn.defaultValue) {
          sqls.push(
            buildSetDefaultSQL(
              tableMeta.physical_table_name,
              column.name,
              column.defaultValue || "",
              column.type
            )
          );
        }
        for (const sql of sqls) {
          const { error: sqlError } = await supabase.rpc("execute_sql", {
            sql,
          });
          if (sqlError) {
            console.error("Update column SQL error:", sqlError);
            throw sqlError;
          }
        }
      }

      showNotification("success", "Column updated! ✓");
      setEditingColumn(null);
      setOriginalColumn(null);
      fetchColumns();
      if (tableMeta.physical_table_name) fetchData();
    } catch (error: any) {
      console.error("Update column error:", error);
      showNotification("error", `Failed to update column: ${error.message}`);
    }
  };

  const handleDeleteColumn = async (columnId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this column? This cannot be undone and will delete data if deployed."
      )
    ) {
      return;
    }
    try {
      const col = columns.find((c) => c.id === columnId);
      if (!col) {
        showNotification("error", "Column not found");
        return;
      }

      const { error: deleteError } = await supabase
        .from("custom_columns")
        .delete()
        .eq("id", columnId)
        .eq("table_id", tableMeta.id); // Ensure RLS compliance
      if (deleteError) {
        console.error("Delete column error:", deleteError);
        throw deleteError;
      }

      if (tableMeta.physical_table_name) {
        const sql = buildDropColumnSQL(tableMeta.physical_table_name, col.name);
        const { error: sqlError } = await supabase.rpc("execute_sql", { sql });
        if (sqlError) {
          console.error("Drop column SQL error:", sqlError);
          throw sqlError;
        }
      }

      showNotification("success", "Column deleted");
      fetchColumns();
      if (tableMeta.physical_table_name) fetchData();
    } catch (error: any) {
      console.error("Delete column error:", error);
      showNotification("error", `Failed to delete column: ${error.message}`);
    }
  };

  const handleDuplicateColumn = async (column: ColumnDefinition) => {
    try {
      const newColumn = {
        table_id: column.table_id,
        name: `${column.name}_copy`,
        type: column.type,
        required: column.required,
        defaultValue: column.defaultValue,
      };

      const { error: insertError } = await supabase
        .from("custom_columns")
        .insert([newColumn]);
      if (insertError) {
        console.error("Duplicate column error:", insertError);
        throw insertError;
      }

      if (tableMeta.physical_table_name) {
        const sql = buildAddColumnSQL(
          tableMeta.physical_table_name,
          newColumn as ColumnDefinition
        );
        const { error: sqlError } = await supabase.rpc("execute_sql", { sql });
        if (sqlError) {
          console.error("Add duplicated column SQL error:", sqlError);
          throw sqlError;
        }
      }

      showNotification("success", "Column duplicated! 📋");
      fetchColumns();
      if (tableMeta.physical_table_name) fetchData();
    } catch (error: any) {
      console.error("Duplicate column error:", error);
      showNotification("error", `Failed to duplicate column: ${error.message}`);
    }
  };

  const getTypeIcon = (type: string) => {
    return COLUMN_TYPES.find((t) => t.value === type)?.icon || "❓";
  };

  const getInputType = (type: string) => {
    switch (type) {
      case "number":
        return "number";
      case "date":
        return "datetime-local";
      case "email":
        return "email";
      case "url":
        return "url";
      case "phone":
        return "tel";
      default:
        return "text";
    }
  };

  const handleCellChange = (id: string, col: string, val: any) => {
    setData((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [col]: val } : r))
    );
  };

  const saveCell = async (id: string, col: string) => {
    const row = data.find((r) => r.id === id);
    if (!row) return;

    let updateVal = row[col];
    const colType = columnTypesMap[col];
    if (colType === "json") {
      try {
        updateVal = updateVal ? JSON.parse(updateVal) : null;
      } catch {
        showNotification("error", "Invalid JSON format");
        return;
      }
    }

    try {
      const { error } = await supabase
        .from(tableMeta.physical_table_name!)
        .update({ [col]: updateVal })
        .eq("id", id);
      if (error) {
        console.error("Update cell error:", error);
        throw error;
      }
    } catch (error: any) {
      console.error("Update cell error:", error);
      showNotification("error", `Failed to update cell: ${error.message}`);
    }
  };

  const addRow = async () => {
    if (!tableMeta.physical_table_name) return;
    try {
      const { error } = await supabase
        .from(tableMeta.physical_table_name)
        .insert({});
      if (error) {
        console.error("Add row error:", error);
        throw error;
      }
      fetchData();
    } catch (error: any) {
      console.error("Add row error:", error);
      showNotification("error", `Failed to add row: ${error.message}`);
    }
  };

  const deleteRow = async (id: string) => {
    if (!confirm("Are you sure you want to delete this row?")) return;
    if (!tableMeta.physical_table_name) return;
    try {
      const { error } = await supabase
        .from(tableMeta.physical_table_name)
        .delete()
        .eq("id", id);
      if (error) {
        console.error("Delete row error:", error);
        throw error;
      }
      fetchData();
    } catch (error: any) {
      console.error("Delete row error:", error);
      showNotification("error", `Failed to delete row: ${error.message}`);
    }
  };

  const startColumnEditing = (column: ColumnDefinition) => {
    setOriginalColumn(column);
    setEditingColumn({ ...column });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-3xl">⚙️</span>
                Column Editor
              </h3>
              <p className="text-indigo-100 mt-1">
                Editing table:{" "}
                <span className="font-semibold">{tableMeta.name}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition w-10 h-10 flex items-center justify-center text-xl"
            >
              ✕
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-white bg-opacity-20 rounded-lg p-3 backdrop-blur-sm">
              <div className="text-2xl font-bold">{columnStats.total}</div>
              <div className="text-sm text-indigo-100">Total Columns</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-3 backdrop-blur-sm">
              <div className="text-2xl font-bold">{columnStats.required}</div>
              <div className="text-sm text-indigo-100">Required</div>
            </div>
            <div className="bg-white bg-opacity-20 rounded-lg p-3 backdrop-blur-sm">
              <div className="text-2xl font-bold">{columnStats.optional}</div>
              <div className="text-sm text-indigo-100">Optional</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Add Column Form */}
          <div className="bg-white border-2 border-indigo-200 rounded-xl p-6 mb-6 shadow-lg">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">➕</span>
              Add New Column
            </h4>
            <form onSubmit={handleAddColumn} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Column Name *
                  </label>
                  <input
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    placeholder="e.g., email_address"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use lowercase, underscores, start with a letter
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Column Type *
                  </label>
                  <select
                    value={newColumnType}
                    onChange={(e) =>
                      setNewColumnType(e.target.value as ColumnType)
                    }
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  >
                    {COLUMN_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label} - {type.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newColumnRequired}
                    onChange={(e) => setNewColumnRequired(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Required Field
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  {showAdvanced ? "▼" : "▶"} Advanced Options
                </button>
              </div>
              {showAdvanced && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Default Value
                  </label>
                  <input
                    value={newColumnDefault}
                    onChange={(e) => setNewColumnDefault(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    placeholder="Optional default value"
                  />
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all ${
                  isLoading
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:scale-[1.02]"
                }`}
              >
                {isLoading ? "⏳ Adding Column..." : "✓ Add Column"}
              </button>
            </form>
          </div>

          {/* Search and Filter Controls */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search columns..."
                  className="w-full pl-4 pr-10 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              >
                <option value="all">All Types</option>
                {COLUMN_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.icon} {type.label}
                  </option>
                ))}
              </select>
              <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`px-4 py-2 rounded-md transition ${
                    viewMode === "cards"
                      ? "bg-white shadow text-indigo-600 font-semibold"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  🎴 Cards
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`px-4 py-2 rounded-md transition ${
                    viewMode === "table"
                      ? "bg-white shadow text-indigo-600 font-semibold"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  📊 Table
                </button>
              </div>
            </div>
          </div>

          {/* Columns Display */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">📋</span>
              Existing Columns ({filteredColumns.length})
            </h4>
            {filteredColumns.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-xl text-gray-500">
                  {searchQuery || filterType !== "all"
                    ? "No columns match your filters"
                    : "No columns defined yet"}
                </p>
                <p className="text-gray-400 mt-2">
                  Add your first column above!
                </p>
              </div>
            ) : viewMode === "cards" ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredColumns.map((column) => (
                  <div
                    key={column.id}
                    className="border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-indigo-300 transition-all bg-white"
                  >
                    {editingColumn?.id === column.id ? (
                      <div className="space-y-3">
                        <input
                          value={editingColumn?.name}
                          onChange={(e) =>
                            setEditingColumn(
                              editingColumn
                                ? { ...editingColumn, name: e.target.value }
                                : null
                            )
                          }
                          className="w-full border-2 border-gray-300 rounded px-2 py-1 text-sm"
                        />
                        <select
                          value={editingColumn?.type}
                          onChange={(e) =>
                            setEditingColumn(
                              editingColumn
                                ? { ...editingColumn, type: e.target.value }
                                : null
                            )
                          }
                          className="w-full border-2 border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {COLUMN_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.icon} {type.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              editingColumn && handleUpdateColumn(editingColumn)
                            }
                            className="flex-1 px-3 py-1 bg-green-600 text-white rounded text-sm"
                          >
                            ✓ Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingColumn(null);
                              setOriginalColumn(null);
                            }}
                            className="flex-1 px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm"
                          >
                            ✕ Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-3">
                          <div className="text-3xl">
                            {getTypeIcon(column.type)}
                          </div>
                          <div className="flex gap-1">
                            {column.required && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                                Required
                              </span>
                            )}
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                              {column.type}
                            </span>
                          </div>
                        </div>
                        <h5 className="text-lg font-bold text-gray-900 mb-1 break-words">
                          {column.name}
                        </h5>
                        {column.defaultValue && (
                          <p className="text-sm text-gray-600 mb-3">
                            Default:{" "}
                            <code className="bg-gray-100 px-2 py-0.5 rounded">
                              {column.defaultValue}
                            </code>
                          </p>
                        )}
                        <div className="text-xs text-gray-400 mb-4">
                          {column.created_at
                            ? new Date(column.created_at).toLocaleDateString()
                            : "-"}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startColumnEditing(column)}
                            className="flex-1 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 transition"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDuplicateColumn(column)}
                            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 transition"
                            title="Duplicate"
                          >
                            📋
                          </button>
                          <button
                            onClick={() => handleDeleteColumn(column.id!)}
                            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-md text-sm hover:bg-red-200 transition"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Icon
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Required
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Default
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredColumns.map((column, idx) => (
                      <tr
                        key={column.id}
                        className={`border-b border-gray-100 hover:bg-indigo-50 transition ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-3 text-2xl">
                          {getTypeIcon(column.type)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {column.name}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                            {column.type}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {column.required ? (
                            <span className="text-red-600 font-semibold">
                              ✓ Yes
                            </span>
                          ) : (
                            <span className="text-gray-400">✗ No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {column.defaultValue ? (
                            <code className="bg-gray-100 px-2 py-0.5 rounded">
                              {column.defaultValue}
                            </code>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => startColumnEditing(column)}
                              className="px-2 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 transition"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDuplicateColumn(column)}
                              className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition"
                            >
                              📋
                            </button>
                            <button
                              onClick={() => handleDeleteColumn(column.id!)}
                              className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200 transition"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Data Section */}
          {tableMeta.physical_table_name && (
            <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6 shadow">
              <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl">📊</span>
                Data Rows ({data.length})
              </h4>
              <button
                onClick={addRow}
                className="mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                + Add Row
              </button>
              <div className="overflow-x-auto">
                <table className="w-full min-w-max table-auto">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        ID
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        Created At
                      </th>
                      {columns.map((col) => (
                        <th
                          key={col.id}
                          className="px-4 py-2 text-left text-sm font-semibold text-gray-700"
                        >
                          {col.name}
                        </th>
                      ))}
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr key={row.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-500 truncate max-w-xs">
                          {row.id}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {row.created_at}
                        </td>
                        {columns.map((col) => (
                          <td key={col.name} className="px-4 py-2">
                            {col.type === "boolean" ? (
                              <input
                                type="checkbox"
                                checked={!!row[col.name]}
                                onChange={(e) =>
                                  handleCellChange(
                                    row.id,
                                    col.name,
                                    e.target.checked
                                  )
                                }
                                onBlur={() => saveCell(row.id, col.name)}
                              />
                            ) : col.type === "json" ? (
                              <textarea
                                value={
                                  row[col.name]
                                    ? JSON.stringify(row[col.name], null, 2)
                                    : ""
                                }
                                onChange={(e) =>
                                  handleCellChange(
                                    row.id,
                                    col.name,
                                    e.target.value
                                  )
                                }
                                onBlur={() => saveCell(row.id, col.name)}
                                className="w-full border border-gray-300 rounded px-2 py-1 focus:border-indigo-500 resize-y min-h-[4rem]"
                              />
                            ) : (
                              <input
                                type={getInputType(col.type)}
                                value={row[col.name] ?? ""}
                                onChange={(e) =>
                                  handleCellChange(
                                    row.id,
                                    col.name,
                                    e.target.value
                                  )
                                }
                                onBlur={() => saveCell(row.id, col.name)}
                                className="w-full border border-gray-300 rounded px-2 py-1 focus:border-indigo-500"
                              />
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-2">
                          <button
                            onClick={() => deleteRow(row.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 p-4 flex justify-between items-center">
          {!tableMeta.physical_table_name && (
            <button
              onClick={handleDeploy}
              disabled={isLoading}
              className={`px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition ${
                isLoading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isLoading ? "Deploying..." : "Deploy Table"}
            </button>
          )}
          <p className="text-sm text-gray-600">
            💡 Tip: Use descriptive column names for better organization
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
