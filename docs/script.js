// =====================
// DEMO-SAFE script.js
// - Works on GitHub Pages
// - No API keys required
// - Does NOT call Roboflow when keys are null
// =====================

// if user is on mobile resolution
let width, height;
if (window.matchMedia("(max-width: 500px)").matches) {
  width = window.innerWidth;
  height = window.innerHeight;
  const picture_canvas = document.getElementById("picture_canvas");
  if (picture_canvas) {
    picture_canvas.width = width;
    picture_canvas.height = height;
  }
} else {
  width = 640;
  height = 480;
}

let color_choices = [
  "#C7FC00", "#FF00FF", "#8622FF", "#FE0056", "#00FFCE", "#FF8000",
  "#00B7EB", "#FFFF00", "#0E7AFE", "#FFABAB", "#0000FF", "#CCCCCC",
];

const available_models = {
  "zoea-megalopa": {
    name: "Zoea Megalopa",
    version: 5,
    video: "",
    confidence: 0.20,
    imageGrid: [
      "images/label_6_mp4-0125.jpg",
      "images/label_6_mp4-0198.jpg",
      "images/label_10_mp4-0217.jpg",
      "images/label_10_mp4-0330.jpg",
    ],
    model: null
  }
};

// populate model select
const model_select = document.getElementById("model-select");
if (model_select) {
  for (const item in available_models) {
    const option = document.createElement("option");
    option.text = available_models[item].name;
    option.value = item;
    model_select.add(option);
  }
}

let current_model_name = "zoea-megalopa";
let current_model_version = available_models[current_model_name].version;

// 🔒 DEMO MODE (no keys)
const API_KEY = null;
const DETECT_API_KEY = null;

// If keys are missing -> demo mode ON
const DEMO_MODE = !(API_KEY && DETECT_API_KEY);

const CAMERA_ACCESS_URL =
  "https://uploads-ssl.webflow.com/5f6bc60e665f54545a1e52a5/63d40cd1de273045d359cf9a_camera-access2.png";
const LOADING_URL =
  "https://uploads-ssl.webflow.com/5f6bc60e665f54545a1e52a5/63d40cd2210b56e0e33593c7_loading-camera2.gif";

let webcamLoop = false;

// when user scrolls past #model-select, stop webcam
window.addEventListener("scroll", function () {
  if (window.scrollY > 100) webcamLoop = false;
  if (window.scrollY < 100) webcamLoop = true;
});

function safeSetText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = text;
}

function setImageState(src, canvasId = "picture_canvas") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.src = src;
  img.crossOrigin = "anonymous";
  img.onload = function () {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, width, height);
  };
}

let bounding_box_colors = {};

function pickColorForClass(cls) {
  if (bounding_box_colors[cls]) return bounding_box_colors[cls];
  const color = color_choices.length
    ? color_choices[Math.floor(Math.random() * color_choices.length)]
    : "#00FFCE";
  bounding_box_colors[cls] = color;
  // remove chosen color from pool (optional)
  const idx = color_choices.indexOf(color);
  if (idx >= 0) color_choices.splice(idx, 1);
  return color;
}

function drawBoundingBoxes(predictions, canvas, ctx, scalingRatio, sx, sy, fromDetectAPI = true) {
  if (!predictions || !predictions.length) return;

  for (let i = 0; i < predictions.length; i++) {
    const p = predictions[i];
    const confidence = p.confidence ?? 0.5;
    const cls = p.class ?? "zoea";

    const stroke = pickColorForClass(cls);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 4;

    let x = p.bbox.x - p.bbox.width / 2;
    let y = p.bbox.y - p.bbox.height / 2;
    let w = p.bbox.width;
    let h = p.bbox.height;

    // If you ever pass non-DetectAPI coords, keep this structure
    if (!fromDetectAPI) {
      x -= sx; y -= sy;
      x *= scalingRatio; y *= scalingRatio;
      w *= scalingRatio; h *= scalingRatio;
    }

    // clip
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }

    // box
    ctx.strokeRect(x, y, w, h);

    // label
    const label = `${cls} ${Math.round(confidence * 100)}%`;
    ctx.font = "15px monospace";
    const textW = ctx.measureText(label).width;

    let labelY = y < 20 ? 30 : y;
    ctx.fillStyle = stroke;
    ctx.fillRect(x - 2, labelY - 30, textW + 8, 30);

    ctx.fillStyle = "black";
    ctx.fillText(label, x + 2, labelY - 10);
  }
}

function countAndVisualizePredictions(predictions) {
  const classCount = { zoea: 0, megalopa: 0 };
  for (let i = 0; i < (predictions || []).length; i++) {
    const c = predictions[i].class;
    if (c === "zoea" || c === "megalopa") classCount[c]++;
  }
  safeSetText("results", `Results: Zoea = ${classCount.zoea} | Megalopa = ${classCount.megalopa}`);
}

// ---------- DEMO: fake predictions ----------
function seededRandomFromString(str) {
  // simple deterministic hash -> 0..1
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // convert to 0..1
  return (h >>> 0) / 4294967295;
}

function makeDemoPredictions(seedText) {
  const r = seededRandomFromString(seedText);

  // decide counts (looks realistic)
  const zoeaCount = 6 + Math.floor(r * 10);      // 6..15
  const megaCount = Math.floor((1 - r) * 4);     // 0..3

  const preds = [];

  function pushBoxes(cls, n, offset) {
    for (let i = 0; i < n; i++) {
      const rr = seededRandomFromString(`${seedText}-${cls}-${i}-${offset}`);
      const x = 60 + rr * 520;     // center x within canvas
      const y = 60 + (1 - rr) * 360;
      const w = 30 + (rr * 60);
      const h = 20 + ((1 - rr) * 50);
      preds.push({
        class: cls,
        confidence: 0.45 + (rr * 0.45),
        bbox: { x, y, width: w, height: h }
      });
    }
  }

  pushBoxes("zoea", zoeaCount, 1);
  pushBoxes("megalopa", megaCount, 2);

  return preds;
}

// ---------- REAL API (only if keys exist) ----------
async function apiRequest(imageBase64) {
  if (DEMO_MODE) {
    // no network, no keys
    // Use robust seed from image content: combine head + tail of base64
    // (avoids identical prefix "data:image/jpeg;base64," which makes all seeds identical)
    const seed = imageBase64.slice(0, 200) + "|" + imageBase64.slice(-200);
    const preds = makeDemoPredictions(seed);
    countAndVisualizePredictions(preds);
    return preds;
  }

  const version = available_models[current_model_name].version;
  const name = current_model_name;
  const url =
    "https://detect.roboflow.com/" +
    name +
    "/" +
    version +
    "?api_key=" +
    DETECT_API_KEY +
    "&confidence=30";

  // Extract raw base64 from data URL (remove "data:image/jpeg;base64," prefix)
  const base64String = imageBase64.includes(",") 
    ? imageBase64.split(",")[1] 
    : imageBase64;

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "imageToUpload=" + base64String,
    redirect: "follow",
  })
    .then((response) => response.json())
    .then((resJson) => {
      const preds = resJson["predictions"] || [];
      countAndVisualizePredictions(preds);
      return preds;
    });
}

// ---------- Roboflow model (only if keys exist) ----------
async function getModel() {
  if (DEMO_MODE) {
    // In demo mode we do not load any model
    return null;
  }

  const model = await roboflow
    .auth({ publishable_key: API_KEY })
    .load({ model: current_model_name, version: current_model_version });

  model.configure({
    threshold: available_models[current_model_name].confidence,
    max_objects: 50
  });

  return model;
}

// Optional: keep looping video if exists
const videoEl = document.getElementById("video");
if (videoEl) {
  videoEl.setAttribute("playsinline", "");
  videoEl.play().catch(() => {});
  videoEl.addEventListener("ended", function () {
    this.currentTime = 0;
    this.play().catch(() => {});
  });
}

function switchModel() {
  current_model_name = document.getElementById("model-select").value;
  current_model_version = available_models[current_model_name].version;

  // update prechosen images
  const prechosen_images_parent = document.getElementById("prechosen_images_parent");
  const prechosen_images = document.getElementById("prechosen_images");
  if (prechosen_images && prechosen_images.children) {
    const kids = prechosen_images.children;
    for (let i = 0; i < kids.length; i++) {
      if (available_models[current_model_name].imageGrid[i]) {
        kids[i].src = available_models[current_model_name].imageGrid[i];
      }
    }
  }

  // In demo mode, just show the image mode UX (no webcam model)
  if (DEMO_MODE) {
    safeSetText("results", "Demo mode: showing simulated detections (no API key).");
  }

  // Only load model if real mode
  getModel().catch(() => {});
}

if (model_select) {
  model_select.addEventListener("change", switchModel);
}

// ---------- Image inference ----------
function getCoordinates(img) {
  const dx = 0;
  const dy = 0;
  const dWidth = 640;
  const dHeight = 480;

  let sy, sx, sWidth, sHeight;

  const imageWidth = img.width;
  const imageHeight = img.height;

  const canvasRatio = dWidth / dHeight;
  const imageRatio = imageWidth / imageHeight;

  if (canvasRatio >= imageRatio) {
    sx = 0;
    sWidth = imageWidth;
    sHeight = sWidth / canvasRatio;
    sy = (imageHeight - sHeight) / 2;
  } else {
    sy = 0;
    sHeight = imageHeight;
    sWidth = sHeight * canvasRatio;
    sx = (imageWidth - sWidth) / 2;
  }

  let scalingRatio = dWidth / sWidth;
  if (scalingRatio === Infinity) scalingRatio = 1;

  return [sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight, scalingRatio];
}

function getBase64Image(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
  return c.toDataURL("image/jpeg");
}

function imageInference(imgEl) {
  const picture = document.getElementById("picture");
  const picture_canvas = document.getElementById("picture_canvas");
  const example_demo = document.getElementById("example_demo");
  const video_canvas = document.getElementById("video_canvas");

  if (picture) picture.style.display = "none";
  if (picture_canvas) picture_canvas.style.display = "block";
  if (example_demo) example_demo.style.display = "none";
  if (video_canvas) video_canvas.style.display = "none";

  const canvas = picture_canvas;
  const ctx = canvas.getContext("2d");

  const img = new Image();
  img.src = imgEl.src;
  img.crossOrigin = "anonymous";

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  img.onload = function () {
    setImageState(LOADING_URL, "picture_canvas");

    const [sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight, scalingRatio] =
      getCoordinates(img);

    const base64 = getBase64Image(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);

    apiRequest(base64).then(function (predictions) {
      // draw the image first
      canvas.width = dWidth;
      canvas.height = dHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);

      // normalize predictions if real API returns x/y/width/height
      const normalized = (predictions || []).map(p => ({
        class: p.class,
        confidence: p.confidence,
        bbox: p.bbox || { x: p.x, y: p.y, width: p.width, height: p.height }
      }));

      drawBoundingBoxes(normalized, canvas, ctx, scalingRatio, sx, sy, true);
    });
  };
}

function processDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  const picture = document.getElementById("picture");
  const picture_canvas = document.getElementById("picture_canvas");
  const example_demo = document.getElementById("example_demo");
  const video_canvas = document.getElementById("video_canvas");

  if (picture) picture.style.display = "none";
  if (picture_canvas) picture_canvas.style.display = "block";
  if (example_demo) example_demo.style.display = "none";
  if (video_canvas) video_canvas.style.display = "none";

  const canvas = picture_canvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const file = e.dataTransfer.files[0];
  if (!file) return;

  // only allow png, jpeg, jpg
  if (!(file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/jpg")) {
    safeSetText("results", "Please drop a PNG/JPG image.");
    return;
  }

  const reader = new FileReader();
  reader.readAsDataURL(file);

  reader.onload = function (event) {
    const img = new Image();
    img.src = event.target.result;

    img.onload = function () {
      setImageState(LOADING_URL, "picture_canvas");

      const [sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight, scalingRatio] =
        getCoordinates(img);

      const base64 = getBase64Image(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);

      apiRequest(base64).then(function (predictions) {
        canvas.width = dWidth;
        canvas.height = dHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);

        const normalized = (predictions || []).map(p => ({
          class: p.class,
          confidence: p.confidence,
          bbox: p.bbox || { x: p.x, y: p.y, width: p.width, height: p.height }
        }));

        drawBoundingBoxes(normalized, canvas, ctx, scalingRatio, sx, sy, true);
      });
    };
  };
}

// ---------- Wire UI buttons ----------
const imagePredictBtn = document.getElementById("image-predict");
if (imagePredictBtn) {
  imagePredictBtn.addEventListener("click", function () {
    const prechosenParent = document.getElementById("prechosen_images_parent");
    const picture_canvas = document.getElementById("picture_canvas");
    const picture = document.getElementById("picture");
    const example_demo = document.getElementById("example_demo");
    const video = document.getElementById("video");
    const video_canvas = document.getElementById("video_canvas");

    if (prechosenParent) prechosenParent.style.display = "block";
    if (picture_canvas) picture_canvas.style.display = "none";
    if (picture) picture.style.display = "block";
    if (example_demo) example_demo.style.display = "none";
    if (video) video.style.display = "none";
    if (video_canvas) video_canvas.style.display = "none";

    if (webcamLoop) webcamLoop = false;

    if (picture) {
      picture.addEventListener("dragover", function (e) { e.preventDefault(); e.stopPropagation(); });
      picture.addEventListener("drop", processDrop);
    }

    safeSetText("results", DEMO_MODE
      ? "Demo mode: drop an image to see simulated detection."
      : "Drop an image to detect.");
  });
}

// click prechosen images -> inference
const prechosen = document.getElementById("prechosen_images");
if (prechosen && prechosen.children) {
  for (let i = 0; i < prechosen.children.length; i++) {
    prechosen.children[i].addEventListener("click", function () {
      imageInference(this);
    });
  }
}

// Auto-start image mode
if (imagePredictBtn) imagePredictBtn.click();
