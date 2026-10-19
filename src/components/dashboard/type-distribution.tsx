import { EXPIRATION_TYPE_LABELS } from "@/lib/labels";
import type { TypeDistribution as Distribution } from "@/services/dashboard/get-dashboard";

/**
 * Slots categóricos 1–3 da paleta de referência, em ordem fixa (cor segue o
 * tipo, nunca a posição), com passos próprios por tema em globals.css.
 * Validados contra o card: no claro o slot 3 fica abaixo de 3:1, por isso a
 * legenda sempre mostra rótulo, quantidade e %.
 */
const TYPE_COLORS = {
  CERTIDAO: "var(--chart-type-1)",
  LICENCA: "var(--chart-type-2)",
  CERTIFICADO: "var(--chart-type-3)",
  // "Outros" em cinza neutro: categoria residual, não um 4º matiz.
  OUTRO: "var(--chart-type-other)",
} as const;

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

/** Parte do todo por tipo: barra empilhada horizontal + legenda com valores. */
export function TypeDistribution({ data }: { data: Distribution }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return (
      <p className="text-muted-foreground">
        Nenhum vencimento vigente para distribuir por tipo.
      </p>
    );
  }

  const visible = data.filter((item) => item.count > 0);

  return (
    <figure className="flex flex-col gap-5">
      <figcaption className="sr-only">
        Vencimentos vigentes por tipo:{" "}
        {data
          .map(
            (item) =>
              `${EXPIRATION_TYPE_LABELS[item.type]} ${item.count} (${percentFormatter.format(item.count / total)})`,
          )
          .join(", ")}
        .
      </figcaption>

      <p className="text-center">
        <span className="block text-4xl font-bold tabular-nums">{total}</span>
        <span className="text-sm text-muted-foreground">
          vencimentos vigentes
        </span>
      </p>

      <div className="flex h-4 w-full gap-0.5" aria-hidden>
        {visible.map((item, index) => {
          const share = item.count / total;
          return (
            <div
              key={item.type}
              className="group relative h-full first:rounded-l-[4px] last:rounded-r-[4px]"
              style={{
                width: `${share * 100}%`,
                backgroundColor: TYPE_COLORS[item.type],
                // Segmento mínimo visível para categorias pequenas.
                minWidth: 6,
              }}
              data-index={index}
            >
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100"
              >
                <span className="font-semibold">
                  {EXPIRATION_TYPE_LABELS[item.type]}
                </span>
                {": "}
                {item.count} ({percentFormatter.format(share)})
              </span>
            </div>
          );
        })}
      </div>

      <ul className="flex flex-col gap-3">
        {data.map((item) => (
          <li key={item.type} className="flex items-center gap-3 text-sm">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: TYPE_COLORS[item.type] }}
              aria-hidden
            />
            <span className="flex-1">{EXPIRATION_TYPE_LABELS[item.type]}</span>
            <span className="font-semibold tabular-nums">{item.count}</span>
            <span className="w-14 text-right text-muted-foreground tabular-nums">
              {percentFormatter.format(item.count / total)}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
