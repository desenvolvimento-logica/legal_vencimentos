"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signIn, type LoginState } from "./actions";

type LoginFormProps = {
  next?: string;
  initialError?: string;
};

export function LoginForm({ next, initialError }: LoginFormProps) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signIn,
    { error: initialError },
  );

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <input type="hidden" name="next" value={next ?? ""} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          aria-invalid={Boolean(state.fieldErrors?.email)}
          aria-describedby={
            state.fieldErrors?.email ? "email-error" : undefined
          }
          required
          autoFocus
        />
        {state.fieldErrors?.email && (
          <p id="email-error" className="text-sm text-destructive">
            {state.fieldErrors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
          required
        />
        {state.fieldErrors?.password && (
          <p id="password-error" className="text-sm text-destructive">
            {state.fieldErrors.password}
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending} className="mt-2">
        {pending && <LoaderCircle className="animate-spin" aria-hidden />}
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
