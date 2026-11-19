import type { Counts, Measurement, Portfolio } from "./model";
import { monday, measureFor, profileFor, today } from "./model";

export type MeasureInput = Pick<
  Measurement,
  "company" | "week" | "counts" | "source"
>;
const columns = [
  "conta_id",
  "semana",
  "contatos",
  "qualificados",
  "agendados",
  "realizados",
  "fonte",
];
export const csvTemplate = columns.join(";") + "\r\n";
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function measureIssue(row: MeasureInput, data: Portfolio) {
  if (!profileFor(data, row.company))
    return "Configure a conta antes de registrar indicadores.";
  if (
    !validDate(row.week) ||
    monday(row.week) !== row.week ||
    row.week >= monday(today())
  )
    return "Use a segunda-feira de uma semana completa.";
  if (row.counts.every((v) => v === null))
    return "Informe pelo menos uma contagem.";
  if (
    row.counts.some(
      (v) => v !== null && (!Number.isInteger(v) || v < 0 || v > 1e9),
    )
  )
    return "Use contagens inteiras de 0 a 1.000.000.000.";
  if (!row.source.trim() || row.source.length > 240)
    return "Informe uma fonte de até 240 caracteres.";
  return "";
}

function parse(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const field = () => {
    row.push(cell.trim());
    cell = "";
    closed = false;
  };
  const line = () => {
    field();
    if (row.some(Boolean)) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === delimiter) field();
    else if (c === "\n") line();
    else if (c === "\r") {
      if (text[i + 1] !== "\n") line();
    } else if (c === '"' && !cell && !closed) quoted = true;
    else if (!closed) cell += c;
    else if (c.trim()) throw Error("Há um campo com aspas mal fechadas.");
  }
  if (quoted) throw Error("Há um campo com aspas mal fechadas.");
  line();
  return rows;
}
export function readCsv(text: string, columns: string[]) {
  if (text.length > 100_000) throw Error("Use um CSV de até 100 KB.");
  const clean = text.replace(/^\uFEFF/, ""),
    delimiter = clean.split(/\r?\n/, 1)[0].includes(";") ? ";" : ",";
  const [header, ...rows] = parse(clean, delimiter);
  if (!header || header.join("|") !== columns.join("|"))
    throw Error("Use o cabeçalho do arquivo modelo.");
  return rows;
}
export function previewCsv(text: string, data: Portfolio) {
  const rows = readCsv(text, columns);
  if (!rows.length || rows.length > 50)
    throw Error("Inclua de 1 a 50 medições por arquivo.");
  const seen = new Set<string>();
  return rows.map((cells, index) => {
    const [company, week, ...rest] = cells;
    const counts = rest
      .slice(0, 4)
      .map((v) =>
        v === "" ? null : /^\d+$/.test(v) ? Number(v) : NaN,
      ) as Counts;
    const row = { company, week, counts, source: rest[4] || "" };
    const key = company + "\n" + week;
    const error =
      cells.length !== 7
        ? "São esperadas sete colunas."
        : seen.has(key)
          ? "Conta e semana duplicadas no arquivo."
          : measureIssue(row, data);
    seen.add(key);
    return {
      line: index + 2,
      row,
      error,
      replace: !!measureFor(data, company, week),
    };
  });
}
