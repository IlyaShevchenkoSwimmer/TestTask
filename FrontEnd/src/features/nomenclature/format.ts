import type { JsonValue } from "./types";

// Проверяем, что строка похожа на дату/время из 1С: 2026-06-26T00:00:00
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE_TIME.test(value);
}

// "2026-06-26T00:00:00" -> "26.06.2026"
export function formatDate(iso: string): string {
  const datePart = iso.slice(0, 10); // "2026-06-26"
  const [year, month, day] = datePart.split("-");
  return `${day}.${month}.${year}`;
}

// Тип колонки — нужен, чтобы выбрать правильный фильтр.
export type ColumnType = "boolean" | "number" | "date" | "text";

// Определяем тип по первому НЕ-null значению в колонке
// (в первой строке значение может оказаться null).
export function detectColumnType(
  items: Record<string, JsonValue>[],
  col: string,
): ColumnType {
  for (const item of items) {
    const v = item[col];
    if (v === null || v === undefined) continue;
    if (typeof v === "boolean") return "boolean";
    if (typeof v === "number") return "number";
    if (isIsoDateTime(v)) return "date";
    return "text";
  }
  return "text";
}

// Имя колонки для отображения: подчёркивания -> пробелы.
// Используется ТОЛЬКО для подписи в шапке, не для доступа к данным.
export function formatColumnName(col: string): string {
  return col.replace(/_/g, " ");
}
