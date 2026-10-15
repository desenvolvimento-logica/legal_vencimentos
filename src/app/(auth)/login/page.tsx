import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HOME_PATH, isLoginErrorCode, LOGIN_ERRORS } from "@/lib/auth/paths";
import { getSessionState } from "@/lib/auth/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Entrar — Controle de Vencimentos",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Controle de Vencimentos</CardTitle>
          <CardDescription>
            Departamento de Legalização. Entre com seu e-mail corporativo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginContent searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

async function LoginContent({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  // Usuário já autenticado e ativo não precisa ver o login.
  const session = await getSessionState();
  if (session.status === "active") {
    redirect(HOME_PATH);
  }

  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const erro = params.erro;

  return (
    <LoginForm
      next={next}
      initialError={isLoginErrorCode(erro) ? LOGIN_ERRORS[erro] : undefined}
    />
  );
}

function LoginFormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <div className="h-14 animate-pulse rounded-md bg-muted" />
      <div className="h-14 animate-pulse rounded-md bg-muted" />
      <div className="mt-2 h-9 animate-pulse rounded-md bg-muted" />
    </div>
  );
}
