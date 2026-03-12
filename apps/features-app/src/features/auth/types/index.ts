import type { BetterAuthSession } from "@superbuilder/features-client/core/auth";

export type Session = BetterAuthSession;
export type User = BetterAuthSession["user"];

export interface AuthState {
  session: Session | null;
  user: User | null;
  authenticated: boolean;
}
