"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startRenewal } from "@/services/expirations/actions";

export function StartRenewalButton({ expirationId }: { expirationId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      onClick={() =>
        startTransition(async () => {
          const result = await startRenewal(expirationId);
          if (result.ok) toast.success("Renovação iniciada.");
          else toast.error(result.error);
        })
      }
      disabled={pending}
    >
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden />
      ) : (
        <RefreshCw aria-hidden />
      )}
      Iniciar renovação
    </Button>
  );
}
