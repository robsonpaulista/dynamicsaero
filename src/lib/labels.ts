import type {
  AircraftCategory,
  Allocation,
  CrewRole,
  ExpenseCategory,
  ItineraryStatus,
  AporteMetodo,
  MxKind,
  Posting,
  Purpose,
} from "@/types/operacao";

/** Cores sólidas e suaves do calendário — base visual do cockpit. */
export const CORES_AGENDA = {
  humberto: "#C4843A",
  humbertoSoft: "#F3E6D8",
  ruan: "#5B8A5E",
  ruanSoft: "#E4F0E3",
  jadyel: "#6B5B95",
  jadyelSoft: "#E8E4F5",
} as const;

/** Posição da despesa: faturado=Ruan, previsto=Jadyel, provisionado=Humberto. */
export const CORES_POSICAO = {
  faturado: CORES_AGENDA.ruan,
  faturadoSoft: CORES_AGENDA.ruanSoft,
  faturadoTexto: "#3F6B4A",
  previsto: CORES_AGENDA.jadyel,
  previstoSoft: CORES_AGENDA.jadyelSoft,
  previstoTexto: "#4F4270",
  provisionado: CORES_AGENDA.humberto,
  provisionadoSoft: CORES_AGENDA.humbertoSoft,
  provisionadoTexto: "#8B5E3C",
} as const;

export const PARTNER_COLOR: Record<string, string> = {
  eduardo: CORES_AGENDA.jadyel,
  marina: CORES_AGENDA.ruan,
  leme: CORES_AGENDA.humberto,
  humberto: CORES_AGENDA.humberto,
  ruan: CORES_AGENDA.ruan,
  jadyel: CORES_AGENDA.jadyel,
};

/** Fundo suave do dia na agenda (calendário). */
export const PARTNER_CALENDAR_BG: Record<string, string> = {
  humberto: CORES_AGENDA.humbertoSoft,
  ruan: CORES_AGENDA.ruanSoft,
  jadyel: CORES_AGENDA.jadyelSoft,
  eduardo: CORES_AGENDA.jadyelSoft,
  marina: CORES_AGENDA.ruanSoft,
  leme: CORES_AGENDA.humbertoSoft,
};

const CORES_SOCIO = [CORES_AGENDA.humberto, CORES_AGENDA.ruan, CORES_AGENDA.jadyel];
const FUNDOS_SOCIO = [CORES_AGENDA.humbertoSoft, CORES_AGENDA.ruanSoft, CORES_AGENDA.jadyelSoft];

export function corDoSocio(id: string): string {
  const conhecida = PARTNER_COLOR[id];
  if (conhecida) return conhecida;
  const indice = [...id].reduce((soma, letra) => soma + letra.charCodeAt(0), 0) % CORES_SOCIO.length;
  return CORES_SOCIO[indice] ?? "#717171";
}

export function fundoCalendarioSocio(id: string): string {
  const conhecida = PARTNER_CALENDAR_BG[id];
  if (conhecida) return conhecida;
  const indice = [...id].reduce((soma, letra) => soma + letra.charCodeAt(0), 0) % FUNDOS_SOCIO.length;
  return FUNDOS_SOCIO[indice] ?? "#F4F4F2";
}

export const STATUS_LABEL: Record<string, string> = {
  disponivel: "Disponível",
  em_voo: "Em voo",
  manutencao: "Em manutenção",
  concluido: "Concluído",
  confirmado: "Confirmado",
  previsto: "Previsto",
  cancelado: "Cancelado",
  em_dia: "Em dia",
  proxima: "Próxima",
  em_execucao: "Em execução",
  regular: "Regular",
  renovacao: "A renovar",
  ativo: "Ativo",
  ferias: "Férias",
  treinamento: "Treinamento",
  realizado: "Faturado",
  provisionado: "Provisionado",
  critico: "Crítico",
  atencao: "Atenção",
  info: "Leitura",
  negocios: "Negócios",
  pessoal: "Pessoal",
  preventiva: "Preventiva",
  corretiva: "Corretiva",
  participacao: "Participação",
  solicitante: "Solicitante",
};

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  combustivel: "Combustível",
  taxas: "Taxas",
  handling: "Handling",
  catering: "Catering",
  hangar: "Hangar",
  seguro: "Seguro",
  tripulacao: "Tripulação",
  administrativo: "Gestão",
  manutencao: "Manutenção",
};

export const CATEGORY_ORDER: ExpenseCategory[] = [
  "combustivel",
  "taxas",
  "handling",
  "catering",
  "hangar",
  "seguro",
  "tripulacao",
  "administrativo",
  "manutencao",
];

export const ROLE_LABEL: Record<CrewRole, string> = {
  comandante: "Comandante",
  copiloto: "Copiloto",
  mecanico: "Mecânico",
  gestor: "Gestão",
};

export const PURPOSE_LABEL: Record<Purpose, string> = {
  negocios: "Negócios",
  pessoal: "Pessoal",
};

export const POSTING_LABEL: Record<Posting, string> = {
  realizado: "Faturado",
  previsto: "Previsto",
  provisionado: "Provisionado",
};

export const ALLOCATION_LABEL: Record<Allocation, string> = {
  participacao: "Proporcional à participação societária",
  solicitante: "Individual de um sócio",
};

/** Fixas = hangar, seguro, tripulação, gestão, manutenção. Variáveis = voo. */
export const CATEGORIAS_FIXAS: ExpenseCategory[] = [
  "hangar",
  "seguro",
  "tripulacao",
  "administrativo",
  "manutencao",
];

export const CATEGORIAS_VARIAVEIS: ExpenseCategory[] = [
  "combustivel",
  "taxas",
  "handling",
  "catering",
];

export function grupoDaDespesa(category: ExpenseCategory): "fixa" | "variavel" {
  return CATEGORIAS_VARIAVEIS.includes(category) ? "variavel" : "fixa";
}

export const METODO_LABEL: Record<AporteMetodo, string> = {
  pix: "PIX",
  ted: "TED",
  boleto: "Boleto",
  compensacao: "Compensação",
};

export const KIND_LABEL: Record<MxKind, string> = {
  preventiva: "Preventiva",
  corretiva: "Corretiva",
};

export const ITINERARY_LABEL: Record<ItineraryStatus, string> = {
  concluido: "Concluído",
  em_voo: "Em voo",
  confirmado: "Confirmado",
  previsto: "Previsto",
  cancelado: "Cancelado",
};

export const CATEGORY_TONE: Record<AircraftCategory, string> = {
  jato: "Jato",
  helicoptero: "Helicóptero",
  turbohelice: "Turboélice",
};

export function categoryBarColor(category: ExpenseCategory): string {
  if (category === "manutencao") return CORES_AGENDA.jadyel;
  if (
    category === "combustivel" ||
    category === "taxas" ||
    category === "handling" ||
    category === "catering"
  ) {
    return CORES_AGENDA.humberto;
  }
  return CORES_AGENDA.ruan;
}

export const STATUS_CLASS: Record<string, string> = {
  disponivel: "bg-[#E4F0E3] text-[#3F6B4A]",
  em_voo: "bg-[#E8E4F5] text-[#4F4270]",
  manutencao: "bg-[#F3E6D8] text-[#8B5E3C]",
  concluido: "bg-[#E4F0E3] text-[#3F6B4A]",
  confirmado: "bg-[#E8E4F5] text-[#4F4270]",
  previsto: "bg-[#E8E4F5] text-[#4F4270]",
  cancelado: "bg-[#F4F4F2] text-[#717171]",
  em_dia: "bg-[#E4F0E3] text-[#3F6B4A]",
  proxima: "bg-[#E8E4F5] text-[#4F4270]",
  em_execucao: "bg-[#F3E6D8] text-[#8B5E3C]",
  regular: "bg-[#E4F0E3] text-[#3F6B4A]",
  renovacao: "bg-[#E8E4F5] text-[#4F4270]",
  ativo: "bg-[#E4F0E3] text-[#3F6B4A]",
  ferias: "bg-[#F4F4F2] text-[#717171]",
  treinamento: "bg-[#E8E4F5] text-[#4F4270]",
  realizado: "bg-[#E4F0E3] text-[#3F6B4A]",
  previsto_posting: "bg-[#E8E4F5] text-[#4F4270]",
  provisionado: "bg-[#F3E6D8] text-[#8B5E3C]",
  critico: "bg-[#F3E6D8] text-[#8B5E3C]",
  atencao: "bg-[#E8E4F5] text-[#4F4270]",
  info: "bg-[#F4F4F2] text-[#333333]",
  negocios: "bg-[#E8E4F5] text-[#4F4270]",
  pessoal: "bg-[#F3E6D8] text-[#8B5E3C]",
  preventiva: "bg-[#E4F0E3] text-[#3F6B4A]",
  corretiva: "bg-[#F3E6D8] text-[#8B5E3C]",
};
