import type { ReactNode } from "react";

// The figures behind a chart, in a table the reader can open: exact amounts for anyone who wants them, and
// what a screen reader reads instead of the drawing. The first column names the row; the others are numbers.
export function ChartTable({
  summary,
  columns,
  rows,
}: {
  summary: string;
  columns: string[];
  rows: { key: string; cells: ReactNode[] }[];
}) {
  return (
    <details>
      <summary className="cursor-pointer py-1.5 text-sm text-muted-foreground">{summary}</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              {columns.map((column, index) => (
                <th key={column} scope="col" className={index === 0 ? "py-1 font-normal" : "py-1 text-right font-normal"}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, cells: [first, ...rest] }) => (
              <tr key={key} className="border-t">
                <th scope="row" className="py-1 text-left font-normal">{first}</th>
                {rest.map((cell, index) => (
                  <td key={index} className="py-1 text-right tabular-nums">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
