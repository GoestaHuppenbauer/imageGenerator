/* OpenCV image-processing worker.
   Runs all heavy OpenCV.js work off the main thread so the page stays
   responsive even while a large image is being processed. */

var OPENCV_URL = "https://docs.opencv.org/4.x/opencv.js";
var SNAP_TOL = 6;

var cvInstance = null;
var cvReady = null;

// OpenCV.js 4.x exposes `cv` as a "thenable" object whose then() is not a
// real promise. Avoid then()/catch() entirely and just poll until the
// runtime is ready (cv.Mat becomes available).
function ensureCv() {
  if (cvReady) return cvReady;
  cvReady = new Promise(function (resolve, reject) {
    try {
      importScripts(OPENCV_URL);
    } catch (e) {
      reject(new Error("OpenCV.js konnte nicht geladen werden."));
      return;
    }
    var started = Date.now();
    var timer = setInterval(function () {
      var c = self.cv;
      if (c && typeof c.Mat === "function") {
        clearInterval(timer);
        cvInstance = c;
        resolve();
      } else if (Date.now() - started > 120000) {
        clearInterval(timer);
        reject(new Error("OpenCV.js Zeitüberschreitung beim Initialisieren."));
      }
    }, 50);
  });
  return cvReady;
}

function matToImageData(cv, mat) {
  var rgba = mat;
  var temp = null;
  if (mat.type() !== cv.CV_8UC4) {
    temp = new cv.Mat();
    if (mat.channels() === 1) {
      cv.cvtColor(mat, temp, cv.COLOR_GRAY2RGBA);
    } else {
      cv.cvtColor(mat, temp, cv.COLOR_RGB2RGBA);
    }
    rgba = temp;
  }
  var out = new ImageData(
    new Uint8ClampedArray(rgba.data),
    rgba.cols,
    rgba.rows
  );
  if (temp) temp.delete();
  return out;
}

function applyDenoise(cv, gray, level) {
  if (level <= 0) return;
  var diameter = level >= 3 ? 9 : level >= 2 ? 7 : 5;
  var sigma = level >= 3 ? 80 : level >= 2 ? 60 : 45;
  var tmp = new cv.Mat();
  cv.bilateralFilter(gray, tmp, diameter, sigma, sigma, cv.BORDER_DEFAULT);
  tmp.copyTo(gray);
  tmp.delete();
}

function detectSkew(cv, gray) {
  var bin = new cv.Mat();
  cv.adaptiveThreshold(
    gray,
    bin,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    31,
    10
  );
  var lines = new cv.Mat();
  var minLen = Math.max(gray.cols, gray.rows) / 4;
  cv.HoughLinesP(bin, lines, 1, Math.PI / 180, 80, minLen, 20);
  var deviations = [];
  for (var i = 0; i < lines.rows; i++) {
    var x1 = lines.data32S[i * 4];
    var y1 = lines.data32S[i * 4 + 1];
    var x2 = lines.data32S[i * 4 + 2];
    var y2 = lines.data32S[i * 4 + 3];
    var angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    while (angle <= -90) angle += 180;
    while (angle > 90) angle -= 180;
    var dev = angle;
    if (dev > 45) dev -= 90;
    else if (dev < -45) dev += 90;
    if (Math.abs(dev) <= 15) deviations.push(dev);
  }
  bin.delete();
  lines.delete();
  if (deviations.length < 3) return 0;
  deviations.sort(function (a, b) {
    return a - b;
  });
  return deviations[Math.floor(deviations.length / 2)];
}

function rotate(cv, mat, angleDeg) {
  var center = new cv.Point(mat.cols / 2, mat.rows / 2);
  var m = cv.getRotationMatrix2D(center, angleDeg, 1);
  var dst = new cv.Mat();
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

function binarize(cv, gray, opts) {
  var bin = new cv.Mat();
  if (opts.method === "otsu") {
    var blur = new cv.Mat();
    cv.GaussianBlur(gray, blur, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
    cv.threshold(blur, bin, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    blur.delete();
  } else {
    var blockSize = Math.round(opts.blockSize);
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
    var median = new cv.Mat();
    cv.medianBlur(bin, median, 3);
    median.copyTo(bin);
    median.delete();
  }
  return bin;
}

function mergeAxisLines(items, posGap, joinGap) {
  if (!items.length) return [];
  items.sort(function (a, b) {
    return a.pos - b.pos;
  });
  var clusters = [];
  var current = [items[0]];
  var clusterPos = items[0].pos;
  for (var i = 1; i < items.length; i++) {
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

  var merged = [];
  for (var c = 0; c < clusters.length; c++) {
    var cluster = clusters[c];
    var pos = 0;
    for (var p = 0; p < cluster.length; p++) pos += cluster[p].pos;
    pos /= cluster.length;
    var intervals = cluster
      .map(function (x) {
        return { lo: Math.min(x.lo, x.hi), hi: Math.max(x.lo, x.hi) };
      })
      .sort(function (a, b) {
        return a.lo - b.lo;
      });
    var span = { lo: intervals[0].lo, hi: intervals[0].hi };
    for (var k = 1; k < intervals.length; k++) {
      if (intervals[k].lo <= span.hi + joinGap) {
        span.hi = Math.max(span.hi, intervals[k].hi);
      } else {
        merged.push({ lo: span.lo, hi: span.hi, pos: pos });
        span = { lo: intervals[k].lo, hi: intervals[k].hi };
      }
    }
    merged.push({ lo: span.lo, hi: span.hi, pos: pos });
  }
  return merged;
}

function detectLines(cv, bin, opts) {
  var inverted = new cv.Mat();
  cv.bitwise_not(bin, inverted);
  var lines = new cv.Mat();
  var minLen = Math.max(15, opts.minLineLength);
  cv.HoughLinesP(inverted, lines, 1, Math.PI / 180, 50, minLen, 12);

  var horizontals = [];
  var verticals = [];
  var diagonals = [];
  for (var i = 0; i < lines.rows; i++) {
    var x1 = lines.data32S[i * 4];
    var y1 = lines.data32S[i * 4 + 1];
    var x2 = lines.data32S[i * 4 + 2];
    var y2 = lines.data32S[i * 4 + 3];
    var angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
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
      diagonals.push({ x1: x1, y1: y1, x2: x2, y2: y2 });
    }
  }
  inverted.delete();
  lines.delete();

  var joinGap = Math.max(20, minLen * 0.6);
  return {
    horizontals: mergeAxisLines(horizontals, 5, joinGap),
    verticals: mergeAxisLines(verticals, 5, joinGap),
    diagonals: diagonals,
  };
}

async function handleProcess(msg) {
  var id = msg.id;
  function status(message) {
    self.postMessage({ type: "progress", id: id, message: message });
  }

  status("Bildbibliothek wird geladen …");
  await ensureCv();
  var cv = cvInstance;
  var opts = msg.options;
  var upscale = msg.upscale;
  var notes = [];

  var imageData = new ImageData(
    new Uint8ClampedArray(msg.image.buffer),
    msg.image.width,
    msg.image.height
  );

  status("Bild wird vorbereitet …");
  var rgba = cv.matFromImageData(imageData);
  var gray = new cv.Mat();
  cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
  rgba.delete();

  if (opts.denoise > 0) {
    status("Rauschen wird reduziert …");
    applyDenoise(cv, gray, opts.denoise);
  }

  if (opts.deskew) {
    status("Schräglage wird geprüft …");
    var skew = detectSkew(cv, gray);
    if (Math.abs(skew) > 0.25 && Math.abs(skew) < 15) {
      var rotated = rotate(cv, gray, skew);
      gray.delete();
      gray = rotated;
      notes.push("Schräglage korrigiert (" + skew.toFixed(2) + "°).");
    }
  }

  status("Schwarz-Weiß-Wandlung …");
  var bin = binarize(cv, gray, opts);
  gray.delete();

  if (opts.mode === "reconstruct") {
    status("Linien werden erkannt …");
    var detected = detectLines(cv, bin, opts);
    notes.push(
      detected.horizontals.length +
        " waagerechte, " +
        detected.verticals.length +
        " senkrechte und " +
        detected.diagonals.length +
        " schräge Linien erkannt."
    );
    var binImageData = matToImageData(cv, bin);
    bin.delete();
    self.postMessage(
      {
        type: "result",
        id: id,
        mode: "reconstruct",
        binary: {
          buffer: binImageData.data.buffer,
          width: binImageData.width,
          height: binImageData.height,
        },
        lines: detected,
        notes: notes,
      },
      [binImageData.data.buffer]
    );
  } else {
    status("Bild wird hochskaliert …");
    var out = new cv.Mat();
    var dsize = new cv.Size(
      Math.round(bin.cols * upscale),
      Math.round(bin.rows * upscale)
    );
    cv.resize(bin, out, dsize, 0, 0, cv.INTER_CUBIC);
    bin.delete();
    var outImageData = matToImageData(cv, out);
    out.delete();
    self.postMessage(
      {
        type: "result",
        id: id,
        mode: "cleanup",
        image: {
          buffer: outImageData.data.buffer,
          width: outImageData.width,
          height: outImageData.height,
        },
        notes: notes,
      },
      [outImageData.data.buffer]
    );
  }
}

self.onmessage = function (e) {
  var msg = e.data;
  if (!msg || !msg.type) return;
  if (msg.type === "init") {
    ensureCv()
      .then(function () {
        self.postMessage({ type: "ready" });
      })
      .catch(function (err) {
        self.postMessage({
          type: "error",
          id: msg.id,
          message: String((err && err.message) || err),
        });
      });
    return;
  }
  if (msg.type === "process") {
    handleProcess(msg).catch(function (err) {
      self.postMessage({
        type: "error",
        id: msg.id,
        message: String((err && err.message) || err),
      });
    });
  }
};
