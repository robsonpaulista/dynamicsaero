import caso from "@/data/caso-jsa.json";
import notas from "@/data/notas-fiscais.json";
import { CONTAS_PADRAO } from "@/data/plano-contas";
import type {
  Aircraft,
  Aporte,
  ContaPlano,
  CrewMember,
  Expense,
  FaixaEscala,
  Hangar,
  Insurance,
  Itinerary,
  MaintenanceItem,
  NotaFiscal,
  Partner,
  Rota,
} from "@/types/operacao";

export const CONTAS: ContaPlano[] = CONTAS_PADRAO;

export const PARTNERS = caso.partners as Partner[];
export const AIRCRAFT = caso.aircraft as Aircraft[];
export const CREW = caso.crew as CrewMember[];
export const HANGARS = caso.hangars as Hangar[];
export const SEGUROS = caso.seguros as Insurance[];
export const ITINERARIES = caso.itineraries as Itinerary[];
export const MAINTENANCE = caso.maintenance as MaintenanceItem[];
export const EXTRAS = caso.extras as Expense[];
export const APORTES = caso.aportes as Aporte[];
export const ROTAS = caso.rotas as Rota[];
export const NOTAS_FISCAIS = notas as NotaFiscal[];

/** Escala demo PS-JSA: terços do mês (Jadyel / Humberto / Ruan). */
function escalasDemoPsjsa(): FaixaEscala[] {
  const meses = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
  const faixas: FaixaEscala[] = [];
  for (const month of meses) {
    const [, mesTexto] = month.split("-");
    const ultimo = new Date(2026, Number(mesTexto), 0).getDate();
    faixas.push(
      {
        id: `esc-${month}-jadyel`,
        aircraftId: "psjsa",
        month,
        partnerId: "jadyel",
        startDay: 1,
        endDay: 10,
      },
      {
        id: `esc-${month}-humberto`,
        aircraftId: "psjsa",
        month,
        partnerId: "humberto",
        startDay: 11,
        endDay: 20,
      },
      {
        id: `esc-${month}-ruan`,
        aircraftId: "psjsa",
        month,
        partnerId: "ruan",
        startDay: 21,
        endDay: ultimo,
      },
    );
  }
  return faixas;
}

export const ESCALAS = escalasDemoPsjsa();
