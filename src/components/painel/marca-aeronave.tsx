import type { AircraftCategory } from "@/types/operacao";

type TomMarca = "em_voo" | "disponivel" | "retida";

function fundoDe(tom: TomMarca): string {
  if (tom === "em_voo") return "#E0F2FE";
  if (tom === "retida") return "#FEF2F2";
  return "#F1F5F9";
}

function acentoDe(tom: TomMarca): string {
  if (tom === "retida") return "#EF4444";
  return "#38BDF8";
}

export function MarcaAeronave({
  category,
  tom,
}: {
  category: AircraftCategory;
  tom: TomMarca;
}) {
  const fundo = fundoDe(tom);
  const acento = acentoDe(tom);
  const corpo = "#1E293B";

  return (
    <svg viewBox="0 0 64 64" className="size-12 shrink-0" aria-hidden>
      <rect width="64" height="64" rx="18" fill={fundo} />
      {category === "helicoptero" ? (
        <g>
          <ellipse cx="34" cy="16.5" rx="18" ry="2.1" fill={acento} />
          <path d="M33.2 16.5v6" stroke={corpo} strokeWidth="1.7" strokeLinecap="round" />
          <path
            fill={corpo}
            d="M22.5 28.2c0-4 3.6-6.6 9.2-6.6h8.2c5.2 0 8.1 2.5 8.1 6.1v5.4c0 3.1-2.4 5.2-6.1 5.2H27.2c-3.4 0-4.7-1.8-4.7-4.6v-5.5z"
          />
          <path fill="#F8FAFC" d="M36.2 24.2h8.4c1.5 0 2.4.8 2.4 2s-.9 2-2.4 2h-8.4v-4z" />
          <path fill={corpo} d="M22.8 32.2H12.6c-.9 0-1.3.9-.7 1.6l2.4 2.5h8.5v-4.1z" />
          <path d="M12.2 27.2v9.2" stroke={acento} strokeWidth="2" strokeLinecap="round" />
          <path d="M27 43.2h13.5" stroke={corpo} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M30.2 38.6v4.6M37.2 38.6v4.6" stroke={corpo} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <path fill={corpo} d="M20 27.5h24a5 5 0 0 1 0 10H20a5 5 0 0 1 0-10z" />
          <path fill={corpo} d="M18.5 29.2 23 16.8h4.2L25.2 30.2h-6.7v-1z" />
          <path fill={acento} d="m29.5 34.2 16-1.8-1.6 5.4H28.8l.7-3.6z" />
          <circle cx="40" cy="32.2" r="1.05" fill="#F8FAFC" />
          <circle cx="44.2" cy="32.2" r="1.05" fill="#F8FAFC" />
        </g>
      )}
    </svg>
  );
}
