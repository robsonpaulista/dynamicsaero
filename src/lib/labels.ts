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

export const PARTNER_COLOR: Record<string, string> = {
  eduardo: "#1E293B",
  marina: "#0284C7",
  leme: "#334155",
};

const CORES_SOCIO = ["#1E293B", "#0284C7", "#334155", "#0F172A", "#EF4444"];

export function corDoSocio(id: string): string {
  const conhecida = PARTNER_COLOR[id];
  if (conhecida) return conhecida;
  const indice = [...id].reduce((soma, letra) => soma + letra.charCodeAt(0), 0) % CORES_SOCIO.length;
  return CORES_SOCIO[indice] ?? "#717171";
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
  realizado: "Realizado",
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
  realizado: "Realizado",
  previsto: "Previsto",
  provisionado: "Provisionado",
};

export const ALLOCATION_LABEL: Record<Allocation, string> = {
  participacao: "Pela participação",
  solicitante: "Quem pediu o voo",
};

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
};

export function categoryBarColor(category: ExpenseCategory): string {
  if (category === "manutencao") return "#0284C7";
  if (
    category === "combustivel" ||
    category === "taxas" ||
    category === "handling" ||
    category === "catering"
  ) {
    return "#334155";
  }
  return "#0284C7";
}

export const STATUS_CLASS: Record<string, string> = {
  disponivel: "bg-[#F1F5F9] text-[#334155]",
  em_voo: "bg-[#38BDF8] text-[#0F172A]",
  manutencao: "bg-[#FEF2F2] text-[#EF4444]",
  concluido: "bg-[#F1F5F9] text-[#334155]",
  confirmado: "bg-[#E0F2FE] text-[#0369A1]",
  previsto: "bg-[#F4F4F2] text-[#333333]",
  cancelado: "bg-[#F4F4F2] text-[#717171]",
  em_dia: "bg-[#F1F5F9] text-[#334155]",
  proxima: "bg-[#E0F2FE] text-[#0369A1]",
  em_execucao: "bg-[#FEF2F2] text-[#EF4444]",
  regular: "bg-[#F1F5F9] text-[#334155]",
  renovacao: "bg-[#E0F2FE] text-[#0369A1]",
  ativo: "bg-[#F1F5F9] text-[#334155]",
  ferias: "bg-[#F4F4F2] text-[#717171]",
  treinamento: "bg-[#E8EEF4] text-[#334155]",
  realizado: "bg-[#F1F5F9] text-[#334155]",
  previsto_posting: "bg-[#E0F2FE] text-[#0369A1]",
  provisionado: "bg-[#E8EEF4] text-[#334155]",
  critico: "bg-[#FEF2F2] text-[#EF4444]",
  atencao: "bg-[#E0F2FE] text-[#0369A1]",
  info: "bg-[#F4F4F2] text-[#333333]",
  negocios: "bg-[#E0F2FE] text-[#0369A1]",
  pessoal: "bg-[#F4F4F2] text-[#333333]",
  preventiva: "bg-[#F1F5F9] text-[#334155]",
  corretiva: "bg-[#FEF2F2] text-[#EF4444]",
};
