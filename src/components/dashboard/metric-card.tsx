import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MetricTone =
  "neutral" | "danger" | "orange" | "warning" | "info" | "success" | "quote";

const TONES: Record<MetricTone, { chip: string; value: string }> = {
  neutral: { chip: "bg-muted text-foreground", value: "text-foreground" },
  danger: { chip: "bg-danger/10 text-danger", value: "text-danger" },
  orange: {
    chip: "bg-orange/10 text-orange",
    value: "text-orange",
  },
  warning: { chip: "bg-warning/10 text-warning", value: "text-warning" },
  info: { chip: "bg-info/10 text-info", value: "text-info" },
  success: { chip: "bg-success/10 text-success", value: "text-success" },
  quote: { chip: "bg-quote/10 text-quote", value: "text-quote" },
};

/** Visual de um indicador do Dashboard (docs/mockups/02-dashboard.png). */
export function MetricCardBody({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: MetricTone;
}) {
  return (
    <Card className="h-full gap-3 px-5 py-5 text-left transition-shadow group-hover:shadow-md">
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-lg",
          TONES[tone].chip,
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-[2.25rem] leading-none font-bold tabular-nums",
          TONES[tone].value,
        )}
      >
        {value}
      </p>
    </Card>
  );
}
