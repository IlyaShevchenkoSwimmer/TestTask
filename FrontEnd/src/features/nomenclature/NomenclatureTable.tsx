import { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  fetchNomenclature,
  setSearchQuery,
  setColumnFilter,
  clearFilters,
} from "./nomenclatureSlice";
import type { JsonValue } from "./types";
import "./NomenclatureTable.css";

function renderCell(value: JsonValue): string {
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// --- Скелетон (без изменений) ---
function TableSkeleton({
  columnCount,
  rowCount = 6,
}: {
  columnCount: number;
  rowCount?: number;
}) {
  const cols = Array.from({ length: columnCount });
  const rows = Array.from({ length: rowCount });
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {cols.map((_, i) => (
                <th key={i}>
                  <div className="skeleton-bar" style={{ width: "70%" }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((_, rowIndex) => (
              <tr key={rowIndex}>
                {cols.map((_, colIndex) => (
                  <td key={colIndex}>
                    <div
                      className="skeleton-bar"
                      style={{
                        width: `${60 + ((rowIndex + colIndex) % 4) * 10}%`,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NomenclatureTable() {
  const dispatch = useAppDispatch();
  const { items, status, error, searchQuery, columnFilters } = useAppSelector(
    (state) => state.nomenclature,
  );

  useEffect(() => {
    dispatch(fetchNomenclature());
  }, [dispatch]);

  const columns = useMemo(
    () => (items.length > 0 ? Object.keys(items[0]) : []),
    [items],
  );

  // Тип значения каждой колонки (по первому объекту) — для булевых делаем select.
  const columnTypes = useMemo(() => {
    const map: Record<string, string> = {};
    if (items.length > 0) {
      for (const col of columns) map[col] = typeof items[0][col];
    }
    return map;
  }, [items, columns]);

  // --- Фильтрация: глобальный поиск + фильтры по колонкам ---
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const activeFilters = Object.entries(columnFilters).filter(([, v]) => v);

    return items.filter((item) => {
      // 1. Глобальный поиск: хотя бы одна ячейка содержит подстроку
      if (query) {
        const matchesGlobal = columns.some((col) =>
          renderCell(item[col]).toLowerCase().includes(query),
        );
        if (!matchesGlobal) return false;
      }

      // 2. Фильтры по колонкам: должны совпасть ВСЕ активные
      for (const [col, value] of activeFilters) {
        if (columnTypes[col] === "boolean") {
          // value = 'true' | 'false', сравниваем точно
          if (String(item[col]) !== value) return false;
        } else {
          if (
            !renderCell(item[col]).toLowerCase().includes(value.toLowerCase())
          )
            return false;
        }
      }

      return true;
    });
  }, [items, columns, columnTypes, searchQuery, columnFilters]);

  const handleRefresh = () => dispatch(fetchNomenclature());

  const isLoading = status === "loading";
  const hasData = items.length > 0;
  const showSkeleton = isLoading && !hasData;
  const isRefreshing = isLoading && hasData;

  const hasActiveFilters =
    searchQuery.trim() !== "" || Object.keys(columnFilters).length > 0;

  return (
    <div className="page">
      {/* Панель управления */}
      <div className="toolbar">
        <input
          className="search-input"
          type="text"
          placeholder="🔍 Поиск по таблице…"
          value={searchQuery}
          onChange={(e) => dispatch(setSearchQuery(e.target.value))}
        />
        <button
          className="refresh-button"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          {isRefreshing ? "Обновление…" : "Обновить"}
        </button>
        {hasActiveFilters && (
          <button
            className="clear-button"
            onClick={() => dispatch(clearFilters())}
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      {status === "failed" && <div className="error-box">{error}</div>}

      {showSkeleton && <TableSkeleton columnCount={7} />}

      {!isLoading && status === "succeeded" && !hasData && (
        <p className="empty-box">Данных нет.</p>
      )}

      {hasData && (
        <div className="table-card">
          <div
            className={`table-scroll${isRefreshing ? " is-refreshing" : ""}`}
          >
            <table className="data-table">
              <thead>
                {/* Строка заголовков */}
                <tr>
                  {columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
                {/* Строка фильтров по колонкам */}
                <tr className="filter-row">
                  {columns.map((col) => (
                    <th key={col}>
                      {columnTypes[col] === "boolean" ? (
                        <select
                          className="filter-select"
                          value={columnFilters[col] ?? ""}
                          onChange={(e) =>
                            dispatch(
                              setColumnFilter({
                                column: col,
                                value: e.target.value,
                              }),
                            )
                          }
                        >
                          <option value="">Все</option>
                          <option value="true">Да</option>
                          <option value="false">Нет</option>
                        </select>
                      ) : (
                        <input
                          className="filter-input"
                          type="text"
                          placeholder="Фильтр…"
                          value={columnFilters[col] ?? ""}
                          onChange={(e) =>
                            dispatch(
                              setColumnFilter({
                                column: col,
                                value: e.target.value,
                              }),
                            )
                          }
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, rowIndex) => (
                  <tr key={rowIndex}>
                    {columns.map((col) => (
                      <td key={col}>{renderCell(item[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Сообщение, если фильтры ничего не нашли */}
          {filteredItems.length === 0 && (
            <div className="no-results">
              Ничего не найдено по заданным условиям.
            </div>
          )}

          {isRefreshing && (
            <div className="refresh-overlay">
              <div className="spinner" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
