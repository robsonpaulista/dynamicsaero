export type PapelUsuario = "controlador" | "operacao" | "leitura";

export type UsuarioAcesso = {
  id: string;
  userId: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
};

export type SessaoUsuario = {
  membroId: string;
  userId: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
};

export const PAPEL_USUARIO: Record<PapelUsuario, string> = {
  controlador: "Controle",
  operacao: "Operação",
  leitura: "Leitura",
};
