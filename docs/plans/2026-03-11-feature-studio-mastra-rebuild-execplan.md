# Feature Studio Mastra Rebuild Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a new persistent `feature-studio` system that turns conversations into durable specs, approvals, isolated worktree implementations, Vercel preview reviews, and final feature registration.

**Architecture:** Add a new `feature-studio` server feature in `packages/features-server` backed by new Postgres tables in `packages/drizzle`, then drive status transitions through a DB-backed orchestration layer that uses Mastra for generation steps and explicit approval gates for pause and resume. Keep implementation execution server-side, create one worktree per feature request, deploy preview builds to Vercel, and surface the full queue and review flow inside the desktop `atlas` area.

**Tech Stack:** Drizzle ORM + Postgres, Nest/tRPC in `packages/features-server`, Mastra in `packages/agent`, Bun/Jest, desktop renderer with TanStack Router/React Query, Vercel preview API.

---

### Task 1: Add durable Feature Studio schema and status enums

**Files:**
- Create: `/Users/bright/Projects/superbuilder/packages/drizzle/src/schema/features/feature-studio/index.ts`
- Modify: `/Users/bright/Projects/superbuilder/packages/drizzle/src/schema/index.ts`
- Modify: `/Users/bright/Projects/superbuilder/packages/drizzle/src/schema-registry.ts`
- Modify: `/Users/bright/Projects/superbuilder/packages/drizzle/drizzle.config.ts`
- Test: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/service/feature-request.service.spec.ts`

**Step 1: Write the failing repository test**

```ts
it("creates a feature request with draft status and empty approval queue", async () => {
  mockDb.insert.mockResolvedValueOnce([{ id: "req_1", status: "draft" }]);

  const result = await service.createRequest({
    title: "Lead capture widget",
    rawPrompt: "Build a reusable lead capture widget feature",
    createdById: userId,
  });

  expect(result.status).toBe("draft");
  expect(mockDb.insert).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/features-server test -- feature-request.service.spec.ts --runInBand`

Expected: FAIL with `Cannot find module '../feature-studio/service/feature-request.service'` or missing schema exports.

**Step 3: Add the new schema with explicit durable state**

```ts
export const featureRequestStatusEnum = pgEnum("feature_request_status", [
  "draft",
  "spec_ready",
  "pending_spec_approval",
  "plan_approved",
  "implementing",
  "verifying",
  "preview_deploying",
  "agent_qa",
  "pending_human_qa",
  "customization",
  "pending_registration",
  "registered",
  "failed",
  "discarded",
]);

export const featureRequests = pgTable("feature_requests", {
  ...baseColumns(),
  title: varchar("title", { length: 200 }).notNull(),
  summary: text("summary"),
  rawPrompt: text("raw_prompt").notNull(),
  status: featureRequestStatusEnum("status").notNull().default("draft"),
  rulesetReference: text("ruleset_reference"),
  createdById: uuid("created_by_id").notNull().references(() => profiles.id),
});
```

Add companion tables in the same file:

- `feature_request_messages`
- `feature_request_artifacts`
- `feature_request_approvals`
- `feature_request_runs`
- `feature_request_worktrees`
- `feature_registrations`

Also export relations and inferred types from the same schema file.

**Step 4: Re-export and register the schema**

Add exports in:

- `/Users/bright/Projects/superbuilder/packages/drizzle/src/schema/index.ts`
- `/Users/bright/Projects/superbuilder/packages/drizzle/src/schema-registry.ts`

Add the new public table names to `tablesFilter` in `/Users/bright/Projects/superbuilder/packages/drizzle/drizzle.config.ts`.

**Step 5: Run schema/type verification**

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/drizzle check-types`

Expected: PASS

**Step 6: Commit**

```bash
git add packages/drizzle/src/schema/features/feature-studio/index.ts \
  packages/drizzle/src/schema/index.ts \
  packages/drizzle/src/schema-registry.ts \
  packages/drizzle/drizzle.config.ts
git commit -m "feat: add feature studio database schema"
```

### Task 2: Create the Feature Studio server feature and basic request APIs

**Files:**
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/index.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/feature-studio.module.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/dto/create-feature-request.dto.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/dto/approval.dto.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/service/feature-request.service.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/service/feature-request.service.spec.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/trpc/feature-studio.route.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/trpc/index.ts`
- Modify: `/Users/bright/Projects/superbuilder/packages/features-server/app-router.ts`
- Modify: `/Users/bright/Projects/superbuilder/packages/features-server/package.json`

**Step 1: Write the failing service and route tests**

```ts
it("lists pending approvals separately from in-progress requests", async () => {
  mockDb.query.featureRequestApprovals.findMany.mockResolvedValue([
    { id: "appr_1", approvalType: "spec_plan", status: "pending" },
  ]);

  const result = await service.listQueue({ status: "pending" });

  expect(result.pendingApprovals).toHaveLength(1);
});

it("creates a request through tRPC", async () => {
  const caller = featureStudioRouter.createCaller(mockCtx);
  const result = await caller.createRequest({
    title: "Lead capture widget",
    rawPrompt: "Build a reusable lead capture widget",
  });

  expect(result.status).toBe("draft");
});
```

**Step 2: Run tests to verify they fail**

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/features-server test -- feature-studio --runInBand`

Expected: FAIL with missing module or router errors.

**Step 3: Implement a minimal request service**

```ts
export class FeatureRequestService {
  async createRequest(input: CreateFeatureRequestDto, userId: string) {
    const [created] = await this.db
      .insert(featureRequests)
      .values({
        title: input.title,
        rawPrompt: input.rawPrompt,
        summary: input.summary ?? null,
        rulesetReference: input.rulesetReference ?? null,
        createdById: userId,
      })
      .returning();

    return created;
  }

  async listQueue() {
    const [requests, approvals] = await Promise.all([
      this.db.query.featureRequests.findMany(),
      this.db.query.featureRequestApprovals.findMany(),
    ]);

    return { requests, pendingApprovals: approvals.filter((a) => a.status === "pending") };
  }
}
```

**Step 4: Add the feature module and tRPC contract**

Expose the first server-side procedures:

- `createRequest`
- `getRequest`
- `listRequests`
- `listQueue`
- `listApprovals`
- `respondToApproval`
- `appendMessage`

Wire the new router into `/Users/bright/Projects/superbuilder/packages/features-server/app-router.ts` and add the package export in `/Users/bright/Projects/superbuilder/packages/features-server/package.json`.

**Step 5: Run tests and typecheck**

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/features-server test -- feature-studio --runInBand`

Expected: PASS

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/features-server check-types`

Expected: PASS

**Step 6: Commit**

```bash
git add packages/features-server/features/feature-studio \
  packages/features-server/app-router.ts \
  packages/features-server/package.json
git commit -m "feat: add feature studio request and approval APIs"
```

### Task 3: Add DB-backed orchestration and Mastra generation entrypoints

**Files:**
- Create: `/Users/bright/Projects/superbuilder/packages/agent/src/feature-studio/index.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/agent/src/feature-studio/generate-spec.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/agent/src/feature-studio/generate-plan.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/service/feature-studio-runner.service.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/service/feature-studio-runner.service.spec.ts`
- Modify: `/Users/bright/Projects/superbuilder/packages/agent/src/index.ts`
- Modify: `/Users/bright/Projects/superbuilder/packages/agent/src/superagent.ts`

**Step 1: Write the failing orchestration tests**

```ts
it("moves a request from draft to pending_spec_approval after spec and plan generation", async () => {
  specGenerator.mockResolvedValue("# Spec");
  planGenerator.mockResolvedValue("# Plan");

  await runner.advance(requestId, "collect_intent");

  expect(mockDb.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: "pending_spec_approval" }),
  );
});
```

**Step 2: Run tests to verify they fail**

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/features-server test -- feature-studio-runner.service.spec.ts --runInBand`

Expected: FAIL with missing runner or Mastra entrypoints.

**Step 3: Add minimal Mastra-backed generators**

```ts
export async function generateFeatureStudioSpec(input: {
  rawPrompt: string;
  rulesContext: string;
}) {
  return superagent.generate(
    `Generate a feature spec using these rules:\n${input.rulesContext}\n\n${input.rawPrompt}`,
  );
}
```

Create a matching `generateFeatureStudioPlan` helper that returns a plan string with impacted files and test strategy.

Keep phase 1 orchestration DB-backed:

- persist `feature_request_runs.workflow_step`
- persist generated artifacts in `feature_request_artifacts`
- persist approval records in `feature_request_approvals`
- treat DB state as the resume source of truth

**Step 4: Implement the runner**

The runner should expose:

- `start(requestId)`
- `advance(requestId, step?)`
- `resumeAfterApproval(requestId, approvalId, decision)`

Minimal transition logic:

```ts
switch (request.status) {
  case "draft":
    return this.generateSpecAndPlan(requestId);
  case "plan_approved":
    return this.enqueueImplementation(requestId);
  case "pending_human_qa":
    return this.waitForHumanDecision(requestId);
}
```

**Step 5: Run tests and package checks**

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/features-server test -- feature-studio-runner.service.spec.ts --runInBand`

Expected: PASS

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/agent typecheck`

Expected: PASS

**Step 6: Commit**

```bash
git add packages/agent/src/feature-studio \
  packages/agent/src/index.ts \
  packages/agent/src/superagent.ts \
  packages/features-server/features/feature-studio/service/feature-studio-runner.service.ts \
  packages/features-server/features/feature-studio/service/feature-studio-runner.service.spec.ts
git commit -m "feat: add feature studio orchestration runner"
```

### Task 4: Add worktree execution, verification, and server-side Vercel preview deployment

**Files:**
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/service/worktree-execution.service.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/service/worktree-execution.service.spec.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/service/vercel-preview.service.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/service/vercel-preview.service.spec.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/service/browser-qa.service.ts`
- Modify: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/feature-studio.module.ts`
- Reference: `/Users/bright/Projects/superbuilder/apps/desktop/src/lib/trpc/routers/atlas/vercel.ts`

**Step 1: Write the failing execution tests**

```ts
it("creates one worktree per request and stores branch metadata", async () => {
  execFileSyncMock.mockReturnValue(undefined);

  await service.prepareWorktree({
    requestId,
    branchName: "codex/feature-studio-req_1",
    baseBranch: "main",
  });

  expect(execFileSyncMock).toHaveBeenCalledWith(
    "git",
    expect.arrayContaining(["worktree", "add"]),
    expect.any(Object),
  );
});

it("stores the preview url after a successful vercel deployment", async () => {
  fetchMock.mockResolvedValue(mockVercelResponse("https://req-1-git-main.vercel.app"));

  const preview = await previewService.deployPreview({ requestId, branchName: "codex/feature-studio-req_1" });

  expect(preview.url).toContain("vercel.app");
});
```

**Step 2: Run tests to verify they fail**

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/features-server test -- worktree-execution.service.spec.ts vercel-preview.service.spec.ts --runInBand`

Expected: FAIL with missing services.

**Step 3: Implement isolated execution**

Use the existing `agent-desk` executor and desktop worktree helpers only as reference. The new service must be server-owned and request-scoped.

```ts
await execFileSync("git", [
  "worktree",
  "add",
  worktreePath,
  "-b",
  branchName,
  baseBranch,
], { cwd: repoRoot });
```

Persist:

- worktree path
- branch
- current commit
- last verified commit
- execution logs

**Step 4: Implement verification and preview deployment**

Use server-side env credentials first:

- `VERCEL_TOKEN`
- optional `VERCEL_TEAM_ID`

Create a slim Vercel client inside `vercel-preview.service.ts` modeled after the existing desktop atlas router, but persist results to `feature_request_worktrees` and `feature_request_artifacts`.

**Step 5: Add agent browser QA**

Create `browser-qa.service.ts` that:

- opens the preview URL,
- checks one or more declared acceptance paths,
- stores a structured artifact:

```ts
type AgentQaReport = {
  previewUrl: string;
  checks: Array<{ label: string; status: "passed" | "failed"; note?: string }>;
  summary: string;
};
```

**Step 6: Run tests and typecheck**

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/features-server test -- worktree-execution.service.spec.ts vercel-preview.service.spec.ts --runInBand`

Expected: PASS

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/features-server check-types`

Expected: PASS

**Step 7: Commit**

```bash
git add packages/features-server/features/feature-studio/service/worktree-execution.service.ts \
  packages/features-server/features/feature-studio/service/worktree-execution.service.spec.ts \
  packages/features-server/features/feature-studio/service/vercel-preview.service.ts \
  packages/features-server/features/feature-studio/service/vercel-preview.service.spec.ts \
  packages/features-server/features/feature-studio/service/browser-qa.service.ts \
  packages/features-server/features/feature-studio/feature-studio.module.ts
git commit -m "feat: add feature studio execution and preview services"
```

### Task 5: Add final registration flow and connect it to Feature Catalog

**Files:**
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/service/feature-registration.service.ts`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/service/feature-registration.service.spec.ts`
- Modify: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-catalog/server/service/feature-catalog.service.ts`
- Modify: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/trpc/feature-studio.route.ts`
- Reference: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-catalog/server/trpc/router.ts`

**Step 1: Write the failing registration tests**

```ts
it("creates a catalog feature only after registration approval", async () => {
  mockDb.query.featureRequestApprovals.findFirst.mockResolvedValue({
    approvalType: "registration",
    status: "approved",
  });

  await service.registerRequest(requestId);

  expect(featureCatalogService.create).toHaveBeenCalled();
});
```

**Step 2: Run tests to verify they fail**

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/features-server test -- feature-registration.service.spec.ts --runInBand`

Expected: FAIL with missing registration service.

**Step 3: Implement minimal registration gate**

```ts
if (registrationApproval.status !== "approved") {
  throw new BadRequestException("Registration approval is required");
}

await this.featureCatalogService.create({
  slug,
  name,
  description,
  isPublished: false,
  tags,
});
```

Persist a `feature_registrations` row with:

- registered commit SHA
- request ID
- catalog feature ID
- approving user

**Step 4: Expose final registration procedures**

Add to the feature-studio router:

- `requestRegistrationApproval`
- `registerRequest`
- `listReadyToRegister`

**Step 5: Run tests**

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/features-server test -- feature-registration.service.spec.ts --runInBand`

Expected: PASS

**Step 6: Commit**

```bash
git add packages/features-server/features/feature-studio/service/feature-registration.service.ts \
  packages/features-server/features/feature-studio/service/feature-registration.service.spec.ts \
  packages/features-server/features/feature-studio/trpc/feature-studio.route.ts \
  packages/features-server/features/feature-catalog/server/service/feature-catalog.service.ts
git commit -m "feat: add feature studio registration flow"
```

### Task 6: Add Atlas Studio queue and detail routes in desktop

**Files:**
- Modify: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/screens/atlas/components/AtlasSidebar.tsx`
- Create: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/routes/_authenticated/_dashboard/atlas/studio/page.tsx`
- Create: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/routes/_authenticated/_dashboard/atlas/studio/$requestId/page.tsx`
- Create: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/screens/atlas/components/FeatureStudioQueue/FeatureStudioQueue.tsx`
- Create: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/screens/atlas/components/FeatureStudioQueue/index.ts`
- Create: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/screens/atlas/components/FeatureStudioRequestDetail/FeatureStudioRequestDetail.tsx`
- Create: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/screens/atlas/components/FeatureStudioRequestDetail/index.ts`
- Test: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/screens/atlas/components/FeatureStudioQueue/FeatureStudioQueue.test.tsx`

**Step 1: Write the failing UI test**

```tsx
it("renders pending approvals and in-progress requests in separate sections", () => {
  render(
    <FeatureStudioQueue
      pendingApprovals={[{ id: "appr_1", approvalType: "spec_plan" }]}
      requests={[{ id: "req_1", status: "implementing", title: "Lead capture widget" }]}
    />,
  );

  expect(screen.getByText("Pending approvals")).toBeInTheDocument();
  expect(screen.getByText("Lead capture widget")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `bun --cwd /Users/bright/Projects/superbuilder/apps/desktop test FeatureStudioQueue.test.tsx`

Expected: FAIL with missing component or route.

**Step 3: Add the new Atlas Studio navigation**

Update `AtlasSidebar.tsx` to include:

- `Catalog`
- `Studio`
- `Composer`
- `Deployments`

Add a queue route at `/atlas/studio` and a detail route at `/atlas/studio/$requestId`.

Use the server client directly from the renderer:

```ts
const queue = useSuspenseQuery({
  queryKey: ["feature-studio", "queue"],
  queryFn: () => apiTrpcClient.featureStudio.listQueue.query(),
});
```

**Step 4: Build the first desktop surfaces**

Queue page should show:

- pending approvals,
- in-progress requests,
- ready-to-register requests,
- discarded/failed requests behind a filter.

Detail page should show:

- conversation summary,
- latest spec artifact,
- latest plan artifact,
- current preview URL,
- current approval state.

**Step 5: Run UI tests and typecheck**

Run: `bun --cwd /Users/bright/Projects/superbuilder/apps/desktop test FeatureStudioQueue.test.tsx`

Expected: PASS

Run: `bun --cwd /Users/bright/Projects/superbuilder/apps/desktop typecheck`

Expected: PASS

**Step 6: Commit**

```bash
git add apps/desktop/src/renderer/screens/atlas/components/AtlasSidebar.tsx \
  apps/desktop/src/renderer/routes/_authenticated/_dashboard/atlas/studio \
  apps/desktop/src/renderer/screens/atlas/components/FeatureStudioQueue \
  apps/desktop/src/renderer/screens/atlas/components/FeatureStudioRequestDetail
git commit -m "feat: add atlas studio queue and detail routes"
```

### Task 7: Add approval actions, preview review UX, and customization loop

**Files:**
- Create: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/screens/atlas/components/FeatureStudioApprovalPanel/FeatureStudioApprovalPanel.tsx`
- Create: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/screens/atlas/components/FeatureStudioApprovalPanel/index.ts`
- Create: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/screens/atlas/components/FeatureStudioPreviewCard/FeatureStudioPreviewCard.tsx`
- Create: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/screens/atlas/components/FeatureStudioPreviewCard/index.ts`
- Modify: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/screens/atlas/components/FeatureStudioRequestDetail/FeatureStudioRequestDetail.tsx`
- Reference: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/TabView/ChatMastraPane/ChatMastraInterface/components/ChatMastraMessageList/components/PendingPlanApprovalMessage/PendingPlanApprovalMessage.tsx`
- Test: `/Users/bright/Projects/superbuilder/apps/desktop/src/renderer/screens/atlas/components/FeatureStudioApprovalPanel/FeatureStudioApprovalPanel.test.tsx`

**Step 1: Write the failing approval UI test**

```tsx
it("submits an approval decision with optional feedback", async () => {
  const onApprove = vi.fn().mockResolvedValue(undefined);
  render(<FeatureStudioApprovalPanel mode="spec_plan" onApprove={onApprove} onReject={vi.fn()} />);

  await user.type(screen.getByPlaceholderText("Add feedback"), "Looks good");
  await user.click(screen.getByText("Approve"));

  expect(onApprove).toHaveBeenCalledWith({ feedback: "Looks good" });
});
```

**Step 2: Run test to verify it fails**

Run: `bun --cwd /Users/bright/Projects/superbuilder/apps/desktop test FeatureStudioApprovalPanel.test.tsx`

Expected: FAIL with missing panel.

**Step 3: Implement reusable approval and preview components**

Reuse the interaction pattern from the chat-mastra plan approval component, but bind it to feature-studio approvals:

```tsx
<FeatureStudioApprovalPanel
  mode="human_qa"
  onApprove={(input) => apiTrpcClient.featureStudio.respondToApproval.mutate({
    approvalId,
    action: "approved",
    feedback: input.feedback,
  })}
/>
```

Preview card requirements:

- open the Vercel preview in external browser,
- show preview URL and commit,
- show agent QA summary,
- show “request changes” and “approve for registration” actions.

Customization loop requirement:

- if reviewer requests changes, move request back to `customization`,
- allow the detail page to trigger `resumeAfterApproval`.

**Step 4: Run tests and desktop typecheck**

Run: `bun --cwd /Users/bright/Projects/superbuilder/apps/desktop test FeatureStudioApprovalPanel.test.tsx`

Expected: PASS

Run: `bun --cwd /Users/bright/Projects/superbuilder/apps/desktop typecheck`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/desktop/src/renderer/screens/atlas/components/FeatureStudioApprovalPanel \
  apps/desktop/src/renderer/screens/atlas/components/FeatureStudioPreviewCard \
  apps/desktop/src/renderer/screens/atlas/components/FeatureStudioRequestDetail/FeatureStudioRequestDetail.tsx
git commit -m "feat: add feature studio approval and preview review UI"
```

### Task 8: End-to-end verification, migration guardrails, and rollout documentation

**Files:**
- Modify: `/Users/bright/Projects/superbuilder/docs/plans/2026-03-11-feature-studio-mastra-rebuild-design.md`
- Create: `/Users/bright/Projects/superbuilder/docs/plans/2026-03-11-feature-studio-rollout-notes.md`
- Create: `/Users/bright/Projects/superbuilder/packages/features-server/features/feature-studio/service/feature-studio.e2e-spec.ts`
- Modify: `/Users/bright/Projects/superbuilder/packages/features-server/features/agent-desk/index.ts`

**Step 1: Write the failing end-to-end workflow test**

```ts
it("runs the happy path from request creation to pending registration", async () => {
  const request = await service.createRequest(...);
  await runner.start(request.id);
  await service.respondToApproval(specApprovalId, "approved");
  await runner.advance(request.id);

  expect(latestRequest.status).toBe("pending_registration");
});
```

**Step 2: Run test to verify it fails**

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/features-server test -- feature-studio.e2e-spec.ts --runInBand`

Expected: FAIL because one or more lifecycle steps are incomplete.

**Step 3: Add rollout guardrails**

- add a clear deprecation note to the old `agent-desk` export surface,
- do not delete old code in this pass,
- route all new work to `feature-studio`,
- document required env vars:
  - `DATABASE_URL`
  - `VERCEL_TOKEN`
  - `VERCEL_TEAM_ID` if used
  - repo/worktree base path

**Step 4: Run final verification suite**

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/features-server test -- feature-studio --runInBand`

Expected: PASS

Run: `bun --cwd /Users/bright/Projects/superbuilder/packages/features-server check-types`

Expected: PASS

Run: `bun --cwd /Users/bright/Projects/superbuilder/apps/desktop test FeatureStudio`

Expected: PASS

Run: `bun --cwd /Users/bright/Projects/superbuilder/apps/desktop typecheck`

Expected: PASS

**Step 5: Commit**

```bash
git add docs/plans/2026-03-11-feature-studio-mastra-rebuild-design.md \
  docs/plans/2026-03-11-feature-studio-rollout-notes.md \
  packages/features-server/features/feature-studio/service/feature-studio.e2e-spec.ts \
  packages/features-server/features/agent-desk/index.ts
git commit -m "docs: add feature studio rollout and verification notes"
```

## Implementation Notes

- Do not modify production database data directly. Add schema only and let the user generate migrations on a Neon branch.
- Do not wire Feature Studio state into `@superset/local-db`; keep local storage limited to renderer convenience state only.
- Keep Vercel preview creation server-side so the workflow remains valid when the desktop app closes.
- Treat `feature_request_runs` as the authoritative resume pointer in phase 1, even if Mastra runtime internals change.
- Leave `agent-desk` in place until Feature Studio reaches parity on create, approve, implement, preview, and register.

## Milestone Exit Criteria

- A request can be created from desktop and saved in Postgres.
- The system generates spec and plan and pauses in `pending_spec_approval`.
- A human can approve later from the queue even after restart.
- Approval resumes implementation in an isolated worktree.
- Verification and Vercel preview complete and store artifacts.
- Agent QA report is persisted and shown in desktop UI.
- Human QA can approve, request changes, or discard.
- Final registration creates a durable registration record and updates Feature Catalog.
