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

export function buildCreateTableSQL(
  physicalName: string,
  columns: ColumnDefinition[]
) {
  const colsSql = columns
    .map((c) => {
      const colName = sanitizeIdentifier(c.name.toLowerCase());
      const sqlType = mapColumnTypeToSql(c.type);
      const notNull = c.required ? "NOT NULL" : "";
      const defaultClause = c.defaultValue
        ? `DEFAULT '${c.defaultValue.replace("'", "''")}'`
        : "";
      return `\"${colName}\" ${sqlType} ${defaultClause} ${notNull}`.trim();
    })
    .join(",\n  ");

  const sql = `CREATE TABLE IF NOT EXISTS \"${sanitizeIdentifier(
    physicalName
  )}\" (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  ${colsSql},\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n);`;
  return sql;
}

export function buildAddColumnSQL(
  physicalName: string,
  column: ColumnDefinition
) {
  const colName = sanitizeIdentifier(column.name.toLowerCase());
  const sqlType = mapColumnTypeToSql(column.type);
  const notNull = column.required ? "NOT NULL" : "";
  const defaultClause = column.defaultValue
    ? `DEFAULT '${column.defaultValue.replace("'", "''")}'`
    : "";
  return `ALTER TABLE IF EXISTS \"${sanitizeIdentifier(
    physicalName
  )}\" ADD COLUMN IF NOT EXISTS \"${colName}\" ${sqlType} ${defaultClause} ${notNull};`;
}

export function buildRenameColumnSQL(
  physicalName: string,
  oldName: string,
  newName: string
) {
  return `ALTER TABLE \"${sanitizeIdentifier(
    physicalName
  )}\" RENAME COLUMN \"${sanitizeIdentifier(
    oldName
  )}\" TO \"${sanitizeIdentifier(newName)}\";`;
}

export function buildChangeTypeSQL(
  physicalName: string,
  colName: string,
  newType: string
) {
  return `ALTER TABLE \"${sanitizeIdentifier(
    physicalName
  )}\" ALTER COLUMN \"${sanitizeIdentifier(
    colName
  )}\" TYPE ${mapColumnTypeToSql(newType)};`;
}

export function buildSetRequiredSQL(
  physicalName: string,
  colName: string,
  required: boolean
) {
  return `ALTER TABLE \"${sanitizeIdentifier(
    physicalName
  )}\" ALTER COLUMN \"${sanitizeIdentifier(colName)}\" ${
    required ? "SET NOT NULL" : "DROP NOT NULL"
  };`;
}

export function buildSetDefaultSQL(
  physicalName: string,
  colName: string,
  defaultValue: string | null
) {
  if (defaultValue === null) {
    return `ALTER TABLE \"${sanitizeIdentifier(
      physicalName
    )}\" ALTER COLUMN \"${sanitizeIdentifier(colName)}\" DROP DEFAULT;`;
  } else {
    return `ALTER TABLE \"${sanitizeIdentifier(
      physicalName
    )}\" ALTER COLUMN \"${sanitizeIdentifier(
      colName
    )}\" SET DEFAULT '${defaultValue.replace("'", "''")}';`;
  }
}

export function buildDropColumnSQL(physicalName: string, colName: string) {
  return `ALTER TABLE \"${sanitizeIdentifier(
    physicalName
  )}\" DROP COLUMN IF EXISTS \"${sanitizeIdentifier(colName)}\";`;
}
