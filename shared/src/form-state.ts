export type FormState<Field extends string> =
  | {
      success?: boolean;
      message?: string;
      errors?: Partial<Record<Field, string[]>>;
      values?: Partial<Record<Field, string>>;
    }
  | undefined;

export function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
