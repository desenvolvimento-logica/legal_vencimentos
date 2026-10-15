"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function MicrosoftSignInButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full">
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden />
      ) : (
        <MicrosoftLogo />
      )}
      {pending ? "Redirecionando…" : "Entrar com Microsoft"}
    </Button>
  );
}

// Logo oficial da Microsoft (quatro quadrados), sem alterações de cor.
function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 21 21" className="size-5" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
