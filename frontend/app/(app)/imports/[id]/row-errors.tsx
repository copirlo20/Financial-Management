import type { Translate } from "@fm/shared/i18n/translate";
import type { StoredImportErrors } from "@fm/shared/imports";

// The rows of a statement that could not be read: for each, the reason and every value the row held, so
// it can be found in the statement and, if need be, entered by hand. Errors stored before rows kept their
// values come as plain text and are shown as such.
export function RowErrors({ errors, t }: { errors: StoredImportErrors | string; t: Translate }) {
  const heading = <h2 className="text-sm font-medium">{t("Các dòng không đọc được")}</h2>;
  if (typeof errors === "string") {
    return (
      <section className="grid gap-1">
        {heading}
        <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">{errors}</pre>
      </section>
    );
  }

  // One column per label, in the order they first appear (the file's own column order).
  const labels: string[] = [];
  for (const error of errors.rows) {
    for (const [label] of error.cells ?? []) if (!labels.includes(label)) labels.push(label);
  }
  return (
    <section className="grid gap-2">
      {heading}
      {labels.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("Mỗi dòng kèm lý do và toàn bộ dữ liệu của dòng đó trong file, để bạn đối chiếu với sao kê.")}
        </p>
      )}
      <div className="max-h-96 overflow-auto rounded-md border">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th scope="col" className="px-2 py-1.5 font-medium whitespace-nowrap">{t("Dòng")}</th>
              <th scope="col" className="px-2 py-1.5 font-medium whitespace-nowrap">{t("Lý do")}</th>
              {labels.map((label) => (
                <th key={label} scope="col" className="px-2 py-1.5 font-medium whitespace-nowrap">{t(label)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {errors.rows.map((error) => {
              const values = new Map(error.cells ?? []);
              return (
                <tr key={error.row} className="border-t align-top">
                  <td className="px-2 py-1.5 tabular-nums">{error.row}</td>
                  <td className="min-w-40 px-2 py-1.5 text-destructive">{t(error.message)}</td>
                  {labels.map((label) => (
                    <td key={label} className="max-w-64 min-w-20 px-2 py-1.5 wrap-anywhere">{values.get(label) ?? ""}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {errors.more > 0 && <p className="text-xs text-muted-foreground">{t("… và {0} dòng khác.", errors.more)}</p>}
    </section>
  );
}
