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
  const card = el.querySelector("[data-card]");
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
  function fitAll() {
    if (!fitRenderer(renderer, camera, mount)) return;
    const w = mount.clientWidth, h = mount.clientHeight;
    composer.setSize(w, h); bloom.setSize(w, h);
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
  function loadGlb(url) {
    return new Promise((res, rej) => loader.load(R(url), (g) => {
      let m = null; g.scene.traverse((o) => { if (o.isMesh && !m) m = o; }); res(m);
    }, undefined, rej));
  }

  const REGION_A = 0.06, REGION_A_LIT = 0.022, SHELL_A = 0.07, SHELL_A_LIT = 0.04;
  /* the surface slider scales every shell and division tint, 0 to 2x */
  let surfaceGain = 1, divisionGain = 1;
  let shellSolid = null;
  /* the shell: front faces only, no depth write, so the neurons inside show */
  const shellMesh = await loadGlb("meshes/root.glb");
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
    const CAT = { excitatory: "#6fd0ff", inhibitory: "#ff5cc0", glia: "#3fe3b0",
                  "pyramidal cell": "#ffd23f", "mossy fibre": "#3fe3b0" };
    /* one synapse bin for the whole pack (CA3: the featured cell's), read
       once and drawn with the featured cell; flag 2 marks autapses, drawn
       dimmer */
    async function dots(file, colourIn, colourAuto) {
      const buf = await (await fetch(R(file))).arrayBuffer();
      const n = Math.floor(buf.byteLength / 7);
      const q = new Int16Array(buf, 0, n * 3), fl = new Uint8Array(buf, n * 6, n);
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
      const col = new THREE.Color(cell.colour || (cell.featured ? "#fff1c0" : null) || CAT[cell.category] || cu.colour);
      m.material = new THREE.MeshStandardMaterial({ color: col, roughness: 0.65, metalness: 0.05, emissive: col, emissiveIntensity: cell.featured ? 0.1 : 0.06,
        transparent: !!(featuredSlug && cell.role === "pyramidal cell" && !cell.featured), opacity: (featuredSlug && cell.role === "pyramidal cell" && !cell.featured) ? 0.35 : 1 });
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
          const n = Math.floor(buf.byteLength / 7);
          const q = new Int16Array(buf, 0, n * 3), fl = new Uint8Array(buf, n * 6, n);
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
    renderCubeCard(cu, pk);
    if (h1 && cu.population) h1.textContent = ZH ? `${cu.name}：${fmt(pk.cells.length)} / ${fmt(cu.population.n)} ${cu.population.what}` : `${fmt(pk.cells.length)} of ${fmt(cu.population.n)} cells in ${cu.name}`;
    status.textContent = (ZH ? `${cu.name}：${fmt(pk.cells.length)} 个细胞，${fmt(pk.synCount)} 个真实突触。滚轮靠近或拉远到整个脑。` : `${cu.name}: ${fmt(pk.cells.length)} reconstructed cells, ${fmt(pk.synCount)} real synapses as white dots. Scroll in to come closer, out to see it in the whole brain.`);
  }
  function leaveCube() {
    inside = null; packG.clear(); syncStatus(); if (h1) h1.textContent = h1Home;
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
  const meta = await (await fetch(R("data/neurons.json"))).json();
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
    shardWhole[file] = await r.arrayBuffer();
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
  async function ensureCoarse(src) {
    if (coarseBuf[src]) return coarseBuf[src];
    const files = meta.coarse_files || ["axons-coarse.bin"];
    const file = files.find((f) => f.replace(/^axons-coarse-?/, "").replace(/\.bin$/, "") === src) || files[0];
    status.textContent = T.readingAll + (T.sources[src] || src || "all") + "…";
    const buf = await (await fetch(R("data/" + file))).arrayBuffer();
    /* block offsets per record, so a subset can be read without a full pass */
    let off = 0;
    for (const r of (bySrc[src] || N)) { r._coff = off; off += r.cbytes || 0; }
    coarseBuf[src] = buf;
    return buf;
  }
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
  const hairAlpha = (segs) => Math.min(0.2, 0.11 / Math.sqrt(Math.max(segs, 1) / 1000));

  const divColour = {}; const colourOfDivision = (r) => divColour[r.major] || (divColour[r.major] = new THREE.Color(DIVISION[r.major] || "#9aa2b1"));
  async function loadAllAxons() {
    if (axonsLoaded) return; axonsLoaded = true;
    let drawn = 0, segsAll = 0; const meshes = [];
    for (const src of Object.keys(bySrc)) {
      let buf; try { buf = await ensureCoarse(src); } catch (e) { continue; }
      const { mesh, segs, drawn: d } = axonMesh(bySrc[src], buf, colourOfDivision);
      meshes.push(mesh); axonG.add(mesh); segsAll += segs; drawn += d;
      for (const mm of meshes) mm.material.opacity = hairAlpha(segsAll);
      status.textContent = `${fmt(drawn)} / ${fmt(N.length)}${T.drawn}, ${fmt(segsAll)}${T.segs}…`;
    }
    axonG.userData.segments = segsAll;
    status.textContent = T.allDone(fmt(drawn), fmt(segsAll));
  }

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
      (await fetch(R("data/cells.json"))).json(), (await fetch(R("data/cells.bin"))).arrayBuffer()]);
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
      `<h3><s style="background:${col}"></s>${rec.id}</h3>` +
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
    mode = m;
    el.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-selected", b.dataset.mode === m ? "true" : "false"));
    matchG.visible = (m === "match");
    /* the lit neuron's region tags belong to the single-neuron views */
    targetG.visible = m !== "all";
    if (rlabels) rlabels.hidden = (m === "all");
    if (m !== "match" && current) showTargets(current.rec); else if (m !== "match") clearTargets();
    if (m === "all") { loadAllAxons(); axonG.visible = true; focusG.visible = false; trailG.visible = false; somaG.visible = false; }
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
  el.querySelectorAll("[data-cube]").forEach((b) => b.addEventListener("click", () => {
    const cu = CUBES.find((c) => c.id === b.dataset.cube); if (!cu) return;
    if (!micronsG.visible) { micronsG.visible = true; const t = q("[data-t-microns]"); if (t) t.checked = true; }
    const go = () => { if (cu.centre) dive(cu); else setTimeout(go, 300); }; go(); writeUrl();
  }));
  const onToggle = (sel, fn) => { const t = q(sel); if (t) t.addEventListener("change", () => { fn(t.checked); writeUrl(); }); return t; };
  onToggle("[data-t-regions]", (on) => { regionG.visible = on; });
  onToggle("[data-t-shell]", (on) => { shellG.visible = on; });
  onToggle("[data-t-cells]", (on) => { cellG.visible = on; if (on) loadCells(); });
  onToggle("[data-t-microns]", (on) => { micronsG.visible = on; });
  const turnBox = onToggle("[data-t-turn]", (on) => { idleTurn = on; syncPause(); });
  /* fullscreen takes the picture with its tags and status; the controls stay
     on the page behind it, and Esc brings it back */
  const viewEl = el.querySelector(".view") || mount;
  const fsBtn = q("[data-fullscreen]");
  const goFull = () => { if (document.fullscreenElement) document.exitFullscreen(); else if (viewEl.requestFullscreen) viewEl.requestFullscreen(); };
  if (fsBtn) fsBtn.addEventListener("click", goFull);
  const fsIcon = q("[data-fullscreen-icon]"); if (fsIcon) fsIcon.addEventListener("click", goFull);
  document.addEventListener("fullscreenchange", () => { fitAll(); if (fsBtn) fsBtn.textContent = document.fullscreenElement ? (ZH ? "退出全屏" : "Exit fullscreen") : (ZH ? "全屏" : "Fullscreen"); });
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
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: line1 }); return; } catch (e) {} }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
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
  function syncPause() { if (pauseBtn) pauseBtn.textContent = idleTurn ? (ZH ? "暂停旋转" : "Pause turning") : (ZH ? "继续旋转" : "Resume turning"); }
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
    const lit = !!current || !!inside || mode === "all" || mode === "match";
    for (const m of regionMats) m.opacity += ((lit ? REGION_A_LIT : REGION_A) * divisionGain - m.opacity) * k;
    if (shellSolid) shellSolid.opacity += ((lit ? SHELL_A_LIT : SHELL_A) * surfaceGain - shellSolid.opacity) * k;
    if (holoMat) { holoMat.userData.tick(holoMat, performance.now() / 1000); holoMat.uniforms.uOpacity.value = holoMat.userData.gain * surfaceGain * (lit ? 0.6 : 1); }
    bloom.strength += ((inside ? 0.1 : mode === "all" ? 0.12 : mode === "match" ? 0.05 : 0.3) - bloom.strength) * k;
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
    placeRegionLabels();
  });
  new ResizeObserver(fitAll).observe(mount);
  loop.run();

  /* a shared link lands on its view: neuron, mode, camera, sliders, filters */
  const view = readView();
  if (new URLSearchParams(location.search).get("holo")) applyLook(new URLSearchParams(location.search).get("holo"));
  const wantRec = view.n && N.find((r) => r.id === view.n);
  if (fr && fr.value) syncSomata();
  const wantCube = new URLSearchParams(location.search).get("cube");
  if (wantCube) { const cu = CUBES.find((c) => c.id === wantCube); if (cu) { setMode("pick"); const go = () => { if (cu.centre) dive(cu); else setTimeout(go, 300); }; go(); } }
  else if (view.mode === "match") { keepIsolated = !!isolated; setMode("match"); if (wantRec) focusOn(wantRec, true); }
  else if (view.mode === "all") { setMode("all"); }
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
