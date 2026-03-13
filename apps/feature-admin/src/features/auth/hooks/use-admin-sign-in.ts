import { useTranslation } from "@superbuilder/features-client/core/i18n";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { authClient, useAuthAction } from "./use-auth-action";

/**
 * Admin 로그인 훅
 * - 이메일/비밀번호로 로그인
 * - 로그인 성공 시 /로 이동
 * - role 체크는 AdminGuard에서 수행
 */
export function useAdminSignIn() {
  const navigate = useNavigate();
  const { t } = useTranslation("auth");

  return useAuthAction(
    (email: string, password: string) => {
      return authClient.signIn.email({ email, password });
    },
    {
      onSuccess: () => {
        navigate({
          to: "/",
          replace: true,
        });
        toast.success(t("adminSignInSuccess"));
      },
      onError: (error) => {
        toast.error(t("adminSignInError"));
        console.error(error);
      },
    },
  );
}
