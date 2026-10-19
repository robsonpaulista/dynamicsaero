import { AERODROMOS, HOJE } from "@/data/calendario";
import { formatDate, formatDateShort } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/labels";
import {
  getAircraft,
  listAircraft,
  listItinerarySource,
  listMaintenance,
  partnerShort,
} from "@/services/operacao";
import type { Aircraft, MaintenanceItem } from "@/types/operacao";

export type TrechoPedido = {
  date: string;
  depart: string;
  arrive: string;
  fromIcao: string;
  toIcao: string;
};

export type ResultadoDisponibilidade =
  | { livre: true; avisos: string[] }
  | { livre: false; texto: string; sugerirVolta: boolean; voltaPara?: string };

export type QuandoOnde = {
  date: string;
  depart: string;
  destino: string;
};

type Marco = {
  inicio: number;
  fim: number;
  fromIcao: string;
  toIcao: string;
  date: string;
  depart: string;
  arrive: string;
  titulo: string;
  quem: string;
};

const EXEMPLO = "25/10 08:00 para Brasília";

const DESTINOS: { nomes: string[]; icaos: string[] }[] = [
  { nomes: ["sao paulo", "sampa"], icaos: ["SBGR", "SBSP", "SBKP", "SBMT"] },
  { nomes: ["rio", "rio de janeiro"], icaos: ["SBRJ"] },
  { nomes: ["belo horizonte", "bh", "minas"], icaos: ["SBCF"] },
  { nomes: ["florianopolis", "floripa"], icaos: ["SBFL"] },
  { nomes: ["brasilia", "bsb"], icaos: ["SBBR"] },
  { nomes: ["curitiba"], icaos: ["SBCT"] },
  { nomes: ["jundiai"], icaos: ["SBJD"] },
  { nomes: ["campo de marte", "marte"], icaos: ["SBMT"] },
  { nomes: ["viracopos", "campinas"], icaos: ["SBKP"] },
  { nomes: ["congonhas"], icaos: ["SBSP"] },
  { nomes: ["guarulhos", "cumbica"], icaos: ["SBGR"] },
  { nomes: ["confins"], icaos: ["SBCF"] },
  { nomes: ["santos dumont"], icaos: ["SBRJ"] },
  { nomes: ["vitoria"], icaos: ["SBVT"] },
  { nomes: ["fortaleza"], icaos: ["SBFZ"] },
  { nomes: ["cuiaba"], icaos: ["SBCY"] },
];

export function aeronavesDoSocio(partnerId: string): Aircraft[] {
  return listAircraft().filter((item) =>
    item.ownership.some((owner) => owner.partnerId === partnerId && owner.share > 0),
  );
}

export function linhaAeronave(aircraft: Aircraft): string {
  const situacao = STATUS_LABEL[aircraft.status] ?? aircraft.status;
  const retencao = manutencoes(aircraft.id).find((item) => item.grounding);
  if (retencao?.dueAt) {
    return `${aircraft.registration} · ${aircraft.model}\n${situacao} até ${formatDateShort(retencao.dueAt)}`;
  }
  if (retencao) {
    return `${aircraft.registration} · ${aircraft.model}\n${situacao}, sem data de liberação`;
  }
  const revisao = manutencoes(aircraft.id).find((item) => item.status === "proxima" && item.dueAt);
  if (revisao?.dueAt) {
    return `${aircraft.registration} · ${aircraft.model}\n${situacao} · revisão em ${formatDateShort(revisao.dueAt)}`;
  }
  return `${aircraft.registration} · ${aircraft.model}\n${situacao} · ${aircraft.baseName}`;
}

export function nomePouso(icao: string): string {
  return cidade(icao);
}

export function lerQuandoOnde(linha: string): QuandoOnde | { erro: string } {
  const limpo = semAcento(linha).replace(/\s+/g, " ");
  const match =
    /^(\d{1,2}\/\d{1,2}(?:\/\d{4})?|\d{4}-\d{2}-\d{2})\s+(?:as\s+)?(\d{1,2}(?::\d{2})?|\d{1,2}h\d{0,2})\s+(?:para\s+|pra\s+|ate\s+)?(.+)$/.exec(
      limpo,
    );
  if (!match) {
    return { erro: `Diga o dia, o horário e para onde quer ir. Exemplo: ${EXEMPLO}.` };
  }
  const date = dataIso(match[1] ?? "");
  const depart = horaFlex(match[2] ?? "");
  const destino = (match[3] ?? "").trim();
  if (!date || !depart || !destino) {
    return { erro: `Diga o dia, o horário e para onde quer ir. Exemplo: ${EXEMPLO}.` };
  }
  if (date < HOJE) {
    return { erro: `Esse dia já passou. A operação está em ${formatDate(HOJE)}. Escolha esse dia ou um seguinte.` };
  }
  return { date, depart, destino };
}

export function lerHorarioVolta(linha: string, dataIda: string): { date: string; depart: string } | { erro: string } {
  const limpo = semAcento(linha).replace(/\s+/g, " ");
  const completo =
    /^(\d{1,2}\/\d{1,2}(?:\/\d{4})?|\d{4}-\d{2}-\d{2})\s+(?:as\s+)?(\d{1,2}(?::\d{2})?|\d{1,2}h\d{0,2})$/.exec(limpo);
  if (completo) {
    const date = dataIso(completo[1] ?? "");
    const depart = horaFlex(completo[2] ?? "");
    if (!date || !depart) return { erro: "Diga o horário da volta, por exemplo 16:00." };
    if (date < dataIda) return { erro: "A volta precisa ser no mesmo dia da ida ou depois." };
    return { date, depart };
  }
  const soHora = /^(?:as\s+)?(\d{1,2}(?::\d{2})?|\d{1,2}h\d{0,2})$/.exec(limpo);
  if (soHora) {
    const depart = horaFlex(soHora[1] ?? "");
    if (!depart) return { erro: "Diga o horário da volta, por exemplo 16:00." };
    return { date: dataIda, depart };
  }
  return { erro: "Diga o horário da volta, por exemplo 16:00." };
}

export function buscarPousos(consulta: string): string[] {
  const pedido = semAcento(consulta);
  const exatos = DESTINOS.filter((item) => item.nomes.some((nome) => nome === pedido));
  const escolhidos = exatos.length > 0 ? exatos : DESTINOS.filter((item) =>
    item.nomes.some((nome) => nome.length >= 4 && (pedido.includes(nome) || nome.includes(pedido))),
  );
  return [...new Set(escolhidos.flatMap((item) => item.icaos))];
}

export function posicaoNoHorario(aircraftId: string, date: string, horaPartida: string): string | null {
  const aircraft = getAircraft(aircraftId);
  if (!aircraft) return null;
  return localAntes(marcosExistentes(aircraftId), aircraft, absoluto(date, minutos(horaPartida)));
}

export function montarTrecho(
  date: string,
  depart: string,
  fromIcao: string,
  toIcao: string,
): TrechoPedido | { erro: string } {
  if (fromIcao === toIcao) {
    return { erro: `Nesse horário a aeronave já está em ${cidade(fromIcao)}. Escolha outro destino.` };
  }
  const arrive = somarMinutos(depart, duracaoEntre(fromIcao, toIcao));
  if (!arrive) {
    return { erro: "Esse trecho não cabe no mesmo dia. Escolha uma saída mais cedo." };
  }
  return { date, depart, arrive, fromIcao, toIcao };
}

export function lerTrecho(linha: string): TrechoPedido | { erro: string } {
  const match =
    /^(\d{1,2}\/\d{1,2}(?:\/\d{4})?|\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s+([A-Za-z]{4})\s+([A-Za-z]{4})$/.exec(
      linha.trim(),
    );
  if (!match) {
    return { erro: `Não consegui ler o trecho. Use o formato ${EXEMPLO}.` };
  }
  const date = dataIso(match[1] ?? "");
  const depart = hora(match[2] ?? "");
  const arrive = hora(match[3] ?? "");
  const fromIcao = (match[4] ?? "").toUpperCase();
  const toIcao = (match[5] ?? "").toUpperCase();
  if (!date || !depart || !arrive) {
    return { erro: `Não consegui ler o trecho. Use o formato ${EXEMPLO}.` };
  }
  if (date < HOJE) {
    return { erro: `Esse dia já passou. A operação está em ${formatDate(HOJE)}. Escolha esse dia ou um seguinte.` };
  }
  if (minutos(arrive) <= minutos(depart)) {
    return { erro: "A chegada precisa ser depois da saída, no mesmo dia." };
  }
  if (fromIcao === toIcao) {
    return { erro: "Origem e destino precisam ser aeródromos diferentes." };
  }
  const desconhecido = [fromIcao, toIcao].filter((icao) => !AERODROMOS[icao]);
  if (desconhecido.length > 0) {
    const conhecidos = Object.keys(AERODROMOS).join(", ");
    return {
      erro: `Não conheço ${desconhecido.join(" e ")}. Use um código da operação: ${conhecidos}.`,
    };
  }
  return { date, depart, arrive, fromIcao, toIcao };
}

export function avaliarTrechos(aircraftId: string, trechos: TrechoPedido[]): ResultadoDisponibilidade {
  const aircraft = getAircraft(aircraftId);
  if (!aircraft) return { livre: false, texto: "Não encontrei essa aeronave.", sugerirVolta: false };
  const novos = trechos
    .map((trecho) => marcoDe(trecho, "Pedido", ""))
    .sort((left, right) => left.inicio - right.inicio);
  const existentes = marcosExistentes(aircraftId);

  for (const trecho of trechos) {
    const bloqueio = bloqueioManutencao(aircraft, trecho.date);
    if (bloqueio) return { livre: false, texto: bloqueio, sugerirVolta: false };
  }

  for (const novo of novos) {
    const cruzado = existentes.find((item) => cruza(novo, item));
    if (cruzado) {
      return {
        livre: false,
        sugerirVolta: false,
        texto: [
          `${aircraft.registration} não está livre nesse horário.`,
          "",
          `${formatDateShort(cruzado.date)} · ${cruzado.depart}–${cruzado.arrive} · ${cruzado.titulo} · ${cruzado.quem}`,
          "Esse voo já ocupa a aeronave.",
          "",
          `Mande outro dia e horário. Exemplo: ${EXEMPLO}.`,
        ].join("\n"),
      };
    }
  }

  for (let index = 1; index < novos.length; index += 1) {
    const anterior = novos[index - 1];
    const atual = novos[index];
    if (!anterior || !atual) continue;
    if (cruza(anterior, atual)) {
      return {
        livre: false,
        sugerirVolta: false,
        texto: "Os trechos do pedido se cruzam. A volta precisa começar depois da chegada da ida.",
      };
    }
  }

  const primeiro = novos[0];
  if (!primeiro) return { livre: false, texto: "Faltou o trecho.", sugerirVolta: false };
  const local = localAntes(existentes, aircraft, primeiro.inicio);
  if (primeiro.fromIcao !== local) {
    return {
      livre: false,
      sugerirVolta: false,
      texto: `Nesse horário o ${aircraft.registration} está em ${cidade(local)}, não em ${cidade(primeiro.fromIcao)}.`,
    };
  }

  for (let index = 1; index < novos.length; index += 1) {
    const anterior = novos[index - 1];
    const atual = novos[index];
    if (!anterior || !atual) continue;
    if (atual.fromIcao !== anterior.toIcao) {
      return {
        livre: false,
        sugerirVolta: false,
        texto: `A volta precisa sair de ${cidade(anterior.toIcao)}.`,
      };
    }
    const noMeio = existentes.find((item) => item.inicio >= anterior.fim && item.inicio < atual.inicio);
    if (noMeio) {
      return {
        livre: false,
        sugerirVolta: false,
        texto: `Entre a ida e a volta já existe ${noMeio.titulo} em ${formatDateShort(noMeio.date)}, saindo de ${cidade(noMeio.fromIcao)}. A volta precisa acontecer antes, com a aeronave de volta nesse aeródromo.`,
      };
    }
  }

  const ultimo = novos[novos.length - 1];
  if (!ultimo) return { livre: false, texto: "Faltou o trecho.", sugerirVolta: false };
  const seguinte = existentes.find((item) => item.inicio >= ultimo.fim);
  if (seguinte && seguinte.fromIcao !== ultimo.toIcao) {
    const texto = [
      `Esse pedido deixa o ${aircraft.registration} em ${cidade(ultimo.toIcao)}.`,
      `O próximo voo sai de ${cidade(seguinte.fromIcao)} em ${formatDateShort(seguinte.date)} às ${seguinte.depart} · ${seguinte.titulo}.`,
      trechos.length === 1
        ? `A que horas você quer voltar para ${cidade(seguinte.fromIcao)}? Pode ser só o horário, como 16:00.`
        : "Ajuste a volta para a aeronave chegar a tempo nesse aeródromo.",
    ].join("\n");
    return { livre: false, texto, sugerirVolta: trechos.length === 1, voltaPara: seguinte.fromIcao };
  }

  return { livre: true, avisos: avisos(aircraft.id, trechos) };
}

function manutencoes(aircraftId: string): MaintenanceItem[] {
  return listMaintenance().filter(
    (item) => item.aircraftId === aircraftId && item.status !== "concluida" && item.status !== "em_dia",
  );
}

function bloqueioManutencao(aircraft: Aircraft, date: string): string | null {
  for (const item of manutencoes(aircraft.id)) {
    if (item.grounding && cobre(item.openedAt, item.dueAt, date)) {
      const ate = item.dueAt ? ` até ${formatDateShort(item.dueAt)}` : ", sem data de liberação";
      return [
        `${aircraft.registration} não pode voar em ${formatDateShort(date)}.`,
        "",
        `${item.title} retém a aeronave${ate}.`,
        "Escolha um dia depois da liberação.",
      ].join("\n");
    }
    if (item.status === "proxima" && item.dueAt === date) {
      return [
        `${aircraft.registration} não pode voar em ${formatDateShort(date)}.`,
        "",
        `${item.title} ocupa esse dia. ${item.dueLabel}.`,
        "Escolha outro dia.",
      ].join("\n");
    }
  }
  if (aircraft.status === "manutencao" && date <= HOJE && !manutencoes(aircraft.id).some((item) => item.grounding)) {
    return `${aircraft.registration} está em manutenção e ainda não tem data de liberação.`;
  }
  return null;
}

function avisos(aircraftId: string, trechos: TrechoPedido[]): string[] {
  const notas: string[] = [];
  for (const item of manutencoes(aircraftId)) {
    if (item.grounding || item.status === "proxima") continue;
    const cobreAlgum = trechos.some((trecho) => cobre(item.openedAt, item.dueAt, trecho.date));
    if (cobreAlgum) {
      notas.push(`${item.title} segue em execução, com o voo liberado.`);
    }
  }
  for (const item of manutencoes(aircraftId)) {
    if (item.status === "proxima" && item.dueAt === null && item.remainingHours !== null) {
      notas.push(`${item.title} está a ${item.remainingHours} h de célula. Não trava este horário.`);
    }
  }
  return notas;
}

function cobre(inicio: string, fim: string | null, date: string): boolean {
  if (date < inicio) return false;
  if (!fim) return true;
  return date <= fim;
}

function marcosExistentes(aircraftId: string): Marco[] {
  const lista: Marco[] = [];
  for (const trip of listItinerarySource()) {
    if (trip.aircraftId !== aircraftId || trip.status === "cancelado") continue;
    for (const leg of trip.legs) {
      const trecho = marcoDe(
        {
          date: leg.date,
          depart: leg.depart,
          arrive: leg.arrive,
          fromIcao: leg.fromIcao,
          toIcao: leg.toIcao,
        },
        trip.title,
        partnerShort(trip.requestedBy),
      );
      if (trecho) lista.push(trecho);
    }
  }
  return lista.sort((left, right) => left.inicio - right.inicio);
}

function marcoDe(
  trecho: TrechoPedido,
  titulo: string,
  quem: string,
): Marco {
  const saida = minutos(trecho.depart);
  const chegada = minutos(trecho.arrive);
  const inicio = absoluto(trecho.date, saida);
  const fim = chegada > saida ? absoluto(trecho.date, chegada) : absoluto(trecho.date, chegada) + 1440;
  return {
    inicio,
    fim,
    fromIcao: trecho.fromIcao,
    toIcao: trecho.toIcao,
    date: trecho.date,
    depart: trecho.depart,
    arrive: trecho.arrive,
    titulo,
    quem,
  };
}

function localAntes(existentes: Marco[], aircraft: Aircraft, inicio: number): string {
  const anterior = [...existentes].reverse().find((item) => item.fim <= inicio);
  return anterior?.toIcao ?? aircraft.baseIcao;
}

function cruza(left: Marco, right: Marco): boolean {
  return left.inicio < right.fim && right.inicio < left.fim;
}

function absoluto(date: string, minutes: number): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1) / 60000 + minutes;
}

function minutos(hora: string): number {
  const [hour, minute] = hora.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function duracaoEntre(fromIcao: string, toIcao: string): number {
  const horas: number[] = [];
  for (const trip of listItinerarySource()) {
    if (trip.status === "cancelado") continue;
    for (const leg of trip.legs) {
      const mesmoSentido = leg.fromIcao === fromIcao && leg.toIcao === toIcao;
      const inverso = leg.fromIcao === toIcao && leg.toIcao === fromIcao;
      if ((mesmoSentido || inverso) && leg.blockHours > 0) horas.push(leg.blockHours);
    }
  }
  const media = horas.length > 0 ? (horas.reduce((soma, item) => soma + item, 0) / horas.length) * 60 : 90;
  return Math.max(30, Math.round(media / 15) * 15);
}

function somarMinutos(depart: string, acrescimo: number): string | null {
  const total = minutos(depart) + acrescimo;
  if (total >= 24 * 60) return null;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function horaFlex(valor: string): string | null {
  const relogio = /^(\d{1,2}):(\d{2})$/.exec(valor);
  if (relogio) return hora(`${relogio[1]}:${relogio[2]}`);
  const comH = /^(\d{1,2})h(\d{2})?$/.exec(valor);
  if (comH) return hora(`${comH[1]}:${comH[2] ?? "00"}`);
  const cheia = /^(\d{1,2})$/.exec(valor);
  if (cheia) return hora(`${cheia[1]}:00`);
  return null;
}

function semAcento(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function hora(valor: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(valor);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function dataIso(token: string): string | null {
  const brasil = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(token);
  if (brasil) {
    const dia = (brasil[1] ?? "").padStart(2, "0");
    const mes = (brasil[2] ?? "").padStart(2, "0");
    const ano = brasil[3] ?? HOJE.slice(0, 4);
    const iso = `${ano}-${mes}-${dia}`;
    return dataValida(iso) ? iso : null;
  }
  return dataValida(token) ? token : null;
}

function dataValida(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function cidade(icao: string): string {
  return AERODROMOS[icao] ?? icao;
}
