import { execFileSync } from "node:child_process";
import { WorktreeExecutionService } from "./worktree-execution.service";

jest.mock("node:child_process", () => ({
	execFileSync: jest.fn(),
}));

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
	};

	chain._queueResolve = (method, value) => {
		queue.push({ method, value });
	};
	chain._resetQueue = () => {
		queue.length = 0;
	};

	return chain;
};

describe("WorktreeExecutionService", () => {
	let service: WorktreeExecutionService;
	let mockDb: ReturnType<typeof createMockDb>;
	let configService: { get: jest.Mock };
	const execFileSyncMock = jest.mocked(execFileSync);

	beforeEach(() => {
		mockDb = createMockDb();
		configService = {
			get: jest.fn((key: string) => {
				if (key === "FEATURE_STUDIO_REPO_ROOT") {
					return "/repo";
				}
				if (key === "FEATURE_STUDIO_WORKTREE_BASE") {
					return "/tmp/feature-studio-worktrees";
				}
				if (key === "FEATURE_STUDIO_BASE_BRANCH") {
					return "main";
				}
				return undefined;
			}),
		};
		service = new WorktreeExecutionService(mockDb as never, configService as never);
		execFileSyncMock.mockReset();
	});

	afterEach(() => {
		jest.clearAllMocks();
		mockDb._resetQueue();
	});

	it("creates one worktree per request and stores branch metadata", async () => {
		mockDb.query.featureRequests.findFirst.mockResolvedValue({
			id: requestId,
			createdById: userId,
			status: "plan_approved",
		});
		execFileSyncMock.mockImplementation((command, args) => {
			if (command !== "git") {
				throw new Error("Unexpected command");
			}
			if (Array.isArray(args) && args[0] === "rev-parse" && args[1] === "HEAD") {
				return Buffer.from("abc123\n");
			}
			return Buffer.from("");
		});
		mockDb._queueResolve("returning", [
			{ id: requestId, status: "implementing" },
		]);

		const result = await service.prepareWorktree({
			featureRequestId: requestId,
			branchName: "codex/feature-studio-req-1",
			baseBranch: "main",
		});

		expect(execFileSyncMock).toHaveBeenCalledWith(
			"git",
			expect.arrayContaining([
				"worktree",
				"add",
				"/tmp/feature-studio-worktrees/codex-feature-studio-req-1",
				"-b",
				"codex/feature-studio-req-1",
				"main",
			]),
			expect.objectContaining({ cwd: "/repo" }),
		);
		expect(result.branchName).toBe("codex/feature-studio-req-1");
		expect(result.worktreePath).toBe(
			"/tmp/feature-studio-worktrees/codex-feature-studio-req-1",
		);
		expect(result.headCommitSha).toBe("abc123");
	});

	it("stores the verified commit after verification completes", async () => {
		mockDb._queueResolve("returning", [
			{ id: requestId, status: "preview_deploying" },
		]);

		const result = await service.markVerified({
			featureRequestId: requestId,
			verifiedCommitSha: "sha_123",
			report: "typecheck passed",
		});

		expect(mockDb.update).toHaveBeenCalled();
		expect(result.status).toBe("preview_deploying");
	});
});
