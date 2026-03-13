import { z } from "zod";
import { join } from "node:path";
import { execFile as execFileCb, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { publicProcedure, router } from "../..";
import { scaffold, loadRegistry, resolveFeatures } from "@superbuilder/atlas-engine";
import { localDb } from "main/lib/local-db";
import { atlasProjects } from "@superset/local-db";
import { eq } from "drizzle-orm";
import { getProcessEnvWithShellPath } from "../workspaces/utils/shell-env";

const execFileAsync = promisify(execFileCb);

function getSuperbuilderPath(): string {
	const envPath = process.env.SUPERBUILDER_PATH;
	if (!envPath) throw new Error("SUPERBUILDER_PATH not set");
	return envPath;
}

function getAtlasPath(): string {
	const envPath = process.env.ATLAS_PATH;
	if (!envPath) throw new Error("ATLAS_PATH not set");
	return envPath;
}

export const createAtlasComposerRouter = () =>
	router({
		compose: publicProcedure
			.input(
				z.object({
					selected: z.array(z.string()),
					projectName: z.string().min(1),
					targetPath: z.string().min(1),
					config: z
						.object({
							database: z.object({
								provider: z.literal("neon"),
							}),
							auth: z.object({
								provider: z.literal("better-auth"),
								features: z.array(z.string()).default(["email"]),
							}),
							deploy: z.object({
								provider: z.enum(["vercel", "none"]).default("vercel"),
							}),
						})
						.optional(),
				}),
			)
			.mutation(async ({ input }) => {
				const sourceRepoPath = getSuperbuilderPath();
				const atlasPath = getAtlasPath();
				const registry = loadRegistry(atlasPath);
				const resolved = resolveFeatures(registry, input.selected);

				const projectPath = join(input.targetPath, input.projectName);

				const result = await scaffold({
					projectName: input.projectName,
					targetDir: projectPath,
					config: input.config ?? {
						database: { provider: "neon" },
						auth: { provider: "better-auth", features: ["email"] },
						deploy: { provider: "vercel" },
					},
					resolved,
					registry,
					sourceRepoPath,
				});

				// Save to local-db
				const [project] = await localDb
					.insert(atlasProjects)
					.values({
						name: input.projectName,
						localPath: projectPath,
						features: resolved.resolved,
						gitInitialized: true,
						status: "created",
					})
					.returning();

				return {
					projectDir: result.projectDir,
					projectName: input.projectName,
					projectId: project.id,
					features: resolved.resolved,
					gitInitialized: true,
				};
			}),

		// Launch CLI agent for feature installation
		launchInstallAgent: publicProcedure
			.input(
				z.object({
					projectDir: z.string().min(1),
					agent: z.enum(["claude", "codex"]).default("claude"),
				}),
			)
			.mutation(async ({ input }) => {
				const workflowPath = join(input.projectDir, ".claude", "commands", "install-features.md");
				const workflowContent = await readFile(workflowPath, "utf-8");

				const prompt = [
					"You are installing features into a scaffolded project.",
					"Follow the install-features workflow below EXACTLY.",
					"Do NOT skip any step. Do NOT ask questions — execute autonomously.",
					"",
					workflowContent,
				].join("\n");

				const shellEnv = await getProcessEnvWithShellPath();
				// Remove CLAUDECODE to avoid nested session detection error
				const { CLAUDECODE: _, ...env } = shellEnv;

				const agentCmd = input.agent === "codex"
					? "codex"
					: "claude";
				const agentArgs = input.agent === "codex"
					? ["--dangerously-bypass-approvals-and-sandbox", "--", prompt]
					: ["--dangerously-skip-permissions", "-p", prompt];

				const child = spawn(agentCmd, agentArgs, {
					cwd: input.projectDir,
					env,
					stdio: "ignore",
					detached: true,
				});

				child.unref();

				const pid = child.pid;

				return {
					launched: true,
					projectDir: input.projectDir,
					command: `${agentCmd} /install-features`,
					pid: pid ?? null,
				};
			}),

		pushToGitHub: publicProcedure
			.input(
				z.object({
					projectPath: z.string().min(1),
					repoName: z.string().min(1),
					isPrivate: z.boolean().default(true),
					atlasProjectId: z.string().min(1),
				}),
			)
			.mutation(async ({ input }) => {
				const orgName = "BBrightcode-atlas";
				const fullName = `${orgName}/${input.repoName}`;
				await execFileAsync(
					"gh",
					["repo", "create", fullName, input.isPrivate ? "--private" : "--public", "--source", input.projectPath, "--push"],
					{ cwd: input.projectPath },
				);

				const { stdout } = await execFileAsync("gh", ["repo", "view", "--json", "url,owner,name"], {
					cwd: input.projectPath,
				});
				const info = JSON.parse(stdout);

				await localDb
					.update(atlasProjects)
					.set({
						gitRemoteUrl: info.url,
						updatedAt: Date.now(),
					})
					.where(eq(atlasProjects.id, input.atlasProjectId));

				return {
					repoUrl: info.url,
					owner: info.owner.login,
					repo: info.name,
				};
			}),
	});
