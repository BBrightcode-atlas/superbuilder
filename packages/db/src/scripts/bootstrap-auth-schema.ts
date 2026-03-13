import * as dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: "../../.env.local" });
dotenv.config({ path: "../../.env" });

const DATABASE_URL =
	process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error("DATABASE_URL or DATABASE_URL_UNPOOLED is not set in .env");
	process.exit(1);
}

const statements = [
	`CREATE SCHEMA IF NOT EXISTS auth`,
	`CREATE TABLE IF NOT EXISTS auth.users (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		name text NOT NULL,
		email text NOT NULL UNIQUE,
		email_verified boolean DEFAULT false NOT NULL,
		image text,
		organization_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
		created_at timestamp DEFAULT now() NOT NULL,
		updated_at timestamp DEFAULT now() NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS auth.organizations (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		name text NOT NULL,
		slug text NOT NULL UNIQUE,
		logo text,
		created_at timestamp DEFAULT now() NOT NULL,
		metadata text,
		stripe_customer_id text,
		allowed_domains text[] DEFAULT '{}'::text[] NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS auth.sessions (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		expires_at timestamp NOT NULL,
		token text NOT NULL UNIQUE,
		created_at timestamp DEFAULT now() NOT NULL,
		updated_at timestamp NOT NULL DEFAULT now(),
		ip_address text,
		user_agent text,
		user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
		active_organization_id uuid
	)`,
	`CREATE TABLE IF NOT EXISTS auth.accounts (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		account_id text NOT NULL,
		provider_id text NOT NULL,
		user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
		access_token text,
		refresh_token text,
		id_token text,
		access_token_expires_at timestamp,
		refresh_token_expires_at timestamp,
		scope text,
		password text,
		created_at timestamp DEFAULT now() NOT NULL,
		updated_at timestamp NOT NULL DEFAULT now()
	)`,
	`CREATE TABLE IF NOT EXISTS auth.verifications (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		identifier text NOT NULL,
		value text NOT NULL,
		expires_at timestamp NOT NULL,
		created_at timestamp DEFAULT now() NOT NULL,
		updated_at timestamp DEFAULT now() NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS auth.members (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		organization_id uuid NOT NULL REFERENCES auth.organizations(id) ON DELETE CASCADE,
		user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
		role text DEFAULT 'member' NOT NULL,
		created_at timestamp DEFAULT now() NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS auth.invitations (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		organization_id uuid NOT NULL REFERENCES auth.organizations(id) ON DELETE CASCADE,
		email text NOT NULL,
		role text,
		status text DEFAULT 'pending' NOT NULL,
		expires_at timestamp NOT NULL,
		created_at timestamp DEFAULT now() NOT NULL,
		inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
	)`,
	`CREATE TABLE IF NOT EXISTS auth.oauth_clients (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		client_id text NOT NULL UNIQUE,
		client_secret text,
		disabled boolean DEFAULT false,
		skip_consent boolean,
		enable_end_session boolean,
		scopes text[],
		user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
		created_at timestamp,
		updated_at timestamp,
		name text,
		uri text,
		icon text,
		contacts text[],
		tos text,
		policy text,
		software_id text,
		software_version text,
		software_statement text,
		redirect_uris text[] NOT NULL,
		post_logout_redirect_uris text[],
		token_endpoint_auth_method text,
		grant_types text[],
		response_types text[],
		public boolean,
		type text,
		reference_id text,
		metadata jsonb
	)`,
	`CREATE TABLE IF NOT EXISTS auth.oauth_refresh_tokens (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		token text NOT NULL,
		client_id text NOT NULL REFERENCES auth.oauth_clients(client_id) ON DELETE CASCADE,
		session_id uuid REFERENCES auth.sessions(id) ON DELETE SET NULL,
		user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
		reference_id text,
		expires_at timestamp,
		created_at timestamp,
		revoked timestamp,
		scopes text[] NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS auth.oauth_access_tokens (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		token text UNIQUE,
		client_id text NOT NULL REFERENCES auth.oauth_clients(client_id) ON DELETE CASCADE,
		session_id uuid REFERENCES auth.sessions(id) ON DELETE SET NULL,
		user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
		reference_id text,
		refresh_id uuid REFERENCES auth.oauth_refresh_tokens(id) ON DELETE CASCADE,
		expires_at timestamp,
		created_at timestamp,
		scopes text[] NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS auth.oauth_consents (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		client_id text NOT NULL REFERENCES auth.oauth_clients(client_id) ON DELETE CASCADE,
		user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
		reference_id text,
		scopes text[] NOT NULL,
		created_at timestamp,
		updated_at timestamp
	)`,
	`CREATE TABLE IF NOT EXISTS auth.apikeys (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		name text,
		start text,
		prefix text,
		key text NOT NULL,
		user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
		refill_interval integer,
		refill_amount integer,
		last_refill_at timestamp,
		enabled boolean DEFAULT true,
		rate_limit_enabled boolean DEFAULT true,
		rate_limit_time_window integer DEFAULT 86400000,
		rate_limit_max integer DEFAULT 10,
		request_count integer DEFAULT 0,
		remaining integer,
		last_request timestamp,
		expires_at timestamp,
		created_at timestamp DEFAULT now() NOT NULL,
		updated_at timestamp DEFAULT now() NOT NULL,
		permissions text,
		metadata text
	)`,
	`CREATE TABLE IF NOT EXISTS auth.jwkss (
		id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
		public_key text NOT NULL,
		private_key text NOT NULL,
		created_at timestamp DEFAULT now() NOT NULL,
		expires_at timestamp
	)`,
	`CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON auth.accounts(user_id)`,
	`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON auth.sessions(user_id)`,
	`CREATE INDEX IF NOT EXISTS verifications_identifier_idx ON auth.verifications(identifier)`,
	`CREATE INDEX IF NOT EXISTS members_organization_id_idx ON auth.members(organization_id)`,
	`CREATE INDEX IF NOT EXISTS members_user_id_idx ON auth.members(user_id)`,
	`CREATE INDEX IF NOT EXISTS invitations_organization_id_idx ON auth.invitations(organization_id)`,
	`CREATE INDEX IF NOT EXISTS invitations_email_idx ON auth.invitations(email)`,
	`CREATE INDEX IF NOT EXISTS apikeys_key_idx ON auth.apikeys(key)`,
	`CREATE INDEX IF NOT EXISTS apikeys_user_id_idx ON auth.apikeys(user_id)`,
];

async function bootstrapAuthSchema() {
	const pool = new Pool({ connectionString: DATABASE_URL });

	try {
		for (const statement of statements) {
			await pool.query(statement);
		}
		console.log("Bootstrapped schema: auth");
	} finally {
		await pool.end();
	}
}

bootstrapAuthSchema().catch((error) => {
	console.error("Bootstrap auth schema failed:", error);
	process.exit(1);
});
