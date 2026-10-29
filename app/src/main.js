import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildKidney, PALETTE, FADED_COLOR, FADED_OPACITY, ACCENT_COLOR, ACCENT_EMISSIVE } from "./kidney.js";
import { STRUCTURES, INTRO } from "./content.js";

const PAPER_COLOR = 0xf2e8d5;

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.localClippingEnabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAPER_COLOR);
scene.fog = new THREE.Fog(PAPER_COLOR, 7, 14);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(3.1, 1.1, 4.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 2.6;
controls.maxDistance = 8;
controls.target.set(0, 0, 0);

// --- Lighting: soft, warm, atlas-page feel ---
const hemi = new THREE.HemisphereLight(0xfff6e4, 0x7a6a4e, 0.9);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xfff1dc, 1.05);
key.position.set(4, 5, 3);
scene.add(key);

const fill = new THREE.DirectionalLight(0xd9c9ff, 0.25);
fill.position.set(-4, -2, -3);
scene.add(fill);

// --- Kidney model ---
const { root, parts, setCrossSection } = buildKidney();
scene.add(root);

let selectedKey = null;
let crossSection = false;

function applyHighlight() {
  Object.entries(parts).forEach(([key, part]) => {
    const base = PALETTE[key];
    part.materials.forEach((mat) => {
      if (selectedKey === key) {
        mat.color.setHex(ACCENT_COLOR);
        mat.emissive.setHex(ACCENT_EMISSIVE);
        mat.emissiveIntensity = 0.35;
        mat.opacity = base.selectedOpacity ?? 0.95;
      } else if (selectedKey) {
        mat.color.setHex(FADED_COLOR);
        mat.emissive.setHex(0x000000);
        mat.opacity = Math.min(base.opacity, FADED_OPACITY);
      } else {
        mat.color.setHex(base.color);
        mat.emissive.setHex(0x000000);
        mat.opacity = base.opacity;
      }
    });
  });
}

// --- UI: structure list ---
const listEl = document.getElementById("structure-items");
const titleEl = document.getElementById("desc-title");
const bodyEl = document.getElementById("desc-body");

STRUCTURES.forEach((s) => {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.className = "struct-btn";
  btn.dataset.key = s.key;
  btn.innerHTML = `<span class="dot"></span><span>${s.label}</span>`;
  btn.addEventListener("click", () => selectStructure(s.key));
  li.appendChild(btn);
  listEl.appendChild(li);
});

function selectStructure(key) {
  selectedKey = selectedKey === key ? null : key;
  applyHighlight();

  document.querySelectorAll(".struct-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.key === selectedKey);
  });

  if (selectedKey) {
    const s = STRUCTURES.find((item) => item.key === selectedKey);
    titleEl.textContent = s.label.replace(/&amp;/g, "&");
    bodyEl.textContent = s.desc;
  } else {
    titleEl.textContent = INTRO.title;
    bodyEl.textContent = INTRO.body;
  }
}

// --- UI: view toggle ---
const btnWhole = document.getElementById("btn-whole");
const btnCross = document.getElementById("btn-cross");

function setView(isCross) {
  crossSection = isCross;
  setCrossSection(crossSection);
  btnWhole.classList.toggle("is-active", !crossSection);
  btnCross.classList.toggle("is-active", crossSection);
}
btnWhole.addEventListener("click", () => setView(false));
btnCross.addEventListener("click", () => setView(true));

// --- Raycaster: click directly on the model ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDownPos = null;

canvas.addEventListener("pointerdown", (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener("pointerup", (e) => {
  if (!pointerDownPos) return;
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  if (Math.hypot(dx, dy) > 6) return; // was a drag, not a click

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(root.children, true);
  const hit = hits.find((h) => h.object.userData.key && h.object.visible);
  if (hit) selectStructure(hit.object.userData.key);
});

// --- Resize ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Animate ---
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

applyHighlight();
