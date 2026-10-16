"use client";

import {
  Ban,
  CircleCheck,
  EllipsisVertical,
  FilePen,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Trash2,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCivilDate, toBusinessCivilDate } from "@/lib/dates";
import type { ExpirationStatus } from "@/lib/expirations/display-status";
import {
  isRenewalPeriod,
  periodExpirationDate,
  RENEWAL_PERIOD_LABELS,
} from "@/lib/expirations/period";
import { EXPIRATION_LIMITS } from "@/lib/validators/expiration";
import {
  abandonRenewal,
  cancelExpiration,
  concludeRenewal,
  deleteExpiration,
  startRenewal,
  type ActionResult,
} from "@/services/expirations/actions";
import type { ResponsibleOption } from "@/services/expirations/responsibles";

import {
  ExpirationFormSheet,
  type ExpirationFormValues,
} from "./expiration-form-sheet";

type ExpirationRowActionsProps = {
  client: { id: string; name: string };
  expiration: {
    id: string;
    documentName: string;
    status: ExpirationStatus;
    values: ExpirationFormValues;
  };
  responsibles: ResponsibleOption[];
};

/** Ações conforme a situação (legal_016). RENEWED e CANCELLED não têm ações. */
export function ExpirationRowActions({
  client,
  expiration,
  responsibles,
}: ExpirationRowActionsProps) {
  const [dialog, setDialog] = useState<
    "edit" | "cancel" | "delete" | "conclude" | null
  >(null);
  const [pending, startTransition] = useTransition();

  const period = expiration.values.renewalPeriod;
  const periodic = isRenewalPeriod(period);
  const editable =
    expiration.status === "ACTIVE" || expiration.status === "RENEWING";
  if (!editable) return null;

  function run(action: () => Promise<ActionResult>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={`Ações de ${expiration.documentName}`}
              disabled={pending}
            />
          }
        >
          {pending ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : (
            <EllipsisVertical aria-hidden />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setDialog("edit")}>
            <Pencil aria-hidden />
            Editar
          </DropdownMenuItem>
          {expiration.status === "ACTIVE" ? (
            <DropdownMenuItem
              onClick={() =>
                run(() => startRenewal(expiration.id), "Renovação iniciada.")
              }
            >
              <RefreshCw aria-hidden />
              Iniciar renovação
            </DropdownMenuItem>
          ) : (
            <>
              {periodic ? (
                <>
                  <DropdownMenuItem onClick={() => setDialog("conclude")}>
                    <CircleCheck aria-hidden />
                    Concluir renovação
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    render={
                      <Link href={`/expirations/${expiration.id}/renew`} />
                    }
                  >
                    <FilePen aria-hidden />
                    Concluir com outros dados
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  render={<Link href={`/expirations/${expiration.id}/renew`} />}
                >
                  <CircleCheck aria-hidden />
                  Concluir renovação
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() =>
                  run(
                    () => abandonRenewal(expiration.id),
                    "Renovação interrompida; o vencimento voltou a ativo.",
                  )
                }
              >
                <Undo2 aria-hidden />
                Desistir da renovação
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialog("cancel")}>
            <Ban aria-hidden />
            Cancelar vencimento
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDialog("delete")}
          >
            <Trash2 aria-hidden />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ExpirationFormSheet
        open={dialog === "edit"}
        onOpenChange={(open) => setDialog(open ? "edit" : null)}
        client={client}
        responsibles={responsibles}
        expiration={{ id: expiration.id, values: expiration.values }}
        allowDateChange={expiration.status === "ACTIVE"}
      />

      {periodic && (
        <AlertDialog
          open={dialog === "conclude"}
          onOpenChange={(open) => setDialog(open ? "conclude" : null)}
        >
          <AlertDialogContent>
            <ConcludeDialogBody
              documentName={expiration.documentName}
              periodLabel={RENEWAL_PERIOD_LABELS[period]}
              nextDate={(today) => periodExpirationDate(today, period)}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <Button
                disabled={pending}
                onClick={() => {
                  setDialog(null);
                  run(
                    () => concludeRenewal(expiration.id),
                    "Renovação concluída. O próximo vencimento está vigente.",
                  );
                }}
              >
                Concluir renovação
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <CancelDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => setDialog(open ? "cancel" : null)}
        expirationId={expiration.id}
        documentName={expiration.documentName}
      />

      <AlertDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir vencimento?</AlertDialogTitle>
            <AlertDialogDescription>
              “{expiration.documentName}” deixará de aparecer nas listas. A
              exclusão fica registrada na auditoria e pode ser consultada pelo
              administrador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setDialog(null);
                run(
                  () => deleteExpiration(expiration.id),
                  "Vencimento excluído.",
                );
              }}
            >
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Montado só com o diálogo aberto: "hoje" é lido na hora da confirmação. */
function ConcludeDialogBody({
  documentName,
  periodLabel,
  nextDate,
}: {
  documentName: string;
  periodLabel: string;
  nextDate: (today: string) => string;
}) {
  const [today] = useState(() => toBusinessCivilDate(new Date()));
  return (
    <AlertDialogHeader>
      <AlertDialogTitle>Concluir renovação?</AlertDialogTitle>
      <AlertDialogDescription>
        “{documentName}” fica como <strong>Renovado</strong> no histórico. O
        próximo vencimento é criado vigente, com os mesmos dados: emissão em{" "}
        {formatCivilDate(today)} e vencimento em{" "}
        <strong>{formatCivilDate(nextDate(today))}</strong> ({periodLabel}). A
        renovação dele não é iniciada.
      </AlertDialogDescription>
    </AlertDialogHeader>
  );
}

function CancelDialog({
  open,
  onOpenChange,
  expirationId,
  documentName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expirationId: string;
  documentName: string;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await cancelExpiration({ expirationId, reason });
      if (!result.ok) {
        setError(result.fieldErrors?.reason ?? result.error);
        return;
      }
      toast.success("Vencimento cancelado.");
      setReason("");
      onOpenChange(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar vencimento?</AlertDialogTitle>
          <AlertDialogDescription>
            “{documentName}” passa a ser histórico e não poderá mais ser
            alterado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label
            htmlFor={`cancel-reason-${expirationId}`}
            className="font-semibold"
          >
            Motivo{" "}
            <span className="text-destructive" aria-hidden>
              *
            </span>
          </Label>
          <Textarea
            id={`cancel-reason-${expirationId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={EXPIRATION_LIMITS.cancellationReason}
            rows={3}
            aria-invalid={Boolean(error)}
            placeholder="Ex.: cliente encerrou a atividade"
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Voltar</AlertDialogCancel>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden />}
            Cancelar vencimento
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
