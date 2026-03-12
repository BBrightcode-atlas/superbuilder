import { useNavigate } from "@tanstack/react-router";
import { authClient, useAuthAction } from "./use-auth-action";

interface OAuthCredential {
  provider: "google" | "github";
  callbackURL?: string;
}

export function useSignInWithOAuth(credential: OAuthCredential) {
  const navigate = useNavigate();

  return useAuthAction(
    () => {
      return authClient.signIn.social({
        provider: credential.provider,
        callbackURL: credential.callbackURL,
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
