"use client";

import { CircleAlert, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Falha ao carregar uma tela autenticada: mensagem sanitizada e nova tentativa.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="items-center gap-3 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-danger/10">
        <CircleAlert className="size-6 text-danger" aria-hidden />
      </span>
      <p className="text-base font-semibold">
        Não foi possível carregar esta tela
      </p>
      <p className="max-w-md text-muted-foreground">
        Tente novamente em instantes. Se o problema continuar, informe o código
        abaixo ao suporte.
      </p>
      {error.digest && (
        <code className="rounded bg-muted px-2 py-1 text-xs">
          {error.digest}
        </code>
      )}
      <Button variant="outline" onClick={reset}>
        <RotateCw aria-hidden />
        Tentar novamente
      </Button>
    </Card>
  );
}
