import { useTranslation } from "@superbuilder/features-client/core/i18n";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { authClient, useAuthAction } from "./use-auth-action";

export function useSignUpWithEmailAndPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation("auth");

  return useAuthAction(
    (
      email: string,
      password: string,
      options: {
        firstName: string;
        lastName: string;
      },
    ) => {
      return authClient.signUp.email({
        email,
        password,
        name: `${options.firstName} ${options.lastName}`,
      });
    },
    {
      onSuccess: () => {
        navigate({
          to: "/",
          replace: true,
        });
        toast.success(t("signUpSuccess"));
      },
      onError: (error) => {
        toast.error(t("signUpError"));
        console.error(error);
      },
    },
  );
}
