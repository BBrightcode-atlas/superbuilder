import { BadRequestException } from "@nestjs/common";
import { FeatureRegistrationService } from "./feature-registration.service";

jest.mock("@superbuilder/drizzle", () => ({
	InjectDrizzle: () => () => undefined,
	featureRequests: {
		id: { name: "id" },
		status: { name: "status" },
	},
	featureRequestApprovals: {
		id: { name: "id" },
		featureRequestId: { name: "feature_request_id" },
		approvalType: { name: "approval_type" },
		status: { name: "status" },
		updatedAt: { name: "updated_at" },
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

jest.mock("drizzle-orm", () => ({
	and: jest.fn((...clauses: unknown[]) => ({ clauses, type: "and" })),
	desc: jest.fn((field: unknown) => ({ field, type: "desc" })),
	eq: jest.fn((field: unknown, value: unknown) => ({ field, value, type: "eq" })),
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

describe("FeatureRegistrationService", () => {
	let service: FeatureRegistrationService;
	let mockDb: ReturnType<typeof createMockDb>;
	let featureCatalogService: { create: jest.Mock };

	beforeEach(() => {
		mockDb = createMockDb();
		featureCatalogService = {
			create: jest.fn(),
		};
		service = new FeatureRegistrationService(
			mockDb as never,
			featureCatalogService as never,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
		mockDb._resetQueue();
	});

	it("creates a catalog feature only after registration approval", async () => {
		mockDb.query.featureRequests.findFirst.mockResolvedValue({
			id: requestId,
			title: "Lead capture widget",
			rawPrompt: "Build a reusable lead capture widget",
			summary: "Reusable lead capture widget",
		});
		mockDb.query.featureRequestApprovals.findFirst.mockResolvedValue({
			id: "approval_1",
			featureRequestId: requestId,
			approvalType: "registration",
			status: "approved",
			decidedById: userId,
		});
		mockDb.query.featureRequestWorktrees.findFirst.mockResolvedValue({
			id: "wt_1",
			headCommitSha: "head_sha",
			lastVerifiedCommitSha: "verified_sha",
			previewUrl: "https://preview.vercel.app",
		});
		featureCatalogService.create.mockResolvedValue({
			id: "catalog_1",
			slug: "lead-capture-widget",
		});
		mockDb._queueResolve("returning", [
			{ id: "registration_1", featureKey: "lead-capture-widget" },
		]);

		await service.registerRequest(requestId);

		expect(featureCatalogService.create).toHaveBeenCalled();
		expect(mockDb.insert).toHaveBeenCalled();
	});

	it("requires an approved registration approval before registering", async () => {
		mockDb.query.featureRequests.findFirst.mockResolvedValue({
			id: requestId,
			title: "Lead capture widget",
			rawPrompt: "Build a reusable lead capture widget",
		});
		mockDb.query.featureRequestApprovals.findFirst.mockResolvedValue(null);

		await expect(service.registerRequest(requestId)).rejects.toBeInstanceOf(
			BadRequestException,
		);
	});
});
