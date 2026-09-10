interface PlaceholderPageProps {
  title: string;
  phase: string;
}

export function PlaceholderPage({ title, phase }: PlaceholderPageProps) {
  return (
    <section>
      <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">
        Módulo previsto para implementação na {phase} do plano de fases.
      </p>
    </section>
  );
}
