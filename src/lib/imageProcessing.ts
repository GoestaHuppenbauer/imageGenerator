// Client-side image enhancement for scanned / photographed charts and scales.
// All processing runs in the browser: OpenCV.js for image operations and
// Tesseract.js for OCR, both loaded on demand from a CDN.

export const OPENCV_URL = "https://docs.opencv.org/4.x/opencv.js";
export const TESSERACT_URL =
  "https://cdn.jsdelivr.net/npm/tesseract.js@4.1.4/dist/tesseract.min.js";

const WORKING_MAX = 1800; // longest side used for analysis
const OUTPUT_MAX = 6000; // hard cap for the rendered result
const SNAP_TOL = 6; // degrees within which a line counts as horizontal/vertical

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

declare global {
  interface Window {
    cv?: any;
    Tesseract?: any;
  }
}

// --- script / library loading -------------------------------------------------

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

let cvPromise: Promise<any> | null = null;

export function loadOpenCv(): Promise<any> {
  if (cvPromise) return cvPromise;
  cvPromise = (async () => {
    await loadScript(OPENCV_URL);
    let cv: any = window.cv;
    if (cv && typeof cv.then === "function") cv = await cv;
    if (cv && cv.Mat) return cv;
    await new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const timer = setInterval(() => {
        const candidate = window.cv;
        if (candidate && candidate.Mat) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - started > 90000) {
          clearInterval(timer);
          reject(new Error("OpenCV.js konnte nicht initialisiert werden."));
        }
      }, 50);
      const candidate = window.cv;
      if (candidate && typeof candidate === "object") {
        candidate.onRuntimeInitialized = () => {
          clearInterval(timer);
          resolve();
        };
      }
    });
    cv = window.cv;
    if (cv && typeof cv.then === "function") cv = await cv;
    return cv;
  })();
  return cvPromise;
}

let tesseractPromise: Promise<any> | null = null;

export function loadTesseract(): Promise<any> {
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

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeWorkingCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const maxDim = Math.max(source.width, source.height);
  const scale = maxDim > WORKING_MAX ? WORKING_MAX / maxDim : 1;
  if (scale === 1) return source;
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

// --- OpenCV operations --------------------------------------------------------

function applyDenoise(cv: any, gray: any, level: number) {
  if (level <= 0) return;
  const diameter = level >= 3 ? 9 : level >= 2 ? 7 : 5;
  const sigma = level >= 3 ? 80 : level >= 2 ? 60 : 45;
  const tmp = new cv.Mat();
  cv.bilateralFilter(gray, tmp, diameter, sigma, sigma, cv.BORDER_DEFAULT);
  tmp.copyTo(gray);
  tmp.delete();
}

function detectSkew(cv: any, gray: any): number {
  const bin = new cv.Mat();
  cv.adaptiveThreshold(
    gray,
    bin,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    31,
    10
  );
  const lines = new cv.Mat();
  const minLen = Math.max(gray.cols, gray.rows) / 4;
  cv.HoughLinesP(bin, lines, 1, Math.PI / 180, 80, minLen, 20);
  const deviations: number[] = [];
  for (let i = 0; i < lines.rows; i++) {
    const x1 = lines.data32S[i * 4];
    const y1 = lines.data32S[i * 4 + 1];
    const x2 = lines.data32S[i * 4 + 2];
    const y2 = lines.data32S[i * 4 + 3];
    let angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    while (angle <= -90) angle += 180;
    while (angle > 90) angle -= 180;
    let dev = angle;
    if (dev > 45) dev -= 90;
    else if (dev < -45) dev += 90;
    if (Math.abs(dev) <= 15) deviations.push(dev);
  }
  bin.delete();
  lines.delete();
  if (deviations.length < 3) return 0;
  deviations.sort((a, b) => a - b);
  return deviations[Math.floor(deviations.length / 2)];
}

function rotate(cv: any, mat: any, angleDeg: number): any {
  const center = new cv.Point(mat.cols / 2, mat.rows / 2);
  const m = cv.getRotationMatrix2D(center, angleDeg, 1);
  const dst = new cv.Mat();
  cv.warpAffine(
    mat,
    dst,
    m,
    new cv.Size(mat.cols, mat.rows),
    cv.INTER_LINEAR,
    cv.BORDER_CONSTANT,
    new cv.Scalar(255, 255, 255, 255)
  );
  m.delete();
  return dst;
}

function binarize(cv: any, gray: any, opts: EnhanceOptions): any {
  const bin = new cv.Mat();
  if (opts.method === "otsu") {
    const blur = new cv.Mat();
    cv.GaussianBlur(gray, blur, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
    cv.threshold(blur, bin, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    blur.delete();
  } else {
    let blockSize = Math.round(opts.blockSize);
    if (blockSize % 2 === 0) blockSize += 1;
    if (blockSize < 3) blockSize = 3;
    cv.adaptiveThreshold(
      gray,
      bin,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      blockSize,
      opts.threshold
    );
  }
  if (opts.denoise >= 2) {
    const median = new cv.Mat();
    cv.medianBlur(bin, median, 3);
    median.copyTo(bin);
    median.delete();
  }
  return bin;
}

// --- line detection -----------------------------------------------------------

interface AxisLine {
  lo: number;
  hi: number;
  pos: number;
}

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface DetectedLines {
  horizontals: AxisLine[];
  verticals: AxisLine[];
  diagonals: Segment[];
}

function mergeAxisLines(
  items: AxisLine[],
  posGap: number,
  joinGap: number
): AxisLine[] {
  if (!items.length) return [];
  items.sort((a, b) => a.pos - b.pos);
  const clusters: AxisLine[][] = [];
  let current: AxisLine[] = [items[0]];
  let clusterPos = items[0].pos;
  for (let i = 1; i < items.length; i++) {
    if (Math.abs(items[i].pos - clusterPos) <= posGap) {
      current.push(items[i]);
      clusterPos =
        (clusterPos * (current.length - 1) + items[i].pos) / current.length;
    } else {
      clusters.push(current);
      current = [items[i]];
      clusterPos = items[i].pos;
    }
  }
  clusters.push(current);

  const merged: AxisLine[] = [];
  for (const cluster of clusters) {
    const pos = cluster.reduce((sum, x) => sum + x.pos, 0) / cluster.length;
    const intervals = cluster
      .map((x) => ({ lo: Math.min(x.lo, x.hi), hi: Math.max(x.lo, x.hi) }))
      .sort((a, b) => a.lo - b.lo);
    let span = { lo: intervals[0].lo, hi: intervals[0].hi };
    for (let i = 1; i < intervals.length; i++) {
      if (intervals[i].lo <= span.hi + joinGap) {
        span.hi = Math.max(span.hi, intervals[i].hi);
      } else {
        merged.push({ lo: span.lo, hi: span.hi, pos });
        span = { lo: intervals[i].lo, hi: intervals[i].hi };
      }
    }
    merged.push({ lo: span.lo, hi: span.hi, pos });
  }
  return merged;
}

function detectLines(cv: any, bin: any, opts: EnhanceOptions): DetectedLines {
  const inverted = new cv.Mat();
  cv.bitwise_not(bin, inverted);
  const lines = new cv.Mat();
  const minLen = Math.max(15, opts.minLineLength);
  cv.HoughLinesP(inverted, lines, 1, Math.PI / 180, 50, minLen, 12);

  const horizontals: AxisLine[] = [];
  const verticals: AxisLine[] = [];
  const diagonals: Segment[] = [];
  for (let i = 0; i < lines.rows; i++) {
    const x1 = lines.data32S[i * 4];
    const y1 = lines.data32S[i * 4 + 1];
    const x2 = lines.data32S[i * 4 + 2];
    const y2 = lines.data32S[i * 4 + 3];
    let angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    if (angle < 0) angle += 180;
    if (angle <= SNAP_TOL || angle >= 180 - SNAP_TOL) {
      horizontals.push({
        lo: Math.min(x1, x2),
        hi: Math.max(x1, x2),
        pos: (y1 + y2) / 2,
      });
    } else if (Math.abs(angle - 90) <= SNAP_TOL) {
      verticals.push({
        lo: Math.min(y1, y2),
        hi: Math.max(y1, y2),
        pos: (x1 + x2) / 2,
      });
    } else {
      diagonals.push({ x1, y1, x2, y2 });
    }
  }
  inverted.delete();
  lines.delete();

  const joinGap = Math.max(20, minLen * 0.6);
  return {
    horizontals: mergeAxisLines(horizontals, 5, joinGap),
    verticals: mergeAxisLines(verticals, 5, joinGap),
    diagonals,
  };
}

// --- OCR ----------------------------------------------------------------------

interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
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

// --- rendering ----------------------------------------------------------------

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
  onStatus("Bildbibliothek wird geladen …");
  const cv = await loadOpenCv();
  const notes: string[] = [];

  const work = makeWorkingCanvas(source);
  const upscale = clampUpscale(work.width, work.height, opts.upscale);
  if (upscale < opts.upscale - 0.01) {
    notes.push(
      `Skalierung auf ${upscale.toFixed(1)}× begrenzt (max. ${OUTPUT_MAX} px Kantenlänge).`
    );
  }

  onStatus("Bild wird vorbereitet …");
  await yieldFrame();
  const rgba = cv.imread(work);
  let gray = new cv.Mat();
  cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
  rgba.delete();

  if (opts.denoise > 0) {
    onStatus("Rauschen wird reduziert …");
    await yieldFrame();
    applyDenoise(cv, gray, opts.denoise);
  }

  if (opts.deskew) {
    onStatus("Schräglage wird geprüft …");
    await yieldFrame();
    const skew = detectSkew(cv, gray);
    if (Math.abs(skew) > 0.25 && Math.abs(skew) < 15) {
      const rotated = rotate(cv, gray, skew);
      gray.delete();
      gray = rotated;
      notes.push(`Schräglage korrigiert (${skew.toFixed(2)}°).`);
    }
  }

  onStatus("Schwarz-Weiß-Wandlung …");
  await yieldFrame();
  const bin = binarize(cv, gray, opts);
  gray.delete();

  let result: HTMLCanvasElement;
  if (opts.mode === "reconstruct") {
    onStatus("Linien werden erkannt …");
    await yieldFrame();
    const detected = detectLines(cv, bin, opts);
    notes.push(
      `${detected.horizontals.length} waagerechte, ${detected.verticals.length} senkrechte und ${detected.diagonals.length} schräge Linien erkannt.`
    );

    let words: OcrWord[] = [];
    if (opts.ocr) {
      onStatus("Text wird erkannt … 0 %");
      const ocrCanvas = document.createElement("canvas");
      cv.imshow(ocrCanvas, bin);
      try {
        words = await runOcr(ocrCanvas, opts.ocrLang, (progress) =>
          onStatus(`Text wird erkannt … ${Math.round(progress * 100)} %`, progress)
        );
        notes.push(`${words.length} Textfragmente erkannt und neu gesetzt.`);
      } catch (err) {
        notes.push(
          "Texterkennung übersprungen – die OCR-Daten konnten nicht geladen werden (Netzwerk?)."
        );
      }
    }

    onStatus("Bild wird neu gezeichnet …");
    await yieldFrame();
    result = renderReconstruct(bin.cols, bin.rows, upscale, detected, words, opts);
  } else {
    onStatus("Bild wird hochskaliert …");
    await yieldFrame();
    const out = new cv.Mat();
    const dsize = new cv.Size(
      Math.round(bin.cols * upscale),
      Math.round(bin.rows * upscale)
    );
    cv.resize(bin, out, dsize, 0, 0, cv.INTER_CUBIC);
    result = document.createElement("canvas");
    cv.imshow(result, out);
    out.delete();
  }

  bin.delete();
  onStatus("Fertig.", 1);
  return { canvas: result, notes };
}
