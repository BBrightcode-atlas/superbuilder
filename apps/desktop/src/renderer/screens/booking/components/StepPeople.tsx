import { Badge } from "@superset/ui/badge";
import { RadioGroup, RadioGroupItem } from "@superset/ui/radio-group";
import { Separator } from "@superset/ui/separator";
import { HiOutlineUsers } from "react-icons/hi2";
import { PEOPLE_OPTIONS } from "../constants";

function ComparisonTable() {
	return (
		<div className="overflow-hidden rounded-lg border">
			<table className="w-full text-sm">
				<thead>
					<tr className="bg-muted/50">
						<th className="px-4 py-3 text-left font-medium">세션 종류</th>
						<th className="px-4 py-3 text-center font-medium">
							<span className="text-muted-foreground line-through">이전</span>
						</th>
						<th className="px-4 py-3 text-center font-medium">
							<Badge variant="default">NEW</Badge>
						</th>
					</tr>
				</thead>
				<tbody className="divide-y">
					<tr className="transition-colors hover:bg-muted/30">
						<td className="px-4 py-3 font-medium">프리미엄 프라이빗</td>
						<td className="text-muted-foreground px-4 py-3 text-center">—</td>
						<td className="px-4 py-3 text-center font-semibold text-emerald-400">
							80분
						</td>
					</tr>
					<tr className="transition-colors hover:bg-muted/30">
						<td className="px-4 py-3 font-medium">레귤러 프라이빗</td>
						<td className="text-muted-foreground px-4 py-3 text-center">
							70분
						</td>
						<td className="px-4 py-3 text-center font-semibold text-emerald-400">
							50분
						</td>
					</tr>
					<tr className="transition-colors hover:bg-muted/30">
						<td className="px-4 py-3 font-medium">그룹 세션</td>
						<td className="text-muted-foreground px-4 py-3 text-center">
							70분
						</td>
						<td className="px-4 py-3 text-center font-semibold text-emerald-400">
							60분 <span className="text-muted-foreground text-xs">(2인)</span>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
}

interface StepPeopleProps {
	value: string;
	onChange: (v: string) => void;
}

export function StepPeople({ value, onChange }: StepPeopleProps) {
	return (
		<div className="space-y-6">
			<div className="space-y-2 text-center">
				<h2 className="text-2xl font-bold">몇 분이 참여하시나요?</h2>
				<p className="text-muted-foreground">
					인원에 따라 선택 가능한 세션이 달라집니다
				</p>
			</div>

			<RadioGroup
				value={value}
				onValueChange={onChange}
				className="mx-auto max-w-md gap-3"
			>
				{PEOPLE_OPTIONS.map((opt) => (
					<label
						key={opt.value}
						className={`
              flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-all
              ${value === opt.value ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:border-muted-foreground/30 hover:bg-muted/30"}
            `}
					>
						<RadioGroupItem value={opt.value} />
						<div className="flex-1">
							<div className="font-semibold">{opt.label}</div>
							<div className="text-muted-foreground text-sm">
								{opt.description}
							</div>
						</div>
						<HiOutlineUsers className="text-muted-foreground size-5" />
					</label>
				))}
			</RadioGroup>

			<Separator />

			<div className="space-y-3">
				<h3 className="text-center text-sm font-medium">세션 시스템 비교</h3>
				<ComparisonTable />
			</div>
		</div>
	);
}
