"use client";

import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Calendar } from "@repo/ui/shadcn/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/shadcn/radio-group";
import { Separator } from "@repo/ui/shadcn/separator";
import {
	AlertCircle,
	ArrowRight,
	CalendarDays,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock,
	CreditCard,
	Crown,
	Mail,
	MapPin,
	Phone,
	UserCircle,
	Users,
	UsersRound,
	Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

// --- Constants ---

const STEPS = [
	{ id: 1, label: "인원 선택", icon: Users },
	{ id: 2, label: "세션 타입", icon: Zap },
	{ id: 3, label: "날짜 및 시간", icon: CalendarDays },
	{ id: 4, label: "개인정보", icon: UserCircle },
	{ id: 5, label: "결제 안내", icon: CreditCard },
	{ id: 6, label: "예약 확정", icon: CheckCircle2 },
] as const;

const PEOPLE_OPTIONS = [
	{ value: "1", label: "1인", description: "프라이빗 세션" },
	{ value: "2", label: "2인", description: "프라이빗 또는 그룹" },
	{ value: "3+", label: "3인 이상", description: "그룹 세션만 가능" },
] as const;

type SessionType = "premium-private" | "regular-private" | "group";

interface SessionOption {
	value: SessionType;
	label: string;
	duration: string;
	description: string;
	price: string;
	icon: typeof Crown;
	note?: string;
}

const SESSION_TYPES: Record<string, SessionOption[]> = {
	"1": [
		{
			value: "premium-private",
			label: "프리미엄 프라이빗",
			duration: "80분",
			description: "1:1 맞춤형 집중 세션",
			price: "₩180,000",
			icon: Crown,
		},
		{
			value: "regular-private",
			label: "레귤러 프라이빗",
			duration: "50분",
			description: "1:1 효율적인 세션",
			price: "₩120,000",
			icon: Zap,
		},
	],
	"2": [
		{
			value: "premium-private",
			label: "프리미엄 프라이빗",
			duration: "80분",
			description: "2인 맞춤형 집중 세션",
			price: "₩180,000 / 인",
			icon: Crown,
			note: "연속 2타임 예약 필요",
		},
		{
			value: "regular-private",
			label: "레귤러 프라이빗",
			duration: "50분",
			description: "2인 효율적인 세션",
			price: "₩120,000 / 인",
			icon: Zap,
			note: "연속 2타임 예약 필요",
		},
		{
			value: "group",
			label: "그룹 세션",
			duration: "60분",
			description: "2인 기준 1타임",
			price: "₩80,000 / 인",
			icon: UsersRound,
		},
	],
	"3+": [
		{
			value: "group",
			label: "그룹 세션",
			duration: "60분",
			description: "2인 기준, 인원에 따라 연속 타임 예약",
			price: "₩80,000 / 인",
			icon: UsersRound,
			note: "3인 이상은 연속 타임 여러 개 예약이 필요합니다",
		},
	],
};

const TIME_SLOTS = [
	{ time: "09:30", available: true },
	{ time: "10:50", available: true },
	{ time: "13:20", available: true },
	{ time: "14:50", available: false },
	{ time: "16:20", available: true },
];

// --- Components ---

function StepIndicator({
	currentStep,
	onStepClick,
}: {
	currentStep: number;
	onStepClick: (step: number) => void;
}) {
	return (
		<div className="flex items-center justify-center gap-1 sm:gap-2">
			{STEPS.map((step, index) => {
				const Icon = step.icon;
				const isActive = currentStep === step.id;
				const isCompleted = currentStep > step.id;

				return (
					<div key={step.id} className="flex items-center gap-1 sm:gap-2">
						<button
							type="button"
							onClick={() => isCompleted && onStepClick(step.id)}
							disabled={!isCompleted}
							className={`
                flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all
                sm:px-3 sm:py-2 sm:text-sm
                ${
									isActive
										? "bg-primary text-primary-foreground shadow-md"
										: isCompleted
											? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
											: "bg-muted text-muted-foreground"
								}
              `}
						>
							{isCompleted ? (
								<CheckCircle2 className="size-3.5 sm:size-4" />
							) : (
								<Icon className="size-3.5 sm:size-4" />
							)}
							<span className="hidden lg:inline">{step.label}</span>
						</button>
						{index < STEPS.length - 1 && (
							<ChevronRight className="text-muted-foreground size-3 sm:size-4" />
						)}
					</div>
				);
			})}
		</div>
	);
}

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
						<td className="px-4 py-3 font-medium">
							<div className="flex items-center gap-2">
								<Crown className="text-amber-400 size-4" />
								프리미엄 프라이빗
							</div>
						</td>
						<td className="text-muted-foreground px-4 py-3 text-center">—</td>
						<td className="px-4 py-3 text-center font-semibold text-emerald-400">
							80분
						</td>
					</tr>
					<tr className="transition-colors hover:bg-muted/30">
						<td className="px-4 py-3 font-medium">
							<div className="flex items-center gap-2">
								<Zap className="size-4 text-blue-400" />
								레귤러 프라이빗
							</div>
						</td>
						<td className="text-muted-foreground px-4 py-3 text-center">
							70분
						</td>
						<td className="px-4 py-3 text-center font-semibold text-emerald-400">
							50분
						</td>
					</tr>
					<tr className="transition-colors hover:bg-muted/30">
						<td className="px-4 py-3 font-medium">
							<div className="flex items-center gap-2">
								<UsersRound className="size-4 text-violet-400" />
								그룹 세션
							</div>
						</td>
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

function Step1People({
	value,
	onChange,
}: {
	value: string;
	onChange: (v: string) => void;
}) {
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
						<Users className="text-muted-foreground size-5" />
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

function Step2SessionType({
	people,
	value,
	onChange,
}: {
	people: string;
	value: string;
	onChange: (v: string) => void;
}) {
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
				{options.map((opt) => {
					const Icon = opt.icon;
					return (
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
										<div className="flex items-center gap-2">
											<Icon
												className={`size-5 ${
													opt.value === "premium-private"
														? "text-amber-400"
														: opt.value === "regular-private"
															? "text-blue-400"
															: "text-violet-400"
												}`}
											/>
											<span className="text-lg font-semibold">{opt.label}</span>
										</div>
										<Badge variant="secondary" className="font-mono">
											{opt.duration}
										</Badge>
									</div>
									<p className="text-muted-foreground text-sm">
										{opt.description}
									</p>
									<div className="flex items-center justify-between">
										<span className="text-lg font-bold">{opt.price}</span>
									</div>
									{opt.note && (
										<div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
											<AlertCircle className="size-3.5 shrink-0" />
											{opt.note}
										</div>
									)}
								</div>
							</div>
						</label>
					);
				})}
			</RadioGroup>
		</div>
	);
}

function Step3DateTime({
	date,
	onDateChange,
	time,
	onTimeChange,
}: {
	date: Date | undefined;
	onDateChange: (d: Date | undefined) => void;
	time: string;
	onTimeChange: (t: string) => void;
}) {
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
									<Clock className="size-4" />
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
							<CalendarDays className="mb-2 size-8 opacity-40" />
							왼쪽에서 날짜를 선택하세요
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function Step4ContactInfo({
	form,
	onChange,
}: {
	form: { name: string; phone: string; email: string };
	onChange: (field: string, value: string) => void;
}) {
	return (
		<div className="space-y-6">
			<div className="space-y-2 text-center">
				<h2 className="text-2xl font-bold">개인정보를 입력해주세요</h2>
				<p className="text-muted-foreground">예약 확인 이메일을 보내드립니다</p>
			</div>

			<div className="mx-auto max-w-md space-y-4">
				<div className="space-y-2">
					<Label htmlFor="name" className="flex items-center gap-1.5">
						<UserCircle className="size-4" />
						이름
					</Label>
					<Input
						id="name"
						placeholder="홍길동"
						value={form.name}
						onChange={(e) => onChange("name", e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="phone" className="flex items-center gap-1.5">
						<Phone className="size-4" />
						연락처
					</Label>
					<Input
						id="phone"
						type="tel"
						placeholder="010-1234-5678"
						value={form.phone}
						onChange={(e) => onChange("phone", e.target.value)}
					/>
				</div>

				<div className="space-y-2">
					<Label htmlFor="email" className="flex items-center gap-1.5">
						<Mail className="size-4" />
						이메일
					</Label>
					<Input
						id="email"
						type="email"
						placeholder="example@email.com"
						value={form.email}
						onChange={(e) => onChange("email", e.target.value)}
					/>
				</div>
			</div>
		</div>
	);
}

function Step5Payment({
	people,
	sessionType,
}: {
	people: string;
	sessionType: string;
}) {
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
							<CreditCard className="mt-0.5 size-4 text-amber-400" />
							<div>
								<p className="font-medium text-amber-200">결제 방법</p>
								<p className="text-muted-foreground">PayPal 또는 계좌이체</p>
							</div>
						</div>
						<Separator className="bg-amber-500/10" />
						<div className="flex items-start gap-2">
							<AlertCircle className="mt-0.5 size-4 text-amber-400" />
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

function Step6Confirmation({
	people,
	sessionType,
	date,
	time,
	form,
}: {
	people: string;
	sessionType: string;
	date: Date | undefined;
	time: string;
	form: { name: string; phone: string; email: string };
}) {
	const sessionOptions = SESSION_TYPES[people] ?? [];
	const selected = sessionOptions.find((s) => s.value === sessionType);

	return (
		<div className="space-y-6">
			<div className="space-y-3 text-center">
				<div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
					<CheckCircle2 className="size-8 text-emerald-400" />
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
							<MapPin className="mt-0.5 size-4 text-emerald-400" />
							<div>
								<p className="font-medium">장소</p>
								<p className="text-muted-foreground">
									예약 확인 이메일에서 상세 주소를 확인하세요
								</p>
							</div>
						</div>
						<div className="flex items-start gap-2">
							<AlertCircle className="mt-0.5 size-4 text-amber-400" />
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

// --- Main Page ---

export default function BookingPage() {
	const [step, setStep] = useState(1);
	const [people, setPeople] = useState("");
	const [sessionType, setSessionType] = useState("");
	const [date, setDate] = useState<Date | undefined>();
	const [time, setTime] = useState("");
	const [contactForm, setContactForm] = useState({
		name: "",
		phone: "",
		email: "",
	});

	const handleContactChange = (field: string, value: string) => {
		setContactForm((prev) => ({ ...prev, [field]: value }));
	};

	const canProceed = useMemo(() => {
		switch (step) {
			case 1:
				return !!people;
			case 2:
				return !!sessionType;
			case 3:
				return !!date && !!time;
			case 4:
				return !!contactForm.name && !!contactForm.phone && !!contactForm.email;
			case 5:
				return true;
			default:
				return false;
		}
	}, [step, people, sessionType, date, time, contactForm]);

	const handleNext = () => {
		if (step < 6 && canProceed) {
			setStep((s) => s + 1);
		}
	};

	const handlePrev = () => {
		if (step > 1) {
			setStep((s) => s - 1);
		}
	};

	// Reset session type when people changes
	const handlePeopleChange = (v: string) => {
		setPeople(v);
		setSessionType("");
	};

	return (
		<main className="relative min-h-screen overflow-hidden">
			{/* Background gradient */}
			<div className="pointer-events-none absolute inset-0 -z-10">
				<div className="absolute top-0 left-1/2 size-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-primary/8 to-transparent blur-3xl" />
				<div className="absolute bottom-0 right-0 size-[600px] translate-x-1/4 translate-y-1/4 rounded-full bg-gradient-to-t from-violet-500/5 to-transparent blur-3xl" />
			</div>

			<div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-20">
				{/* Header */}
				<div className="mb-10 space-y-2 text-center">
					<Badge variant="secondary" className="mb-4">
						<CalendarDays className="mr-1 size-3" />
						Session Booking
					</Badge>
					<h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
						세션 예약
					</h1>
					<p className="text-muted-foreground">
						맞춤형 세션을 예약하고 최고의 경험을 만나보세요
					</p>
				</div>

				{/* Step Indicator */}
				<div className="mb-8">
					<StepIndicator currentStep={step} onStepClick={setStep} />
				</div>

				{/* Step Content */}
				<Card className="mb-8">
					<CardContent className="p-6 sm:p-8">
						{step === 1 && (
							<Step1People value={people} onChange={handlePeopleChange} />
						)}
						{step === 2 && (
							<Step2SessionType
								people={people}
								value={sessionType}
								onChange={setSessionType}
							/>
						)}
						{step === 3 && (
							<Step3DateTime
								date={date}
								onDateChange={setDate}
								time={time}
								onTimeChange={setTime}
							/>
						)}
						{step === 4 && (
							<Step4ContactInfo
								form={contactForm}
								onChange={handleContactChange}
							/>
						)}
						{step === 5 && (
							<Step5Payment people={people} sessionType={sessionType} />
						)}
						{step === 6 && (
							<Step6Confirmation
								people={people}
								sessionType={sessionType}
								date={date}
								time={time}
								form={contactForm}
							/>
						)}
					</CardContent>
				</Card>

				{/* Navigation */}
				{step < 6 && (
					<div className="flex items-center justify-between">
						<Button variant="ghost" onClick={handlePrev} disabled={step === 1}>
							<ChevronLeft className="mr-1 size-4" />
							이전
						</Button>
						<div className="text-muted-foreground text-sm">{step} / 6</div>
						<Button onClick={handleNext} disabled={!canProceed}>
							{step === 5 ? "예약 확정" : "다음"}
							<ArrowRight className="ml-1 size-4" />
						</Button>
					</div>
				)}

				{step === 6 && (
					<div className="text-center">
						<Button
							variant="outline"
							onClick={() => {
								setStep(1);
								setPeople("");
								setSessionType("");
								setDate(undefined);
								setTime("");
								setContactForm({ name: "", phone: "", email: "" });
							}}
						>
							새 예약하기
						</Button>
					</div>
				)}
			</div>
		</main>
	);
}
