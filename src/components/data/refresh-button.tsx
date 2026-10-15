"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Recarrega os dados da tela a partir do banco. Não dispara sincronização com
 * o Acessórias (docs/UI-MOCKUPS.md §9, Clientes).
 */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
    >
      <RefreshCw className={cn(pending && "animate-spin")} aria-hidden />
      {pending ? "Atualizando…" : "Atualizar"}
    </Button>
  );
}
