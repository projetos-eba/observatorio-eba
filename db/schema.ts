import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const collections = ["records", "tests", "insights", "settings"] as const;

export const storeEntries = sqliteTable(
  "store_entries",
  {
    collection: text("collection", { enum: collections }).notNull(),
    id: text("id").notNull(),
    data: text("data", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    revision: integer("revision").notNull(),
  },
  (table) => [primaryKey({ columns: [table.collection, table.id] })],
);
