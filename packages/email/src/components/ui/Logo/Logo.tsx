import { Img } from "@react-email/components";
import { env } from "../../../lib/env";

/**
 * SuperBuilder logo component for email header
 */
export function Logo() {
	return (
		<Img
			src={`${env.NEXT_PUBLIC_MARKETING_URL}/assets/emails/logo.png`}
			alt="SuperBuilder"
			width="120"
		/>
	);
}
