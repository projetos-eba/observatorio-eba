import { sql } from "drizzle-orm";
import {
  index,
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
export const workspacePermissions = sqliteTable("workspace_permissions", {
  member: text().notNull().references(() => crmMembers.id),
  scope: text({ enum: ["admin", "account", "brand"] }).notNull(),
  target: text().notNull(),
  grantedBy: text().notNull().references(() => crmMembers.id),
  grantedAt: text().notNull(),
}, (t) => [primaryKey({ columns: [t.member, t.scope, t.target] })]);

export const integrationAudit = sqliteTable("integration_audit", {
  id: text().primaryKey(),
  brand: text().notNull(),
  provider: text().notNull(),
  resource: text().notNull(),
  action: text().notNull(),
  author: text().notNull().references(() => crmMembers.id),
  at: text().notNull(),
}, (t) => [index("integration_audit_history").on(t.brand, t.provider, t.at, t.id)]);
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
  proposalUrl: text(),
  goal: text().notNull(),
  monthly: integer(),
  once: integer(),
  next: text().notNull(),
  due: text().notNull(),
  reason: text().notNull(),
  revision: integer().notNull(),
  updated: text().notNull(),
}, (t) => [index("crm_deals_company_owner").on(t.company, t.owner)]);
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
    fingerprint: text(),
    enteredStage: text(),
    scheduledFor: text(),
  },
  (t) => [
    uniqueIndex("crm_activity_revision").on(t.deal, t.revision),
    index("crm_activity_kind_revision").on(t.deal, t.kind, t.revision),
    index("crm_activity_period").on(t.at, t.id),
  ],
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

export const carteiraCommands = sqliteTable("carteira_commands", {
  version: integer().primaryKey(),
  id: text().notNull().unique(),
  author: text()
    .notNull()
    .references(() => crmMembers.id),
  fingerprint: text().notNull(),
});

export const carteiraProfiles = sqliteTable("carteira_profiles", {
  company: text()
    .primaryKey()
    .references(() => crmAccounts.company),
  data: text().notNull(),
});

export const carteiraMeasures = sqliteTable(
  "carteira_measures",
  {
    company: text()
      .notNull()
      .references(() => crmAccounts.company),
    week: text().notNull(),
    version: integer()
      .notNull()
      .references(() => carteiraCommands.version),
    data: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.company, t.week, t.version] })],
);

export const carteiraDecisions = sqliteTable(
  "carteira_decisions",
  {
    id: text().notNull(),
    company: text()
      .notNull()
      .references(() => crmAccounts.company),
    version: integer()
      .notNull()
      .references(() => carteiraCommands.version),
    data: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.id, t.version] })],
);

export const carteiraAgenda = sqliteTable(
  "carteira_agenda",
  {
    week: text().notNull(),
    company: text()
      .notNull()
      .references(() => crmAccounts.company),
  },
  (t) => [primaryKey({ columns: [t.week, t.company] })],
);

export const carteiraMinutes = sqliteTable("carteira_minutes", {
  week: text().primaryKey(),
  data: text().notNull(),
});

export const hubCommands = sqliteTable("hub_commands", {
  version: integer().primaryKey(),
  id: text().notNull().unique(),
  author: text().notNull().references(() => crmMembers.id),
  fingerprint: text().notNull(),
});

export const hubEntries = sqliteTable("hub_entries", {
  brand: text().notNull(),
  kind: text().notNull(),
  id: text().notNull(),
  version: integer().notNull().references(() => hubCommands.version),
  data: text().notNull(),
}, table => [primaryKey({ columns: [table.brand, table.kind, table.id, table.version] })]);

export const integrationConnections = sqliteTable("integration_connections", {
  brand: text().notNull(),
  provider: text().notNull(),
  resource: text().notNull(),
  credential: text(),
  generation: text().notNull(),
  verifiedAt: text().notNull(),
  status: text().notNull(),
  error: text().notNull(),
  successDay: text().notNull(),
  retryAt: text().notNull(),
  attempts: integer().notNull(),
  lockId: text().notNull(),
  lockUntil: text().notNull(),
}, t => [primaryKey({ columns: [t.brand, t.provider] })]);

export const integrationResources = sqliteTable("integration_resources", {
  brand: text().notNull(),
  provider: text().notNull(),
  id: text().notNull(),
  data: text().notNull(),
  syncedAt: text().notNull(),
  fromDay: text().notNull(),
  throughDay: text().notNull(),
}, t => [primaryKey({ columns: [t.brand, t.provider, t.id] })]);

export const integrationReadings = sqliteTable("integration_readings", {
  brand: text().notNull(),
  provider: text().notNull(),
  resource: text().notNull(),
  day: text().notNull(),
  id: text().notNull(),
  data: text().notNull(),
}, t => [primaryKey({ columns: [t.brand, t.provider, t.resource, t.day, t.id] })]);

export const integrationRuns = sqliteTable("integration_runs", {
  id: text().primaryKey(),
  brand: text().notNull(),
  provider: text().notNull(),
  resource: text().notNull(),
  started: text().notNull(),
  finished: text().notNull(),
  trigger: text().notNull(),
  status: text().notNull(),
  detail: text().notNull(),
}, (t) => [index("integration_runs_history").on(t.brand, t.provider, t.started, t.id)]);

export const integrationPostLinks = sqliteTable("integration_post_links", {
  brand: text().notNull(),
  resource: text().notNull(),
  media: text().notNull(),
  publication: text().notNull(),
  author: text().notNull().references(() => crmMembers.id),
  at: text().notNull(),
}, t => [
  primaryKey({ columns: [t.brand, t.resource, t.media] }),
  uniqueIndex("integration_publication_unique").on(t.brand,t.publication),
]);
