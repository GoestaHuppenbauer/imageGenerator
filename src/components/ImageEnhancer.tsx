import { useCallback, useEffect, useRef, useState } from "react";
import styles from "@/styles/Enhancer.module.css";
import {
  DEFAULT_OPTIONS,
  EnhanceOptions,
  enhanceImage,
  prepareEnhancer,
} from "@/lib/imageProcessing";

interface ResultState {
  url: string;
  width: number;
  height: number;
  notes: string[];
}

export default function ImageEnhancer() {
  const [options, setOptions] = useState<EnhanceOptions>(DEFAULT_OPTIONS);
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<{ w: number; h: number } | null>(
    null
  );
  const [fileName, setFileName] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Warm up the worker (and OpenCV.js inside it) ahead of time.
    prepareEnhancer();
  }, []);

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const update = (patch: Partial<EnhanceOptions>) =>
    setOptions((prev) => ({ ...prev, ...patch }));

  const loadFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Bitte eine Bilddatei auswählen (JPG oder PNG).");
        return;
      }
      setError(null);
      setResult(null);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        setOriginalUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setSourceCanvas(canvas);
        setOriginalSize({ w: img.naturalWidth, h: img.naturalHeight });
        setFileName(file.name);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setError("Das Bild konnte nicht gelesen werden.");
      };
      img.src = url;
    },
    []
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    loadFile(e.dataTransfer.files?.[0]);
  };

  const handleProcess = async () => {
    if (!sourceCanvas || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setStatus("Verarbeitung wird gestartet …");
    try {
      const res = await enhanceImage(sourceCanvas, options, (message, p) => {
        setStatus(message);
        if (typeof p === "number") setProgress(p);
      });
      const blob: Blob = await new Promise((resolve, reject) => {
        res.canvas.toBlob(
          (b) =>
            b
              ? resolve(b)
              : reject(
                  new Error("Das Ergebnis-Bild konnte nicht erzeugt werden.")
                ),
          "image/png"
        );
      });
      setResult({
        url: URL.createObjectURL(blob),
        width: res.canvas.width,
        height: res.canvas.height,
        notes: res.notes,
      });
      setStatus("Fertig.");
      setProgress(1);
    } catch (err: any) {
      setError(err?.message || "Die Verarbeitung ist fehlgeschlagen.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  };

  const downloadName = () => {
    const base = fileName.replace(/\.[^.]+$/, "") || "bild";
    return `${base}-aufgewertet.png`;
  };

  const isReconstruct = options.mode === "reconstruct";

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Skalen &amp; Werte aufwerten</h1>
          <p className={styles.subtitle}>
            Abfotografierte oder gescannte Vorlagen mit schwarzen Linien auf
            weißem Grund werden entzerrt, gesäubert und scharf neu gezeichnet.
            Die Verarbeitung läuft komplett in deinem Browser.
          </p>
        </header>

        <section className={styles.card}>
          {!sourceCanvas ? (
            <div
              className={`${styles.dropzone} ${
                dragActive ? styles.dropzoneActive : ""
              }`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
            >
              <div className={styles.dropTitle}>
                Bild hierher ziehen oder klicken
              </div>
              <div className={styles.dropHint}>JPG oder PNG</div>
            </div>
          ) : (
            <div className={styles.fileRow}>
              <span className={styles.fileName}>
                {fileName}
                {originalSize
                  ? ` · ${originalSize.w} × ${originalSize.h} px`
                  : ""}
              </span>
              <button
                className={styles.button}
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                Anderes Bild
              </button>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            onChange={(e) => loadFile(e.target.files?.[0])}
          />
        </section>

        {sourceCanvas && (
          <section className={styles.card}>
            <div className={styles.modeToggle}>
              <button
                className={`${styles.modeBtn} ${
                  !isReconstruct ? styles.modeBtnActive : ""
                }`}
                onClick={() => update({ mode: "cleanup" })}
                disabled={busy}
              >
                <div className={styles.modeBtnTitle}>Cleanup</div>
                <div className={styles.modeBtnDesc}>
                  Entzerren, säubern, schärfen. Alles bleibt erhalten – Punkte,
                  Linien, Text.
                </div>
              </button>
              <button
                className={`${styles.modeBtn} ${
                  isReconstruct ? styles.modeBtnActive : ""
                }`}
                onClick={() => update({ mode: "reconstruct" })}
                disabled={busy}
              >
                <div className={styles.modeBtnTitle}>Reconstruct</div>
                <div className={styles.modeBtnDesc}>
                  Gitterlinien sauber neu zeichnen. Messpunkte &amp; Text bleiben
                  erhalten.
                </div>
              </button>
            </div>

            <div className={styles.controlsGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Vergrößerung</label>
                <select
                  className={styles.select}
                  value={options.upscale}
                  onChange={(e) =>
                    update({ upscale: Number(e.target.value) })
                  }
                  disabled={busy}
                >
                  <option value={1}>1× (Originalgröße)</option>
                  <option value={2}>2×</option>
                  <option value={3}>3×</option>
                  <option value={4}>4×</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Binarisierung</label>
                <select
                  className={styles.select}
                  value={options.method}
                  onChange={(e) =>
                    update({
                      method: e.target.value as EnhanceOptions["method"],
                    })
                  }
                  disabled={busy}
                >
                  <option value="adaptive">Adaptiv (Foto)</option>
                  <option value="otsu">Otsu (sauberer Scan)</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>&nbsp;</label>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={options.deskew}
                    onChange={(e) => update({ deskew: e.target.checked })}
                    disabled={busy}
                  />
                  Schräglage automatisch korrigieren
                </label>
              </div>

              {isReconstruct && (
                <div className={styles.field}>
                  <label className={styles.label}>
                    Linienstärke{" "}
                    <span className={styles.value}>
                      {options.lineThickness} px
                    </span>
                  </label>
                  <input
                    className={styles.range}
                    type="range"
                    min={1}
                    max={8}
                    step={1}
                    value={options.lineThickness}
                    onChange={(e) =>
                      update({ lineThickness: Number(e.target.value) })
                    }
                    disabled={busy}
                  />
                </div>
              )}
            </div>

            <details className={styles.advanced}>
              <summary className={styles.advancedSummary}>
                Erweiterte Einstellungen
              </summary>
              <div className={`${styles.advancedBody} ${styles.controlsGrid}`}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Entrauschen{" "}
                    <span className={styles.value}>Stufe {options.denoise}</span>
                  </label>
                  <input
                    className={styles.range}
                    type="range"
                    min={0}
                    max={3}
                    step={1}
                    value={options.denoise}
                    onChange={(e) =>
                      update({ denoise: Number(e.target.value) })
                    }
                    disabled={busy}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    Detailgröße{" "}
                    <span className={styles.value}>{options.blockSize}</span>
                  </label>
                  <input
                    className={styles.range}
                    type="range"
                    min={15}
                    max={61}
                    step={2}
                    value={options.blockSize}
                    onChange={(e) =>
                      update({ blockSize: Number(e.target.value) })
                    }
                    disabled={busy || options.method !== "adaptive"}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    Schwellenwert{" "}
                    <span className={styles.value}>{options.threshold}</span>
                  </label>
                  <input
                    className={styles.range}
                    type="range"
                    min={1}
                    max={25}
                    step={1}
                    value={options.threshold}
                    onChange={(e) =>
                      update({ threshold: Number(e.target.value) })
                    }
                    disabled={busy || options.method !== "adaptive"}
                  />
                </div>

                {isReconstruct && (
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Mindest-Linienlänge{" "}
                      <span className={styles.value}>
                        {options.minLineLength} px
                      </span>
                    </label>
                    <input
                      className={styles.range}
                      type="range"
                      min={15}
                      max={120}
                      step={5}
                      value={options.minLineLength}
                      onChange={(e) =>
                        update({ minLineLength: Number(e.target.value) })
                      }
                      disabled={busy}
                    />
                  </div>
                )}
              </div>
            </details>

            <div className={styles.actionRow}>
              <button
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={handleProcess}
                disabled={busy}
              >
                {busy ? "Wird verarbeitet …" : "Bild aufwerten"}
              </button>
            </div>

            {(busy || status) && (
              <div className={styles.status}>
                {status}
                {busy && (
                  <div className={styles.progressTrack}>
                    <div
                      className={`${styles.progressFill} ${
                        progress > 0 ? "" : styles.indeterminate
                      }`}
                      style={
                        progress > 0
                          ? { width: `${Math.round(progress * 100)}%` }
                          : undefined
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}
          </section>
        )}

        {(originalUrl || result) && (
          <section className={styles.card}>
            <div className={styles.results}>
              {originalUrl && (
                <div className={styles.resultCol}>
                  <div className={styles.resultLabel}>Original</div>
                  <div className={styles.imageFrame}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.previewImg}
                      src={originalUrl}
                      alt="Original"
                    />
                  </div>
                  {originalSize && (
                    <div className={styles.meta}>
                      {originalSize.w} × {originalSize.h} px
                    </div>
                  )}
                </div>
              )}
              {result && (
                <div className={styles.resultCol}>
                  <div className={styles.resultLabel}>Aufgewertet</div>
                  <div className={styles.imageFrame}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.previewImg}
                      src={result.url}
                      alt="Aufgewertet"
                    />
                  </div>
                  <div className={styles.meta}>
                    {result.width} × {result.height} px
                  </div>
                </div>
              )}
            </div>

            {result && result.notes.length > 0 && (
              <ul className={styles.notes}>
                {result.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            )}

            {result && (
              <div className={styles.actionRow}>
                <a
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  href={result.url}
                  download={downloadName()}
                >
                  Als PNG herunterladen
                </a>
              </div>
            )}
          </section>
        )}

        <p className={styles.footer}>
          Dein Bild wird nicht hochgeladen – die gesamte Verarbeitung passiert
          lokal im Browser. Die Bibliothek OpenCV.js wird dafür einmalig von
          einem CDN nachgeladen.
        </p>
      </div>
    </div>
  );
}
