import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { eq, and, desc } from "drizzle-orm";
import {
	InjectDrizzle,
	type DrizzleDB,
	featureRegistrations,
	featureRequestApprovals,
	featureRequests,
	featureRequestWorktrees,
} from "@superbuilder/drizzle";
import { FeatureCatalogService } from "../../feature-catalog/server/service";

@Injectable()
export class FeatureRegistrationService {
	constructor(
		@InjectDrizzle() private readonly db: DrizzleDB,
		private readonly featureCatalogService: FeatureCatalogService,
	) {}

	async requestRegistrationApproval(
		featureRequestId: string,
		requestedFromId: string,
	) {
		const request = await this.db.query.featureRequests.findFirst({
			where: eq(featureRequests.id, featureRequestId),
		});

		if (!request) {
			throw new NotFoundException(
				`Feature request not found: ${featureRequestId}`,
			);
		}

		const [approval] = await this.db
			.insert(featureRequestApprovals)
			.values({
				featureRequestId,
				approvalType: "registration",
				status: "pending",
				requestedFromId,
			})
			.returning();

		await this.db
			.update(featureRequests)
			.set({
				status: "pending_registration",
			})
			.where(eq(featureRequests.id, featureRequestId));

		return approval;
	}

	async registerRequest(featureRequestId: string) {
		const request = await this.db.query.featureRequests.findFirst({
			where: eq(featureRequests.id, featureRequestId),
		});

		if (!request) {
			throw new NotFoundException(
				`Feature request not found: ${featureRequestId}`,
			);
		}

		const registrationApproval =
			await this.db.query.featureRequestApprovals.findFirst({
				where: and(
					eq(featureRequestApprovals.featureRequestId, featureRequestId),
					eq(featureRequestApprovals.approvalType, "registration"),
					eq(featureRequestApprovals.status, "approved"),
				),
				orderBy: [desc(featureRequestApprovals.updatedAt)],
			});

		if (!registrationApproval) {
			throw new BadRequestException("Registration approval is required");
		}

		const latestWorktree = await this.db.query.featureRequestWorktrees.findFirst({
			where: eq(featureRequestWorktrees.featureRequestId, featureRequestId),
			orderBy: [desc(featureRequestWorktrees.updatedAt)],
		});

		const slug = toFeatureSlug(request.title);
		const catalogFeature = await this.featureCatalogService.create({
			slug,
			name: request.title,
			description: request.summary ?? request.rawPrompt,
			group: "content",
			tags: ["feature-studio"],
			previewImages: latestWorktree?.previewUrl ? [latestWorktree.previewUrl] : [],
			capabilities: [],
			techStack: undefined,
			isCore: false,
			isPublished: false,
			order: 0,
			icon: undefined,
		});

		const [registration] = await this.db
			.insert(featureRegistrations)
			.values({
				featureRequestId,
				featureKey: slug,
				status: "registered",
				registeredById: registrationApproval.decidedById ?? null,
				registeredCommitSha:
					latestWorktree?.lastVerifiedCommitSha ??
					latestWorktree?.headCommitSha ??
					null,
				registrationMetadata: {
					catalogFeatureId: catalogFeature.id,
					catalogFeatureSlug: catalogFeature.slug,
				},
			})
			.returning();

		await this.db
			.update(featureRequests)
			.set({
				status: "registered",
			})
			.where(eq(featureRequests.id, featureRequestId));

		return {
			registration,
			catalogFeature,
		};
	}

	async listReadyToRegister() {
		return this.db.query.featureRequests.findMany({
			where: eq(featureRequests.status, "pending_registration"),
		});
	}
}

function toFeatureSlug(title: string) {
	return title
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 100);
}
