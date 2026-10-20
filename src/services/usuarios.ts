"use server";

import { cookies, headers } from "next/headers";
import { CABECALHO_USUARIO, chaveAuth, lerSessaoCookie, usuarioComTokenValido } from "@/lib/sessao-cookie";
import { clienteServico } from "@/services/supabase-servidor";
import { criarClienteSessao } from "@/services/supabase-sessao";
import type { PapelUsuario, SessaoUsuario, UsuarioAcesso } from "@/types/usuario";

const PAPEIS: PapelUsuario[] = ["controlador", "operacao", "leitura"];

export type ListaUsuarios = {
  usuarios: UsuarioAcesso[];
  erro: string | null;
  podeControlar: boolean;
  membroId: string;
};

function papelValido(valor: string): valor is PapelUsuario {
  return PAPEIS.some((papel) => papel === valor);
}

function ehUsuario(valor: unknown): valor is UsuarioAcesso {
  if (!valor || typeof valor !== "object") return false;
  const item = valor as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.userId === "string" &&
    typeof item.nome === "string" &&
    typeof item.email === "string" &&
    typeof item.papel === "string" &&
    papelValido(item.papel)
  );
}

function lerLista(valor: unknown): UsuarioAcesso[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter(ehUsuario);
}

function mensagemAuth(mensagem: string): string {
  const texto = mensagem.toLowerCase();
  if (emailJaCadastrado(texto)) return "Esse e-mail já está na operação.";
  if (texto.includes("password")) return "A senha precisa ter pelo menos 8 caracteres.";
  return "Não foi possível concluir o acesso.";
}

function emailJaCadastrado(mensagem: string): boolean {
  const texto = mensagem.toLowerCase();
  return texto.includes("already") || texto.includes("registered") || texto.includes("exists");
}

type AcessoAuth = { id: string; criadoAgora: boolean } | { erro: string };

function acessoComErro(valor: AcessoAuth): valor is { erro: string } {
  return "erro" in valor;
}

async function buscarAuthPorEmail(email: string): Promise<string | null> {
  const admin = clienteServico();
  for (let pagina = 1; pagina <= 10; pagina += 1) {
    const lista = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (lista.error) return null;
    const achado = lista.data.users.find((user) => user.email?.toLowerCase() === email);
    if (achado?.id) return achado.id;
    if (lista.data.users.length < 200) return null;
  }
  return null;
}

async function obterOuCriarAuth(nome: string, email: string, senha: string): Promise<AcessoAuth> {
  const admin = clienteServico();
  const criado = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (!criado.error && criado.data.user?.id) {
    return { id: criado.data.user.id, criadoAgora: true };
  }

  const mensagem = criado.error?.message ?? "";
  if (!emailJaCadastrado(mensagem)) return { erro: mensagemAuth(mensagem) };

  const existente = await buscarAuthPorEmail(email);
  if (!existente) return { erro: "Esse e-mail já está em uso e não deu para localizar a conta." };

  const membro = await membroDoUsuario(existente);
  if (membro) return { erro: "Esse e-mail já está na operação. Entre com a senha." };

  const atualizado = await admin.auth.admin.updateUserById(existente, {
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (atualizado.error) return { erro: mensagemAuth(atualizado.error.message) };
  return { id: existente, criadoAgora: false };
}

async function vincularMembro(
  userId: string,
  nome: string,
  email: string,
  papel: PapelUsuario,
  criadoAgora: boolean,
): Promise<string | null> {
  const admin = clienteServico();
  const salvo = await admin.rpc("salvar_membro_aero", {
    membro_id: userId,
    uid: userId,
    nome_membro: nome,
    email_membro: email,
    papel_membro: papel,
  });
  if (!salvo.error) return null;
  if (criadoAgora) await admin.auth.admin.deleteUser(userId);
  return "Não foi possível vincular o acesso à operação.";
}

function validarCampos(
  nome: string,
  email: string,
  senha: string,
  senhaObrigatoria: boolean,
): { nome: string; email: string; senha: string } | string {
  const nomeLimpo = nome.trim();
  const emailLimpo = email.trim().toLowerCase();
  if (nomeLimpo.length < 2) return "Informe o nome de quem vai acessar.";
  if (!emailLimpo.includes("@") || !emailLimpo.includes(".")) return "Informe um e-mail válido.";
  if (senhaObrigatoria && senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!senhaObrigatoria && senha.length > 0 && senha.length < 8) {
    return "A senha precisa ter pelo menos 8 caracteres.";
  }
  return { nome: nomeLimpo, email: emailLimpo, senha };
}

async function lerMembros(): Promise<UsuarioAcesso[]> {
  const admin = clienteServico();
  const { data, error } = await admin.rpc("listar_membros_aero");
  if (error) throw new Error(error.message);
  return lerLista(data);
}

async function membroDoUsuario(userId: string): Promise<UsuarioAcesso | null> {
  const admin = clienteServico();
  const { data, error } = await admin.rpc("membro_por_usuario_aero", { uid: userId });
  if (error) throw new Error(error.message);
  return ehUsuario(data) ? data : null;
}

export async function usuarioDaRequisicao(): Promise<string | null> {
  const cabecalhos = await headers();
  const valor = cabecalhos.get(CABECALHO_USUARIO) ?? "";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)) return valor;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  const jar = await cookies();
  const sessao = lerSessaoCookie(jar.getAll(), chaveAuth(url));
  if (!sessao) return null;
  return usuarioComTokenValido(sessao.access_token);
}

export async function sessaoAtual(): Promise<SessaoUsuario | null> {
  const userId = await usuarioDaRequisicao();
  if (!userId) return null;
  const membro = await membroDoUsuario(userId);
  if (!membro) return null;
  return {
    membroId: membro.id,
    userId: membro.userId,
    nome: membro.nome,
    email: membro.email,
    papel: membro.papel,
  };
}

async function exigirMembro(): Promise<SessaoUsuario> {
  const sessao = await sessaoAtual();
  if (!sessao) throw new Error("Entre de novo para continuar.");
  return sessao;
}

async function exigirControle(): Promise<SessaoUsuario> {
  const sessao = await exigirMembro();
  if (sessao.papel !== "controlador") {
    throw new Error("Só o controle da operação altera usuários.");
  }
  return sessao;
}

export async function operacaoSemAcesso(): Promise<boolean> {
  const lista = await lerMembros();
  return lista.length === 0;
}

export async function entrar(email: string, senha: string, lembrar = true): Promise<string | null> {
  const supabase = await criarClienteSessao(lembrar);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: senha,
  });
  if (error || !data.user) return "E-mail ou senha não conferem.";

  const membro = await membroDoUsuario(data.user.id);
  if (!membro) {
    await supabase.auth.signOut();
    return "Este acesso ainda não está na operação.";
  }
  return null;
}

export async function sair(): Promise<void> {
  const supabase = await criarClienteSessao();
  await supabase.auth.signOut();
}

export async function validarSessao(): Promise<string | null> {
  const sessao = await sessaoAtual();
  if (sessao) return null;
  const supabase = await criarClienteSessao();
  await supabase.auth.signOut();
  return "Este acesso ainda não está na operação.";
}

export async function criarPrimeiroAcesso(
  nome: string,
  email: string,
  senha: string,
  lembrar = true,
): Promise<string | null> {
  const lista = await lerMembros();
  if (lista.length > 0) return "A operação já tem um acesso. Entre com e-mail e senha.";

  const campos = validarCampos(nome, email, senha, true);
  if (typeof campos === "string") return campos;

  const acesso = await obterOuCriarAuth(campos.nome, campos.email, campos.senha);
  if (acessoComErro(acesso)) return acesso.erro;

  const falha = await vincularMembro(acesso.id, campos.nome, campos.email, "controlador", acesso.criadoAgora);
  if (falha) return falha;

  return entrar(campos.email, campos.senha, lembrar);
}

export async function listarUsuarios(): Promise<ListaUsuarios> {
  try {
    const sessao = await exigirMembro();
    const usuarios = await lerMembros();
    return {
      usuarios,
      erro: null,
      podeControlar: sessao.papel === "controlador",
      membroId: sessao.membroId,
    };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Não foi possível listar os acessos.";
    return { usuarios: [], erro: mensagem, podeControlar: false, membroId: "" };
  }
}

export async function obterUsuario(id: string): Promise<UsuarioAcesso | null> {
  await exigirMembro();
  const usuarios = await lerMembros();
  return usuarios.find((usuario) => usuario.id === id) ?? null;
}

export async function salvarUsuario(entrada: {
  id: string | null;
  nome: string;
  email: string;
  senha: string;
  papel: string;
}): Promise<string | null> {
  const sessao = await exigirControle();
  if (!papelValido(entrada.papel)) return "Escolha o papel desse acesso.";

  const campos = validarCampos(entrada.nome, entrada.email, entrada.senha, entrada.id === null);
  if (typeof campos === "string") return campos;

  const lista = await lerMembros();
  const admin = clienteServico();

  if (entrada.id === null) {
    const acesso = await obterOuCriarAuth(campos.nome, campos.email, campos.senha);
    if (acessoComErro(acesso)) return acesso.erro;
    return vincularMembro(acesso.id, campos.nome, campos.email, entrada.papel, acesso.criadoAgora);
  }

  const atual = lista.find((usuario) => usuario.id === entrada.id);
  if (!atual) return "Esse acesso não está mais na operação.";

  const controladores = lista.filter((usuario) => usuario.papel === "controlador").length;
  if (atual.papel === "controlador" && entrada.papel !== "controlador" && controladores <= 1) {
    return "A operação precisa de pelo menos um controle.";
  }
  if (atual.userId === sessao.userId && entrada.papel !== "controlador") {
    return "Você não pode tirar o próprio controle.";
  }

  const dados: { email: string; email_confirm: boolean; user_metadata: { nome: string }; password?: string } = {
    email: campos.email,
    email_confirm: true,
    user_metadata: { nome: campos.nome },
  };
  if (campos.senha.length > 0) dados.password = campos.senha;

  const atualizado = await admin.auth.admin.updateUserById(atual.userId, dados);
  if (atualizado.error) return mensagemAuth(atualizado.error.message);

  const salvo = await admin.rpc("salvar_membro_aero", {
    membro_id: atual.id,
    uid: atual.userId,
    nome_membro: campos.nome,
    email_membro: campos.email,
    papel_membro: entrada.papel,
  });
  if (salvo.error) return "Não foi possível salvar o acesso.";
  return null;
}

export async function excluirUsuario(id: string): Promise<string | null> {
  const sessao = await exigirControle();
  const lista = await lerMembros();
  const atual = lista.find((usuario) => usuario.id === id);
  if (!atual) return "Esse acesso não está mais na operação.";
  if (atual.userId === sessao.userId) return "Você não pode excluir o próprio acesso.";

  const controladores = lista.filter((usuario) => usuario.papel === "controlador").length;
  if (atual.papel === "controlador" && controladores <= 1) {
    return "A operação precisa de pelo menos um controle.";
  }

  const admin = clienteServico();
  const removido = await admin.auth.admin.deleteUser(atual.userId);
  if (removido.error) {
    const texto = removido.error.message.toLowerCase();
    if (!texto.includes("not found")) return "Não foi possível excluir o acesso.";
  }

  const apagado = await admin.rpc("excluir_membro_aero", { membro_id: atual.id });
  if (apagado.error) return "Não foi possível excluir o acesso.";
  return null;
}
