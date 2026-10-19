"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { LinkEditar } from "@/components/formularios/campos";
import { BackLink, Card, PageStack, StatusBadge } from "@/components/ui/tse";
import { useDados } from "@/hooks/use-dados";
import { formatBRL, formatDate, formatPercent } from "@/lib/format";
import { KIND_LABEL } from "@/lib/labels";
import { getAircraft, getMaintenance, partnerName } from "@/services/operacao";

export function ManutencaoDetalhe() {
  useDados();
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const item = getMaintenance(id);

  if (!item) {
    return (
      <PageStack>
        <BackLink href="/manutencao">Voltar à manutenção</BackLink>
        <Card title="Ordem não encontrada" />
      </PageStack>
    );
  }

  const craft = getAircraft(item.aircraftId);
  const valor = item.cost > 0 ? item.cost : item.estimate;

  return (
    <PageStack>
      <BackLink href="/manutencao">Voltar à manutenção</BackLink>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold tracking-wide text-tse-muted uppercase">
              {craft ? (
                <Link href={`/frota/${craft.id}`} className="hover:underline">
                  {craft.registration}
                </Link>
              ) : null}{" "}
              · {item.system}
            </p>
            <h2 className="mt-1 text-[26px] font-bold tracking-tight">{item.title}</h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-tse-muted">{item.summary}</p>
          </div>
          <div className="flex items-center gap-2">
            <LinkEditar href={`/manutencao/${item.id}/editar`} />
            <StatusBadge value={item.kind} />
            <StatusBadge value={item.status} />
          </div>
        </div>
        {item.grounding ? (
          <p className="mt-4 rounded-xl bg-[#FEF2F2] px-3 py-2 text-[13px] font-semibold text-[#EF4444]">
            Esta ordem retém a aeronave.
          </p>
        ) : null}
      </section>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Quando">
          <dl className="space-y-2 text-[14px]">
            <Linha rotulo="Aberta em" valor={formatDate(item.openedAt)} />
            <Linha rotulo="Prazo" valor={item.dueLabel} />
            <Linha rotulo="Tipo" valor={KIND_LABEL[item.kind]} />
            <Linha rotulo="Oficina" valor={item.vendor} />
            {item.remainingHours !== null ? (
              <Linha rotulo="Horas restantes" valor={`${item.remainingHours} h`} />
            ) : null}
          </dl>
        </Card>
        <Card
          title="Quem paga"
          subtitle={
            item.competencia
              ? "Lançado neste mês, dividido pela participação."
              : "Ainda fora do rateio. A estimativa é só para decidir."
          }
        >
          <p className="text-[28px] font-bold tracking-tight">
            {valor ? formatBRL(valor) : "Sem valor"}
          </p>
          {item.posting ? (
            <div className="mt-2">
              <StatusBadge value={item.posting} />
            </div>
          ) : null}
          {craft && valor ? (
            <ul className="mt-4 space-y-2 text-[14px]">
              {craft.ownership.map((owner) => (
                <li key={owner.partnerId} className="flex justify-between gap-3">
                  <span>
                    {partnerName(owner.partnerId)} · {formatPercent(owner.share)}
                  </span>
                  <span className="font-bold">{formatBRL(valor * owner.share)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>
    </PageStack>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-tse-muted">{rotulo}</dt>
      <dd className="text-right font-semibold">{valor}</dd>
    </div>
  );
}
