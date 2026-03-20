import { Button } from "@superset/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@superset/ui/card";
import { Separator } from "@superset/ui/separator";
import {
	HiOutlineCreditCard,
	HiOutlineExclamationCircle,
} from "react-icons/hi2";
import { SESSION_TYPES } from "../constants";

interface StepPaymentProps {
	people: string;
	sessionType: string;
}

export function StepPayment({ people, sessionType }: StepPaymentProps) {
	const sessionOptions = SESSION_TYPES[people] ?? [];
	const selected = sessionOptions.find((s) => s.value === sessionType);
	const headcount = people === "3+" ? 3 : Number(people);
	const depositPerPerson = 80;
	const totalDeposit = depositPerPerson * headcount;

	return (
		<div className="space-y-6">
			<div className="space-y-2 text-center">
				<h2 className="text-2xl font-bold">사전 결제 안내</h2>
				<p className="text-muted-foreground">
					예약 확정을 위해 선결제가 필요합니다
				</p>
			</div>

			<div className="mx-auto max-w-md space-y-4">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">결제 요약</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">세션</span>
							<span className="font-medium">{selected?.label ?? "—"}</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">인원</span>
							<span className="font-medium">{headcount}명</span>
						</div>
						<Separator />
						<div className="flex justify-between text-sm">
							<span className="text-muted-foreground">선결제 (1인당)</span>
							<span className="font-mono font-semibold">
								USD ${depositPerPerson}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="font-medium">총 선결제 금액</span>
							<span className="text-primary text-xl font-bold">
								USD ${totalDeposit}
							</span>
						</div>
					</CardContent>
				</Card>

				<Card className="border-amber-500/20 bg-amber-500/5">
					<CardContent className="space-y-3 text-sm">
						<div className="flex items-start gap-2">
							<HiOutlineCreditCard className="mt-0.5 size-4 text-amber-400" />
							<div>
								<p className="font-medium text-amber-200">결제 방법</p>
								<p className="text-muted-foreground">PayPal 또는 계좌이체</p>
							</div>
						</div>
						<Separator className="bg-amber-500/10" />
						<div className="flex items-start gap-2">
							<HiOutlineExclamationCircle className="mt-0.5 size-4 text-amber-400" />
							<div>
								<p className="font-medium text-amber-200">잔금 안내</p>
								<p className="text-muted-foreground">
									잔금은 방문 시 KRW(원화)로 결제합니다
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<div className="flex gap-3">
					<Button variant="outline" className="flex-1">
						PayPal 결제
					</Button>
					<Button variant="outline" className="flex-1">
						계좌이체 안내
					</Button>
				</div>
			</div>
		</div>
	);
}
