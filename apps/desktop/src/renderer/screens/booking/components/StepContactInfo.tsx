import { Input } from "@superset/ui/input";
import { Label } from "@superset/ui/label";
import {
	HiOutlineEnvelope,
	HiOutlinePhone,
	HiOutlineUser,
} from "react-icons/hi2";
import type { ContactForm } from "../constants";

interface StepContactInfoProps {
	form: ContactForm;
	onChange: (field: string, value: string) => void;
}

export function StepContactInfo({ form, onChange }: StepContactInfoProps) {
	return (
		<div className="space-y-6">
			<div className="space-y-2 text-center">
				<h2 className="text-2xl font-bold">개인정보를 입력해주세요</h2>
				<p className="text-muted-foreground">예약 확인 이메일을 보내드립니다</p>
			</div>

			<div className="mx-auto max-w-md space-y-4">
				<div className="space-y-2">
					<Label htmlFor="name" className="flex items-center gap-1.5">
						<HiOutlineUser className="size-4" />
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
						<HiOutlinePhone className="size-4" />
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
						<HiOutlineEnvelope className="size-4" />
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
