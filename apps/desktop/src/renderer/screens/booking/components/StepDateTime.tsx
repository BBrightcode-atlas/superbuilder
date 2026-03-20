import { Badge } from "@superset/ui/badge";
import { Button } from "@superset/ui/button";
import { Calendar } from "@superset/ui/calendar";
import { Card, CardContent } from "@superset/ui/card";
import { Label } from "@superset/ui/label";
import { HiOutlineCalendarDays, HiOutlineClock } from "react-icons/hi2";
import { TIME_SLOTS } from "../constants";

interface StepDateTimeProps {
	date: Date | undefined;
	onDateChange: (d: Date | undefined) => void;
	time: string;
	onTimeChange: (t: string) => void;
}

export function StepDateTime({
	date,
	onDateChange,
	time,
	onTimeChange,
}: StepDateTimeProps) {
	const today = new Date();

	return (
		<div className="space-y-6">
			<div className="space-y-2 text-center">
				<h2 className="text-2xl font-bold">날짜와 시간을 선택하세요</h2>
				<p className="text-muted-foreground">가능한 예약 타임만 표시됩니다</p>
			</div>

			<div className="mx-auto flex max-w-2xl flex-col items-start gap-6 md:flex-row">
				<Card className="flex-1">
					<CardContent>
						<Calendar
							mode="single"
							selected={date}
							onSelect={onDateChange}
							disabled={{ before: today }}
							className="mx-auto w-fit"
						/>
					</CardContent>
				</Card>

				<div className="flex w-full flex-1 flex-col gap-3 md:w-auto">
					<Label className="text-muted-foreground text-sm">
						{date
							? `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
							: "날짜를 먼저 선택하세요"}
					</Label>
					{date &&
						TIME_SLOTS.map((slot) => (
							<Button
								key={slot.time}
								variant={time === slot.time ? "default" : "outline"}
								disabled={!slot.available}
								onClick={() => onTimeChange(slot.time)}
								className="justify-between"
							>
								<div className="flex items-center gap-2">
									<HiOutlineClock className="size-4" />
									<span className="font-mono text-base">{slot.time}</span>
								</div>
								{!slot.available && (
									<Badge variant="secondary" className="text-xs">
										마감
									</Badge>
								)}
							</Button>
						))}
					{!date && (
						<div className="text-muted-foreground flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-sm">
							<HiOutlineCalendarDays className="mb-2 size-8 opacity-40" />
							왼쪽에서 날짜를 선택하세요
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
