import {
  customSessionClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@superbuilder/features-server/core/auth/server";
import { env } from "./env";

const API_URL = env.VITE_API_URL ?? "http://localhost:3002";

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    organizationClient(),
    customSessionClient<typeof auth>(),
  ],
});
