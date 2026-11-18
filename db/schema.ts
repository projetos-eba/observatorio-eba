import { sql } from "drizzle-orm";
import {
  uniqueIndex,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const collections = [
  "records",
  "tests",
  "insights",
  "settings",
] as const;

export const storeEntries = sqliteTable(
  "store_entries",
  {
    collection: text("collection", { enum: collections }).notNull(),
    id: text("id").notNull(),
    data: text("data", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull(),
    revision: integer("revision").notNull(),
  },
  (table) => [primaryKey({ columns: [table.collection, table.id] })],
);

export const crmMembers = sqliteTable("crm_members", {
  id: text().primaryKey(),
  name: text().notNull(),
});
export const crmCompanies = sqliteTable("crm_companies", {
  id: text().primaryKey(),
  name: text().notNull(),
});
export const crmContacts = sqliteTable(
  "crm_contacts",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    phone: text().notNull(),
    email: text().notNull(),
  },
  (t) => [
    uniqueIndex("crm_contact_email")
      .on(t.email)
      .where(sql`email <> ''`),
    uniqueIndex("crm_contact_phone")
      .on(t.phone)
      .where(sql`phone <> ''`),
  ],
);
export const crmDeals = sqliteTable("crm_deals", {
  id: text().primaryKey(),
  company: text().references(() => crmCompanies.id),
  contact: text().references(() => crmContacts.id),
  owner: text()
    .notNull()
    .references(() => crmMembers.id),
  stage: text().notNull(),
  status: text().notNull(),
  source: text().notNull(),
  service: text().notNull(),
  goal: text().notNull(),
  monthly: integer(),
  once: integer(),
  next: text().notNull(),
  due: text().notNull(),
  reason: text().notNull(),
  revision: integer().notNull(),
  updated: text().notNull(),
});
export const crmPeople = sqliteTable(
  "crm_people",
  {
    deal: text()
      .notNull()
      .references(() => crmDeals.id),
    contact: text()
      .notNull()
      .references(() => crmContacts.id),
  },
  (t) => [primaryKey({ columns: [t.deal, t.contact] })],
);
export const crmActivities = sqliteTable(
  "crm_activities",
  {
    id: text().primaryKey(),
    deal: text()
      .notNull()
      .references(() => crmDeals.id),
    revision: integer().notNull(),
    author: text()
      .notNull()
      .references(() => crmMembers.id),
    kind: text().notNull(),
    note: text().notNull(),
    at: text().notNull(),
  },
  (t) => [uniqueIndex("crm_activity_revision").on(t.deal, t.revision)],
);
export const crmAccounts = sqliteTable("crm_accounts", {
  company: text()
    .primaryKey()
    .references(() => crmCompanies.id),
  since: text().notNull(),
});
export const crmHandoffs = sqliteTable("crm_handoffs", {
  deal: text()
    .primaryKey()
    .references(() => crmDeals.id),
  company: text()
    .notNull()
    .references(() => crmAccounts.company),
  lead: text()
    .notNull()
    .references(() => crmMembers.id),
  scope: text().notNull(),
  terms: text().notNull(),
  first: text().notNull(),
  date: text().notNull(),
});
