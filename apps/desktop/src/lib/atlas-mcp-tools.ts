/**
 * Atlas MCP Tools — Mastra Tool definitions for Neon/Vercel operations.
 * These tools are injected into the agent runtime via `extraTools` in createMastraCode().
 * They reuse the same localDb and token storage as the existing tRPC routers.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTool } from "@mastra/core/tools";
import { atlasIntegrations, atlasProjects } from "@superset/local-db";
import { eq } from "drizzle-orm";

import { localDb } from "main/lib/local-db";
import { z } from "zod";
import { decrypt } from "./trpc/routers/auth/utils/crypto-storage";

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

async function getTokenForService(
	service: "neon" | "vercel",
): Promise<string | null> {
	// env 우선, DB fallback
	const envKey = service === "neon" ? "NEON_API_KEY" : "VERCEL_TOKEN";
	const envToken = process.env[envKey];
	if (envToken) return envToken;

	const [integration] = await localDb
		.select()
		.from(atlasIntegrations)
		.where(eq(atlasIntegrations.service, service));
	if (!integration) return null;
	return decrypt(integration.encryptedToken);
}

async function neonFetch(path: string, options: RequestInit = {}) {
	const token = await getTokenForService("neon");
	if (!token)
		throw new Error(
			"Neon API 키가 설정되지 않았습니다. 먼저 Atlas → Composer에서 Neon을 연결하세요.",
		);
	const res = await fetch(`https://console.neon.tech/api/v2${path}`, {
		...options,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			...options.headers,
		},
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Neon API error (${res.status}): ${body}`);
	}
	return res.json();
}

async function vercelFetch(path: string, options: RequestInit = {}) {
	const token = await getTokenForService("vercel");
	if (!token)
		throw new Error(
			"Vercel 토큰이 설정되지 않았습니다. 먼저 Atlas → Composer에서 Vercel을 연결하세요.",
		);
	const res = await fetch(`https://api.vercel.com${path}`, {
		...options,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			...options.headers,
		},
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Vercel API error (${res.status}): ${body}`);
	}
	return res.json();
}

// ---------------------------------------------------------------------------
// Neon Tools
// ---------------------------------------------------------------------------

export const atlasNeonStatusTool = createTool({
	id: "atlas_neon_status",
	description:
		"Check if Neon is connected (API key configured). Returns connection status.",
	inputSchema: z.object({}),
	outputSchema: z.object({ connected: z.boolean() }),
	execute: async () => {
		const token = await getTokenForService("neon");
		return { connected: !!token };
	},
});

export const atlasNeonListOrgsTool = createTool({
	id: "atlas_neon_list_organizations",
	description:
		"List all Neon organizations the user belongs to. Requires Neon API key to be configured.",
	inputSchema: z.object({}),
	outputSchema: z.object({
		organizations: z.array(z.object({ id: z.string(), name: z.string() })),
	}),
	execute: async () => {
		// Try /users/me/organizations first (personal API key)
		// Fall back to extracting org info from /projects (org API key)
		try {
			const data = await neonFetch("/users/me/organizations");
			const orgs = (data.organizations ?? data ?? []) as Array<{
				id: string;
				name: string;
			}>;
			return { organizations: orgs };
		} catch {
			try {
				const data = await neonFetch("/projects?limit=1");
				const projects = (data.projects ?? []) as Array<{
					org_id?: string;
				}>;
				if (projects.length > 0 && projects[0].org_id) {
					return {
						organizations: [
							{ id: projects[0].org_id, name: projects[0].org_id },
						],
					};
				}
			} catch {
				// ignore
			}
			return { organizations: [] };
		}
	},
});

export const atlasNeonCreateProjectTool = createTool({
	id: "atlas_neon_create_project",
	description:
		"Create a new Neon project. Returns the project ID, name, and connection URI. Optionally links to an Atlas project.",
	inputSchema: z.object({
		name: z.string().describe("Project name"),
		orgId: z.string().optional().describe("Neon organization ID (optional)"),
		atlasProjectId: z
			.string()
			.optional()
			.describe("Atlas project ID to link (optional)"),
	}),
	outputSchema: z.object({
		id: z.string(),
		name: z.string(),
		connectionUri: z.string(),
	}),
	execute: async (input) => {
		const projectPayload: Record<string, unknown> = {
			name: input.name,
		};
		if (input.orgId) {
			projectPayload.org_id = input.orgId;
		}

		const data = await neonFetch("/projects", {
			method: "POST",
			body: JSON.stringify({ project: projectPayload }),
		});

		const project = data.project;
		const connectionUri = data.connection_uris?.[0]?.connection_uri ?? "";

		if (input.atlasProjectId) {
			await localDb
				.update(atlasProjects)
				.set({
					neonProjectId: project.id,
					neonConnectionString: connectionUri,
					updatedAt: Date.now(),
				})
				.where(eq(atlasProjects.id, input.atlasProjectId));
		}

		return {
			id: project.id,
			name: project.name,
			connectionUri,
		};
	},
});

export const atlasNeonWriteEnvTool = createTool({
	id: "atlas_neon_write_env",
	description:
		"Write Neon environment variables (DATABASE_URL, NEON_PROJECT_ID) to a .env file in the given project path.",
	inputSchema: z.object({
		projectPath: z.string().describe("Absolute path to the project directory"),
		connectionUri: z.string().describe("Neon connection URI"),
		neonProjectId: z.string().describe("Neon project ID"),
	}),
	outputSchema: z.object({ envPath: z.string() }),
	execute: async (input) => {
		const envPath = join(input.projectPath, ".env");
		let existing = "";
		try {
			existing = await readFile(envPath, "utf-8");
		} catch {
			// File doesn't exist yet
		}

		const neonEnv = [
			`DATABASE_URL=${input.connectionUri}`,
			`NEON_PROJECT_ID=${input.neonProjectId}`,
		].join("\n");

		const newContent = existing
			? `${existing}\n\n# Neon (auto-generated by Atlas Agent)\n${neonEnv}\n`
			: `# Neon (auto-generated by Atlas Agent)\n${neonEnv}\n`;

		await writeFile(envPath, newContent, "utf-8");
		return { envPath };
	},
});

// ---------------------------------------------------------------------------
// Vercel Tools
// ---------------------------------------------------------------------------

export const atlasVercelStatusTool = createTool({
	id: "atlas_vercel_status",
	description:
		"Check if Vercel is connected (PAT token configured). Returns connection status.",
	inputSchema: z.object({}),
	outputSchema: z.object({ connected: z.boolean() }),
	execute: async () => {
		const token = await getTokenForService("vercel");
		return { connected: !!token };
	},
});

export const atlasVercelListTeamsTool = createTool({
	id: "atlas_vercel_list_teams",
	description:
		"List all Vercel teams the user belongs to. Requires Vercel PAT to be configured.",
	inputSchema: z.object({}),
	outputSchema: z.object({
		teams: z.array(
			z.object({ id: z.string(), name: z.string(), slug: z.string() }),
		),
	}),
	execute: async () => {
		const data = await vercelFetch("/v2/teams");
		return {
			teams: (data.teams ?? []) as Array<{
				id: string;
				name: string;
				slug: string;
			}>,
		};
	},
});

export const atlasVercelCreateProjectTool = createTool({
	id: "atlas_vercel_create_project",
	description:
		"Create a new Vercel project. Optionally links to an Atlas project and a GitHub repository.",
	inputSchema: z.object({
		name: z.string().describe("Project name (kebab-case recommended)"),
		teamId: z
			.string()
			.optional()
			.describe("Vercel team ID (optional, for personal account leave empty)"),
		framework: z.string().default("vite").describe("Framework (default: vite)"),
		atlasProjectId: z
			.string()
			.optional()
			.describe("Atlas project ID to link (optional)"),
		gitOwner: z
			.string()
			.optional()
			.describe("GitHub owner/org for Git integration (optional)"),
		gitRepo: z
			.string()
			.optional()
			.describe("GitHub repo name for Git integration (optional)"),
	}),
	outputSchema: z.object({
		id: z.string(),
		name: z.string(),
		url: z.string(),
	}),
	execute: async (input) => {
		const queryParams = input.teamId ? `?teamId=${input.teamId}` : "";
		const body: Record<string, unknown> = {
			name: input.name,
			framework: input.framework,
		};
		if (input.gitOwner && input.gitRepo) {
			body.gitRepository = {
				type: "github",
				repo: `${input.gitOwner}/${input.gitRepo}`,
			};
		}
		const project = await vercelFetch(`/v10/projects${queryParams}`, {
			method: "POST",
			body: JSON.stringify(body),
		});

		if (input.atlasProjectId) {
			await localDb
				.update(atlasProjects)
				.set({
					vercelProjectId: project.id,
					vercelUrl: `https://${project.name}.vercel.app`,
					updatedAt: Date.now(),
				})
				.where(eq(atlasProjects.id, input.atlasProjectId));
		}

		return {
			id: project.id,
			name: project.name,
			url: `https://${project.name}.vercel.app`,
		};
	},
});

export const atlasVercelDeployTool = createTool({
	id: "atlas_vercel_deploy",
	description:
		"Deploy a Vercel project. Returns deployment URL and status. Optionally links to an Atlas project.",
	inputSchema: z.object({
		projectId: z.string().describe("Vercel project ID"),
		projectName: z.string().describe("Vercel project name"),
		teamId: z.string().optional().describe("Vercel team ID (optional)"),
		atlasProjectId: z
			.string()
			.optional()
			.describe("Atlas project ID to link (optional)"),
	}),
	outputSchema: z.object({
		id: z.string(),
		url: z.string(),
		readyState: z.string(),
	}),
	execute: async (input) => {
		const queryParams = input.teamId ? `?teamId=${input.teamId}` : "";
		const deployment = await vercelFetch(`/v13/deployments${queryParams}`, {
			method: "POST",
			body: JSON.stringify({
				name: input.projectName,
				project: input.projectId,
				target: "production",
				projectSettings: { framework: "vite" },
			}),
		});

		if (input.atlasProjectId) {
			await localDb
				.update(atlasProjects)
				.set({
					vercelDeploymentId: deployment.id,
					vercelUrl: `https://${deployment.url}`,
					updatedAt: Date.now(),
				})
				.where(eq(atlasProjects.id, input.atlasProjectId));
		}

		return {
			id: deployment.id,
			url: `https://${deployment.url}`,
			readyState: deployment.readyState as string,
		};
	},
});

export const atlasVercelGetDeploymentTool = createTool({
	id: "atlas_vercel_get_deployment",
	description:
		"Check the status of a Vercel deployment by its ID. Returns readyState (READY, BUILDING, ERROR, etc).",
	inputSchema: z.object({
		deploymentId: z.string().describe("Vercel deployment ID"),
	}),
	outputSchema: z.object({
		id: z.string(),
		url: z.string(),
		readyState: z.string(),
		state: z.string(),
	}),
	execute: async (input) => {
		const deployment = await vercelFetch(
			`/v13/deployments/${input.deploymentId}`,
		);
		return {
			id: deployment.uid,
			url: deployment.url,
			readyState: deployment.readyState as string,
			state: deployment.state as string,
		};
	},
});

// ---------------------------------------------------------------------------
// Atlas Project Tools
// ---------------------------------------------------------------------------

export const atlasListProjectsTool = createTool({
	id: "atlas_list_projects",
	description:
		"List all Atlas projects (created via Composer). Shows name, path, features, status, and linked services.",
	inputSchema: z.object({}),
	outputSchema: z.object({
		projects: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				localPath: z.string(),
				features: z.array(z.string()),
				status: z.string(),
				neonProjectId: z.string().nullable(),
				vercelUrl: z.string().nullable(),
			}),
		),
	}),
	execute: async () => {
		const projects = await localDb.select().from(atlasProjects);
		return {
			projects: projects.map((p) => ({
				id: p.id,
				name: p.name,
				localPath: p.localPath,
				features: p.features,
				status: p.status,
				neonProjectId: p.neonProjectId,
				vercelUrl: p.vercelUrl,
			})),
		};
	},
});

// ---------------------------------------------------------------------------
// Export all tools as a flat record for extraTools injection
// ---------------------------------------------------------------------------

export function getAtlasMcpTools(): Record<string, unknown> {
	return {
		atlas_neon_status: atlasNeonStatusTool,
		atlas_neon_list_organizations: atlasNeonListOrgsTool,
		atlas_neon_create_project: atlasNeonCreateProjectTool,
		atlas_neon_write_env: atlasNeonWriteEnvTool,
		atlas_vercel_status: atlasVercelStatusTool,
		atlas_vercel_list_teams: atlasVercelListTeamsTool,
		atlas_vercel_create_project: atlasVercelCreateProjectTool,
		atlas_vercel_deploy: atlasVercelDeployTool,
		atlas_vercel_get_deployment: atlasVercelGetDeploymentTool,
		atlas_list_projects: atlasListProjectsTool,
	};
}
