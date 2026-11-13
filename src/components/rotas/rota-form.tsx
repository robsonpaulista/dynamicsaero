"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CampoAerodromo } from "@/components/formularios/campo-aerodromo";
import {
  AcoesForm,
  Campo,
  CampoArea,
  ErroForm,
  FormPage,
  Grade,
  numeroCampo,
} from "@/components/formularios/campos";
import { useDados, usePronto } from "@/hooks/use-dados";
import { criarId, excluirRota, salvarRota } from "@/services/acoes";
import { cidadeAerodromo } from "@/services/operacao";

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
      setErro("Informe o aeródromo de origem e de destino (ICAO ou cidade).");
      return;
    }
    if (Number.isNaN(horas) || horas < 0) {
      setErro("Informe as horas de bloco.");
      return;
    }
    const cidadeOrigem = fromCity.trim() || cidadeAerodromo(origem, origem);
    const cidadeDestino = toCity.trim() || cidadeAerodromo(destino, destino);
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
      texto="Busque por ICAO ou cidade. A rota fica disponível para preencher as pernas de um itinerário."
    >
      <form onSubmit={salvar}>
        <Grade>
          <Campo label="Nome" value={nome} onChange={setNome} placeholder="Guarulhos → Brasília" />
          <Campo
            label="Horas de bloco"
            value={blockHours}
            onChange={setBlockHours}
            type="number"
            step="0.1"
            inputMode="decimal"
          />
          <CampoAerodromo
            label="Origem"
            icao={fromIcao}
            cidade={fromCity}
            onChange={(icao, cidade) => {
              setFromIcao(icao);
              setFromCity(cidade);
            }}
            required
          />
          <CampoAerodromo
            label="Destino"
            icao={toIcao}
            cidade={toCity}
            onChange={(icao, cidade) => {
              setToIcao(icao);
              setToCity(cidade);
            }}
            required
          />
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
