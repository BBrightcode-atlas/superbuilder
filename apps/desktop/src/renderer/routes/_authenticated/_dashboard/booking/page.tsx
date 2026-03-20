import { createFileRoute } from "@tanstack/react-router";
import { BookingLandingPage } from "renderer/screens/booking/BookingLandingPage";

export const Route = createFileRoute("/_authenticated/_dashboard/booking/")({
	component: BookingLandingPage,
});
