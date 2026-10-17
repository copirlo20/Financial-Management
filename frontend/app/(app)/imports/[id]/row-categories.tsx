"use client";

import { useI18n } from "@/components/i18n-provider";
import { NativeSelect } from "@/components/native-select";

type Option = { value: string; label: string };
export type ReviewRow = {
  rowNumber: number;
  date: string;
  amount: string;
  type: "EXPENSE" | "INCOME";
  description: string;
  categoryId: string; // the assistant's suggestion; "" when it had none
};

type Props = {
  rows: ReviewRow[];
  totalRows: number;
  expenseCategories: Option[];
  incomeCategories: Option[];
  // Picks from a submit that failed validation, so they are not lost when the form re-renders.
  picked?: Record<string, string>;
};

// One category select per row, submitted with the surrounding form as rowCategory-<row number>.
export function RowCategories({ rows, totalRows, expenseCategories, incomeCategories, picked }: Props) {
  const { t } = useI18n();
  if (rows.length === 0) return null;

  return (
    <div className="grid min-w-0 gap-2">
      <p className="text-sm font-medium">{t("Danh mục cho từng giao dịch")}</p>
      <p className="text-xs text-muted-foreground">
        {t("Trợ lý AI đề xuất danh mục theo diễn giải. Hãy sửa những dòng chưa đúng; dòng để trống dùng danh mục mặc định ở trên.")}
      </p>
      <div className="max-h-96 overflow-auto rounded-md border">
        <table className="w-full min-w-max text-left text-xs">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="px-2 py-1.5 font-medium">#</th>
              <th scope="col" className="px-2 py-1.5 font-medium">{t("Ngày")}</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">{t("Số tiền")}</th>
              <th scope="col" className="px-2 py-1.5 font-medium">{t("Diễn giải")}</th>
              <th scope="col" className="px-2 py-1.5 font-medium">{t("Danh mục")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const value = picked?.[String(row.rowNumber)] ?? row.categoryId;
              const options = row.type === "EXPENSE" ? expenseCategories : incomeCategories;
              return (
                <tr key={row.rowNumber} className="border-t">
                  <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{row.rowNumber}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{row.date}</td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                    {row.type === "EXPENSE" ? "−" : "+"}
                    {row.amount}
                  </td>
                  <td className="max-w-56 truncate px-2 py-1.5 whitespace-nowrap">{row.description}</td>
                  <td className="px-2 py-1.5">
                    <NativeSelect
                      name={`rowCategory-${row.rowNumber}`}
                      key={value}
                      defaultValue={value}
                      aria-label={t("Danh mục cho dòng {0}", row.rowNumber)}
                      className="h-8 w-56"
                    >
                      <option value="">{t("Theo danh mục mặc định")}</option>
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalRows > rows.length && (
        <p className="text-xs text-muted-foreground">
          {t("Đang hiện {0} trong {1} giao dịch. Các giao dịch còn lại dùng danh mục trợ lý AI đề xuất, hoặc danh mục mặc định nếu không có đề xuất.", rows.length, totalRows)}
        </p>
      )}
    </div>
  );
}
