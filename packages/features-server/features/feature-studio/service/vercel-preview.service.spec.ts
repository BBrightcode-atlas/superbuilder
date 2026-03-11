import { BadRequestException } from "@nestjs/common";
import { VercelPreviewService } from "./vercel-preview.service";

jest.mock("@superbuilder/drizzle", () => ({
	InjectDrizzle: () => () => undefined,
	featureRequests: {
		id: { name: "id" },
	},
	featureRequestArtifacts: {
		id: { name: "id" },
	},
	featureRequestWorktrees: {
		id: { name: "id" },
		featureRequestId: { name: "feature_request_id" },
	},
}));

jest.mock("drizzle-orm", () => ({
	eq: jest.fn((field: unknown, value: unknown) => ({ field, value, type: "eq" })),
}));

const requestId = "123e4567-e89b-12d3-a456-426614174099";

const createMockDb = () => {
	type QuerySection = {
		findFirst: jest.Mock;
		findMany: jest.Mock;
	};
	type MockDb = Record<string, jest.Mock> & {
		query: Record<string, QuerySection>;
	};

	const chain = {} as MockDb;

	for (const method of ["insert", "values", "update", "set", "where", "returning"]) {
		chain[method] = jest.fn().mockReturnValue(chain);
	}

	chain.query = {};

	return chain;
};

describe("VercelPreviewService", () => {
	let service: VercelPreviewService;
	let mockDb: ReturnType<typeof createMockDb>;
	let configService: { get: jest.Mock };
	let fetchMock: jest.Mock;

	beforeEach(() => {
		mockDb = createMockDb();
		configService = {
			get: jest.fn((key: string) => {
				if (key === "VERCEL_TOKEN") {
					return "vercel-token";
				}
				if (key === "VERCEL_TEAM_ID") {
					return "team_123";
				}
				return undefined;
			}),
		};
		service = new VercelPreviewService(mockDb as never, configService as never);
		fetchMock = jest.fn();
		global.fetch = fetchMock as never;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it("stores the preview url after a successful vercel deployment", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({
				id: "dep_1",
				url: "req-1-git-main.vercel.app",
				readyState: "READY",
				state: "READY",
			}),
		});

		const preview = await service.deployPreview({
			featureRequestId: requestId,
			branchName: "codex/feature-studio-req-1",
			projectId: "prj_1",
			projectName: "superbuilder-web",
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.vercel.com/v13/deployments?teamId=team_123",
			expect.objectContaining({
				method: "POST",
			}),
		);
		expect(preview.url).toContain("vercel.app");
		expect(mockDb.update).toHaveBeenCalled();
	});

	it("requires a vercel token", async () => {
		configService.get.mockReturnValue(undefined);

		await expect(
			service.deployPreview({
				featureRequestId: requestId,
				branchName: "codex/feature-studio-req-1",
				projectId: "prj_1",
				projectName: "superbuilder-web",
			}),
		).rejects.toBeInstanceOf(BadRequestException);
	});
});
