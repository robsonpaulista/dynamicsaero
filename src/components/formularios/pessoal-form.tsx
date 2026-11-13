"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AcoesForm,
  Campo,
  ErroForm,
  FormPage,
  Grade,
} from "@/components/formularios/campos";
import { useDados, usePronto } from "@/hooks/use-dados";
import { mascaraWhatsapp, whatsappCompleto } from "@/lib/telefone";
import { criarId, excluirSocio, salvarSocio } from "@/services/acoes";
import { getCrew, getPartner } from "@/services/operacao";

export function PessoalForm({ id }: { id?: string }) {
  const pronto = usePronto();
  if (!pronto) {
    return (
      <FormPage voltarHref="/pessoal" voltar="Voltar aos sócios" titulo="Sócio">
        <p className="text-[13px] text-tse-muted">Carregando o cadastro…</p>
      </FormPage>
    );
  }
  return <PessoalCampos id={id} />;
}

function PessoalCampos({ id }: { id?: string }) {
  useDados();
  const router = useRouter();
  // Sócio tem prioridade: no caso JSA o cotista e o comandante compartilham o mesmo id.
  const atual = id ? getPartner(id) : undefined;
  const soTripulante = Boolean(id && !atual && getCrew(id));

  // Tripulação pura não se edita mais aqui — custo vai em Despesas fixas.
  useEffect(() => {
    if (soTripulante) {
      router.replace("/despesas?recorte=fixas");
    }
  }, [soTripulante, router]);

  const [erro, setErro] = useState<string>("");
  const [name, setName] = useState<string>(atual?.name ?? "");
  const [shortName, setShortName] = useState<string>(atual?.shortName ?? "");
  const [company, setCompany] = useState<string>(atual?.company ?? "");
  const [papel, setPapel] = useState<string>(atual?.role ?? "Cotista / sócio");
  const [phone, setPhone] = useState<string>(atual?.phone ? mascaraWhatsapp(atual.phone) : "");

  if (soTripulante) {
    return (
      <FormPage voltarHref="/despesas?recorte=fixas" voltar="Voltar às despesas" titulo="Tripulação">
        <p className="text-[13px] text-tse-muted">
          Tripulação e folha passam por Despesas fixas. Redirecionando…
        </p>
      </FormPage>
    );
  }

  if (id && !atual) {
    return (
      <FormPage voltarHref="/pessoal" voltar="Voltar aos sócios" titulo="Sócio não encontrado">
        {null}
      </FormPage>
    );
  }

  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setErro("Informe o nome.");
      return;
    }
    if (!company.trim()) {
      setErro("Informe a empresa do cotista.");
      return;
    }
    if (!whatsappCompleto(phone)) {
      setErro("Informe o WhatsApp completo: +55 (11) 99999-9999.");
      return;
    }
    const curto = shortName.trim() || name.trim().split(" ")[0] || name.trim();
    salvarSocio({
      id: atual?.id ?? criarId("socio"),
      name: name.trim(),
      shortName: curto,
      company: company.trim(),
      role: papel.trim() || "Cotista / sócio",
      phone: mascaraWhatsapp(phone),
    });
    router.push("/pessoal");
  }

  return (
    <FormPage
      voltarHref="/pessoal"
      voltar="Voltar aos sócios"
      titulo={atual ? `Editar ${atual.name}` : "Novo sócio"}
    >
      <form onSubmit={salvar}>
        <Grade>
          <Campo label="Nome" value={name} onChange={setName} required />
          <Campo label="Nome curto" value={shortName} onChange={setShortName} />
          <Campo label="Empresa" value={company} onChange={setCompany} required />
          <Campo label="Papel" value={papel} onChange={setPapel} />
          <Campo
            label="WhatsApp"
            value={phone}
            onChange={(value) => setPhone(mascaraWhatsapp(value))}
            placeholder="+55 (11) 99999-9999"
            inputMode="tel"
            required
          />
        </Grade>
        <p className="mt-4 text-[13px] text-tse-muted">
          A participação em cada aeronave continua no cadastro da frota. Tripulação e folha entram
          em Despesas fixas.
        </p>
        {erro ? <ErroForm>{erro}</ErroForm> : null}
        <AcoesForm
          cancelarHref="/pessoal"
          excluir={
            atual
              ? () => {
                  const motivo = excluirSocio(atual.id);
                  if (motivo) {
                    setErro(motivo);
                    return;
                  }
                  router.push("/pessoal");
                }
              : undefined
          }
        />
      </form>
    </FormPage>
  );
}
