"use client";

import {
  CircleCheck,
  CircleX,
  LoaderCircle,
  RefreshCw,
  Wifi,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  runManualSync,
  testAcessoriasConnection,
  type ConnectionTestResult,
} from "@/services/admin/integrations";

const TYPE_LABELS: Record<string, string> = {
  companies: "Clientes",
  users: "Usuários",
  requests: "Solicitações",
};

const STATUS_LABELS: Record<string, string> = {
  SUCCESS: "concluída",
  PARTIAL: "concluída com falhas",
  FAILED: "falhou",
  SKIPPED: "já estava em execução",
};

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Sincronização manual incremental de um ou mais tipos. */
export function SyncButton({
  types,
  label,
  variant = "outline",
}: {
  types: ("companies" | "users" | "requests")[];
  label: string;
  variant?: "outline" | "default";
}) {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await runManualSync(types);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      for (const item of result.results) {
        const message = `${TYPE_LABELS[item.type] ?? item.type}: sincronização ${STATUS_LABELS[item.status] ?? item.status}.`;
        if (item.status === "SUCCESS") toast.success(message);
        else if (item.status === "SKIPPED") toast.info(message);
        else
          toast.error(
            item.errorMessage ? `${message} ${item.errorMessage}` : message,
          );
      }
    });
  }

  return (
    <Button
      variant={variant}
      onClick={run}
      disabled={pending}
      className="w-full sm:w-auto"
    >
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden />
      ) : (
        <RefreshCw aria-hidden />
      )}
      {pending ? "Sincronizando…" : label}
    </Button>
  );
}

/** Teste de conexão (uma chamada de leitura ao Acessórias). */
export function ConnectionTest() {
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-end">
      <div className="text-sm" aria-live="polite">
        {result ? (
          <>
            <p className="text-muted-foreground">
              Último teste: {timeFormatter.format(new Date(result.testedAt))}
            </p>
            {result.ok ? (
              <p className="flex items-center gap-1.5 text-success">
                <CircleCheck className="size-4" aria-hidden />
                Conexão estabelecida ({result.latencyMs} ms).
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-danger">
                <CircleX className="size-4" aria-hidden />
                {result.error}
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            Conexão ainda não testada nesta sessão.
          </p>
        )}
      </div>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () =>
            setResult(await testAcessoriasConnection()),
          )
        }
      >
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden />
        ) : (
          <Wifi aria-hidden />
        )}
        Testar conexão
      </Button>
    </div>
  );
}
