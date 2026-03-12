import { BrowserQaService } from "./browser-qa.service";
import { FeatureRegistrationService } from "./feature-registration.service";
import { FeatureRequestService } from "./feature-request.service";
import { FeatureStudioRunnerService } from "./feature-studio-runner.service";
import type { WorktreeExecutionService } from "./worktree-execution.service";

jest.mock("@superset/agent", () => ({
	generateFeatureStudioPlan: jest.fn().mockResolvedValue("# Plan"),
	generateFeatureStudioSpec: jest.fn().mockResolvedValue("# Spec"),
}));

jest.mock("drizzle-orm", () => ({
	and: jest.fn((...clauses: unknown[]) => ({ clauses, type: "and" })),
	desc: jest.fn((field: unknown) => ({ field, type: "desc" })),
	eq: jest.fn((field: unknown, value: unknown) => ({ field, value, type: "eq" })),
}));

jest.mock("@superbuilder/drizzle", () => ({
	InjectDrizzle: () => () => undefined,
	featureRequests: {
		id: { name: "id" },
		status: { name: "status" },
		createdAt: { name: "created_at" },
	},
	featureRequestMessages: {
		id: { name: "id" },
		createdAt: { name: "created_at" },
	},
	featureRequestApprovals: {
		id: { name: "id" },
		createdAt: { name: "created_at" },
		featureRequestId: { name: "feature_request_id" },
		approvalType: { name: "approval_type" },
		status: { name: "status" },
		updatedAt: { name: "updated_at" },
	},
	featureRequestArtifacts: {
		id: { name: "id" },
		createdAt: { name: "created_at" },
	},
	featureRequestRuns: {
		id: { name: "id" },
	},
	featureRequestWorktrees: {
		id: { name: "id" },
		featureRequestId: { name: "feature_request_id" },
		updatedAt: { name: "updated_at" },
	},
	featureRegistrations: {
		id: { name: "id" },
	},
}));

const requestId = "123e4567-e89b-12d3-a456-426614174099";
const userId = "123e4567-e89b-12d3-a456-426614174000";

const createMockDb = () => {
	const queue: Array<{ method: string; value: unknown }> = [];
	type QuerySection = {
		findFirst: jest.Mock;
		findMany: jest.Mock;
	};
	type MockDb = Record<string, jest.Mock> & {
		query: {
			featureRequests: QuerySection;
			featureRequestApprovals: QuerySection;
			featureRequestMessages: QuerySection;
			featureRequestArtifacts: QuerySection;
			featureRequestWorktrees: QuerySection;
		};
		_queueResolve: (method: string, value: unknown) => void;
		_resetQueue: () => void;
	};

	const chain = {} as MockDb;

	for (const method of [
		"insert",
		"values",
		"returning",
		"update",
		"set",
		"where",
	]) {
		chain[method] = jest.fn().mockImplementation(() => {
			const next = queue[0];
			if (next && (next.method === method || next.method === "any")) {
				queue.shift();
				return Promise.resolve(next.value);
			}
			return chain;
		});
	}

	chain.query = {
		featureRequests: {
			findFirst: jest.fn(),
			findMany: jest.fn(),
		},
		featureRequestApprovals: {
			findFirst: jest.fn(),
			findMany: jest.fn(),
		},
		featureRequestMessages: {
			findFirst: jest.fn(),
			findMany: jest.fn(),
		},
		featureRequestArtifacts: {
			findFirst: jest.fn(),
			findMany: jest.fn(),
		},
		featureRequestWorktrees: {
			findFirst: jest.fn(),
			findMany: jest.fn(),
		},
	};

	chain._queueResolve = (method, value) => {
		queue.push({ method, value });
	};
	chain._resetQueue = () => {
		queue.length = 0;
	};

	return chain;
};

describe("Feature Studio happy path", () => {
	let mockDb: ReturnType<typeof createMockDb>;
	let requestService: FeatureRequestService;
	let runnerService: FeatureStudioRunnerService;
	let browserQaService: BrowserQaService;
	let registrationService: FeatureRegistrationService;
	let worktreeExecutionService: Pick<WorktreeExecutionService, "prepareWorktree">;
	const originalFetch = global.fetch;

	beforeEach(() => {
		mockDb = createMockDb();
		requestService = new FeatureRequestService(mockDb as never);
		worktreeExecutionService = {
			prepareWorktree: jest.fn().mockResolvedValue({
				request: { id: requestId, status: "implementing" },
				branchName: "codex/feature-studio-123e4567",
				worktreePath: "/tmp/feature-studio",
			}),
		};
		runnerService = new FeatureStudioRunnerService(
			mockDb as never,
			worktreeExecutionService as never,
		);
		browserQaService = new BrowserQaService(mockDb as never);
		registrationService = new FeatureRegistrationService(
			mockDb as never,
			{
				create: jest.fn().mockImplementation((input: { slug: string; name: string }) => ({
					id: "catalog_1",
					slug: input.slug,
					name: input.name,
				})),
			} as never,
		);
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
		} as Response);
	});

	afterEach(() => {
		global.fetch = originalFetch;
		jest.clearAllMocks();
		mockDb._resetQueue();
	});

	it("runs full lifecycle from request creation to registered", async () => {
		mockDb._queueResolve("returning", [
			{
				id: requestId,
				status: "draft",
				title: "Lead capture widget",
				rawPrompt: "Build a reusable lead capture widget",
			},
		]);

		const created = await requestService.createRequest(
			{
				title: "Lead capture widget",
				rawPrompt: "Build a reusable lead capture widget",
			},
			userId,
		);

		mockDb.query.featureRequests.findFirst.mockResolvedValueOnce({
			...created,
			rulesetReference: "rules/feature.md",
			createdById: userId,
		});
		mockDb.query.featureRequests.findFirst.mockResolvedValueOnce({
			...created,
			rulesetReference: "rules/feature.md",
			createdById: userId,
			status: "draft",
		});
		mockDb._queueResolve("returning", [{ id: "run_1" }]);
		mockDb._queueResolve("returning", [
			{ id: requestId, status: "pending_spec_approval" },
		]);

		const pendingSpec = await runnerService.advance(requestId);
		if (!("status" in pendingSpec)) {
			throw new Error("Expected feature request status after spec generation");
		}
		expect(pendingSpec.status).toBe("pending_spec_approval");

		mockDb.query.featureRequestApprovals.findFirst.mockResolvedValueOnce({
			id: "approval_spec",
			featureRequestId: requestId,
			approvalType: "spec_plan",
			status: "pending",
		});
		mockDb._queueResolve("returning", [
			{ id: "approval_spec", status: "approved" },
		]);
		await requestService.respondToApproval({
			approvalId: "approval_spec",
			action: "approved",
			decidedById: userId,
		});

		mockDb.query.featureRequestApprovals.findFirst.mockResolvedValueOnce({
			id: "approval_spec",
			featureRequestId: requestId,
			approvalType: "spec_plan",
			status: "approved",
		});
		mockDb._queueResolve("returning", [
			{ id: requestId, status: "plan_approved" },
		]);
		const planApproved = await runnerService.resumeAfterApproval("approval_spec");
		expect(planApproved.status).toBe("plan_approved");

		mockDb.query.featureRequests.findFirst.mockResolvedValueOnce({
			id: requestId,
			title: "Lead capture widget",
			rawPrompt: "Build a reusable lead capture widget",
			status: "plan_approved",
			createdById: userId,
		});
		await runnerService.advance(requestId);
		expect(worktreeExecutionService.prepareWorktree).toHaveBeenCalledWith({
			featureRequestId: requestId,
		});

		mockDb.query.featureRequests.findFirst.mockResolvedValueOnce({
			id: requestId,
			createdById: userId,
		});
		await browserQaService.runPreviewChecks({
			featureRequestId: requestId,
			previewUrl: "https://preview.vercel.app",
		});

		mockDb.query.featureRequestApprovals.findFirst.mockResolvedValueOnce({
			id: "approval_human",
			featureRequestId: requestId,
			approvalType: "human_qa",
			status: "pending",
		});
		mockDb._queueResolve("returning", [
			{ id: "approval_human", status: "approved" },
		]);
		await requestService.respondToApproval({
			approvalId: "approval_human",
			action: "approved",
			decidedById: userId,
		});

		mockDb.query.featureRequestApprovals.findFirst.mockResolvedValueOnce({
			id: "approval_human",
			featureRequestId: requestId,
			approvalType: "human_qa",
			status: "approved",
		});
		mockDb._queueResolve("returning", [
			{ id: requestId, status: "customization" },
		]);
		const customization = await runnerService.resumeAfterApproval(
			"approval_human",
		);
		expect(customization.status).toBe("customization");

		mockDb.query.featureRequests.findFirst.mockResolvedValueOnce({
			id: requestId,
			status: "customization",
			title: "Lead capture widget",
		});
		mockDb._queueResolve("returning", [
			{ id: "approval_registration", status: "pending" },
		]);

		const registrationApproval =
			await registrationService.requestRegistrationApproval(requestId, userId);

		expect(registrationApproval?.status).toBe("pending");
		expect(mockDb.update).toHaveBeenCalledWith(expect.anything());
		expect(mockDb.set).toHaveBeenCalledWith(
			expect.objectContaining({ status: "pending_registration" }),
		);

		// ── Step 8: Approve registration ──
		mockDb.query.featureRequestApprovals.findFirst.mockResolvedValueOnce({
			id: "approval_registration",
			featureRequestId: requestId,
			approvalType: "registration",
			status: "pending",
		});
		mockDb._queueResolve("returning", [
			{ id: "approval_registration", status: "approved", decidedById: userId },
		]);
		await requestService.respondToApproval({
			approvalId: "approval_registration",
			action: "approved",
			decidedById: userId,
		});

		// ── Step 9: Register the feature (final state) ──
		mockDb.query.featureRequests.findFirst.mockResolvedValueOnce({
			id: requestId,
			title: "Lead capture widget",
			rawPrompt: "Build a reusable lead capture widget",
			summary: "A reusable lead capture widget for landing pages",
			status: "pending_registration",
		});
		mockDb.query.featureRequestApprovals.findFirst.mockResolvedValueOnce({
			id: "approval_registration",
			featureRequestId: requestId,
			approvalType: "registration",
			status: "approved",
			decidedById: userId,
		});
		mockDb.query.featureRequestWorktrees.findFirst.mockResolvedValueOnce({
			id: "worktree_1",
			featureRequestId: requestId,
			branchName: "codex/feature-studio-123e4567",
			worktreePath: "/tmp/feature-studio",
			headCommitSha: "abc123",
			lastVerifiedCommitSha: "def456",
			previewUrl: "https://preview.vercel.app",
		});
		mockDb._queueResolve("returning", [
			{
				id: "registration_1",
				featureRequestId: requestId,
				featureKey: "lead-capture-widget",
				status: "registered",
			},
		]);

		const result = await registrationService.registerRequest(requestId);

		expect(result.registration.status).toBe("registered");
		expect(result.registration.featureKey).toBe("lead-capture-widget");
		expect(result.catalogFeature).toBeDefined();
		expect(result.catalogFeature.slug).toBe("lead-capture-widget");

		// Verify the feature request was updated to registered status
		expect(mockDb.set).toHaveBeenCalledWith(
			expect.objectContaining({ status: "registered" }),
		);
	});

	it("transitions to discarded when any approval is discarded", async () => {
		mockDb.query.featureRequestApprovals.findFirst.mockResolvedValueOnce({
			id: "approval_spec",
			featureRequestId: requestId,
			approvalType: "spec_plan",
			status: "pending",
		});
		mockDb._queueResolve("returning", [
			{ id: "approval_spec", status: "discarded" },
		]);
		await requestService.respondToApproval({
			approvalId: "approval_spec",
			action: "discarded",
			decidedById: userId,
		});

		// Second .set call is the feature request status update (first is the approval update)
		expect(mockDb.set).toHaveBeenNthCalledWith(2, { status: "discarded" });
	});

	it("transitions to customization when human_qa approval is rejected", async () => {
		mockDb.query.featureRequestApprovals.findFirst.mockResolvedValueOnce({
			id: "approval_human",
			featureRequestId: requestId,
			approvalType: "human_qa",
			status: "pending",
		});
		mockDb._queueResolve("returning", [
			{ id: "approval_human", status: "rejected" },
		]);
		await requestService.respondToApproval({
			approvalId: "approval_human",
			action: "rejected",
			decidedById: userId,
		});

		// Second .set call is the feature request status update
		expect(mockDb.set).toHaveBeenNthCalledWith(2, { status: "customization" });
	});

	it("transitions to customization when registration approval is rejected", async () => {
		mockDb.query.featureRequestApprovals.findFirst.mockResolvedValueOnce({
			id: "approval_reg",
			featureRequestId: requestId,
			approvalType: "registration",
			status: "pending",
		});
		mockDb._queueResolve("returning", [
			{ id: "approval_reg", status: "rejected" },
		]);
		await requestService.respondToApproval({
			approvalId: "approval_reg",
			action: "rejected",
			decidedById: userId,
		});

		// Second .set call is the feature request status update
		expect(mockDb.set).toHaveBeenNthCalledWith(2, { status: "customization" });
	});

	it("marks request and run as failed when spec generation errors", async () => {
		const { generateFeatureStudioSpec } = await import("@superset/agent");
		const specMock = generateFeatureStudioSpec as unknown as jest.Mock;
		specMock.mockRejectedValueOnce(new Error("API key missing"));

		mockDb.query.featureRequests.findFirst.mockResolvedValueOnce({
			id: requestId,
			title: "Widget",
			rawPrompt: "Build widget",
			rulesetReference: "rules/feature.md",
			status: "draft",
			createdById: userId,
		});
		mockDb.query.featureRequests.findFirst.mockResolvedValueOnce({
			id: requestId,
			title: "Widget",
			rawPrompt: "Build widget",
			rulesetReference: "rules/feature.md",
			status: "draft",
			createdById: userId,
		});
		mockDb._queueResolve("returning", [{ id: "run_1" }]);

		await expect(runnerService.advance(requestId)).rejects.toThrow(
			"API key missing",
		);

		// Verify both run and request were marked failed
		expect(mockDb.set).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "failed",
				lastError: "API key missing",
			}),
		);
		expect(mockDb.set).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "failed",
				currentRunId: "run_1",
			}),
		);

		// Restore mock for other tests
		specMock.mockResolvedValue("# Spec");
	});

	it("throws NotFoundException for non-existent approval", async () => {
		mockDb.query.featureRequestApprovals.findFirst.mockResolvedValueOnce(null);

		await expect(
			requestService.respondToApproval({
				approvalId: "nonexistent",
				action: "approved",
				decidedById: userId,
			}),
		).rejects.toThrow("not found");
	});

	it("throws BadRequestException when registering without approved registration", async () => {
		mockDb.query.featureRequests.findFirst.mockResolvedValueOnce({
			id: requestId,
			title: "Widget",
			status: "pending_registration",
		});
		mockDb.query.featureRequestApprovals.findFirst.mockResolvedValueOnce(null);

		await expect(
			registrationService.registerRequest(requestId),
		).rejects.toThrow("Registration approval is required");
	});
});
