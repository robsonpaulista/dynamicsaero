"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AcoesForm,
  Campo,
  CampoArea,
  ErroForm,
  FormPage,
  Grade,
  numeroCampo,
} from "@/components/formularios/campos";
import { AERODROMOS } from "@/data/calendario";
import { useDados, usePronto } from "@/hooks/use-dados";
import { criarId, excluirRota, salvarRota } from "@/services/acoes";

function cidadeDe(icao: string, atual: string): string {
  return AERODROMOS[icao.trim().toUpperCase()] ?? atual;
}

export function RotaForm({ id }: { id?: string }) {
  const pronto = usePronto();
  if (!pronto) {
    return (
      <FormPage voltarHref="/rotas" voltar="Voltar às rotas" titulo="Rota">
        <p className="text-[13px] text-tse-muted">Carregando o cadastro…</p>
      </FormPage>
    );
  }
  return <RotaCampos id={id} />;
}

function RotaCampos({ id }: { id?: string }) {
  const base = useDados();
  const router = useRouter();
  const atual = id ? base.rotas.find((item) => item.id === id) : undefined;
  const [nome, setNome] = useState<string>(atual?.nome ?? "");
  const [fromIcao, setFromIcao] = useState<string>(atual?.fromIcao ?? "");
  const [toIcao, setToIcao] = useState<string>(atual?.toIcao ?? "");
  const [fromCity, setFromCity] = useState<string>(atual?.fromCity ?? "");
  const [toCity, setToCity] = useState<string>(atual?.toCity ?? "");
  const [blockHours, setBlockHours] = useState<string>(atual ? String(atual.blockHours) : "");
  const [note, setNote] = useState<string>(atual?.note ?? "");
  const [erro, setErro] = useState<string>("");

  if (id && !atual) {
    return (
      <FormPage voltarHref="/rotas" voltar="Voltar às rotas" titulo="Rota não encontrada">
        {null}
      </FormPage>
    );
  }

  function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const origem = fromIcao.trim().toUpperCase();
    const destino = toIcao.trim().toUpperCase();
    const horas = numeroCampo(blockHours || "0");
    if (origem.length < 3 || destino.length < 3) {
      setErro("Informe o ICAO de origem e de destino.");
      return;
    }
    if (Number.isNaN(horas) || horas < 0) {
      setErro("Informe as horas de bloco.");
      return;
    }
    const cidadeOrigem = fromCity.trim() || cidadeDe(origem, origem);
    const cidadeDestino = toCity.trim() || cidadeDe(destino, destino);
    const titulo = nome.trim() || `${cidadeOrigem} → ${cidadeDestino}`;
    salvarRota({
      id: atual?.id ?? criarId("rota"),
      nome: titulo,
      fromIcao: origem,
      toIcao: destino,
      fromCity: cidadeOrigem,
      toCity: cidadeDestino,
      blockHours: horas,
      note: note.trim(),
    });
    router.push("/rotas");
  }

  return (
    <FormPage
      voltarHref="/rotas"
      voltar="Voltar às rotas"
      titulo={atual ? "Editar rota" : "Nova rota"}
      texto="A rota fica disponível para preencher as pernas de um itinerário."
    >
      <form onSubmit={salvar}>
        <Grade>
          <Campo label="Nome" value={nome} onChange={setNome} placeholder="Guarulhos → Brasília" />
          <Campo
            label="Horas de bloco"
            value={blockHours}
            onChange={setBlockHours}
            type="number"
          />
          <Campo
            label="Origem ICAO"
            value={fromIcao}
            onChange={(value) => {
              const icao = value.toUpperCase();
              setFromIcao(icao);
              setFromCity((cidade) => cidadeDe(icao, cidade));
            }}
            required
          />
          <Campo label="Cidade de origem" value={fromCity} onChange={setFromCity} />
          <Campo
            label="Destino ICAO"
            value={toIcao}
            onChange={(value) => {
              const icao = value.toUpperCase();
              setToIcao(icao);
              setToCity((cidade) => cidadeDe(icao, cidade));
            }}
            required
          />
          <Campo label="Cidade de destino" value={toCity} onChange={setToCity} />
          <CampoArea label="Nota" value={note} onChange={setNote} />
        </Grade>
        {erro ? <ErroForm>{erro}</ErroForm> : null}
        <AcoesForm
          cancelarHref="/rotas"
          excluir={
            atual
              ? () => {
                  excluirRota(atual.id);
                  router.push("/rotas");
                }
              : undefined
          }
        />
      </form>
    </FormPage>
  );
}
