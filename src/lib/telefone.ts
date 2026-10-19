function nacionais(valor: string): string {
  let digitos = valor.replace(/\D/g, "");
  if (valor.includes("+55") || (digitos.startsWith("55") && digitos.length > 11)) {
    digitos = digitos.slice(2);
  }
  return digitos.slice(0, 11);
}

export function mascaraWhatsapp(valor: string): string {
  const digitos = nacionais(valor);
  if (digitos.length === 0) return "";
  const ddd = digitos.slice(0, 2);
  const meio = digitos.slice(2, 7);
  const fim = digitos.slice(7, 11);
  let texto = "+55";
  if (ddd) texto += ` (${ddd}`;
  if (ddd.length === 2) texto += ")";
  if (meio) texto += ` ${meio}`;
  if (fim) texto += `-${fim}`;
  return texto;
}

export function whatsappCompleto(valor: string): boolean {
  const digitos = nacionais(valor);
  return digitos.length === 11 && digitos[2] === "9";
}

export function digitosWhatsapp(valor: string): string {
  return `55${nacionais(valor)}`;
}
