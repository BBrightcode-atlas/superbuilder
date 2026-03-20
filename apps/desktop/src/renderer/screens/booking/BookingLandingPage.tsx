import { Badge } from "@superset/ui/badge";
import { Button } from "@superset/ui/button";
import { Card, CardContent } from "@superset/ui/card";
import { useMemo, useState } from "react";
import {
	HiOutlineArrowRight,
	HiOutlineCalendarDays,
	HiOutlineChevronLeft,
} from "react-icons/hi2";
import { StepConfirmation } from "./components/StepConfirmation";
import { StepContactInfo } from "./components/StepContactInfo";
import { StepDateTime } from "./components/StepDateTime";
import { StepIndicator } from "./components/StepIndicator";
import { StepPayment } from "./components/StepPayment";
import { StepPeople } from "./components/StepPeople";
import { StepSessionType } from "./components/StepSessionType";
import type { ContactForm } from "./constants";

export function BookingLandingPage() {
	const [step, setStep] = useState(1);
	const [people, setPeople] = useState("");
	const [sessionType, setSessionType] = useState("");
	const [date, setDate] = useState<Date | undefined>();
	const [time, setTime] = useState("");
	const [contactForm, setContactForm] = useState<ContactForm>({
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

	const handlePeopleChange = (v: string) => {
		setPeople(v);
		setSessionType("");
	};

	const handleReset = () => {
		setStep(1);
		setPeople("");
		setSessionType("");
		setDate(undefined);
		setTime("");
		setContactForm({ name: "", phone: "", email: "" });
	};

	return (
		<div className="relative min-h-full overflow-auto">
			{/* Background gradient */}
			<div className="pointer-events-none absolute inset-0 -z-10">
				<div className="absolute top-0 left-1/2 size-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-primary/8 to-transparent blur-3xl" />
				<div className="absolute bottom-0 right-0 size-[600px] translate-x-1/4 translate-y-1/4 rounded-full bg-gradient-to-t from-violet-500/5 to-transparent blur-3xl" />
			</div>

			<div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
				{/* Header */}
				<div className="mb-10 space-y-2 text-center">
					<Badge variant="secondary" className="mb-4">
						<HiOutlineCalendarDays className="mr-1 size-3" />
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
							<StepPeople value={people} onChange={handlePeopleChange} />
						)}
						{step === 2 && (
							<StepSessionType
								people={people}
								value={sessionType}
								onChange={setSessionType}
							/>
						)}
						{step === 3 && (
							<StepDateTime
								date={date}
								onDateChange={setDate}
								time={time}
								onTimeChange={setTime}
							/>
						)}
						{step === 4 && (
							<StepContactInfo
								form={contactForm}
								onChange={handleContactChange}
							/>
						)}
						{step === 5 && (
							<StepPayment people={people} sessionType={sessionType} />
						)}
						{step === 6 && (
							<StepConfirmation
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
							<HiOutlineChevronLeft className="mr-1 size-4" />
							이전
						</Button>
						<div className="text-muted-foreground text-sm">{step} / 6</div>
						<Button onClick={handleNext} disabled={!canProceed}>
							{step === 5 ? "예약 확정" : "다음"}
							<HiOutlineArrowRight className="ml-1 size-4" />
						</Button>
					</div>
				)}

				{step === 6 && (
					<div className="text-center">
						<Button variant="outline" onClick={handleReset}>
							새 예약하기
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
