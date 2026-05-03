import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const actionEnum = pgEnum("action", [
  "allowed",
  "blocked",
  "masked",
  "warned",
]);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    keyId: text("key_id"),
    action: actionEnum("action").notNull(),
    requestId: text("request_id"),
    entityTypes: text("entity_types").array(),
    model: text("model"),
    provider: text("provider"),
    contentHash: text("content_hash"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => [
    index("audit_events_timestamp_idx").on(table.timestamp),
    index("audit_events_key_id_idx").on(table.keyId),
    index("audit_events_action_idx").on(table.action),
    uniqueIndex("audit_events_request_id_idx").on(table.requestId),
  ],
);

export const eventAggByDay = pgTable(
  "event_agg_by_day",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    date: text("date").notNull(),
    keyId: text("key_id").notNull(),
    totalRequests: integer("total_requests").default(0).notNull(),
    blockedCount: integer("blocked_count").default(0).notNull(),
    maskedCount: integer("masked_count").default(0).notNull(),
    entityBreakdown: jsonb("entity_breakdown"),
  },
  (table) => [uniqueIndex("event_agg_unique_idx").on(table.date, table.keyId)],
);
