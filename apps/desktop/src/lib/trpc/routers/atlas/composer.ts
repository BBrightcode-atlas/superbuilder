import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { composePipeline, pushToGitHub } from "@superbuilder/atlas-engine";
import { atlasProjects } from "@superset/local-db";
import { eq } from "drizzle-orm";
import { localDb } from "main/lib/local-db";
import { z } from "zod";
import { publicProcedure, router } from "../..";
import { getProcessEnvWithShellPath } from "../workspaces/utils/shell-env";

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
				const result = await composePipeline({
					features: input.selected,
					projectName: input.projectName,
					targetPath: input.targetPath,
					options: {
						neon: false, // Desktop uses separate UI steps
						github: false,
						vercel: false,
						install: false,
					},
				});

				// Save to local-db
				const [project] = await localDb
					.insert(atlasProjects)
					.values({
						name: input.projectName,
						localPath: result.projectDir,
						features: result.resolved.resolved,
						gitInitialized: true,
						status: "created",
					})
					.returning();

				return {
					projectDir: result.projectDir,
					projectName: input.projectName,
					projectId: project.id,
					features: result.resolved.resolved,
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
				const workflowPath = join(
					input.projectDir,
					".claude",
					"commands",
					"install-features.md",
				);
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

				const agentCmd = input.agent === "codex" ? "codex" : "claude";
				const agentArgs =
					input.agent === "codex"
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
				const result = await pushToGitHub({
					projectDir: input.projectPath,
					repoName: input.repoName,
					private: input.isPrivate,
				});

				await localDb
					.update(atlasProjects)
					.set({
						gitRemoteUrl: result.repoUrl,
						updatedAt: Date.now(),
					})
					.where(eq(atlasProjects.id, input.atlasProjectId));

				return {
					repoUrl: result.repoUrl,
					owner: result.owner,
					repo: result.repo,
				};
			}),
	});
