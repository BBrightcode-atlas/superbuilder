import { useNavigate } from "@tanstack/react-router";
import { authClient, useAuthAction } from "./use-auth-action";

type OAuthProvider = Parameters<typeof authClient.signIn.social>[0]["provider"];

interface OAuthCredentials {
  provider: OAuthProvider;
  callbackURL?: string;
  /** @deprecated Use callbackURL instead. Ignored in Better Auth. */
  options?: {
    redirectTo?: string;
    queryParams?: Record<string, string>;
    scopes?: string[];
  };
}

export function useSignInWithOAuth(credential: OAuthCredentials) {
  const navigate = useNavigate();

  return useAuthAction(
    () => {
      return authClient.signIn.social({
        provider: credential.provider,
        callbackURL: credential.callbackURL ?? credential.options?.redirectTo ?? "/",
      });
    },
    {
      onSuccess: () => {
        navigate({
          to: "/",
          replace: true,
        });
      },
      onError: (error) => {
        console.error(error);
      },
    },
  );
}
