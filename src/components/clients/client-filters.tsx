import { Search } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ClientFiltersProps = {
  razao?: string;
  fantasia?: string;
  cnpj?: string;
  /** Preservado ao buscar; a página volta para 1. */
  porPagina: number;
};

// Formulário GET: a busca vai para a URL e é feita no servidor.
export function ClientFilters({
  razao,
  fantasia,
  cnpj,
  porPagina,
}: ClientFiltersProps) {
  return (
    <Card className="py-5">
      <form
        method="get"
        action="/clients"
        className="grid gap-4 px-5 md:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <input type="hidden" name="porPagina" value={porPagina} />
        <Field
          id="razao"
          label="Razão Social"
          placeholder="Digite a razão social…"
          value={razao}
        />
        <Field
          id="fantasia"
          label="Nome Fantasia"
          placeholder="Digite o nome fantasia…"
          value={fantasia}
        />
        <Field
          id="cnpj"
          label="CNPJ"
          placeholder="Digite o CNPJ…"
          value={cnpj}
        />
        <div className="flex items-end gap-2">
          <Button type="submit">
            <Search aria-hidden />
            Buscar
          </Button>
          <Link
            href="/clients"
            className={buttonVariants({ variant: "outline" })}
          >
            Limpar filtros
          </Link>
        </div>
      </form>
    </Card>
  );
}

function Field({
  id,
  label,
  placeholder,
  value,
}: {
  id: string;
  label: string;
  placeholder: string;
  value?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        defaultValue={value}
        placeholder={placeholder}
        maxLength={100}
        autoComplete="off"
      />
    </div>
  );
}
