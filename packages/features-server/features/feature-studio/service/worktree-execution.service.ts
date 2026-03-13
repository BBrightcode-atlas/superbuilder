import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import {
	InjectDrizzle,
	type DrizzleDB,
	featureRequestArtifacts,
	featureRequests,
	featureRequestWorktrees,
} from "@superbuilder/features-db";

export interface PrepareWorktreeInput {
	featureRequestId: string;
	branchName?: string;
	baseBranch?: string;
}

export interface MarkVerifiedInput {
	featureRequestId: string;
	verifiedCommitSha: string;
	report: string;
}

@Injectable()
export class WorktreeExecutionService {
	constructor(
		@InjectDrizzle() private readonly db: DrizzleDB,
		private readonly configService: ConfigService,
	) {}

	async prepareWorktree(input: PrepareWorktreeInput) {
		const request = await this.db.query.featureRequests.findFirst({
			where: eq(featureRequests.id, input.featureRequestId),
		});

		if (!request) {
			throw new NotFoundException(
				`Feature request not found: ${input.featureRequestId}`,
			);
		}

		const repoRoot = this.getRepoRoot();
		const branchName =
			input.branchName ??
			`codex/feature-studio-${request.id.slice(0, 8).toLowerCase()}`;
		const baseBranch = input.baseBranch ?? this.getBaseBranch();
		const worktreeBase = this.getWorktreeBase();
		const worktreePath = join(worktreeBase, this.getWorktreeDirectoryName(branchName));

		if (!existsSync(worktreeBase)) {
			mkdirSync(worktreeBase, { recursive: true });
		}

		execFileSync(
			"git",
			["worktree", "add", worktreePath, "-b", branchName, baseBranch],
			{
				cwd: repoRoot,
				timeout: 30_000,
			},
		);

		const headCommitSha = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: worktreePath,
			timeout: 10_000,
		})
			.toString()
			.trim();

		await this.db.insert(featureRequestWorktrees).values({
			featureRequestId: input.featureRequestId,
			worktreePath,
			branchName,
			baseBranch,
			headCommitSha,
		});

		await this.db.insert(featureRequestArtifacts).values({
			featureRequestId: input.featureRequestId,
			kind: "implementation_summary",
			version: 1,
			content: JSON.stringify(
				{
					event: "worktree_prepared",
					branchName,
					baseBranch,
					worktreePath,
					headCommitSha,
				},
				null,
				2,
			),
			metadata: {
				phase: "prepare_worktree",
			},
			createdById: request.createdById,
		});

		const [updatedRequest] = await this.db
			.update(featureRequests)
			.set({
				status: "implementing",
			})
			.where(eq(featureRequests.id, input.featureRequestId))
			.returning();

		return {
			request: updatedRequest ?? request,
			branchName,
			baseBranch,
			worktreePath,
			headCommitSha,
		};
	}

	async markVerified(input: MarkVerifiedInput) {
		await this.db
			.update(featureRequestWorktrees)
			.set({
				lastVerifiedCommitSha: input.verifiedCommitSha,
			})
			.where(eq(featureRequestWorktrees.featureRequestId, input.featureRequestId));

		await this.db.insert(featureRequestArtifacts).values({
			featureRequestId: input.featureRequestId,
			kind: "verification_report",
			version: 1,
			content: input.report,
			metadata: {
				verifiedCommitSha: input.verifiedCommitSha,
			},
		});

		const [updatedRequest] = await this.db
			.update(featureRequests)
			.set({
				status: "preview_deploying",
			})
			.where(eq(featureRequests.id, input.featureRequestId))
			.returning();

		if (!updatedRequest) {
			throw new Error("Failed to update request after verification");
		}

		return updatedRequest;
	}

	private getRepoRoot() {
		const configuredRepoRoot = this.configService.get<string>(
			"FEATURE_STUDIO_REPO_ROOT",
		);
		if (configuredRepoRoot) {
			return resolve(configuredRepoRoot);
		}

		return execFileSync("git", ["rev-parse", "--show-toplevel"], {
			timeout: 10_000,
		})
			.toString()
			.trim();
	}

	private getWorktreeBase() {
		return (
			this.configService.get<string>("FEATURE_STUDIO_WORKTREE_BASE") ??
			join(homedir(), ".superset", "worktrees", "feature-studio")
		);
	}

	private getBaseBranch() {
		return this.configService.get<string>("FEATURE_STUDIO_BASE_BRANCH") ?? "main";
	}

	private getWorktreeDirectoryName(branchName: string) {
		return branchName.replaceAll("/", "-");
	}
}
