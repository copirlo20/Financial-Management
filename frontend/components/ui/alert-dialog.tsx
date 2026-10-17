"use client"

import * as React from "react"
import { cn } from "cn"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"
import { buttonVariants } from "@/components/ui/button"

// A modal that asks the user to confirm or cancel (role="alertdialog"): focus stays inside it, Escape
// cancels, and clicking outside does nothing, so a destructive step is never taken by accident.
// On a computer it is a card in the middle of the screen; on a phone it is a sheet rising from the bottom,
// where the thumb is, with the main button on top.

function AlertDialog(props: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger(props: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
}

function AlertDialogPortal(props: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
}

function AlertDialogOverlay({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 backdrop-blur-[3px] dark:bg-black/65 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({ className, children, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "fixed z-50 grid gap-6 border bg-card p-6 shadow-2xl outline-none duration-200",
          // Phone: a sheet along the bottom edge.
          "max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-3xl max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
          // Computer: a card in the middle.
          "sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 max-sm:data-[state=open]:slide-in-from-bottom sm:data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 max-sm:data-[state=closed]:slide-out-to-bottom sm:data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {/* The grip of the sheet, only a hint on a phone. */}
        <span aria-hidden className="mx-auto -mt-2 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" />
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  )
}

// Icon (or any picture) on the left of the text on a computer, above it on a phone.
function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-4 sm:text-left", className)}
      {...props}
    />
  )
}

// The round badge that tells at a glance how serious the question is.
function AlertDialogIcon({
  tone = "destructive",
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: "destructive" | "default" }) {
  return (
    <span
      aria-hidden
      data-slot="alert-dialog-icon"
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-full [&_svg]:size-6",
        tone === "destructive"
          ? "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
          : "bg-accent text-primary",
        className
      )}
      {...props}
    />
  )
}

// The title and what goes with it, as one block next to the icon.
function AlertDialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-body" className={cn("grid min-w-0 gap-2", className)} {...props} />
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      // On a phone the main action is on top, as the two buttons are stacked.
      className={cn("flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg leading-snug font-semibold text-balance wrap-break-word", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-sm leading-relaxed text-muted-foreground text-pretty", className)}
      {...props}
    />
  )
}

// What the question is about (a file name, a category...), set apart so that a long name stays tidy.
function AlertDialogSubject({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="alert-dialog-subject"
      className={cn("rounded-lg border bg-muted/60 px-3 py-2 text-sm font-medium break-all text-foreground", className)}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> & { variant?: "default" | "destructive" }) {
  return (
    <AlertDialogPrimitive.Action
      data-slot="alert-dialog-action"
      className={cn(
        buttonVariants({ variant, size: "lg" }),
        // Explicit reds: the theme's own destructive colour is too pale on a dark page for white text.
        variant === "destructive" &&
          "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/40 dark:bg-red-600 dark:hover:bg-red-500",
        "max-sm:w-full sm:h-10 sm:min-w-24 sm:px-5",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      data-slot="alert-dialog-cancel"
      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "max-sm:w-full sm:h-10 sm:min-w-24 sm:px-5", className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogSubject,
  AlertDialogTitle,
  AlertDialogTrigger,
}
