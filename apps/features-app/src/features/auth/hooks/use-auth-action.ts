import { sessionAtom } from "@superbuilder/features-client/core/auth";
import { useAsync } from "@superbuilder/features-client/shared/hooks";
import { useSetAtom } from "jotai";
import { authClient } from "@/lib/auth-client";

interface AuthActionOptions<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

export { authClient };

/**
 * Better Auth 기반 인증 액션 래퍼
 *
 * useAsync를 사용하여 loading/error/success 상태를 관리하고,
 * 로그인 성공 시 sessionAtom을 수동으로 동기화합니다.
 */
export function useAuthAction<TArgs extends unknown[], TData>(
  action: (...args: TArgs) => Promise<TData>,
  options: AuthActionOptions<TData> = {},
) {
  const setSession = useSetAtom(sessionAtom);

  const result = useAsync(async (...args: TArgs) => {
    const data = await action(...args);

    // Better Auth 응답에서 세션 데이터 추출 (signIn/signUp 응답 구조)
    const sessionData = (data as any)?.data;
    if (sessionData?.token && sessionData?.user) {
      setSession({
        token: sessionData.token,
        user: sessionData.user,
      });
    }

    return data;
  }, options);

  return result;
}
