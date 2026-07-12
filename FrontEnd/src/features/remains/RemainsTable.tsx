import { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { fetchRemains } from "./remainsSlice";
import { renderCell, formatColumnName } from "../nomenclature/format";
import { TableSkeleton } from "../../components/TableSkeleton";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";

export function RemainsTable() {
  const dispatch = useAppDispatch();
  const { items, status, error } = useAppSelector((state) => state.remains);

  // Своя начальная загрузка при открытии страницы
  useEffect(() => {
    dispatch(fetchRemains());
  }, [dispatch]);

  const columns = useMemo(
    () => (items.length > 0 ? Object.keys(items[0]) : []),
    [items],
  );

  const { visibleItems, sentinelRef } = useInfiniteScroll(items);

  const isLoading = status === "loading";
  const hasData = items.length > 0;
  const showSkeleton = isLoading && !hasData;
  const isRefreshing = isLoading && hasData;

  return (
    <div className="page">
      <h2 className="table-title">Остатки</h2>

      {status === "failed" && <div className="error-box">{error}</div>}

      {showSkeleton && <TableSkeleton columnCount={5} />}

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
                    <th key={col}>{formatColumnName(col)}</th>
                  ))}
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

          <div className="table-footer">
            Показано {visibleItems.length} из {items.length}
          </div>
          <div ref={sentinelRef} className="scroll-sentinel" />

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
