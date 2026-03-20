import type { IconType } from "react-icons";
import {
	HiOutlineBolt,
	HiOutlineCalendarDays,
	HiOutlineCheckCircle,
	HiOutlineChevronRight,
	HiOutlineCreditCard,
	HiOutlineUser,
	HiOutlineUsers,
} from "react-icons/hi2";

export const STEPS: { id: number; label: string; icon: IconType }[] = [
	{ id: 1, label: "인원 선택", icon: HiOutlineUsers },
	{ id: 2, label: "세션 타입", icon: HiOutlineBolt },
	{ id: 3, label: "날짜 및 시간", icon: HiOutlineCalendarDays },
	{ id: 4, label: "개인정보", icon: HiOutlineUser },
	{ id: 5, label: "결제 안내", icon: HiOutlineCreditCard },
	{ id: 6, label: "예약 확정", icon: HiOutlineCheckCircle },
];

interface StepIndicatorProps {
	currentStep: number;
	onStepClick: (step: number) => void;
}

export function StepIndicator({
	currentStep,
	onStepClick,
}: StepIndicatorProps) {
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
								<HiOutlineCheckCircle className="size-3.5 sm:size-4" />
							) : (
								<Icon className="size-3.5 sm:size-4" />
							)}
							<span className="hidden lg:inline">{step.label}</span>
						</button>
						{index < STEPS.length - 1 && (
							<HiOutlineChevronRight className="text-muted-foreground size-3 sm:size-4" />
						)}
					</div>
				);
			})}
		</div>
	);
}
