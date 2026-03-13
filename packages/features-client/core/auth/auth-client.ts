/**
 * Better Auth Client (Core)
 *
 * 모든 Feature/App에서 공유하는 Better Auth React 클라이언트
 * App 초기화 시 initAuthClient()로 baseURL을 설정해야 한다.
 */
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

let _authClient: ReturnType<typeof createAuthClient> | null = null;

/**
 * Auth client 초기화 (앱 시작 시 1회 호출)
 */
export function initAuthClient(baseURL: string) {
  _authClient = createAuthClient({
    baseURL,
    plugins: [organizationClient()],
  });
  return _authClient;
}

/**
 * 초기화된 Auth client 반환
 * 초기화 전 호출 시 에러 발생
 */
export function getAuthClient() {
  if (!_authClient) {
    throw new Error(
      "Auth client not initialized. Call initAuthClient(baseURL) first.",
    );
  }
  return _authClient;
}
