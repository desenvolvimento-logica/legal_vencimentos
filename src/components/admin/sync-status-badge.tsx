import {
  CircleCheck,
  CircleX,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";

const STYLES = {
  RUNNING: {
    label: "Em execução",
    icon: LoaderCircle,
    className: "bg-info/10 text-info",
    spin: true,
  },
  SUCCESS: {
    label: "Sucesso",
    icon: CircleCheck,
    className: "bg-success/10 text-success",
    spin: false,
  },
  PARTIAL: {
    label: "Parcial",
    icon: TriangleAlert,
    className: "bg-warning/10 text-warning",
    spin: false,
  },
  FAILED: {
    label: "Falha",
    icon: CircleX,
    className: "bg-danger/10 text-danger",
    spin: false,
  },
} as const;

/** Estado de sincronização sempre com ícone, texto e cor (docs/UI-MOCKUPS.md §9). */
export function SyncStatusBadge({
  status,
  failed,
}: {
  status: keyof typeof STYLES;
  failed?: number;
}) {
  const style = STYLES[status];
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        style.className,
      )}
    >
      <Icon
        className={cn(
          "size-3.5",
          style.spin && "animate-spin motion-reduce:animate-none",
        )}
        aria-hidden
      />
      {style.label}
      {status === "PARTIAL" && failed
        ? ` — ${failed} ${failed === 1 ? "falha" : "falhas"}`
        : ""}
    </span>
  );
}
