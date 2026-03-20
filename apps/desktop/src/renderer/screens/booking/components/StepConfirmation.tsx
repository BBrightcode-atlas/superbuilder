import { Card, CardContent, CardHeader, CardTitle } from "@superset/ui/card";
import { Separator } from "@superset/ui/separator";
import {
	HiOutlineCheckCircle,
	HiOutlineExclamationCircle,
	HiOutlineMapPin,
} from "react-icons/hi2";
import { type ContactForm, SESSION_TYPES } from "../constants";

interface StepConfirmationProps {
	people: string;
	sessionType: string;
	date: Date | undefined;
	time: string;
	form: ContactForm;
}

export function StepConfirmation({
	people,
	sessionType,
	date,
	time,
	form,
}: StepConfirmationProps) {
	const sessionOptions = SESSION_TYPES[people] ?? [];
	const selected = sessionOptions.find((s) => s.value === sessionType);

	return (
		<div className="space-y-6">
			<div className="space-y-3 text-center">
				<div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
					<HiOutlineCheckCircle className="size-8 text-emerald-400" />
				</div>
				<h2 className="text-2xl font-bold">예약이 확정되었습니다!</h2>
				<p className="text-muted-foreground">
					확인 이메일이 {form.email || "입력한 이메일"}로 발송됩니다
				</p>
			</div>

			<Card className="mx-auto max-w-md">
				<CardHeader>
					<CardTitle className="text-base">예약 상세</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<div className="flex justify-between">
						<span className="text-muted-foreground">예약자</span>
						<span className="font-medium">{form.name || "—"}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">세션</span>
						<span className="font-medium">{selected?.label ?? "—"}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">시간</span>
						<span className="font-medium">{selected?.duration ?? "—"}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">날짜</span>
						<span className="font-medium">
							{date
								? `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`
								: "—"}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">시작 시간</span>
						<span className="font-mono font-medium">{time || "—"}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">인원</span>
						<span className="font-medium">
							{people === "3+" ? "3명+" : `${people}명`}
						</span>
					</div>
					<Separator />
					<div className="flex justify-between">
						<span className="text-muted-foreground">연락처</span>
						<span className="font-medium">{form.phone || "—"}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">이메일</span>
						<span className="font-medium">{form.email || "—"}</span>
					</div>
				</CardContent>
			</Card>

			<div className="mx-auto max-w-md space-y-3">
				<Card className="bg-muted/50">
					<CardContent className="space-y-2 text-sm">
						<div className="flex items-start gap-2">
							<HiOutlineMapPin className="mt-0.5 size-4 text-emerald-400" />
							<div>
								<p className="font-medium">장소</p>
								<p className="text-muted-foreground">
									예약 확인 이메일에서 상세 주소를 확인하세요
								</p>
							</div>
						</div>
						<div className="flex items-start gap-2">
							<HiOutlineExclamationCircle className="mt-0.5 size-4 text-amber-400" />
							<div>
								<p className="font-medium">취소 정책</p>
								<p className="text-muted-foreground">
									세션 24시간 전까지 무료 취소 가능
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
