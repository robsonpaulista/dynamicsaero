import { Plane } from "lucide-react";
import type { AircraftCategory } from "@/types/operacao";

type TomMarca = "em_voo" | "disponivel" | "retida";

function fundoDe(tom: TomMarca): string {
  if (tom === "em_voo") return "#E0F2FE";
  if (tom === "retida") return "#FEF2F2";
  return "#F1F5F9";
}

export function MarcaAeronave({
  category,
  tom,
}: {
  category: AircraftCategory;
  tom: TomMarca;
}) {
  const fundo = fundoDe(tom);
  const corpo = "#1E293B";

  if (category !== "helicoptero") {
    return (
      <span
        className="flex size-12 shrink-0 items-center justify-center rounded-[18px]"
        style={{ backgroundColor: fundo }}
      >
        <Plane className="size-7 shrink-0 fill-tse-yellow text-tse-yellow" aria-hidden />
      </span>
    );
  }

  return (
    <svg viewBox="0 0 64 64" className="size-12 shrink-0" aria-hidden>
      <rect width="64" height="64" rx="18" fill={fundo} />
      <g transform="translate(12 12) scale(1.67)" fill={corpo}>
        <path d="M20 5a1 1 0 0 1 0 2h-6v1c4.642 0 8 2.218 8 6a3 3 0 0 1-3 3h-3v1h3a1 1 0 0 1 0 2h-8a1 1 0 0 1 0-2h3v-1h-2c-1.652 0-3-1.348-3-3v-1.001l-6 .001a1 1 0 0 1-.894-.553l-1-2a1 1 0 0 1 1.788-.894l.724 1.447 5.382-.001.005-.175a3 3 0 0 1 2.995-2.824v-1h-7a1 1 0 1 1 0-2zm-3.999 5.174-.001 1.826h3.36c-.665-.906-1.825-1.539-3.359-1.826" />
      </g>
    </svg>
  );
}
