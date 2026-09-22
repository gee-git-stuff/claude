import * as THREE from "three";

/** Deterministic pseudo-random generator so the scattered trees/mountains
 * look the same on every load instead of reshuffling on every render. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function terrainHeight(x: number, z: number): number {
  return (
    Math.sin(x * 0.05) * 1.4 +
    Math.sin(z * 0.07 + 1) * 1.1 +
    Math.sin((x + z) * 0.03) * 0.7
  );
}

export function buildGround(color: THREE.ColorRepresentation): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(500, 500, 60, 60);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "ground";
  return mesh;
}

/** A wide, distant ridge used twice (far + mid) for parallax depth. Being a
 * near-vertical wavy plane rather than true 3D peaks keeps it cheap while
 * still reading as mountains once fog handles the atmospheric fade. */
export function buildRidge(opts: {
  color: THREE.ColorRepresentation;
  z: number;
  amplitude: number;
  seed: number;
}): THREE.Mesh {
  const { color, z, amplitude, seed } = opts;
  const width = 700;
  const height = 46;
  const geo = new THREE.PlaneGeometry(width, height, 48, 1);
  const rand = mulberry32(seed);
  const phases = [rand() * 10, rand() * 10, rand() * 10];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const yBase = pos.getY(i);
    // Ramp the noise from ~0 at the bottom edge (so it reads as sitting on
    // the ground rather than floating) up to full amplitude at the top.
    const t = THREE.MathUtils.clamp((yBase + height / 2) / height, 0, 1);
    const noiseFactor = t * t;
    const tx = x * 0.01;
    const ridge =
      Math.sin(tx * 1.3 + phases[0]) * 0.5 +
      Math.sin(tx * 2.7 + phases[1]) * 0.3 +
      Math.sin(tx * 5.1 + phases[2]) * 0.2;
    pos.setY(i, yBase + ridge * amplitude * noiseFactor);
  }
  // Unlit on purpose: a distant ridge modeled as a single flat plane has
  // one uniform normal, so realistic directional lighting makes it flip
  // between fully lit and near-black depending on the sun's angle to that
  // one normal. Real distant mountains read as flat, evenly hazy silhouettes
  // anyway -- atmospheric scattering does that for us -- so unlit + fog is
  // the correct look, not a shortcut.
  const mat = new THREE.MeshBasicMaterial({ color, fog: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, height * 0.15, z);
  mesh.name = "ridge";
  return mesh;
}

export function buildTree(foliageColor: THREE.ColorRepresentation): THREE.Group {
  const group = new THREE.Group();
  // A modest emissive fill: a cone's side normals point mostly sideways,
  // so under directional-only lighting the faces angled away from the sun
  // crush to near-black (fine for a distant flat ridge, ugly up close on
  // something you're meant to look at). Real trees never look pitch-black
  // in their own shadow either -- skylight and bounced light fill them in.
  const trunkColor = new THREE.Color(0x6b4423);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: trunkColor,
    roughness: 1,
    emissive: trunkColor.clone().multiplyScalar(0.35),
  });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.5, 6), trunkMat);
  trunk.position.y = 0.75;
  group.add(trunk);

  const foliageColorObj = new THREE.Color(foliageColor);
  const foliageMat = new THREE.MeshStandardMaterial({
    color: foliageColorObj,
    roughness: 1,
    emissive: foliageColorObj.clone().multiplyScalar(0.35),
  });
  for (let i = 0; i < 3; i++) {
    const s = 1 - i * 0.22;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.15 * s, 1.7 * s, 7), foliageMat);
    cone.position.y = 1.7 + i * 0.85 * s;
    group.add(cone);
  }
  return group;
}

export function scatterTrees(scene: THREE.Scene, count: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "trees";
  const rand = mulberry32(7);
  const foliageColors = [0x3d6e30, 0x4c7a3a, 0x5a9448, 0x437a3c];
  for (let i = 0; i < count; i++) {
    const color = foliageColors[i % foliageColors.length];
    const tree = buildTree(color);
    const x = (rand() - 0.5) * 140;
    const z = -12 - rand() * 55;
    const scale = 0.7 + rand() * 0.8;
    tree.position.set(x, terrainHeight(x, z), z);
    tree.scale.setScalar(scale);
    tree.rotation.y = rand() * Math.PI * 2;
    group.add(tree);
  }
  scene.add(group);
  return group;
}

function buildCloudPuff(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x888888,
    roughness: 1,
    transparent: true,
    opacity: 0.92,
    fog: false,
  });
  const lobes: [number, number, number, number][] = [
    [0, 0, 0, 3.2],
    [2.4, -0.4, 0, 2.4],
    [-2.2, -0.2, 0.4, 2.1],
    [0.6, 1.1, -0.3, 2.0],
    [-1.2, 0.9, 0.2, 1.7],
  ];
  for (const [x, y, z, r] of lobes) {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
    sphere.position.set(x, y, z);
    group.add(sphere);
  }
  return group;
}

export function scatterClouds(scene: THREE.Scene, count: number): { group: THREE.Group; puffs: THREE.Group[] } {
  const group = new THREE.Group();
  group.name = "clouds";
  const rand = mulberry32(41);
  const puffs: THREE.Group[] = [];
  for (let i = 0; i < count; i++) {
    const puff = buildCloudPuff();
    const x = (rand() - 0.5) * 160;
    const y = 22 + rand() * 14;
    const z = -60 - rand() * 90;
    const scale = 1.4 + rand() * 2.2;
    puff.position.set(x, y, z);
    puff.scale.setScalar(scale);
    group.add(puff);
    puffs.push(puff);
  }
  scene.add(group);
  return { group, puffs };
}

export function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) m.dispose();
    }
  });
}
