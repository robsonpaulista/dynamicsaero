export const HOJE = "2026-10-18";

export const VIEWER_ID = "eduardo";

export const OPERACAO = {
  name: "Ventura Aviação",
  viewerName: "Eduardo Ventura",
  viewerRole: "Sócio controlador",
  viewerInitials: "EV",
};

export const MONTHS = [
  { id: "2026-08", label: "Agosto 2026", short: "Agosto" },
  { id: "2026-09", label: "Setembro 2026", short: "Setembro" },
  { id: "2026-10", label: "Outubro 2026", short: "Outubro" },
] as const;

export type MonthId = (typeof MONTHS)[number]["id"];

export const AERODROMOS: Record<string, string> = {
  SBGR: "Guarulhos",
  SBCF: "Confins",
  SBFL: "Florianópolis",
  SBRJ: "Santos Dumont",
  SBBR: "Brasília",
  SBCT: "Curitiba",
  SBJD: "Jundiaí",
  SBMT: "Campo de Marte",
  SBKP: "Viracopos",
  SBSP: "Congonhas",
  SBVT: "Vitória",
  SBFZ: "Fortaleza",
  SBCY: "Cuiabá",
};
