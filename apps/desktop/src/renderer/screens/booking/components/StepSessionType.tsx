import { Badge } from "@superset/ui/badge";
import { RadioGroup, RadioGroupItem } from "@superset/ui/radio-group";
import { HiOutlineExclamationCircle } from "react-icons/hi2";
import { SESSION_TYPES } from "../constants";

interface StepSessionTypeProps {
	people: string;
	value: string;
	onChange: (v: string) => void;
}

export function StepSessionType({
	people,
	value,
	onChange,
}: StepSessionTypeProps) {
	const options = SESSION_TYPES[people] ?? [];

	return (
		<div className="space-y-6">
			<div className="space-y-2 text-center">
				<h2 className="text-2xl font-bold">세션 타입을 선택하세요</h2>
				<p className="text-muted-foreground">
					{people === "1" && "1인 참여 시 선택 가능한 세션입니다"}
					{people === "2" && "2인 참여 시 선택 가능한 세션입니다"}
					{people === "3+" && "3인 이상은 그룹 세션만 선택 가능합니다"}
				</p>
			</div>

			<RadioGroup
				value={value}
				onValueChange={onChange}
				className="mx-auto max-w-lg gap-4"
			>
				{options.map((opt) => (
					<label
						key={opt.value}
						className={`
              group cursor-pointer rounded-xl border p-5 transition-all
              ${value === opt.value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:border-muted-foreground/30 hover:bg-muted/30"}
            `}
					>
						<div className="flex items-start gap-4">
							<RadioGroupItem value={opt.value} className="mt-1" />
							<div className="flex-1 space-y-2">
								<div className="flex items-center justify-between">
									<span className={`text-lg font-semibold ${opt.colorClass}`}>
										{opt.label}
									</span>
									<Badge variant="secondary" className="font-mono">
										{opt.duration}
									</Badge>
								</div>
								<p className="text-muted-foreground text-sm">
									{opt.description}
								</p>
								<span className="text-lg font-bold">{opt.price}</span>
								{opt.note && (
									<div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
										<HiOutlineExclamationCircle className="size-3.5 shrink-0" />
										{opt.note}
									</div>
								)}
							</div>
						</div>
					</label>
				))}
			</RadioGroup>
		</div>
	);
}
