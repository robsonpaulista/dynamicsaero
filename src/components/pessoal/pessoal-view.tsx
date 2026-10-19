"use client";

import { BotaoNovo, LinkEditar } from "@/components/formularios/campos";
import { FiltrosOperacao } from "@/components/shell/filtros-operacao";
import { Card, PageStack, StatusBadge } from "@/components/ui/tse";
import { useOperacao } from "@/context/operacao-context";
import { useDados } from "@/hooks/use-dados";
import { daysUntil, formatBRL, formatDate, formatPercent } from "@/lib/format";
import { mascaraWhatsapp, digitosWhatsapp } from "@/lib/telefone";
import { corDoSocio, ROLE_LABEL } from "@/lib/labels";
import { getAircraft, HOJE, listAircraft, listCrew, listPartners, matchesAircraft } from "@/services/operacao";

export function PessoalView() {
  useDados();
  const { aircraftId } = useOperacao();
  const people = listCrew().filter((person) =>
    person.aircraftIds.some((id) => matchesAircraft(id, aircraftId)),
  );
  const cotistas = listPartners().filter((partner) => {
    if (aircraftId === "todas") return true;
    const craft = getAircraft(aircraftId);
    return craft?.ownership.some((item) => item.partnerId === partner.id && item.share > 0) ?? false;
  });
  const folha = people.reduce((sum, person) => sum + person.monthlyCost, 0);

  return (
    <PageStack>
      <FiltrosOperacao legenda="Cotistas, tripulação, manutenção de linha e a gestão da operação." />
      <div className="flex justify-end">
        <BotaoNovo href="/pessoal/novo">Nova pessoa</BotaoNovo>
      </div>
      <section>
        <h2 className="text-[16px] font-bold">Cotistas</h2>
        <p className="mt-1 text-[13px] text-tse-muted">
          Quem participa das aeronaves. O percentual de cada um fica no cadastro da frota.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {cotistas.length === 0 ? (
            <p className="text-[13px] text-tse-muted">Nenhum cotista neste recorte.</p>
          ) : (
            cotistas.map((partner) => {
              const fatias = participacao(partner.id);
              return (
                <Card key={partner.id}>
                  <div className="flex items-start gap-3">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                      style={{
                        background: corDoSocio(partner.id),
                        color: corDoSocio(partner.id) === "#EBB402" ? "#333333" : "#ffffff",
                      }}
                    >
                      {iniciais(partner.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-[16px] font-bold">{partner.name}</h3>
                          <p className="text-[13px] text-tse-muted">
                            {partner.role} · {partner.company}
                          </p>
                        </div>
                        <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-bold tracking-wide text-[#334155] uppercase">
                          Cotista
                        </span>
                      </div>
                      <p className="mt-3 text-[13px]">
                        {fatias.length > 0 ? fatias.join(" · ") : "Sem participação lançada na frota."}
                      </p>
                      {partner.phone ? (
                        <a
                          href={`https://wa.me/${digitosWhatsapp(partner.phone)}`}
                          className="mt-2 block text-[13px] font-semibold text-tse-olive hover:underline"
                        >
                          {mascaraWhatsapp(partner.phone)}
                        </a>
                      ) : null}
                      <div className="mt-3">
                        <LinkEditar href={`/pessoal/${partner.id}/editar`} />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-[16px] font-bold">Tripulação e gestão</h2>
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold tracking-wide text-tse-muted uppercase">Folha do mês</p>
          <p className="mt-2 text-[32px] font-bold tracking-tight">{formatBRL(folha)}</p>
          <p className="mt-1 text-[13px] text-tse-muted">
            Quem atende mais de uma aeronave tem o custo repartido entre elas e, depois, entre os sócios.
          </p>
        </article>
        <div className="grid gap-3 lg:grid-cols-2">
        {people.map((person) => {
          const documents = [
            { label: person.documentLabel, date: person.documentExpiry },
            person.medicalExpiry && person.medicalLabel
              ? { label: person.medicalLabel, date: person.medicalExpiry }
              : null,
          ].filter((item): item is { label: string; date: string } => item !== null);

          return (
            <Card key={person.id}>
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tse-soft text-[13px] font-bold text-tse-gold">
                  {iniciais(person.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-[16px] font-bold">{person.name}</h2>
                      <p className="text-[13px] text-tse-muted">
                        {ROLE_LABEL[person.role]} · {person.base}
                      </p>
                    </div>
                    <StatusBadge value={person.status} />
                  </div>
                  <p className="mt-3 text-[13px]">{person.nextDuty}</p>
                  <p className="mt-1 text-[13px] font-bold">{formatBRL(person.monthlyCost)} / mês</p>
                  <p className="mt-2 text-[12px] text-tse-muted">
                    {person.aircraftIds
                      .map((id) => getAircraft(id)?.registration)
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {documents.map((document) => {
                      const days = daysUntil(document.date, HOJE);
                      const tone =
                        days < 0 ? "text-[#EF4444]" : days <= 35 ? "text-[#0369A1]" : "text-tse-olive";
                      return (
                        <li key={document.label} className="flex items-center justify-between gap-3 text-[13px]">
                          <span>{document.label}</span>
                          <span className={`text-right font-semibold ${tone}`}>
                            {formatDate(document.date)}
                            <span className="block text-[11px] font-bold tracking-wide uppercase">
                              {days < 0 ? "Vencido" : days === 0 ? "Vence hoje" : `${days} dias`}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-3">
                    <LinkEditar href={`/pessoal/${person.id}/editar`} />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      </section>
    </PageStack>
  );
}

function participacao(partnerId: string): string[] {
  return listAircraft().flatMap((craft) => {
    const share = craft.ownership.find((item) => item.partnerId === partnerId)?.share ?? 0;
    if (share <= 0) return [];
    return [`${craft.registration} ${formatPercent(share)}`];
  });
}

function iniciais(name: string): string {
  const parts = name.split(" ").filter((part) => part.length > 2);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}
