const AVISOS: Record<string, string> = {
  credenciais: "E-mail ou senha não conferem.",
  fora: "Este acesso ainda não está na operação.",
  operacao: "A operação já tem um acesso. Entre com e-mail e senha.",
  nome: "Informe o nome de quem vai acessar.",
  email: "Informe um e-mail válido.",
  senha: "A senha precisa ter pelo menos 8 caracteres.",
  vinculo: "Não foi possível vincular o acesso à operação.",
  uso: "Esse e-mail já está na operação. Entre com a senha.",
  localizar: "Esse e-mail já está em uso e não deu para localizar a conta.",
  geral: "Não foi possível concluir o acesso.",
};

export function avisoEntrada(codigo: string | undefined): string {
  if (!codigo) return "";
  return AVISOS[codigo] ?? AVISOS.geral;
}

export function codigoAviso(falha: string): string {
  const texto = falha.toLowerCase();
  if (texto.includes("não conferem")) return "credenciais";
  if (texto.includes("ainda não está")) return "fora";
  if (texto.includes("já tem um acesso")) return "operacao";
  if (texto.includes("informe o nome")) return "nome";
  if (texto.includes("e-mail válido")) return "email";
  if (texto.includes("8 caracteres")) return "senha";
  if (texto.includes("vincular")) return "vinculo";
  if (texto.includes("já está na operação")) return "uso";
  if (texto.includes("localizar")) return "localizar";
  return "geral";
}
