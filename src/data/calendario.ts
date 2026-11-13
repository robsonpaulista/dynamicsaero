export const HOJE = "2026-11-06";

export const VIEWER_ID = "jadyel";

export const OPERACAO = {
  name: "JSA Aviação",
  viewerName: "Jadyel Alencar",
  viewerRole: "Sócio",
  viewerInitials: "JA",
};

export const MONTHS = [
  { id: "2026-01", label: "Janeiro 2026", short: "Janeiro" },
  { id: "2026-02", label: "Fevereiro 2026", short: "Fevereiro" },
  { id: "2026-03", label: "Março 2026", short: "Março" },
  { id: "2026-04", label: "Abril 2026", short: "Abril" },
  { id: "2026-05", label: "Maio 2026", short: "Maio" },
  { id: "2026-06", label: "Junho 2026", short: "Junho" },
  { id: "2026-07", label: "Julho 2026", short: "Julho" },
  { id: "2026-08", label: "Agosto 2026", short: "Agosto" },
  { id: "2026-09", label: "Setembro 2026", short: "Setembro" },
  { id: "2026-10", label: "Outubro 2026", short: "Outubro" },
  { id: "2026-11", label: "Novembro 2026", short: "Novembro" },
] as const;

export type MonthId = (typeof MONTHS)[number]["id"];

export { AERODROMOS, buscarAerodromos, cidadeDoIcao, listarAerodromos } from "@/data/aerodromos";
export type { Aerodromo } from "@/data/aerodromos";
