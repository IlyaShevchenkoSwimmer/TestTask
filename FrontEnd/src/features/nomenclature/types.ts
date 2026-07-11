export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type NomenclatureItem = Record<string, JsonValue>;
export type NomenclatureResponse = NomenclatureItem[];

// Форма тела ответа при ошибке от бэкенда.
export interface ApiErrorResponse {
  error: string;
}
