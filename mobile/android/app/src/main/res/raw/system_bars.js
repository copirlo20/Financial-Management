// Run by MainActivity after each page load: tells the app the colour at the top of the page, now and
// whenever it changes (dark theme switched, another page shown without a reload), so that the system bars
// can match it. The colour is read through a canvas, which turns any CSS colour (oklch, translucent) into RGB.
(() => {
  if (window.__systemBarsColour) return window.__systemBarsColour();
  const cap = window.Capacitor;
  if (!cap || typeof cap.nativePromise !== "function") return;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const probe = canvas.getContext("2d", { willReadFrequently: true });
  const rgba = (colour, base) => {
    probe.clearRect(0, 0, 1, 1);
    if (base) {
      probe.fillStyle = base;
      probe.fillRect(0, 0, 1, 1);
    }
    probe.fillStyle = colour;
    probe.fillRect(0, 0, 1, 1);
    return probe.getImageData(0, 0, 1, 1).data;
  };
  // The first element under the top edge that paints a background of its own, laid over the page's.
  const topColour = () => {
    const page = getComputedStyle(document.body).backgroundColor;
    for (let element = document.elementFromPoint(innerWidth / 2, 1); element; element = element.parentElement) {
      const colour = getComputedStyle(element).backgroundColor;
      if (rgba(colour)[3] > 0) return rgba(colour, rgba(page)[3] > 0 ? page : "#fff");
    }
    return rgba(page, "#fff");
  };

  let last = "";
  let timer;
  const report = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const [r, g, b] = topColour();
      const key = `${r},${g},${b}`;
      if (key === last) return;
      last = key;
      cap.nativePromise("SystemBarsColor", "set", { r, g, b }).catch(() => {});
    }, 120);
  };
  window.__systemBarsColour = report;
  new MutationObserver(report).observe(document.documentElement, { attributes: true, childList: true, subtree: true });
  addEventListener("transitionend", report);
  report();
})();
