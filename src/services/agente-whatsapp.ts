import { AERODROMOS } from "@/data/calendario";
import { formatBRL, formatDateShort } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/labels";
import { digitosWhatsapp } from "@/lib/telefone";
import { criarId, salvarItinerario } from "@/services/acoes";
import {
  aeronavesDoSocio,
  avaliarTrechos,
  buscarPousos,
  lerHorarioVolta,
  lerQuandoOnde,
  linhaAeronave,
  montarTrecho,
  nomePouso,
  posicaoNoHorario,
  type TrechoPedido,
} from "@/services/disponibilidade-voo";
import {
  contaCorrente,
  getAircraft,
  itinerariesIn,
  itineraryCities,
  itinerarySpan,
  listAircraft,
  listCrew,
  listPartners,
  monthLabel,
  partnerShort,
} from "@/services/operacao";
import type { Itinerary, Leg } from "@/types/operacao";

export type PapelAgente = "socio" | "desconhecido";

export type IdentidadeAgente = {
  papel: PapelAgente;
  partnerId: string | null;
  nome: string;
  telefone: string;
};

export type OpcaoAgente = {
  id: string;
  rotulo: string;
};

export type RascunhoVoo = {
  etapa: "aeronave" | "dados" | "pouso" | "volta" | "confirmar";
  aircraftId: string | null;
  trechos: TrechoPedido[];
  data: string | null;
  saida: string | null;
  origemIcao: string | null;
  pousos: string[];
  voltaPara: string | null;
};

export type RespostaAgente = {
  texto: string;
  opcoes: OpcaoAgente[];
  rascunho: RascunhoVoo | null;
};

const MENU_SOCIO: OpcaoAgente[] = [
  { id: "frota", rotulo: "Status das aeronaves" },
  { id: "agenda", rotulo: "Agenda de voos" },
  { id: "extrato", rotulo: "Extrato do mês" },
  { id: "agendar", rotulo: "Agendar um voo" },
];

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function responder(texto: string, opcoes: OpcaoAgente[], rascunho: RascunhoVoo | null): RespostaAgente {
  return { texto, opcoes, rascunho };
}

function rascunhoDe(parcial: {
  etapa: RascunhoVoo["etapa"];
  aircraftId: string | null;
  trechos?: TrechoPedido[];
  data?: string | null;
  saida?: string | null;
  origemIcao?: string | null;
  pousos?: string[];
  voltaPara?: string | null;
}): RascunhoVoo {
  return {
    etapa: parcial.etapa,
    aircraftId: parcial.aircraftId,
    trechos: parcial.trechos ?? [],
    data: parcial.data ?? null,
    saida: parcial.saida ?? null,
    origemIcao: parcial.origemIcao ?? null,
    pousos: parcial.pousos ?? [],
    voltaPara: parcial.voltaPara ?? null,
  };
}

function situacao(saldo: number): string {
  if (saldo > 1) return "em aberto";
  if (saldo < -1) return "crédito";
  return "em dia";
}

export function identificarTelefone(numero: string): IdentidadeAgente {
  const alvo = digitosWhatsapp(numero);
  const socio =
    alvo.length >= 12
      ? listPartners().find((item) => item.phone && digitosWhatsapp(item.phone) === alvo)
      : undefined;
  if (!socio) {
    return { papel: "desconhecido", partnerId: null, nome: "", telefone: numero };
  }
  return { papel: "socio", partnerId: socio.id, nome: socio.name, telefone: socio.phone };
}

function saudacao(identidade: IdentidadeAgente, month: string): RespostaAgente {
  if (identidade.papel !== "socio" || !identidade.partnerId) {
    return responder(
      "Não reconheci este WhatsApp no pessoal da Ventura Aviação. A gestão precisa cadastrar o número antes de eu abrir a operação.",
      [],
      null,
    );
  }
  const primeiro = identidade.nome.split(" ")[0] ?? identidade.nome;
  return responder(
    `Olá, ${primeiro}. Aqui é o Agente da Dynamics Aero. Posso mostrar a frota, a agenda de todos os voos, o seu extrato de ${monthLabel(month).toLowerCase()} e agendar um voo quando a aeronave estiver livre.`,
    MENU_SOCIO,
    null,
  );
}

function textoFrota(): string {
  const linhas = listAircraft().map((item) => {
    const situacaoAeronave = STATUS_LABEL[item.status] ?? item.status;
    return `${item.registration} · ${item.model}\n${situacaoAeronave} · ${item.baseName}`;
  });
  return `Frota agora\n\n${linhas.join("\n\n")}`;
}

function porData(left: Itinerary, right: Itinerary): number {
  return (left.legs[0]?.date ?? "").localeCompare(right.legs[0]?.date ?? "");
}

function linhaAgenda(trip: Itinerary, comStatus: boolean): string {
  const craft = getAircraft(trip.aircraftId);
  const periodo = itinerarySpan(trip);
  const quando = periodo
    ? periodo.first === periodo.last
      ? formatDateShort(periodo.first)
      : `${formatDateShort(periodo.first)} a ${formatDateShort(periodo.last)}`
    : "sem data";
  const status = comStatus ? ` · ${STATUS_LABEL[trip.status] ?? trip.status}` : "";
  return `${quando} · ${craft?.registration ?? "Aeronave"} · ${partnerShort(trip.requestedBy)}\n${trip.title} · ${itineraryCities(trip)}${status}`;
}

function blocoAgenda(titulo: string, voos: Itinerary[], vazio: string, comStatus: boolean): string {
  if (voos.length === 0) return `${titulo}\n${vazio}`;
  return `${titulo}\n${voos.map((trip) => linhaAgenda(trip, comStatus)).join("\n\n")}`;
}

function textoAgenda(month: string): string {
  const voos = itinerariesIn(month, "todas").slice().sort(porData);
  if (voos.length === 0) {
    return `Agenda de ${monthLabel(month).toLowerCase()}\n\nNenhum voo nesta competência.`;
  }
  const agendados = voos.filter(
    (trip) => trip.status === "em_voo" || trip.status === "confirmado" || trip.status === "previsto",
  );
  const realizados = voos.filter((trip) => trip.status === "concluido");
  const cancelados = voos.filter((trip) => trip.status === "cancelado");
  const partes = [
    `Agenda de ${monthLabel(month).toLowerCase()}`,
    "Todos os cotistas",
    "",
    blocoAgenda("Agendados", agendados, "Nenhum voo à frente.", true),
    "",
    blocoAgenda("Realizados", realizados, "Nenhum voo concluído.", false),
  ];
  if (cancelados.length > 0) {
    partes.push("", blocoAgenda("Cancelados", cancelados, "", false));
  }
  return partes.join("\n");
}

function textoExtrato(partnerId: string, month: string): string {
  const conta = contaCorrente(partnerId, month, "todas");
  const nome = listPartners().find((item) => item.id === partnerId)?.name ?? "Cotista";
  return [
    `Extrato de ${monthLabel(month).toLowerCase()}`,
    nome,
    "",
    `Débitos: ${formatBRL(conta.debitos)}`,
    `Créditos: ${formatBRL(conta.creditos)}`,
    `Saldo anterior: ${formatBRL(conta.saldoAnterior)}`,
    `Saldo: ${formatBRL(conta.saldo)}`,
    `Situação: ${situacao(conta.saldo)}`,
    "",
    "O saldo positivo é o que ainda falta pagar.",
  ].join("\n");
}

function pedidoDe(texto: string): "frota" | "agenda" | "extrato" | "agendar" | "menu" | null {
  const pedido = normalizar(texto);
  if (["menu", "oi", "ola", "inicio", "0", "voltar", "voltar ao menu"].includes(pedido)) return "menu";
  if (["1", "frota", "status", "aeronave", "aeronaves", "status das aeronaves"].includes(pedido)) {
    return "frota";
  }
  if (["2", "agenda", "voos", "voo", "itinerario", "itinerarios", "agenda de voos"].includes(pedido)) {
    return "agenda";
  }
  if (["3", "extrato", "conta", "saldo", "extrato do mes"].includes(pedido)) {
    return "extrato";
  }
  if (["4", "agendar", "agendar voo", "agendar um voo", "marcar voo", "reservar", "novo voo"].includes(pedido)) {
    return "agendar";
  }
  return null;
}

function querSair(texto: string): boolean {
  const pedido = normalizar(texto);
  return ["menu", "oi", "ola", "inicio", "0", "voltar", "voltar ao menu", "cancelar", "cancelar pedido"].includes(
    pedido,
  );
}

function iniciarAgendamento(partnerId: string): RespostaAgente {
  const aeronaves = aeronavesDoSocio(partnerId);
  if (aeronaves.length === 0) {
    return responder(
      "Você ainda não tem participação em nenhuma aeronave. A frota precisa registrar a cota antes de eu agendar um voo.",
      MENU_SOCIO,
      null,
    );
  }
  const linhas = aeronaves.map((item, index) => `${index + 1}. ${linhaAeronave(item)}`);
  return responder(
    `Qual aeronave?\n\n${linhas.join("\n\n")}\n\nSó entram as aeronaves da sua participação. Eu confiro voos já marcados, revisão e manutenção antes de reservar.`,
    [
      ...aeronaves.map((item) => ({ id: `aeronave-${item.id}`, rotulo: item.registration })),
      { id: "menu", rotulo: "Voltar ao menu" },
    ],
    rascunhoDe({ etapa: "aeronave", aircraftId: null }),
  );
}

function pedirDados(aircraftId: string): RespostaAgente {
  const aircraft = getAircraft(aircraftId);
  const nome = aircraft ? `${aircraft.registration} · ${aircraft.model}` : "Aeronave";
  const base = aircraft ? `, base ${aircraft.baseName}` : "";
  return responder(
    `${nome}${base}.\n\nPara onde e quando?\nExemplo: 25/10 08:00 para Brasília\n\nEu busco de onde a aeronave sai e onde dá para pousar, e confiro a agenda, a revisão e a manutenção.`,
    [{ id: "menu", rotulo: "Voltar ao menu" }],
    rascunhoDe({ etapa: "dados", aircraftId }),
  );
}

function continuarAgendamento(
  identidade: IdentidadeAgente,
  rascunho: RascunhoVoo,
  texto: string,
): RespostaAgente {
  const partnerId = identidade.partnerId;
  if (!partnerId) return saudacao(identidade, "2026-10");
  if (rascunho.etapa === "aeronave") return escolherAeronave(partnerId, texto);
  if (rascunho.etapa === "dados") return receberDestino(partnerId, rascunho, texto);
  if (rascunho.etapa === "pouso") return escolherPouso(partnerId, rascunho, texto);
  if (rascunho.etapa === "volta") return receberVolta(partnerId, rascunho, texto);
  return confirmar(identidade, rascunho, texto);
}

function escolherAeronave(partnerId: string, texto: string): RespostaAgente {
  const aeronaves = aeronavesDoSocio(partnerId);
  const pedido = normalizar(texto);
  const indice = Number(pedido);
  const porNumero =
    Number.isInteger(indice) && indice >= 1 && indice <= aeronaves.length ? aeronaves[indice - 1] : undefined;
  const porMatricula = aeronaves.find((item) => {
    const matricula = normalizar(item.registration);
    return matricula === pedido || matricula.replace("-", "") === pedido.replace("-", "");
  });
  const escolhida = porNumero ?? porMatricula;
  if (!escolhida) {
    return responder(
      "Escolha uma das aeronaves da sua participação, pela matrícula.",
      [
        ...aeronaves.map((item) => ({ id: `aeronave-${item.id}`, rotulo: item.registration })),
        { id: "menu", rotulo: "Voltar ao menu" },
      ],
      rascunhoDe({ etapa: "aeronave", aircraftId: null }),
    );
  }
  return pedirDados(escolhida.id);
}

function receberDestino(partnerId: string, rascunho: RascunhoVoo, texto: string): RespostaAgente {
  const aircraftId = rascunho.aircraftId;
  if (!aircraftId) return iniciarAgendamento(partnerId);
  const lido = lerQuandoOnde(texto);
  if ("erro" in lido) {
    return responder(lido.erro, [{ id: "menu", rotulo: "Voltar ao menu" }], rascunho);
  }
  const origem = posicaoNoHorario(aircraftId, lido.date, lido.depart);
  if (!origem) return responder("Não encontrei essa aeronave.", MENU_SOCIO, null);
  const pousos = buscarPousos(lido.destino).filter((icao) => icao !== origem);
  if (pousos.length === 0) {
    return responder(
      `Não encontrei pouso para ${lido.destino}. Pode ser Brasília, Rio, São Paulo, Belo Horizonte, Curitiba, Florianópolis, Vitória, Fortaleza, Cuiabá ou Campinas.`,
      [{ id: "menu", rotulo: "Voltar ao menu" }],
      rascunho,
    );
  }
  if (pousos.length > 1) {
    const opcoes = pousos.map((icao) => ({ id: `pouso-${icao}`, rotulo: nomePouso(icao) }));
    return responder(
      `Partida disponível: ${nomePouso(origem)}.\n\nPara esse destino há estes pousos:\n${opcoes.map((item) => item.rotulo).join("\n")}\n\nQual você prefere?`,
      [...opcoes, { id: "menu", rotulo: "Voltar ao menu" }],
      rascunhoDe({
        etapa: "pouso",
        aircraftId,
        data: lido.date,
        saida: lido.depart,
        origemIcao: origem,
        pousos,
      }),
    );
  }
  const destino = pousos[0];
  if (!destino) return responder("Não encontrei o pouso.", [{ id: "menu", rotulo: "Voltar ao menu" }], rascunho);
  return fecharTrecho(partnerId, aircraftId, lido.date, lido.depart, origem, destino, []);
}

function escolherPouso(partnerId: string, rascunho: RascunhoVoo, texto: string): RespostaAgente {
  const aircraftId = rascunho.aircraftId;
  const origem = rascunho.origemIcao;
  const data = rascunho.data;
  const saida = rascunho.saida;
  if (!aircraftId || !origem || !data || !saida) return iniciarAgendamento(partnerId);
  const pedido = normalizar(texto);
  const indice = Number(pedido);
  const porNumero =
    Number.isInteger(indice) && indice >= 1 && indice <= rascunho.pousos.length
      ? rascunho.pousos[indice - 1]
      : undefined;
  const porNome = rascunho.pousos.find((icao) => normalizar(nomePouso(icao)) === pedido);
  const destino = porNumero ?? porNome;
  if (!destino) {
    return responder(
      "Escolha um dos pousos disponíveis.",
      [
        ...rascunho.pousos.map((icao) => ({ id: `pouso-${icao}`, rotulo: nomePouso(icao) })),
        { id: "menu", rotulo: "Voltar ao menu" },
      ],
      rascunho,
    );
  }
  return fecharTrecho(partnerId, aircraftId, data, saida, origem, destino, []);
}

function receberVolta(partnerId: string, rascunho: RascunhoVoo, texto: string): RespostaAgente {
  const aircraftId = rascunho.aircraftId;
  const ida = rascunho.trechos[0];
  const voltaPara = rascunho.voltaPara;
  if (!aircraftId || !ida || !voltaPara) return iniciarAgendamento(partnerId);
  const lido = lerHorarioVolta(texto, ida.date);
  if ("erro" in lido) {
    return responder(lido.erro, [{ id: "menu", rotulo: "Voltar ao menu" }], rascunho);
  }
  return fecharTrecho(partnerId, aircraftId, lido.date, lido.depart, ida.toIcao, voltaPara, [ida]);
}

function fecharTrecho(
  partnerId: string,
  aircraftId: string,
  date: string,
  depart: string,
  fromIcao: string,
  toIcao: string,
  anteriores: TrechoPedido[],
): RespostaAgente {
  const montado = montarTrecho(date, depart, fromIcao, toIcao);
  if ("erro" in montado) {
    return responder(
      montado.erro,
      [{ id: "menu", rotulo: "Voltar ao menu" }],
      rascunhoDe({ etapa: "dados", aircraftId }),
    );
  }
  const trechos = [...anteriores, montado];
  const resultado = avaliarTrechos(aircraftId, trechos);
  const ida = trechos[0] ?? montado;
  const resumo = `Partida: ${nomePouso(ida.fromIcao)}.\nPouso: ${nomePouso(montado.toIcao)}.`;
  if (!resultado.livre) {
    if (resultado.sugerirVolta) {
      return responder(
        `${resumo}\n\n${resultado.texto}`,
        [{ id: "menu", rotulo: "Voltar ao menu" }],
        rascunhoDe({
          etapa: "volta",
          aircraftId,
          trechos,
          voltaPara: resultado.voltaPara ?? null,
        }),
      );
    }
    return responder(resultado.texto, [{ id: "menu", rotulo: "Voltar ao menu" }], rascunhoDe({
      etapa: "dados",
      aircraftId,
    }));
  }
  return proporConfirmacao(partnerId, aircraftId, trechos, resultado.avisos);
}

function proporConfirmacao(
  partnerId: string,
  aircraftId: string,
  trechos: TrechoPedido[],
  avisos: string[],
): RespostaAgente {
  const aircraft = getAircraft(aircraftId);
  const socio = listPartners().find((item) => item.id === partnerId);
  const linhas = trechos.map((trecho) => {
    const origem = AERODROMOS[trecho.fromIcao] ?? trecho.fromIcao;
    const destino = AERODROMOS[trecho.toIcao] ?? trecho.toIcao;
    return `${formatDateShort(trecho.date)} · ${trecho.depart}–${trecho.arrive}\n${origem} → ${destino}`;
  });
  const notas = avisos.length > 0 ? ["", ...avisos] : [];
  return responder(
    [
      "Posso reservar como previsto:",
      "",
      `${aircraft?.registration ?? "Aeronave"} · ${aircraft?.model ?? ""}`,
      ...linhas,
      `Pedido de ${socio?.name ?? "cotista"}`,
      "Finalidade: negócios.",
      "A chegada é uma estimativa da operação.",
      ...notas,
      "",
      "Confirme para eu lançar na agenda. Os custos do trecho ficam para a operação completar.",
    ].join("\n"),
    [
      { id: "confirmar", rotulo: "Confirmar agendamento" },
      { id: "cancelar", rotulo: "Cancelar pedido" },
    ],
    rascunhoDe({ etapa: "confirmar", aircraftId, trechos }),
  );
}

function confirmar(identidade: IdentidadeAgente, rascunho: RascunhoVoo, texto: string): RespostaAgente {
  const pedido = normalizar(texto);
  const partnerId = identidade.partnerId;
  const aircraftId = rascunho.aircraftId;
  if (!partnerId || !aircraftId) return saudacao(identidade, "2026-10");
  if (!["confirmar", "confirmar agendamento", "sim"].includes(pedido)) {
    return responder(
      "Confirme o agendamento ou cancele o pedido.",
      [
        { id: "confirmar", rotulo: "Confirmar agendamento" },
        { id: "cancelar", rotulo: "Cancelar pedido" },
      ],
      rascunho,
    );
  }
  const resultado = avaliarTrechos(aircraftId, rascunho.trechos);
  if (!resultado.livre) {
    return responder(`${resultado.texto}\n\nNão lancei o voo.`, [{ id: "menu", rotulo: "Voltar ao menu" }], rascunhoDe({
      etapa: "dados",
      aircraftId,
    }));
  }
  const itinerario = montarItinerario(partnerId, identidade.nome, aircraftId, rascunho.trechos);
  salvarItinerario(itinerario);
  const aircraft = getAircraft(aircraftId);
  const linhas = rascunho.trechos.map((trecho) => {
    const origem = AERODROMOS[trecho.fromIcao] ?? trecho.fromIcao;
    const destino = AERODROMOS[trecho.toIcao] ?? trecho.toIcao;
    return `${formatDateShort(trecho.date)} · ${trecho.depart}–${trecho.arrive} · ${origem} → ${destino}`;
  });
  return responder(
    ["Voo previsto na agenda.", "", `${aircraft?.registration ?? "Aeronave"}`, ...linhas, `Pedido de ${identidade.nome}.`].join(
      "\n",
    ),
    MENU_SOCIO,
    null,
  );
}

function montarItinerario(
  partnerId: string,
  nome: string,
  aircraftId: string,
  trechos: TrechoPedido[],
): Itinerary {
  const crew = listCrew().filter((person) => person.aircraftIds.includes(aircraftId));
  const commander = crew.find((person) => person.role === "comandante") ?? crew[0];
  const copilot = crew.find((person) => person.role === "copiloto");
  const legs: Leg[] = trechos.map((trecho) => {
    const saida = minutos(trecho.depart);
    const chegada = minutos(trecho.arrive);
    return {
      id: criarId("perna"),
      date: trecho.date,
      depart: trecho.depart,
      arrive: trecho.arrive,
      fromIcao: trecho.fromIcao,
      toIcao: trecho.toIcao,
      fromCity: AERODROMOS[trecho.fromIcao] ?? trecho.fromIcao,
      toCity: AERODROMOS[trecho.toIcao] ?? trecho.toIcao,
      blockHours: Math.round(((chegada - saida) / 60) * 10) / 10,
      fuel: 0,
      fees: 0,
      handling: 0,
      catering: 0,
      commanderId: commander?.id ?? "sem-tripulacao",
      copilotId: copilot?.id,
      posting: "previsto",
    };
  });
  const primeiro = trechos[0];
  const ultimo = trechos[trechos.length - 1];
  const origem = primeiro ? (AERODROMOS[primeiro.fromIcao] ?? primeiro.fromIcao) : "Voo";
  const destinoIda = primeiro ? (AERODROMOS[primeiro.toIcao] ?? primeiro.toIcao) : "";
  const destinoFim = ultimo ? (AERODROMOS[ultimo.toIcao] ?? ultimo.toIcao) : "";
  const titulo =
    primeiro && ultimo && trechos.length > 1 && primeiro.fromIcao === ultimo.toIcao
      ? `${origem} ↔ ${destinoIda}`
      : `${origem} → ${destinoFim}`;
  return {
    id: criarId("voo"),
    aircraftId,
    title: titulo,
    purpose: "negocios",
    requestedBy: partnerId,
    passengers: [nome],
    status: "previsto",
    note: "Pedido pelo Agente da Dynamics Aero. Custos do trecho ainda não lançados.",
    legs,
  };
}

function minutos(hora: string): number {
  const [hour, minute] = hora.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

export function abrirConversa(identidade: IdentidadeAgente, month: string): RespostaAgente {
  return saudacao(identidade, month);
}

export function responderAgente(
  identidade: IdentidadeAgente,
  month: string,
  texto: string,
  rascunho: RascunhoVoo | null = null,
): RespostaAgente {
  if (identidade.papel !== "socio" || !identidade.partnerId) {
    return saudacao(identidade, month);
  }
  if (rascunho && querSair(texto)) return saudacao(identidade, month);
  if (rascunho) return continuarAgendamento(identidade, rascunho, texto);
  const pedido = pedidoDe(texto);
  if (pedido === "menu") return saudacao(identidade, month);
  if (pedido === null) {
    return responder(
      "Não entendi. Escolha o status das aeronaves, a agenda de voos, o extrato do mês ou agendar um voo.",
      MENU_SOCIO,
      null,
    );
  }
  if (pedido === "agendar") return iniciarAgendamento(identidade.partnerId);
  const corpo =
    pedido === "frota"
      ? textoFrota()
      : pedido === "agenda"
        ? textoAgenda(month)
        : textoExtrato(identidade.partnerId, month);
  return responder(corpo, MENU_SOCIO, null);
}
