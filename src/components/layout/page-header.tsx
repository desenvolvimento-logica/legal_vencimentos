type PageHeaderProps = {
  title: string;
  description?: string;
  /** Conteúdo à direita do título (data, ações). */
  aside?: React.ReactNode;
};

export function PageHeader({ title, description, aside }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-[2rem] leading-tight font-bold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-lg text-muted-foreground">{description}</p>
        )}
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}
