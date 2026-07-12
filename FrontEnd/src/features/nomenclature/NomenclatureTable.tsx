import { useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import {
  fetchNomenclature,
  setSearchQuery,
  setColumnFilter,
  setNumericFilter,
  setDateFilter,
  clearFilters,
} from "./nomenclatureSlice";
import type { JsonValue } from "./types";
import {
  detectColumnType,
  formatDate,
  isIsoDateTime,
  type ColumnType,
} from "./format";
import "./NomenclatureTable.css";

// Сколько строк дорисовывать за одну «порцию»
const PAGE_SIZE = 50;

function renderCell(value: JsonValue): string {
  if (value === null) return "";
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (isIsoDateTime(value)) return formatDate(value);
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
  const {
    items,
    status,
    error,
    searchQuery,
    columnFilters,
    numericFilters,
    dateFilters,
  } = useAppSelector((state) => state.nomenclature);

  useEffect(() => {
    dispatch(fetchNomenclature());
  }, [dispatch]);

  const columns = useMemo(
    () => (items.length > 0 ? Object.keys(items[0]) : []),
    [items],
  );

  const columnTypes = useMemo(() => {
    const map: Record<string, ColumnType> = {};
    for (const col of columns) map[col] = detectColumnType(items, col);
    return map;
  }, [items, columns]);

  // --- Фильтрация ---
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const activeText = Object.entries(columnFilters).filter(([, v]) => v);
    const activeNumeric = Object.entries(numericFilters);
    const activeDate = Object.entries(dateFilters);

    return items.filter((item) => {
      // 1. Глобальный поиск
      if (query) {
        const matches = columns.some((col) =>
          renderCell(item[col]).toLowerCase().includes(query),
        );
        if (!matches) return false;
      }

      // 2. Текст / boolean
      for (const [col, value] of activeText) {
        if (columnTypes[col] === "boolean") {
          if (String(item[col]) !== value) return false;
        } else if (
          !renderCell(item[col]).toLowerCase().includes(value.toLowerCase())
        ) {
          return false;
        }
      }

      // 3. Числовые диапазоны
      for (const [col, range] of activeNumeric) {
        const v = item[col];
        const minNum = range.min !== "" ? Number(range.min) : null;
        const maxNum = range.max !== "" ? Number(range.max) : null;
        if (minNum !== null && !Number.isNaN(minNum)) {
          if (typeof v !== "number" || v < minNum) return false;
        }
        if (maxNum !== null && !Number.isNaN(maxNum)) {
          if (typeof v !== "number" || v > maxNum) return false;
        }
      }

      // 4. Диапазоны дат (сравниваем part "YYYY-MM-DD" как строки)
      for (const [col, range] of activeDate) {
        const v = item[col];
        if (!isIsoDateTime(v)) {
          if (range.from || range.to) return false;
          continue;
        }
        const datePart = v.slice(0, 10); // "2026-06-26"
        if (range.from && datePart < range.from) return false;
        if (range.to && datePart > range.to) return false;
      }

      return true;
    });
  }, [
    items,
    columns,
    columnTypes,
    searchQuery,
    columnFilters,
    numericFilters,
    dateFilters,
  ]);

  // --- Динамическая подгрузка при прокрутке ---
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Актуальное число отфильтрованных строк — в ref, чтобы избежать
  // «устаревшего» значения внутри колбэка наблюдателя.
  const totalRef = useRef(0);
  totalRef.current = filteredItems.length;

  // При смене результата фильтрации сбрасываем счётчик к первой порции.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filteredItems]);

  // IntersectionObserver: как только «маячок» внизу попал в зону видимости —
  // дорисовываем следующую порцию.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) =>
            Math.min(prev + PAGE_SIZE, totalRef.current),
          );
        }
      },
      { rootMargin: "300px" }, // начинаем подгружать чуть заранее
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [status]); // пере-подписываемся, когда таблица появляется/меняет состояние

  const visibleItems = filteredItems.slice(0, visibleCount);
  const hasMore = visibleCount < filteredItems.length;

  const handleRefresh = () => dispatch(fetchNomenclature());

  const isLoading = status === "loading";
  const hasData = items.length > 0;
  const showSkeleton = isLoading && !hasData;
  const isRefreshing = isLoading && hasData;

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    Object.keys(columnFilters).length > 0 ||
    Object.keys(numericFilters).length > 0 ||
    Object.keys(dateFilters).length > 0;

  return (
    <div className="page">
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
                <tr>
                  {columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
                <tr className="filter-row">
                  {columns.map((col) => {
                    const type = columnTypes[col];

                    // Числовой диапазон
                    if (type === "number") {
                      const range = numericFilters[col] ?? { min: "", max: "" };
                      return (
                        <th key={col}>
                          <div className="filter-range">
                            <input
                              className="filter-input filter-range-input"
                              type="number"
                              placeholder="От"
                              value={range.min}
                              onChange={(e) =>
                                dispatch(
                                  setNumericFilter({
                                    column: col,
                                    bound: "min",
                                    value: e.target.value,
                                  }),
                                )
                              }
                            />
                            <input
                              className="filter-input filter-range-input"
                              type="number"
                              placeholder="До"
                              value={range.max}
                              onChange={(e) =>
                                dispatch(
                                  setNumericFilter({
                                    column: col,
                                    bound: "max",
                                    value: e.target.value,
                                  }),
                                )
                              }
                            />
                          </div>
                        </th>
                      );
                    }

                    // Диапазон дат
                    if (type === "date") {
                      const range = dateFilters[col] ?? { from: "", to: "" };
                      return (
                        <th key={col}>
                          <div className="filter-range filter-range-date">
                            <input
                              className="filter-input filter-date-input"
                              type="date"
                              title="С"
                              value={range.from}
                              onChange={(e) =>
                                dispatch(
                                  setDateFilter({
                                    column: col,
                                    bound: "from",
                                    value: e.target.value,
                                  }),
                                )
                              }
                            />
                            <input
                              className="filter-input filter-date-input"
                              type="date"
                              title="По"
                              value={range.to}
                              onChange={(e) =>
                                dispatch(
                                  setDateFilter({
                                    column: col,
                                    bound: "to",
                                    value: e.target.value,
                                  }),
                                )
                              }
                            />
                          </div>
                        </th>
                      );
                    }

                    // Boolean
                    if (type === "boolean") {
                      return (
                        <th key={col}>
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
                        </th>
                      );
                    }

                    // Текст
                    return (
                      <th key={col}>
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
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item, rowIndex) => (
                  <tr key={rowIndex}>
                    {columns.map((col) => (
                      <td key={col}>{renderCell(item[col])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredItems.length === 0 && (
            <div className="no-results">
              Ничего не найдено по заданным условиям.
            </div>
          )}

          {/* Счётчик + «маячок» для подгрузки */}
          {filteredItems.length > 0 && (
            <div className="table-footer">
              Показано {visibleItems.length} из {filteredItems.length}
            </div>
          )}
          {/* невидимый элемент-триггер внизу таблицы */}
          <div ref={sentinelRef} className="scroll-sentinel" />
          {hasMore && <div className="loading-more">Загрузка…</div>}

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
