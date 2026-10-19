"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronDown, Clock3, Gauge, PieChart, Route, Users, type LucideIcon } from "lucide-react";
import { MarcaAeronave } from "@/components/painel/marca-aeronave";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import { PageStack, StatusBadge } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { formatBRL, formatHours, formatMil, cn, formatDateShort } from "@/lib/format";
import { CATEGORY_LABEL, STATUS_CLASS, categoryBarColor, corDoSocio } from "@/lib/labels";
import {
  custosPorCategoria,
  getAlertas,
  getKpis,
  getRateio,
  itineraryCities,
  itinerarySpan,
  itinerariesIn,
  monthShort,
  partnerShort,
  posicaoDoPainel,
  sortAgenda,
  tripHours,
  HOJE,
  VIEWER_ID,
} from "@/services/operacao";
import type { Alerta } from "@/types/operacao";

const TONE_BAR: Record<string, string> = {
  critico: "bg-[#EF4444]",
  atencao: "bg-[#38BDF8]",
  info: "bg-tse-olive",
};

export function PainelView() {
  useDados();
  const { aircraftId, month } = useOperacao();
  const [abertos, setAbertos] = useState<string[]>([]);
  const [maisDecisoes, setMaisDecisoes] = useState<boolean>(false);

  const posicao = posicaoDoPainel(month, aircraftId);
  const kpis = getKpis(month, aircraftId);
  const rateio = getRateio(month, aircraftId);
  const categorias = custosPorCategoria(month, aircraftId);
  const maiorCategoria = categorias[0]?.amount ?? 1;
  const alertas = getAlertas(month, aircraftId);
  const criticos = alertas.filter((item) => item.tone === "critico");
  const demais = alertas.filter((item) => item.tone !== "critico");
  const eu = rateio.partners.find((item) => item.partnerId === VIEWER_ID);
  const saldoOutros = rateio.partners
    .filter((item) => item.partnerId !== VIEWER_ID)
    .reduce((soma, item) => soma + Math.max(0, item.saldo), 0);

  const voos = itinerariesIn(month, aircraftId).filter((trip) => trip.status !== "cancelado");
  const agenda = sortAgenda(voos);
  const seguinte = agenda.find(
    (trip) =>
      trip.status !== "concluido" &&
      trip.status !== "em_voo" &&
      (trip.legs[0]?.date ?? "") >= HOJE,
  );
  const noAr = agenda.find((trip) => trip.status === "em_voo");
  const pernaSeguinte = seguinte?.legs[0];
  const resumoAgenda = pernaSeguinte
    ? `${voos.length} ${voos.length === 1 ? "voo" : "voos"} · próximo ${pernaSeguinte.toCity} dia ${Number(pernaSeguinte.date.slice(8, 10))}`
    : noAr
      ? `${voos.length} ${voos.length === 1 ? "voo" : "voos"} · ${noAr.title} no ar`
      : `${voos.length} ${voos.length === 1 ? "voo" : "voos"} no mês`;

  const resumoHoras = kpis.variacaoHoras
    ? `${formatHours(kpis.horasVoadas)} · ${kpis.variacaoHoras}`
    : formatHours(kpis.horasVoadas);

  const tresMaiores = categorias
    .slice(0, 3)
    .map((item, index) => {
      const nome = CATEGORY_LABEL[item.category];
      return index === 0 ? nome : nome.toLocaleLowerCase("pt-BR");
    });
  const resumoCusto =
    tresMaiores.length === 0
      ? "Sem custo neste mês"
      : tresMaiores.length === 1
        ? tresMaiores[0]
        : `${tresMaiores.slice(0, -1).join(", ")} e ${tresMaiores[tresMaiores.length - 1]}`;

  const resumoRateio = rateio.partners
    .filter((item) => item.partnerId !== VIEWER_ID)
    .map((item) =>
      item.saldo <= 1
        ? `${partnerShort(item.partnerId)} em dia`
        : `${partnerShort(item.partnerId)} ${formatMil(item.saldo)}`,
    )
    .join(" · ");

  function alternar(id: string) {
    setAbertos((atual) =>
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id],
    );
  }

  return (
    <PageStack>
      <FiltrosOperacao />

      <section className="rounded-2xl bg-white px-5 py-5 shadow-sm">
        <p className="max-w-4xl text-[18px] leading-7 font-medium text-tse-text sm:text-[20px] sm:leading-8">
          {posicao.frase}
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <ul className="divide-y divide-[#EEEEEE]">
          {posicao.faixas.map((faixa) => (
            <li key={faixa.id}>
              <Link
                href={`/frota/${faixa.id}`}
                className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5"
              >
                <MarcaAeronave
                  category={faixa.category}
                  tom={
                    faixa.retida || faixa.status === "manutencao"
                      ? "retida"
                      : faixa.status === "em_voo"
                        ? "em_voo"
                        : "disponivel"
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-[16px] tracking-wide">
                      {faixa.registration}
                    </span>
                    {faixa.retida ? (
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase",
                          STATUS_CLASS.manutencao,
                        )}
                      >
                        Retida
                      </span>
                    ) : (
                      <StatusBadge value={faixa.status} />
                    )}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-tse-muted">{faixa.model}</span>
                </span>
                <span className="max-w-[48%] text-right text-[14px] leading-5 font-semibold">
                  {faixa.fato}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <Numero
          href="/despesas"
          label="Custo do mês"
          value={formatMil(kpis.custoComprometido)}
          hint="Tudo que o mês compromete"
        />
        <Numero
          href="/rateio"
          label="Seu saldo"
          value={eu && eu.saldo > 1 ? formatMil(eu.saldo) : "Em dia"}
          hint={eu && eu.saldo > 1 ? "O que ainda cabe a você" : "Nada em aberto"}
        />
        <Numero
          href="/rateio"
          label="Sócios em aberto"
          value={saldoOutros > 1 ? formatMil(saldoOutros) : "Em dia"}
          hint={saldoOutros > 1 ? "O que os outros ainda devem" : "Ninguém deve"}
        />
      </div>

      <section className="rounded-2xl bg-white px-5 py-4 shadow-sm">
        <h2 className="text-[15px] font-bold">
          {criticos.length === 0
            ? "Nenhuma decisão pendente"
            : criticos.length === 1
              ? "Uma decisão pendente"
              : `${criticos.length} decisões pendentes`}
        </h2>
        <p className="mt-1 text-[13px] leading-5 text-tse-muted">
          {criticos.length === 0
            ? "A operação segue sem nada que dependa de você."
            : "Isto trava ou muda a frota. O restante são avisos."}
        </p>
        {criticos.length > 0 || maisDecisoes ? (
          <ul className="mt-3 space-y-3">
            {(maisDecisoes ? alertas : criticos).map((alerta) => (
              <Decisao key={alerta.id} alerta={alerta} />
            ))}
          </ul>
        ) : null}
        {demais.length > 0 ? (
          <button
            type="button"
            onClick={() => setMaisDecisoes((atual) => !atual)}
            aria-expanded={maisDecisoes}
            className="mt-3 text-[13px] font-bold text-tse-olive"
          >
            {maisDecisoes
              ? "Ocultar avisos"
              : criticos.length > 0
                ? `Ver os outros ${demais.length} avisos`
                : `Ver ${demais.length} avisos`}
          </button>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <Indicador
          icone={Route}
          titulo="Voos do mês"
          resumo={resumoAgenda}
          aberto={abertos.includes("agenda")}
          onToggle={() => alternar("agenda")}
        >
          {agenda.length === 0 ? (
            <p className="text-[13px] text-tse-muted">Nenhum itinerário neste recorte.</p>
          ) : (
            <ul className="divide-y divide-[#EEEEEE]">
              {agenda.map((trip) => {
                const span = itinerarySpan(trip);
                const hours = tripHours(trip);
                return (
                  <li key={trip.id}>
                    <Link
                      href={`/itinerarios/${trip.id}`}
                      className="grid gap-2 py-3 sm:grid-cols-[72px_1fr_auto] sm:items-center"
                    >
                      <span className="text-[13px] font-semibold text-tse-muted">
                        {span ? formatDateShort(span.first) : ""}
                      </span>
                      <span>
                        <span className="block text-[14px] font-bold">{trip.title}</span>
                        <span className="block text-[12px] text-tse-muted">
                          {itineraryCities(trip)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 sm:justify-end">
                        <span className="text-[12px] text-tse-muted">
                          {formatHours(hours.voadas + hours.previstas)}
                        </span>
                        <StatusBadge value={trip.status} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href="/itinerarios"
            className="mt-2 inline-block text-[12px] font-bold tracking-wide text-tse-olive uppercase"
          >
            Ver tudo
          </Link>
        </Indicador>
        <Indicador
          icone={Clock3}
          titulo="Horas voadas"
          resumo={resumoHoras}
          aberto={abertos.includes("horas")}
          onToggle={() => alternar("horas")}
        >
          <p className="text-[14px]">
            {formatHours(kpis.horasVoadas)} já voadas
            {kpis.horasPrevistas > 0
              ? ` e ${formatHours(kpis.horasPrevistas)} ainda previstas`
              : ""}
            .
          </p>
          <Link
            href="/itinerarios"
            className="mt-2 inline-block text-[12px] font-bold tracking-wide text-tse-olive uppercase"
          >
            Ver itinerários
          </Link>
        </Indicador>
        <Indicador
          icone={Gauge}
          titulo="Custo por hora voada"
          resumo={kpis.custoHora === null ? "Ainda sem hora realizada" : formatBRL(kpis.custoHora)}
          aberto={abertos.includes("hora")}
          onToggle={() => alternar("hora")}
        >
          <p className="text-[14px]">
            Combustível, taxas, pátio e catering dos voos já realizados
            {kpis.custoHora === null ? "." : `, ${formatBRL(kpis.custoHora)} por hora.`}
          </p>
          <Link
            href="/despesas"
            className="mt-2 inline-block text-[12px] font-bold tracking-wide text-tse-olive uppercase"
          >
            Ver despesas
          </Link>
        </Indicador>
        <Indicador
          icone={PieChart}
          titulo="Onde foi o dinheiro"
          resumo={resumoCusto ?? "Sem custo neste mês"}
          aberto={abertos.includes("composicao")}
          onToggle={() => alternar("composicao")}
        >
          {categorias.length === 0 ? (
            <p className="text-[13px] text-tse-muted">Nenhum custo neste recorte.</p>
          ) : (
            <ul className="space-y-3">
              {categorias.map((item) => (
                <li key={item.category}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                    <span>{CATEGORY_LABEL[item.category]}</span>
                    <span className="font-bold">{formatBRL(item.amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-tse-bg">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, (item.amount / maiorCategoria) * 100)}%`,
                        background: categoryBarColor(item.category),
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Indicador>
        <Indicador
          icone={Users}
          titulo="Conta de cada sócio"
          resumo={resumoRateio || "Sem outros sócios neste recorte"}
          aberto={abertos.includes("rateio")}
          onToggle={() => alternar("rateio")}
        >
          <ul className="space-y-4">
            {rateio.partners.map((item) => {
              const width = item.total > 0 ? Math.min(100, (item.pago / item.total) * 100) : 0;
              return (
                <li key={item.partnerId}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-bold">
                      <span
                        className="mr-2 inline-block size-2.5 rounded-full"
                        style={{ background: corDoSocio(item.partnerId) }}
                      />
                      {partnerShort(item.partnerId)}
                      {item.partnerId === VIEWER_ID ? (
                        <span className="ml-2 text-[11px] font-bold tracking-wide text-tse-gold uppercase">
                          Você
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[13px] font-bold">
                      {item.saldo <= 1 ? "Em dia" : `${formatBRL(item.saldo)} em aberto`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-tse-bg">
                    <div className="h-full rounded-full bg-tse-olive" style={{ width: `${width}%` }} />
                  </div>
                  <p className="mt-1 text-[12px] text-tse-muted">
                    {formatBRL(item.pago)} de {formatBRL(item.total)} · {formatHours(item.hours)}{" "}
                    pedidas
                  </p>
                </li>
              );
            })}
          </ul>
          <Link
            href="/rateio"
            className="mt-3 inline-block text-[12px] font-bold tracking-wide text-tse-olive uppercase"
          >
            Abrir rateio
          </Link>
        </Indicador>
      </section>
    </PageStack>
  );
}

function Decisao({ alerta }: { alerta: Alerta }) {
  return (
    <li>
      <Link href={alerta.href} className="flex gap-3">
        <span className={`mt-1 h-8 w-1 shrink-0 rounded-full ${TONE_BAR[alerta.tone]}`} />
        <span>
          <span className="block text-[14px] font-bold">{alerta.title}</span>
          <span className="block text-[12px] leading-5 text-tse-muted">{alerta.detail}</span>
        </span>
      </Link>
    </li>
  );
}

function Numero({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Link href={href} className="rounded-2xl bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">{label}</p>
      <p className="mt-2 text-[26px] leading-none font-bold tracking-tight">{value}</p>
      <p className="mt-2 text-[12px] leading-5 text-tse-muted">{hint}</p>
    </Link>
  );
}

function Indicador({
  icone: Icone,
  titulo,
  resumo,
  aberto,
  onToggle,
  children,
}: {
  icone: LucideIcon;
  titulo: string;
  resumo: string;
  aberto: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-[#EEEEEE] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#1E293B]">
          <Icone className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold">{titulo}</span>
          <span className="block truncate text-[13px] text-tse-muted">{resumo}</span>
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-tse-muted transition-transform", aberto && "rotate-180")}
          aria-hidden
        />
      </button>
      {aberto ? <div className="px-5 pb-4">{children}</div> : null}
    </div>
  );
}
