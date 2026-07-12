export function TableSkeleton({
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
