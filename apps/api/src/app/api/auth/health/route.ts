import { NextResponse } from "next/server";

import { getAuthSchemaReadiness } from "@/lib/auth-schema";

export async function GET() {
	const readiness = await getAuthSchemaReadiness();

	return NextResponse.json(readiness, {
		status: readiness.ready ? 200 : 503,
	});
}
