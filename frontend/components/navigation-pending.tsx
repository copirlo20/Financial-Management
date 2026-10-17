"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useI18n } from "@/components/i18n-provider";

// Short navigations finish before this, so the skeleton never flashes for them.
const LINK_SHOW_AFTER_MS = 150;
// A form that fails validation answers quickly and stays on the page, so it gets more time before the
// skeleton covers it.
const FORM_SHOW_AFTER_MS = 400;
// Safety net: never leave the overlay up if a navigation is abandoned.
const GIVE_UP_AFTER_MS = 10_000;
const FORM_EVENT = "form-navigation-pending";

function isInternalNavigation(event: MouseEvent): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname + url.search !== window.location.pathname + window.location.search;
}

// A search form (next/form, or any GET form) about to load a different page of this site. Forms that run a
// Server Action are POST (or point at a "javascript:" placeholder) and are handled by FormNavigationMarker.
function isFormNavigation(event: SubmitEvent): boolean {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.method.toLowerCase() !== "get") return false;
  // A form that downloads a file (data-download) leaves the page where it is.
  if (form.hasAttribute("data-download")) return false;
  const action = new URL(event.submitter?.getAttribute("formaction") ?? form.action, window.location.href);
  if (action.origin !== window.location.origin || (form.target && form.target !== "_self")) return false;
  const query = new URLSearchParams(
    [...new FormData(form, event.submitter)].map(([key, value]) => [key, typeof value === "string" ? value : value.name]),
  ).toString();
  return action.pathname + (query ? `?${query}` : "") !== window.location.pathname + window.location.search;
}

// Place inside a <form> whose action ends in a redirect. While that action runs, the page-level skeleton
// is shown (after a short delay), and it goes away when the action answers: either the new page arrives
// or the form comes back with an error and stays where it is.
export function FormNavigationMarker() {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (!pending) return;
    window.dispatchEvent(new CustomEvent(FORM_EVENT, { detail: true }));
    return () => {
      window.dispatchEvent(new CustomEvent(FORM_EVENT, { detail: false }));
    };
  }, [pending]);

  return null;
}

// The skeleton itself. Built outside React on purpose (see PendingOverlay); the classes are the same
// Tailwind classes a component would use.
function createOverlay(label: string): HTMLDivElement {
  const overlay = document.createElement("div");
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-busy", "true");
  overlay.dataset.testid = "navigation-pending";
  overlay.className = "absolute inset-0 z-10 bg-background p-4 sm:p-6 lg:p-8";
  // Only the placeholder shapes pulse; the backdrop stays solid so the previous page does not show through.
  overlay.innerHTML =
    '<span class="sr-only"></span>' +
    '<div class="grid animate-pulse content-start gap-6">' +
    '<div class="h-8 w-48 rounded-md bg-border"></div>' +
    '<div class="grid gap-3 sm:grid-cols-3">' +
    '<div class="h-24 rounded-2xl bg-border"></div><div class="h-24 rounded-2xl bg-border"></div><div class="h-24 rounded-2xl bg-border"></div>' +
    "</div>" +
    '<div class="grid gap-3">' +
    '<div class="h-16 rounded-2xl bg-border"></div><div class="h-16 rounded-2xl bg-border"></div><div class="h-16 rounded-2xl bg-border"></div>' +
    "</div>" +
    "</div>";
  overlay.querySelector("span")!.textContent = label;
  return overlay;
}

// Shows and hides the skeleton by changing the DOM directly, not through React state. On Back/Forward
// to a page the router has to load again, React holds every update back until that page has arrived, so
// an overlay rendered by React would only appear once it is no longer needed.
function PendingOverlay() {
  const { t } = useI18n();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const location = `${pathname}?${search}`;
  const host = useRef<HTMLDivElement>(null);
  const label = useRef(t("Đang tải..."));
  // Told by React when another page is on screen (or the language changed).
  const settled = useRef<((location: string) => void) | null>(null);

  useEffect(() => {
    label.current = t("Đang tải...");
  }, [t]);

  useEffect(() => {
    settled.current?.(location);
  }, [location]);

  useEffect(() => {
    // The page on screen, which the navigation leaves; and whether a redirecting form is running.
    let shown = `${window.location.pathname}?${window.location.search.slice(1)}`;
    let leaving: string | null = null;
    let formPending = false;
    let overlay: HTMLDivElement | null = null;
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let giveUpTimer: ReturnType<typeof setTimeout> | undefined;

    const hide = () => {
      clearTimeout(showTimer);
      clearTimeout(giveUpTimer);
      showTimer = giveUpTimer = undefined;
      overlay?.remove();
      overlay = null;
    };
    const update = () => {
      const linkPending = leaving !== null && leaving === shown;
      if (!linkPending && !formPending) return hide();
      if (overlay || showTimer) return;
      showTimer = setTimeout(() => {
        showTimer = undefined;
        overlay = createOverlay(label.current);
        host.current?.append(overlay);
      }, linkPending ? LINK_SHOW_AFTER_MS : FORM_SHOW_AFTER_MS);
      giveUpTimer = setTimeout(() => {
        leaving = null;
        formPending = false;
        hide();
      }, GIVE_UP_AFTER_MS);
    };
    const leave = () => {
      leaving = shown;
      update();
    };

    settled.current = (location) => {
      shown = location;
      leaving = null;
      update();
    };
    const here = () => `${window.location.pathname}?${window.location.search.slice(1)}`;
    const onClick = (event: MouseEvent) => {
      if (isInternalNavigation(event)) leave();
    };
    const onSubmit = (event: SubmitEvent) => {
      if (isFormNavigation(event)) leave();
    };
    // Back/Forward to a page the router still holds is instant and ends before the overlay would show;
    // one it has to load again (after a change was saved, for instance) gets the skeleton like a link.
    const onHistory = () => {
      if (here() !== shown) leave();
    };
    const onForm = (event: Event) => {
      formPending = (event as CustomEvent<boolean>).detail;
      update();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("popstate", onHistory);
    window.addEventListener(FORM_EVENT, onForm);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("popstate", onHistory);
      window.removeEventListener(FORM_EVENT, onForm);
      settled.current = null;
      hide();
    };
  }, []);

  // display: contents, so the empty holder takes no room in the page layout; the overlay inside it is
  // positioned against <main>.
  return <div ref={host} className="contents" />;
}

// Skeleton shown over the page while a link, a search form, Back/Forward or a redirecting form is loading.
// Done on the client instead of with a route-level loading.tsx, which streams the real content hidden until
// JavaScript reveals it.
export function NavigationPending() {
  return (
    <Suspense fallback={null}>
      <PendingOverlay />
    </Suspense>
  );
}
