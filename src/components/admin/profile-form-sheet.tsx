"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle, Search, TriangleAlert } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
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
} from "@/components/ui/sheet";
import {
  LEVELS,
  managerOptionsFor,
  type HierarchyLevel,
} from "@/lib/admin/hierarchy";
import { HIERARCHY_LABELS } from "@/lib/auth/labels";
import {
  profileFieldsSchema,
  type CreateProfileInput,
} from "@/lib/validators/profile";
import {
  createProfile,
  searchProfileCandidates,
  updateProfile,
  type ProfileCandidate,
} from "@/services/admin/actions";

export type ProfileOption = {
  id: string;
  name: string;
  level: HierarchyLevel;
  active: boolean;
};

type FormValues = Omit<CreateProfileInput, "userId">;

type ProfileFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Perfis existentes, para a lista de gestores. */
  profiles: ProfileOption[];
  /** Edição; sem isso, adiciona um novo usuário. */
  profile?: {
    id: string;
    email: string;
    active: boolean;
    values: FormValues;
  };
  /** O próprio admin não pode se desativar nem perder o nível ADMIN. */
  isSelf?: boolean;
};

const selectClassName =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-brand-gold-500/40 focus-visible:outline-none disabled:bg-muted disabled:text-muted-foreground";

// Referência visual: docs/mockups/09-admin-users.png (drawer "Editar usuário").
export function ProfileFormSheet(props: ProfileFormSheetProps) {
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[460px]"
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="text-2xl font-bold">
            {props.profile ? "Editar usuário" : "Adicionar usuário"}
          </SheetTitle>
          <SheetDescription>
            {props.profile
              ? props.profile.email
              : "Dê acesso a uma conta Microsoft do escritório."}
          </SheetDescription>
        </SheetHeader>
        {/* Desmontado ao fechar: cada abertura começa dos valores atuais. */}
        <ProfileForm {...props} onClose={() => props.onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function ProfileForm({
  profiles,
  profile,
  isSelf,
  onClose,
}: ProfileFormSheetProps & { onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<ProfileCandidate | null>(null);
  const [active, setActive] = useState(profile?.active ?? true);

  const { register, handleSubmit, formState, setError, setValue, control } =
    useForm<FormValues, unknown, FormValues>({
      resolver: zodResolver(profileFieldsSchema, undefined, { raw: true }),
      defaultValues: profile?.values ?? {
        name: "",
        jobTitle: "",
        level: "USER",
        managerId: "",
      },
    });
  const level = useWatch({ control, name: "level" }) as HierarchyLevel;
  const managers = managerOptionsFor(profiles, level, profile?.id);
  const errors = formState.errors;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    if (!profile && !candidate) {
      setFormError("Selecione a conta Microsoft do usuário.");
      return;
    }
    // Gestor que deixou de ser válido para o nível escolhido é descartado.
    const managerId = managers.some((m) => m.id === values.managerId)
      ? values.managerId
      : "";
    startTransition(async () => {
      const result = profile
        ? await updateProfile({
            ...values,
            managerId,
            profileId: profile.id,
            active,
          })
        : await createProfile({
            ...values,
            managerId,
            userId: candidate!.userId,
          });
      if (!result.ok) {
        setFormError(result.error);
        for (const [field, message] of Object.entries(
          result.fieldErrors ?? {},
        )) {
          setError(field as FieldPath<FormValues>, { message });
        }
        return;
      }
      toast.success(profile ? "Usuário atualizado." : "Usuário adicionado.");
      onClose();
    });
  });

  return (
    <>
      <form
        id="profile-form"
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

        {!profile && (
          <CandidatePicker
            selected={candidate}
            onSelect={(value) => {
              setCandidate(value);
              setValue("name", value?.name ?? "");
            }}
          />
        )}

        <Field id="name" label="Nome" required error={errors.name?.message}>
          <Input id="name" maxLength={200} {...register("name")} />
        </Field>

        {profile && (
          <Field
            id="email"
            label="E-mail"
            hint="O e-mail vem da conta Microsoft e não pode ser alterado."
          >
            <Input id="email" value={profile.email} disabled readOnly />
          </Field>
        )}

        <Field id="jobTitle" label="Cargo" error={errors.jobTitle?.message}>
          <Input
            id="jobTitle"
            maxLength={200}
            placeholder="Ex.: Analista de Legalização"
            {...register("jobTitle")}
          />
        </Field>

        <Field
          id="level"
          label="Nível hierárquico"
          required
          error={errors.level?.message}
        >
          <select id="level" {...register("level")} className={selectClassName}>
            {/* O próprio admin não pode deixar o nível ADMIN (o banco também recusa). */}
            {(isSelf ? (["ADMIN"] as const) : LEVELS).map((value) => (
              <option key={value} value={value}>
                {HIERARCHY_LABELS[value]} ({value})
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="managerId"
          label="Gestor"
          hint={
            level === "DIRECTOR" || level === "ADMIN"
              ? "Diretores e administradores não têm gestor."
              : "Só aparecem perfis ativos de nível acima."
          }
        >
          <select
            id="managerId"
            {...register("managerId")}
            className={selectClassName}
            disabled={managers.length === 0}
          >
            <option value="">Sem gestor</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name} — {HIERARCHY_LABELS[manager.level]}
              </option>
            ))}
          </select>
        </Field>

        {profile && (
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              role="switch"
              checked={active}
              disabled={isSelf}
              onChange={(event) => setActive(event.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-input transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:opacity-50 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-card after:shadow after:transition-transform peer-checked:after:translate-x-5"
            />
            <span className="text-sm">
              <span className="block font-semibold">Usuário ativo</span>
              <span className="text-muted-foreground">
                {active
                  ? "Usuário poderá acessar o sistema."
                  : "O acesso é bloqueado na próxima requisição."}
              </span>
            </span>
          </label>
        )}

        <Alert className="border-warning/30 bg-warning/5">
          <TriangleAlert className="text-warning" aria-hidden />
          <AlertDescription>
            Alterações de nível, gestor e status mudam o que a pessoa enxerga e
            ficam registradas na auditoria.
          </AlertDescription>
        </Alert>
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
        <Button type="submit" form="profile-form" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {profile ? "Salvar alterações" : "Adicionar usuário"}
        </Button>
      </SheetFooter>
    </>
  );
}

function CandidatePicker({
  selected,
  onSelect,
}: {
  selected: ProfileCandidate | null;
  onSelect: (candidate: ProfileCandidate | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  // Busca no servidor com debounce de 300 ms.
  useEffect(() => {
    if (selected) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const found = await searchProfileCandidates(query);
      if (!cancelled) {
        setResults(found);
        setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selected]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{selected.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {selected.email}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onSelect(null)}
        >
          Trocar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="candidate-search" className="font-semibold">
        Conta Microsoft{" "}
        <span className="text-destructive" aria-hidden>
          *
        </span>
      </Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="candidate-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nome ou e-mail"
          className="pl-9"
          autoComplete="off"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Aparecem contas que já entraram com a Microsoft em algum sistema do
        escritório e ainda não têm acesso a este.
      </p>
      {searching ? (
        <p
          className="flex items-center gap-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Buscando…
        </p>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma conta encontrada.
        </p>
      ) : (
        <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {results.map((result) => (
            <li key={result.userId}>
              <button
                type="button"
                onClick={() => onSelect(result)}
                className="w-full rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="block truncate font-medium">
                  {result.name}
                </span>
                <span className="block truncate text-muted-foreground">
                  {result.email}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
