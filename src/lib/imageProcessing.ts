// Client-side image enhancement for scanned / photographed charts and scales.
// Heavy OpenCV work runs in a Web Worker (public/opencv-worker.js) so the page
// stays responsive. OCR uses Tesseract.js, which runs in its own worker too.

export const TESSERACT_URL =
  "https://cdn.jsdelivr.net/npm/tesseract.js@4.1.4/dist/tesseract.min.js";

const WORKER_URL = "/opencv-worker.js";
const WORKING_MAX = 1600; // longest side used for analysis
const OUTPUT_MAX = 5200; // hard cap for the rendered result

export type EnhanceMode = "cleanup" | "reconstruct";

export interface EnhanceOptions {
  mode: EnhanceMode;
  upscale: number; // 1..4
  method: "adaptive" | "otsu";
  blockSize: number; // adaptive threshold window, odd
  threshold: number; // adaptive threshold constant C
  denoise: number; // 0..3
  deskew: boolean;
  ocr: boolean;
  ocrLang: string;
  lineThickness: number; // reconstruct: stroke width in output pixels
  minLineLength: number; // reconstruct: shortest line segment to keep
}

export const DEFAULT_OPTIONS: EnhanceOptions = {
  mode: "cleanup",
  upscale: 2,
  method: "adaptive",
  blockSize: 35,
  threshold: 12,
  denoise: 1,
  deskew: true,
  ocr: true,
  ocrLang: "deu+eng",
  lineThickness: 3,
  minLineLength: 40,
};

export interface EnhanceResult {
  canvas: HTMLCanvasElement;
  notes: string[];
}

type StatusFn = (message: string, progress?: number) => void;

interface ImageBuffer {
  buffer: ArrayBuffer;
  width: number;
  height: number;
}

interface AxisLine {
  lo: number;
  hi: number;
  pos: number;
}

interface DetectedLines {
  horizontals: AxisLine[];
  verticals: AxisLine[];
  diagonals: { x1: number; y1: number; x2: number; y2: number }[];
}

interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

declare global {
  interface Window {
    Tesseract?: any;
  }
}

// --- worker management --------------------------------------------------------

interface PendingJob {
  resolve: (msg: any) => void;
  reject: (err: Error) => void;
  onStatus: StatusFn;
}

let worker: Worker | null = null;
let jobSeq = 0;
const pending = new Map<number, PendingJob>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(WORKER_URL);
  w.onmessage = (event: MessageEvent) => {
    const msg = event.data;
    if (!msg || !msg.type) return;
    if (msg.type === "ready") return;
    const job = typeof msg.id === "number" ? pending.get(msg.id) : undefined;
    if (msg.type === "progress") {
      if (job) job.onStatus(msg.message);
      return;
    }
    if (msg.type === "result") {
      if (job) {
        pending.delete(msg.id);
        job.resolve(msg);
      }
      return;
    }
    if (msg.type === "error") {
      if (job) {
        pending.delete(msg.id);
        job.reject(new Error(msg.message || "Unbekannter Fehler im Worker."));
      }
      return;
    }
  };
  w.onerror = () => {
    pending.forEach((job) =>
      job.reject(new Error("Der Bildverarbeitungs-Worker ist abgestürzt."))
    );
    pending.clear();
    worker = null;
  };
  worker = w;
  return w;
}

// Warm up the worker (and OpenCV.js inside it) ahead of time.
export function prepareEnhancer(): void {
  try {
    getWorker().postMessage({ type: "init" });
  } catch {
    /* surfaced later when the user starts processing */
  }
}

// --- Tesseract loading --------------------------------------------------------

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const selector = `script[data-lib-src="${src}"]`;
    const existing = document.querySelector<HTMLScriptElement>(selector);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Skript konnte nicht geladen werden: " + src))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.libSrc = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () =>
      reject(new Error("Skript konnte nicht geladen werden: " + src))
    );
    document.head.appendChild(script);
  });
}

let tesseractPromise: Promise<any> | null = null;

function loadTesseract(): Promise<any> {
  if (tesseractPromise) return tesseractPromise;
  tesseractPromise = (async () => {
    await loadScript(TESSERACT_URL);
    if (!window.Tesseract) {
      throw new Error("Tesseract.js konnte nicht geladen werden.");
    }
    return window.Tesseract;
  })();
  return tesseractPromise;
}

// --- helpers ------------------------------------------------------------------

function makeWorkingCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const maxDim = Math.max(source.width, source.height);
  const scale = maxDim > WORKING_MAX ? WORKING_MAX / maxDim : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function clampUpscale(width: number, height: number, requested: number): number {
  const maxDim = Math.max(width, height);
  let upscale = requested;
  if (maxDim * upscale > OUTPUT_MAX) upscale = OUTPUT_MAX / maxDim;
  return Math.max(1, upscale);
}

function imageBufferToCanvas(img: ImageBuffer): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  const data = new ImageData(
    new Uint8ClampedArray(img.buffer),
    img.width,
    img.height
  );
  ctx.putImageData(data, 0, 0);
  return canvas;
}

async function runOcr(
  canvas: HTMLCanvasElement,
  lang: string,
  onProgress: (progress: number) => void
): Promise<OcrWord[]> {
  const Tesseract = await loadTesseract();
  const { data } = await Tesseract.recognize(canvas, lang, {
    logger: (m: any) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress(m.progress);
      }
    },
  });
  const words: OcrWord[] = data && data.words ? data.words : [];
  return words
    .filter((w) => w.text && w.text.trim() && w.confidence >= 45)
    .map((w) => ({
      text: w.text.trim(),
      confidence: w.confidence,
      bbox: w.bbox,
    }));
}

function renderReconstruct(
  workWidth: number,
  workHeight: number,
  upscale: number,
  detected: DetectedLines,
  words: OcrWord[],
  opts: EnhanceOptions
): HTMLCanvasElement {
  const width = Math.round(workWidth * upscale);
  const height = Math.round(workHeight * upscale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#000000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const thickness = Math.max(1, opts.lineThickness);
  ctx.lineWidth = thickness;
  for (const h of detected.horizontals) {
    ctx.beginPath();
    ctx.moveTo(h.lo * upscale, h.pos * upscale);
    ctx.lineTo(h.hi * upscale, h.pos * upscale);
    ctx.stroke();
  }
  for (const v of detected.verticals) {
    ctx.beginPath();
    ctx.moveTo(v.pos * upscale, v.lo * upscale);
    ctx.lineTo(v.pos * upscale, v.hi * upscale);
    ctx.stroke();
  }
  ctx.lineWidth = Math.max(1, thickness * 0.85);
  for (const d of detected.diagonals) {
    ctx.beginPath();
    ctx.moveTo(d.x1 * upscale, d.y1 * upscale);
    ctx.lineTo(d.x2 * upscale, d.y2 * upscale);
    ctx.stroke();
  }

  if (words.length) {
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "alphabetic";
    for (const word of words) {
      const boxWidth = Math.max(1, word.bbox.x1 - word.bbox.x0);
      const boxHeight = Math.max(1, word.bbox.y1 - word.bbox.y0);
      const fontSize = Math.max(7, boxHeight * 0.92 * upscale);
      ctx.font = `${fontSize}px Arial, "Helvetica Neue", sans-serif`;
      const x = word.bbox.x0 * upscale;
      const y = word.bbox.y1 * upscale - boxHeight * 0.14 * upscale;
      ctx.fillText(word.text, x, y, boxWidth * upscale * 1.08);
    }
  }
  return canvas;
}

// --- main entry point ---------------------------------------------------------

export async function enhanceImage(
  source: HTMLCanvasElement,
  opts: EnhanceOptions,
  onStatus: StatusFn
): Promise<EnhanceResult> {
  const work = makeWorkingCanvas(source);
  const upscale = clampUpscale(work.width, work.height, opts.upscale);
  const notes: string[] = [];
  if (upscale < opts.upscale - 0.01) {
    notes.push(
      `Skalierung auf ${upscale.toFixed(1)}× begrenzt (max. ${OUTPUT_MAX} px Kantenlänge).`
    );
  }

  const imageData = work
    .getContext("2d")!
    .getImageData(0, 0, work.width, work.height);

  const w = getWorker();
  const id = ++jobSeq;
  const workerResult: any = await new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onStatus });
    const buffer = imageData.data.buffer;
    w.postMessage(
      {
        type: "process",
        id,
        mode: opts.mode,
        options: opts,
        upscale,
        image: { buffer, width: imageData.width, height: imageData.height },
      },
      [buffer]
    );
  });

  const allNotes = notes.concat(workerResult.notes || []);

  if (workerResult.mode === "cleanup") {
    onStatus("Fertig.", 1);
    return { canvas: imageBufferToCanvas(workerResult.image), notes: allNotes };
  }

  const binaryCanvas = imageBufferToCanvas(workerResult.binary);
  let words: OcrWord[] = [];
  if (opts.ocr) {
    onStatus("Text wird erkannt … 0 %");
    try {
      words = await runOcr(binaryCanvas, opts.ocrLang, (progress) =>
        onStatus(`Text wird erkannt … ${Math.round(progress * 100)} %`, progress)
      );
      allNotes.push(`${words.length} Textfragmente erkannt und neu gesetzt.`);
    } catch {
      allNotes.push(
        "Texterkennung übersprungen – die OCR-Daten konnten nicht geladen werden (Netzwerk?)."
      );
    }
  }

  onStatus("Bild wird neu gezeichnet …");
  const canvas = renderReconstruct(
    workerResult.binary.width,
    workerResult.binary.height,
    upscale,
    workerResult.lines,
    words,
    opts
  );
  onStatus("Fertig.", 1);
  return { canvas, notes: allNotes };
}
