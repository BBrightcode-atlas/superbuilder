import { Button } from "@superbuilder/feature-ui/shadcn/button";
import { cn } from "@superbuilder/feature-ui/lib/utils";
import {
  type OAuthProvider,
  OAUTH_PROVIDER_CONFIG,
  getEnabledOAuthProviders,
} from "../config";
import { GoogleIcon, KakaoIcon, NaverIcon } from "./oauth-icons";
import { useSignInWithOAuth } from "../hooks/use-sign-in-with-oauth";

const ICON_MAP: Record<OAuthProvider, React.ComponentType<{ className?: string }>> = {
  google: GoogleIcon,
  kakao: KakaoIcon,
  naver: NaverIcon,
};

interface OAuthButtonsProps {
  disabled?: boolean;
}

export function OAuthButtons({ disabled }: OAuthButtonsProps) {
  const providers = getEnabledOAuthProviders();

  const { execute: signInWithGoogle } = useSignInWithOAuth({
    provider: "google",
  });

  if (providers.length === 0) return null;

  function handleOAuthClick(provider: OAuthProvider) {
    if (provider === "google") {
      signInWithGoogle();
    } else {
      // Better Auth social sign-in for other providers
      const apiUrl = import.meta.env.VITE_API_URL;
      const callbackURL = encodeURIComponent(window.location.origin);
      window.location.href = `${apiUrl}/api/auth/sign-in/social?provider=${provider}&callbackURL=${callbackURL}`;
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {providers.map((provider) => {
        const config = OAUTH_PROVIDER_CONFIG[provider];
        const Icon = ICON_MAP[provider];
        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            className={cn("w-full", config.bgColor, config.textColor)}
            onClick={() => handleOAuthClick(provider)}
            disabled={disabled}
          >
            <Icon className="mr-2 h-4 w-4" />
            {config.label}
          </Button>
        );
      })}
    </div>
  );
}
