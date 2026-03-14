import type { NeonResult } from "./types";

const NEON_API = "https://console.neon.tech/api/v2";

export async function neonFetch(
	path: string,
	options: RequestInit = {},
	apiKey: string,
): Promise<unknown> {
	const res = await fetch(`${NEON_API}${path}`, {
		...options,
		headers: {
			Authorization: `Bearer ${apiKey}`,
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

export async function createNeonProject(opts: {
	projectName: string;
	orgId?: string;
	apiKey?: string;
}): Promise<NeonResult> {
	const apiKey = opts.apiKey ?? process.env.NEON_API_KEY;
	if (!apiKey) {
		throw new Error(
			"Neon API key required: pass apiKey or set NEON_API_KEY env var",
		);
	}

	const orgId = opts.orgId ?? process.env.NEON_ORG_ID;

	const projectPayload: Record<string, unknown> = {
		name: opts.projectName,
	};
	if (orgId) {
		projectPayload.org_id = orgId;
	}

	const data = (await neonFetch(
		"/projects",
		{
			method: "POST",
			body: JSON.stringify({ project: projectPayload }),
		},
		apiKey,
	)) as {
		project: { id: string };
		connection_uris?: Array<{ connection_uri: string }>;
	};

	const project = data.project;
	const connectionUri = data.connection_uris?.[0]?.connection_uri ?? "";

	return {
		projectId: project.id,
		databaseUrl: connectionUri,
	};
}
