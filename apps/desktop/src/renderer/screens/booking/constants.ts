export type SessionType = "premium-private" | "regular-private" | "group";

export interface SessionOption {
	value: SessionType;
	label: string;
	duration: string;
	description: string;
	price: string;
	colorClass: string;
	note?: string;
}

export const PEOPLE_OPTIONS = [
	{ value: "1", label: "1인", description: "프라이빗 세션" },
	{ value: "2", label: "2인", description: "프라이빗 또는 그룹" },
	{ value: "3+", label: "3인 이상", description: "그룹 세션만 가능" },
] as const;

export const SESSION_TYPES: Record<string, SessionOption[]> = {
	"1": [
		{
			value: "premium-private",
			label: "프리미엄 프라이빗",
			duration: "80분",
			description: "1:1 맞춤형 집중 세션",
			price: "₩180,000",
			colorClass: "text-amber-400",
		},
		{
			value: "regular-private",
			label: "레귤러 프라이빗",
			duration: "50분",
			description: "1:1 효율적인 세션",
			price: "₩120,000",
			colorClass: "text-blue-400",
		},
	],
	"2": [
		{
			value: "premium-private",
			label: "프리미엄 프라이빗",
			duration: "80분",
			description: "2인 맞춤형 집중 세션",
			price: "₩180,000 / 인",
			colorClass: "text-amber-400",
			note: "연속 2타임 예약 필요",
		},
		{
			value: "regular-private",
			label: "레귤러 프라이빗",
			duration: "50분",
			description: "2인 효율적인 세션",
			price: "₩120,000 / 인",
			colorClass: "text-blue-400",
			note: "연속 2타임 예약 필요",
		},
		{
			value: "group",
			label: "그룹 세션",
			duration: "60분",
			description: "2인 기준 1타임",
			price: "₩80,000 / 인",
			colorClass: "text-violet-400",
		},
	],
	"3+": [
		{
			value: "group",
			label: "그룹 세션",
			duration: "60분",
			description: "2인 기준, 인원에 따라 연속 타임 예약",
			price: "₩80,000 / 인",
			colorClass: "text-violet-400",
			note: "3인 이상은 연속 타임 여러 개 예약이 필요합니다",
		},
	],
};

export const TIME_SLOTS = [
	{ time: "09:30", available: true },
	{ time: "10:50", available: true },
	{ time: "13:20", available: true },
	{ time: "14:50", available: false },
	{ time: "16:20", available: true },
];

export interface ContactForm {
	name: string;
	phone: string;
	email: string;
}
