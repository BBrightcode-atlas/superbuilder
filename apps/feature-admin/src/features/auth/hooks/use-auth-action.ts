import { sessionAtom } from "@superbuilder/features-client/core/auth";
import { useAsync } from "@superbuilder/features-client/shared/hooks";
import { useSetAtom } from "jotai";
import { authClient } from "@/lib/auth-client";

export { authClient };

interface AuthActionOptions<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

export function useAuthAction<TArgs extends unknown[], TData>(
  action: (...args: TArgs) => Promise<TData>,
  options: AuthActionOptions<TData> = {},
) {
  const setSession = useSetAtom(sessionAtom);
  const result = useAsync(async (...args: TArgs) => {
    const data = await action(...args);
    const sessionData = (data as any)?.data;
    if (sessionData?.token && sessionData?.user) {
      setSession({ token: sessionData.token, user: sessionData.user });
    }
    return data;
  }, options);
  return result;
}
