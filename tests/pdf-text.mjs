// Reads the text of a PDF drawn by the app (backend/src/reports/statement-pdf.ts), page by page, so tests can
// check what a statement says. It understands what pdfkit writes: Flate streams, fonts with a ToUnicode map
// and two-byte character codes shown with Tj/TJ. One line of output per text object (each piece of text the
// app draws), in drawing order. Not a general PDF reader.
import { inflateSync } from "node:zlib";

function objects(pdf) {
  const text = pdf.toString("latin1");
  const found = new Map();
  const re = /(\d+) 0 obj\s*<<([\s\S]*?)>>\s*(stream\r?\n)?/g;
  let match;
  while ((match = re.exec(text))) {
    let stream = null;
    if (match[3]) {
      const start = match.index + match[0].length;
      const end = text.indexOf("endstream", start);
      stream = pdf.subarray(start, end);
      if (/\/FlateDecode/.test(match[2])) {
        try {
          stream = inflateSync(stream);
        } catch {
          stream = null;
        }
      }
    }
    found.set(match[1], { dict: match[2], stream });
  }
  return found;
}

// code (hex, 4 digits) -> text, from a ToUnicode CMap.
function toUnicode(cmap) {
  const map = new Map();
  const hex = (value) => String.fromCodePoint(...(value.match(/.{4}/g) ?? []).map((unit) => parseInt(unit, 16)));
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const range of block[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*(\[[^\]]*\]|<[0-9a-f]+>)/gi)) {
      const first = parseInt(range[1], 16);
      const last = parseInt(range[2], 16);
      if (range[3].startsWith("[")) {
        [...range[3].matchAll(/<([0-9a-f]+)>/gi)].forEach((target, offset) => map.set(first + offset, hex(target[1])));
      } else {
        const base = parseInt(range[3].slice(1, -1), 16);
        for (let code = first; code <= last; code++) map.set(code, String.fromCodePoint(base + code - first));
      }
    }
  }
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) map.set(parseInt(pair[1], 16), hex(pair[2]));
  }
  return map;
}

// Returns one string per page: the page's pieces of text, one per line.
export function pdfText(buffer) {
  const all = objects(buffer);
  const fonts = new Map();
  for (const object of all.values()) {
    for (const entry of object.dict.matchAll(/\/(F\d+)\s+(\d+) 0 R/g)) {
      const font = all.get(entry[2]);
      const cmapRef = font?.dict.match(/\/ToUnicode\s+(\d+) 0 R/)?.[1];
      const cmap = cmapRef && all.get(cmapRef)?.stream;
      if (cmap && !fonts.has(entry[1])) fonts.set(entry[1], toUnicode(cmap.toString("latin1")));
    }
  }
  const pages = [...all.values()].filter((object) => /\/Type\s*\/Page\b/.test(object.dict));
  return pages.map((page) => {
    const contents = all.get(page.dict.match(/\/Contents\s+(\d+) 0 R/)?.[1] ?? "")?.stream?.toString("latin1") ?? "";
    const lines = [];
    for (const block of contents.matchAll(/BT([\s\S]*?)ET/g)) {
      let font = null;
      let line = "";
      for (const token of block[1].matchAll(/\/(F\d+)\s+[\d.]+\s+Tf|<([0-9a-f]*)>|\(([^)]*)\)/gi)) {
        if (token[1]) font = fonts.get(token[1]) ?? null;
        else if (token[2] !== undefined && font) {
          for (const code of token[2].match(/.{4}/g) ?? []) line += font.get(parseInt(code, 16)) ?? "";
        }
      }
      if (line) lines.push(line);
    }
    return lines.join("\n");
  });
}
