"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { PageStack } from "@/components/ui/tse";
import { excluirUsuario, obterUsuario, salvarUsuario } from "@/services/usuarios";
import { PAPEL_USUARIO, type PapelUsuario } from "@/types/usuario";

const PAPEIS: PapelUsuario[] = ["controlador", "operacao", "leitura"];

function papelDe(valor: string): PapelUsuario {
  if (valor === "controlador" || valor === "operacao" || valor === "leitura") return valor;
  return "leitura";
}

export function UsuarioForm({ id, podeControlar }: { id: string | null; podeControlar: boolean }) {
  const router = useRouter();
  const [nome, setNome] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [senha, setSenha] = useState<string>("");
  const [papel, setPapel] = useState<PapelUsuario>("operacao");
  const [erro, setErro] = useState<string>("");
  const [carregando, setCarregando] = useState<boolean>(id !== null);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [confirmar, setConfirmar] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;
    void obterUsuario(id).then((usuario) => {
      if (!usuario) {
        setErro("Esse acesso não está mais na operação.");
        setCarregando(false);
        return;
      }
      setNome(usuario.nome);
      setEmail(usuario.email);
      setPapel(usuario.papel);
      setCarregando(false);
    });
  }, [id]);

  async function aoEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!podeControlar) return;
    setSalvando(true);
    setErro("");
    const falha = await salvarUsuario({ id, nome, email, senha, papel });
    if (falha) {
      setErro(falha);
      setSalvando(false);
      return;
    }
    router.push("/usuarios");
    router.refresh();
  }

  async function remover() {
    if (!id) return;
    setSalvando(true);
    const falha = await excluirUsuario(id);
    if (falha) {
      setErro(falha);
      setSalvando(false);
      setConfirmar(false);
      return;
    }
    router.push("/usuarios");
    router.refresh();
  }

  return (
    <PageStack>
      <Link
        href="/usuarios"
        className="text-[12px] font-bold tracking-wide text-tse-olive uppercase hover:underline"
      >
        Acessos
      </Link>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-[22px] font-bold tracking-tight">
          {id ? "Editar acesso" : "Novo acesso"}
        </h2>
        <p className="mt-1 text-[13px] text-tse-muted">
          Nome, e-mail e o que essa pessoa pode fazer no cockpit.
        </p>

        {carregando ? (
          <p className="mt-5 text-[13px] text-tse-muted">Carregando o acesso…</p>
        ) : (
          <form
            className="mt-5 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              void aoEnviar(event);
            }}
          >
            <label>
              <span className="mb-1 block text-[11px] font-bold tracking-wide text-tse-muted uppercase">
                Nome
              </span>
              <input
                required
                disabled={!podeControlar}
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                className="h-9 w-full rounded-md border border-tse-border px-2.5 text-[13px] outline-none focus:border-tse-yellow disabled:bg-tse-soft"
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-bold tracking-wide text-tse-muted uppercase">
                E-mail
              </span>
              <input
                required
                type="email"
                disabled={!podeControlar}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-9 w-full rounded-md border border-tse-border px-2.5 text-[13px] outline-none focus:border-tse-yellow disabled:bg-tse-soft"
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-bold tracking-wide text-tse-muted uppercase">
                Senha
              </span>
              <input
                type="password"
                required={id === null}
                minLength={id === null ? 8 : undefined}
                disabled={!podeControlar}
                autoComplete="new-password"
                placeholder={id ? "Deixe em branco para manter" : ""}
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                className="h-9 w-full rounded-md border border-tse-border px-2.5 text-[13px] outline-none focus:border-tse-yellow disabled:bg-tse-soft"
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-bold tracking-wide text-tse-muted uppercase">
                Papel
              </span>
              <select
                disabled={!podeControlar}
                value={papel}
                onChange={(event) => setPapel(papelDe(event.target.value))}
                className="h-9 w-full rounded-md border border-tse-border bg-white px-2.5 text-[13px] outline-none focus:border-tse-yellow disabled:bg-tse-soft"
              >
                {PAPEIS.map((item) => (
                  <option key={item} value={item}>
                    {PAPEL_USUARIO[item]}
                  </option>
                ))}
              </select>
            </label>

            {erro ? (
              <p className="text-[13px] font-semibold text-[#EF4444] sm:col-span-2" role="alert">
                {erro}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              {podeControlar ? (
                <button
                  type="submit"
                  disabled={salvando}
                  className="inline-flex h-9 items-center rounded-md bg-tse-olive px-4 text-[13px] font-bold text-white hover:bg-[#1E293B] disabled:opacity-60"
                >
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
              ) : null}
              {id && podeControlar ? (
                confirmar ? (
                  <>
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => {
                        void remover();
                      }}
                      className="text-[13px] font-bold text-[#EF4444]"
                    >
                      Confirmar exclusão
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmar(false)}
                      className="text-[13px] font-semibold text-tse-muted"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmar(true)}
                    className="text-[13px] font-bold text-[#EF4444]"
                  >
                    Excluir
                  </button>
                )
              ) : null}
            </div>
          </form>
        )}
      </section>
    </PageStack>
  );
}
