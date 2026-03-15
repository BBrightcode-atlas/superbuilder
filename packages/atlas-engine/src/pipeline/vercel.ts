import type { VercelResult } from "./types";

const VERCEL_API = "https://api.vercel.com";

export async function vercelFetch(
	path: string,
	options: RequestInit = {},
	token: string,
): Promise<unknown> {
	const res = await fetch(`${VERCEL_API}${path}`, {
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

export async function deployToVercel(opts: {
	repoUrl: string;
	projectName: string;
	envVars?: Record<string, string>;
	token?: string;
	teamId?: string;
	framework?: string | null;
	rootDirectory?: string;
}): Promise<VercelResult> {
	const token = opts.token ?? process.env.VERCEL_TOKEN;
	if (!token) {
		throw new Error(
			"Vercel token required: pass token or set VERCEL_TOKEN env var",
		);
	}

	const queryParams = opts.teamId ? `?teamId=${opts.teamId}` : "";
	const framework = opts.framework ?? "vite";

	// Parse gitOwner/gitRepo from repoUrl (e.g., "https://github.com/org/repo")
	const urlMatch = opts.repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
	if (!urlMatch) {
		throw new Error(`Cannot parse GitHub owner/repo from URL: ${opts.repoUrl}`);
	}
	const gitOwner = urlMatch[1];
	const gitRepo = urlMatch[2];

	// Step 1: Create project with git repo linked
	const createBody: Record<string, unknown> = {
		name: opts.projectName,
		framework,
		gitRepository: {
			type: "github",
			repo: `${gitOwner}/${gitRepo}`,
		},
		installCommand: "pnpm install --no-frozen-lockfile",
		rootDirectory: opts.rootDirectory ?? "apps/app",
	};

	let project: Record<string, unknown>;
	let gitLinked = false;

	try {
		project = (await vercelFetch(
			`/v10/projects${queryParams}`,
			{ method: "POST", body: JSON.stringify(createBody) },
			token,
		)) as Record<string, unknown>;
		gitLinked = true;
	} catch (err) {
		// Fallback: if GitHub integration not installed, create without git link
		const errMsg = err instanceof Error ? err.message : "";
		if (errMsg.includes("install the GitHub integration")) {
			const fallbackBody: Record<string, unknown> = {
				name: opts.projectName,
				framework,
				installCommand: "pnpm install --no-frozen-lockfile",
			};
			project = (await vercelFetch(
				`/v10/projects${queryParams}`,
				{ method: "POST", body: JSON.stringify(fallbackBody) },
				token,
			)) as Record<string, unknown>;
			gitLinked = false;
		} else {
			throw err;
		}
	}

	const projectId = project.id as string;

	// Step 2: Set env vars if provided
	if (opts.envVars) {
		for (const [key, value] of Object.entries(opts.envVars)) {
			try {
				await vercelFetch(
					`/v10/projects/${projectId}/env${queryParams}`,
					{
						method: "POST",
						body: JSON.stringify({
							key,
							value,
							target: ["production", "preview", "development"],
							type: "encrypted",
						}),
					},
					token,
				);
			} catch (err) {
				const errMsg = err instanceof Error ? err.message : String(err);
				if (errMsg.includes("already exists")) {
					await vercelFetch(
						`/v9/projects/${projectId}/env${queryParams}`,
						{
							method: "PATCH",
							body: JSON.stringify({
								key,
								value,
								target: ["production", "preview", "development"],
								type: "encrypted",
							}),
						},
						token,
					);
				} else {
					throw err;
				}
			}
		}
	}

	// Step 3: Fallback — connect git repo via PATCH if not linked during create
	if (!gitLinked) {
		try {
			await vercelFetch(
				`/v9/projects/${projectId}${queryParams}`,
				{
					method: "PATCH",
					body: JSON.stringify({
						link: {
							type: "github",
							repo: `${gitOwner}/${gitRepo}`,
							productionBranch: "main",
						},
					}),
				},
				token,
			);
		} catch {
			// Git linking may fail if integration is not installed — non-fatal
		}
	}

	// Step 4: Trigger deployment
	try {
		await vercelFetch(
			`/v13/deployments${queryParams}`,
			{
				method: "POST",
				body: JSON.stringify({
					name: opts.projectName,
					project: projectId,
					target: "production",
					gitSource: gitLinked
						? { type: "github", org: gitOwner, repo: gitRepo, ref: "main" }
						: undefined,
				}),
			},
			token,
		);
	} catch {
		// Deployment trigger may fail — git push will trigger auto-deploy later
	}

	// Determine deployment URL from project aliases
	const aliases = (project.alias ?? []) as string[];
	const deploymentUrl =
		aliases.length > 0
			? `https://${aliases[0]}`
			: `https://${(project as { name: string }).name}.vercel.app`;

	return {
		projectId,
		deploymentUrl,
	};
}
