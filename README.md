# Skalen & Werte aufwerten

Eine Website, die abfotografierte oder gescannte Vorlagen mit Skalen, Werten und
schwarzen Linien auf weißem Grund aufwertet. Schlecht lesbare Bilder werden
entzerrt, gesäubert und scharf neu gezeichnet.

Die gesamte Bildverarbeitung läuft **clientseitig im Browser** – das hochgeladene
Bild wird nicht an einen Server gesendet.

## Funktionen

- **Cleanup** – Schräglage korrigieren, entrauschen, sauberes Schwarz/Weiß
  (adaptiv oder Otsu) und hochskalieren. Die Originalpixel bleiben erhalten,
  Zahlenwerte werden nicht verändert.
- **Reconstruct** – Linien per Hough-Transformation erkennen, waagerechte/
  senkrechte Linien begradigen und das Bild vektorartig neu zeichnen.
  Text wird per OCR erkannt und scharf neu gesetzt.
- Vorschau Original/Ergebnis nebeneinander, Download als PNG.

## Technik

- [Next.js](https://nextjs.org/) (Pages Router, TypeScript)
- [OpenCV.js](https://docs.opencv.org/) für Bildverarbeitung
- [Tesseract.js](https://tesseract.projectnaptha.com/) für OCR

OpenCV.js und Tesseract.js (inkl. OCR-Sprachdaten) werden zur Laufzeit einmalig
von einem CDN nachgeladen. Der Browser des Nutzers benötigt dafür eine
Internetverbindung; die Bilddaten selbst verlassen den Browser nicht.

## Entwicklung

```bash
npm install
npm run dev
```

Die App läuft danach unter [http://localhost:3000](http://localhost:3000).

- `/` – Bild-Aufwertung (Skalen & Werte)
- `/cover` – der bisherige Podcast-Cover-Generator

## Deployment mit Coolify

Das Repository enthält ein `Dockerfile` und eine `docker-compose.yml`.

1. In Coolify eine neue Resource vom Typ **Docker Compose** (oder
   **Dockerfile**) anlegen und auf dieses Repository zeigen lassen.
2. Als Branch `claude/image-upscale-ocr-61luz` (bzw. nach dem Merge `main`)
   wählen.
3. Der Container baut mit `npm run build` und startet mit `npm run start` auf
   Port `3000`. Coolify übernimmt Reverse-Proxy und TLS.

Lokaler Test des Containers:

```bash
docker compose up --build
```
