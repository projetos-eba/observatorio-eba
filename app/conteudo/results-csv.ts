import { readCsv, validDate } from "../carteira/csv";
import {
  outcomes,
  normalizeCode,
  resultKey,
  today,
  latest,
  matchesResult,
  type Goal,
  type HubData,
  type ResultInput,
} from "./model";
const columns = ["tipo", "id_evento", "data", "fonte", "codigo", "valor_reais"];
export const csvModel = columns.join(";") + "\r\n";
export function cents(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(value))
    throw Error("Informe o valor como 1500,00 ou 1500.00.");
  const result = Math.round(Number(value.replace(",", ".")) * 100);
  if (!Number.isSafeInteger(result) || result > 999999999999)
    throw Error("O valor excede o limite.");
  return result;
}
export function resultIssue(r: ResultInput) {
  if (!outcomes.includes(r.goal)) return "Tipo de resultado inválido.";
  if (!r.externalId || r.externalId.length > 120)
    return "Informe o ID do evento em até 120 caracteres.";
  if (!validDate(r.date) || r.date > today())
    return "Informe uma data válida que já tenha ocorrido.";
  if (!r.source || r.source.length > 240)
    return "Informe uma fonte de até 240 caracteres.";
  if (r.code.length > 80) return "Código acima de 80 caracteres.";
  if (r.value !== null && r.goal !== "Venda")
    return "Valor comercial é registrado em vendas.";
  return "";
}
export function resultPreview(raw: string, data: HubData) {
  const rows = readCsv(raw, columns);
  if (!rows.length || rows.length > 50)
    throw Error("Inclua de 1 a 50 resultados por arquivo.");
  const seen = new Set<string>();
  const existing = new Set(latest(data.results).map(resultKey));
  return rows.map((cells, index) => {
    const [
      goal = "",
      externalId = "",
      date = "",
      source = "",
      code = "",
      value = "",
    ] = cells;
    let amount: number | null = null,
      valueIssue = "";
    try {
      amount = cents(value);
    } catch (error) {
      valueIssue = (error as Error).message;
    }
    const row = {
      goal: goal as Goal,
      externalId,
      date,
      source,
      code: normalizeCode(code),
      value: amount,
    };
    const key = resultKey(row);
    const error =
      cells.length !== columns.length
        ? "Número de colunas inválido."
        : valueIssue ||
          resultIssue(row) ||
          (seen.has(key) || existing.has(key)
            ? "Evento já registrado. Use a ficha do evento para corrigir."
            : "");
    seen.add(key);
    return {
      line: index + 2,
      row,
      error,
      issue: matchesResult(data, row).issue,
    };
  });
}
