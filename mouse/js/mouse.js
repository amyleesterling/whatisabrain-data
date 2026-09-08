/* The whole mouse brain, wired.
 *
 * One scene, four layers, all in the Allen Common Coordinate Framework:
 *
 *   shell     the Allen root structure, a translucent hologram, with the
 *             twelve major divisions faint inside it
 *   cells     positions of real cells from one MERFISH brain, 1 in N of them,
 *             coloured by the Allen taxonomy's 34 classes
 *   axons     a coarse copy of every reconstructed axon at once
 *   focus     one neuron at a time, its whole tree, with a signal leaving the
 *             cell body and running the axon at a slowed, stated speed
 *
 * Everything drawn is measured. The only invented quantity is the speed of
 * the signal, and the card says what it is.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { REDUCED, makeRenderer, fitRenderer, makeLoop, shellMaterials, fmt } from "./holo3d.js";

/* one colour per major division, used for somata, axons and the faint
   region shells alike, so a colour means one thing everywhere on the page */
const DIVISION = {
  "Isocortex": "#6fd0ff", "Olfactory areas": "#ffb24d", "Hippocampal formation": "#3fe3b0",
  "Cortical subplate": "#a8e6cf", "Striatum": "#ff5cc0", "Pallidum": "#d38bff",
  "Thalamus": "#ffd23f", "Hypothalamus": "#ff8a5c", "Midbrain": "#a163ff",
  "Pons": "#7ea6ff", "Medulla": "#f0a0ff", "Cerebellum": "#ffe680",
  "fibre tracts": "#9aa2b1", "ventricles": "#666e7c",
};
const REGION_MESH = {
  "isocortex": "Isocortex", "olfactory-areas": "Olfactory areas",
  "hippocampal-formation": "Hippocampal formation", "striatum": "Striatum",
  "thalamus": "Thalamus", "hypothalamus": "Hypothalamus", "midbrain": "Midbrain",
  "pons": "Pons", "medulla": "Medulla", "cerebellum": "Cerebellum",
  "olfactory-bulb": "Olfactory areas",
};
const SHELL = "#6fd0ff", SHELL_EM = "#1c6ea8", SHELL_WIRE = "#cdefff";
/* data and meshes live beside this module's parent, so a translated copy of
   the page in a subfolder reads the same files */
const ROOT = new URL("../", import.meta.url).href;
/* the neuron data (data/) is too large for the site's own repository, so on
   whatisabrain.com it is read from the public data repository
   github.com/amyleesterling/whatisabrain-data, a copy of this page's data/
   folder. Everywhere else (a local checkout, the data repository's own
   pages) data/ sits beside the page and is read from there. */
const DATA_HOST = "https://amyleesterling.github.io/whatisabrain-data/mouse/";
const DATA = /(^|\.)whatisabrain\.com$/.test(location.hostname) ? DATA_HOST : ROOT;
const R = (p) => (p.startsWith("data/") ? DATA : ROOT) + p;

/* ---- the words. English is the source; the Chinese page sets lang="zh"
   on <html> and every string the script writes comes from here. */
const ZH = document.documentElement.lang.toLowerCase().startsWith("zh");
const T = ZH ? {
  reading: "读取中…", couldNot: "无法读取这个神经元。", clickAny: "点击任意一个胞体。",
  neurons: " 个神经元", oneAtATime: "逐个随机点亮。", bodiesShown: " 个胞体已显示。点击一个。",
  readingAll: "正在读取全部轴突：", drawn: " 个神经元已绘制", segs: " 条轴突线段",
  lh: { reading: (n) => `正在读取 ${n} 个来源`, neurons: " 个神经元", segs: " 条线段", rate: " MB/s", left: (s) => `照此速度约 ${s} 秒后完成`, done: "读取完毕", ofBytes: " / " },
  regionHint: "输入一个脑区，如 海马、CA3、丘脑：看到进出它的全部投射。",
  regionNone: (q) => `没有叫“${q}”的脑区。试试 CA3、HPF、TH 或英文名称。`,
  regionStatus: (acr, name, inner, c) => `${name}（${acr}${inner ? `，含其内 ${inner} 个子区` : ""}）：胞体在此的 ${c.from} 个（金色），轴突末梢落入此处的 ${c.to} 个（青色），两者皆是的 ${c.both} 个（品红）。`,
  dir: { from: "胞体在此", to: "投射到此", both: "两者皆是" },
  loadShell: "脑外壳", loadIndex: "神经元索引", loadCells: "每一个细胞", loadShard: "神经元数据块",
  allDone: (n, s) => `${n} 个神经元，${s} 条轴突线段，每一条都是实测的。此比例下省略了短于 0.3 mm 的末梢。`,
  cellsDone: (k, e, t) => `已绘制 ${k} 个细胞，即这只小鼠脑中已定位的 ${t} 个细胞的十二分之一。`,
  moreClasses: (n) => `另有 ${n} 个细胞类别`, traced: (n) => `已描出 ${n} 个`,
  everyDivision: "所有脑区", unlabelled: "未标注位置",
  whereTips: "轴突末梢落在哪里（按末梢占比）",
  spike: (ms, slow) => `以 1 m/s 传导的动作电位约 <b>${ms} ms</b> 便可跑完这条轴突。这里的信号放慢了 ${slow} 倍，以便观看。`,
  sources: { "MouseLight": "MouseLight（Janelia）", "SEU-ALLEN": "SEU-ALLEN", "ION-PFC": "中科院神经所 前额叶", "ION-HIPP": "中科院神经所 海马", "ION-CTX": "中科院神经所 全皮层" },
  divisions: { "Isocortex": "新皮层", "Olfactory areas": "嗅觉区", "Hippocampal formation": "海马结构",
    "Cortical subplate": "皮层下板", "Striatum": "纹状体", "Pallidum": "苍白球", "Thalamus": "丘脑",
    "Hypothalamus": "下丘脑", "Midbrain": "中脑", "Pons": "脑桥", "Medulla": "延髓", "Cerebellum": "小脑",
    "fibre tracts": "纤维束", "ventricles": "脑室" },
} : {
  reading: "reading…", couldNot: "Could not read that neuron. ", clickAny: "Click any cell body.",
  neurons: " neurons", oneAtATime: "One at a time, at random.", bodiesShown: " cell bodies shown. Click one.",
  readingAll: "Reading every axon: ", drawn: " neurons drawn", segs: " axon segments",
  lh: { reading: (n) => `reading ${n} sources`, neurons: " neurons", segs: " segments", rate: " MB/s", left: (s) => `about ${s} s left at this rate`, done: "every axon read", ofBytes: " of " },
  regionHint: "Type a region, hippocampus, CA3, thalamus, to see every projection to and from it.",
  regionNone: (q) => `No region called "${q}". Try CA3, HPF, TH, or a name.`,
  regionStatus: (acr, name, inner, c) => `${name} (${acr}${inner ? `, with ${inner} regions inside it` : ""}): ${fmt(c.from)} neurons with their cell body there (gold), ${fmt(c.to)} whose axons end there (cyan), ${fmt(c.both)} both (magenta).`,
  dir: { from: "cell body here", to: "axon ends here", both: "both" },
  loadShell: "the brain shell", loadIndex: "the neuron index", loadCells: "every cell", loadShard: "a neuron shard",
  allDone: (n, s) => `${n} neurons, ${s} axon segments, every one of them measured. Twigs under 0.3 mm are left out at this scale.`,
  cellsDone: (k, e, t) => `${k} cells drawn, 1 in ${e} of the ${t} mapped in this brain.`,
  moreClasses: (n) => `and ${n} more classes`, traced: (n) => `${n} traced so far`,
  everyDivision: "every division", unlabelled: "an unlabelled spot",
  whereTips: "Where the axon tips land, by share of tips",
  spike: (ms, slow) => `A spike at 1 m/s would cross this axon in about <b>${ms} ms</b>. The signal here runs ${slow} times slower than that so you can watch it.`,
  sources: {}, divisions: {},
};
const DIV = (k) => T.divisions[k] || k;
const MICRONS = "#ffc24a";
/* The signal runs the arbor at this many millimetres per second of geodesic
   distance from the cell body. A spike in an unmyelinated axon runs at about
   one metre per second, so this is SLOWDOWN times slower than that. The card
   states both. */
const SPEED = 4.0, SLOWDOWN = Math.round(1000 / SPEED);
const HOLD = 1.6;                 /* seconds a finished neuron stays lit */
const TRAIL_MAX = 80;             /* finished neurons kept as faint traces */

export async function mountMouse(el) {
  const mount = el.querySelector("[data-mount]");
  const status = el.querySelector("[data-status]");
  /* ---- the loading bar: fed by the bytes each fetch actually receives */
  const lbar = el.querySelector("[data-lbar]"), lbarFill = el.querySelector("[data-lbar-fill]"), lbarHead = el.querySelector("[data-lbar-head]"), lbarTxt = el.querySelector("[data-lbar-txt]");
  const fmtMB = (b) => b >= 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.round(b / 1e3) + " kB";
  let lbarHide = 0;
  const bar = {
    set(got, total, label) {
      if (!lbar) return; clearTimeout(lbarHide); lbar.classList.remove("is-off");
      const f = total ? Math.min(0.99, got / total) : 0, pct = (f * 100).toFixed(1) + "%";
      lbarFill.style.width = pct; lbarHead.style.left = pct;
      lbarTxt.innerHTML = `<span>${label}</span><span class="u">${total ? `${fmtMB(got)} / ${fmtMB(total)}` : fmtMB(got)}</span>`;
    },
    done() { if (!lbar) return; lbarFill.style.width = "100%"; lbarHead.style.left = "100%"; lbarHide = setTimeout(() => lbar.classList.add("is-off"), 900); },
  };
  /* fetch with the bar: a stream read so the bar moves with the bytes; a
     gzipped answer over-counts against its compressed length, so the fill
     stops at 99 until the last byte lands */
  async function fetchProgress(path, label) {
    const r = await fetch(R(path));
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    const total = +r.headers.get("content-length") || 0;
    if (!r.body) { bar.set(0, 0, label); const b = await r.arrayBuffer(); bar.done(); return b; }
    const reader = r.body.getReader(); const chunks = []; let got = 0;
    bar.set(0, total, label);
    for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; bar.set(got, total, label); }
    const out = new Uint8Array(got); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
    bar.done(); return out.buffer;
  }
  const card = el.querySelector("[data-card]");
  /* The name plate: the card's heading alone, top left on the canvas. The
     rest of the card sits at the right. Both are panels you can drag, and a
     panel dropped with more than thirty percent of it past an edge of the
     stage docks flush to that edge; drag it by its grip to pull it off. */
  const plate = el.querySelector("[data-nameplate]");
  function syncPlate() {
    if (!plate || !card) return;
    const h3 = card.querySelector("h3");
    const body = plate.querySelector("[data-plate-body]");
    if (h3 && body) { body.innerHTML = h3.innerHTML; h3.classList.add("in-plate"); }
    plate.hidden = !h3;
  }
  if (card) new MutationObserver(syncPlate).observe(card, { childList: true });
  if (card) card.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy-id]"); if (!b) return;
    const id = b.dataset.copyId;
    const done = () => { const was = b.textContent; b.textContent = ZH ? "已复制" : "copied"; setTimeout(() => { b.textContent = was; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(id).then(done, done); else done();
  });
  function makeDockable(panel, home) {
    const grip = panel.querySelector(".grip"); if (!grip) return;
    const stage = el.querySelector(".view");
    const key = "mouse.dock." + (panel.dataset.dock || "panel");
    /* a floating panel remembers where it is as a fraction of the stage,
       so a fullscreen stage puts it in the same place, not at the same
       pixel, which on a wide screen was the middle */
    function apply(state) {
      panel.classList.remove("dock-left", "dock-right", "dock-top", "dock-bottom", "floating");
      if (state.dock) { panel.classList.add("dock-" + state.dock); panel.style.left = panel.style.top = ""; return; }
      panel.classList.add("floating");
      const sr = stage.getBoundingClientRect();
      const x = state.fx != null ? state.fx * sr.width : state.x, y = state.fy != null ? state.fy * sr.height : state.y;
      panel.style.left = Math.max(0, Math.min(sr.width - panel.offsetWidth, x)) + "px";
      panel.style.top = Math.max(0, Math.min(sr.height - panel.offsetHeight, y)) + "px";
    }
    let state = null;
    try { state = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) {}
    if (!state) state = { dock: home };
    apply(state);
    /* a panel left floating in a fullscreen stage is off the edge of the
       ordinary one; on any change of size it is pulled back inside, and a
       panel more than half out docks to the side it was nearest */
    function reapply() { apply(state); }
    document.addEventListener("fullscreenchange", () => setTimeout(reapply, 50));
    window.addEventListener("resize", reapply);
    let drag = null;
    grip.addEventListener("pointerdown", (e) => {
      const r = panel.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, sr, w: r.width, h: r.height };
      grip.setPointerCapture(e.pointerId); e.preventDefault();
      panel.classList.add("dragging");
    });
    grip.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const x = e.clientX - drag.dx - drag.sr.left, y = e.clientY - drag.dy - drag.sr.top;
      apply({ x, y });
      state = { x, y };
    });
    const drop = (e) => {
      if (!drag) return;
      panel.classList.remove("dragging");
      const sr = drag.sr, x = state.x, y = state.y, w = drag.w, h = drag.h;
      /* the share of the panel past each edge; the biggest past thirty
         percent wins and the panel docks there */
      const over = { left: -x / w, right: (x + w - sr.width) / w, top: -y / h, bottom: (y + h - sr.height) / h };
      let best = null;
      for (const k in over) if (over[k] > 0.3 && (!best || over[k] > over[best])) best = k;
      state = best ? { dock: best } : { fx: Math.max(0, Math.min(sr.width - w, x)) / sr.width, fy: Math.max(0, Math.min(sr.height - h, y)) / sr.height };
      apply(state);
      try { localStorage.setItem(key, JSON.stringify(state)); } catch (e2) {}
      drag = null;
    };
    grip.addEventListener("pointerup", drop);
    grip.addEventListener("pointercancel", drop);
    grip.addEventListener("dblclick", () => { state = { dock: home }; apply(state); try { localStorage.setItem(key, JSON.stringify(state)); } catch (e2) {} });
  }
  /* scifi-ui's hologram chrome on both panels: four corner brackets that
     push outward when the panel is lit, and a scan sweep that runs once
     whenever the card is rewritten. Ambient things loop; a sweep is an
     event, so it runs once per change and never on its own. */
  function holoChrome(panel) {
    if (!panel || panel.querySelector(".hk")) return;
    ["tl", "tr", "bl", "br"].forEach((k) => { const b = document.createElement("b"); b.className = "hk " + k; panel.appendChild(b); });
    const sweep = document.createElement("i"); sweep.className = "hsweep"; panel.appendChild(sweep);
  }
  function holoBoot(panel) {
    if (!panel || REDUCED) return;
    const sw = panel.querySelector(".hsweep"); if (!sw) return;
    sw.classList.remove("on"); void sw.offsetWidth; sw.classList.add("on");
  }
  holoChrome(plate); holoChrome(el.querySelector("[data-hud]"));
  if (card) new MutationObserver(() => { holoBoot(el.querySelector("[data-hud]")); holoBoot(plate); }).observe(card, { childList: true });
  if (plate) makeDockable(plate, "left");
  const hudPanel = el.querySelector("[data-hud]");
  if (hudPanel) makeDockable(hudPanel, "right");
  syncPlate();
  const legend = el.querySelector("[data-legend]");
  const q = (s) => el.querySelector(s);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 200);
  camera.position.set(0, 3.5, 25);
  camera.lookAt(0, 0, 0);
  const renderer = makeRenderer(mount);
  fitRenderer(renderer, camera, mount);
  /* Bloom is what lets a one pixel axon read at whole-brain scale: the line
     itself stays thin and true, the glow around it is the post pass. The
     threshold sits above the shell and the division tints, so only the lit
     neuron, the somata and the cell cloud bloom. */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.4, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  /* THE CABLE PASS. Nine million line segments drawn additively at one
     alpha have to be drawn at a thousandth of a pixel's light each or the
     pile clips to white, and then a single axon is invisible. So the axon
     layers are drawn on their own, bright, into a floating point buffer
     where the sum is allowed to pass one, and that sum is compressed with a
     soft knee, 1 - exp(-k * light), before it is added to the picture: one
     cable is a line you can see, a thousand on top of each other go
     smoothly toward white. The lines live on layer 1 so the composer never
     sees them. uK is the "cables" slider. */
  const CABLE_LAYER = 1;
  const cableRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const cableMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: cableRT.texture }, uK: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uK; varying vec2 vUv;
      void main() { vec3 c = texture2D(tDiffuse, vUv).rgb * uK;
        /* range across the pile, not a knee. Nine million segments over a
           few hundred thousand pixels is thirty lines a pixel on average, so
           a line bright enough to see alone saturates everything. At 0.012
           a line: ten lines read at 0.2, thirty at 0.4, a hundred at 0.65, a
           thousand at 0.95, and the sparse outer axons stay faint but there. */
        c = pow(c / (c + 1.0), vec3(0.7));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment> }`,
    blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false });
  const cableScene = new THREE.Scene(); cableScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), cableMat));
  const cableCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let cableGain = 1;
  function renderCables() {
    const prevTarget = renderer.getRenderTarget(), prevAuto = renderer.autoClear, prevMask = camera.layers.mask;
    renderer.setRenderTarget(cableRT); renderer.setClearColor(0x000000, 0); renderer.clear();
    camera.layers.set(CABLE_LAYER);
    renderer.render(scene, camera);
    camera.layers.mask = prevMask;
    renderer.setRenderTarget(prevTarget); renderer.autoClear = false;
    renderer.render(cableScene, cableCam);
    renderer.autoClear = prevAuto;
  }
  function fitAll() {
    if (!fitRenderer(renderer, camera, mount)) return;
    const w = mount.clientWidth, h = mount.clientHeight;
    composer.setSize(w, h); bloom.setSize(w, h);
    const pr = renderer.getPixelRatio(); cableRT.setSize(Math.round(w * pr), Math.round(h * pr));
  }
  fitAll();

  /* The CCF has y pointing DOWN (dorsal is y = 0). Turning the whole frame
     half a turn about x puts dorsal up and keeps every triangle's winding. */
  const pivot = new THREE.Group();
  const world = new THREE.Group();
  world.rotation.x = Math.PI;
  pivot.add(world); scene.add(pivot);
  pivot.rotation.y = -0.9;

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(3, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(SHELL), 0.5); rim.position.set(-4, -2, -6); scene.add(rim);

  /* ---- layers ---------------------------------------------------------- */
  const shellG = new THREE.Group(), regionG = new THREE.Group(), cellG = new THREE.Group(),
        axonG = new THREE.Group(), focusG = new THREE.Group(), trailG = new THREE.Group(),
        somaG = new THREE.Group(), micronsG = new THREE.Group(), targetG = new THREE.Group();
  for (const g of [regionG, shellG, cellG, axonG, trailG, focusG, somaG, micronsG, targetG]) world.add(g);
  regionG.visible = true; cellG.visible = false; axonG.visible = false; somaG.visible = false;
  micronsG.visible = true;

  const loader = new GLTFLoader();
  function loadGlb(url, label) {
    return new Promise((res, rej) => loader.load(R(url), (g) => {
      let m = null; g.scene.traverse((o) => { if (o.isMesh && !m) m = o; }); if (label) bar.done(); res(m);
    }, label ? (x) => { if (x.total) bar.set(x.loaded, x.total, label); } : undefined, rej));
  }

  const REGION_A = 0.06, REGION_A_LIT = 0.022, SHELL_A = 0.07, SHELL_A_LIT = 0.04;
  /* the surface slider scales every shell and division tint, 0 to 2x */
  let surfaceGain = 1, divisionGain = 1;
  let shellSolid = null;
  /* the shell: front faces only, no depth write, so the neurons inside show */
  const shellMesh = await loadGlb("meshes/root.glb", T.loadShell);
  shellSolid = shellMaterials(shellMesh, { color: SHELL, emissive: SHELL_EM, emissiveIntensity: 0.25,
    opacity: SHELL_A, side: "front", depthWrite: false, wire: SHELL_WIRE, wireOpacity: 0.012 }).solid;
  shellMesh.renderOrder = 5;
  shellG.add(shellMesh);

  /* ---- a look from the hologram maker ---------------------------------
     The Shader button opens scifi-ui's hologram maker with this view's URL
     as ?to=; the maker sends its look back as ?holo=<base64 json>, and that
     look replaces the shell's material with scifi-ui's hologram shader. The
     volume terms need a thickness prepass this page does not run, so they
     are zeroed. */
  const HOLO_MAKER = "https://amyleesterling.github.io/scifi-ui/hologram-3d.html";
  let holoMat = null, holoLook = null, holoRaw = null;
  const decodeLook = (str) => { try { return JSON.parse(decodeURIComponent(escape(atob(str.replace(/-/g, "+").replace(/_/g, "/"))))); } catch (e) { return null; } };
  async function applyLook(raw) {
    const look = decodeLook(raw); if (!look) return;
    const HM = await import("../vendor/scifi-ui/holo-material.js");
    const opts = Object.assign({}, HM.HOLO_DEFAULTS, HM.HOLO_ERAS[look.era] || {}, HM.HOLO_STYLES[look.style] || {}, look);
    opts.density = 0; opts.halo = 0; opts.solid = 0; opts.touch = 0;
    delete opts.era; delete opts.style;
    if (holoMat) { holoMat.dispose(); }
    holoMat = HM.makeHologramMaterial(opts);
    HM.applyHologram(shellMesh, holoMat);
    holoMat.userData.tick = HM.tickHologram; holoMat.userData.gain = opts.opacity;
    shellSolid = null; holoLook = look; holoRaw = raw;
    loop.once();
  }
  const shaderBtn = q("[data-shader]");
  if (shaderBtn) shaderBtn.addEventListener("click", () => {
    const back = new URL(location.href); back.search = viewParams().toString();
    const u = new URL(HOLO_MAKER); u.searchParams.set("to", back.toString());
    if (holoRaw) u.searchParams.set("holo", holoRaw);
    shaderBtn.href = u.toString();
  });

  /* the divisions, each a faint additive tint in its own colour */
  const regionMats = [];
  Promise.all(Object.keys(REGION_MESH).map(async (name) => {
    const m = await loadGlb(`meshes/${name}.glb`);
    const c = new THREE.Color(DIVISION[REGION_MESH[name]]);
    m.material = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.06,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide });
    regionMats.push(m.material);
    m.renderOrder = 1;
    regionG.add(m);
  })).catch((e) => console.warn("regions", e));

  /* ---- the dive cubes ----------------------------------------------------
     Two boxes at true size mark the places where a connectome exists: the
     MICrONS cubic millimetre in primary visual cortex and the CA3 volume of
     Zheng et al. Each sits at the centroid of its region in the reference
     brain (the volumes are not registered to it, so the placement is
     approximate and the card says so). Click one and the camera dives in;
     the reconstructed cells appear inside at true scale and white dots mark
     their real synapses, read from each pack's files. */
  const CUBES = [
    { id: "microns", region: "visp", regionAcr: "VISp", side: "left", pack: "data/microns/cube.json", dir: "meshes/microns/",
      name: ZH ? "MICrONS 一立方毫米" : "the MICrONS cubic millimetre", colour: MICRONS, short: "MICrONS V1",
      /* cells in the whole volume: nucleus detections in the pack's own frame note */
      population: { n: 144120, what: ZH ? "个有细胞核的细胞" : "cells with a detected nucleus", src: "nucleus_detection_v0 at v1300" },
      note: ZH ? "MICrONS 联盟，Nature 640, 435 (2025)：初级视觉皮层的一立方毫米，每一个突触。" : "MICrONS Consortium, Nature 640, 435 (2025): one cubic millimetre of primary visual cortex, every synapse.",
      link: "https://amyleesterling.github.io/microns/" },
    { id: "ca3", region: "CA3", regionAcr: "CA3", side: "left", pack: "data/ca3/cube.json", dir: "meshes/ca3/",
      name: ZH ? "CA3 连接组" : "the CA3 connectome", colour: "#3fe3b0", short: "CA3", dorsal: true,
      population: { n: 13724, what: ZH ? "个有细胞核的细胞" : "cells with a detected nucleus", src: "c3_nuclei_v1" },
      /* the block was cut in coronal sections with the apical direction up:
         pack z (the sectioning axis) runs anterior to posterior, pack x lies
         across the section, pack y is apical. In the atlas that is x = pack
         z, y = -pack y, z = pack x. In-plane rotation and hemisphere are not
         recorded, so this is the orientation of the cut, not a registration. */
      basis: [[0, 0, 1], [0, -1, 0], [1, 0, 0]],
      note: ZH ? "Zheng 等，bioRxiv 2025（doi:10.1101/2025.07.09.663979）：海马 CA3 的电镜重建，苔藓纤维输入。" : "Zheng et al., bioRxiv 2025 (doi:10.1101/2025.07.09.663979): an electron-microscopy reconstruction of hippocampal CA3, the mossy fibre inputs.",
      link: "https://amyleesterling.github.io/ca3/" },
  ];
  const cubeMeshes = [];
  let RINFO = {};
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  let inside = null;                  /* the cube we are inside, if any */
  const packG = new THREE.Group(); world.add(packG);
  /* the dorsal third of a region's left half: where a dorsal-hippocampus
     block would sit. y grows ventrally in this frame. */
  function dorsalCentroid(geo) {
    geo.computeBoundingBox(); const bb = geo.boundingBox, c = new THREE.Vector3(); bb.getCenter(c);
    const cut = bb.min.y + 0.35 * (bb.max.y - bb.min.y);
    const pos = geo.attributes.position, cc = new THREE.Vector3(); let n = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getZ(i) < c.z && pos.getY(i) < cut) { cc.x += pos.getX(i); cc.y += pos.getY(i); cc.z += pos.getZ(i); n++; }
    return n ? cc.multiplyScalar(1 / n) : c;
  }
  function leftCentroid(geo) {
    geo.computeBoundingBox(); const c = new THREE.Vector3(); geo.boundingBox.getCenter(c);
    const pos = geo.attributes.position, cc = new THREE.Vector3(); let n = 0;
    for (let i = 0; i < pos.count; i++) if (pos.getZ(i) < c.z) { cc.x += pos.getX(i); cc.y += pos.getY(i); cc.z += pos.getZ(i); n++; }
    return n ? cc.multiplyScalar(1 / n) : c;
  }
  async function placeCubes() {
    for (const cu of CUBES) {
      let m = null;
      try {
        if (cu.id === "microns") m = await loadGlb("meshes/visp.glb");
        else { const info = RINFO[cu.regionAcr] || (await (await fetch(R("data/regions.json"))).json())[cu.regionAcr]; if (info && info.file) m = await loadGlb(`meshes/regions/${info.file}`); }
      } catch (e) { continue; }
      if (!m) continue;
      /* the volume's true extent, read from its pack before the box is drawn */
      let ext = [1, 1, 1];
      try { const pk = await (await fetch(R(cu.pack))).json(); ext = pk.tissueExtent_mm || pk.size_mm || ext; cu.packMeta = pk; } catch (e) {}
      cu.ext = ext;
      const centre = cu.dorsal ? dorsalCentroid(m.geometry) : leftCentroid(m.geometry);
      cu.centre = centre; cu.size = Math.max(...ext);
      cu.quat = new THREE.Quaternion();
      if (cu.basis) { const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(...cu.basis[0]), new THREE.Vector3(...cu.basis[1]), new THREE.Vector3(...cu.basis[2])); cu.quat.setFromRotationMatrix(M); }
      else cu.quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
      const cube = new THREE.Mesh(new THREE.BoxGeometry(ext[0], ext[1], ext[2]),
        new THREE.MeshBasicMaterial({ color: cu.colour, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
      cube.position.copy(centre); cube.quaternion.copy(cu.quat); cube.userData.cube = cu;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: cu.colour, transparent: true, opacity: 0.9 }));
      cube.add(edges); micronsG.add(cube); cubeMeshes.push(cube);
      m.material = new THREE.MeshBasicMaterial({ color: cu.colour, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false });
      micronsG.add(m);
    }
  }
  placeCubes().catch(() => {});

  /* A cell as tissue, not plastic. Matte, a soft sheen the way a membrane
     catches light, no metal, and a fresnel rim in the cell's own colour so
     the silhouette of every branch reads against the ones behind it.
     Submerged tissue is never glossy; the rim carries the form instead. */
  function tissueMaterial(col, featured, neighbour) {
    const m = new THREE.MeshPhysicalMaterial({
      color: col, roughness: 0.88, metalness: 0, sheen: 0.55, sheenRoughness: 0.85,
      sheenColor: col.clone().lerp(new THREE.Color("#ffffff"), 0.5),
      emissive: col, emissiveIntensity: featured ? 0.08 : 0.04,
      transparent: !!neighbour, opacity: neighbour ? 0.9 : 1 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRim = { value: col.clone().multiplyScalar(featured ? 0.9 : 0.6) };
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>" + String.fromCharCode(10) + "uniform vec3 uRim;")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>" + String.fromCharCode(10) +
          "{ vec3 nV = normalize(vViewPosition); float f = pow(1.0 - abs(dot(normalize(normal), nV)), 3.0); totalEmissiveRadiance += uRim * f; }");
    };
    return m;
  }
  const packCache = {};
  async function loadPack(cu) {
    if (packCache[cu.id]) return packCache[cu.id];
    const pack = await (await fetch(R(cu.pack))).json();
    const group = new THREE.Group();
    /* the pack frame is millimetres about the volume centre with Y up; the
       group takes the cube's orientation (a half turn about x for MICrONS,
       the coronal-cut basis for CA3). Stated on the card. */
    group.quaternion.copy(cu.quat || new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
    const cells = [];
    let synCount = 0;
    /* the pack's own units and file names: synapse bins are Int16 in
       unit_um (1 um after the rebuild), files are repo-relative paths */
    const unit = (pack.synapseBin && pack.synapseBin.unit_um) || (pack.synapses && pack.synapses.unit_mm ? pack.synapses.unit_mm * 1000 : 10);
    /* Two layouts ship. MICrONS writes N Int16 xyz then N flags (planar);
       CA3 writes seven bytes per point, x y z flag (interleaved), and says
       so in its layout string. Read the one the pack declares: reading the
       CA3 file as planar takes every value past the first across a record
       boundary, which drew the featured cell's synapses as a ghost of its
       arbor several millimetres wide outside the cube. */
    const layoutOf = (o) => (o && o.layout) || "";
    const interleaved = /per point/i.test(layoutOf(pack.synapses) + " " + layoutOf(pack.synapseBin));
    function readSyn(buf) {
      const n = Math.floor(buf.byteLength / 7);
      const q = new Int16Array(n * 3), fl = new Uint8Array(n);
      if (interleaved) {
        const dv = new DataView(buf);
        for (let i = 0; i < n; i++) { q[i * 3] = dv.getInt16(i * 7, true); q[i * 3 + 1] = dv.getInt16(i * 7 + 2, true); q[i * 3 + 2] = dv.getInt16(i * 7 + 4, true); fl[i] = dv.getUint8(i * 7 + 6); }
      } else {
        q.set(new Int16Array(buf, 0, n * 3)); fl.set(new Uint8Array(buf, n * 6, n));
      }
      return { n, q, fl };
    }
    const CAT = { excitatory: "#6fd0ff", inhibitory: "#ff5cc0", glia: "#3fe3b0",
                  "pyramidal cell": "#ffd23f", "mossy fibre": "#3fe3b0" };
    /* one synapse bin for the whole pack (CA3: the featured cell's), read
       once and drawn with the featured cell; flag 2 marks autapses, drawn
       dimmer */
    async function dots(file, colourIn, colourAuto) {
      const buf = await (await fetch(R(file))).arrayBuffer();
      const { n, q, fl } = readSyn(buf);
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      const cw = new THREE.Color("#ffffff"), ca = new THREE.Color(colourAuto || "#666e7c");
      for (let i = 0; i < n; i++) {
        pos[i * 3] = q[i * 3] * unit / 1000; pos[i * 3 + 1] = q[i * 3 + 1] * unit / 1000; pos[i * 3 + 2] = q[i * 3 + 2] * unit / 1000;
        const c = fl[i] === 2 ? ca : cw; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ vertexColors: true, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.4, depthWrite: false }));
      pts.renderOrder = 13; return { pts, n, fl };
    }
    const featuredSlug = pack.featured && pack.featured.slug;
    for (const cell of (pack.cells || pack.meshes || [])) {
      if (!cell.category && cell.role) cell.category = cell.role;
      if (!cell.type && cell.role) cell.type = cell.role;
      const file = cell.file.startsWith("meshes/") || cell.file.startsWith("data/") ? cell.file : cu.dir + cell.file;
      let m; try { m = await loadGlb(file); } catch (e) { continue; }
      if (!m.geometry.attributes.normal) m.geometry.computeVertexNormals();
      /* the neighbours each get a colour of their own from a warm palette,
         so packed cells can be told apart; the featured cell stays cream,
         the fibres green */
      const NEIGHBOUR = ["#e0b060", "#c98a5b", "#d9c48a", "#b98e7a", "#e6a86b", "#cdb27e", "#d4a373", "#bfa27a", "#e3b98a", "#c7a06a"];
      const isNeighbour = featuredSlug && cell.role === "pyramidal cell" && !cell.featured;
      const col = new THREE.Color(cell.colour || (cell.featured ? "#fff1c0" : null) || (isNeighbour ? NEIGHBOUR[cells.length % NEIGHBOUR.length] : null) || CAT[cell.category] || cu.colour);
      m.material = tissueMaterial(col, cell.featured, isNeighbour);
      m.renderOrder = 12; group.add(m); cells.push({ cell, mesh: m, colour: col });
      if (pack.synapses && pack.synapses.file && cell.featured) {
        try { const d = await dots(pack.synapses.file); group.add(d.pts); synCount += d.n; cell.synCount = d.n; cells[cells.length - 1].dots = d.pts; } catch (e) {}
      }
      /* glia carry automated detections that are not synapses in the sense
         the page means; their dots stay off and the card says so */
      const synFile = cell.synapses && (cell.synapses.file || (typeof cell.synapses === "string" ? cell.synapses : null));
      if (synFile && cell.category !== "glia") {
        try {
          const buf = await (await fetch(R(synFile.startsWith("data/") ? synFile : cu.dir.replace("meshes/", "data/") + synFile))).arrayBuffer();
          const { n, q, fl } = readSyn(buf);
          const pos = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) pos[i] = q[i] * unit / 1000;
          const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: "#ffffff", size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.4, depthWrite: false }));
          pts.renderOrder = 13; group.add(pts); synCount += n; cell.synCount = n; cell.flags = fl; cells[cells.length - 1].dots = pts;
        } catch (e) {}
      }
    }
    /* the tissue's true extent replaces the marker box while inside */
    const ext = pack.tissueExtent_mm || pack.extent_mm || pack.size_mm;
    if (ext) {
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(ext[0], ext[1], ext[2])),
        new THREE.LineBasicMaterial({ color: cu.colour, transparent: true, opacity: 0.6 }));
      group.add(edges);
    }
    packCache[cu.id] = { pack, group, cells, synCount };
    return packCache[cu.id];
  }
  const h1 = document.querySelector("h1"); const h1Home = h1 ? h1.textContent : "";
  async function dive(cu) {
    if (!cu.centre) return;
    inside = cu; zoomUser = 1;
    if (h1 && cu.population) h1.textContent = ZH ? `${cu.name}：${fmt(cu.population.n)} ${cu.population.what}` : `${cu.name}: ${fmt(cu.population.n)} ${cu.population.what}`;
    if (current) { retire(current); current = null; }
    autoNext = false;
    status.textContent = ZH ? `正在进入${cu.name}…` : `Diving into ${cu.name}…`;
    let pk; try { pk = await loadPack(cu); } catch (e) { status.textContent = (ZH ? "这个立方体的数据还没有到位。" : "This cube's data is not on the site yet. ") + cu.note; inside = null; return; }
    if (inside !== cu) return;
    packG.clear(); pk.group.position.copy(cu.centre); packG.add(pk.group);
    /* up close the box is an outline, not a fill: a fill over the whole
       view is what hid the neighbour cells */
    for (const c of cubeMeshes) c.material.opacity = c.userData.cube === cu ? 0 : 0.22;
    renderCubeCard(cu, pk);
    if (h1 && cu.population) h1.textContent = ZH ? `${cu.name}：${fmt(pk.cells.length)} / ${fmt(cu.population.n)} ${cu.population.what}` : `${fmt(pk.cells.length)} of ${fmt(cu.population.n)} cells in ${cu.name}`;
    syncCubeBtns();
    status.textContent = (ZH ? `${cu.name}：${fmt(pk.cells.length)} 个细胞，${fmt(pk.synCount)} 个真实突触。滚轮靠近或拉远到整个脑。` : `${cu.name}: ${fmt(pk.cells.length)} reconstructed cells, ${fmt(pk.synCount)} real synapses as white dots. Scroll in to come closer, out to see it in the whole brain.`);
  }
  function leaveCube() {
    inside = null; packG.clear(); syncStatus(); if (h1) h1.textContent = h1Home; syncCubeBtns();
    for (const c of cubeMeshes) c.material.opacity = 0.22;
    if (mode === "wire") { autoNext = true; const r = pickRandom(); if (r) focusOn(r); }
  }
  function renderCubeCard(cu, pk) {
    if (!card) return;
    /* the packs name their cells in English; the Chinese page says them in Chinese */
    const CN = { "CA3 pyramidal cell (thorny)": "CA3 锥体细胞（有棘）", "CA3 pyramidal cell (thorny), neighbour": "CA3 锥体细胞（有棘），邻近", "mossy fibre": "苔藓纤维", "pyramidal cell": "锥体细胞",
      "Layer 5 Thick-Tufted Pyramidal": "第 5 层厚簇锥体细胞", "Chandelier Cell": "吊灯细胞", "Parvalbumin Basket Cell": "小清蛋白篮状细胞", "Layer 2/3 Pyramidal": "第 2/3 层锥体细胞", "Layer 4 Cell": "第 4 层细胞",
      "Protoplasmic Astrocyte": "原浆型星形胶质细胞", "Martinotti Cell": "Martinotti 细胞", "Bipolar Interneuron": "双极中间神经元", "Pyramidal Neuron": "锥体神经元", "Long-range Axon": "长程轴突", "Microglia": "小胶质细胞" };
    const cn = (t) => (ZH && t && CN[t]) || t || "";
    const rows = pk.cells.map((c, i) => `<button class="kk" data-cell="${i}"><s style="background:${c.colour.getStyle()}"></s><b>${cn(c.cell.name) || c.cell.slug}</b><span class="kd">${cn(c.cell.type)}</span><span class="kn">${c.cell.synCount ? fmt(c.cell.synCount) : (c.cell.category === "glia" ? (ZH ? "胶质" : "glia") : "")}</span></button>`).join("");
    const ext = pk.pack.tissueExtent_mm || pk.pack.size_mm;
    const extNote = ext ? (ZH ? `实际组织范围 ${ext.map((v) => v.toFixed(2)).join(" × ")} mm。` : `The imaged tissue is ${ext.map((v) => v.toFixed(2)).join(" by ")} mm.`) : "";
    card.innerHTML = `<h3><s style="background:${cu.colour}"></s>${cu.name}</h3>` +
      `<p class="side">${cu.note} <a href="${cu.link}" target="_blank" rel="noopener">${ZH ? "查看该项目" : "See the project"}</a></p>` +
      (cu.population ? `<p class="side">${ZH ? `整个体积含 ${fmt(cu.population.n)} ${cu.population.what}（${cu.population.src}）；这里画出 ${fmt(pk.cells.length)} 个。` : `The whole volume holds ${fmt(cu.population.n)} ${cu.population.what} (${cu.population.src}); ${fmt(pk.cells.length)} are drawn here.`}</p>` : "") +
      `<p>${ZH ? `${cu.dorsal ? `这个体积放在参考脑中背侧 ${cu.regionAcr} 的位置，按切片方向摆放（冠状切面，顶树突向上）。` : `这个体积放在参考脑中 ${cu.regionAcr} 的中心。`}位置是近似的：这些数据没有配准到图谱，切面内的旋转和左右半球都未记录。体积内的细胞和突触是真实的，尺度是真实的。${extNote}` : `${cu.dorsal ? `The volume sits in dorsal ${cu.regionAcr} of the reference brain, turned the way it was cut: coronal sections, apical dendrites up.` : `The volume sits at the centre of ${cu.regionAcr} in the reference brain.`} The place is approximate: it is not registered to the atlas, and the in-plane rotation and the hemisphere were not recorded. What is inside is real and at true scale, and every white dot is a synapse from the reconstruction's own table, incoming and outgoing. ${extNote}${pk.cells.some((c) => c.cell.category === "glia") ? (ZH ? " 胶质细胞不画突触点：表里那些是自动检测，不是突触。" : " The glia carry no dots: the detections attached to them are not synapses.") : ""}`}</p>` +
      `<div class="klist">${rows}</div>` +
      `<p class="badge">${ZH ? "点击一个细胞可高亮。" : "Click a cell to lift it."} <button class="btn" data-leave>${ZH ? "退出立方体" : "Leave the cube"}</button></p>`;
    card.querySelectorAll("[data-cell]").forEach((b) => b.addEventListener("click", () => {
      const i = +b.dataset.cell;
      pk.cells.forEach((c, j) => { c.mesh.material.emissiveIntensity = j === i ? 0.6 : 0.05; c.mesh.material.opacity = 1; });
      card.querySelectorAll("[data-cell]").forEach((x) => x.classList.toggle("is-on", x === b));
    }));
    const lv = card.querySelector("[data-leave]"); if (lv) lv.addEventListener("click", leaveCube);
  }
  function pickCube(ev) {
    if (!cubeMeshes.length || !micronsG.visible) return null;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1; ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(cubeMeshes, false);
    return hits.length ? hits[0].object.userData.cube : null;
  }

  /* ---- target regions ----------------------------------------------------
     When a neuron is lit, the named regions its axon ends in are drawn as
     tinted shells and labelled; a click on a bar in the card lifts one. */
  const regionCache = {};
  const rlabels = el.querySelector("[data-rlabels]");
  let shown = [];              /* [{acr, mesh, mat, label, strong}] */
  function regionMesh(acr) {
    if (regionCache[acr]) return regionCache[acr];
    const info = RINFO[acr];
    if (!info || !info.file) return null;
    regionCache[acr] = loadGlb(`meshes/regions/${info.file}`).then((m) => {
      m.geometry.computeBoundingBox();
      const c = new THREE.Vector3(); m.geometry.boundingBox.getCenter(c);
      m.userData.center = c;
      return m;
    });
    return regionCache[acr];
  }
  function clearTargets() {
    for (const t of shown) { targetG.remove(t.mesh); t.mat.dispose(); if (t.label) t.label.remove(); }
    shown = [];
  }
  async function showTargets(rec) {
    clearTargets();
    if (!rec) return;
    /* the cell body's region first, then the targets; a target that is also
       the home region is one entry carrying both notes */
    const want = [];
    if (rec.rf) want.push({ acr: rec.rf, share: 0, soma: true });
    for (const [acr, share] of (rec.tf || [])) {
      if (share < 0.12 || acr === "root") continue;
      const same = want.find((w) => w.acr === acr);
      if (same) same.share = share; else want.push({ acr, share });
    }
    for (const w of want.slice(0, 4)) {
      const p = regionMesh(w.acr); if (!p) continue;
      const src = await p; if (!current || current.rec !== rec) return;
      const info = RINFO[w.acr] || {};
      const col = new THREE.Color(DIVISION[info.major] || "#9aa2b1");
      /* normal blending, not additive: an additive shell under bloom turned
         the whole hippocampus into a green flare that hid the neuron. This
         is bounded, so a region reads as tinted glass the axon runs through. */
      const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.045 + 0.08 * w.share,
        blending: THREE.NormalBlending, depthWrite: false, side: THREE.FrontSide });
      const mesh = new THREE.Mesh(src.geometry, mat); mesh.renderOrder = 3; targetG.add(mesh);
      let label = null;
      if (rlabels) {
        label = document.createElement("button"); label.className = "rlbl" + (w.soma ? " soma" : "");
        const notes = [w.soma ? (ZH ? "胞体" : "cell body") : null, w.share ? `${Math.round(w.share * 100)}%` : null].filter(Boolean).join(" · ");
        label.innerHTML = `<b>${w.acr}</b><small>${notes}</small>`; label.title = info.name || w.acr;
        label.style.borderColor = col.getStyle(); label.dataset.acr = w.acr;
        label.addEventListener("click", () => liftRegion(w.acr));
        rlabels.appendChild(label);
      }
      shown.push({ acr: w.acr, mesh, mat, label, base: mat.opacity, center: src.userData.center, strong: false });
    }
  }
  function liftRegion(acr) {
    for (const t of shown) {
      t.strong = (t.acr === acr) ? !t.strong : false;
      t.mat.opacity = t.strong ? 0.2 : t.base;
      if (t.label) t.label.classList.toggle("is-on", t.strong);
    }
    el.querySelectorAll("[data-tb]").forEach((b) => b.classList.toggle("is-on", shown.some((t) => t.strong && t.acr === b.dataset.tb)));
    const s = shown.find((t) => t.strong);
    if (s) { const info = RINFO[s.acr] || {}; status.textContent = `${s.acr}: ${info.name || ""}`; } else syncStatus();
  }
  const tmpL = new THREE.Vector3();
  function placeRegionLabels() {
    if (!rlabels || !shown.length) return;
    const w = mount.clientWidth, h = mount.clientHeight;
    const placed = [];
    for (const t of shown) {
      if (!t.label) continue;
      tmpL.copy(t.center); world.localToWorld(tmpL); tmpL.project(camera);
      let x = (tmpL.x + 1) / 2 * w, y = (1 - tmpL.y) / 2 * h;
      const off = tmpL.z > 1 || x < 0 || x > w || y < 0 || y > h;
      /* regions that sit on top of each other, CA1 over CA3, get their
         labels stacked instead of overprinted */
      for (const q of placed) if (Math.abs(q.x - x) < 80 && Math.abs(q.y - y) < 18) y = q.y + 18;
      placed.push({ x, y });
      t.label.style.left = x + "px"; t.label.style.top = y + "px";
      t.label.style.opacity = off ? "0" : "";
    }
  }

  /* ---- the neuron index -------------------------------------------------- */
  const meta = JSON.parse(new TextDecoder().decode(await fetchProgress("data/neurons.json", T.loadIndex)));
  const N = meta.neurons;
  /* the named regions an axon can land in: acronym -> {name, major, file} */
  fetch(R("data/regions.json")).then((r) => r.json()).then((j) => { RINFO = j; }).catch(() => {});
  /* full region names live in one table keyed by acronym */
  const REGIONS = meta.regions || {};
  for (const r of N) if (!r.region_name && r.region) r.region_name = REGIONS[r.region];
  /* the detail lives in shards under 50 MB each, fetched by byte range one
     neuron at a time; a server without range support hands back the whole
     shard once and it is kept */
  const shardWhole = {};
  async function neuronBytes(rec) {
    const file = R(`data/neurons-${rec.shard || 0}.bin`);
    if (shardWhole[file]) return shardWhole[file].slice(rec.offset, rec.offset + rec.bytes);
    const r = await fetch(file, { headers: { Range: `bytes=${rec.offset}-${rec.offset + rec.bytes - 1}` } });
    if (r.status === 206) return await r.arrayBuffer();
    shardWhole[file] = r.body ? await (async () => { const total = +r.headers.get("content-length") || 0, rd = r.body.getReader(), ch = []; let got = 0; bar.set(0, total, T.loadShard); for (;;) { const { done, value } = await rd.read(); if (done) break; ch.push(value); got += value.length; bar.set(got, total, T.loadShard); } const o = new Uint8Array(got); let k = 0; for (const c of ch) { o.set(c, k); k += c.length; } bar.done(); return o.buffer; })() : await r.arrayBuffer();
    return shardWhole[file].slice(rec.offset, rec.offset + rec.bytes);
  }
  /* packed polylines -> segment pairs for LineSegments. Layout in
     neurons.json: Uint32 P, Uint32 V, P x Uint16 counts, V x Int16 xyz, then
     for the detail V x Uint16 dist and V x Uint8 compartment. */
  function unpack(buf, off, withDist) {
    /* a DataView, not a Uint32Array: blocks follow one another in the
       coarse file and a block whose path count is odd leaves the next one
       at an offset that is not a multiple of four, which a typed array
       view refuses. The Int16 and Uint16 sections always land on even bytes. */
    const dv = new DataView(buf, off, 8), P = dv.getUint32(0, true), V = dv.getUint32(4, true);
    const counts = new Uint16Array(buf, off + 8, P);
    const xyz = new Int16Array(buf, off + 8 + 2 * P, V * 3);
    const dist = withDist ? new Uint16Array(buf, off + 8 + 2 * P + 6 * V, V) : null;
    const comp = withDist ? new Uint8Array(buf, off + 8 + 2 * P + 8 * V, V) : null;
    let S = 0; for (let i = 0; i < P; i++) S += counts[i] - 1;
    const pos = new Float32Array(S * 6), d = withDist ? new Float32Array(S * 2) : null,
          c = withDist ? new Float32Array(S * 2) : null;
    let v = 0, o = 0, k = 0, maxD = 0;
    for (let i = 0; i < P; i++) {
      const n = counts[i];
      for (let j = 0; j < n - 1; j++) {
        const a = v + j, b = a + 1;
        pos[o++] = xyz[a * 3] / 100; pos[o++] = xyz[a * 3 + 1] / 100; pos[o++] = xyz[a * 3 + 2] / 100;
        pos[o++] = xyz[b * 3] / 100; pos[o++] = xyz[b * 3 + 1] / 100; pos[o++] = xyz[b * 3 + 2] / 100;
        if (withDist) {
          d[k] = dist[a] / 100; d[k + 1] = dist[b] / 100; if (d[k + 1] > maxD) maxD = d[k + 1];
          c[k] = comp[b]; c[k + 1] = comp[b]; k += 2;
        }
      }
      v += n;
    }
    return { pos, dist: d, comp: c, segs: S, maxDist: maxD };
  }

  /* somata, one point each, coloured by division; the click target */
  {
    const pos = new Float32Array(N.length * 3), col = new Float32Array(N.length * 3);
    const c = new THREE.Color();
    N.forEach((r, i) => {
      pos[i * 3] = r.soma[0]; pos[i * 3 + 1] = r.soma[1]; pos[i * 3 + 2] = r.soma[2];
      c.set(DIVISION[r.major] || "#9aa2b1"); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    /* normal blending: ten thousand hippocampal cell bodies stacked
       additively summed to a white flare that swallowed the neuron */
    const somaPts = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, vertexColors: true,
      transparent: true, opacity: 0.6, blending: THREE.NormalBlending, depthWrite: false,
      sizeAttenuation: false }));
    somaG.add(somaPts);
    somaG.userData.points = somaPts;
  }

  /* ---- the focus neuron material ---------------------------------------- */
  /* dist is geodesic distance from the soma in mm; uGrow is how far the signal
     has got. Vertices beyond it are discarded, a bright head sits at the front,
     and the compartment picks the tint: axon in the division colour, dendrite
     in a paler, whiter version so the two read apart. */
  function focusMaterial(tint) {
    return new THREE.ShaderMaterial({
      uniforms: { uGrow: { value: 0 }, uTint: { value: new THREE.Color(tint) },
                  uAlpha: { value: 1 }, uHead: { value: 1 } },
      vertexShader:
        "attribute float dist; attribute float comp;\n" +
        "varying float vd; varying float vc;\n" +
        "void main(){ vd = dist; vc = comp;\n" +
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader:
        "uniform float uGrow; uniform vec3 uTint; uniform float uAlpha; uniform float uHead;\n" +
        "varying float vd; varying float vc;\n" +
        "void main(){\n" +
        "  if (vd > uGrow) discard;\n" +
        "  float head = exp(-(uGrow - vd) / 0.35) * uHead;\n" +
        "  vec3 base = (vc > 2.5) ? uTint * 0.9 : mix(uTint, vec3(1.0), 0.5);\n" +
        "  vec3 c = base * (0.95 + 1.1 * head);\n" +
        "  float a = (vc > 2.5 ? 0.95 : 0.85) * uAlpha + 0.4 * head;\n" +
        "  gl_FragColor = vec4(c, a);\n" +
        "  #include <tonemapping_fragment>\n" +
        "  #include <colorspace_fragment>\n" +
        "}",
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
  }
  function neuronGeometry(rec, buf) {
    const u = unpack(buf, 0, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(u.pos, 3));
    g.setAttribute("dist", new THREE.BufferAttribute(u.dist, 1));
    g.setAttribute("comp", new THREE.BufferAttribute(u.comp, 1));
    g.userData.maxDist = u.maxDist;
    return g;
  }

  /* ---- state ------------------------------------------------------------ */
  let mode = "wire";            /* wire | pick | all */
  let filterSrc = "all", filterDiv = "all", filterRegion = "";
  let current = null;           /* { rec, mesh, mat, t, done } */
  let holdT = 0, seq = 0, autoNext = true;
  let dragging = false, lastX = 0, lastY = 0, vel = 0, idleTurn = !REDUCED;
  /* framing: the whole brain by default; while a neuron is lit the frame
     slides so its cell body sits mid screen and the camera comes in to a
     distance set by how far its axon reaches */
  const HOME_Z = 25;
  const frameTarget = new THREE.Vector3(0, 0, 0), frameNow = new THREE.Vector3(0, 0, 0);
  let zTarget = HOME_Z, zNow = HOME_Z, zoomIn = true;
  /* the wheel zooms: a factor on the camera distance, kept between a quarter
     and two and a half times the framed distance, eased in the loop */
  let zoomUser = 1, zoomUserNow = 1;
  const tmpV = new THREE.Vector3();
  function retarget() {
    if (inside && inside.centre) {
      tmpV.copy(inside.centre).applyQuaternion(world.quaternion);
      frameTarget.copy(tmpV).negate(); zTarget = 3.2; return;
    }
    if (current && zoomIn && mode !== "all" && mode !== "match") {
      /* the soma through world's rotation only (the flip), which gives its
         place in pivot space before any offset; localToWorld would fold the
         current offset back in and the frame would settle half way */
      tmpV.set(current.rec.soma[0], current.rec.soma[1], current.rec.soma[2]).applyQuaternion(world.quaternion);
      frameTarget.copy(tmpV).negate();
      zTarget = Math.max(10, Math.min(HOME_Z, 5 + 2.4 * current.rec.reach_mm));
    } else { frameTarget.set(0, 0, 0); zTarget = HOME_Z; }
  }
  const trails = [];

  /* the region box matches the cell body's acronym or full name, so "CA3"
     finds Field CA3 and "granule" finds the dentate gyrus granule layer */
  function regionOk(r) {
    if (!filterRegion) return true;
    const f = filterRegion.toLowerCase();
    return (r.region && r.region.toLowerCase() === f) ||
           (r.region && r.region.toLowerCase().startsWith(f)) ||
           (r.region_name && r.region_name.toLowerCase().includes(f));
  }
  function candidates() {
    return N.filter((r) => (filterSrc === "all" || r.src === filterSrc) &&
                           (filterDiv === "all" || r.major === filterDiv) && regionOk(r));
  }
  function pickRandom() {
    const c = candidates(); if (!c.length) return null;
    return c[Math.floor(Math.random() * c.length)];
  }

  async function focusOn(rec, manual) {
    const my = ++seq;
    if (current) retire(current);
    current = null;
    renderCard(rec, true);
    let buf;
    try { buf = await neuronBytes(rec); } catch (e) { status.textContent = T.couldNot + e.message; return; }
    if (my !== seq) return;
    const geo = neuronGeometry(rec, buf);
    const mat = focusMaterial(DIVISION[rec.major] || "#9aa2b1");
    /* a dense arbour, thousands of segments folded into a few cubic
       millimetres, sums to white under additive blending and then blooms.
       The line alpha falls with the cable length, the honest proxy for how
       much line lands on each pixel, so a 400 mm hippocampal cell (0.3) and
       a 30 mm one (1.0) read at about the same brightness. */
    mat.uniforms.uAlpha.value = Math.max(0.22, Math.min(1, 6 / Math.sqrt(Math.max(rec.axon_mm, 1))));
    const mesh = new THREE.LineSegments(geo, mat);
    mesh.renderOrder = 10;
    focusG.add(mesh);
    /* the cell body, drawn as a small bright point at the root */
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rec.soma), 3));
    const soma = new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color(DIVISION[rec.major] || "#9aa2b1"),
      size: 0.18, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    focusG.add(soma);
    current = { rec, mesh, mat, soma, t: 0, done: false, manual: !!manual };
    holdT = 0; retarget();
    showTargets(rec);
    renderCard(rec, false);
    setUrl(rec);
    card.querySelectorAll("[data-tb]").forEach((b) => b.addEventListener("click", async () => {
      if (!shown.some((t) => t.acr === b.dataset.tb)) {
        /* a bar below the auto-show threshold: bring its mesh in on demand */
        const p = regionMesh(b.dataset.tb); if (!p) return; const src = await p;
        const info = RINFO[b.dataset.tb] || {}; const col = new THREE.Color(DIVISION[info.major] || "#9aa2b1");
        const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.08, blending: THREE.NormalBlending, depthWrite: false, side: THREE.FrontSide });
        const mesh = new THREE.Mesh(src.geometry, mat); mesh.renderOrder = 3; targetG.add(mesh);
        let label = null;
        if (rlabels) { label = document.createElement("button"); label.className = "rlbl"; label.innerHTML = `<b>${b.dataset.tb}</b>`; label.title = info.name || b.dataset.tb; label.style.borderColor = col.getStyle(); label.addEventListener("click", () => liftRegion(b.dataset.tb)); rlabels.appendChild(label); }
        shown.push({ acr: b.dataset.tb, mesh, mat, label, base: 0.08, center: src.userData.center, strong: false });
      }
      liftRegion(b.dataset.tb);
    }));
  }
  function retire(c) {
    clearTargets();
    focusG.remove(c.mesh); focusG.remove(c.soma);
    c.soma.geometry.dispose(); c.soma.material.dispose();
    /* keep the finished tree as a faint trace so the wiring accumulates */
    c.mat.uniforms.uGrow.value = 1e6; c.mat.uniforms.uHead.value = 0; c.mat.uniforms.uAlpha.value = 0.16;
    c.mesh.renderOrder = 8;
    trailG.add(c.mesh); trails.push(c);
    while (trails.length > TRAIL_MAX) {
      const old = trails.shift(); trailG.remove(old.mesh); old.mesh.geometry.dispose(); old.mat.dispose();
    }
    /* every trail dims a little as more join, so a hundred cannot sum to white */
    const a = 0.16 / Math.sqrt(Math.max(1, trails.length / 12));
    for (const t of trails) t.mat.uniforms.uAlpha.value = a;
    syncTrailCount();
  }
  function clearTrails() {
    for (const t of trails) { trailG.remove(t.mesh); t.mesh.geometry.dispose(); t.mat.dispose(); }
    trails.length = 0; syncTrailCount();
  }
  function syncTrailCount() {
    const n = q("[data-trailcount]"); if (n) n.textContent = trails.length ? T.traced(trails.length) : "";
  }

  /* ---- all axons at once -------------------------------------------------- */
  let axonsLoaded = false;
  /* the coarse copy of every axon, one buffer per source, fetched once */
  const coarseBuf = {};
  const bySrc = {};
  for (const r of N) (bySrc[r.src] = bySrc[r.src] || []).push(r);
  /* The coarse file of one source, READ AS A STREAM. Every record's byte
     range in the file is known before a byte arrives (the index carries
     each neuron's cbytes, and the file is their concatenation), so as chunks
     land each completed record is handed to onRecord at once, and the total
     is the sum of cbytes, a true number, where a gzipped content-length is
     not. The finished buffer is kept for the views that read it whole. */
  async function streamCoarse(src, onRecord, signal, onBytes) {
    const recs = bySrc[src] || [];
    let off = 0;
    for (const r of recs) { r._coff = off; off += r.cbytes || 0; }
    const need = off;
    if (coarseBuf[src]) {
      if (onRecord) for (const r of recs) if (r.cbytes) onRecord(r, coarseBuf[src]);
      if (onBytes) onBytes(src, need, need);
      return coarseBuf[src];
    }
    const files = meta.coarse_files || ["axons-coarse.bin"];
    const file = files.find((f) => f.replace(/^axons-coarse-?/, "").replace(/\.bin$/, "") === src) || files[0];
    const r = await fetch(R("data/" + file), signal ? { signal } : undefined);
    if (!r.ok) throw new Error(`${r.status} ${file}`);
    const out = new Uint8Array(need);
    let have = 0, next = 0;
    const drain = () => {
      while (next < recs.length && recs[next]._coff + (recs[next].cbytes || 0) <= have) {
        if (recs[next].cbytes && onRecord) onRecord(recs[next], out.buffer);
        next++;
      }
    };
    if (!r.body) {
      const b = new Uint8Array(await r.arrayBuffer());
      out.set(b.subarray(0, need)); have = Math.min(b.length, need);
    } else {
      const rd = r.body.getReader();
      for (;;) {
        const { done, value } = await rd.read();
        if (done) break;
        const n = Math.min(value.length, need - have);
        if (n > 0) out.set(value.subarray(0, n), have);
        have += n;
        drain();
        if (onBytes) onBytes(src, have, need);
      }
    }
    drain();
    if (onBytes) onBytes(src, have, need);
    coarseBuf[src] = out.buffer;
    return out.buffer;
  }
  /* the views that read a source whole still get the byte bar */
  async function ensureCoarse(src) {
    if (coarseBuf[src]) return coarseBuf[src];
    const label = T.readingAll + (T.sources[src] || src || "all");
    status.textContent = label + "…";
    const buf = await streamCoarse(src, null, null, (x, have, need) => bar.set(have, need, label));
    bar.done();
    return buf;
  }

  /* ---- the born line material. A segment that has landed grows in from
     its soma end over GROW seconds behind a hot white head, stays bright
     for a moment, and settles into the hairball. The growth is the reading
     order made visible: an axon appears the way its bytes arrived. Reduced
     motion: it is simply there. ---- */
  const GROW = 0.9, FRESH = 1.6;
  let liveT = performance.now() / 1000;
  function bornMaterial(alpha) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAlpha: { value: alpha },
        uGrow: { value: REDUCED ? 0.001 : GROW }, uFresh: { value: REDUCED ? 0.0 : 1.0 },
        uSolid: { value: 1 }, uCamDist: { value: 20 }, uShade: { value: 0.6 } },
      vertexShader: `attribute float aBorn; attribute float aAlong;
        varying vec3 vC; varying float vBorn; varying float vAlong; varying float vDepth; varying float vLit;
        void main() { vC = color; vBorn = aBorn; vAlong = aAlong;
          vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z;
          /* a light on the ball: the outer cables shade by their direction
             from the brain's centre, so the front layer has relief instead
             of one flat colour */
          vec3 rV = normalize(mv.xyz - (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
          vLit = 0.45 + 0.55 * max(dot(rV, normalize(vec3(0.35, 0.55, 0.75))), 0.0);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime; uniform float uAlpha; uniform float uGrow; uniform float uFresh;
        uniform float uSolid; uniform float uCamDist; uniform float uShade;
        varying vec3 vC; varying float vBorn; varying float vAlong; varying float vDepth; varying float vLit;
        void main() {
          float age = uTime - vBorn; if (age < 0.0) discard;
          float front = age / uGrow;
          float reveal = smoothstep(vAlong - 0.04, vAlong, front); if (reveal <= 0.001) discard;
          float head = exp(-abs(front - vAlong) * 18.0) * step(front, 1.05) * uFresh;
          float fresh = exp(-max(age - uGrow, 0.0) / ${FRESH}) * uFresh;
          if (uSolid > 0.5) {
            /* solid: the nearest line wins the pixel, and depth shades the
               ball so it has a front and a back. The brain is about 13 mm
               across; the shading runs over that span about the camera's
               distance to the centre. */
            float t = clamp((vDepth - (uCamDist - 6.5)) / 13.0, 0.0, 1.0);
            float shade = (1.0 - uShade * t) * mix(1.0, vLit, uShade);
            vec3 c = vC * shade * (1.0 + fresh * 0.8) + vec3(1.0) * head * 1.5;
            gl_FragColor = vec4(c, reveal);
          } else {
            vec3 c = vC * (1.0 + fresh * 1.2) + vec3(1.0) * head * 2.0;
            float a = uAlpha * reveal * (1.0 + fresh * 1.5 + head * 4.0);
            gl_FragColor = vec4(c, a);
          }
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      vertexColors: true, transparent: true, blending: THREE.NormalBlending, depthWrite: true });
  }
  let cablesSolid = true;
  function setCableMode(mat, mesh) {
    mat.uniforms.uSolid.value = cablesSolid ? 1 : 0;
    mat.blending = cablesSolid ? THREE.NormalBlending : THREE.AdditiveBlending;
    mat.depthWrite = cablesSolid; mat.depthTest = true;
    mat.needsUpdate = true;
    /* solid lines are drawn by the composer with everything else (and get
       the bloom); light lines go to the float buffer on the cable layer */
    if (mesh) mesh.layers.set(cablesSolid ? 0 : CABLE_LAYER);
  }
  /* a LineSegments sized for a set of records before any has arrived; records
     are written in as they land and the draw range grows behind them */
  function liveMesh(recs, alpha) {
    let S = 0; for (const r of recs) S += Math.max(0, (r.cverts || 0) - (r.cpaths || 0));
    const pos = new Float32Array(S * 6), col = new Float32Array(S * 6), born = new Float32Array(S * 2), along = new Float32Array(S * 2);
    const g = new THREE.BufferGeometry();
    const attrs = { position: new THREE.BufferAttribute(pos, 3), color: new THREE.BufferAttribute(col, 3),
      aBorn: new THREE.BufferAttribute(born, 1), aAlong: new THREE.BufferAttribute(along, 1) };
    for (const k in attrs) { attrs[k].setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, attrs[k]); }
    g.setDrawRange(0, 0);
    const mesh = new THREE.LineSegments(g, bornMaterial(alpha));
    mesh.frustumCulled = false;
    setCableMode(mesh.material, mesh);
    const L = { mesh, pos, col, born, along, seg: 0, S, flushed: 0, dirty: false,
      flush() {
        if (!this.dirty) return;
        const from = this.flushed * 2, count = (this.seg - this.flushed) * 2;
        for (const k in attrs) {
          const a = attrs[k], sz = a.itemSize;
          if (a.addUpdateRange) { a.clearUpdateRanges(); a.addUpdateRange(from * sz, count * sz); }
          else a.updateRange = { offset: from * sz, count: count * sz };
          a.needsUpdate = true;
        }
        g.setDrawRange(0, this.seg * 2);
        this.flushed = this.seg; this.dirty = false;
      } };
    return L;
  }
  /* one record's coarse block into a live mesh, coloured, born now */
  const jitterOf = (off) => 0.62 + 0.38 * (((off * 2654435761) >>> 0) % 1000) / 1000;
  function pushRecord(L, buf, off, c0, t) {
    /* every neuron a little brighter or darker than its division colour,
       keyed to its byte offset so it is the same every time, or a million
       cables of one colour read as one painted surface */
    const j = jitterOf(off), c = { r: c0.r * j, g: c0.g * j, b: c0.b * j };
    const dv = new DataView(buf, off, 8), P = dv.getUint32(0, true), V = dv.getUint32(4, true);
    const counts = new Uint16Array(buf, off + 8, P);
    const xyz = new Int16Array(buf, off + 8 + 2 * P, V * 3);
    let v = 0, o = L.seg * 6, k = L.seg * 2, segs = 0;
    const pos = L.pos, col = L.col, born = L.born, along = L.along;
    for (let i = 0; i < P; i++) {
      const n = counts[i], den = Math.max(1, n - 1);
      for (let j = 0; j < n - 1; j++) {
        if (k + 2 > L.S * 2) { v += n; break; }
        const a = v + j, b = a + 1;
        pos[o++] = xyz[a * 3] / 100; pos[o++] = xyz[a * 3 + 1] / 100; pos[o++] = xyz[a * 3 + 2] / 100;
        pos[o++] = xyz[b * 3] / 100; pos[o++] = xyz[b * 3 + 1] / 100; pos[o++] = xyz[b * 3 + 2] / 100;
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
        col[k * 3 + 3] = c.r; col[k * 3 + 4] = c.g; col[k * 3 + 5] = c.b;
        born[k] = t; born[k + 1] = t; along[k] = j / den; along[k + 1] = (j + 1) / den;
        k += 2; segs++;
      }
      v += n;
    }
    L.seg = k / 2; L.dirty = true;
    return segs;
  }

  /* ---- the reading HUD: what is being read, how much of it, how fast, and
     what has landed where. Every number on it is measured: bytes from the
     stream, the rate from a two second window of them, the time left from
     that rate and the bytes still to come, the division counts from the
     records as they land. ---- */
  const hudEl = el.querySelector("[data-loadhud]");
  const fmtMB1 = (b) => (b / 1048576).toFixed(1) + " MB";
  const hud = {
    at: 0, samples: [], hide: 0,
    begin(srcs, totals) {
      if (!hudEl) return;
      clearTimeout(this.hide); this.samples = []; this.at = 0;
      hudEl.hidden = false;
      hudEl.innerHTML = '<div class="lh-bar">' + srcs.map((x) =>
          `<i data-lh-src="${x}" style="flex:${Math.max(1, totals[x])}" title="${T.sources[x] || x}"><b></b></i>`).join("") +
        '</div><div class="lh-line" data-lh-line></div><div class="lh-div" data-lh-div>' +
        Object.keys(DIVISION).filter((d) => d !== "ventricles").map((d) =>
          `<span data-lh-d="${d}" style="--c:${DIVISION[d]}"><i></i>${DIV(d)}<em>0</em></span>`).join("") + "</div>";
    },
    tick(bytes, totals, drawn, total, segs, divCount, force) {
      if (!hudEl || hudEl.hidden) return;
      const now = performance.now();
      if (!force && now - this.at < 120) return;
      this.at = now;
      let have = 0, need = 0;
      for (const x in totals) { have += bytes[x] || 0; need += totals[x]; }
      for (const x in totals) {
        const i = hudEl.querySelector(`[data-lh-src="${x}"] b`);
        if (i) i.style.width = (totals[x] ? 100 * (bytes[x] || 0) / totals[x] : 0).toFixed(1) + "%";
      }
      this.samples.push([now, have]);
      while (this.samples.length > 2 && now - this.samples[0][0] > 2000) this.samples.shift();
      const s0 = this.samples[0];
      const rate = now - s0[0] > 200 ? (have - s0[1]) / ((now - s0[0]) / 1000) : 0;
      const left = rate > 0 ? Math.max(0, (need - have) / rate) : null;
      const line = hudEl.querySelector("[data-lh-line]");
      if (line) line.innerHTML =
        `<span>${T.lh.reading(Object.keys(totals).length)}</span><span class="u">${fmtMB1(have)}${T.lh.ofBytes}${fmtMB1(need)}</span>` +
        `<span>${fmt(drawn)} / ${fmt(total)}${T.lh.neurons}</span><span>${fmt(segs)}${T.lh.segs}</span>` +
        (rate > 0 ? `<span class="u">${(rate / 1048576).toFixed(1)}${T.lh.rate}${left != null ? ", " + T.lh.left(Math.ceil(left)) : ""}</span>` : "");
      let max = 1; for (const d in divCount) if (divCount[d] > max) max = divCount[d];
      hudEl.querySelectorAll("[data-lh-d]").forEach((sp) => {
        const n = divCount[sp.dataset.lhD] || 0;
        sp.querySelector("em").textContent = fmt(n);
        sp.style.opacity = n ? (0.45 + 0.55 * Math.sqrt(n / max)).toFixed(2) : 0.25;
      });
    },
    done() {
      if (!hudEl) return;
      hudEl.querySelectorAll("[data-lh-src] b").forEach((b) => { b.style.width = "100%"; });
      const line = hudEl.querySelector("[data-lh-line]");
      if (line) line.innerHTML = `<span>${T.lh.done}</span>`;
      this.hide = setTimeout(() => { hudEl.hidden = true; }, 2600);
    },
    end() { if (hudEl) { clearTimeout(this.hide); hudEl.hidden = true; } },
  };
  /* one LineSegments for a set of records, coloured by colourOf(record) */
  function axonMesh(recs, buf, colourOf) {
    let S = 0; for (const r of recs) S += Math.max(0, (r.cverts || 0) - (r.cpaths || 0));
    const pos = new Float32Array(S * 6), col = new Float32Array(S * 6);
    let k = 0, o = 0, drawn = 0;
    for (const r of recs) {
      if (!r.cbytes) continue;
      const u = unpack(buf, r._coff, false);
      pos.set(u.pos, o); o += u.pos.length;
      const c = colourOf(r);
      for (let s = 0; s < u.segs * 2; s++) { col[k++] = c.r; col[k++] = c.g; col[k++] = c.b; }
      drawn++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, depthWrite: false });
    return { mesh: new THREE.LineSegments(g, m), segs: S, drawn };
  }
  /* brightness falls with the count so the hairball stays a hairball and
     not a white blob. Tuned by reading the framebuffer back: at 1.83
     million segments, 0.0045 keeps the canvas under one per cent
     saturated and 0.012 sends eight per cent of it to white. */
  /* on the float buffer the knee holds the pile, so a line can carry real
     light: about thirty times what the clipped canvas allowed */
  const hairAlpha = (segs) => Math.min(0.5, 1.2 / Math.sqrt(Math.max(segs, 1) / 1000)) * cableGain;

  const divColour = {}; const colourOfDivision = (r) => divColour[r.major] || (divColour[r.major] = new THREE.Color(DIVISION[r.major] || "#9aa2b1"));
  /* Every axon: the five sources stream in parallel, and each neuron is
     drawn the moment its bytes have landed, growing in from the cell body.
     Leaving the view aborts the streams; a source that had finished is kept,
     so coming back does not read it twice. */
  let allAbort = null, allLive = null;
  async function loadAllAxons() {
    if (axonsLoaded || allAbort) return;
    allAbort = new AbortController();
    const signal = allAbort.signal;
    const srcs = Object.keys(bySrc);
    const live = {}, bytes = {}, totals = {}, divCount = {};
    let drawn = 0, segsAll = 0;
    for (const src of srcs) {
      live[src] = liveMesh(bySrc[src], 0.05);
      axonG.add(live[src].mesh);
      totals[src] = bySrc[src].reduce((a, r) => a + (r.cbytes || 0), 0);
      bytes[src] = 0;
    }
    allLive = live;
    hud.begin(srcs, totals);
    status.textContent = T.readingAll + srcs.map((x) => T.sources[x] || x).join(", ") + "…";
    const onRecord = (rec, buf) => {
      const L = live[rec.src]; if (!L) return;
      segsAll += pushRecord(L, buf, rec._coff, colourOfDivision(rec), liveT);
      drawn++; divCount[rec.major] = (divCount[rec.major] || 0) + 1;
    };
    const onBytes = (src, have, need) => {
      bytes[src] = have;
      for (const L of Object.values(live)) L.mesh.material.uniforms.uAlpha.value = hairAlpha(Math.max(segsAll, 20000));
      hud.tick(bytes, totals, drawn, N.length, segsAll, divCount, false);
    };
    try {
      await Promise.all(srcs.map((src) => streamCoarse(src, onRecord, signal, onBytes)));
    } catch (e) {
      for (const L of Object.values(live)) { axonG.remove(L.mesh); L.mesh.geometry.dispose(); L.mesh.material.dispose(); }
      allLive = null; allAbort = null; hud.end();
      if (!signal.aborted) status.textContent = T.couldNot + e.message;
      return;
    }
    for (const L of Object.values(live)) { L.flush(); L.mesh.material.uniforms.uAlpha.value = hairAlpha(segsAll); }
    hud.tick(bytes, totals, drawn, N.length, segsAll, divCount, true);
    axonsLoaded = true; allAbort = null;
    axonG.userData.segments = segsAll;
    hud.done();
    status.textContent = T.allDone(fmt(drawn), fmt(segsAll));
  }

  /* ---- to and from a region ---------------------------------------------
     Type a region and every axon that starts there or ends there is drawn:
     gold for a cell body in the region, cyan for an axon whose tips land in
     it, magenta for both. "Ends there" means at least two per cent of the
     neuron's tips, read off the index. A region means itself and everything
     inside it in the Allen tree (data/ontology.json), so "hippocampus" is
     CA1, CA2, CA3, the dentate gyrus and the rest. The axons stream in the
     same way the whole brain does, and grow in as they land. */
  const projG = new THREE.Group(); world.add(projG); projG.visible = false;
  const regionLegend = q("[data-region-legend]"), regionIn = q("[data-region-q]"), regionSel = q("[data-region-colour]");
  const DIRC = { from: "#ffc24a", to: "#6fd0ff", both: "#ff5cc0" };
  let ONT = null, regionQuery = "", regionColour = "direction", regionSeq = 0, regionLive = null, regionAbort = null, regionIso = null;
  async function ontology() {
    if (ONT) return ONT;
    ONT = await (await fetch(R("data/ontology.json"))).json();
    const dl = q("#regionlist");
    if (dl && !dl.children.length) {
      const opts = Object.keys(ONT).map((k) => `<option value="${k}">${ONT[k].name}</option>`);
      dl.innerHTML = opts.join("");
    }
    return ONT;
  }
  function descendants(acr) {
    const set = new Set([acr]); let grew = true;
    while (grew) { grew = false; for (const k in ONT) { const p = ONT[k].parent; if (p && set.has(p) && !set.has(k)) { set.add(k); grew = true; } } }
    return set;
  }
  /* the words people type that the Allen tree does not use */
  const SYNONYM = { hippocampus: "HPF", "hippocampal formation": "HPF", cortex: "Isocortex", neocortex: "Isocortex",
    "olfactory bulb": "MOB", cerebellum: "CB", striatum: "STR", thalamus: "TH", hypothalamus: "HY",
    midbrain: "MB", pons: "P", medulla: "MY", "dentate gyrus": "DG", amygdala: "BLA", "visual cortex": "VIS",
    "motor cortex": "MO", "somatosensory cortex": "SS", "prefrontal": "PL", subiculum: "SUB", "entorhinal": "ENT" };
  function resolveRegion(text) {
    let qs = text.trim().toLowerCase(); if (!qs) return null;
    const keys = Object.keys(ONT);
    if (SYNONYM[qs] && ONT[SYNONYM[qs]]) return SYNONYM[qs];
    let acr = keys.find((k) => k.toLowerCase() === qs);
    if (acr) return acr;
    const widest = (pool) => pool.sort((a, b) => descendants(b).size - descendants(a).size)[0];
    /* a name, then the name with its ending worn down: "hippocampus" finds
       "hippocampal formation" at "hippocamp". The widest match wins, so it
       is the formation and not the commissure. */
    for (let cut = qs; cut.length >= 5; cut = cut.slice(0, -1)) {
      const starts = keys.filter((k) => ONT[k].name.toLowerCase().startsWith(cut));
      if (starts.length) return widest(starts);
      const has = keys.filter((k) => ONT[k].name.toLowerCase().includes(cut));
      if (has.length) return widest(has);
    }
    return null;
  }
  async function drawRegion() {
    const my = ++regionSeq;
    if (regionAbort) regionAbort.abort();
    regionAbort = null;
    for (const L of Object.values(regionLive || {})) { projG.remove(L.mesh); L.mesh.geometry.dispose(); L.mesh.material.dispose(); }
    regionLive = null;
    clearTargets();
    if (regionLegend) regionLegend.innerHTML = "";
    if (!regionQuery) { status.textContent = T.regionHint; return; }
    await ontology(); if (my !== regionSeq) return;
    const acr = resolveRegion(regionQuery);
    if (!acr) { status.textContent = T.regionNone(regionQuery); return; }
    const set = descendants(acr);
    const dirOf = (r) => {
      const from = set.has(r.region) || set.has(r.rf);
      const to = (r.tf || []).some((t) => set.has(t[0]) && t[1] >= 0.02);
      return from && to ? "both" : from ? "from" : to ? "to" : null;
    };
    const all = N.filter((r) => r.cbytes && dirOf(r));
    const counts = { from: 0, to: 0, both: 0 };
    for (const r of all) counts[dirOf(r)]++;
    status.textContent = T.regionStatus(acr, ONT[acr].name, set.size - 1, counts);
    /* the colour key: direction, or the source's subtype, or the division */
    let keyOfR, colours = {}, legend = [];
    if (regionColour === "direction") {
      keyOfR = dirOf; for (const d in DIRC) colours[d] = new THREE.Color(DIRC[d]);
      legend = ["from", "to", "both"].map((d) => [d, T.dir[d], counts[d]]);
    } else {
      keyOfR = regionColour === "division" ? (r) => r.major || "?" : (r) => (r.st ? `${r.src}:${r.st}` : "?");
      const c = {}; for (const r of all) { const k = keyOfR(r); c[k] = (c[k] || 0) + 1; }
      const keys = Object.keys(c).sort((x, y) => c[y] - c[x]);
      keys.forEach((k, i) => { colours[k] = regionColour === "division" ? new THREE.Color(DIVISION[k] || "#9aa2b1") : classColour(i); });
      legend = keys.slice(0, 14).map((k) => [k, regionColour === "division" ? DIV(k) : ((nameOf({ src: k.split(":")[0], st: k.split(":")[1] }) || {}).name || k), c[k]]);
    }
    if (regionLegend) {
      regionLegend.innerHTML = legend.map(([k, label, n]) =>
        `<button type="button" class="rchip" data-rkey="${k}" aria-pressed="${regionIso === k}" style="--c:#${colours[k].getHexString()}"><i></i>${label}<em>${fmt(n)}</em></button>`).join("");
      regionLegend.querySelectorAll("[data-rkey]").forEach((b) => b.addEventListener("click", () => {
        regionIso = regionIso === b.dataset.rkey ? null : b.dataset.rkey; drawRegion();
      }));
    }
    const draw = regionIso ? all.filter((r) => keyOfR(r) === regionIso) : all;
    const want = new Set(draw);
    const srcs = Object.keys(bySrc).filter((x) => draw.some((r) => r.src === x));
    const live = {}, bytes = {}, totals = {}, divCount = {};
    let drawn = 0, segsAll = 0;
    for (const x of srcs) {
      live[x] = liveMesh(draw.filter((r) => r.src === x), 0.1); projG.add(live[x].mesh);
      totals[x] = bySrc[x].reduce((a, r) => a + (r.cbytes || 0), 0); bytes[x] = 0;
    }
    regionLive = live;
    const alphaFor = (segs) => Math.min(0.9, 2.0 / Math.sqrt(Math.max(segs, 1) / 1000)) * cableGain;
    const needRead = srcs.some((x) => !coarseBuf[x]);
    if (needRead) hud.begin(srcs, totals);
    regionAbort = new AbortController();
    const signal = regionAbort.signal;
    const onRecord = (rec, buf) => {
      if (!want.has(rec)) return;
      const L = live[rec.src]; if (!L) return;
      segsAll += pushRecord(L, buf, rec._coff, colours[keyOfR(rec)] || colours["?"] || new THREE.Color("#9aa2b1"), liveT);
      drawn++; divCount[rec.major] = (divCount[rec.major] || 0) + 1;
    };
    const onBytes = (x, have, need) => {
      bytes[x] = have;
      for (const L of Object.values(live)) L.mesh.material.uniforms.uAlpha.value = alphaFor(Math.max(segsAll, 2000));
      if (needRead) hud.tick(bytes, totals, drawn, draw.length, segsAll, divCount, false);
    };
    try { await Promise.all(srcs.map((x) => streamCoarse(x, onRecord, signal, onBytes))); }
    catch (e) { if (!signal.aborted) status.textContent = T.couldNot + e.message; return; }
    if (my !== regionSeq) return;
    regionAbort = null;
    for (const L of Object.values(live)) { L.flush(); L.mesh.material.uniforms.uAlpha.value = alphaFor(segsAll); }
    if (needRead) { hud.tick(bytes, totals, drawn, draw.length, segsAll, divCount, true); hud.done(); }
    showRegionShell(acr);
  }
  /* the region's own boundary, tinted glass with a tag, as the match view draws it */
  async function showRegionShell(acr) {
    const p = regionMesh(acr); if (!p) return;
    const src = await p; if (mode !== "region") return;
    const info = RINFO[acr] || {}; const col = new THREE.Color(DIVISION[info.major] || "#9aa2b1");
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, blending: THREE.NormalBlending, depthWrite: false, side: THREE.FrontSide });
    const mesh = new THREE.Mesh(src.geometry, mat); mesh.renderOrder = 3; targetG.add(mesh);
    let label = null;
    if (rlabels) { label = document.createElement("button"); label.className = "rlbl soma"; label.innerHTML = `<b>${acr}</b><small>${info.name || (ONT && ONT[acr] && ONT[acr].name) || ""}</small>`; rlabels.appendChild(label); }
    shown.push({ acr, mesh, mat, label, base: 0.16, center: src.userData.center, strong: false });
  }
  if (regionIn) {
    regionIn.addEventListener("focus", () => { ontology(); });
    const go = () => { regionQuery = regionIn.value; regionIso = null; if (mode !== "region") setMode("region"); else drawRegion(); writeUrl(); };
    regionIn.addEventListener("change", go);
    regionIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  }
  /* the cables slider: how much light a line carries, and the knee with it */
  const solidIn = q("[data-t-solid]");
  if (solidIn) solidIn.addEventListener("change", () => {
    cablesSolid = solidIn.checked;
    for (const set of [allLive, regionLive]) if (set) for (const L of Object.values(set)) setCableMode(L.mesh.material, L.mesh);
    loop.once();
  });
  const cablesIn = q("[data-cables]");
  if (cablesIn) cablesIn.addEventListener("input", () => {
    cableGain = parseFloat(cablesIn.value) || 1;
    cableMat.uniforms.uK.value = cableGain;
    for (const set of [allLive, regionLive]) if (set) for (const L of Object.values(set)) L.mesh.material.uniforms.uShade.value = Math.min(0.9, 0.6 * cableGain);
    for (const set of [allLive, regionLive]) if (set) for (const L of Object.values(set)) {
      const segs = L.mesh.geometry.drawRange.count / 2;
      L.mesh.material.uniforms.uAlpha.value = (mode === "region" ? Math.min(0.9, 2.0 / Math.sqrt(Math.max(segs, 1) / 1000)) * cableGain : hairAlpha(Math.max(segs, 20000)));
    }
    loop.once();
  });
  if (regionSel) regionSel.addEventListener("change", () => { regionColour = regionSel.value; regionIso = null; if (mode === "region") drawRegion(); writeUrl(); });

  /* ---- all that match: every neuron passing the filters, drawn at once and
     coloured by the portal's projection subtype (or by division), with a
     legend that isolates one class on a click ----------------------------- */
  const matchG = new THREE.Group(); world.add(matchG); matchG.visible = false;
  let matchMeshes = [], matchColour = "subtype", isolated = null, matchSeq = 0, keepIsolated = false;
  const subtypeKey = {};
  fetch(R("data/hipp-subtypes-key.json")).then((r) => r.json()).then((j) => Object.assign(subtypeKey, j)).catch(() => {});
  /* names for the portal's numbered classes, read off the data: where each
     class's cell bodies sit and where its axons end, with the classical name
     attached where the pattern is the textbook one (mossy fibres, Schaffer
     collaterals). data/subtype-names.json, per source. */
  const NAMES = {};
  fetch(R("data/subtype-names.json")).then((r) => r.json()).then((j) => Object.assign(NAMES, j)).catch(() => {});
  const nameOf = (r) => (NAMES[r.src] && NAMES[r.src][r.st]) || null;
  /* What to call a neuron. The portals name them by number (202502_015),
     which says nothing; what the data does say is where the cell body is,
     by full Allen name, and for the ION sets the projection class it was
     sorted into. So a neuron is "Field CA3 neuron", with the class beneath
     when there is one, and the number stays as the fine print and the
     tooltip, because the number is what the portal knows it by. */
  function displayName(r) {
    const region = r.region_name || REGIONS[r.region] || r.region || "";
    const head = region ? (ZH ? `${region}神经元` : `${region} neuron`) : r.id;
    const cls = nameOf(r);
    const sub = cls ? cls.name : "";
    return { head, sub, id: r.id };
  }
  const PORTAL = {
    "MouseLight": "https://ml-neuronbrowser.janelia.org/",
    "SEU-ALLEN": "https://doi.org/10.35077/g.25",
    "ION-PFC": "https://mouse.digital-brain.cn/projectome/pfc",
    "ION-HIPP": "https://mouse.digital-brain.cn/hipp",
    "ION-CTX": "https://mouse.digital-brain.cn/projectome",
  };
  /* a categorical palette for up to 64 classes: golden-angle hues at one
     lightness, so no class is brighter than another by accident */
  const classColour = (i) => new THREE.Color().setHSL(((i * 137.508) % 360) / 360, 0.72, 0.62);
  function colourKeyFor(recs) {
    /* the classes present, most numerous first, with a colour each */
    const counts = {};
    for (const r of recs) { const k = keyOf(r); counts[k] = (counts[k] || 0) + 1; }
    const keys = Object.keys(counts).sort((x, y) => counts[y] - counts[x]);
    const colours = {};
    keys.forEach((k, i) => { colours[k] = matchColour === "division" ? new THREE.Color(DIVISION[k] || "#9aa2b1") : classColour(i); });
    return { keys, counts, colours };
  }
  const keyOf = (r) => matchColour === "subtype" ? (r.st ? `${r.src}:${r.st}` : "?")
    : matchColour === "family" ? ((nameOf(r) && nameOf(r).family) || (r.st ? "other" : "?"))
    : matchColour === "region" ? (r.rf || r.region || "?") : (r.major || "?");
  async function drawMatching() {
    const my = ++matchSeq;
    for (const m of matchMeshes) { matchG.remove(m); m.geometry.dispose(); m.material.dispose(); }
    matchMeshes = [];
    const recs = candidates();
    if (recs.length > 6000) { status.textContent = ZH ? `匹配 ${fmt(recs.length)} 个神经元，太多了：请再收窄筛选（少于 6,000 个）。` : `${fmt(recs.length)} neurons match, too many to draw at once: narrow the filters to under 6,000.`; renderMatchCard(recs, null); return; }
    const key = colourKeyFor(recs);
    /* A population is drawn as a SAMPLE when it is large: nine hundred CA3
       cells at once were a pink haze in which no line and no colour could
       be read. Up to CAP neurons are drawn, taken at random but with every
       class represented in proportion (at least one each), at an alpha the
       eye can follow. The status says how many of how many. A sample shows
       where a class goes and how the classes differ; it says nothing about
       density, and the card says so. A clicked class is drawn alone. */
    const CAP = 220;
    let draw = isolated ? recs.filter((r) => keyOf(r) === isolated) : recs;
    let sampled = false;
    if (draw.length > CAP) {
      sampled = true;
      const groups = {};
      for (const r of draw) (groups[keyOf(r)] = groups[keyOf(r)] || []).push(r);
      const pick = [];
      for (const g of Object.values(groups)) {
        const n = Math.max(1, Math.round(CAP * g.length / draw.length));
        const sh = g.slice(); for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; }
        pick.push(...sh.slice(0, n));
      }
      draw = pick;
    }
    const colourOf = (r) => key.colours[keyOf(r)];
    let segsAll = 0, drawn = 0;
    for (const src of Object.keys(bySrc)) {
      const mine = draw.filter((r) => r.src === src);
      if (!mine.length) continue;
      let buf; try { buf = await ensureCoarse(src); } catch (e) { continue; }
      if (my !== matchSeq) return;
      const { mesh, segs, drawn: d } = axonMesh(mine, buf, colourOf);
      matchMeshes.push(mesh); matchG.add(mesh); segsAll += segs; drawn += d;
    }
    const alpha = Math.min(0.5, 0.45 / Math.sqrt(Math.max(segsAll, 1) / 1000));
    for (const m of matchMeshes) m.material.opacity = alpha;
    const total = isolated ? recs.filter((r) => keyOf(r) === isolated).length : recs.length;
    status.textContent = (sampled
      ? (ZH ? `随机抽取 ${fmt(drawn)} / ${fmt(total)} 个神经元绘制` : `drawing ${fmt(drawn)} of ${fmt(total)} neurons, chosen at random`)
      : (ZH ? `${fmt(drawn)} 个神经元` : `${fmt(drawn)} neurons`)) + `, ${fmt(segsAll)}${T.segs}` + (isolated ? (ZH ? `，只显示 ${isolated}` : `, ${isolated} alone`) : "");
    renderMatchCard(recs, key, sampled);
    showRegionBoundary();
  }
  /* the selected region's own boundary, tinted glass with a tag */
  async function showRegionBoundary() {
    clearTargets();
    if (!filterRegion) return;
    const acr = Object.keys(RINFO).find((k) => k.toLowerCase() === filterRegion.toLowerCase());
    if (!acr) return;
    const p = regionMesh(acr); if (!p) return;
    const src = await p; if (mode !== "match") return;
    const info = RINFO[acr] || {}; const col = new THREE.Color(DIVISION[info.major] || "#9aa2b1");
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, blending: THREE.NormalBlending, depthWrite: false, side: THREE.FrontSide });
    const mesh = new THREE.Mesh(src.geometry, mat); mesh.renderOrder = 3; targetG.add(mesh);
    let label = null;
    if (rlabels) { label = document.createElement("button"); label.className = "rlbl soma"; label.innerHTML = `<b>${acr}</b><small>${info.name || ""}</small>`; label.title = info.name || acr; rlabels.appendChild(label); }
    shown.push({ acr, mesh, mat, label, base: 0.16, center: src.userData.center, strong: false });
  }
  function renderMatchCard(recs, key, sampled) {
    if (!card) return;
    const what = [filterRegion ? filterRegion : null, filterSrc !== "all" ? (T.sources[filterSrc] || filterSrc) : null, filterDiv !== "all" ? DIV(filterDiv) : null].filter(Boolean).join(" · ") || (ZH ? "全部" : "everything");
    let html = `<h3>${fmt(recs.length)}${T.neurons}</h3><p class="side">${what}</p>`;
    if (key) {
      const label = (k) => {
        if (matchColour === "subtype") {
          if (k === "?") return `<b>${ZH ? "无亚型（非上海数据）" : "no subtype (not an ION cell)"}</b>`;
          const [src, st] = k.split(":");
          if (st === "others") return `<b>${ZH ? "未分类（门户标注）" : "unclassified by the portal"}</b>`;
          const nm = NAMES[src] && NAMES[src][st];
          return nm ? `<b>${nm.name}</b> <span class="kd">${ZH ? "亚型" : "subtype"} ${st}</span>`
                    : `<b>${ZH ? "亚型" : "subtype"} ${st}</b>`;
        }
        if (matchColour === "family") {
          if (k === "?") return `<b>${ZH ? "无分类（非上海数据）" : "no class (not an ION cell)"}</b>`;
          return `<b>${k}</b>`;
        }
        if (matchColour === "region") return `<b>${k}</b> <span class="kd">${(meta.regions || {})[k] || ""}</span>`;
        return `<b>${DIV(k)}</b>`;
      };
      html += `<p class="side">${matchColour === "subtype" ? (ZH ? "按投射亚型着色（Qiu 等 2024 / Gao 等 2022 的分类）。名称是从数据读出的：胞体在哪、轴突落在哪；门户本身只给编号。点击一项只看它。" : "Coloured by projection subtype, the portal's own classes (Qiu 2024, Gao 2022). The names are read off the data, where the cell bodies sit and where the axons end; the portal itself gives only numbers. Click one to see it alone.") : matchColour === "family" ? (ZH ? "按通路家族着色：把亚型按胞体与靶区的模式归并。点击一项只看它。" : "Coloured by pathway family: the subtypes folded together by where their cells sit and where they project. Click one to see it alone.") : matchColour === "region" ? (ZH ? "按胞体所在区域着色" : "Coloured by the cell body's region") : (ZH ? "按脑区着色" : "Coloured by division")}</p>`;
      const titleOf = (k) => { if (matchColour !== "subtype") return ""; const [src, st] = k.split(":"); const nm = NAMES[src] && NAMES[src][st]; return nm ? ` title="${(nm.desc || "").replace(/"/g, "&quot;")} Cell bodies: ${nm.soma}. Axon tips: ${nm.targets}."` : ""; };
      html += `<div class="klist">` + key.keys.slice(0, 40).map((k) => `<button class="kk${isolated === k ? " is-on" : ""}" data-k="${k}"${titleOf(k)}><s style="background:${key.colours[k].getStyle()}"></s>${label(k)}<span class="kn">${fmt(key.counts[k])}</span></button>`).join("") + `</div>`;
      if (key.keys.length > 40) html += `<p class="side">${ZH ? `另有 ${key.keys.length - 40} 类` : `and ${key.keys.length - 40} more`}</p>`;
    }
    html += `<p class="badge">${sampled
      ? (ZH ? "神经元太多，一次画不清：这里随机抽取了约 220 个，各类别按比例，点击一类可看它的全部。这是一个样本：它显示各类去往何处，不显示密度。" : "Too many to draw at once, so about 220 are drawn at random, every class in proportion; click a class to see all of it. A sample shows where each class goes and how they differ, not how dense they are.")
      : (ZH ? "这是符合筛选条件的全部神经元的轴突，一次画出。粗线版本省略了短于 0.3 mm 的末梢。" : "Every neuron that passes the filters, its whole axon at once. The coarse copy leaves out twigs under 0.3 mm.")}</p>`;
    card.innerHTML = html;
    card.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => { isolated = isolated === b.dataset.k ? null : b.dataset.k; drawMatching(); writeUrl(); }));
  }
  const mc = q("[data-colour]");
  if (mc) mc.addEventListener("change", () => { matchColour = mc.value; isolated = null; if (mode === "match") drawMatching(); writeUrl(); });

  /* ---- every cell ----------------------------------------------------------- */
  let cellsLoaded = false, cellInfo = null;
  async function loadCells() {
    if (cellsLoaded) return; cellsLoaded = true;
    status.textContent = "Reading the cells…";
    const [info, buf] = await Promise.all([
      (await fetch(R("data/cells.json"))).json(), fetchProgress("data/cells.bin", T.loadCells)]);
    cellInfo = info;
    const K = info.kept;
    const q16 = new Int16Array(buf, 0, K * 3), cls = new Uint8Array(buf, K * 6, K);
    const pos = new Float32Array(K * 3), col = new Float32Array(K * 3);
    const cols = info.classes.map((c) => new THREE.Color(c.color));
    for (let i = 0; i < K * 3; i++) pos[i] = q16[i] / 100;
    for (let i = 0; i < K; i++) { const c = cols[cls[i]]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    /* Normal blending, not additive: cell density varies a hundredfold
       between cortex and the cerebellar granule layer, and an additive cloud
       that shows the cortex burns the cerebellum to white the moment the
       camera comes in. Normal blending converges on the class colour instead.
       Checked by reading the framebuffer back: under 1% saturated at every
       zoom the page reaches. */
    const m = new THREE.PointsMaterial({ size: 0.03, vertexColors: true, transparent: true,
      opacity: 0.3, blending: THREE.NormalBlending, depthWrite: false, sizeAttenuation: true });
    cellG.add(new THREE.Points(g, m));
    if (legend) {
      legend.innerHTML = info.classes.filter((c) => c.n > 0).sort((a, b) => b.n - a.n).slice(0, 12)
        .map((c) => `<span class="lg"><s style="background:${c.color}"></s>${c.name.replace(/^\d+ /, "")}</span>`).join("") +
        `<span class="lg dim">${T.moreClasses(info.classes.length - 12)}</span>`;
      legend.hidden = false;
    }
    status.textContent = T.cellsDone(fmt(K), info.every, fmt(info.total_cells_in_source));
  }

  /* ---- the card ------------------------------------------------------------ */
  function nameHeading(rec, col) {
    const d = displayName(rec);
    return `<h3 title="${rec.id} · ${T.sources[rec.src] || rec.src}"><s style="background:${col}"></s><span class="nm">${d.head}</span></h3>` +
      (d.sub ? `<p class="side nm-sub">${d.sub}</p>` : "") +
      `<p class="side nm-id"><code>${rec.id}</code> <button type="button" class="lnk" data-copy-id="${rec.id}" title="${ZH ? "复制编号" : "Copy the id"}">${ZH ? "复制" : "copy"}</button>` +
      (PORTAL[rec.src] ? ` · <a href="${PORTAL[rec.src]}" target="_blank" rel="noopener" title="${ZH ? "在原始数据门户中打开（用编号查找）" : "Open the source portal; find it there by this id"}">${ZH ? "在门户中打开" : "open in its portal"}</a>` : "") + `</p>`;
  }
  function renderCard(rec, loading) {
    if (!card) return;
    const col = DIVISION[rec.major] || "#9aa2b1";
    const SRC = {
      "MouseLight": `<a href="https://ml-neuronbrowser.janelia.org/" target="_blank" rel="noopener">MouseLight</a>, Janelia`,
      "SEU-ALLEN": `<a href="https://doi.org/10.35077/g.25" target="_blank" rel="noopener">SEU-ALLEN</a>, Brain Image Library`,
      "ION-PFC": `<a href="https://mouse.digital-brain.cn/projectome/pfc" target="_blank" rel="noopener">ION prefrontal projectome</a>, Shanghai`,
      "ION-HIPP": `<a href="https://mouse.digital-brain.cn/hipp" target="_blank" rel="noopener">ION hippocampus projectome</a>, Shanghai`,
      "ION-CTX": `<a href="https://mouse.digital-brain.cn/projectome" target="_blank" rel="noopener">ION whole-cortex projectome</a>, Shanghai`,
    };
    const src = T.sources[rec.src]
      ? SRC[rec.src].replace(/>[^<]*</, ">" + T.sources[rec.src] + "<").replace(", Shanghai", "，上海").replace(", Janelia", "，Janelia").replace(", Brain Image Library", "，Brain Image Library")
      : (SRC[rec.src] || rec.src);
    const ms = rec.reach_mm;   /* at 1 m/s, 1 mm takes 1 ms */
    /* named regions when the build has them, divisions otherwise; each bar
       is a button that lifts that region in the brain */
    const fine = (rec.tf || []).filter(([k]) => k !== "root").slice(0, 7);
    const bars = fine.length
      ? fine.map(([k, f]) => {
          const info = RINFO[k] || {}; const col = DIVISION[info.major] || "#9aa2b1";
          return `<button class="tb" data-tb="${k}" title="${info.name || k}"><span class="tb-l"><b>${k}</b> ${ZH ? "" : (info.name || "").replace(/^(.{22}).+/, "$1…")}</span><span class="tb-r"><i style="width:${Math.round(f * 100)}%;background:${col}"></i></span><span class="tb-v">${Math.round(f * 100)}%</span></button>`; }).join("")
      : rec.targets.map(([k, f]) =>
      `<div class="tb"><span class="tb-l">${DIV(k)}</span><span class="tb-r"><i style="width:${Math.round(f * 100)}%;background:${DIVISION[k] || "#9aa2b1"}"></i></span><span class="tb-v">${Math.round(f * 100)}%</span></div>`).join("");
    card.innerHTML =
      nameHeading(rec, col) +
      `<p class="side">${src}${loading ? " · " + T.reading : ""}</p>` +
      (ZH
        ? `<p>胞体位于 <b>${rec.region_name || rec.region || T.unlabelled}</b>${rec.region ? ` (${rec.region})` : ""}${rec.major ? `，${DIV(rec.major)}` : ""}。` +
          `轴突总长 <b>${fmt(rec.axon_mm, 1)} mm</b>，沿最长路径离胞体最远 <b>${fmt(rec.reach_mm, 1)} mm</b>，末端共 <b>${fmt(rec.tips)}</b> 个。树突 ${fmt(rec.dend_mm, 1)} mm。</p>`
        : `<p>Cell body in <b>${rec.region_name || rec.region || T.unlabelled}</b>${rec.region_name && rec.region ? ` (${rec.region})` : ""}${rec.major ? `, ${rec.major.toLowerCase()}` : ""}. ` +
          `Axon <b>${fmt(rec.axon_mm, 1)} mm</b> of cable in all, reaching <b>${fmt(rec.reach_mm, 1)} mm</b> from the cell body along its longest path, ` +
          `ending in <b>${fmt(rec.tips)}</b> tips. Dendrites ${fmt(rec.dend_mm, 1)} mm.</p>`) +
      (rec.targets.length ? `<p class="side">${T.whereTips}${fine.length ? (ZH ? "，点击可在脑中点亮" : ", click one to lift it in the brain") : ""}</p><div class="tbars">${bars}</div>` : "") +
      `<p class="badge">${T.spike(fmt(ms, 0), SLOWDOWN)}</p>`;
  }
  /* ---- the view lives in the address bar ----------------------------------
     Every setting that shapes what you see goes into the query string as you
     change it, so the URL you copy reproduces the view: the neuron, the
     mode, the camera angle, zoom and pan, both sliders, the layer boxes, the
     filters and the colour choice. Written a moment after the last change,
     never every frame. */
  const f2 = (v) => (Math.round(v * 100) / 100).toString();
  function viewParams() {
    const u = new URLSearchParams();
    if (current) u.set("n", current.rec.id);
    u.set("m", mode);
    u.set("r", `${f2(pivot.rotation.x)},${f2(pivot.rotation.y % (2 * Math.PI))}`);
    if (Math.abs(zoomUser - 1) > 0.01) u.set("z", f2(zoomUser));
    if (pivot.position.lengthSq() > 1e-4) u.set("p", `${f2(pivot.position.x)},${f2(pivot.position.y)}`);
    const sl = q("[data-surface]"), sd = q("[data-divisions]");
    if (sl && sl.value !== "50") u.set("s", sl.value);
    if (sd && sd.value !== "50") u.set("d", sd.value);
    const box = (sel) => { const t = q(sel); return t ? (t.checked ? "1" : "0") : null; };
    const layers = [box("[data-t-shell]"), box("[data-t-regions]"), box("[data-t-cells]"), box("[data-t-microns]"), box("[data-t-turn]"), box("[data-t-zoom]")];
    if (layers.join("") !== "110011") u.set("l", layers.join(""));
    if (mode === "region" && regionQuery) { u.set("rq", regionQuery); if (regionColour !== "direction") u.set("rc", regionColour); }
    if (filterSrc !== "all") u.set("src", filterSrc);
    if (filterDiv !== "all") u.set("div", filterDiv);
    if (filterRegion) u.set("region", filterRegion);
    if (matchColour !== "subtype") u.set("col", matchColour);
    if (isolated) u.set("only", isolated);
    if (holoRaw) u.set("holo", holoRaw);
    if (inside) u.set("cube", inside.id);
    return u;
  }
  let urlTimer = 0;
  function writeUrl() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const u = new URL(location.href); u.search = viewParams().toString();
      history.replaceState(null, "", u);
    }, 250);
  }
  function setUrl() { writeUrl(); }
  function readView() {
    const u = new URLSearchParams(location.search);
    if (u.get("rq")) { regionQuery = u.get("rq"); if (regionIn) regionIn.value = regionQuery; }
    if (u.get("rc") && regionSel) { regionColour = u.get("rc"); regionSel.value = regionColour; }
    const r = (u.get("r") || "").split(",").map(Number);
    if (r.length === 2 && r.every(Number.isFinite)) { pivot.rotation.x = r[0]; pivot.rotation.y = r[1]; }
    if (u.get("z")) zoomUser = zoomUserNow = Math.min(9, Math.max(0.25, Number(u.get("z")) || 1));
    const pp = (u.get("p") || "").split(",").map(Number);
    if (pp.length === 2 && pp.every(Number.isFinite)) pivot.position.set(pp[0], pp[1], 0);
    const sl = q("[data-surface]"), sd = q("[data-divisions]");
    if (sl && u.get("s") !== null) { sl.value = u.get("s"); sl.dispatchEvent(new Event("input")); }
    if (sd && u.get("d") !== null) { sd.value = u.get("d"); sd.dispatchEvent(new Event("input")); }
    const l = u.get("l");
    if (l && l.length === 6) {
      ["[data-t-shell]", "[data-t-regions]", "[data-t-cells]", "[data-t-microns]", "[data-t-turn]", "[data-t-zoom]"].forEach((sel, i) => {
        const t = q(sel); if (t && t.checked !== (l[i] === "1")) { t.checked = l[i] === "1"; t.dispatchEvent(new Event("change")); }
      });
    }
    const fsEl = q("[data-f-src]"); if (fsEl && u.get("src")) { fsEl.value = u.get("src"); filterSrc = fsEl.value; }
    const fdEl = q("[data-f-div]"); if (fdEl && u.get("div")) { fdEl.value = u.get("div"); filterDiv = fdEl.value === u.get("div") ? u.get("div") : "all"; }
    const mcEl = q("[data-colour]"); if (mcEl && u.get("col")) { mcEl.value = u.get("col"); matchColour = mcEl.value; }
    if (u.get("only")) isolated = u.get("only");
    return { mode: u.get("m"), n: u.get("n") };
  }

  /* ---- picking -------------------------------------------------------------- */
  ray.params.Points.threshold = 0.2;
  function pickAt(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(somaG.userData.points, false);
    if (!hits.length) return null;
    hits.sort((a, b) => a.distanceToRay - b.distanceToRay);
    const ok = hits.find((h) => { const r = N[h.index]; return (filterSrc === "all" || r.src === filterSrc) && (filterDiv === "all" || r.major === filterDiv) && regionOk(r); });
    return ok ? N[ok.index] : null;
  }
  const cv = renderer.domElement;
  let downX = 0, downY = 0, panning = false;
  cv.style.cursor = "grab";
  cv.addEventListener("contextmenu", (ev) => ev.preventDefault());
  cv.addEventListener("pointerdown", (ev) => {
    /* left drag turns, right drag (or shift drag) slides the brain */
    panning = ev.button === 2 || ev.shiftKey;
    dragging = true; vel = 0; lastX = downX = ev.clientX; lastY = downY = ev.clientY;
    try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
    cv.style.cursor = panning ? "move" : "grabbing";
  });
  cv.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - lastX, dy = ev.clientY - lastY;
    if (panning) {
      /* millimetres per pixel at the camera's distance */
      const mmPx = 2 * camera.position.length() * Math.tan(camera.fov * Math.PI / 360) / mount.clientHeight;
      pivot.position.x += dx * mmPx; pivot.position.y -= dy * mmPx;
    } else {
      pivot.rotation.y += dx * 0.008; vel = dx * 0.008 * 30;
      pivot.rotation.x = Math.max(-1.2, Math.min(1.2, pivot.rotation.x + dy * 0.005));
    }
    lastX = ev.clientX; lastY = ev.clientY;
  });
  cv.addEventListener("pointerup", (ev) => {
    const wasPan = panning; panning = false;
    dragging = false; cv.style.cursor = "grab"; writeUrl();
    if (wasPan) return;
    const moved = Math.hypot(ev.clientX - downX, ev.clientY - downY);
    if (moved < 5) {
      const cu = pickCube(ev);
      if (cu) { dive(cu); return; }
      if (somaG.visible) {
        const rec = pickAt(ev);
        if (rec) { if (inside) leaveCube(); autoNext = false; setMode("pick"); focusOn(rec, true); }
      }
    }
  });
  cv.addEventListener("pointercancel", () => { dragging = false; cv.style.cursor = "grab"; });
  cv.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    zoomUser = Math.min(inside ? 9 : 2.5, Math.max(0.25, zoomUser * Math.exp(ev.deltaY * 0.0012))); writeUrl();
  }, { passive: false });
  cv.addEventListener("dblclick", () => { zoomUser = 1; pivot.position.set(0, 0, 0); writeUrl(); });

  /* ---- modes and toggles ------------------------------------------------- */
  function setMode(m) {
    if (mode === "all" && m !== "all" && allAbort) allAbort.abort();
    if (mode === "region" && m !== "region" && regionAbort) regionAbort.abort();
    mode = m;
    el.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-selected", b.dataset.mode === m ? "true" : "false"));
    matchG.visible = (m === "match");
    /* the lit neuron's region tags belong to the single-neuron views */
    targetG.visible = m !== "all";
    if (rlabels) rlabels.hidden = (m === "all");
    if (regionLegend) regionLegend.hidden = (m !== "region");
    if (m !== "match" && current) showTargets(current.rec); else if (m !== "match") clearTargets();
    projG.visible = (m === "region");
    if (m === "all") { loadAllAxons(); axonG.visible = true; focusG.visible = false; trailG.visible = false; somaG.visible = false; }
    else if (m === "region") { axonG.visible = false; focusG.visible = false; trailG.visible = false; somaG.visible = false; drawRegion(); }
    else if (m === "match") { axonG.visible = false; focusG.visible = false; trailG.visible = false; somaG.visible = false; if (!keepIsolated) isolated = null; keepIsolated = false; drawMatching(); }
    else { axonG.visible = false; focusG.visible = true; trailG.visible = true; somaG.visible = (m === "pick"); }
    if (inside && m !== "all" && m !== "match") { /* stay inside */ }
    else if (inside) leaveCube();
    if (m === "wire") { autoNext = !inside; if (!current && !inside) focusOn(pickRandom()); }
    if (m === "pick") { autoNext = false; if (!current) status.textContent = T.clickAny; }
    syncStatus();
  }
  function syncStatus() {
    const filtered = filterSrc !== "all" || filterDiv !== "all" || !!filterRegion;
    if (mode === "wire" && !filtered) status.textContent = `${fmt(N.length)}${T.neurons}: ` +
      Object.entries(meta.sources).map(([k, v]) => `${fmt(v)} ${T.sources[k] || k}`).join(", ") + ". " + T.oneAtATime;
    if (mode === "wire" && filtered) {
      const n = candidates().length;
      status.textContent = n ? (ZH ? `${fmt(n)} 个神经元符合筛选，逐个随机点亮。点“符合筛选的全部”可一次看到全部。` : `${fmt(n)} neurons match, one at a time. Click "All that match" to see every one at once.`)
                             : (ZH ? "没有符合筛选的神经元。" : "No neurons match these filters.");
    }
    if (mode === "pick") status.textContent = `${fmt(candidates().length)}${T.bodiesShown}`;
  }
  el.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { setMode(b.dataset.mode); writeUrl(); }));
  /* the jump buttons toggle: click one to dive in, click it again to leave;
     the lit one is the cube you are in */
  const cubeBtns = [...el.querySelectorAll("[data-cube]")];
  function syncCubeBtns() { cubeBtns.forEach((b) => b.setAttribute("aria-pressed", String(!!inside && inside.id === b.dataset.cube))); }
  cubeBtns.forEach((b) => b.addEventListener("click", () => {
    const cu = CUBES.find((c) => c.id === b.dataset.cube); if (!cu) return;
    if (inside === cu) { leaveCube(); writeUrl(); return; }
    if (!micronsG.visible) { micronsG.visible = true; const t = q("[data-t-microns]"); if (t) t.checked = true; }
    const go = () => { if (cu.centre) dive(cu); else setTimeout(go, 300); }; go(); writeUrl();
  }));
  const onToggle = (sel, fn) => { const t = q(sel); if (t) t.addEventListener("change", () => { fn(t.checked); writeUrl(); }); return t; };
  onToggle("[data-t-regions]", (on) => { regionG.visible = on; });
  onToggle("[data-t-shell]", (on) => { shellG.visible = on; });
  onToggle("[data-t-cells]", (on) => { cellG.visible = on; if (on) loadCells(); });
  onToggle("[data-t-microns]", (on) => { micronsG.visible = on; });
  const turnBox = onToggle("[data-t-turn]", (on) => { idleTurn = on; syncPause(); });
  /* fullscreen takes the whole stage: the picture fills the screen, the
     controls become a bar along the bottom and the card a panel on the
     right, and the panels button hides both for a clean picture. Esc brings
     the page back. */
  const viewEl = el.querySelector(".view") || mount;
  const fsBtn = q("[data-fullscreen]");
  const goFull = () => { if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen(); };
  if (fsBtn) fsBtn.addEventListener("click", goFull);
  const fsIcon = q("[data-fullscreen-icon]"); if (fsIcon) fsIcon.addEventListener("click", goFull);
  const panelsBtn = q("[data-panels]");
  const syncPanels = () => { const off = el.classList.contains("panels-off"); if (panelsBtn) { panelsBtn.setAttribute("aria-pressed", String(!off)); panelsBtn.title = off ? (ZH ? "显示控件" : "Show the controls") : (ZH ? "隐藏控件" : "Hide the controls"); } };
  if (panelsBtn) panelsBtn.addEventListener("click", () => { el.classList.toggle("panels-off"); syncPanels(); syncCtlH(); fitAll(); loop.once(); });
  syncPanels();
  const ctlEl = el.querySelector(".ctl");
  const syncCtlH = () => { el.style.setProperty("--ctl-h", (document.fullscreenElement && ctlEl && !el.classList.contains("panels-off") ? ctlEl.offsetHeight : 0) + "px"); };
  if (ctlEl && window.ResizeObserver) new ResizeObserver(syncCtlH).observe(ctlEl);
  document.addEventListener("fullscreenchange", () => { fitAll(); syncCtlH(); if (fsBtn) fsBtn.textContent = document.fullscreenElement ? (ZH ? "退出全屏" : "Exit fullscreen") : (ZH ? "全屏" : "Fullscreen"); });
  /* share: the address bar already holds the view; copy it */
  /* save an image: the frame as drawn, with a caption band naming the cell,
     its region, the source and the page, so the picture travels with its
     provenance. Read back right after a render, before the buffer clears. */
  const imgBtn = q("[data-image]");
  if (imgBtn) imgBtn.addEventListener("click", async () => {
    composer.render();
    const src = renderer.domElement;
    const W = src.width, H = src.height, band = Math.round(H * 0.11);
    const c = document.createElement("canvas"); c.width = W; c.height = H + band;
    const g = c.getContext("2d");
    g.fillStyle = "#07080B"; g.fillRect(0, 0, W, H + band);
    g.drawImage(src, 0, 0);
    g.fillStyle = "#0F1218"; g.fillRect(0, H, W, band);
    g.fillStyle = "#1D222B"; g.fillRect(0, H, W, 1);
    const fs = Math.round(band * 0.28), fs2 = Math.round(band * 0.2);
    g.fillStyle = "#EFF2F7"; g.font = `500 ${fs}px ui-sans-serif, -apple-system, Segoe UI, sans-serif`;
    const rec = current && current.rec;
    const line1 = rec
      ? (ZH ? `${rec.id} · 胞体位于 ${rec.region_name || rec.region || ""}` : `${rec.id} · cell body in ${rec.region_name || rec.region || "an unlabelled spot"}`)
      : (mode === "match" ? (ZH ? `${fmt(candidates().length)} 个神经元 · ${filterRegion || ""}` : `${fmt(candidates().length)} neurons · ${filterRegion || (filterDiv !== "all" ? filterDiv : "")}`)
                          : (ZH ? "七千万个神经元中的三万个" : "30,000 neurons of 70 million"));
    g.fillText(line1, Math.round(W * 0.03), H + Math.round(band * 0.42));
    g.fillStyle = "#9AA2B1"; g.font = `400 ${fs2}px ui-sans-serif, -apple-system, Segoe UI, sans-serif`;
    const srcName = rec ? ({ "MouseLight": "MouseLight, Janelia", "SEU-ALLEN": "SEU-ALLEN, Brain Image Library", "ION-PFC": "ION prefrontal projectome, Shanghai", "ION-HIPP": "ION hippocampus projectome, Shanghai", "ION-CTX": "ION whole-cortex projectome, Shanghai" }[rec.src] || rec.src) : "MouseLight · SEU-ALLEN · ION Shanghai";
    const line2 = (rec ? `${ZH ? "轴突" : "axon"} ${fmt(rec.axon_mm, 1)} mm · ${srcName} · ` : `${srcName} · `) + "Allen CCF · whatisabrain.com/mouse";
    g.fillText(line2, Math.round(W * 0.03), H + Math.round(band * 0.78));
    const blob = await new Promise((res) => c.toBlob(res, "image/png"));
    const name = `whatisabrain-mouse-${rec ? rec.id : "view"}.png`;
    const file = new File([blob], name, { type: "image/png" });
    /* a phone gets the share sheet (so the picture can go straight to a
       message); a desktop gets a download, since its share dialog is a
       detour that often ends nowhere */
    const mobile = (navigator.userAgentData && navigator.userAgentData.mobile) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: line1 }); return; } catch (e) {} }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.rel = "noopener"; document.body.appendChild(a); a.click();
    const was = imgBtn.textContent; imgBtn.textContent = ZH ? `已保存 ${name}` : `Saved ${name}`;
    setTimeout(() => { imgBtn.textContent = was; }, 2600);
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  });
  const shareBtn = q("[data-share]");
  if (shareBtn) shareBtn.addEventListener("click", async () => {
    const u = new URL(location.href); u.search = viewParams().toString();
    history.replaceState(null, "", u);
    const text = u.toString(); let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {}
    if (!ok && navigator.share) { try { await navigator.share({ url: text }); ok = true; } catch (e) {} }
    const was = shareBtn.textContent;
    shareBtn.textContent = ok ? (ZH ? "链接已复制" : "Link copied") : (ZH ? "复制失败，请复制地址栏" : "Copy the address bar");
    setTimeout(() => { shareBtn.textContent = was; }, 1800);
  });
  /* the feature request opens an issue on the public feedback repo with the
     current view's link in the body, so the report carries what was seen */
  const reqBtn = q("[data-request]");
  if (reqBtn) reqBtn.addEventListener("click", () => {
    const u = new URL(location.href); u.search = viewParams().toString();
    const issue = new URL(reqBtn.href);
    issue.searchParams.set("body", (ZH ? "我在看的视图：" : "The view I was looking at: ") + u.toString() + "\n\n" + (ZH ? "我的建议：" : "What I would like: "));
    reqBtn.href = issue.toString();
  });
  const pauseBtn = q("[data-pause]");
  /* the button is a symbol: two bars while it turns, a turning arrow while
     it is paused; the words live in the title and the label */
  function syncPause() {
    if (!pauseBtn) return;
    pauseBtn.innerHTML = idleTurn ? '<span class="pz">&#10074;&#10074;</span>' : '<span class="pz pz-turn">&#8635;</span>';
    const words = idleTurn ? (ZH ? "暂停旋转" : "Pause turning") : (ZH ? "继续旋转" : "Resume turning");
    pauseBtn.title = words; pauseBtn.setAttribute("aria-label", words);
  }
  if (pauseBtn) { pauseBtn.addEventListener("click", () => { idleTurn = !idleTurn; if (turnBox) turnBox.checked = idleTurn; syncPause(); writeUrl(); }); syncPause(); }
  onToggle("[data-t-zoom]", (on) => { zoomIn = on; retarget(); });
  const sl = q("[data-surface]");
  if (sl) sl.addEventListener("input", () => { surfaceGain = sl.value <= 0 ? 0 : Math.pow(2, (sl.value - 50) / 50 * 1.5); writeUrl(); });
  const sd = q("[data-divisions]");
  if (sd) sd.addEventListener("input", () => { divisionGain = sd.value <= 0 ? 0 : Math.pow(2, (sd.value - 50) / 50 * 1.5); writeUrl(); });
  const next = q("[data-next]"); if (next) next.addEventListener("click", () => { const r = pickRandom(); if (r) focusOn(r, true); });
  const clr = q("[data-clear]"); if (clr) clr.addEventListener("click", clearTrails);
  const fs = q("[data-f-src]"); if (fs) fs.addEventListener("change", () => { filterSrc = fs.value; syncStatus(); syncSomata(); if (mode === "wire" || mode === "pick") { const r0 = pickRandom(); if (r0 && (!current || !candidates().includes(current.rec))) focusOn(r0, mode === "pick"); } if (mode === "match") { isolated = null; drawMatching(); } writeUrl(); });
  const fr = q("[data-f-region]");
  if (fr) {
    /* every region a cell body sits in, as a datalist, so the box searches
       by acronym or name and shows the count */
    const dl = document.createElement("datalist"); dl.id = "region-list";
    const counts = {};
    for (const r of N) if (r.region) counts[r.region] = (counts[r.region] || 0) + 1;
    dl.innerHTML = Object.entries(counts).sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `<option value="${k}">${(meta.regions || {})[k] || k} (${n})</option>`).join("");
    document.body.appendChild(dl); fr.setAttribute("list", "region-list");
    fr.addEventListener("input", () => { filterRegion = fr.value.trim(); syncStatus(); syncSomata(); if (mode === "wire" || mode === "pick") { const r0 = pickRandom(); if (r0 && (!current || !candidates().includes(current.rec))) focusOn(r0, mode === "pick"); } if (mode === "match") { isolated = null; drawMatching(); } writeUrl(); });
    const u0 = new URLSearchParams(location.search).get("region");
    if (u0) { fr.value = u0; filterRegion = u0; }
  }
  /* in pick mode only the matching cell bodies are shown, so a region query
     is something you can click on */
  function syncSomata() {
    const pts = somaG.userData.points; if (!pts) return;
    const col = pts.geometry.attributes.color, c = new THREE.Color();
    N.forEach((r, i) => {
      const ok = (filterSrc === "all" || r.src === filterSrc) && (filterDiv === "all" || r.major === filterDiv) && regionOk(r);
      c.set(ok ? (DIVISION[r.major] || "#9aa2b1") : "#000000");
      col.setXYZ(i, c.r, c.g, c.b);
    });
    col.needsUpdate = true;
  }
  const fd = q("[data-f-div]");
  if (fd) {
    const divs = {}; for (const r of N) if (r.major) divs[r.major] = (divs[r.major] || 0) + 1;
    fd.innerHTML = `<option value="all">${T.everyDivision}</option>` +
      Object.entries(divs).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<option value="${k}">${DIV(k)} (${n})</option>`).join("");
    fd.addEventListener("change", () => { filterDiv = fd.value; syncStatus(); syncSomata(); if (mode === "wire" || mode === "pick") { const r0 = pickRandom(); if (r0 && (!current || !candidates().includes(current.rec))) focusOn(r0, mode === "pick"); } if (mode === "match") { isolated = null; drawMatching(); } writeUrl(); });
  }

  /* ---- the loop --------------------------------------------------------- */
  const loop = makeLoop(el, (dt) => {
    if (!dragging) {
      pivot.rotation.y += vel * dt; vel *= Math.pow(0.002, dt);
      if (idleTurn && !dragging) pivot.rotation.y += dt * 0.07;
    }
    /* the frame follows its target with a soft lag; the offset is applied
       inside the pivot so it turns with the brain */
    retarget();
    const k = 1 - Math.pow(0.08, dt);
    /* while a neuron is lit the atlas steps back so one axon can be read
       against it; it comes forward again for the whole-brain views */
    const lit = !!current || !!inside || mode === "all" || mode === "match" || mode === "region";
    for (const m of regionMats) m.opacity += ((lit ? REGION_A_LIT : REGION_A) * divisionGain - m.opacity) * k;
    if (shellSolid) shellSolid.opacity += ((lit ? SHELL_A_LIT : SHELL_A) * surfaceGain - shellSolid.opacity) * k;
    if (holoMat) { holoMat.userData.tick(holoMat, performance.now() / 1000); holoMat.uniforms.uOpacity.value = holoMat.userData.gain * surfaceGain * (lit ? 0.6 : 1); }
    bloom.strength += ((inside ? 0.1 : mode === "all" ? 0.12 : mode === "match" ? 0.05 : mode === "region" ? 0.09 : 0.3) - bloom.strength) * k;
    /* the live meshes: the clock the born times are on, and the GPU catches
       up with whatever landed since the last frame, once per frame */
    liveT = performance.now() / 1000;
    for (const set of [allLive, regionLive]) if (set) for (const L of Object.values(set)) {
      L.mesh.material.uniforms.uTime.value = liveT;
      L.mesh.material.uniforms.uCamDist.value = camera.position.length();
      L.flush();
    }
    frameNow.lerp(frameTarget, k); zNow += (zTarget - zNow) * k;
    world.position.copy(frameNow);       /* world's position is in pivot space */
    /* a portrait phone sees a narrower slice, so the camera backs off in
       proportion to keep the whole brain in frame */
    zoomUserNow += (zoomUser - zoomUserNow) * k;
    const back = Math.max(1, 1.4 / camera.aspect) * zoomUserNow;
    camera.position.z = zNow * back; camera.position.y = 3.5 * (zNow / HOME_Z) * back;
    camera.lookAt(0, 0, 0);
    if (current && !current.done) {
      current.t += dt;
      const grow = current.t * SPEED;
      current.mat.uniforms.uGrow.value = grow;
      if (grow > current.mesh.geometry.userData.maxDist + 0.5) current.done = true;
    } else if (current && current.done) {
      holdT += dt;
      if (holdT > HOLD && autoNext && mode === "wire") { const r = pickRandom(); if (r) focusOn(r); }
    }
    composer.render();
    if ((mode === "all" || mode === "region") && !cablesSolid) renderCables();
    placeRegionLabels();
  });
  new ResizeObserver(fitAll).observe(mount);
  loop.run();

  /* a shared link lands on its view: neuron, mode, camera, sliders, filters */
  /* a handle for a headless check: the page's own clock can be stepped
     where requestAnimationFrame never fires */
  el.__mouse = { loop, setMode, drawRegion, loadAllAxons, hud, streamCoarse,
    get all() { return allLive; }, get region() { return regionLive; }, get mode() { return mode; },
    setRegion(q2) { regionQuery = q2; regionIso = null; if (regionIn) regionIn.value = q2; }, N,
    scene, world, packG, cubeMeshes, CUBES, get inside() { return inside; }, camera, THREE };
  const view = readView();
  if (new URLSearchParams(location.search).get("holo")) applyLook(new URLSearchParams(location.search).get("holo"));
  const wantRec = view.n && N.find((r) => r.id === view.n);
  if (fr && fr.value) syncSomata();
  const wantCube = new URLSearchParams(location.search).get("cube");
  if (wantCube) { const cu = CUBES.find((c) => c.id === wantCube); if (cu) { setMode("pick"); const go = () => { if (cu.centre) dive(cu); else setTimeout(go, 300); }; go(); } }
  else if (view.mode === "match") { keepIsolated = !!isolated; setMode("match"); if (wantRec) focusOn(wantRec, true); }
  else if (view.mode === "all") { setMode("all"); }
  else if (view.mode === "region") { setMode("region"); }
  else if (wantRec) { setMode(view.mode === "wire" ? "wire" : "pick"); autoNext = view.mode === "wire"; focusOn(wantRec, true); }
  else if (fr && fr.value || view.mode === "pick") setMode("pick");
  else setMode("wire");

  /* how much of the canvas has gone to white: the check the hairball and
     the cell cloud are tuned against, read back off the framebuffer */
  function measure() {
    const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    composer.render();
    const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sat = 0, lit = 0;
    for (let i = 0; i < px.length; i += 4) {
      const m = Math.min(px[i], px[i + 1], px[i + 2]);
      if (m > 235) sat++;
      if (px[i] + px[i + 1] + px[i + 2] > 60) lit++;
    }
    return { satPct: 100 * sat / (w * h), litPct: 100 * lit / (w * h), w, h };
  }
  return { scene, camera, renderer, loop, focusOn, setMode, get current() { return current; }, N,
           loadAllAxons, loadCells, pivot, measure, bloom, dive, leaveCube, pickCube, CUBES };
}
