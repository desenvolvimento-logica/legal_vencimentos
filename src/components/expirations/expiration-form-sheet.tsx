"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { EXPIRATION_TYPE_LABELS } from "@/lib/labels";
import {
  EXPIRATION_LIMITS,
  expirationFieldsSchema,
  type ExpirationFieldsInput,
} from "@/lib/validators/expiration";
import {
  createExpiration,
  updateExpiration,
} from "@/services/expirations/actions";
import type { ResponsibleOption } from "@/services/expirations/responsibles";

/** Sugestões comuns; o campo continua livre. */
const DOCUMENT_SUGGESTIONS = [
  "Alvará de Funcionamento",
  "Auto de Vistoria do Corpo de Bombeiros (AVCB)",
  "Certidão Negativa de Débitos Federais (CND)",
  "Certidão Negativa de Débitos Estaduais",
  "Certidão Negativa de Débitos Municipais",
  "Certidão de Regularidade do FGTS",
  "Certidão Negativa de Débitos Trabalhistas (CNDT)",
  "Certificado Digital e-CNPJ",
  "Licença Ambiental",
  "Licença Sanitária",
];

const ISSUER_SUGGESTIONS = [
  "Prefeitura Municipal",
  "Receita Federal",
  "Secretaria da Fazenda Estadual",
  "Corpo de Bombeiros",
  "Vigilância Sanitária",
  "Caixa Econômica Federal",
  "Tribunal Superior do Trabalho",
];

export type ExpirationFormValues = ExpirationFieldsInput;

type FormProps = {
  client: { id: string; name: string };
  responsibles: ResponsibleOption[];
  /** Edição: id e valores atuais. Sem isso, é um novo vencimento. */
  expiration?: { id: string; values: ExpirationFormValues };
  defaultResponsibleId?: string | null;
  /** Edição de data só é permitida em registros ativos (legal_016). */
  allowDateChange?: boolean;
};

type ExpirationFormSheetProps = FormProps & {
  /** Botão que abre o drawer; sem ele, use `open`/`onOpenChange`. */
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

// Referência visual: docs/mockups/04-client-detail-new-expiration.png (drawer).
export function ExpirationFormSheet({
  trigger,
  open: controlledOpen,
  onOpenChange,
  ...formProps
}: ExpirationFormSheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const editing = Boolean(formProps.expiration);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger && <SheetTrigger render={trigger} />}
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[460px]"
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="text-2xl font-bold">
            {editing ? "Editar vencimento" : "Novo vencimento"}
          </SheetTitle>
          <SheetDescription>{formProps.client.name}</SheetDescription>
        </SheetHeader>
        {/* O conteúdo é desmontado ao fechar: cada abertura começa dos valores atuais. */}
        <ExpirationForm {...formProps} onClose={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

function ExpirationForm({
  client,
  responsibles,
  expiration,
  defaultResponsibleId,
  allowDateChange = true,
  onClose,
}: FormProps & { onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const editing = Boolean(expiration);

  // raw: valida no cliente, mas envia os valores brutos; o servidor revalida
  // com o mesmo schema (que transforma vazios em null).
  const { register, handleSubmit, formState, setError, control } = useForm<
    ExpirationFormValues,
    unknown,
    ExpirationFormValues
  >({
    resolver: zodResolver(expirationFieldsSchema, undefined, { raw: true }),
    defaultValues: expiration?.values ?? {
      expirationType: "CERTIDAO",
      documentName: "",
      documentNumber: "",
      issuer: "",
      issueDate: "",
      expirationDate: "",
      responsibleUserId: defaultResponsibleId ?? "",
      notes: "",
    },
  });
  const notesLength = useWatch({ control, name: "notes" })?.length ?? 0;
  const errors = formState.errors;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = expiration
        ? await updateExpiration({ ...values, expirationId: expiration.id })
        : await createExpiration({ ...values, clientId: client.id });

      if (!result.ok) {
        setFormError(result.error);
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          setError(field as FieldPath<ExpirationFormValues>, { message });
        }
        return;
      }
      toast.success(
        editing ? "Vencimento atualizado." : "Vencimento cadastrado.",
      );
      onClose();
    });
  });

  return (
    <>
      <form
        id="expiration-form"
        onSubmit={onSubmit}
        noValidate
        className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5"
      >
        {formError && (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <Field
          id="expirationType"
          label="Tipo"
          required
          error={errors.expirationType?.message}
        >
          <select
            id="expirationType"
            {...register("expirationType")}
            className={selectClassName}
            aria-invalid={Boolean(errors.expirationType)}
          >
            {Object.entries(EXPIRATION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="documentName"
          label="Documento"
          required
          error={errors.documentName?.message}
        >
          <Input
            id="documentName"
            list="document-suggestions"
            maxLength={EXPIRATION_LIMITS.documentName}
            placeholder="Ex.: Alvará de Funcionamento"
            aria-invalid={Boolean(errors.documentName)}
            {...register("documentName")}
          />
          <datalist id="document-suggestions">
            {DOCUMENT_SUGGESTIONS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="issueDate"
            label="Data de emissão"
            error={errors.issueDate?.message}
          >
            <Input
              id="issueDate"
              type="date"
              aria-invalid={Boolean(errors.issueDate)}
              {...register("issueDate")}
            />
          </Field>
          <Field
            id="expirationDate"
            label="Data de vencimento"
            required
            error={errors.expirationDate?.message}
            hint={
              editing && !allowDateChange
                ? "Só pode ser corrigida em registros ativos."
                : undefined
            }
          >
            <Input
              id="expirationDate"
              type="date"
              readOnly={editing && !allowDateChange}
              aria-invalid={Boolean(errors.expirationDate)}
              {...register("expirationDate")}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="documentNumber"
            label="Número"
            error={errors.documentNumber?.message}
          >
            <Input
              id="documentNumber"
              maxLength={EXPIRATION_LIMITS.documentNumber}
              placeholder="Informe o número"
              {...register("documentNumber")}
            />
          </Field>
          <Field
            id="issuer"
            label="Órgão emissor"
            error={errors.issuer?.message}
          >
            <Input
              id="issuer"
              list="issuer-suggestions"
              maxLength={EXPIRATION_LIMITS.issuer}
              placeholder="Selecione ou digite"
              {...register("issuer")}
            />
            <datalist id="issuer-suggestions">
              {ISSUER_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field
          id="responsibleUserId"
          label="Responsável"
          error={errors.responsibleUserId?.message}
          hint="Preenchido conforme a carteira do cliente; pode ser alterado."
        >
          <select
            id="responsibleUserId"
            {...register("responsibleUserId")}
            className={selectClassName}
          >
            <option value="">Sem responsável</option>
            {responsibles.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="notes" label="Observações" error={errors.notes?.message}>
          <Textarea
            id="notes"
            rows={4}
            maxLength={EXPIRATION_LIMITS.notes}
            placeholder="Adicione observações sobre o vencimento…"
            {...register("notes")}
          />
          <p className="text-right text-xs text-muted-foreground tabular-nums">
            {notesLength}/{EXPIRATION_LIMITS.notes}
          </p>
        </Field>
      </form>

      <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button type="submit" form="expiration-form" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {editing ? "Salvar alterações" : "Salvar vencimento"}
        </Button>
      </SheetFooter>
    </>
  );
}

const selectClassName =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-brand-gold-500/40 focus-visible:outline-none aria-invalid:border-destructive";

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
