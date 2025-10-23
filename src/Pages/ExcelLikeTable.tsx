import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import type { User as UserType } from "../types/type";

interface Props {
  currentUser: UserType;
  showNotification: (
    type: "success" | "error" | "warning",
    message: string
  ) => void;
}

interface TableData {
  id: string;
  [key: string]: any;
}

interface ColumnDefinition {
  name: string;
  type: string;
}

interface CustomTable {
  id: string;
  name: string;
  physical_table_name: string | null;
}

const ExcelLikeTable: React.FC<Props> = ({ currentUser, showNotification }) => {
  const [tableName, setTableName] = useState("");
  const [numRows, setNumRows] = useState<number>(0);
  const [numCols, setNumCols] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"list" | "create" | "edit">("list");
  const [tables, setTables] = useState<CustomTable[]>([]);
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [data, setData] = useState<TableData[]>([]);
  const [pendingChanges, setPendingChanges] = useState<{
    [rowId: string]: { [colName: string]: string };
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [physicalTableName, setPhysicalTableName] = useState<string | null>(
    null
  );
  const [tableId, setTableId] = useState<string | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(
    null
  );

  // Fetch existing tables on mount
  useEffect(() => {
    const fetchTables = async () => {
      setIsLoading(true);
      try {
        const { data: tableData, error } = await supabase
          .from("custom_tables")
          .select("id, name, physical_table_name")
          .eq("created_by", currentUser.id);
        if (error) throw error;

        // Filter out tables with null physical_table_name
        const validTables = (tableData || []).filter(
          (t) => t.physical_table_name != null
        ) as CustomTable[];
        setTables(validTables);

        if (
          tableData &&
          tableData.some((t) => t.physical_table_name === null)
        ) {
          console.warn(
            "Some tables have null physical_table_name - they won't be loadable:",
            tableData.filter((t) => t.physical_table_name === null)
          );
          showNotification(
            "warning",
            "Some tables have issues (null physical name). Check console for details."
          );
        }
      } catch (error: any) {
        console.error("Fetch tables error:", error);
        showNotification("error", `Failed to fetch tables: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTables();
  }, [currentUser.id, showNotification]);

  const sanitizeIdentifier = (name: string) => {
    return name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
  };

  const mapColumnTypeToSql = (type: string) => {
    return "TEXT"; // Default to TEXT for simplicity
  };

  const buildCreateTableSQL = (
    physicalTableName: string,
    cols: ColumnDefinition[]
  ) => {
    const colsSql = cols
      .map(
        (c) => `"${sanitizeIdentifier(c.name)}" ${mapColumnTypeToSql(c.type)}`
      )
      .join(",\n  ");
    return `CREATE TABLE IF NOT EXISTS "${sanitizeIdentifier(
      physicalTableName
    )}" (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  ${colsSql},\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n);`;
  };

  const buildAddColumnSQL = (
    physicalTableName: string,
    column: ColumnDefinition
  ) => {
    return `ALTER TABLE "${sanitizeIdentifier(
      physicalTableName
    )}" ADD COLUMN IF NOT EXISTS "${sanitizeIdentifier(
      column.name
    )}" ${mapColumnTypeToSql(column.type)};`;
  };

  const buildDropColumnSQL = (physicalTableName: string, colName: string) => {
    return `ALTER TABLE "${sanitizeIdentifier(
      physicalTableName
    )}" DROP COLUMN IF EXISTS "${sanitizeIdentifier(colName)}";`;
  };

  const buildDropTableSQL = (physicalTableName: string) => {
    return `DROP TABLE IF EXISTS "${sanitizeIdentifier(physicalTableName)}";`;
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) {
      showNotification("error", "Table name is required");
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(tableName.trim())) {
      showNotification(
        "error",
        "Table name must start with a letter and contain only letters, numbers, and underscores"
      );
      return;
    }
    if (numRows < 0 || numCols < 0) {
      showNotification("error", "Rows and columns must be non-negative");
      return;
    }

    setIsLoading(true);
    try {
      // Create columns
      const newColumns: ColumnDefinition[] = Array.from(
        { length: numCols },
        (_, i) => ({
          name: `column_${i + 1}`,
          type: "text",
        })
      );
      setColumns(newColumns);

      // Create table metadata
      const physicalTableName = sanitizeIdentifier(
        `${tableName}_${currentUser.id}`
      );
      const { data: tableData, error: tableError } = await supabase
        .from("custom_tables")
        .insert([
          {
            name: tableName.trim(),
            created_by: currentUser.id,
            physical_table_name: physicalTableName,
            provider_can_view: false,
            user_can_view: false,
          },
        ])
        .select()
        .single();
      if (tableError) throw tableError;

      // Debug: Log inserted data
      console.log("Inserted table data:", tableData);
      if (!tableData.physical_table_name) {
        throw new Error(
          "physical_table_name is null after insert - check schema/RLS!"
        );
      }

      // Store the table ID and physical table name
      const newTableId = tableData.id;
      setTableId(newTableId);
      setPhysicalTableName(physicalTableName);
      setSelectedTableName(tableName.trim());

      // Create physical table
      const sql = buildCreateTableSQL(physicalTableName, newColumns);
      const { error: sqlError } = await supabase.rpc("execute_sql", { sql });
      if (sqlError) throw sqlError;

      // Insert initial rows
      const initialData: TableData[] = [];
      for (let i = 0; i < numRows; i++) {
        const row: TableData = { id: `temp-${i}` };
        newColumns.forEach((col) => {
          row[col.name] = "";
        });
        initialData.push(row);

        const { data: insertedRow, error: insertError } = await supabase
          .from(physicalTableName)
          .insert([{}])
          .select()
          .single();
        if (insertError) throw insertError;
        initialData[i].id = insertedRow.id;
      }

      setData(initialData);

      // Insert column definitions
      for (const col of newColumns) {
        const { error: colError } = await supabase
          .from("custom_columns")
          .insert([{ table_id: newTableId, name: col.name, type: col.type }]);
        if (colError) throw colError;
      }

      // Refresh table list and switch to edit
      setTables((prev) => [
        ...prev,
        {
          id: newTableId,
          name: tableName.trim(),
          physical_table_name: physicalTableName,
        },
      ]);
      setViewMode("edit");
      setTableName("");
      setNumRows(0);
      setNumCols(0);
      showNotification("success", "Table created successfully! 🎉");
    } catch (error: any) {
      console.error("Create table error:", error);
      showNotification("error", `Failed to create table: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTable = async (table: CustomTable) => {
    if (
      !confirm(
        `Are you sure you want to delete table "${table.name}"? This cannot be undone.`
      )
    )
      return;
    if (!table.physical_table_name) {
      showNotification(
        "error",
        `Cannot delete table "${table.name}" due to missing physical name.`
      );
      return;
    }

    setIsLoading(true);
    try {
      // Drop the physical table
      const sql = buildDropTableSQL(table.physical_table_name);
      const { error: sqlError } = await supabase.rpc("execute_sql", { sql });
      if (sqlError) throw sqlError;

      // Delete column definitions
      const { error: colError } = await supabase
        .from("custom_columns")
        .delete()
        .eq("table_id", table.id);
      if (colError) throw colError;

      // Delete table metadata
      const { error: tableError } = await supabase
        .from("custom_tables")
        .delete()
        .eq("id", table.id);
      if (tableError) throw tableError;

      // Update UI
      setTables(tables.filter((t) => t.id !== table.id));
      if (tableId === table.id) {
        setViewMode("list");
        setTableId(null);
        setPhysicalTableName(null);
        setSelectedTableName(null);
        setColumns([]);
        setData([]);
        setPendingChanges({});
      }
      showNotification(
        "success",
        `Table "${table.name}" deleted successfully!`
      );
    } catch (error: any) {
      console.error("Delete table error:", error);
      showNotification(
        "error",
        `Failed to delete table "${table.name}": ${error.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTable = async (table: CustomTable) => {
    if (!table.physical_table_name) {
      showNotification(
        "error",
        `Table "${table.name}" has invalid configuration (missing physical name). Skipping.`
      );
      return;
    }

    setIsLoading(true);
    try {
      console.log(
        `Loading table: ${table.name} (physical: ${table.physical_table_name})`
      );

      // Fetch columns
      const { data: columnData, error: colError } = await supabase
        .from("custom_columns")
        .select("name, type")
        .eq("table_id", table.id);
      if (colError) throw colError;

      // Fetch table data
      const { data: tableData, error: dataError } = await supabase
        .from(table.physical_table_name)
        .select("*");
      if (dataError) throw dataError;

      setTableId(table.id);
      setPhysicalTableName(table.physical_table_name);
      setSelectedTableName(table.name);
      setColumns(columnData || []);
      setData(tableData || []);
      setPendingChanges({});
      setViewMode("edit");
    } catch (error: any) {
      console.error("Load table error:", error);
      showNotification(
        "error",
        `Failed to load table "${table.name}": ${error.message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddColumn = async () => {
    if (!physicalTableName || !tableId) return;
    const newColName = `column_${columns.length + 1}`;
    const newColumn: ColumnDefinition = { name: newColName, type: "text" };

    setIsLoading(true);
    try {
      // Add to custom_columns
      const { error: colError } = await supabase
        .from("custom_columns")
        .insert([{ table_id: tableId, name: newColName, type: "text" }]);
      if (colError) throw colError;

      // Add to physical table
      const sql = buildAddColumnSQL(physicalTableName, newColumn);
      const { error: sqlError } = await supabase.rpc("execute_sql", { sql });
      if (sqlError) throw sqlError;

      setColumns([...columns, newColumn]);
      setData(data.map((row) => ({ ...row, [newColName]: "" })));
      showNotification("success", "Column added successfully!");
    } catch (error: any) {
      showNotification("error", `Failed to add column: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteColumn = async (colName: string) => {
    if (!confirm(`Are you sure you want to delete column ${colName}?`)) return;
    if (!physicalTableName || !tableId) return;

    setIsLoading(true);
    try {
      // Delete from custom_columns
      const { error: colError } = await supabase
        .from("custom_columns")
        .delete()
        .eq("table_id", tableId)
        .eq("name", colName);
      if (colError) throw colError;

      // Delete from physical table
      const sql = buildDropColumnSQL(physicalTableName, colName);
      const { error: sqlError } = await supabase.rpc("execute_sql", { sql });
      if (sqlError) throw sqlError;

      setColumns(columns.filter((col) => col.name !== colName));
      setData(
        data.map((row) => {
          const { [colName]: _, ...rest } = row;
          return {
            ...rest,
            id: row.id, // make sure id stays
          };
        })
      );
      setPendingChanges((prev) => {
        const newChanges = { ...prev };
        Object.keys(newChanges).forEach((rowId) => {
          delete newChanges[rowId][colName];
          if (Object.keys(newChanges[rowId]).length === 0) {
            delete newChanges[rowId];
          }
        });
        return newChanges;
      });
      showNotification("success", "Column deleted successfully!");
    } catch (error: any) {
      showNotification("error", `Failed to delete column: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRow = async () => {
    if (!physicalTableName) return;

    setIsLoading(true);
    try {
      const newRow: TableData = { id: `temp-${data.length}` };
      columns.forEach((col) => {
        newRow[col.name] = "";
      });

      const { data: insertedRow, error } = await supabase
        .from(physicalTableName)
        .insert([{}])
        .select()
        .single();
      if (error) throw error;

      newRow.id = insertedRow.id;
      setData([...data, newRow]);
      showNotification("success", "Row added successfully!");
    } catch (error: any) {
      showNotification("error", `Failed to add row: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!confirm("Are you sure you want to delete this row?")) return;
    if (!physicalTableName) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from(physicalTableName)
        .delete()
        .eq("id", rowId);
      if (error) throw error;

      setData(data.filter((row) => row.id !== rowId));
      setPendingChanges((prev) => {
        const newChanges = { ...prev };
        delete newChanges[rowId];
        return newChanges;
      });
      showNotification("success", "Row deleted successfully!");
    } catch (error: any) {
      showNotification("error", `Failed to delete row: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCellChange = (rowId: string, colName: string, value: string) => {
    setData((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, [colName]: value } : row))
    );
    setPendingChanges((prev) => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [colName]: value,
      },
    }));
  };

  const handleSaveChanges = async () => {
    if (!physicalTableName || Object.keys(pendingChanges).length === 0) return;

    setIsLoading(true);
    try {
      for (const rowId of Object.keys(pendingChanges)) {
        const updates = pendingChanges[rowId];
        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from(physicalTableName)
            .update(updates)
            .eq("id", rowId);
          if (error) throw error;
        }
      }
      setPendingChanges({});
      showNotification("success", "Changes saved successfully!");
    } catch (error: any) {
      showNotification("error", `Failed to save changes: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter valid tables for display
  const validTables = tables.filter((t) => t.physical_table_name != null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {viewMode === "list" ? (
          <div className="bg-white shadow-lg rounded-xl p-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Your Tables
            </h2>
            {validTables.length === 0 ? (
              <p className="text-gray-500">
                No valid tables found. Create a new one!
              </p>
            ) : (
              <ul className="space-y-2">
                {validTables.map((table) => (
                  <li
                    key={table.id}
                    className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                  >
                    <span className="text-gray-700">{table.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSelectTable(table)}
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        View/Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTable(table)}
                        disabled={isLoading}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {tables.length > validTables.length && (
              <p className="text-red-500 text-sm mt-2">
                ⚠️ {tables.length - validTables.length} table(s) skipped due to
                missing physical name.
              </p>
            )}
            <button
              onClick={() => setViewMode("create")}
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Create New Table
            </button>
          </div>
        ) : viewMode === "create" ? (
          <div className="bg-white shadow-lg rounded-xl p-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Create New Table
            </h2>
            <form onSubmit={handleCreateTable} className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Table Name *
                  </label>
                  <input
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-lg shadow-sm py-2 px-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="e.g., my_table"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use lowercase, underscores, start with a letter
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Number of Columns
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={numCols}
                    onChange={(e) => setNumCols(parseInt(e.target.value) || 0)}
                    className="w-full border-2 border-gray-300 rounded-lg shadow-sm py-2 px-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="e.g., 5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Number of Rows
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={numRows}
                    onChange={(e) => setNumRows(parseInt(e.target.value) || 0)}
                    className="w-full border-2 border-gray-300 rounded-lg shadow-sm py-2 px-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    placeholder="e.g., 10"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg shadow-lg hover:shadow-xl font-semibold transition-all ${
                    isLoading
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:scale-[1.02]"
                  }`}
                >
                  {isLoading ? "Creating..." : "Create Table"}
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Back to List
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white shadow-lg rounded-xl p-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {selectedTableName}
            </h2>
            <div className="flex gap-4 mb-4">
              <button
                onClick={handleAddColumn}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                + Add Column
              </button>
              <button
                onClick={handleAddRow}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                + Add Row
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={isLoading || Object.keys(pendingChanges).length === 0}
                className={`px-4 py-2 bg-purple-600 text-white rounded-lg transition ${
                  isLoading || Object.keys(pendingChanges).length === 0
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-purple-700"
                }`}
              >
                Save Changes ({Object.keys(pendingChanges).length} pending)
              </button>
              <button
                onClick={() => setViewMode("list")}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Back to List
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max table-auto border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.name}
                        className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border relative group"
                      >
                        {col.name}
                        <button
                          onClick={() => handleDeleteColumn(col.name)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-red-600 opacity-0 group-hover:opacity-100 transition"
                          title="Delete Column"
                        >
                          🗑️
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 border">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.id} className="border-t hover:bg-gray-50">
                      {columns.map((col) => (
                        <td key={col.name} className="px-4 py-2 border">
                          <input
                            type="text"
                            value={row[col.name] ?? ""}
                            onChange={(e) =>
                              handleCellChange(row.id, col.name, e.target.value)
                            }
                            className="w-full border border-gray-300 rounded px-2 py-1 focus:border-blue-500"
                          />
                        </td>
                      ))}
                      <td className="px-4 py-2 border">
                        <button
                          onClick={() => handleDeleteRow(row.id)}
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
    </div>
  );
};

export default ExcelLikeTable;
