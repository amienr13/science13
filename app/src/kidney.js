import * as THREE from "three";

const INK_LINE = 0x4a3425;

const PALETTE = {
  kapsul: { color: 0xe9ddc2, opacity: 0.1, selectedOpacity: 0.5 },
  korteks: { color: 0xd8c9a3, opacity: 0.95 },
  medula: { color: 0xc5b088, opacity: 0.97 },
  kaliks: { color: 0xcdbb98, opacity: 0.97 },
  pelvis: { color: 0xbfa97f, opacity: 0.97 },
  hilum: { color: 0xb7a583, opacity: 0.6, selectedOpacity: 0.9 },
  arteri: { color: 0xb9a687, opacity: 0.95 },
  vena: { color: 0xb9a687, opacity: 0.95 },
  ureter: { color: 0xc6b495, opacity: 0.97 }
};

const FADED_COLOR = 0xcfc7b4;
const FADED_OPACITY = 0.22;
const ACCENT_COLOR = 0xb5482f;
const ACCENT_EMISSIVE = 0x3a160d;

function makeMaterial(key) {
  const p = PALETTE[key];
  return new THREE.MeshStandardMaterial({
    color: p.color,
    flatShading: true,
    roughness: 0.78,
    metalness: 0.03,
    transparent: true,
    opacity: p.opacity,
    emissive: 0x000000
  });
}

function addEdges(mesh, geometry, opacity = 0.3) {
  const edgeGeo = new THREE.EdgesGeometry(geometry, 25);
  const line = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({ color: INK_LINE, transparent: true, opacity })
  );
  line.raycast = () => {};
  mesh.add(line);
}

function buildBeanGeometry(rx, ry, rz, notchDepth, notchHeightFactor, widthSeg = 12, heightSeg = 9) {
  const geo = new THREE.SphereGeometry(1, widthSeg, heightSeg);
  geo.scale(rx, ry, rz);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.x < 0) {
      const t = Math.max(0, 1 - Math.pow(v.y / (ry * notchHeightFactor), 2));
      const pull = notchDepth * t;
      v.x *= 1 - pull;
      v.z *= 1 - pull * 0.4;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function placeBetween(mesh, basePos, apexPos) {
  const mid = new THREE.Vector3().addVectors(basePos, apexPos).multiplyScalar(0.5);
  const dir = new THREE.Vector3().subVectors(apexPos, basePos).normalize();
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  return mesh;
}

function buildTube(points, radius, radialSegments = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, 24, radius, radialSegments, false);
}

export function buildKidney() {
  const root = new THREE.Group();
  const parts = {};

  const RX = 0.85;
  const RY = 1.5;
  const RZ = 0.42;
  const NOTCH_DEPTH = 0.78;
  const NOTCH_HEIGHT = 0.5;

  // --- Korteks (outer body) ---
  const organGeo = buildBeanGeometry(RX, RY, RZ, NOTCH_DEPTH, NOTCH_HEIGHT);
  const korteksMat = makeMaterial("korteks");
  const korteksMesh = new THREE.Mesh(organGeo, korteksMat);
  addEdges(korteksMesh, organGeo, 0.28);
  korteksMesh.userData.key = "korteks";
  root.add(korteksMesh);
  parts.korteks = { group: korteksMesh, materials: [korteksMat] };

  // --- Kapsul (thin outer membrane, slightly larger) ---
  const kapsulMat = makeMaterial("kapsul");
  kapsulMat.side = THREE.DoubleSide;
  const kapsulMesh = new THREE.Mesh(organGeo, kapsulMat);
  kapsulMesh.scale.setScalar(1.035);
  kapsulMesh.userData.key = "kapsul";
  root.add(kapsulMesh);
  parts.kapsul = { group: kapsulMesh, materials: [kapsulMat] };

  // --- Internal structures group (visible only in cross-section mode) ---
  const internals = new THREE.Group();
  internals.visible = false;
  root.add(internals);

  const pelvisX = -0.12;

  // Medula: pyramids fanning from cortex (base) toward pelvis (apex)
  const pyramidYs = [-1.02, -0.56, 0.0, 0.56, 1.02];
  const medulaMat = makeMaterial("medula");
  const medulaMeshes = [];
  pyramidYs.forEach((y, i) => {
    const h = 0.58;
    const baseR = 0.3;
    const geo = new THREE.ConeGeometry(baseR, h, 6);
    const mesh = new THREE.Mesh(geo, medulaMat);
    const zOff = i % 2 === 0 ? 0.1 : -0.08;
    const basePos = new THREE.Vector3(0.52, y, zOff * 0.6);
    const apexPos = new THREE.Vector3(pelvisX - 0.05, y * 0.85, zOff * 0.2);
    placeBetween(mesh, basePos, apexPos);
    addEdges(mesh, geo, 0.25);
    mesh.userData.key = "medula";
    internals.add(mesh);
    medulaMeshes.push(mesh);

    // Kaliks: small open cup at the apex of each pyramid
    const calyxGeo = new THREE.CylinderGeometry(0.06, 0.2, 0.24, 6, 1, true);
    const calyxMat = makeMaterial("kaliks");
    const calyxMesh = new THREE.Mesh(calyxGeo, calyxMat);
    calyxMesh.material.side = THREE.DoubleSide;
    placeBetween(calyxMesh, apexPos.clone().add(new THREE.Vector3(0.1, 0, 0)), apexPos);
    addEdges(calyxMesh, calyxGeo, 0.25);
    calyxMesh.userData.key = "kaliks";
    internals.add(calyxMesh);
    if (!parts.kaliks) parts.kaliks = { group: new THREE.Group(), materials: [] };
    parts.kaliks.group.add(calyxMesh);
    parts.kaliks.materials.push(calyxMat);
  });
  parts.medula = { group: medulaMeshes, materials: [medulaMat] };

  // Pelvis renalis: lathe funnel narrowing toward ureter
  const profile = [
    new THREE.Vector2(0.0, -1.35),
    new THREE.Vector2(0.1, -1.15),
    new THREE.Vector2(0.3, -0.5),
    new THREE.Vector2(0.36, 0.0),
    new THREE.Vector2(0.28, 0.6),
    new THREE.Vector2(0.08, 1.05),
    new THREE.Vector2(0.0, 1.15)
  ];
  const pelvisGeo = new THREE.LatheGeometry(profile, 8);
  const pelvisMat = makeMaterial("pelvis");
  pelvisMat.side = THREE.DoubleSide;
  const pelvisMesh = new THREE.Mesh(pelvisGeo, pelvisMat);
  pelvisMesh.position.set(pelvisX, 0, 0);
  addEdges(pelvisMesh, pelvisGeo, 0.22);
  pelvisMesh.userData.key = "pelvis";
  internals.add(pelvisMesh);
  parts.pelvis = { group: pelvisMesh, materials: [pelvisMat] };

  // Hilum marker: subtle ring at the medial notch
  const hilumGeo = new THREE.TorusGeometry(0.42, 0.035, 6, 14);
  const hilumMat = makeMaterial("hilum");
  const hilumMesh = new THREE.Mesh(hilumGeo, hilumMat);
  hilumMesh.position.set(-0.52, 0, 0);
  hilumMesh.rotation.y = Math.PI / 2;
  hilumMesh.userData.key = "hilum";
  root.add(hilumMesh);
  parts.hilum = { group: hilumMesh, materials: [hilumMat] };

  // Ureter: tube exiting downward from the pelvis tip through the hilum
  const ureterGeo = buildTube(
    [
      [pelvisX, -1.35, 0],
      [pelvisX - 0.18, -1.7, 0.04],
      [pelvisX - 0.12, -2.05, 0.02],
      [pelvisX - 0.2, -2.45, 0]
    ],
    0.09
  );
  const ureterMat = makeMaterial("ureter");
  const ureterMesh = new THREE.Mesh(ureterGeo, ureterMat);
  ureterMesh.userData.key = "ureter";
  root.add(ureterMesh);
  parts.ureter = { group: ureterMesh, materials: [ureterMat] };

  // Arteri renalis: enters hilum, curves toward pelvis
  const arteriGeo = buildTube(
    [
      [-1.7, 0.18, 0.1],
      [-1.15, 0.14, 0.08],
      [-0.6, 0.08, 0.04],
      [pelvisX - 0.05, 0.0, 0]
    ],
    0.08
  );
  const arteriMat = makeMaterial("arteri");
  const arteriMesh = new THREE.Mesh(arteriGeo, arteriMat);
  arteriMesh.userData.key = "arteri";
  root.add(arteriMesh);
  parts.arteri = { group: arteriMesh, materials: [arteriMat] };

  // Vena renalis: enters hilum, curves toward pelvis (below the artery)
  const venaGeo = buildTube(
    [
      [-1.7, -0.2, -0.1],
      [-1.15, -0.16, -0.08],
      [-0.6, -0.08, -0.04],
      [pelvisX - 0.05, -0.02, 0]
    ],
    0.095
  );
  const venaMat = makeMaterial("vena");
  const venaMesh = new THREE.Mesh(venaGeo, venaMat);
  venaMesh.userData.key = "vena";
  root.add(venaMesh);
  parts.vena = { group: venaMesh, materials: [venaMat] };

  // Cut cap: filled disc simulating the solid cortex face when cross-sectioned
  const capShape = new THREE.Shape();
  const capSegs = 48;
  for (let i = 0; i <= capSegs; i++) {
    const t = (i / capSegs) * Math.PI * 2;
    const vx = Math.cos(t);
    const vy = Math.sin(t);
    let x = vx * RX;
    const y = vy * RY;
    if (x < 0) {
      const tt = Math.max(0, 1 - Math.pow(y / (RY * NOTCH_HEIGHT), 2));
      x *= 1 - NOTCH_DEPTH * tt;
    }
    if (i === 0) capShape.moveTo(x, y);
    else capShape.lineTo(x, y);
  }
  const capGeo = new THREE.ShapeGeometry(capShape, 1);
  const capMat = makeMaterial("korteks");
  capMat.side = THREE.DoubleSide;
  capMat.opacity = 1;
  const capMesh = new THREE.Mesh(capGeo, capMat);
  capMesh.visible = false;
  root.add(capMesh);

  // Clipping plane used to reveal the interior in cross-section mode
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0);

  function setCrossSection(enabled) {
    korteksMat.clippingPlanes = enabled ? [clipPlane] : [];
    korteksMat.side = enabled ? THREE.DoubleSide : THREE.FrontSide;
    kapsulMat.clippingPlanes = enabled ? [clipPlane] : [];
    internals.visible = enabled;
    capMesh.visible = enabled;
    hilumMesh.visible = true;
  }

  root.scale.setScalar(1.15);

  return { root, parts, setCrossSection };
}

export const PART_KEYS = Object.keys(PALETTE);
export { PALETTE, FADED_COLOR, FADED_OPACITY, ACCENT_COLOR, ACCENT_EMISSIVE };
