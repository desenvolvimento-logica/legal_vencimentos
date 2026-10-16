"use client";

import { Building2, LoaderCircle, Plus, Search } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getExpirationFormContext,
  searchClientsForExpiration,
  type ClientOption,
  type ExpirationFormContext,
} from "@/services/expirations/form-context";

import { ExpirationFormSheet } from "./expiration-form-sheet";

/**
 * Novo vencimento fora do detalhe do cliente: primeiro escolhe-se o cliente
 * (docs/UI-MOCKUPS.md §9, Vencimentos), depois abre o formulário padrão.
 */
export function NewExpirationButton() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [context, setContext] = useState<ExpirationFormContext | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(client: ClientOption) {
    startTransition(async () => {
      const result = await getExpirationFormContext(client.id);
      if (!result) {
        toast.error("Não foi possível abrir o cadastro para este cliente.");
        return;
      }
      setPickerOpen(false);
      setContext(result);
    });
  }

  return (
    <>
      <Button onClick={() => setPickerOpen(true)}>
        <Plus aria-hidden />
        Novo vencimento
      </Button>

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-[460px]"
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle className="text-2xl font-bold">
              Novo vencimento
            </SheetTitle>
            <SheetDescription>
              Escolha o cliente do vencimento.
            </SheetDescription>
          </SheetHeader>
          <ClientPicker onChoose={choose} choosing={pending} />
        </SheetContent>
      </Sheet>

      {context && (
        <ExpirationFormSheet
          open
          onOpenChange={(open) => !open && setContext(null)}
          client={context.client}
          responsibles={context.options}
          defaultResponsibleId={context.defaultId}
        />
      )}
    </>
  );
}

function ClientPicker({
  onChoose,
  choosing,
}: {
  onChoose: (client: ClientOption) => void;
  choosing: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientOption[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Busca no servidor com debounce de 300 ms (DEVELOPMENT.md §7).
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const found = await searchClientsForExpiration(term);
      if (!cancelled) {
        setResults(found);
        setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const showResults = query.trim().length >= 2 && results;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Razão social ou CNPJ"
          aria-label="Buscar cliente"
          className="pl-9"
        />
      </div>

      {searching && (
        <p
          className="flex items-center gap-2 text-sm text-muted-foreground"
          aria-live="polite"
        >
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Buscando…
        </p>
      )}
      {!searching && query.trim().length < 2 && (
        <p className="text-sm text-muted-foreground">
          Digite ao menos 2 caracteres para buscar na sua carteira.
        </p>
      )}
      {!searching && showResults && results.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum cliente encontrado.
        </p>
      )}
      {showResults && results.length > 0 && (
        <ul className="flex flex-col gap-2">
          {results.map((client) => (
            <li key={client.id}>
              <button
                type="button"
                disabled={choosing}
                onClick={() => onChoose(client)}
                className="flex w-full items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
              >
                <Building2
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {client.name}
                  </span>
                  {client.document && (
                    <span className="block text-sm text-muted-foreground tabular-nums">
                      {client.document}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
