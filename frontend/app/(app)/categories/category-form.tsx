"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CATEGORY_ICON_NAMES } from "@fm/shared/category-icons";
import { CATEGORY_TYPE_LABELS } from "@fm/shared/labels";
import type { CategoryFormState } from "@/app/actions/categories";
import { CategoryIcon } from "@/components/category-icon";
import { FieldError } from "@/components/field-error";
import { FormMessage } from "@/components/form-message";
import { useI18n } from "@/components/i18n-provider";
import { NativeSelect } from "@/components/native-select";
import { FormNavigationMarker } from "@/components/navigation-pending";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CategoryTypeKey = keyof typeof CATEGORY_TYPE_LABELS;
export type ParentOption = { id: string; name: string; type: CategoryTypeKey };

type Props = {
  action: (state: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
  mode: "create" | "edit";
  defaults: { name: string; type: string; icon: string; color: string; parentId?: string; systemKey?: string };
  // Present for user categories; system categories are always top-level.
  parents?: ParentOption[];
  // Present for system categories only.
  withSystemKey?: boolean;
  cancelHref: string;
};

export function CategoryForm({ action, mode, defaults, parents, withSystemKey, cancelHref }: Props) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, undefined);
  const values = { ...defaults, ...state?.values };
  const types = Object.keys(CATEGORY_TYPE_LABELS) as CategoryTypeKey[];

  return (
    <form action={formAction} className="grid gap-4">
      {mode === "edit" && <FormNavigationMarker />}
      <FormMessage message={state?.message} />
      {state?.success && (
        <p role="status" className="text-sm text-muted-foreground">{t("Đã tạo danh mục.")}</p>
      )}

      {withSystemKey && (
        <div className="grid gap-2">
          <Label htmlFor="systemKey">{t("Mã")}</Label>
          <Input
            id="systemKey"
            name={mode === "create" ? "systemKey" : undefined}
            required
            maxLength={40}
            placeholder="vi_du: pets"
            defaultValue={values.systemKey}
            disabled={mode === "edit"}
            readOnly={mode === "edit"}
            aria-invalid={Boolean(state?.errors?.systemKey)}
            aria-describedby="systemKey-hint systemKey-error"
          />
          <p id="systemKey-hint" className="text-xs text-muted-foreground">{t("Dùng để dịch tên sang ngôn ngữ khác. Không đổi được sau khi tạo.")}</p>
          <FieldError id="systemKey-error" messages={state?.errors?.systemKey} />
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="name">{t("Tên danh mục")}</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={40}
          placeholder={t("Ví dụ: Cà phê")}
          defaultValue={values.name}
          aria-invalid={Boolean(state?.errors?.name)}
          aria-describedby="name-error"
        />
        <FieldError id="name-error" messages={state?.errors?.name} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="type">{t("Nhóm")}</Label>
        {mode === "create" ? (
          <NativeSelect
            id="type"
            name="type"
            key={values.type}
            defaultValue={values.type}
            aria-invalid={Boolean(state?.errors?.type)}
            aria-describedby="type-error"
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {t(CATEGORY_TYPE_LABELS[type])}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <>
            <Input
              id="type"
              value={t(CATEGORY_TYPE_LABELS[values.type as CategoryTypeKey])}
              disabled
              readOnly
              aria-describedby="type-hint"
            />
            <p id="type-hint" className="text-xs text-muted-foreground">{t("Không đổi được nhóm sau khi tạo danh mục.")}</p>
          </>
        )}
        <FieldError id="type-error" messages={state?.errors?.type} />
      </div>

      {parents && parents.length > 0 && (
        <div className="grid gap-2">
          <Label htmlFor="parentId">{t("Danh mục cha")}</Label>
          <NativeSelect
            id="parentId"
            name="parentId"
            key={values.parentId}
            defaultValue={values.parentId ?? ""}
            aria-invalid={Boolean(state?.errors?.parentId)}
            aria-describedby="parentId-hint parentId-error"
          >
            <option value="">{t("Không có (danh mục gốc)")}</option>
            {mode === "create"
              ? types.map((type) => (
                  <optgroup key={type} label={t(CATEGORY_TYPE_LABELS[type])}>
                    {parents
                      .filter((parent) => parent.type === type)
                      .map((parent) => (
                        <option key={parent.id} value={parent.id}>
                          {t(parent.name)}
                        </option>
                      ))}
                  </optgroup>
                ))
              : parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {t(parent.name)}
                  </option>
                ))}
          </NativeSelect>
          {mode === "create" && (
            <p id="parentId-hint" className="text-xs text-muted-foreground">{t("Danh mục cha phải cùng nhóm với danh mục đang tạo.")}</p>
          )}
          <FieldError id="parentId-error" messages={state?.errors?.parentId} />
        </div>
      )}

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t("Biểu tượng")}</legend>
        <div key={values.icon} className="flex flex-wrap gap-1.5">
          {CATEGORY_ICON_NAMES.map((icon) => (
            <label key={icon} className="cursor-pointer">
              <input
                type="radio"
                name="icon"
                value={icon}
                defaultChecked={icon === values.icon}
                aria-label={icon}
                className="peer sr-only"
              />
              <span className="flex size-9 items-center justify-center rounded-md border text-muted-foreground peer-checked:border-primary peer-checked:bg-accent peer-checked:text-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50">
                <CategoryIcon name={icon} className="size-4" />
              </span>
            </label>
          ))}
        </div>
        <FieldError id="icon-error" messages={state?.errors?.icon} />
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="color">{t("Màu")}</Label>
        <Input
          id="color"
          name="color"
          type="color"
          key={values.color}
          defaultValue={values.color}
          className="w-16 p-1"
          aria-describedby="color-error"
        />
        <FieldError id="color-error" messages={state?.errors?.color} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("Đang lưu...") : mode === "create" ? t("Thêm danh mục") : t("Lưu thay đổi")}
        </Button>
        {mode === "edit" && (
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>{t("Hủy")}</Link>
        )}
      </div>
    </form>
  );
}
