"use client";

import { BellRing } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { ExpirationStatusBadge } from "@/components/expirations/expiration-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCivilDate } from "@/lib/dates";
import { displayStatus } from "@/lib/expirations/display-status";
import { EXPIRATION_TYPE_LABELS } from "@/lib/labels";
import { REMINDERS_DISMISSED_COOKIE } from "@/lib/reminders/session";
import type { ReminderItem } from "@/services/expirations/reminders";

function isDismissed(): boolean {
  return document.cookie
    .split("; ")
    .some((entry) => entry === `${REMINDERS_DISMISSED_COOKIE}=1`);
}

function dismiss() {
  // Sem Max-Age: vale até fechar o navegador (ou até o logout, que o apaga).
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${REMINDERS_DISMISSED_COOKIE}=1; Path=/; SameSite=Lax${secure}`;
}

const noopSubscribe = () => () => {};

/** Popup de lembretes exibido ao abrir o app, até ser fechado na sessão. */
export function RemindersDialog({
  items,
  today,
  truncated,
}: {
  items: ReminderItem[];
  today: string;
  truncated: boolean;
}) {
  // No servidor conta como fechado: o popup só aparece após a hidratação.
  const dismissed = useSyncExternalStore(
    noopSubscribe,
    isDismissed,
    () => true,
  );
  const [closed, setClosed] = useState(false);

  function close() {
    dismiss();
    setClosed(true);
  }

  return (
    <Dialog
      open={!dismissed && !closed}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
              <BellRing className="size-5" aria-hidden />
            </span>
            <DialogTitle className="text-xl font-bold">
              Lembretes de vencimento
            </DialogTitle>
          </div>
          <DialogDescription>
            {items.length === 1
              ? "1 vencimento sob sua responsabilidade pede atenção."
              : `${items.length}${truncated ? "+" : ""} vencimentos sob sua responsabilidade pedem atenção.`}
          </DialogDescription>
        </DialogHeader>

        <ul className="min-h-0 flex-1 divide-y overflow-y-auto rounded-lg border">
          {items.map((item) => {
            const status = displayStatus(
              item.status,
              item.expirationDate,
              today,
            );
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    href={`/clients/${item.clientId}?aba=vencimentos`}
                    onClick={close}
                    className="font-medium hover:underline"
                  >
                    {item.documentName}
                  </Link>
                  <span className="truncate text-sm text-muted-foreground">
                    {item.clientName} · {EXPIRATION_TYPE_LABELS[item.type]}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums">
                    {formatCivilDate(item.expirationDate)}
                  </span>
                  <ExpirationStatusBadge status={status} />
                </div>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Ao fechar, os lembretes não aparecem de novo nesta sessão.
          </p>
          <Button onClick={close}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
