/**
 * App-level Better Auth Client
 *
 * Core의 initAuthClient를 호출하여 초기화된 클라이언트를 re-export
 */
import { initAuthClient } from "@superbuilder/features-client/core/auth";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3002";

export const authClient = initAuthClient(API_URL);
