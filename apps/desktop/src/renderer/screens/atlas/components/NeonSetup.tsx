import { useState, useEffect, useRef } from "react";
import { Button } from "@superset/ui/button";
import { Input } from "@superset/ui/input";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { LuCheck, LuExternalLink, LuKeyboard } from "react-icons/lu";

interface NeonSetupProps {
  onComplete: (orgId: string, orgName: string) => void;
  onSkip: () => void;
}

export function NeonSetup({ onComplete, onSkip }: NeonSetupProps) {
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"token" | "org">("token");

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } =
    electronTrpc.atlas.neon.getConnectionStatus.useQuery();

  const { data: orgs } =
    electronTrpc.atlas.neon.listOrganizations.useQuery(undefined, {
      enabled: status?.connected === true,
    });

  const saveTokenMutation =
    electronTrpc.atlas.neon.saveToken.useMutation({
      onSuccess: () => {
        refetchStatus();
        setStep("org");
      },
    });

  useEffect(() => {
    if (status?.connected && step === "token") {
      setStep("org");
    }
  }, [status?.connected, step]);

  // Auto-complete: env에 API key가 있고 org가 로드되면 자동 진행
  const autoCompleted = useRef(false);
  useEffect(() => {
    if (status?.connected && orgs && orgs.length > 0 && step === "org" && !autoCompleted.current) {
      autoCompleted.current = true;
      onComplete(orgs[0].id, orgs[0].name);
    }
  }, [status?.connected, orgs, step]);

  if (statusLoading) {
    return null;
  }

  if (step === "token" && !status?.connected) {
    return (
      <div className="space-y-4 p-4 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <LuKeyboard className="size-5 text-primary" />
          <h3 className="text-sm font-semibold">Neon 연결</h3>
        </div>

        <p className="text-xs text-muted-foreground">
          Neon 콘솔에서 API 키를 생성하세요.
        </p>

        <Button
          variant="link"
          size="sm"
          className="p-0 h-auto text-xs"
          onClick={() => {
            window.open(
              "https://console.neon.tech/app/settings/api-keys",
              "_blank",
            );
          }}
        >
          <LuExternalLink className="size-3 mr-1" />
          Neon API 키 페이지 열기
        </Button>

        <div className="flex gap-2">
          <Input
            type="password"
            placeholder="napi_xxxxxxxxxxxxxxxx"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="font-mono text-xs"
          />
          <Button
            size="sm"
            disabled={!token.trim() || saveTokenMutation.isPending}
            onClick={() => saveTokenMutation.mutate({ token: token.trim() })}
          >
            {saveTokenMutation.isPending ? "확인 중..." : "연결"}
          </Button>
        </div>

        {saveTokenMutation.error ? (
          <p className="text-xs text-destructive">
            {saveTokenMutation.error.message}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            나중에 연결
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <LuCheck className="size-5 text-green-500" />
        <h3 className="text-sm font-semibold">Neon 연결됨</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        프로젝트를 생성할 조직을 선택하세요.
      </p>

      {orgs && orgs.length > 0 ? (
        <div className="space-y-2">
          {orgs.map((org) => (
            <Button
              key={org.id}
              variant="outline"
              onClick={() => onComplete(org.id, org.name)}
              className="w-full justify-start h-auto p-3 text-left"
            >
              <div>
                <p className="text-sm font-medium">{org.name}</p>
              </div>
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          조직을 불러오는 중...
        </p>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          나중에 연결
        </Button>
      </div>
    </div>
  );
}
