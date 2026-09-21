import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type VersionedJson = {
  schema_version: string;
  [key: string]: unknown;
};

export const appSchema = pgSchema("app");

export const orderSource = appSchema.enum("order_source", [
  "online",
  "walk_in",
  "phone",
]);
export const actorType = appSchema.enum("actor_type", [
  "admin",
  "guest",
  "assisted_customer",
  "system",
]);
export const lifecycleState = appSchema.enum("lifecycle_state", [
  "draft",
  "published",
  "retired",
]);
export const pricingMode = appSchema.enum("pricing_mode", [
  "standard",
  "quote_required",
]);
export const jobWorkflowState = appSchema.enum("job_workflow_state", [
  "received",
  "under_review",
  "ready_for_production",
  "in_production",
  "ready",
  "canceled",
]);
export const orderTerminalState = appSchema.enum("order_terminal_state", [
  "active",
  "canceled",
  "collected",
]);
export const decision = appSchema.enum("decision", ["accepted", "declined"]);
export const uploadState = appSchema.enum("upload_state", [
  "pending",
  "accepted",
  "rejected",
  "expired",
]);
export const scanState = appSchema.enum("scan_state", [
  "not_required",
  "pending",
  "passed",
  "failed",
]);
export const quoteState = appSchema.enum("quote_state", [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "superseded",
]);
export const grantState = appSchema.enum("grant_state", [
  "pending",
  "active",
  "grace",
  "revoked",
  "expired",
]);
export const workState = appSchema.enum("work_state", [
  "pending",
  "leased",
  "completed",
  "retryable",
  "uncertain",
  "dead",
]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();
const money = (name: string) => bigint(name, { mode: "bigint" });

export const shops = appSchema.table(
  "shops",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(),
    currency: text("currency").notNull(),
    referencePrefix: text("reference_prefix").notNull(),
    settings: jsonb("settings").$type<VersionedJson>().notNull(),
    contactDetails: jsonb("contact_details").$type<VersionedJson>(),
    pickupDetails: jsonb("pickup_details").$type<VersionedJson>(),
    version: integer("version").default(1).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("shops_version_positive", sql`${table.version} > 0`),
    check("shops_currency_pkr", sql`${table.currency} = 'PKR'`),
    check("shops_timezone_karachi", sql`${table.timezone} = 'Asia/Karachi'`),
  ],
);

export const shopMemberships = appSchema.table(
  "shop_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    authUserId: uuid("auth_user_id").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").default("admin").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("shop_memberships_shop_id_id_unique").on(table.shopId, table.id),
    unique("shop_memberships_shop_user_unique").on(
      table.shopId,
      table.authUserId,
    ),
    uniqueIndex("shop_memberships_one_active_admin")
      .on(table.shopId)
      .where(sql`${table.active} and ${table.role} = 'admin'`),
    foreignKey({ columns: [table.shopId], foreignColumns: [shops.id] }),
  ],
);

export const adminSessions = appSchema.table(
  "admin_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    membershipId: uuid("membership_id").notNull(),
    sessionIdentifierHash: text("session_identifier_hash").notNull().unique(),
    signedInAt: timestamp("signed_in_at", { withTimezone: true }).notNull(),
    lastVerifiedAt: timestamp("last_verified_at", {
      withTimezone: true,
    }).notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at", {
      withTimezone: true,
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: text("revocation_reason"),
    createdAt: createdAt(),
  },
  (table) => [
    unique("admin_sessions_shop_id_id_unique").on(table.shopId, table.id),
    foreignKey({
      columns: [table.shopId, table.membershipId],
      foreignColumns: [shopMemberships.shopId, shopMemberships.id],
    }),
  ],
);

export const actorSnapshots = appSchema.table(
  "actor_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    type: actorType("type").notNull(),
    stableIdentity: text("stable_identity"),
    displayLabel: text("display_label").notNull(),
    assistedChannel: text("assisted_channel"),
    displayErasedAt: timestamp("display_erased_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    unique("actor_snapshots_shop_id_id_unique").on(table.shopId, table.id),
    foreignKey({ columns: [table.shopId], foreignColumns: [shops.id] }),
  ],
);

export const orderReferenceCounters = appSchema.table(
  "order_reference_counters",
  {
    shopId: uuid("shop_id").notNull(),
    calendarYear: integer("calendar_year").notNull(),
    nextValue: bigint("next_value", { mode: "bigint" })
      .default(sql`1`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.shopId, table.calendarYear] }),
    foreignKey({ columns: [table.shopId], foreignColumns: [shops.id] }),
    check("order_reference_next_positive", sql`${table.nextValue} > 0`),
  ],
);

export const services = appSchema.table(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    active: boolean("active").default(true).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("services_shop_id_id_unique").on(table.shopId, table.id),
    unique("services_shop_code_unique").on(table.shopId, table.code),
    foreignKey({ columns: [table.shopId], foreignColumns: [shops.id] }),
  ],
);

export const serviceVersions = appSchema.table(
  "service_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    serviceId: uuid("service_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    lifecycle: lifecycleState("lifecycle").default("draft").notNull(),
    definition: jsonb("definition").$type<VersionedJson>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    unique("service_versions_shop_id_id_unique").on(table.shopId, table.id),
    unique("service_versions_service_number_unique").on(
      table.serviceId,
      table.versionNumber,
    ),
    foreignKey({
      columns: [table.shopId, table.serviceId],
      foreignColumns: [services.shopId, services.id],
    }),
    check("service_version_number_positive", sql`${table.versionNumber} > 0`),
  ],
);

export const priceRuleVersions = appSchema.table(
  "price_rule_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    serviceId: uuid("service_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    lifecycle: lifecycleState("lifecycle").default("draft").notNull(),
    rules: jsonb("rules").$type<VersionedJson>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    unique("price_rule_versions_shop_id_id_unique").on(table.shopId, table.id),
    unique("price_rule_versions_service_number_unique").on(
      table.serviceId,
      table.versionNumber,
    ),
    foreignKey({
      columns: [table.shopId, table.serviceId],
      foreignColumns: [services.shopId, services.id],
    }),
    check(
      "price_rule_version_number_positive",
      sql`${table.versionNumber} > 0`,
    ),
  ],
);

export const catalogVersionEvents = appSchema.table(
  "catalog_version_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    eventType: text("event_type").notNull(),
    actorSnapshotId: uuid("actor_snapshot_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("catalog_version_events_shop_id_id_unique").on(
      table.shopId,
      table.id,
    ),
    unique("catalog_version_events_target_event_unique").on(
      table.targetType,
      table.targetId,
      table.eventType,
    ),
    foreignKey({
      columns: [table.shopId, table.actorSnapshotId],
      foreignColumns: [actorSnapshots.shopId, actorSnapshots.id],
    }),
  ],
);

export const orderDrafts = appSchema.table(
  "order_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    capabilityHash: text("capability_hash").notNull().unique(),
    version: integer("version").default(1).notNull(),
    source: orderSource("source").notNull(),
    provisionalContact: jsonb("provisional_contact").$type<VersionedJson>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    unique("order_drafts_shop_id_id_unique").on(table.shopId, table.id),
    foreignKey({ columns: [table.shopId], foreignColumns: [shops.id] }),
    check("order_drafts_version_positive", sql`${table.version} > 0`),
  ],
);

export const draftJobs = appSchema.table(
  "draft_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    orderDraftId: uuid("order_draft_id").notNull(),
    lineNumber: integer("line_number").notNull(),
    serviceVersionId: uuid("service_version_id").notNull(),
    priceRuleVersionId: uuid("price_rule_version_id").notNull(),
    configuration: jsonb("configuration").$type<VersionedJson>().notNull(),
    measurements: jsonb("measurements").$type<VersionedJson>().notNull(),
    pricePreview: jsonb("price_preview").$type<VersionedJson>(),
    requirements: jsonb("requirements").$type<VersionedJson>().notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("draft_jobs_shop_id_id_unique").on(table.shopId, table.id),
    unique("draft_jobs_order_line_unique").on(
      table.orderDraftId,
      table.lineNumber,
    ),
    foreignKey({
      columns: [table.shopId, table.orderDraftId],
      foreignColumns: [orderDrafts.shopId, orderDrafts.id],
    }),
    foreignKey({
      columns: [table.shopId, table.serviceVersionId],
      foreignColumns: [serviceVersions.shopId, serviceVersions.id],
    }),
    foreignKey({
      columns: [table.shopId, table.priceRuleVersionId],
      foreignColumns: [priceRuleVersions.shopId, priceRuleVersions.id],
    }),
    check("draft_jobs_line_positive", sql`${table.lineNumber} > 0`),
    check("draft_jobs_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

export const orders = appSchema.table(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    reference: text("reference").notNull(),
    source: orderSource("source").notNull(),
    contactName: text("contact_name"),
    contactPhoneDisplay: text("contact_phone_display"),
    contactPhoneSearch: text("contact_phone_search"),
    contactEmailDisplay: text("contact_email_display"),
    contactEmailSearch: text("contact_email_search"),
    terminalState: orderTerminalState("terminal_state")
      .default("active")
      .notNull(),
    version: integer("version").default(1).notNull(),
    requestedLocalDate: date("requested_local_date"),
    confirmedDueAt: timestamp("confirmed_due_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    collectedAt: timestamp("collected_at", { withTimezone: true }),
    contactErasedAt: timestamp("contact_erased_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("orders_shop_id_id_unique").on(table.shopId, table.id),
    unique("orders_shop_reference_unique").on(table.shopId, table.reference),
    foreignKey({ columns: [table.shopId], foreignColumns: [shops.id] }),
    index("orders_shop_state_created_idx").on(
      table.shopId,
      table.terminalState,
      table.createdAt,
      table.id,
    ),
    index("orders_shop_due_idx").on(
      table.shopId,
      table.confirmedDueAt,
      table.id,
    ),
    index("orders_terminal_retention_idx").on(
      table.terminalState,
      table.collectedAt,
      table.canceledAt,
    ),
    index("orders_shop_phone_idx").on(table.shopId, table.contactPhoneSearch),
    index("orders_shop_email_idx").on(table.shopId, table.contactEmailSearch),
    check("orders_version_positive", sql`${table.version} > 0`),
    check(
      "orders_contact_snapshot_state",
      sql`(
        (
          ${table.contactErasedAt} is not null
          and ${table.contactName} is null
          and ${table.contactPhoneDisplay} is null
          and ${table.contactPhoneSearch} is null
          and ${table.contactEmailDisplay} is null
          and ${table.contactEmailSearch} is null
        )
        or (
          ${table.contactErasedAt} is null
          and ${table.contactName} is not null
          and ${table.contactPhoneDisplay} is not null
          and ${table.contactPhoneSearch} is not null
          and (${table.contactEmailDisplay} is null) = (${table.contactEmailSearch} is null)
          and (
            ${table.source} <> 'online'
            or (
              ${table.contactEmailDisplay} is not null
              and ${table.contactEmailSearch} is not null
            )
          )
        )
      )`,
    ),
  ],
);

export const jobs = appSchema.table(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    orderId: uuid("order_id").notNull(),
    lineNumber: integer("line_number").notNull(),
    workflowState: jobWorkflowState("workflow_state")
      .default("received")
      .notNull(),
    blockerProjection: jsonb("blocker_projection")
      .$type<VersionedJson>()
      .notNull(),
    productionHold: boolean("production_hold").default(false).notNull(),
    productionHoldReason: text("production_hold_reason"),
    currentRevisionId: uuid("current_revision_id"),
    currentProofVersionId: uuid("current_proof_version_id"),
    version: integer("version").default(1).notNull(),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("jobs_shop_id_id_unique").on(table.shopId, table.id),
    unique("jobs_shop_order_id_id_unique").on(
      table.shopId,
      table.orderId,
      table.id,
    ),
    unique("jobs_order_line_unique").on(table.orderId, table.lineNumber),
    foreignKey({
      columns: [table.shopId, table.orderId],
      foreignColumns: [orders.shopId, orders.id],
    }),
    index("jobs_order_state_idx").on(table.orderId, table.workflowState),
    check("jobs_line_positive", sql`${table.lineNumber} > 0`),
    check("jobs_version_positive", sql`${table.version} > 0`),
  ],
);

export const jobRevisions = appSchema.table(
  "job_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    jobId: uuid("job_id").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    serviceVersionId: uuid("service_version_id").notNull(),
    priceRuleVersionId: uuid("price_rule_version_id").notNull(),
    configuration: jsonb("configuration").$type<VersionedJson>().notNull(),
    measurements: jsonb("measurements").$type<VersionedJson>().notNull(),
    requirements: jsonb("requirements").$type<VersionedJson>().notNull(),
    pricingMode: pricingMode("pricing_mode").notNull(),
    calculationSnapshot: jsonb("calculation_snapshot").$type<VersionedJson>(),
    currency: text("currency").default("PKR").notNull(),
    subtotal: money("subtotal"),
    adjustment: money("adjustment"),
    tax: money("tax"),
    roundedTotal: money("rounded_total"),
    actorSnapshotId: uuid("actor_snapshot_id").notNull(),
    changeReason: text("change_reason"),
    createdAt: createdAt(),
  },
  (table) => [
    unique("job_revisions_shop_id_id_unique").on(table.shopId, table.id),
    unique("job_revisions_job_number_unique").on(
      table.jobId,
      table.revisionNumber,
    ),
    foreignKey({
      columns: [table.shopId, table.jobId],
      foreignColumns: [jobs.shopId, jobs.id],
    }),
    foreignKey({
      columns: [table.shopId, table.serviceVersionId],
      foreignColumns: [serviceVersions.shopId, serviceVersions.id],
    }),
    foreignKey({
      columns: [table.shopId, table.priceRuleVersionId],
      foreignColumns: [priceRuleVersions.shopId, priceRuleVersions.id],
    }),
    foreignKey({
      columns: [table.shopId, table.actorSnapshotId],
      foreignColumns: [actorSnapshots.shopId, actorSnapshots.id],
    }),
    check("job_revisions_number_positive", sql`${table.revisionNumber} > 0`),
    check(
      "job_revisions_reason_after_first",
      sql`${table.revisionNumber} = 1 or ${table.changeReason} is not null`,
    ),
    check(
      "job_revisions_amounts_nonnegative",
      sql`coalesce(${table.subtotal}, 0) >= 0 and coalesce(${table.tax}, 0) >= 0 and coalesce(${table.roundedTotal}, 0) >= 0`,
    ),
  ],
);

export const priceAcceptances = appSchema.table(
  "price_acceptances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    jobRevisionId: uuid("job_revision_id").notNull(),
    sequenceNumber: integer("sequence_number").notNull(),
    customerActorSnapshotId: uuid("customer_actor_snapshot_id").notNull(),
    channel: text("channel").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    recordedByMembershipId: uuid("recorded_by_membership_id"),
    correctsAcceptanceId: uuid("corrects_acceptance_id"),
    createdAt: createdAt(),
  },
  (table) => [
    unique("price_acceptances_shop_id_id_unique").on(table.shopId, table.id),
    unique("price_acceptances_revision_sequence_unique").on(
      table.jobRevisionId,
      table.sequenceNumber,
    ),
    foreignKey({
      columns: [table.shopId, table.jobRevisionId],
      foreignColumns: [jobRevisions.shopId, jobRevisions.id],
    }),
    foreignKey({
      columns: [table.shopId, table.customerActorSnapshotId],
      foreignColumns: [actorSnapshots.shopId, actorSnapshots.id],
    }),
    check(
      "price_acceptances_sequence_positive",
      sql`${table.sequenceNumber} > 0`,
    ),
  ],
);

export const orderAccessGrants = appSchema.table(
  "order_access_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    orderId: uuid("order_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    state: grantState("state").default("pending").notNull(),
    scopes: text("scopes").array().notNull(),
    replacesGrantId: uuid("replaces_grant_id"),
    activationAt: timestamp("activation_at", { withTimezone: true }),
    graceExpiresAt: timestamp("grace_expires_at", { withTimezone: true }),
    terminalExpiresAt: timestamp("terminal_expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    deliveryOutboxEventId: uuid("delivery_outbox_event_id"),
    createdAt: createdAt(),
  },
  (table) => [
    unique("order_access_grants_shop_id_id_unique").on(table.shopId, table.id),
    unique("order_access_grants_shop_order_id_id_unique").on(
      table.shopId,
      table.orderId,
      table.id,
    ),
    foreignKey({
      columns: [table.shopId, table.orderId],
      foreignColumns: [orders.shopId, orders.id],
    }),
    index("order_access_grants_order_state_idx").on(table.orderId, table.state),
    check(
      "order_access_grants_scopes_valid",
      sql`cardinality(${table.scopes}) > 0 and ${table.scopes} <@ array['order:read', 'artwork:upload', 'quote:respond', 'proof:respond', 'link:rotate']::text[]`,
    ),
  ],
);

export const uploadSessions = appSchema.table(
  "upload_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    ownerType: text("owner_type").notNull(),
    orderDraftId: uuid("order_draft_id"),
    orderId: uuid("order_id"),
    jobId: uuid("job_id"),
    purpose: text("purpose"),
    authorizingGrantId: uuid("authorizing_grant_id"),
    authorizingMembershipId: uuid("authorizing_membership_id"),
    capabilityHash: text("capability_hash"),
    version: integer("version").default(1).notNull(),
    byteQuota: bigint("byte_quota", { mode: "bigint" }).notNull(),
    reservedBytes: bigint("reserved_bytes", { mode: "bigint" })
      .default(sql`0`)
      .notNull(),
    acceptedBytes: bigint("accepted_bytes", { mode: "bigint" })
      .default(sql`0`)
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    cleanedUpAt: timestamp("cleaned_up_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    unique("upload_sessions_shop_id_id_unique").on(table.shopId, table.id),
    foreignKey({ columns: [table.shopId], foreignColumns: [shops.id] }),
    foreignKey({
      columns: [table.shopId, table.orderDraftId],
      foreignColumns: [orderDrafts.shopId, orderDrafts.id],
    }),
    foreignKey({
      columns: [table.shopId, table.orderId],
      foreignColumns: [orders.shopId, orders.id],
    }),
    foreignKey({
      columns: [table.shopId, table.orderId, table.jobId],
      foreignColumns: [jobs.shopId, jobs.orderId, jobs.id],
    }),
    foreignKey({
      columns: [table.shopId, table.orderId, table.authorizingGrantId],
      foreignColumns: [
        orderAccessGrants.shopId,
        orderAccessGrants.orderId,
        orderAccessGrants.id,
      ],
    }),
    foreignKey({
      columns: [table.shopId, table.authorizingMembershipId],
      foreignColumns: [shopMemberships.shopId, shopMemberships.id],
    }),
    check(
      "upload_sessions_one_owner",
      sql`num_nonnulls(${table.orderDraftId}, ${table.orderId}) = 1`,
    ),
    check(
      "upload_sessions_owner_shape",
      sql`(
        ${table.ownerType} = 'draft'
        and ${table.orderDraftId} is not null
        and ${table.orderId} is null
        and ${table.jobId} is null
        and ${table.purpose} is null
        and ${table.capabilityHash} is not null
        and ${table.authorizingGrantId} is null
        and ${table.authorizingMembershipId} is null
      ) or (
        ${table.ownerType} = 'order'
        and ${table.orderDraftId} is null
        and ${table.orderId} is not null
        and ${table.jobId} is not null
        and ${table.purpose} in ('artwork', 'proof')
        and ${table.capabilityHash} is null
        and num_nonnulls(${table.authorizingGrantId}, ${table.authorizingMembershipId}) = 1
      )`,
    ),
    check(
      "upload_sessions_quota_valid",
      sql`${table.byteQuota} > 0 and ${table.reservedBytes} >= 0 and ${table.acceptedBytes} >= 0 and ${table.reservedBytes} + ${table.acceptedBytes} <= ${table.byteQuota}`,
    ),
  ],
);

export const uploadIntents = appSchema.table(
  "upload_intents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    uploadSessionId: uuid("upload_session_id").notNull(),
    quarantineKey: text("quarantine_key").notNull().unique(),
    declaredFilename: text("declared_filename").notNull(),
    declaredMediaType: text("declared_media_type").notNull(),
    reservedBytes: bigint("reserved_bytes", { mode: "bigint" }).notNull(),
    state: uploadState("state").default("pending").notNull(),
    uploadUrlExpiresAt: timestamp("upload_url_expires_at", {
      withTimezone: true,
    }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    cleanedUpAt: timestamp("cleaned_up_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    unique("upload_intents_shop_id_id_unique").on(table.shopId, table.id),
    foreignKey({
      columns: [table.shopId, table.uploadSessionId],
      foreignColumns: [uploadSessions.shopId, uploadSessions.id],
    }),
    check(
      "upload_intents_size_limit",
      sql`${table.reservedBytes} > 0 and ${table.reservedBytes} <= 262144000`,
    ),
  ],
);

export const storedObjects = appSchema.table(
  "stored_objects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    uploadIntentId: uuid("upload_intent_id").notNull().unique(),
    objectKey: text("object_key").notNull().unique(),
    etag: text("etag").notNull(),
    originalFilename: text("original_filename"),
    measuredMediaType: text("measured_media_type").notNull(),
    measuredSize: bigint("measured_size", { mode: "bigint" }).notNull(),
    checksum: text("checksum").notNull(),
    validationState: text("validation_state").notNull(),
    scanState: scanState("scan_state").default("not_required").notNull(),
    attachedAt: timestamp("attached_at", { withTimezone: true }),
    bytesDeletedAt: timestamp("bytes_deleted_at", { withTimezone: true }),
    filenameErasedAt: timestamp("filename_erased_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    unique("stored_objects_shop_id_id_unique").on(table.shopId, table.id),
    foreignKey({
      columns: [table.shopId, table.uploadIntentId],
      foreignColumns: [uploadIntents.shopId, uploadIntents.id],
    }),
    check("stored_objects_size_positive", sql`${table.measuredSize} > 0`),
    index("stored_objects_bytes_retention_idx").on(
      table.bytesDeletedAt,
      table.createdAt,
    ),
    index("stored_objects_filename_retention_idx").on(
      table.filenameErasedAt,
      table.createdAt,
    ),
  ],
);

export const draftJobObjects = appSchema.table(
  "draft_job_objects",
  {
    shopId: uuid("shop_id").notNull(),
    draftJobId: uuid("draft_job_id").notNull(),
    storedObjectId: uuid("stored_object_id").notNull(),
    purpose: text("purpose").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.shopId, table.draftJobId, table.storedObjectId],
    }),
    foreignKey({
      columns: [table.shopId, table.draftJobId],
      foreignColumns: [draftJobs.shopId, draftJobs.id],
    }),
    foreignKey({
      columns: [table.shopId, table.storedObjectId],
      foreignColumns: [storedObjects.shopId, storedObjects.id],
    }),
  ],
);

export const artworkItems = appSchema.table(
  "artwork_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    jobId: uuid("job_id").notNull(),
    purpose: text("purpose").notNull(),
    requiredChecks: jsonb("required_checks").$type<VersionedJson>().notNull(),
    currentReview: text("current_review"),
    currentVersionId: uuid("current_version_id"),
    productionVersionId: uuid("production_version_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("artwork_items_shop_id_id_unique").on(table.shopId, table.id),
    unique("artwork_items_job_purpose_unique").on(table.jobId, table.purpose),
    foreignKey({
      columns: [table.shopId, table.jobId],
      foreignColumns: [jobs.shopId, jobs.id],
    }),
  ],
);

export const artworkVersions = appSchema.table(
  "artwork_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    artworkItemId: uuid("artwork_item_id").notNull(),
    storedObjectId: uuid("stored_object_id").notNull().unique(),
    versionNumber: integer("version_number").notNull(),
    uploaderSnapshotId: uuid("uploader_snapshot_id").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("artwork_versions_shop_id_id_unique").on(table.shopId, table.id),
    unique("artwork_versions_item_number_unique").on(
      table.artworkItemId,
      table.versionNumber,
    ),
    foreignKey({
      columns: [table.shopId, table.artworkItemId],
      foreignColumns: [artworkItems.shopId, artworkItems.id],
    }),
    foreignKey({
      columns: [table.shopId, table.storedObjectId],
      foreignColumns: [storedObjects.shopId, storedObjects.id],
    }),
    foreignKey({
      columns: [table.shopId, table.uploaderSnapshotId],
      foreignColumns: [actorSnapshots.shopId, actorSnapshots.id],
    }),
  ],
);

export const artworkReviewDecisions = appSchema.table(
  "artwork_review_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    jobId: uuid("job_id").notNull(),
    artworkVersionId: uuid("artwork_version_id").notNull(),
    sequenceNumber: integer("sequence_number").notNull(),
    decision: decision("decision").notNull(),
    reason: text("reason").notNull(),
    actorSnapshotId: uuid("actor_snapshot_id").notNull(),
    channel: text("channel").notNull(),
    correctsDecisionId: uuid("corrects_decision_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("artwork_review_decisions_shop_id_id_unique").on(
      table.shopId,
      table.id,
    ),
    unique("artwork_review_decisions_version_sequence_unique").on(
      table.artworkVersionId,
      table.sequenceNumber,
    ),
    foreignKey({
      columns: [table.shopId, table.jobId],
      foreignColumns: [jobs.shopId, jobs.id],
    }),
    foreignKey({
      columns: [table.shopId, table.artworkVersionId],
      foreignColumns: [artworkVersions.shopId, artworkVersions.id],
    }),
    foreignKey({
      columns: [table.shopId, table.actorSnapshotId],
      foreignColumns: [actorSnapshots.shopId, actorSnapshots.id],
    }),
    check(
      "artwork_review_decisions_sequence_positive",
      sql`${table.sequenceNumber} > 0`,
    ),
  ],
);

export const proofVersions = appSchema.table(
  "proof_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    jobId: uuid("job_id").notNull(),
    jobRevisionId: uuid("job_revision_id").notNull(),
    storedObjectId: uuid("stored_object_id").notNull().unique(),
    versionNumber: integer("version_number").notNull(),
    creatorSnapshotId: uuid("creator_snapshot_id").notNull(),
    message: text("message"),
    createdAt: createdAt(),
  },
  (table) => [
    unique("proof_versions_shop_id_id_unique").on(table.shopId, table.id),
    unique("proof_versions_job_number_unique").on(
      table.jobId,
      table.versionNumber,
    ),
    foreignKey({
      columns: [table.shopId, table.jobId],
      foreignColumns: [jobs.shopId, jobs.id],
    }),
    foreignKey({
      columns: [table.shopId, table.jobRevisionId],
      foreignColumns: [jobRevisions.shopId, jobRevisions.id],
    }),
    foreignKey({
      columns: [table.shopId, table.storedObjectId],
      foreignColumns: [storedObjects.shopId, storedObjects.id],
    }),
    foreignKey({
      columns: [table.shopId, table.creatorSnapshotId],
      foreignColumns: [actorSnapshots.shopId, actorSnapshots.id],
    }),
  ],
);

export const proofArtworkSources = appSchema.table(
  "proof_artwork_sources",
  {
    shopId: uuid("shop_id").notNull(),
    proofVersionId: uuid("proof_version_id").notNull(),
    artworkVersionId: uuid("artwork_version_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.shopId, table.proofVersionId, table.artworkVersionId],
    }),
    foreignKey({
      columns: [table.shopId, table.proofVersionId],
      foreignColumns: [proofVersions.shopId, proofVersions.id],
    }),
    foreignKey({
      columns: [table.shopId, table.artworkVersionId],
      foreignColumns: [artworkVersions.shopId, artworkVersions.id],
    }),
  ],
);

export const proofDecisions = appSchema.table(
  "proof_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    proofVersionId: uuid("proof_version_id").notNull(),
    sequenceNumber: integer("sequence_number").notNull(),
    decision: decision("decision").notNull(),
    reason: text("reason"),
    customerActorSnapshotId: uuid("customer_actor_snapshot_id").notNull(),
    channel: text("channel").notNull(),
    recordedByMembershipId: uuid("recorded_by_membership_id"),
    correctsDecisionId: uuid("corrects_decision_id"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("proof_decisions_shop_id_id_unique").on(table.shopId, table.id),
    unique("proof_decisions_proof_sequence_unique").on(
      table.proofVersionId,
      table.sequenceNumber,
    ),
    foreignKey({
      columns: [table.shopId, table.proofVersionId],
      foreignColumns: [proofVersions.shopId, proofVersions.id],
    }),
    foreignKey({
      columns: [table.shopId, table.customerActorSnapshotId],
      foreignColumns: [actorSnapshots.shopId, actorSnapshots.id],
    }),
    foreignKey({
      columns: [table.shopId, table.recordedByMembershipId],
      foreignColumns: [shopMemberships.shopId, shopMemberships.id],
    }),
    check(
      "proof_decisions_sequence_positive",
      sql`${table.sequenceNumber} > 0`,
    ),
  ],
);

export const quoteThreads = appSchema.table(
  "quote_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    orderId: uuid("order_id").notNull().unique(),
    currentRevisionId: uuid("current_revision_id"),
    createdAt: createdAt(),
  },
  (table) => [
    unique("quote_threads_shop_id_id_unique").on(table.shopId, table.id),
    foreignKey({
      columns: [table.shopId, table.orderId],
      foreignColumns: [orders.shopId, orders.id],
    }),
  ],
);

export const quoteRevisions = appSchema.table(
  "quote_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    quoteThreadId: uuid("quote_thread_id").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    lifecycle: quoteState("lifecycle").default("draft").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    currency: text("currency").default("PKR").notNull(),
    subtotal: money("subtotal").notNull(),
    adjustment: money("adjustment")
      .default(sql`0`)
      .notNull(),
    tax: money("tax")
      .default(sql`0`)
      .notNull(),
    roundingDelta: money("rounding_delta")
      .default(sql`0`)
      .notNull(),
    total: money("total").notNull(),
    customerMessage: text("customer_message").notNull(),
    termsSnapshot: jsonb("terms_snapshot").$type<VersionedJson>().notNull(),
    internalNote: text("internal_note"),
    createdAt: createdAt(),
  },
  (table) => [
    unique("quote_revisions_shop_id_id_unique").on(table.shopId, table.id),
    unique("quote_revisions_thread_number_unique").on(
      table.quoteThreadId,
      table.revisionNumber,
    ),
    foreignKey({
      columns: [table.shopId, table.quoteThreadId],
      foreignColumns: [quoteThreads.shopId, quoteThreads.id],
    }),
    check("quote_revisions_number_positive", sql`${table.revisionNumber} > 0`),
    check(
      "quote_revisions_amounts_nonnegative",
      sql`${table.subtotal} >= 0 and ${table.tax} >= 0 and ${table.total} >= 0`,
    ),
  ],
);

export const quoteLines = appSchema.table(
  "quote_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    quoteRevisionId: uuid("quote_revision_id").notNull(),
    jobRevisionId: uuid("job_revision_id").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),
    unitAmount: money("unit_amount").notNull(),
    subtotal: money("subtotal").notNull(),
    allocatedAdjustment: money("allocated_adjustment")
      .default(sql`0`)
      .notNull(),
    tax: money("tax")
      .default(sql`0`)
      .notNull(),
    unroundedTotal: money("unrounded_total").notNull(),
    roundedTotal: money("rounded_total").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    unique("quote_lines_shop_id_id_unique").on(table.shopId, table.id),
    unique("quote_lines_revision_sort_unique").on(
      table.quoteRevisionId,
      table.sortOrder,
    ),
    foreignKey({
      columns: [table.shopId, table.quoteRevisionId],
      foreignColumns: [quoteRevisions.shopId, quoteRevisions.id],
    }),
    foreignKey({
      columns: [table.shopId, table.jobRevisionId],
      foreignColumns: [jobRevisions.shopId, jobRevisions.id],
    }),
    check(
      "quote_lines_amounts_nonnegative",
      sql`${table.subtotal} >= 0 and ${table.tax} >= 0 and ${table.roundedTotal} >= 0`,
    ),
  ],
);

export const quoteLifecycleEvents = appSchema.table(
  "quote_lifecycle_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    quoteRevisionId: uuid("quote_revision_id").notNull(),
    eventType: text("event_type").notNull(),
    actorSnapshotId: uuid("actor_snapshot_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("quote_lifecycle_events_shop_id_id_unique").on(
      table.shopId,
      table.id,
    ),
    foreignKey({
      columns: [table.shopId, table.quoteRevisionId],
      foreignColumns: [quoteRevisions.shopId, quoteRevisions.id],
    }),
  ],
);

export const quoteResponses = appSchema.table(
  "quote_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    quoteRevisionId: uuid("quote_revision_id").notNull(),
    sequenceNumber: integer("sequence_number").notNull(),
    decision: decision("decision").notNull(),
    reason: text("reason"),
    customerActorSnapshotId: uuid("customer_actor_snapshot_id").notNull(),
    channel: text("channel").notNull(),
    recordedByMembershipId: uuid("recorded_by_membership_id"),
    correctsResponseId: uuid("corrects_response_id"),
    respondedAt: timestamp("responded_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("quote_responses_shop_id_id_unique").on(table.shopId, table.id),
    unique("quote_responses_revision_sequence_unique").on(
      table.quoteRevisionId,
      table.sequenceNumber,
    ),
    foreignKey({
      columns: [table.shopId, table.quoteRevisionId],
      foreignColumns: [quoteRevisions.shopId, quoteRevisions.id],
    }),
  ],
);

export const productionExceptions = appSchema.table(
  "production_exceptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    jobId: uuid("job_id").notNull(),
    blockerType: text("blocker_type").notNull(),
    blockedTargetType: text("blocked_target_type").notNull(),
    blockedTargetId: uuid("blocked_target_id").notNull(),
    reason: text("reason").notNull(),
    adminActorSnapshotId: uuid("admin_actor_snapshot_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    unique("production_exceptions_shop_id_id_unique").on(
      table.shopId,
      table.id,
    ),
    foreignKey({
      columns: [table.shopId, table.jobId],
      foreignColumns: [jobs.shopId, jobs.id],
    }),
    foreignKey({
      columns: [table.shopId, table.adminActorSnapshotId],
      foreignColumns: [actorSnapshots.shopId, actorSnapshots.id],
    }),
    check(
      "production_exceptions_proof_only",
      sql`${table.blockerType} = 'proof_approval'`,
    ),
  ],
);

export const internalNotes = appSchema.table(
  "internal_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    orderId: uuid("order_id").notNull(),
    jobId: uuid("job_id"),
    body: text("body").notNull(),
    authorSnapshotId: uuid("author_snapshot_id").notNull(),
    correctsNoteId: uuid("corrects_note_id"),
    createdAt: createdAt(),
  },
  (table) => [
    unique("internal_notes_shop_id_id_unique").on(table.shopId, table.id),
    foreignKey({
      columns: [table.shopId, table.orderId],
      foreignColumns: [orders.shopId, orders.id],
    }),
    foreignKey({
      columns: [table.shopId, table.orderId, table.jobId],
      foreignColumns: [jobs.shopId, jobs.orderId, jobs.id],
    }),
    foreignKey({
      columns: [table.shopId, table.authorSnapshotId],
      foreignColumns: [actorSnapshots.shopId, actorSnapshots.id],
    }),
    index("internal_notes_order_created_idx").on(
      table.orderId,
      table.createdAt,
    ),
  ],
);

export const shopActivityEntries = appSchema.table(
  "shop_activity_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    actionType: text("action_type").notNull(),
    actorSnapshotId: uuid("actor_snapshot_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    details: jsonb("details").$type<VersionedJson>().notNull(),
    correlationId: uuid("correlation_id").notNull(),
    serviceId: uuid("service_id"),
    idempotencyKey: text("idempotency_key"),
  },
  (table) => [
    unique("shop_activity_entries_shop_id_id_unique").on(
      table.shopId,
      table.id,
    ),
    foreignKey({
      columns: [table.shopId, table.actorSnapshotId],
      foreignColumns: [actorSnapshots.shopId, actorSnapshots.id],
    }),
    index("shop_activity_shop_occurred_idx").on(table.shopId, table.occurredAt),
  ],
);

export const orderActivityEntries = appSchema.table(
  "order_activity_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    orderId: uuid("order_id").notNull(),
    jobId: uuid("job_id"),
    actionType: text("action_type").notNull(),
    actorSnapshotId: uuid("actor_snapshot_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    details: jsonb("details").$type<VersionedJson>().notNull(),
    correlationId: uuid("correlation_id").notNull(),
    idempotencyKey: text("idempotency_key"),
  },
  (table) => [
    unique("order_activity_entries_shop_id_id_unique").on(
      table.shopId,
      table.id,
    ),
    foreignKey({
      columns: [table.shopId, table.orderId],
      foreignColumns: [orders.shopId, orders.id],
    }),
    foreignKey({
      columns: [table.shopId, table.orderId, table.jobId],
      foreignColumns: [jobs.shopId, jobs.orderId, jobs.id],
    }),
    foreignKey({
      columns: [table.shopId, table.actorSnapshotId],
      foreignColumns: [actorSnapshots.shopId, actorSnapshots.id],
    }),
    index("order_activity_order_occurred_idx").on(
      table.orderId,
      table.occurredAt,
      table.id,
    ),
  ],
);

export const securityEvents = appSchema.table(
  "security_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    correlationId: uuid("correlation_id").notNull(),
    contextHash: text("context_hash").notNull(),
    retentionExpiresAt: timestamp("retention_expires_at", {
      withTimezone: true,
    }).notNull(),
    shopId: uuid("shop_id"),
    orderId: uuid("order_id"),
    grantId: uuid("grant_id"),
    actorSnapshotId: uuid("actor_snapshot_id"),
  },
  (table) => [index("security_events_expiry_idx").on(table.retentionExpiresAt)],
);

export const capabilityDeliveries = appSchema.table(
  "capability_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purpose: text("purpose").notNull(),
    ownerId: uuid("owner_id").notNull(),
    encryptedCapability: text("encrypted_capability"),
    keyVersion: text("key_version").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    erasedAt: timestamp("erased_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index("capability_deliveries_expiry_idx").on(table.expiresAt)],
);

export const idempotencyRecords = appSchema.table(
  "idempotency_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    operationType: text("operation_type").notNull(),
    key: text("key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    state: workState("state").default("pending").notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    resultType: text("result_type"),
    resultId: uuid("result_id"),
    responseSnapshot: jsonb("response_snapshot").$type<VersionedJson>(),
    retentionExpiresAt: timestamp("retention_expires_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("idempotency_records_shop_id_id_unique").on(table.shopId, table.id),
    unique("idempotency_records_operation_key_unique").on(
      table.shopId,
      table.operationType,
      table.key,
    ),
    foreignKey({ columns: [table.shopId], foreignColumns: [shops.id] }),
    index("idempotency_records_retention_idx").on(table.retentionExpiresAt),
  ],
);

export const outboxEvents = appSchema.table(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: uuid("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<VersionedJson>().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    state: workState("state").default("pending").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    firstAttemptAt: timestamp("first_attempt_at", { withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    leaseFence: bigint("lease_fence", { mode: "bigint" })
      .default(sql`0`)
      .notNull(),
    claimOwner: text("claim_owner"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique("outbox_events_shop_id_id_unique").on(table.shopId, table.id),
    foreignKey({ columns: [table.shopId], foreignColumns: [shops.id] }),
    index("outbox_events_claim_idx").on(
      table.state,
      table.nextAttemptAt,
      table.leaseExpiresAt,
    ),
    check("outbox_events_attempt_nonnegative", sql`${table.attemptCount} >= 0`),
  ],
);

export const externalEffectAttempts = appSchema.table(
  "external_effect_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    outboxEventId: uuid("outbox_event_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    leaseFence: bigint("lease_fence", { mode: "bigint" }).notNull(),
    provider: text("provider").notNull(),
    effectType: text("effect_type").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    state: workState("state").notNull(),
    providerIdentifier: text("provider_identifier"),
    reconciliationResult: text("reconciliation_result"),
    responseSummary: jsonb("response_summary").$type<VersionedJson>(),
    uncertainAt: timestamp("uncertain_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("external_effect_attempts_shop_id_id_unique").on(
      table.shopId,
      table.id,
    ),
    unique("external_effect_attempts_event_attempt_unique").on(
      table.outboxEventId,
      table.attemptNumber,
    ),
    foreignKey({
      columns: [table.shopId, table.outboxEventId],
      foreignColumns: [outboxEvents.shopId, outboxEvents.id],
    }),
    index("external_effect_attempts_reconcile_idx").on(
      table.outboxEventId,
      table.state,
      table.attemptNumber,
    ),
  ],
);

export const rateLimitCounters = appSchema.table(
  "rate_limit_counters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: uuid("shop_id").notNull(),
    scope: text("scope").notNull(),
    identityHash: text("identity_hash").notNull(),
    windowStartedAt: timestamp("window_started_at", {
      withTimezone: true,
    }).notNull(),
    count: integer("count").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("rate_limit_counters_shop_id_id_unique").on(table.shopId, table.id),
    unique("rate_limit_counters_window_unique").on(
      table.scope,
      table.identityHash,
      table.windowStartedAt,
    ),
    foreignKey({ columns: [table.shopId], foreignColumns: [shops.id] }),
    check("rate_limit_count_nonnegative", sql`${table.count} >= 0`),
  ],
);
