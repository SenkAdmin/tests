// js/main.js
const CONFIG = {
  orderUsername: "SanyaDur",
  orderTemplate: ({ caseName, slideIndex }) =>
    `Хочу заказать: ${caseName}\n` +
    `Кадр: ${slideIndex}/4\n` +
    `Опишите, пожалуйста, стоимость и сроки.`
};

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function parseImages(attr){
  return String(attr || "").split(",").map(s => s.trim()).filter(Boolean).slice(0,4);
}
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function setDots(pillEl, idx){
  if (!pillEl) return;
  const dots = pillEl.querySelectorAll("i");
  dots.forEach((d,i)=> d.classList.toggle("on", i===idx));
}

const bar = $("#bar");
let lastY = 0, ticking = false;
function onScroll(){
  lastY = window.scrollY || 0;
  if (!ticking){
    ticking = true;
    requestAnimationFrame(() => {
      bar.classList.toggle("is-scrolled", lastY > 6);
      ticking = false;
    });
  }
}
window.addEventListener("scroll", onScroll, { passive:true });
onScroll();

$$("[data-scroll]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const target = $(btn.getAttribute("data-scroll"));
    if (!target) return;
    target.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
  }, { passive:true });
});

(function titleTyping(){
  const el = $("#titleText");
  if (!el) return;
  if (prefersReduced) { el.textContent = "Senk"; return; }

  const words = ["Senk", "Сэнк"];

  const SLOW = 3;
  const typeSpeed = 60 * SLOW;
  const eraseSpeed = 40 * SLOW;
  const hold = 900 * SLOW;

  const pause = (ms) => new Promise(r => setTimeout(r, ms));

  async function typeTo(text){
    const cur = el.textContent || "";
    if (cur === text) return;
    el.textContent = "";
    for (let i=0;i<text.length;i++){
      el.textContent += text[i];
      await pause(typeSpeed);
    }
  }
  async function erase(){
    let s = el.textContent || "";
    while (s.length){
      s = s.slice(0, -1);
      el.textContent = s;
      await pause(eraseSpeed);
    }
  }

  let idx = 0;
  el.textContent = words[0];

  (async function loop(){
    while(true){
      await pause(hold);
      await erase();
      idx = (idx + 1) % words.length;
      await typeTo(words[idx]);
    }
  })();
})();

class Viewer{
  constructor(root, images, { hoverScrub=true } = {}){
    this.root = root;
    this.track = $(".track", root);
    this.pill = $(".pill", root);
    this.images = images;
    this.index = 0;

    this.hoverScrub = hoverScrub;
    this.width = 0;

    this.dragging = false;
    this.startX = 0;
    this.dx = 0;

    this._raf = 0;
    this._pendingRatio = null;

    this._ro = null;

    this._pillTimer = 0;
    this._hovering = false;
    this.pillDelay = 1500;

    this.render();
    this.measure();
    this.bind();
    this.snapTo(0, true);
    this.showPill();
    this.hidePillLater();
  }

  render(){
    this.track.innerHTML = this.images.map((src,i)=>`
      <div class="slide" aria-label="Изображение ${i+1} из 4">
        <img loading="lazy" decoding="async" src="${src}" alt="">
      </div>
    `).join("");
  }

  measure(){ this.width = this.root.getBoundingClientRect().width || 1; }
  setX(px){ this.track.style.setProperty("--x", px + "px"); }

  setPillVisible(visible){
    if (!this.pill) return;
    this.root.dataset.pillHidden = visible ? "false" : "true";
  }

  showPill(){
    this.setPillVisible(true);
    this.hidePillLater();
  }

  hidePillLater(){
    if (!this.pill) return;
    clearTimeout(this._pillTimer);
    this._pillTimer = setTimeout(()=>{
      if (!this.dragging && !this._hovering) this.setPillVisible(false);
    }, this.pillDelay);
  }

  snapTo(idx, instant=false){
    this.index = clamp(idx, 0, 3);
    const x = -this.index * this.width;

    if (instant || prefersReduced){
      const prev = this.track.style.transition;
      this.track.style.transition = "none";
      this.setX(x);
      this.track.offsetHeight;
      this.track.style.transition = prev || "";
    } else {
      this.setX(x);
    }

    setDots(this.pill, this.index);
    this.root.dataset.index = String(this.index);
    this.showPill();
  }

  scheduleByRatio(ratio){
    this._pendingRatio = ratio;
    if (this._raf) return;
    this._raf = requestAnimationFrame(()=>{
      this._raf = 0;
      const r = clamp(this._pendingRatio ?? 0, 0, 0.9999);
      const idx = clamp(Math.floor(r * 4), 0, 3);
      if (idx !== this.index) this.snapTo(idx);
      else this.showPill();
    });
  }

  bind(){
    this._ro = new ResizeObserver(()=>{
      const prev = this.width;
      this.measure();
      if (Math.abs(prev - this.width) > 0.5){
        this.snapTo(this.index, true);
      }
    });
    this._ro.observe(this.root);

    const hoverOk = window.matchMedia("(hover:hover)").matches;

    this.root.addEventListener("mouseenter", ()=>{
      this._hovering = true;
      this.showPill();
    }, { passive:true });

    this.root.addEventListener("mouseleave", ()=>{
      this._hovering = false;
      this.hidePillLater();
    }, { passive:true });

    if (hoverOk && this.hoverScrub){
      this.root.addEventListener("mousemove", (e)=>{
        const rect = this.root.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        this.scheduleByRatio(ratio);
      }, { passive:true });
    }

    this.root.addEventListener("pointerdown", (e)=>{
      if (e.pointerType === "mouse" && hoverOk && this.hoverScrub) return;
      this.dragging = true;
      this.showPill();
      this.startX = e.clientX;
      this.dx = 0;
      this.root.setPointerCapture(e.pointerId);
      this.track.style.transition = "none";
    });

    this.root.addEventListener("pointermove", (e)=>{
      if (!this.dragging) return;
      this.showPill();
      this.dx = e.clientX - this.startX;

      let x = -this.index * this.width + this.dx;
      const minX = -3 * this.width;
      const maxX = 0;

      if (x > maxX) x = maxX + (x - maxX) * 0.25;
      if (x < minX) x = minX + (x - minX) * 0.25;

      this.setX(x);
    });

    const end = ()=>{
      if (!this.dragging) return;
      this.dragging = false;
      this.track.style.transition = prefersReduced ? "none" : "";

      const threshold = this.width * 0.18;
      let next = this.index;
      if (this.dx > threshold) next = this.index - 1;
      if (this.dx < -threshold) next = this.index + 1;
      this.snapTo(next);
      this.hidePillLater();
    };

    this.root.addEventListener("pointerup", end);
    this.root.addEventListener("pointercancel", end);
    this.root.addEventListener("lostpointercapture", end);
  }

  destroy(){
    try{ this._ro && this._ro.disconnect(); } catch(e){}
    this._ro = null;
    clearTimeout(this._pillTimer);
    this.track.innerHTML = "";
  }
}

$$(".js-viewer").forEach(v=>{
  const caseCard = v.closest(".js-case");
  const imgsAttr = caseCard?.getAttribute("data-images") || v.getAttribute("data-images") || "";
  const images = parseImages(imgsAttr);
  new Viewer(v, images, { hoverScrub:true });
});

document.addEventListener("dragstart", (e)=>{
  if (e.target && e.target.tagName === "IMG") e.preventDefault();
}, { passive:false });

let _scrollY = 0;
function lockScroll(lock){
  if (lock){
    _scrollY = window.scrollY || 0;
    document.body.style.position = "fixed";
    document.body.style.top = `-${_scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.overflow = "";
    window.scrollTo(0, _scrollY);
  }
}
function openModal(modalEl){
  modalEl.setAttribute("aria-hidden", "false");
  lockScroll(true);
  const closeBtn = modalEl.querySelector("button.close");
  closeBtn && closeBtn.focus({ preventScroll:true });
}
function closeModal(modalEl){
  modalEl.setAttribute("aria-hidden", "true");
  lockScroll(false);
}

window.addEventListener("keydown", (e)=>{
  if (e.key !== "Escape") return;
  const open = $$(".modal").find(m => m.getAttribute("aria-hidden") === "false");
  if (open) closeModal(open);
});

const caseModal = $("#caseModal");
const caseDots  = $("#caseDots");
const caseName  = $("#caseName");
const caseDesc  = $("#caseDesc");
const caseTasks = $("#caseTasks");
const wantBtn   = $("#wantBtn");
const casePrev  = $("#casePrev");
const caseNext  = $("#caseNext");
const caseViewerRoot = $(".js-modal-viewer");

let activeCase = null;
let caseViewer = null;
let caseObs = null;

function openCase(caseEl){
  const name = caseEl.getAttribute("data-case-name") || "Кейс";
  const desc = caseEl.getAttribute("data-case-desc") || "";
  const tasksRaw = caseEl.getAttribute("data-case-tasks") || "";
  const images = parseImages(caseEl.getAttribute("data-images") || "");

  activeCase = { name, images };

  caseName.textContent = name;
  caseDesc.textContent = desc;

  const tasks = tasksRaw.split("|").map(s=>s.trim()).filter(Boolean);
  caseTasks.innerHTML = tasks.map(t=>`
    <li><span class="b" aria-hidden="true"></span><span>${escapeHtml(t)}</span></li>
  `).join("");

  if (caseObs){ caseObs.disconnect(); caseObs = null; }
  if (caseViewer){ caseViewer.destroy(); caseViewer = null; }

  caseViewer = new Viewer(caseViewerRoot, images, { hoverScrub:false });

  caseObs = new MutationObserver(()=> setDots(caseDots, caseViewer.index));
  caseObs.observe(caseViewerRoot, { attributes:true, attributeFilter:["data-index"] });

  setDots(caseDots, 0);
  openModal(caseModal);
}

function closeCase(){
  if (caseObs){ caseObs.disconnect(); caseObs = null; }
  if (caseViewer){ caseViewer.destroy(); caseViewer = null; }
  activeCase = null;
  closeModal(caseModal);
}

$$(".js-close", caseModal).forEach(el => el.addEventListener("click", closeCase));

$$(".js-open-case").forEach(btn=>{
  btn.addEventListener("click", (e)=>{
    e.stopPropagation();
    const card = btn.closest(".js-case");
    if (card) openCase(card);
  });
});

casePrev.addEventListener("click", ()=>{
  if (!caseViewer) return;
  caseViewer.snapTo(caseViewer.index - 1);
  setDots(caseDots, caseViewer.index);
});
caseNext.addEventListener("click", ()=>{
  if (!caseViewer) return;
  caseViewer.snapTo(caseViewer.index + 1);
  setDots(caseDots, caseViewer.index);
});

wantBtn.addEventListener("click", ()=>{
  if (!activeCase || !caseViewer) return;
  const slideIndex = caseViewer.index + 1;
  const text = CONFIG.orderTemplate({ caseName: activeCase.name, slideIndex });
  const url = `https://t.me/${encodeURIComponent(CONFIG.orderUsername)}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
});

const photoModal = $("#photoModal");
const photoDots  = $("#photoDots");
const photoTitle = $("#photoTitle");
const photoPrev  = $("#photoPrev");
const photoNext  = $("#photoNext");
const photoViewerRoot = $(".js-photo-viewer");

let photoViewer = null;
let photoObs = null;

function openPhotoFromProject(btn){
  const card = btn.closest("article");
  const viewerEl = $(".js-viewer[data-kind='project']", card);
  if (!viewerEl) return;

  const title = viewerEl.getAttribute("data-title") || "Фото";
  const images = parseImages(viewerEl.getAttribute("data-images") || "");

  photoTitle.textContent = `Фото — ${title}`;

  if (photoObs){ photoObs.disconnect(); photoObs = null; }
  if (photoViewer){ photoViewer.destroy(); photoViewer = null; }

  photoViewer = new Viewer(photoViewerRoot, images, { hoverScrub:false });

  photoObs = new MutationObserver(()=> setDots(photoDots, photoViewer.index));
  photoObs.observe(photoViewerRoot, { attributes:true, attributeFilter:["data-index"] });

  setDots(photoDots, 0);
  openModal(photoModal);
}

function closePhoto(){
  if (photoObs){ photoObs.disconnect(); photoObs = null; }
  if (photoViewer){ photoViewer.destroy(); photoViewer = null; }
  closeModal(photoModal);
}

$$(".js-photo").forEach(btn=>{
  btn.addEventListener("click", (e)=>{
    e.stopPropagation();
    openPhotoFromProject(btn);
  });
});

$$(".js-photo-close", photoModal).forEach(el => el.addEventListener("click", closePhoto));

photoModal.addEventListener("click", (e) => {
  if (e.target === photoModal.querySelector(".backdrop")) closePhoto();
});
photoModal.querySelector(".sheet")?.addEventListener("click", (e) => e.stopPropagation());

photoPrev.addEventListener("click", ()=>{
  if (!photoViewer) return;
  photoViewer.snapTo(photoViewer.index - 1);
  setDots(photoDots, photoViewer.index);
});
photoNext.addEventListener("click", ()=>{
  if (!photoViewer) return;
  photoViewer.snapTo(photoViewer.index + 1);
  setDots(photoDots, photoViewer.index);
});

const canvas = $("#fx");
const ctx = canvas.getContext("2d", { alpha:true });

let fxMode = "off";
let W=0, H=0, DPR=1;

const FX = {
  rain:{ drops:[], layers:3 },
  snow:{ flakes:[], layers:3 },
  lastT:0,
  rafId:0
};

const RAIN = { wind:14, slant:0.17, resetPad:40, speedMul:0.5 };

function resizeCanvas(){
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR,0,0,DPR,0,0);
  rebuildFX();
}

function areaBasedCount(){
  const area = W * H;
  const base = Math.sqrt(area) * 0.26;
  return clamp(Math.floor(base), 60, 180);
}

function rebuildFX(){
  FX.rain.drops.length = 0;
  FX.snow.flakes.length = 0;

  const n = areaBasedCount();

  if (fxMode === "rain"){
    for (let l=0; l<FX.rain.layers; l++){
      const depth = (l+1) / FX.rain.layers;
      const count = Math.floor(n * (0.5 + depth*0.4));
      for (let i=0; i<count; i++) FX.rain.drops.push(makeDrop(depth));
    }
  }

  if (fxMode === "snow"){
    for (let l=0; l<FX.snow.layers; l++){
      const depth = (l+1) / FX.snow.layers;
      const count = Math.floor(n * (0.35 + depth*0.35));
      for (let i=0; i<count; i++) FX.snow.flakes.push(makeFlake(depth));
    }
  }
}

function lerp(a,b,t){ return a + (b-a)*t; }

function makeDrop(depth){
  const speed = lerp(560, 980, depth) * (0.85 + Math.random()*0.25);
  const len   = lerp(16, 34, depth)  * (0.8 + Math.random()*0.45);
  const x = Math.random() * W;
  const y = -Math.random() * H;
  const w = lerp(0.7, 1.15, depth);
  const a = lerp(0.10, 0.22, depth);
  const drift = (Math.random() * 2 - 1) * lerp(8, 22, depth);
  return { x, y, speed, len, w, a, depth, drift };
}

function makeFlake(depth){
  const r = lerp(1.0, 2.2, depth) * (0.8 + Math.random()*0.7);
  const speed = lerp(26, 70, depth) * (0.8 + Math.random()*0.55);
  const drift = lerp(10, 28, depth) * (Math.random() < .5 ? -1 : 1);
  const x = Math.random() * W;
  const y = Math.random() * H;
  const a = lerp(0.12, 0.26, depth);
  const phase = Math.random() * Math.PI * 2;
  return { x,y, r, speed, drift, a, phase, depth };
}

function clear(){ ctx.clearRect(0,0,W,H); }

function drawRain(dt){
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,1)";
  const wind = RAIN.wind;
  const slantK = RAIN.slant;
  const pad = RAIN.resetPad;
  const sm = RAIN.speedMul;

  for (const d of FX.rain.drops){
    d.y += d.speed * dt * sm;
    d.x += (wind + d.drift) * dt * (0.35 + d.depth * 0.65) * sm;

    if (d.x < -20) d.x = W + 20;
    if (d.x > W + 20) d.x = -20;

    if (d.y - d.len > H + pad){
      d.y = -Math.random() * (H * 0.35) - d.len;
      d.x = Math.random() * W;
    }

    const slant = d.len * slantK * (0.45 + d.depth * 0.55);

    ctx.globalAlpha = d.a;
    ctx.lineWidth = d.w;

    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x + slant, d.y + d.len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawSnow(dt, t){
  for (const f of FX.snow.flakes){
    f.y += f.speed * dt;
    const sway = Math.sin(t*0.9 + f.phase) * (f.drift * 0.02);
    f.x += sway;

    if (f.y - f.r > H){
      f.y = -Math.random()*H*0.15;
      f.x = Math.random()*W;
    }
    if (f.x < -10) f.x = W + 10;
    if (f.x > W + 10) f.x = -10;

    ctx.globalAlpha = f.a;
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function tick(ts){
  if (!FX.lastT) FX.lastT = ts;
  const dt = Math.min((ts - FX.lastT) / 1000, 0.033);
  FX.lastT = ts;

  clear();
  if (fxMode === "rain") drawRain(dt);
  if (fxMode === "snow") drawSnow(dt, ts/1000);

  FX.rafId = requestAnimationFrame(tick);
}

function startFX(){ if (!FX.rafId) FX.rafId = requestAnimationFrame(tick); }
function stopFX(){
  if (FX.rafId){ cancelAnimationFrame(FX.rafId); FX.rafId = 0; }
  FX.lastT = 0;
  clear();
}

function setFX(mode, silent=false){
  fxMode = mode;
  try { localStorage.setItem("seng_fx_mode", mode); } catch(e){}

  if (!silent){
    $$(".fxbtn").forEach(b=>{
      b.setAttribute("aria-pressed", b.dataset.fx === mode ? "true" : "false");
    });
  }

  if (mode === "off"){ stopFX(); return; }
  rebuildFX();
  startFX();
}

resizeCanvas();
window.addEventListener("resize", ()=> requestAnimationFrame(resizeCanvas), { passive:true });

$$(".fxbtn").forEach(btn=>{
  btn.addEventListener("click", ()=> setFX(btn.dataset.fx), { passive:true });
});

document.addEventListener("visibilitychange", ()=>{
  if (document.hidden) stopFX();
  else if (fxMode !== "off") startFX();
});

(function initFX(){
  let saved = "off";
  try { saved = localStorage.getItem("seng_fx_mode") || "off"; } catch(e){}
  saved = (saved === "rain" || saved === "snow" || saved === "off") ? saved : "off";
  $$(".fxbtn").forEach(b=>{
    b.setAttribute("aria-pressed", b.dataset.fx === saved ? "true" : "false");
  });
  setFX(saved, true);
  if (saved !== "off"){ rebuildFX(); startFX(); }
})();
