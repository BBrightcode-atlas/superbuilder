// Feature-specific hooks
export { useAuthAction } from "./use-auth-action";
export { useSignInWithEmailAndPassword } from "./use-sign-in-with-email-and-password";
export { useSignUpWithEmailAndPassword } from "./use-sign-up-with-email-and-password";
export { useSignInWithOAuth } from "./use-sign-in-with-oauth";
export { useAdminSignIn } from "./use-admin-sign-in";

// Re-export from @superbuilder/features-client/core/auth (prefer using @superbuilder/features-client/core/auth directly)
export { useAuthStateSync, useProfileSync } from "@superbuilder/features-client/core/auth";
