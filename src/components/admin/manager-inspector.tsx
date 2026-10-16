"use client";

import { LoaderCircle, TriangleAlert, Users, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { managerOptionsFor, type HierarchyLevel } from "@/lib/admin/hierarchy";
import { HIERARCHY_LABELS } from "@/lib/auth/labels";
import { initials } from "@/lib/labels";
import { changeManager } from "@/services/admin/actions";

type Person = {
  id: string;
  name: string;
  email: string;
  level: HierarchyLevel;
  managerId: string | null;
  active: boolean;
  clients: number;
};

/** Painel "Vínculo hierárquico" (docs/mockups/10-admin-hierarchy.png). */
export function ManagerInspector({
  person,
  profiles,
  closeHref,
}: {
  person: Person;
  profiles: Omit<Person, "clients">[];
  closeHref: string;
}) {
  const [managerId, setManagerId] = useState(person.managerId ?? "");
  const [pending, startTransition] = useTransition();
  const options = managerOptionsFor(profiles, person.level, person.id);
  const current = profiles.find((profile) => profile.id === person.managerId);
  const changed = managerId !== (person.managerId ?? "");
  const topLevel = person.level === "DIRECTOR" || person.level === "ADMIN";

  function apply() {
    startTransition(async () => {
      const result = await changeManager({ profileId: person.id, managerId });
      if (result.ok) toast.success("Vínculo atualizado.");
      else toast.error(result.error);
    });
  }

  return (
    <aside
      aria-label="Vínculo hierárquico"
      className="flex flex-col gap-5 rounded-xl border bg-card px-5 py-5 shadow-xs"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold">Vínculo hierárquico</h2>
        <Link
          href={closeHref}
          scroll={false}
          aria-label="Fechar painel"
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="flex items-center gap-4 border-b pb-5">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold"
          aria-hidden
        >
          {initials(person.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{person.name}</p>
          <p className="text-sm text-muted-foreground">
            {HIERARCHY_LABELS[person.level]}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {person.email}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm">
            <Users className="size-4" aria-hidden />
            {person.clients} {person.clients === 1 ? "cliente" : "clientes"} na
            carteira
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-[110px_1fr] gap-3 text-sm">
        <dt className="text-muted-foreground">Gestor atual</dt>
        <dd className="font-medium">
          {current
            ? `${current.name} — ${HIERARCHY_LABELS[current.level]}`
            : "Sem gestor"}
        </dd>
      </dl>

      {topLevel ? (
        <p className="text-sm text-muted-foreground">
          {HIERARCHY_LABELS[person.level]} fica no topo da estrutura e não tem
          gestor.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-manager" className="font-semibold">
              Novo gestor
            </Label>
            <select
              id="new-manager"
              value={managerId}
              onChange={(event) => setManagerId(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-brand-gold-500/40 focus-visible:outline-none"
            >
              <option value="">Sem gestor</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} — {HIERARCHY_LABELS[option.level]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Só aparecem perfis ativos de nível acima de{" "}
              {HIERARCHY_LABELS[person.level]}.
            </p>
          </div>

          <Alert className="border-warning/30 bg-warning/5">
            <TriangleAlert className="text-warning" aria-hidden />
            <AlertDescription>
              Alterar o gestor muda quem enxerga a carteira desta pessoa: o novo
              gestor (e quem está acima dele) passa a ver os clientes dela. A
              alteração fica registrada na auditoria.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2">
            <Link
              href={closeHref}
              scroll={false}
              className={buttonVariants({ variant: "outline" })}
            >
              Cancelar
            </Link>
            <Button onClick={apply} disabled={!changed || pending}>
              {pending && <LoaderCircle className="animate-spin" aria-hidden />}
              Aplicar vínculo
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
