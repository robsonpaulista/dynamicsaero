/** Principais aeródromos do Brasil (ICAO → cidade/nome usual) + regionais da operação. */
export const AERODROMOS: Record<string, string> = {
  // São Paulo / Campinas / interior
  SBGR: "Guarulhos",
  SBSP: "Congonhas",
  SBKP: "Viracopos",
  SBMT: "Campo de Marte",
  SBJD: "Jundiaí",
  SDCO: "Sorocaba",
  SBRP: "Ribeirão Preto",
  SBBU: "Bauru",
  SBML: "Marília",
  SBDN: "Presidente Prudente",
  SBSR: "São José do Rio Preto",
  SBAS: "Assis",
  SBAQ: "Araraquara",
  SDSC: "São Carlos",
  SDCG: "Catanduva",

  // Rio de Janeiro
  SBGL: "Rio de Janeiro · Galeão",
  SBRJ: "Rio de Janeiro · Santos Dumont",
  SBJR: "Rio de Janeiro · Jacarepaguá",
  SBCB: "Cabo Frio",
  SBCP: "Campos dos Goytacazes",
  SBMK: "Maricá",

  // Minas Gerais / Espírito Santo
  SBCF: "Confins",
  SBBH: "Pampulha",
  SBUR: "Uberaba",
  SBUL: "Uberlândia",
  SBZM: "Juiz de Fora",
  SBIP: "Ipatinga",
  SBVT: "Vitória",

  // Sul
  SBCT: "Curitiba",
  SBFI: "Foz do Iguaçu",
  SBLO: "Londrina",
  SBMG: "Maringá",
  SBCA: "Cascavel",
  SBFL: "Florianópolis",
  SBNF: "Navegantes",
  SBJV: "Joinville",
  SBCH: "Chapecó",
  SBJA: "Jaguaruna",
  SBPA: "Porto Alegre",
  SBCX: "Caxias do Sul",
  SBSM: "Santa Maria",
  SBPK: "Pelotas",
  SBUG: "Uruguaiana",
  SBPF: "Passo Fundo",

  // Centro-Oeste
  SBBR: "Brasília",
  SBNV: "Goiânia",
  SBAN: "Anápolis",
  SBCY: "Cuiabá",
  SBSI: "Sinop",
  SBRD: "Rondonópolis",
  SBCG: "Campo Grande",
  SBCR: "Corumbá",
  SBDO: "Dourados",
  SBPJ: "Palmas",
  SWGN: "Araguaína",

  // Nordeste
  SBFZ: "Fortaleza",
  SBJE: "Cruz",
  SBJU: "Juazeiro do Norte",
  SBTE: "Teresina",
  SBPB: "Parnaíba",
  SBSL: "São Luís",
  SBIZ: "Imperatriz",
  SBRF: "Recife",
  SBFN: "Fernando de Noronha",
  SBPL: "Petrolina",
  SBMO: "Maceió",
  SBAR: "Aracaju",
  SBSV: "Salvador",
  SBPS: "Porto Seguro",
  SBIL: "Ilhéus",
  SBQV: "Vitória da Conquista",
  SNBR: "Barreiras",
  SBLE: "Lençóis",
  SBJP: "João Pessoa",
  SBKG: "Campina Grande",
  SBNT: "Natal",
  SBSG: "São Gonçalo do Amarante",
  SBMS: "Mossoró",

  // Norte
  SBBE: "Belém",
  SBMA: "Marabá",
  SBSN: "Santarém",
  SBHT: "Altamira",
  SBEG: "Manaus",
  SBTF: "Tefé",
  SBIH: "Itaituba",
  SBMQ: "Macapá",
  SBBV: "Boa Vista",
  SBRB: "Rio Branco",
  SBCZ: "Cruzeiro do Sul",
  SBPV: "Porto Velho",
  SBJI: "Ji-Paraná",
  SBVH: "Vilhena",

  // Regionais da operação (Piauí / entorno)
  SD7E: "Teresina",
  SNPC: "Picos",
  SI8W: "Cajueiro da Praia",
  SWAY: "Piripiri",
  SSKE: "Cocal",
  SD9C: "São João do Piauí",
  SJ4E: "Barras",
  SJOJ: "Açailândia",
  SSRS: "Barreirinhas",
  SNK7: "Jaicós",
  SNAB: "Araripina",
  SJI3: "Uruçuí",
  SDZS: "Uruçuí",
  SIME: "Davinópolis",
  SJKG: "Regeneração",
  SWUV: "Sebastião Leal",
  SSIA: "Baixa Grande do Ribeiro",
  SDXB: "Piracuruca",
  SNOE: "Oeiras",
  SDYW: "Luzilândia",
  SSPF: "Altos",
  SDKE: "Valença do Piauí",
  SDX4: "Canto do Buriti",
  SS9P: "Canto do Buriti",
  SJXE: "Buriti dos Lopes",
  SJ4Z: "Paes Landim",
  SNOZ: "Paço do Lumiar",
  SIXE: "Eldorado do Sul",
  SWKQ: "São Raimundo Nonato",
};

export type Aerodromo = {
  icao: string;
  cidade: string;
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

/** Catálogo estático + cadastros da operação (extras sobrescrevem). */
export function mapaAerodromos(extras: Aerodromo[] = []): Record<string, string> {
  const mapa: Record<string, string> = { ...AERODROMOS };
  for (const item of extras) {
    const icao = item.icao.trim().toUpperCase();
    const cidade = item.cidade.trim();
    if (!icao || !cidade) continue;
    mapa[icao] = cidade;
  }
  return mapa;
}

export function cidadeDoIcao(icao: string, fallback = "", extras: Aerodromo[] = []): string {
  const codigo = icao.trim().toUpperCase();
  return mapaAerodromos(extras)[codigo] ?? fallback;
}

/** Busca por ICAO ou cidade (acentos ignorados; palavras inteiras têm prioridade). */
export function buscarAerodromos(query: string, limite = 12, extras: Aerodromo[] = []): Aerodromo[] {
  const bruto = query.includes("·") ? (query.split("·")[0] ?? query) : query;
  const q = normalizar(bruto);
  if (!q) return [];

  const lista: Array<Aerodromo & { score: number }> = [];
  for (const [icao, cidade] of Object.entries(mapaAerodromos(extras))) {
    const icaoN = normalizar(icao);
    const cidadeN = normalizar(cidade);
    const palavras = cidadeN.split(/[^a-z0-9]+/).filter(Boolean);
    let score = 0;
    if (icaoN === q) score = 100;
    else if (icaoN.startsWith(q)) score = 90;
    else if (cidadeN === q) score = 85;
    else if (cidadeN.startsWith(q)) score = 80;
    else if (palavras.some((p) => p === q)) score = 75;
    else if (palavras.some((p) => p.startsWith(q))) score = 65;
    else if (icaoN.includes(q)) score = 45;
    else if (cidadeN.includes(q) && q.length >= 3) score = 35;
    else continue;
    lista.push({ icao, cidade, score });
  }

  return lista
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.cidade.localeCompare(right.cidade, "pt-BR") ||
        left.icao.localeCompare(right.icao),
    )
    .slice(0, limite)
    .map(({ icao, cidade }) => ({ icao, cidade }));
}

export function listarAerodromos(extras: Aerodromo[] = []): Aerodromo[] {
  return Object.entries(mapaAerodromos(extras))
    .map(([icao, cidade]) => ({ icao, cidade }))
    .sort(
      (left, right) =>
        left.cidade.localeCompare(right.cidade, "pt-BR") || left.icao.localeCompare(right.icao),
    );
}

/** Normaliza e valida sigla + cidade no padrão do cadastro. */
export function normalizarAerodromo(icao: string, cidade: string): Aerodromo | null {
  const codigo = icao.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const nome = cidade.trim().replace(/\s+/g, " ");
  if (codigo.length < 3 || codigo.length > 4 || !nome) return null;
  return { icao: codigo, cidade: nome };
}
