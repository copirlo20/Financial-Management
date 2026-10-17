// Runs in the browser before the app becomes interactive (Next.js convention: instrumentation-client.ts).
//
// Chrome on iPhone marks the page for its autofill before React takes over: __gcrremoteframetoken on
// <html>, __gcruniqueid on every form and field. React then reports "A tree hydrated but some attributes
// of the server rendered HTML didn't match" on every page opened from such a phone, and in development
// Next.js copies that into the terminal. Nothing is wrong (React leaves the attributes alone and the page
// works), so in development that one warning is dropped, but only when those attributes are the whole
// difference: any other mismatch is still reported. Production builds of React do not log it at all.
const HYDRATION_ATTRIBUTES_WARNING = "A tree hydrated but some attributes of the server rendered HTML";
const HYDRATION_LINK = "https://react.dev/link/hydration-mismatch";
const INJECTED_ATTRIBUTE = /\s__gcr[a-z]*=/i;

function onlyInjectedAttributes(args: unknown[]): boolean {
  if (typeof args[0] !== "string" || !args[0].startsWith(HYDRATION_ATTRIBUTES_WARNING)) return false;
  // React passes the sentence, the link and the diff as separate arguments (or, once formatted, as one
  // text). The diff comes after the link; its changed lines start with "-" (in the HTML) or "+" (what
  // React expected). The sentence before it has a "- " list of its own, which must not count.
  const text = args.filter((arg): arg is string => typeof arg === "string").join("\n");
  const link = text.indexOf(HYDRATION_LINK);
  if (link < 0) return false;
  const changed = text.slice(link + HYDRATION_LINK.length).split("\n").filter((line) => /^[+-]/.test(line));
  return changed.length > 0 && changed.every((line) => INJECTED_ATTRIBUTE.test(line));
}

// The filter has to stay the outermost console.error. Next.js replaces console.error after this file has
// run, with a function that sends every error to the terminal and the error overlay before calling what
// it found there, so a filter left underneath would only act once the warning is already out. Instead,
// whatever is assigned to console.error later becomes the next step behind the filter. Next.js took the
// filter itself as its "original", so when that call comes back round it goes straight to the browser's.
if (process.env.NODE_ENV === "development") {
  const browserConsoleError = console.error;
  let next = browserConsoleError;
  let depth = 0;
  const filtered = (...args: unknown[]) => {
    if (depth > 0) return browserConsoleError.apply(console, args);
    if (onlyInjectedAttributes(args)) return;
    depth++;
    try {
      next.apply(console, args);
    } finally {
      depth--;
    }
  };
  Object.defineProperty(console, "error", {
    configurable: true,
    enumerable: true,
    get: () => filtered,
    set: (replacement: typeof console.error) => {
      next = replacement;
    },
  });
}
