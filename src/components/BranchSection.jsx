/*
  STEP 7 — BranchSection.jsx: props in, JSX out.
  The green-bolding business rule lives in JSX via a ternary —
  same logic as vanilla renderBranches(), zero getElementById.
*/
import { useContent } from "../ContentContext.jsx";

function BranchSection({ year }) {
  const { content } = useContent();
  const rows = content.branchStatsByYear[year] || [];

  return (
    <section className="branches" id="branches">
      <h2 className="section-title">Branch-wise Placement — {year}</h2>

      <div className="table-scroll">
        <table className="branch-table">
          <thead>
            <tr>
              <th scope="col">Branch</th>
              <th scope="col">Placement %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.branch}>
                <td>{row.branch}</td>
                <td>
                  {row.percent >= 90 ? (
                    <strong>{row.percent}%</strong>
                  ) : (
                    `${row.percent}%`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default BranchSection;
