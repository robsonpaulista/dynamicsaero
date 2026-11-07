import caso from "@/data/caso-jsa.json";
import notas from "@/data/notas-fiscais.json";
import type {
  Aircraft,
  Aporte,
  CrewMember,
  Expense,
  Hangar,
  Insurance,
  Itinerary,
  MaintenanceItem,
  NotaFiscal,
  Partner,
  Rota,
} from "@/types/operacao";

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
