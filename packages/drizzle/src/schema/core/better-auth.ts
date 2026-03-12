import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ============================================================================
// Better Auth Tables (public schema)
// ============================================================================

export const baUsers = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type BaUser = typeof baUsers.$inferSelect;
export type NewBaUser = typeof baUsers.$inferInsert;

export const baSessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => baUsers.id, { onDelete: "cascade" }),
    activeOrganizationId: uuid("active_organization_id"),
  },
  (table) => [index("ba_sessions_user_id_idx").on(table.userId)],
);

export const baAccounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => baUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("ba_accounts_user_id_idx").on(table.userId)],
);

export const baVerifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("ba_verifications_identifier_idx").on(table.identifier)],
);

export const baOrganizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    metadata: text("metadata"),
  },
  (table) => [uniqueIndex("ba_organizations_slug_idx").on(table.slug)],
);

export type BaOrganization = typeof baOrganizations.$inferSelect;

export const baMembers = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => baOrganizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => baUsers.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ba_members_organization_id_idx").on(table.organizationId),
    index("ba_members_user_id_idx").on(table.userId),
  ],
);

export type BaMember = typeof baMembers.$inferSelect;

export const baInvitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => baOrganizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => baUsers.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("ba_invitations_organization_id_idx").on(table.organizationId),
    index("ba_invitations_email_idx").on(table.email),
  ],
);

export const baJwkss = pgTable("jwkss", {
  id: uuid("id").primaryKey().defaultRandom(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});
