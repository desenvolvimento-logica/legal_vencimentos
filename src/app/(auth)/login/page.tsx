import { CircleAlert, LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { HOME_PATH, isLoginErrorCode, LOGIN_ERRORS } from "@/lib/auth/paths";
import { getSessionState } from "@/lib/auth/session";

import { signInWithMicrosoft } from "./actions";
import { MicrosoftSignInButton } from "./microsoft-sign-in-button";

export const metadata: Metadata = {
  title: "Entrar — Controle de Vencimentos",
};

// Referência visual: docs/mockups/01-login.png
export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="grid min-h-screen flex-1 lg:grid-cols-[42fr_58fr]">
      <section className="hidden flex-col justify-center bg-brand-navy-950 px-12 py-16 text-white lg:flex xl:px-20">
        <BrandLogo className="w-60" priority />
        <h1 className="mt-16 text-5xl leading-[1.1] font-bold tracking-tight">
          Controle de <span className="text-brand-gold-500">Vencimentos</span>
        </h1>
        <p className="mt-2 text-3xl font-medium text-slate-200">Legalização</p>
        <div className="mt-6 h-1 w-16 rounded-full bg-brand-gold-500" />
        <p className="mt-6 max-w-sm text-lg leading-relaxed text-slate-300">
          Acompanhe certidões, licenças e certificados em um só lugar.
        </p>
      </section>

      <section className="flex flex-col items-center justify-center gap-6 p-4 sm:p-8">
        {/* Em telas estreitas o painel institucional vira um bloco compacto. */}
        <div className="flex w-full max-w-md flex-col gap-3 rounded-xl bg-brand-navy-950 p-6 lg:hidden">
          <BrandLogo className="w-40" />
          <p className="text-lg font-semibold text-white">
            Controle de <span className="text-brand-gold-500">Vencimentos</span>
            <span className="block text-sm font-normal text-slate-300">
              Legalização
            </span>
          </p>
        </div>

        <Card className="w-full max-w-md px-2 py-8 sm:px-6 sm:py-10">
          <div className="flex flex-col gap-6 px-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-bold tracking-tight">
                Acesse sua conta
              </h2>
              <p className="text-muted-foreground">
                Entre com sua conta Microsoft corporativa do escritório.
              </p>
            </div>
            <Suspense fallback={<LoginFormSkeleton />}>
              <LoginContent searchParams={searchParams} />
            </Suspense>
            <div className="mt-2 flex flex-col items-center gap-3">
              <div className="flex w-full items-center gap-4 text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <LockKeyhole className="size-5" aria-hidden />
                <span className="h-px flex-1 bg-border" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Acesso exclusivo para colaboradores autorizados
              </p>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}

function BrandLogo({
  className,
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/logo-white-yellow.png"
      alt="Lógica Assessoria Contábil"
      width={2330}
      height={788}
      priority={priority}
      className={`h-auto object-contain ${className ?? ""}`}
    />
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
  const next = typeof params.next === "string" ? params.next : "";
  const erro = params.erro;

  return (
    <form action={signInWithMicrosoft} className="flex flex-col gap-5">
      {isLoginErrorCode(erro) && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{LOGIN_ERRORS[erro]}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="next" value={next} />
      <MicrosoftSignInButton />
    </form>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>
      <div className="h-11 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
