import type { ColumnDefinition } from "../components/CustomTableEditor";

export const mapColumnTypeToSql = (type: string) => {
  switch (type) {
    case "number":
      return "NUMERIC";
    case "boolean":
      return "BOOLEAN";
    case "date":
      return "TIMESTAMP WITH TIME ZONE";
    case "json":
      return "JSONB";
    case "uuid":
      return "UUID";
    case "text":
    case "email":
    case "url":
    case "phone":
    default:
      return "TEXT";
  }
};

export function sanitizeIdentifier(name: string) {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

// supabaseSchemaService.ts

export const buildCreateTableSQL = (
  physicalTableName: string,
  cols: ColumnDefinition[]
) => {
  const colsSql = cols
    .map(
      (c) =>
        `"${sanitizeIdentifier(c.name)}" ${mapColumnTypeToSql(c.type)}${
          c.required ? " NOT NULL" : ""
        }${
          c.defaultValue
            ? ` DEFAULT ${
                c.type === "text" || c.type === "json"
                  ? `'${c.defaultValue.replace(/'/g, "''")}'`
                  : c.defaultValue
              }`
            : ""
        }`
    )
    .join(",\n  ");
  return `CREATE TABLE IF NOT EXISTS "${sanitizeIdentifier(
    physicalTableName
  )}" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ${colsSql},
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
); NOTIFY pgrst, 'reload schema';`;
};

export const buildAddColumnSQL = (
  physicalTableName: string,
  column: ColumnDefinition
) => {
  return `ALTER TABLE "${sanitizeIdentifier(
    physicalTableName
  )}" ADD COLUMN IF NOT EXISTS "${sanitizeIdentifier(
    column.name
  )}" ${mapColumnTypeToSql(column.type)}${column.required ? " NOT NULL" : ""}${
    column.defaultValue
      ? ` DEFAULT ${
          column.type === "text" || column.type === "json"
            ? `'${column.defaultValue.replace(/'/g, "''")}'`
            : column.defaultValue
        }`
      : ""
  }; NOTIFY pgrst, 'reload schema';`;
};

export const buildRenameColumnSQL = (
  physicalTableName: string,
  oldName: string,
  newName: string
) => {
  return `ALTER TABLE "${sanitizeIdentifier(
    physicalTableName
  )}" RENAME COLUMN "${sanitizeIdentifier(oldName)}" TO "${sanitizeIdentifier(
    newName
  )}"; NOTIFY pgrst, 'reload schema';`;
};

export const buildChangeTypeSQL = (
  physicalTableName: string,
  colName: string,
  newType: string
) => {
  return `ALTER TABLE "${sanitizeIdentifier(
    physicalTableName
  )}" ALTER COLUMN "${sanitizeIdentifier(colName)}" TYPE ${mapColumnTypeToSql(
    newType
  )} USING "${sanitizeIdentifier(colName)}" :: ${mapColumnTypeToSql(
    newType
  )}; NOTIFY pgrst, 'reload schema';`;
};

export const buildSetRequiredSQL = (
  physicalTableName: string,
  colName: string,
  required: boolean
) => {
  return `ALTER TABLE "${sanitizeIdentifier(
    physicalTableName
  )}" ALTER COLUMN "${sanitizeIdentifier(colName)}" ${
    required ? "SET" : "DROP"
  } NOT NULL; NOTIFY pgrst, 'reload schema';`;
};

export const buildSetDefaultSQL = (
  physicalTableName: string,
  colName: string,
  defaultValue: string | null,
  colType: string // ✅ pass actual column type
) => {
  let defaultSql = "DROP DEFAULT";

  if (
    defaultValue !== null &&
    defaultValue !== undefined &&
    defaultValue !== ""
  ) {
    if (colType === "text" || colType === "json") {
      defaultSql = `SET DEFAULT '${defaultValue.replace(/'/g, "''")}'`;
    } else {
      defaultSql = `SET DEFAULT ${defaultValue}`;
    }
  }

  return `ALTER TABLE "${sanitizeIdentifier(
    physicalTableName
  )}" ALTER COLUMN "${sanitizeIdentifier(
    colName
  )}" ${defaultSql}; NOTIFY pgrst, 'reload schema';`;
};

export function buildDropColumnSQL(physicalName: string, colName: string) {
  return `ALTER TABLE \"${sanitizeIdentifier(
    physicalName
  )}\" DROP COLUMN IF EXISTS \"${sanitizeIdentifier(colName)}\";`;
}
