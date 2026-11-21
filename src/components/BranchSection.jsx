import { useContent } from "../ContentContext.jsx";

function formatPercent(value) {
  const num = Number(value ?? 0);
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function BranchSection({ year }) {
  const { content } = useContent();
  const rows = content.branchStatsByYear[year] || [];
  const totals = rows.reduce(
    (acc, row) => {
      const total = Number(row.totalStudents ?? 0);
      const placed = Number(row.placedStudents ?? 0);
      acc.total += total;
      acc.placed += placed;
      return acc;
    },
    { total: 0, placed: 0 },
  );
  const totalsPercent = totals.total > 0 ? (totals.placed / totals.total) * 100 : 0;
  const totalsUnplaced = Math.max(0, totals.total - totals.placed);

  return (
    <section className="branches" id="branches">
      <h2 className="section-title">Branch-wise Placement — {year}</h2>

      <div className="table-scroll">
        <table className="branch-table branch-placement-table">
          <thead>
            <tr>
              <th scope="col">Branch</th>
              <th scope="col">Total</th>
              <th scope="col">Placed</th>
              <th scope="col">Unplaced</th>
              <th scope="col">Placed %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const total = Number(row.totalStudents ?? 0);
              const placed = Number(row.placedStudents ?? 0);
              const unplaced = Number(row.unplacedStudents ?? Math.max(0, total - placed));
              const percent = Number(row.percent ?? 0);
              return (
                <tr key={row.branch}>
                  <td>{row.branch}</td>
                  <td>{total}</td>
                  <td>{placed}</td>
                  <td>{unplaced}</td>
                  <td>
                    <div className="branch-percent-cell">
                      <span className="branch-percent-label">{formatPercent(percent)}%</span>
                      <div
                        className="branch-progress"
                        role="progressbar"
                        aria-label={`${row.branch} placement`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.max(0, Math.min(100, percent))}
                      >
                        <div
                          className="branch-progress-fill"
                          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>{totals.total}</td>
              <td>{totals.placed}</td>
              <td>{totalsUnplaced}</td>
              <td>
                <div className="branch-percent-cell">
                  <span className="branch-percent-label">{formatPercent(totalsPercent)}%</span>
                  <div
                    className="branch-progress"
                    role="progressbar"
                    aria-label="Overall placement"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.max(0, Math.min(100, totalsPercent))}
                  >
                    <div
                      className="branch-progress-fill"
                      style={{ width: `${Math.max(0, Math.min(100, totalsPercent))}%` }}
                    />
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export default BranchSection;
