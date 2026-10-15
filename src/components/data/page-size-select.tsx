"use client";

import { useRouter } from "next/navigation";

type PageSizeSelectProps = {
  value: number;
  options: readonly number[];
  hrefs: Record<number, string>;
};

export function PageSizeSelect({ value, options, hrefs }: PageSizeSelectProps) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only">Itens por página</span>
      <select
        value={value}
        onChange={(event) => router.push(hrefs[Number(event.target.value)])}
        className="h-9 rounded-lg border border-input bg-card px-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-brand-gold-500/40 focus-visible:outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option} por página
          </option>
        ))}
      </select>
    </label>
  );
}
