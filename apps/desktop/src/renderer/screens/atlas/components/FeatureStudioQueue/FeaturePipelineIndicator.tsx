const PIPELINE_STAGES = [
	{ key: "draft", label: "초안" },
	{ key: "spec_ready", label: "스펙" },
	{ key: "pending_spec_approval", label: "스펙 승인" },
	{ key: "plan_approved", label: "계획 승인" },
	{ key: "implementing", label: "구현" },
	{ key: "verifying", label: "검증" },
	{ key: "preview_deploying", label: "프리뷰" },
	{ key: "agent_qa", label: "AI QA" },
	{ key: "pending_human_qa", label: "수동 QA" },
	{ key: "customization", label: "커스텀" },
	{ key: "pending_registration", label: "등록 승인" },
	{ key: "registered", label: "등록 완료" },
] as const;

const TERMINAL_STATUSES = new Set(["failed", "discarded"]);

interface FeaturePipelineIndicatorProps {
	status: string;
}

export function FeaturePipelineIndicator({
	status,
}: FeaturePipelineIndicatorProps) {
	if (TERMINAL_STATUSES.has(status)) {
		return (
			<div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
				<span className="inline-block size-2 rounded-full bg-destructive" />
				{status === "failed" ? "실패" : "폐기"}
			</div>
		);
	}

	const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === status);

	return (
		<div className="flex items-center gap-0.5">
			{PIPELINE_STAGES.map((stage, i) => {
				const isDone = i < currentIndex;
				const isCurrent = i === currentIndex;

				return (
					<div key={stage.key} className="flex items-center gap-0.5">
						<div className="group relative flex flex-col items-center">
							<div
								className={`size-2.5 rounded-full transition-colors ${
									isCurrent
										? "bg-primary ring-2 ring-primary/30"
										: isDone
											? "bg-primary/60"
											: "bg-muted-foreground/20"
								}`}
							/>
							<div className="pointer-events-none absolute top-5 hidden whitespace-nowrap rounded bg-popover px-1.5 py-0.5 text-[10px] text-popover-foreground shadow-sm group-hover:block">
								{stage.label}
							</div>
						</div>
						{i < PIPELINE_STAGES.length - 1 ? (
							<div
								className={`h-px w-2 ${
									isDone ? "bg-primary/60" : "bg-muted-foreground/20"
								}`}
							/>
						) : null}
					</div>
				);
			})}
			<span className="ml-2 text-[10px] text-muted-foreground">
				{PIPELINE_STAGES[currentIndex >= 0 ? currentIndex : 0].label}
			</span>
		</div>
	);
}
