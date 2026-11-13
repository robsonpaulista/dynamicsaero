"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AcoesForm,
  Campo,
  CampoSelect,
  ErroForm,
  FormPage,
  Grade,
} from "@/components/formularios/campos";
import { useDados, usePronto } from "@/hooks/use-dados";
import { CATEGORY_LABEL, CATEGORIAS_FIXAS, CATEGORIAS_VARIAVEIS, grupoDaDespesa } from "@/lib/labels";
import { criarId, excluirContaPlano, salvarContaPlano } from "@/services/acoes";
import { getContaPlano } from "@/services/operacao";
import type { ExpenseCategory, GrupoDespesa } from "@/types/operacao";

export function ContaForm({ id }: { id?: string }) {
  const pronto = usePronto();
  if (!pronto) {
    return (
      <FormPage voltarHref="/despesas/contas" voltar="Voltar ao plano" titulo="Conta">
        <p className="text-[13px] text-tse-muted">Carregando o cadastro…</p>
      </FormPage>
    );
  }
  return <ContaCampos id={id} />;
}

function ContaCampos({ id }: { id?: string }) {
  useDados();
  const router = useRouter();
  const atual = id ? getContaPlano(id) : undefined;
  const [erro, setErro] = useState<string>("");
  const [nome, setNome] = useState<string>(atual?.nome ?? "");
  const [grupo, setGrupo] = useState<GrupoDespesa>(atual?.grupo ?? "variavel");
  const [category, setCategory] = useState<ExpenseCategory>(atual?.category ?? "taxas");
  const [ativo, setAtivo] = useState<string>(atual?.ativo === false ? "nao" : "sim");

  if (id && !atual) {
    return (
      <FormPage voltarHref="/despesas/contas" voltar="Voltar ao plano" titulo="Conta não encontrada">
        {null}
      </FormPage>
    );
  }

  const natures = grupo === "fixa" ? CATEGORIAS_FIXAS : CATEGORIAS_VARIAVEIS;

  function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const titulo = nome.trim();
    if (!titulo) {
      setErro("Informe o nome da conta.");
      return;
    }
    if (!natures.includes(category)) {
      setErro("A natureza precisa bater com o grupo fixa/variável.");
      return;
    }
    salvarContaPlano({
      id: atual?.id ?? criarId("conta"),
      nome: titulo,
      category,
      grupo,
      ativo: ativo === "sim",
    });
    router.push("/despesas/contas");
  }

  return (
    <FormPage
      voltarHref="/despesas/contas"
      voltar="Voltar ao plano"
      titulo={atual ? "Editar conta" : "Nova conta"}
      texto="A classificação fixa/variável acompanha a natureza e aparece na despesa avulsa."
    >
      <form onSubmit={salvar}>
        <Grade>
          <Campo label="Nome" value={nome} onChange={setNome} required placeholder="Taxas aeroportuárias" />
          <CampoSelect
            label="Classificação"
            value={grupo}
            onChange={(value) => {
              const next = value as GrupoDespesa;
              setGrupo(next);
              const lista = next === "fixa" ? CATEGORIAS_FIXAS : CATEGORIAS_VARIAVEIS;
              if (!lista.includes(category)) setCategory(lista[0] ?? "administrativo");
            }}
          >
            <option value="fixa">Fixa</option>
            <option value="variavel">Variável</option>
          </CampoSelect>
          <CampoSelect
            label="Natureza"
            value={category}
            onChange={(value) => {
              const next = value as ExpenseCategory;
              setCategory(next);
              setGrupo(grupoDaDespesa(next));
            }}
          >
            {natures.map((item) => (
              <option key={item} value={item}>
                {CATEGORY_LABEL[item]}
              </option>
            ))}
          </CampoSelect>
          <CampoSelect label="Situação" value={ativo} onChange={setAtivo}>
            <option value="sim">Ativa</option>
            <option value="nao">Inativa</option>
          </CampoSelect>
        </Grade>
        {erro ? <ErroForm>{erro}</ErroForm> : null}
        <AcoesForm
          cancelarHref="/despesas/contas"
          excluir={
            atual
              ? () => {
                  excluirContaPlano(atual.id);
                  router.push("/despesas/contas");
                }
              : undefined
          }
        />
      </form>
    </FormPage>
  );
}
