/* One neuron, with its parts named.
 *
 * A real cell from the same data as the rest of /mouse: a MouseLight
 * reconstruction with its dendrites and its whole axon, drawn at true scale
 * inside the Allen reference brain. The four labels sit on measured anchor
 * points of this cell (its cell body, the centre of its dendrites, the middle
 * of its longest axon path, the farthest axon tip), so they move with it.
 * Nothing is a schematic.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { REDUCED, makeRenderer, fitRenderer, makeLoop, shellMaterials, fmt, fixNormals } from "./holo3d.js";

const ROOT = new URL("../", import.meta.url).href;
/* the neuron data (data/) is too large for the site's own repository, so on
   whatisabrain.com it is read from the public data repository
   github.com/amyleesterling/whatisabrain-data, a copy of this page's data/
   folder. Everywhere else (a local checkout, the data repository's own
   pages) data/ sits beside the page and is read from there. */
const DATA_HOST = "https://amyleesterling.github.io/whatisabrain-data/mouse/";
const DATA = /(^|\.)whatisabrain\.com$/.test(location.hostname) ? DATA_HOST : ROOT;
const R = (p) => (p.startsWith("data/") ? DATA : ROOT) + p;
const ZH = document.documentElement.lang.toLowerCase().startsWith("zh");

/* the parts and their colours: the same axon blue as the whole-brain page,
   a warm dendrite so the two read apart, terminals in the striatum pink */
export const PARTS = {
  soma: { color: "#fff1c0" },
  dendrite: { color: "#ffb24d" },
  axon: { color: "#6fd0ff" },
  terminal: { color: "#ff5cc0" },
};
const SPEED = 4.0;   /* mm of cable per second, as on the whole-brain page */

export async function mountNeuron(el) {
  const mount = el.querySelector("[data-mount]");
  const status = el.querySelector("[data-status]");
  const overlay = el.querySelector("[data-labels]");
  const q = (s) => el.querySelector(s);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 200);
  const renderer = makeRenderer(mount);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.5, 0.55);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  function fitAll() {
    if (!fitRenderer(renderer, camera, mount)) return;
    composer.setSize(mount.clientWidth, mount.clientHeight); bloom.setSize(mount.clientWidth, mount.clientHeight);
  }
  fitAll();
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(3, 5, 6); scene.add(key);

  /* CCF has y down; the flip puts dorsal up. The pivot turns; the world
     inside it is offset so the cell body sits at the origin. */
  const pivot = new THREE.Group(), world = new THREE.Group();
  world.rotation.x = Math.PI; pivot.add(world); scene.add(pivot);
  pivot.rotation.y = -0.7;

  /* ---- the featured cell ------------------------------------------------ */
  const feat = await (await fetch(R("data/featured.json"))).json();
  const want = new URLSearchParams(location.search).get("n");
  const rec = feat.neurons.find((r) => r.id === want) || feat.neurons[0];
  const r = await fetch(R(`data/neurons-${rec.shard || 0}.bin`),
    { headers: { Range: `bytes=${rec.offset}-${rec.offset + rec.bytes - 1}` } });
  let buf = await r.arrayBuffer();
  if (r.status !== 206) buf = buf.slice(rec.offset, rec.offset + rec.bytes);

  /* unpack the polylines, keeping per-vertex distance and compartment */
  const dv = new DataView(buf, 0, 8), P = dv.getUint32(0, true), V = dv.getUint32(4, true);
  const counts = new Uint16Array(buf, 8, P);
  const xyz = new Int16Array(buf, 8 + 2 * P, V * 3);
  const dist = new Uint16Array(buf, 8 + 2 * P + 6 * V, V);
  const comp = new Uint8Array(buf, 8 + 2 * P + 8 * V, V);
  const soma = new THREE.Vector3(rec.soma[0], rec.soma[1], rec.soma[2]);
  /* world.position is in pivot space and is applied after the flip, so the
     flipped soma, (x, -y, -z), is what has to be cancelled */
  world.position.set(-soma.x, soma.y, soma.z);

  let S = 0; for (let i = 0; i < P; i++) S += counts[i] - 1;
  const pos = new Float32Array(S * 6), d = new Float32Array(S * 2), c = new Float32Array(S * 2);
  let v = 0, o = 0, k = 0, maxD = 0, tipIdx = 0;
  const dendPts = [], tips = [];
  for (let i = 0; i < P; i++) {
    const n = counts[i];
    for (let j = 0; j < n - 1; j++) {
      const a = v + j, b = a + 1;
      pos[o++] = xyz[a * 3] / 100; pos[o++] = xyz[a * 3 + 1] / 100; pos[o++] = xyz[a * 3 + 2] / 100;
      pos[o++] = xyz[b * 3] / 100; pos[o++] = xyz[b * 3 + 1] / 100; pos[o++] = xyz[b * 3 + 2] / 100;
      d[k] = dist[a] / 100; d[k + 1] = dist[b] / 100; c[k] = comp[b]; c[k + 1] = comp[b]; k += 2;
      if (comp[b] >= 3) dendPts.push(xyz[b * 3] / 100, xyz[b * 3 + 1] / 100, xyz[b * 3 + 2] / 100);
      if (comp[b] === 2 && dist[b] / 100 > maxD) { maxD = dist[b] / 100; tipIdx = b; }
    }
    /* the last vertex of every path is a branch end; the axon ones are terminals */
    const last = v + n - 1;
    if (comp[last] === 2) tips.push(xyz[last * 3] / 100, xyz[last * 3 + 1] / 100, xyz[last * 3 + 2] / 100);
    v += n;
  }
  const farTip = new THREE.Vector3(xyz[tipIdx * 3] / 100, xyz[tipIdx * 3 + 1] / 100, xyz[tipIdx * 3 + 2] / 100);
  /* the axon label anchor: the vertex whose distance is nearest half the reach */
  let midIdx = 0, best = Infinity;
  for (let i = 0; i < V; i++) if (comp[i] === 2) { const e = Math.abs(dist[i] / 100 - maxD * 0.5); if (e < best) { best = e; midIdx = i; } }
  const midAxon = new THREE.Vector3(xyz[midIdx * 3] / 100, xyz[midIdx * 3 + 1] / 100, xyz[midIdx * 3 + 2] / 100);
  const dendC = new THREE.Vector3();
  for (let i = 0; i < dendPts.length; i += 3) dendC.add(new THREE.Vector3(dendPts[i], dendPts[i + 1], dendPts[i + 2]));
  if (dendPts.length) dendC.multiplyScalar(3 / dendPts.length); else dendC.copy(soma);

  /* ---- materials: one line mesh, the shader picks colour by compartment and
     dims the parts that are not in focus ---------------------------------- */
  const mat = new THREE.ShaderMaterial({
    uniforms: { uGrow: { value: 1e6 }, uHead: { value: 0 }, uFocus: { value: 0 },
                cAxon: { value: new THREE.Color(PARTS.axon.color) }, cDend: { value: new THREE.Color(PARTS.dendrite.color) } },
    vertexShader:
      "attribute float dist; attribute float comp; varying float vd; varying float vc;\n" +
      "void main(){ vd = dist; vc = comp; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader:
      "uniform float uGrow; uniform float uHead; uniform float uFocus; uniform vec3 cAxon; uniform vec3 cDend;\n" +
      "varying float vd; varying float vc;\n" +
      "void main(){\n" +
      "  if (vd > uGrow) discard;\n" +
      "  bool dend = vc > 2.5;\n" +
      "  vec3 base = dend ? cDend : cAxon;\n" +
      "  /* uFocus: 0 all lit, 2 axon lit, 3 dendrites lit */\n" +
      "  float dim = (uFocus < 0.5) ? 1.0 : ((uFocus > 2.5) == dend ? 1.0 : 0.18);\n" +
      "  float head = exp(-(uGrow - vd) / 0.35) * uHead;\n" +
      "  gl_FragColor = vec4(base * (0.9 + 2.0 * head) * dim, (dend ? 0.95 : 0.85) * dim + 0.7 * head);\n" +
      "  #include <tonemapping_fragment>\n  #include <colorspace_fragment>\n}",
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("dist", new THREE.BufferAttribute(d, 1));
  g.setAttribute("comp", new THREE.BufferAttribute(c, 1));
  const lines = new THREE.LineSegments(g, mat); lines.renderOrder = 10; world.add(lines);

  const somaMesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16),
    new THREE.MeshBasicMaterial({ color: PARTS.soma.color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
  somaMesh.position.copy(soma); world.add(somaMesh);
  const tipGeo = new THREE.BufferGeometry();
  tipGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tips), 3));
  /* terminals at a fixed few pixels, so the close-up does not turn them
     into squares */
  const tipMat = new THREE.PointsMaterial({ color: PARTS.terminal.color, size: 3.2, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false });
  const tipPts = new THREE.Points(tipGeo, tipMat); tipPts.renderOrder = 11; world.add(tipPts);

  /* the brain for scale, faint, off by default so the cell reads first */
  const shellG = new THREE.Group(); world.add(shellG); shellG.visible = false;
  /* the twelve divisions and this cell's own regions, the same glass and
     colours as the whole-brain page */
  const DIVISION = { "Isocortex": "#6fd0ff", "Olfactory areas": "#ffb24d", "Hippocampal formation": "#3fe3b0",
    "Cortical subplate": "#a8e6cf", "Striatum": "#ff5cc0", "Pallidum": "#d38bff", "Thalamus": "#ffd23f",
    "Hypothalamus": "#ff8a5c", "Midbrain": "#a163ff", "Pons": "#7ea6ff", "Medulla": "#f0a0ff", "Cerebellum": "#ffe680",
    "fibre tracts": "#9aa2b1", "ventricles": "#666e7c" };
  const DIVMESH = { "isocortex": "Isocortex", "olfactory-areas": "Olfactory areas", "hippocampal-formation": "Hippocampal formation",
    "striatum": "Striatum", "thalamus": "Thalamus", "hypothalamus": "Hypothalamus", "midbrain": "Midbrain", "pons": "Pons",
    "medulla": "Medulla", "cerebellum": "Cerebellum", "olfactory-bulb": "Olfactory areas" };
  const divG = new THREE.Group(); world.add(divG); divG.visible = false;
  let divLoaded = false;
  const gl2 = new GLTFLoader();
  const loadG = (url) => new Promise((res, rej) => gl2.load(R(url), (g) => { let m = null; g.scene.traverse((o) => { if (o.isMesh && !m) m = o; }); res(m); }, undefined, rej));
  function loadDivisions() {
    if (divLoaded) return; divLoaded = true;
    for (const [name, div] of Object.entries(DIVMESH)) loadG(`meshes/${name}.glb`).then((m) => {
      m.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(DIVISION[div]), transparent: true, opacity: 0.05,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide });
      m.renderOrder = 1; divG.add(m); loop.once();
    }).catch(() => {});
  }
  const targetG = new THREE.Group(); world.add(targetG); targetG.visible = false;
  const rlabels = el.querySelector("[data-rlabels]");
  let targetsLoaded = false; const shownT = [];
  async function loadTargets() {
    if (targetsLoaded) return; targetsLoaded = true;
    let RINFO = {}; try { RINFO = await (await fetch(R("data/regions.json"))).json(); } catch (e) { return; }
    const want = [];
    if (rec.rf) want.push({ acr: rec.rf, share: 0, soma: true });
    for (const [acr, share] of (rec.tf || [])) { if (share < 0.08 || acr === "root") continue; const same = want.find((w) => w.acr === acr); if (same) same.share = share; else want.push({ acr, share }); }
    for (const w of want.slice(0, 5)) {
      const info = RINFO[w.acr]; if (!info || !info.file) continue;
      let m; try { m = await loadG(`meshes/regions/${info.file}`); } catch (e) { continue; }
      m.geometry.computeBoundingBox(); const c = new THREE.Vector3(); m.geometry.boundingBox.getCenter(c);
      const col = new THREE.Color(DIVISION[info.major] || "#9aa2b1");
      m.material = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.06 + 0.1 * w.share, blending: THREE.NormalBlending, depthWrite: false, side: THREE.FrontSide });
      m.renderOrder = 3; targetG.add(m);
      let label = null;
      if (rlabels) {
        label = document.createElement("span"); label.className = "rlbl" + (w.soma ? " soma" : "");
        const notes = [w.soma ? (ZH ? "胞体" : "cell body") : null, w.share ? `${Math.round(w.share * 100)}%` : null].filter(Boolean).join(" · ");
        label.innerHTML = `<b>${w.acr}</b><small>${notes}</small>`; label.title = info.name || w.acr; rlabels.appendChild(label);
      }
      shownT.push({ center: c, label });
      loop.once();
    }
  }
  const tmpT = new THREE.Vector3();
  function placeTargetLabels() {
    if (!rlabels || !targetG.visible) { if (rlabels) rlabels.hidden = !targetG.visible; return; }
    rlabels.hidden = false;
    const w = mount.clientWidth, h = mount.clientHeight; const placed = [];
    for (const t of shownT) {
      if (!t.label) continue;
      tmpT.copy(t.center); world.localToWorld(tmpT); tmpT.project(camera);
      let x = (tmpT.x + 1) / 2 * w, y = (1 - tmpT.y) / 2 * h;
      for (const q of placed) if (Math.abs(q.x - x) < 80 && Math.abs(q.y - y) < 18) y = q.y + 18;
      placed.push({ x, y });
      t.label.style.left = x + "px"; t.label.style.top = y + "px";
      t.label.style.opacity = (tmpT.z > 1 || x < 0 || x > w || y < 0 || y > h) ? "0" : "";
    }
  }
  new GLTFLoader().load(R("meshes/root.glb"), (gl) => {
    let m = null; gl.scene.traverse((o) => { if (o.isMesh && !m) m = o; });
    shellMaterials(m, { color: "#6fd0ff", emissive: "#1c6ea8", emissiveIntensity: 0.2, opacity: 0.05,
      side: "front", depthWrite: false, wire: "#cdefff", wireOpacity: 0.01 });
    m.renderOrder = 5; shellG.add(m); loop.once();
  });

  /* ---- camera: frame the whole cell, drag turns, wheel zooms ------------ */
  const reach = Math.max(2, rec.reach_mm || 5);
  const zWhole = Math.min(28, 3 + 1.5 * reach);
  let zHome = zWhole, zoomUser = 1, zoomNow = 1, vel = 0, dragging = false, lastX = 0, lastY = 0;
  /* the frame slides between the whole cell and a close-up on the soma */
  const lookAt = new THREE.Vector3(0, 0, 0), lookNow = new THREE.Vector3(0, 0, 0);
  let zNow = zWhole;
  const cv = renderer.domElement; cv.style.cursor = "grab";
  let panning = false;
  cv.addEventListener("contextmenu", (ev) => ev.preventDefault());
  cv.addEventListener("pointerdown", (ev) => { panning = ev.button === 2 || ev.shiftKey; dragging = true; vel = 0; lastX = ev.clientX; lastY = ev.clientY; cv.setPointerCapture(ev.pointerId); cv.style.cursor = panning ? "move" : "grabbing"; });
  cv.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const dx = ev.clientX - lastX, dy = ev.clientY - lastY;
    if (panning) {
      const mmPx = 2 * camera.position.length() * Math.tan(camera.fov * Math.PI / 360) / mount.clientHeight;
      pivot.position.x += dx * mmPx; pivot.position.y -= dy * mmPx;
    } else {
      pivot.rotation.y += dx * 0.008; vel = dx * 0.008 * 30;
      pivot.rotation.x = Math.max(-1.3, Math.min(1.3, pivot.rotation.x + dy * 0.005));
    }
    lastX = ev.clientX; lastY = ev.clientY;
  });
  cv.addEventListener("pointerup", () => { dragging = false; cv.style.cursor = "grab"; });
  cv.addEventListener("pointercancel", () => { dragging = false; cv.style.cursor = "grab"; });
  cv.addEventListener("wheel", (ev) => { ev.preventDefault(); zoomUser = Math.min(3, Math.max(0.15, zoomUser * Math.exp(ev.deltaY * 0.0012))); }, { passive: false });
  cv.addEventListener("dblclick", () => { zoomUser = 1; pivot.position.set(0, 0, 0); });

  /* ---- labels: HTML, positioned by projecting the anchors each frame ---- */
  const anchors = { soma, dendrite: dendC, axon: midAxon, terminal: farTip };
  const labelEls = {};
  for (const part of Object.keys(anchors)) {
    const node = overlay && overlay.querySelector(`[data-part="${part}"]`);
    if (node) labelEls[part] = node;
  }
  const svg = overlay && overlay.querySelector("svg");
  const tmp = new THREE.Vector3();
  function placeLabels() {
    if (!overlay) return;
    const w = mount.clientWidth, h = mount.clientHeight;
    let paths = "";
    for (const [part, a] of Object.entries(anchors)) {
      const node = labelEls[part]; if (!node) continue;
      tmp.copy(a); world.localToWorld(tmp); tmp.project(camera);
      const x = (tmp.x + 1) / 2 * w, y = (1 - tmp.y) / 2 * h;
      const behind = tmp.z > 1;
      node.style.opacity = behind ? "0" : "";
      /* each label leaves its anchor in its own direction, so the cell body
         and the dendrites, which sit almost on top of each other, never
         collide: soma down-left, dendrites up, axon right, terminals down */
      const off = { soma: [-60, 60], dendrite: [10, -70], axon: [80, -20], terminal: [30, 64] }[part];
      const lx = x + off[0], ly = y + off[1];
      node.style.left = lx + "px"; node.style.top = ly + "px";
      node.style.transform = off[0] < 0 ? "translate(-100%,-50%)" : "translate(0,-50%)";
      paths += `<path d="M${x.toFixed(1)},${y.toFixed(1)} L${lx.toFixed(1)},${ly.toFixed(1)}" data-part="${part}"/>`;
    }
    if (svg) svg.innerHTML = paths;
  }

  /* ---- focus: a part is lit, the rest steps back ------------------------ */
  let focus = null;
  function setFocus(part) {
    focus = part;
    mat.uniforms.uFocus.value = part === "axon" ? 2 : part === "dendrite" ? 3 : part === "terminal" ? 2 : 0;
    somaMesh.material.opacity = (!part || part === "soma") ? 1 : 0.25;
    tipMat.opacity = (!part || part === "terminal" || part === "axon") ? 0.9 : 0.15;
    tipMat.size = part === "terminal" ? 4.5 : 3.2;
    el.querySelectorAll("[data-part]").forEach((n) => n.classList.toggle("is-on", !!part && n.dataset.part === part));
    el.querySelectorAll("[data-part]").forEach((n) => n.classList.toggle("is-off", !!part && n.dataset.part !== part));
  }
  el.querySelectorAll("[data-part]").forEach((n) => {
    n.addEventListener("click", (ev) => { ev.preventDefault(); setFocus(focus === n.dataset.part ? null : n.dataset.part); });
    n.addEventListener("mouseenter", () => { if (!focusLocked) setFocus(n.dataset.part); });
    n.addEventListener("mouseleave", () => { if (!focusLocked) setFocus(null); });
  });
  let focusLocked = false;
  el.querySelectorAll("[data-part]").forEach((n) => n.addEventListener("click", () => { focusLocked = !!focus; }));

  /* ---- the stages -------------------------------------------------------
     Whole cell; then the close-up, the camera at a couple of millimetres from
     the cell body with the dendrites lit and the axon stepped back; then the
     synapse, a circular inset with its own scene: a real synapse from the
     MICrONS volume in primary visual cortex, an inhibitory axon (Tendril)
     touching the dendrite of a layer 5 pyramidal cell (Aura), the same cell
     class as the default cell here. The bubble loads on first use. */
  let turning = true, stage = "whole";
  let bubble = null;
  const bubbleEl = el.querySelector("[data-bubble]");
  async function makeBubble() {
    /* two frames, one scene each, from the same pair of meshes: A pulled
       back to show the dendrite with the axon crossing it, B close on the
       contact. Each has its own renderer; the geometries are shared. */
    const meta = (feat.synapse && feat.synapse.meshes) || ["meshes/synapse/synapse-aura.glb", "meshes/synapse/synapse-tendril.glb"];
    const loaderB = new GLTFLoader();
    const load = (url) => new Promise((res, rej) => loaderB.load(R(url), (g) => res(g.scene), undefined, rej));
    const [aura, tendril] = await Promise.all(meta.map(load));
    const matD = new THREE.MeshStandardMaterial({ color: new THREE.Color(PARTS.dendrite.color), roughness: 0.55, metalness: 0.05 });
    const matA = new THREE.MeshStandardMaterial({ color: new THREE.Color(PARTS.axon.color), roughness: 0.5, metalness: 0.05 });
    const geos = [];
    aura.traverse((o) => { if (o.isMesh) { fixNormals(o.geometry); geos.push([o.geometry, matD]); } });
    tendril.traverse((o) => { if (o.isMesh) { fixNormals(o.geometry); geos.push([o.geometry, matA]); } });
    function view(mountB, dist, spin) {
      const sc = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(34, 1, 0.01, 50);
      const rd = makeRenderer(mountB); fitRenderer(rd, cam, mountB);
      sc.add(new THREE.AmbientLight(0xffffff, 0.55));
      const k1 = new THREE.DirectionalLight(0xffffff, 1.0); k1.position.set(2, 3, 2); sc.add(k1);
      const k2 = new THREE.DirectionalLight(0x9fd0ff, 0.5); k2.position.set(-2, -1, -2); sc.add(k2);
      const piv = new THREE.Group(); sc.add(piv);
      for (const [g, m] of geos) piv.add(new THREE.Mesh(g, m));
      const syn = new THREE.Mesh(new THREE.SphereGeometry(dist > 0.5 ? 0.008 : 0.0045, 20, 14), new THREE.MeshBasicMaterial({ color: PARTS.soma.color }));
      piv.add(syn);
      const dir = new THREE.Vector3(0.6, 0.28, 1).normalize();
      cam.position.copy(dir).multiplyScalar(dist); cam.lookAt(0, 0, 0);
      let bdrag = false, bx = 0, bvel = 0;
      const cv = rd.domElement; cv.style.cursor = "grab";
      cv.addEventListener("pointerdown", (ev) => { bdrag = true; bx = ev.clientX; bvel = 0; try { cv.setPointerCapture(ev.pointerId); } catch (e) {} });
      cv.addEventListener("pointermove", (ev) => { if (!bdrag) return; const dx = ev.clientX - bx; piv.rotation.y += dx * 0.01; bvel = dx * 0.3; bx = ev.clientX; });
      cv.addEventListener("pointerup", () => { bdrag = false; });
      cv.addEventListener("wheel", (ev) => { ev.preventDefault(); cam.position.multiplyScalar(Math.exp(ev.deltaY * 0.001)); const l = cam.position.length(); if (l < 0.12) cam.position.setLength(0.12); if (l > 4) cam.position.setLength(4); }, { passive: false });
      new ResizeObserver(() => fitRenderer(rd, cam, mountB)).observe(mountB);
      return { sc, cam, rd, piv, spin, get dragging() { return bdrag; }, get vel() { return bvel; }, set vel(v) { bvel = v; } };
    }
    const A = view(bubbleEl.querySelector("[data-bmount-a]"), 1.1, 0.12);
    const B = view(bubbleEl.querySelector("[data-bmount-b]"), 0.34, 0.25);
    const leaders = el.querySelector("[data-leaders]"), mk = el.querySelector("[data-mk]");
    const tmpS = new THREE.Vector3();
    return {
      on: true,
      frame(dt) {
        for (const v of [A, B]) {
          if (!v.dragging) { v.piv.rotation.y += v.vel * dt + (REDUCED ? 0 : dt * v.spin); v.vel *= Math.pow(0.002, dt); }
          v.rd.render(v.sc, v.cam);
        }
        /* the marker on the cell's dendrites, and the leaders: marker to
           frame A, then the contact inside frame A to frame B */
        if (!leaders || !mk) return;
        const vw = el.querySelector(".view") || mount;
        const vr = vw.getBoundingClientRect();
        tmpS.copy(anchors.dendrite); world.localToWorld(tmpS); tmpS.project(camera);
        const mx = (tmpS.x + 1) / 2 * mount.clientWidth, my = (1 - tmpS.y) / 2 * mount.clientHeight;
        mk.hidden = false; mk.style.left = mx + "px"; mk.style.top = my + "px";
        const fa = bubbleEl.querySelector('[data-frame="a"] .fm').getBoundingClientRect();
        const fb = bubbleEl.querySelector('[data-frame="b"] .fm').getBoundingClientRect();
        const ax = fa.left - vr.left, ay = fa.top - vr.top + fa.height * 0.5;
        /* the contact in frame A's own view */
        const cA = new THREE.Vector3(0, 0, 0).project(A.cam);
        const cx = fa.left - vr.left + (cA.x + 1) / 2 * fa.width, cy = fa.top - vr.top + (1 - cA.y) / 2 * fa.height;
        const bx0 = fb.left - vr.left, by0 = fb.top - vr.top + 14;
        leaders.setAttribute("viewBox", `0 0 ${vr.width} ${vr.height}`);
        leaders.innerHTML = `<path d="M${mx.toFixed(1)},${my.toFixed(1)} L${(mx + 40).toFixed(1)},${my.toFixed(1)} L${ax.toFixed(1)},${ay.toFixed(1)}"/>` +
          `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3"/>` +
          `<path d="M${cx.toFixed(1)},${cy.toFixed(1)} L${cx.toFixed(1)},${(fa.bottom - vr.top + 7).toFixed(1)} L${bx0.toFixed(1)},${by0.toFixed(1)}"/>`;
      },
    };
  }
  /* ---- the receptor: a molecule from its deposited coordinates ------
     The third frame. mouse/data/molecules/<slug>.json (written by
     tools/build-molecules.py from the RCSB record) names the entry; the
     GLBs are MolecularNodes' surface of the atoms coloured by chain and the
     ligand as spheres, in units of 10 nm, scaled to nanometres here. */
  let molecule = null, moleculeSlug = "glua2-5weo";
  const frameC = bubbleEl && bubbleEl.querySelector('[data-frame="c"]');
  const MOLECULES = [
    { slug: "glua2-5weo", chip: ZH ? "AMPA 受体" : "AMPA receptor",
      cap: ZH ? "受体，逐个原子" : "The receptor, atom by atom",
      what: ZH ? "AMPA 型谷氨酸受体，结合了谷氨酸（奶白色小球）。正是它把上面那样的突触释放的谷氨酸变成树突里的电信号：谷氨酸一结合，通道打开，几毫秒内电流流入。这个结构在通道打开的状态下被捕获，是大鼠 GluA2 与小鼠 stargazin（它的辅助亚基）的融合蛋白。四条链，四种颜色。"
              : "The AMPA-type glutamate receptor with glutamate bound (the cream spheres). This is the protein that turns the glutamate released at a synapse like the one above into an electrical signal in the dendrite: glutamate binds, the channel opens, and current flows within a millisecond. The structure was caught with the channel open; it is rat GluA2 fused to mouse stargazin, its auxiliary subunit. Four chains, four colours.",
      scale: ZH ? "约 19 纳米高；一个突触里有几十个。" : "About 19 nanometres tall; a synapse holds dozens." },
    { slug: "nmda-4pe5", chip: ZH ? "NMDA 受体" : "NMDA receptor",
      cap: ZH ? "NMDA 受体，逐个原子" : "The NMDA receptor, atom by atom",
      what: ZH ? "同一个突触上的另一种谷氨酸受体。它要同时结合谷氨酸和甘氨酸（两种都画成奶白色小球），而且只有在树突已经去极化时才打开：突触正是靠它察觉“两边同时活动”，并据此变强。这就是学习在分子层面的开关。结构来自大鼠 GluN1（蓝）与 GluN2B（橙）。"
              : "The other glutamate receptor at the same synapse. It needs glutamate and glycine bound together (both drawn as cream spheres) and opens only when the dendrite is already depolarised: this is how a synapse notices that both sides were active at once, and strengthens. At the level of molecules, it is the switch that learning turns. Rat GluN1 (blue) with GluN2B (orange).",
      scale: ZH ? "约 16 纳米高。" : "About 16 nanometres tall." },
    { slug: "snare-1sfc", chip: ZH ? "SNARE 复合体" : "SNARE complex",
      cap: ZH ? "把囊泡拉向膜的机器" : "The machine that fuses the vesicle",
      what: ZH ? "轴突末梢一侧。囊泡上的 synaptobrevin（蓝）与膜上的 syntaxin（橙）和 SNAP-25（粉，两条螺旋）拧成一束四螺旋，把装满谷氨酸的囊泡拉到膜上并与之融合，谷氨酸由此被释放到突触间隙。这是第一个被解出的 SNARE 结构，来自大鼠。"
              : "The axon terminal's side. Synaptobrevin from the vesicle (blue) twists together with syntaxin (orange) and SNAP-25 (pink, two helices) from the terminal's membrane into a four-helix bundle that pulls a glutamate-filled vesicle onto the membrane and fuses it, which is how the glutamate reaches the cleft. The first SNARE structure ever solved, from rat.",
      scale: ZH ? "约 10 纳米长。" : "About 10 nanometres long." },
    { slug: "nlgn-nrxn-3biw", chip: ZH ? "神经连接蛋白" : "Neuroligin, neurexin",
      cap: ZH ? "把两侧扣在一起的分子" : "The pair that holds the two sides",
      what: ZH ? "跨过突触间隙的握手。树突一侧的 neuroligin-1（蓝，一对）与轴突一侧的 neurexin-1β（橙，两个）相互结合，把突触的两侧扣在一起，并帮助决定它是哪一种突触。两种蛋白的基因变异都与自闭症谱系相关。结构来自大鼠。"
              : "The handshake across the cleft. Neuroligin-1 from the dendrite's side (blue, a pair) binds neurexin-1β from the axon's side (orange, two of them), holding the two halves of the synapse together and helping decide what kind of synapse it becomes. Variants in both genes are linked to autism. From rat.",
      scale: ZH ? "约 13 纳米宽。" : "About 13 nanometres across." },
  ];
  const molCache = {};
  /* the PDB's entity names, readable: "PROTEIN (SYNTAXIN 1A)" becomes
     "Syntaxin 1A", the NMDA subunits their short names, "-beta" the letter */
  function prettyName(d) {
    let n = String(d || "").replace(/^PROTEIN \((.*)\)$/i, "$1").replace(/Glutamate receptor ionotropic, NMDA (\w+)/, "GluN$1").replace(/-beta/i, "β");
    if (n === n.toUpperCase()) n = n.split(" ").map((w) => /\d/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
    return n;
  }
  function moleculeCopy(mol, rec) {
    const cite = rec.citation || {}; const first = (cite.authors && cite.authors[0]) ? cite.authors[0].split(",")[0] : "";
    const ref = `${first ? first + (ZH ? " 等" : " et al.") + ", " : ""}${cite.journal || ""} ${(rec.citationFull || {}).volume || ""}, ${(rec.citationFull || {}).page || ""} (${cite.year || ""})`;
    const method = rec.method === "EM" ? (ZH ? "冷冻电镜" : "cryo-EM") : rec.method === "X-ray" ? (ZH ? "X 射线晶体学" : "X-ray crystallography") : rec.method;
    const res = rec.resolution_A && rec.resolution_A[0] ? `${rec.resolution_A[0]} Å` : "";
    const orgs = [...new Set(rec.polymers.flatMap((p) => p.organisms || []))].map((o) => ({ "Rattus norvegicus": ZH ? "大鼠" : "rat", "Mus musculus": ZH ? "小鼠" : "mouse" }[o] || o)).join(ZH ? "、" : " and ");
    const legend = rec.colouredBy === "entity"
      ? `<span class="mleg">${[...new Map(rec.polymers.filter((p) => p.chains && p.chains.length).map((p) => [p.colour, p])).values()].map((p) => `<span><s style="background:${p.colour}"></s>${prettyName(p.description)}</span>`).join("")}</span>`
      : "";
    return {
      note: `${legend}<span>${ZH ? `PDB ${rec.pdb}：${method}${res ? "，" + res : ""}，${orgs}。${ref}。${fmt(rec.atoms)} 个原子${rec.ligand.atoms ? `，${rec.ligand.residues.map((r) => `${rec.ligand.counts[r] / (r === "GLY" ? 5 : 10) | 0} 个${{ GLU: "谷氨酸", GLY: "甘氨酸" }[r] || r}`).join("、")}` : ""}。拖动转动，滚轮缩放。` : `PDB ${rec.pdb}: ${method}${res ? " at " + res : ""}, ${orgs}. ${ref}. ${fmt(rec.atoms)} atoms${rec.ligand.atoms ? `, ${rec.ligand.residues.map((r) => `${rec.ligand.counts[r] / (r === "GLY" ? 5 : 10) | 0} ${{ GLU: "glutamate", GLY: "glycine" }[r] || r}${rec.ligand.counts[r] / (r === "GLY" ? 5 : 10) > 1 ? "s" : ""}`).join(", ")}` : ""}. Drag to turn, scroll to zoom.`}</span>`,
      copy: ZH ? `<p>${mol.what} ${mol.scale}</p><p>结构来自 PDB 条目 ${rec.pdb}（${method}，${res}；${ref}），按沉积的原子坐标画出：表面是原子的溶剂可及表面，用 MolecularNodes 经 Animation Lab 的 ProteinBlender 生成；小球在它们实测的位置上。它没有被放进电镜突触里：那个突触里这些分子的位置并没有被测量。</p>`
               : `<p>${mol.what} ${mol.scale}</p><p>The structure is PDB entry ${rec.pdb} (${method} at ${res}; ${ref}), drawn from its deposited atomic coordinates: the surface is the solvent-accessible surface of the atoms, built with MolecularNodes through the Animation Lab's ProteinBlender; the spheres sit at their measured positions. It is not placed inside the EM synapse: where these molecules sit in that particular synapse was not measured.</p>`,
    };
  }
  let molView = null;
  function moleculeView() {
    if (molView) return molView;
    const mountC = bubbleEl.querySelector("[data-bmount-c]");
    const sc = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 400);
    const rd = makeRenderer(mountC); fitRenderer(rd, cam, mountC);
    sc.add(new THREE.AmbientLight(0xffffff, 0.5));
    const k1 = new THREE.DirectionalLight(0xffffff, 1.1); k1.position.set(2, 3, 2); sc.add(k1);
    const k2 = new THREE.DirectionalLight(0x9fd0ff, 0.45); k2.position.set(-2, -1, -2); sc.add(k2);
    const piv = new THREE.Group(); sc.add(piv);
    const v = { sc, cam, rd, piv, dist: 30, bdrag: false, bx: 0, bvel: 0 };
    const cv = rd.domElement; cv.style.cursor = "grab";
    cv.addEventListener("pointerdown", (ev) => { v.bdrag = true; v.bx = ev.clientX; v.bvel = 0; try { cv.setPointerCapture(ev.pointerId); } catch (e) {} });
    cv.addEventListener("pointermove", (ev) => { if (!v.bdrag) return; const dx = ev.clientX - v.bx; piv.rotation.y += dx * 0.01; v.bvel = dx * 0.3; v.bx = ev.clientX; });
    cv.addEventListener("pointerup", () => { v.bdrag = false; });
    cv.addEventListener("wheel", (ev) => { ev.preventDefault(); cam.position.multiplyScalar(Math.exp(ev.deltaY * 0.001)); const l = cam.position.length(); if (l < v.dist * 0.25) cam.position.setLength(v.dist * 0.25); if (l > v.dist * 3) cam.position.setLength(v.dist * 3); }, { passive: false });
    new ResizeObserver(() => fitRenderer(rd, cam, mountC)).observe(mountC);
    molView = v; return v;
  }
  async function loadMolecule(slug) {
    if (molCache[slug]) return molCache[slug];
    const rec = await (await fetch(R(`data/molecules/${slug}.json`))).json();
    const ld = new GLTFLoader();
    const load = (url) => new Promise((res, rej) => ld.load(R(url), (g) => res(g.scene), undefined, rej));
    const [surfS, ligS] = await Promise.all([load(rec.files.surface), rec.files.ligand ? load(rec.files.ligand) : Promise.resolve(null)]);
    const inner = new THREE.Group(); inner.scale.setScalar(10);   /* GLB units are 10 nm */
    const matS = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.04 });
    surfS.traverse((o) => { if (o.isMesh) { fixNormals(o.geometry); o.material = matS; inner.add(o.clone()); } });
    if (ligS) { const matL = new THREE.MeshStandardMaterial({ color: new THREE.Color(PARTS.soma.color), emissive: new THREE.Color(PARTS.soma.color), emissiveIntensity: 0.35, roughness: 0.4 }); ligS.traverse((o) => { if (o.isMesh) { o.material = matL; inner.add(o.clone()); } }); }
    /* centred on its own bounding box, the long axis standing up */
    const holder = new THREE.Group(); holder.add(inner);
    const box = new THREE.Box3().setFromObject(inner); const c = new THREE.Vector3(); box.getCenter(c); inner.position.sub(c);
    const size = new THREE.Vector3(); box.getSize(size);
    if (size.z > size.y && size.z > size.x) holder.rotation.x = -Math.PI / 2;
    else if (size.x > size.y && size.x > size.z) holder.rotation.z = Math.PI / 2;
    const dist = Math.max(size.x, size.y, size.z) * 1.55;
    molCache[slug] = { rec, holder, dist }; return molCache[slug];
  }
  async function showMolecule(slug) {
    moleculeSlug = slug;
    const mol = MOLECULES.find((x) => x.slug === slug) || MOLECULES[0];
    const chips = bubbleEl.querySelector("[data-mchips]");
    if (chips) chips.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mol === slug)));
    const cap = bubbleEl.querySelector("[data-ccap]"); if (cap) cap.textContent = mol.cap;
    const note = bubbleEl.querySelector("[data-cnote]"); if (note) note.innerHTML = `<span>${ZH ? "读取中…" : "Loading…"}</span>`;
    const v = moleculeView();
    let m; try { m = await loadMolecule(slug); } catch (e) { if (note) note.textContent = (ZH ? "这个分子没有加载。" : "The molecule did not load. ") + e.message; return; }
    if (moleculeSlug !== slug) return;
    v.piv.clear(); v.piv.add(m.holder); v.dist = m.dist;
    const dir = new THREE.Vector3(0.7, 0.35, 1).normalize();
    v.cam.position.copy(dir).multiplyScalar(m.dist); v.cam.lookAt(0, 0, 0);
    const text = moleculeCopy(mol, m.rec);
    if (note) note.innerHTML = text.note;
    const copy = el.querySelector("[data-mcopy]"); if (copy) copy.innerHTML = text.copy;
    molecule = {
      on: true,
      frame(dt) {
        if (!v.bdrag) { v.piv.rotation.y += v.bvel * dt + (REDUCED ? 0 : dt * 0.18); v.bvel *= Math.pow(0.002, dt); }
        v.rd.render(v.sc, v.cam);
        const leaders = el.querySelector("[data-leaders]");
        if (!leaders || stage !== "receptor" || frameC.hidden) return;
        const vw = el.querySelector(".view") || mount; const vr = vw.getBoundingClientRect();
        const fb = bubbleEl.querySelector('[data-frame="b"] .fm').getBoundingClientRect();
        const fc = frameC.querySelector(".fm").getBoundingClientRect();
        const x0 = fb.left - vr.left + fb.width * 0.5, y0 = fb.top - vr.top + fb.height * 0.5;
        const x1 = fc.left - vr.left, y1 = fc.top - vr.top + 14;
        leaders.innerHTML += `<circle cx="${x0.toFixed(1)}" cy="${y0.toFixed(1)}" r="3"/><path d="M${x0.toFixed(1)},${y0.toFixed(1)} L${x0.toFixed(1)},${(fb.bottom - vr.top + 7).toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)}"/>`;
      },
    };
  }
  { const chips = bubbleEl && bubbleEl.querySelector("[data-mchips]");
    if (chips) { chips.innerHTML = MOLECULES.map((x) => `<button type="button" role="tab" data-mol="${x.slug}" aria-selected="${x.slug === moleculeSlug}">${x.chip}</button>`).join("");
      chips.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { showMolecule(b.dataset.mol); const u = new URL(location.href); u.searchParams.set("mol", b.dataset.mol); history.replaceState(null, "", u); })); } }
  function setStage(st) {
    stage = st;
    el.querySelectorAll("[data-stage]").forEach((b) => b.setAttribute("aria-selected", b.dataset.stage === st ? "true" : "false"));
    el.querySelectorAll("[data-stagecopy]").forEach((n) => { n.hidden = n.dataset.stagecopy !== st; });
    if (st === "whole") { zHome = zWhole; setFocus(null); focusLocked = false; }
    else { zHome = Math.max(1.4, Math.min(3.2, 0.9 + 0.35 * (rec.dend_mm || 4))); setFocus("dendrite"); focusLocked = true; }
    { const lm = el.querySelector("[data-mk]"), ld = el.querySelector("[data-leaders]");
      if (lm) lm.hidden = !(st === "synapse" || st === "receptor"); if (ld) ld.innerHTML = ""; }
    if (bubbleEl) {
      const deep = st === "synapse" || st === "receptor";
      bubbleEl.hidden = !deep;
      bubbleEl.classList.toggle("receptor", st === "receptor");
      if (frameC) frameC.hidden = st !== "receptor";
      if (st === "receptor" && !molecule) {
        molecule = { on: false, frame() {} };
        const want = new URLSearchParams(location.search).get("mol");
        showMolecule(MOLECULES.some((x) => x.slug === want) ? want : moleculeSlug);
      }
      if (deep && !bubble) {
        bubble = { on: false, frame() {} };
        makeBubble().then((b) => { bubble = b; }).catch((e) => { const st2 = bubbleEl.querySelector("[data-bstatus]"); if (st2) st2.textContent = "The synapse did not load. " + e.message; });
      }
    }
    const url = new URL(location.href); if (st === "whole") url.searchParams.delete("stage"); else url.searchParams.set("stage", st); history.replaceState(null, "", url);
  }
  el.querySelectorAll("[data-stage]").forEach((b) => b.addEventListener("click", () => setStage(b.dataset.stage)));
  const turnBtn = q("[data-turn]");
  if (turnBtn) turnBtn.addEventListener("click", () => { turning = !turning; turnBtn.textContent = turning ? (ZH ? "暂停旋转" : "Pause turning") : (ZH ? "继续旋转" : "Resume turning"); });

  /* ---- the signal ------------------------------------------------------- */
  let signalT = -1;
  const fire = q("[data-fire]");
  if (fire) fire.addEventListener("click", () => { signalT = 0; mat.uniforms.uHead.value = 1; });
  const shellT = q("[data-t-shell]");
  if (shellT) shellT.addEventListener("change", () => { shellG.visible = shellT.checked; });
  const divT = q("[data-t-divisions]");
  if (divT) divT.addEventListener("change", () => { divG.visible = divT.checked; if (divT.checked) loadDivisions(); });
  const tgT = q("[data-t-targets]");
  if (tgT) { tgT.addEventListener("change", () => { targetG.visible = tgT.checked; if (tgT.checked) loadTargets(); }); if (tgT.checked) { targetG.visible = true; loadTargets(); } }

  /* ---- the card --------------------------------------------------------- */
  const card = q("[data-card]");
  if (card) {
    const T = ZH ? {
      body: `胞体位于 <b>${rec.region_name || rec.region}</b>（${rec.region}），${rec.major}。轴突总长 <b>${fmt(rec.axon_mm, 1)} mm</b>，离胞体最远 <b>${fmt(rec.reach_mm, 1)} mm</b>，末梢 <b>${fmt(rec.tips)}</b> 个。树突 <b>${fmt(rec.dend_mm, 1)} mm</b>。`,
      src: `MouseLight ${rec.id}，Janelia。`,
    } : {
      body: `Cell body in <b>${rec.region_name || rec.region}</b> (${rec.region}), ${(rec.major || "").toLowerCase()}. Axon <b>${fmt(rec.axon_mm, 1)} mm</b> of cable, reaching <b>${fmt(rec.reach_mm, 1)} mm</b> from the cell body, <b>${fmt(rec.tips)}</b> terminals. Dendrites <b>${fmt(rec.dend_mm, 1)} mm</b>.`,
      src: `MouseLight ${rec.id}, Janelia.`,
    };
    card.innerHTML = `<p>${T.body}</p><p class="side">${T.src} <a href="../?n=${rec.id}">${ZH ? "在整个脑中看它" : "See it in the whole brain"}</a></p>`;
  }
  const others = q("[data-others]");
  if (others) others.innerHTML = feat.neurons.map((n) =>
    `<a href="?n=${n.id}${ZH ? "&lang=zh" : ""}" ${n.id === rec.id ? 'aria-current="true"' : ""}>${n.region}</a>`).join("");

  /* ---- loop --------------------------------------------------------------- */
  const loop = makeLoop(el, (dt) => {
    if (!dragging) { pivot.rotation.y += vel * dt; vel *= Math.pow(0.002, dt); if (!REDUCED && turning) pivot.rotation.y += dt * 0.05; }
    const kz = 1 - Math.pow(0.08, dt);
    zoomNow += (zoomUser - zoomNow) * kz;
    zNow += (zHome - zNow) * kz;
    const back = Math.max(1, 1.4 / camera.aspect) * zoomNow;
    camera.position.set(0, zNow * 0.12 * back, zNow * back); camera.lookAt(0, 0, 0);
    if (bubble && bubble.on) bubble.frame(dt);
    if (molecule && molecule.on && stage === "receptor") molecule.frame(dt);
    placeTargetLabels();
    if (signalT >= 0) {
      signalT += dt; mat.uniforms.uGrow.value = signalT * SPEED;
      if (signalT * SPEED > maxD + 1.5) { signalT = -1; mat.uniforms.uGrow.value = 1e6; mat.uniforms.uHead.value = 0; }
    }
    composer.render();
    placeLabels();
  });
  new ResizeObserver(fitAll).observe(mount);
  loop.run();
  const st0 = new URLSearchParams(location.search).get("stage");
  if (st0 === "closeup" || st0 === "synapse" || st0 === "receptor") setStage(st0); else setStage("whole");
  if (status) status.textContent = ZH ? `${rec.id}，${rec.region_name || rec.region}` : `${rec.id}, ${rec.region_name || rec.region}`;
  return { scene, camera, renderer, loop, rec, setFocus, pivot, fire: () => { signalT = 0; mat.uniforms.uHead.value = 1; } };
}
