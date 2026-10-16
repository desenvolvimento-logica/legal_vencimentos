"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Info, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  isRenewalPeriod,
  periodExpirationDate,
  RENEWAL_PERIOD_LABELS,
  type RenewalPeriod,
} from "@/lib/expirations/period";
import {
  completeRenewalSchema,
  EXPIRATION_LIMITS,
  type CompleteRenewalInput,
} from "@/lib/validators/expiration";
import { completeRenewal } from "@/services/expirations/actions";

type RenewalFormProps = {
  expirationId: string;
  currentExpirationDate: string;
  /** Data civil de hoje (America/Sao_Paulo): emissão sugerida. */
  today: string;
  defaults: {
    documentNumber: string;
    issuer: string;
    renewalPeriod: RenewalPeriod | null;
    reminderDays: number | null;
  };
  /** Para onde voltar depois de concluir ou cancelar. */
  returnHref: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Formulário do novo registro na renovação (docs/mockups/07-expiration-renewal.png). */
export function RenewalForm({
  expirationId,
  currentExpirationDate,
  today,
  defaults,
  returnHref,
}: RenewalFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const { register, handleSubmit, formState, setError, setValue, control } =
    useForm<CompleteRenewalInput, unknown, CompleteRenewalInput>({
      resolver: zodResolver(completeRenewalSchema, undefined, { raw: true }),
      defaultValues: {
        expirationId,
        expirationDate: "",
        // Com periodicidade, o novo período conta da conclusão (hoje).
        issueDate: defaults.renewalPeriod ? today : "",
        documentNumber: defaults.documentNumber,
        issuer: defaults.issuer,
        notes: "",
        renewalPeriod: defaults.renewalPeriod ?? "",
        reminderDays:
          defaults.reminderDays === null ? "" : String(defaults.reminderDays),
      },
    });
  const errors = formState.errors;
  const [period, issueDate] = useWatch({
    control,
    name: ["renewalPeriod", "issueDate"],
  });
  const periodic = isRenewalPeriod(period);

  useEffect(() => {
    if (!periodic) return;
    // Sem emissão, o banco usa a data de conclusão (hoje).
    const base = DATE_PATTERN.test(issueDate ?? "") ? issueDate! : today;
    setValue("expirationDate", periodExpirationDate(base, period));
  }, [periodic, period, issueDate, today, setValue]);

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    if (
      !isRenewalPeriod(values.renewalPeriod) &&
      values.expirationDate &&
      values.expirationDate <= currentExpirationDate
    ) {
      setError("expirationDate", {
        message: "A nova data deve ser posterior ao vencimento atual.",
      });
      return;
    }
    startTransition(async () => {
      const result = await completeRenewal(values);
      if (!result.ok) {
        setFormError(result.error);
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          setError(field as FieldPath<CompleteRenewalInput>, { message });
        }
        return;
      }
      toast.success("Renovação concluída. O novo vencimento está ativo.");
      router.push(returnHref);
    });
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-5"
      aria-label="Novo registro"
    >
      {formError && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" {...register("expirationId")} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="renewalPeriod"
          label="Periodicidade"
          error={errors.renewalPeriod?.message}
        >
          <select
            id="renewalPeriod"
            {...register("renewalPeriod")}
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-brand-gold-500/40 focus-visible:outline-none"
          >
            <option value="">Sem periodicidade</option>
            {Object.entries(RENEWAL_PERIOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="reminderDays"
          label="Lembrete (dias antes)"
          error={errors.reminderDays?.message}
        >
          <Input
            id="reminderDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={EXPIRATION_LIMITS.reminderDaysMax}
            step={1}
            placeholder="Sem lembrete"
            aria-invalid={Boolean(errors.reminderDays)}
            {...register("reminderDays")}
          />
        </Field>
      </div>

      <Field
        id="issueDate"
        label="Data de emissão"
        error={errors.issueDate?.message}
      >
        <Input id="issueDate" type="date" {...register("issueDate")} />
      </Field>
      <Field
        id="expirationDate"
        label="Data de vencimento"
        required
        error={errors.expirationDate?.message}
        hint={periodic ? "Calculada: emissão + periodicidade." : undefined}
      >
        <Input
          id="expirationDate"
          type="date"
          readOnly={periodic}
          aria-invalid={Boolean(errors.expirationDate)}
          {...register("expirationDate")}
        />
      </Field>
      <Field
        id="documentNumber"
        label="Número"
        error={errors.documentNumber?.message}
      >
        <Input
          id="documentNumber"
          maxLength={EXPIRATION_LIMITS.documentNumber}
          placeholder="Número do novo documento"
          {...register("documentNumber")}
        />
      </Field>
      <Field id="issuer" label="Órgão emissor" error={errors.issuer?.message}>
        <Input
          id="issuer"
          maxLength={EXPIRATION_LIMITS.issuer}
          {...register("issuer")}
        />
      </Field>
      <Field id="notes" label="Observações" error={errors.notes?.message}>
        <Textarea
          id="notes"
          rows={3}
          maxLength={EXPIRATION_LIMITS.notes}
          placeholder="Informe observações (opcional)"
          {...register("notes")}
        />
      </Field>

      <Alert className="border-info/30 bg-info/5 text-info">
        <Info aria-hidden />
        <AlertDescription className="text-info">
          O registro atual será marcado como <strong>Renovado</strong> e
          permanecerá no histórico.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Link
          href={returnHref}
          className={buttonVariants({ variant: "outline", size: "lg" })}
          aria-disabled={pending}
        >
          Cancelar
        </Link>
        <Button type="submit" size="lg" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {pending ? "Concluindo…" : "Concluir renovação"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-semibold">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only">(obrigatório)</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
