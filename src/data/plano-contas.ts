import type { ContaPlano } from "@/types/operacao";

/** Catálogo inicial do plano de contas (fixas e variáveis). */
export const CONTAS_PADRAO: ContaPlano[] = [
  // Variáveis (voo)
  { id: "conta-combustivel", nome: "Combustível", category: "combustivel", grupo: "variavel", ativo: true },
  { id: "conta-taxas-aero", nome: "Taxas aeroportuárias", category: "taxas", grupo: "variavel", ativo: true },
  { id: "conta-tarifa-pouso", nome: "Tarifa de pouso", category: "taxas", grupo: "variavel", ativo: true },
  { id: "conta-handling", nome: "Handling / pátio", category: "handling", grupo: "variavel", ativo: true },
  { id: "conta-catering", nome: "Catering", category: "catering", grupo: "variavel", ativo: true },
  { id: "conta-fbo", nome: "FBO / serviços de solo", category: "handling", grupo: "variavel", ativo: true },

  // Fixas
  { id: "conta-hangar", nome: "Hangar", category: "hangar", grupo: "fixa", ativo: true },
  { id: "conta-seguro", nome: "Seguro", category: "seguro", grupo: "fixa", ativo: true },
  { id: "conta-tripulacao", nome: "Tripulação / folha", category: "tripulacao", grupo: "fixa", ativo: true },
  { id: "conta-gestao", nome: "Gestão administrativa", category: "administrativo", grupo: "fixa", ativo: true },
  { id: "conta-contabilidade", nome: "Contabilidade / honorários", category: "administrativo", grupo: "fixa", ativo: true },
  { id: "conta-manut-prev", nome: "Manutenção preventiva", category: "manutencao", grupo: "fixa", ativo: true },
  { id: "conta-manut-corr", nome: "Manutenção corretiva", category: "manutencao", grupo: "fixa", ativo: true },
  { id: "conta-treinamentos", nome: "Treinamentos", category: "administrativo", grupo: "fixa", ativo: true },
  { id: "conta-comunicacao", nome: "Comunicação / dados", category: "administrativo", grupo: "fixa", ativo: true },
];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function buscarContasPlano(contas: ContaPlano[], query: string, limite = 12): ContaPlano[] {
  const ativas = contas.filter((item) => item.ativo);
  const q = normalizar(query);
  if (!q) return ativas.slice(0, limite);

  return ativas
    .map((item) => {
      const nome = normalizar(item.nome);
      let score = 0;
      if (nome === q) score = 100;
      else if (nome.startsWith(q)) score = 80;
      else if (nome.includes(q)) score = 50;
      else return null;
      return { item, score };
    })
    .filter((row): row is { item: ContaPlano; score: number } => row !== null)
    .sort(
      (left, right) =>
        right.score - left.score || left.item.nome.localeCompare(right.item.nome, "pt-BR"),
    )
    .slice(0, limite)
    .map((row) => row.item);
}

/** Une o catálogo padrão com contas salvas (salvas ganham de id igual). */
export function mesclarContasPlano(salvas: ContaPlano[] | null | undefined): ContaPlano[] {
  const mapa = new Map<string, ContaPlano>();
  for (const item of CONTAS_PADRAO) mapa.set(item.id, item);
  for (const item of salvas ?? []) {
    if (!item?.id || !item.nome) continue;
    mapa.set(item.id, item);
  }
  return [...mapa.values()].sort((left, right) => {
    if (left.grupo !== right.grupo) return left.grupo === "fixa" ? -1 : 1;
    return left.nome.localeCompare(right.nome, "pt-BR");
  });
}
