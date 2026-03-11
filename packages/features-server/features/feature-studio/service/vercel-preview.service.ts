import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq } from "drizzle-orm";
import {
	InjectDrizzle,
	type DrizzleDB,
	featureRequestArtifacts,
	featureRequests,
	featureRequestWorktrees,
} from "@superbuilder/drizzle";

export interface DeployPreviewInput {
	featureRequestId: string;
	branchName: string;
	projectId: string;
	projectName: string;
	commitSha?: string;
	teamId?: string;
}

interface VercelDeploymentResponse {
	id?: string;
	uid?: string;
	url: string;
	readyState?: string;
	state?: string;
}

@Injectable()
export class VercelPreviewService {
	constructor(
		@InjectDrizzle() private readonly db: DrizzleDB,
		private readonly configService: ConfigService,
	) {}

	async deployPreview(input: DeployPreviewInput) {
		const token = this.configService.get<string>("VERCEL_TOKEN");
		if (!token) {
			throw new BadRequestException("VERCEL_TOKEN is required");
		}

		const teamId = input.teamId ?? this.configService.get<string>("VERCEL_TEAM_ID");
		const query = teamId ? `?teamId=${teamId}` : "";

		const response = await fetch(`https://api.vercel.com/v13/deployments${query}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				name: input.projectName,
				project: input.projectId,
				target: "preview",
				meta: {
					featureRequestId: input.featureRequestId,
					branchName: input.branchName,
				},
				gitSource: {
					type: "github",
					ref: input.branchName,
					sha: input.commitSha,
				},
			}),
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`Vercel preview deployment failed (${response.status}): ${body}`);
		}

		const deployment = (await response.json()) as VercelDeploymentResponse;
		const previewUrl = deployment.url.startsWith("https://")
			? deployment.url
			: `https://${deployment.url}`;
		const deploymentId = deployment.id ?? deployment.uid;
		const previewStatus = deployment.readyState ?? deployment.state ?? "BUILDING";

		await this.db
			.update(featureRequestWorktrees)
			.set({
				previewUrl,
				previewProvider: "vercel",
				previewCommitSha: input.commitSha ?? null,
				previewStatus,
			})
			.where(eq(featureRequestWorktrees.featureRequestId, input.featureRequestId));

		await this.db.insert(featureRequestArtifacts).values({
			featureRequestId: input.featureRequestId,
			kind: "preview_metadata",
			version: 1,
			content: JSON.stringify(
				{
					deploymentId,
					previewUrl,
					previewStatus,
					projectId: input.projectId,
					projectName: input.projectName,
					branchName: input.branchName,
				},
				null,
				2,
			),
			metadata: {
				provider: "vercel",
				deploymentId,
			},
		});

		await this.db
			.update(featureRequests)
			.set({
				status: "agent_qa",
			})
			.where(eq(featureRequests.id, input.featureRequestId));

		return {
			id: deploymentId,
			url: previewUrl,
			readyState: deployment.readyState ?? previewStatus,
			state: deployment.state ?? previewStatus,
		};
	}
}
