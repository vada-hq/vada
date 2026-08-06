import type { ReactNode } from "react";

import { cn } from "../../lib/cn";

export interface DataTableColumn<Row> {
  align?: "start" | "end";
  cell: (row: Row) => ReactNode;
  header: string;
  key: string;
}

/**
 * 와이어프레임의 표 위계를 한 곳에 둔다. 열 머리글과 셀 여백, 정렬 규칙을
 * 화면마다 다시 정의하지 않는다.
 */
export function DataTable<Row>({
  columns,
  label,
  rowKey,
  rows,
}: {
  columns: Array<DataTableColumn<Row>>;
  label: string;
  rowKey: (row: Row) => string;
  rows: Row[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table aria-label={label} className="w-full text-body">
        <thead>
          <tr className="bg-muted text-left text-label text-muted-foreground">
            {columns.map((column) => (
              <th
                className={cn(
                  "px-cell-x py-cell-y font-medium",
                  column.align === "end" && "text-right",
                )}
                key={column.key}
                scope="col"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t border-border" key={rowKey(row)}>
              {columns.map((column) => (
                <td
                  className={cn(
                    "px-cell-x py-cell-y",
                    column.align === "end" && "text-right tabular-nums",
                  )}
                  key={column.key}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
