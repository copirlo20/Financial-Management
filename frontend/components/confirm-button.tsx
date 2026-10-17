"use client";

import { LogOut, Trash2, TriangleAlert, Undo2, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogSubject,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// By name, not as a component: pages (Server Components) cannot pass a function to a client component.
const ICONS: Record<string, LucideIcon> = { trash: Trash2, undo: Undo2, logout: LogOut, warning: TriangleAlert };

type Props = Omit<React.ComponentProps<typeof Button>, "type" | "onClick"> & {
  // The question, short: the dialog's title ("Xóa giao dịch này?").
  confirmMessage: string;
  // What the question is about, when it has a name worth showing (a file, a category, a goal).
  confirmSubject?: string;
  // What follows from going ahead. Defaults to "this cannot be undone".
  confirmDetail?: string;
  // The button that goes ahead. Defaults to "Xác nhận".
  confirmLabel?: string;
  // The picture in the dialog's round badge. Defaults to a warning sign.
  confirmIcon?: keyof typeof ICONS;
  // "destructive" (red) for something that cannot be taken back, "default" for something that only needs a yes.
  confirmTone?: "destructive" | "default";
};

// Submit button that asks in a modal before a destructive action, then submits its form as it would have.
// Without JavaScript it submits directly.
export function ConfirmButton({
  confirmMessage,
  confirmSubject,
  confirmDetail,
  confirmLabel,
  confirmIcon = "warning",
  confirmTone = "destructive",
  ...props
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const Icon = ICONS[confirmIcon] ?? TriangleAlert;

  return (
    <>
      <Button
        ref={button}
        type="submit"
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
        {...props}
      />
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent data-testid="confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogIcon tone={confirmTone}>
              <Icon />
            </AlertDialogIcon>
            <AlertDialogBody>
              <AlertDialogTitle>{confirmMessage}</AlertDialogTitle>
              <AlertDialogDescription>{confirmDetail ?? t("Thao tác này không thể hoàn tác.")}</AlertDialogDescription>
              {confirmSubject && <AlertDialogSubject>{confirmSubject}</AlertDialogSubject>}
            </AlertDialogBody>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmTone === "destructive" ? "destructive" : "default"}
              // The dialog lives outside the form (in a portal), so the form is submitted on the button's
              // behalf: with it as the submitter, any name/value it carries goes along.
              onClick={() => button.current?.form?.requestSubmit(button.current)}
            >
              {confirmLabel ?? t("Xác nhận")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
