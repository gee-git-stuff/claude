import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import type { Condition, Period, ScenePalette } from "../types";
import { computeSun } from "../lib/astronomyClient";
import { directionFromAzAlt, azimuthOffsetForPeriod, skyTuningFor, fogDistanceFor } from "../lib/scene3d/sky";
import { buildGround, buildRidge, scatterTrees, scatterClouds, disposeObject3D } from "../lib/scene3d/objects";

export interface ScreenPos {
  x: number;
  y: number;
}

interface Props {
  palette: ScenePalette;
  period: Period;
  condition: Condition;
  lat: number;
  lon: number;
  onObjectPositions?: (positions: { sun: ScreenPos | null; cloud: ScreenPos | null; tree: ScreenPos | null }) => void;
}

const NIGHT_SKY_COLOR = 0x050914;

function project(camera: THREE.Camera, worldPos: THREE.Vector3): ScreenPos | null {
  const p = worldPos.clone().project(camera);
  if (p.z > 1 || p.z < -1) return null;
  if (p.x < -1.15 || p.x > 1.15 || p.y < -1.15 || p.y > 1.15) return null;
  return { x: (p.x * 0.5 + 0.5) * 100, y: (1 - (p.y * 0.5 + 0.5)) * 100 };
}

export default function Scene3D({ palette, period, condition, lat, lon, onObjectPositions }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    sky: Sky;
    sunLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    ambientLight: THREE.AmbientLight;
    ground: THREE.Mesh;
    ridgeFar: THREE.Mesh;
    ridgeMid: THREE.Mesh;
    trees: THREE.Group;
    clouds: THREE.Group;
    primaryCloud: THREE.Object3D | null;
    primaryTree: THREE.Object3D | null;
    raf: number;
    resizeObserver: ResizeObserver;
  } | null>(null);

  // --- one-time scene setup ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 3000);
    camera.position.set(0, 1.7, 6);
    camera.lookAt(0, 1.3, -10);

    const sky = new Sky();
    sky.scale.setScalar(450000);
    scene.add(sky);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(50, 80, 30);
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0xbfd9ff, 0x4c7a3a, 0.6);
    scene.add(hemiLight);

    // A true omnidirectional fill: HemisphereLight alone still leaves
    // surfaces facing away from both the sun and straight up (e.g. the
    // sides of a tree's foliage) quite dark, which reads as ugly black
    // silhouettes rather than shaded volume. This puts a floor under that.
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const ground = buildGround(0x6fae4e);
    scene.add(ground);

    const ridgeFar = buildRidge({ color: 0xaeb9c9, z: -260, amplitude: 9, seed: 3 });
    const ridgeMid = buildRidge({ color: 0x8fae7a, z: -150, amplitude: 6, seed: 11 });
    scene.add(ridgeFar);
    scene.add(ridgeMid);

    const trees = scatterTrees(scene, 16);
    const { group: clouds, puffs: cloudPuffs } = scatterClouds(scene, 4);

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(container);
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
    camera.updateProjectionMatrix();

    let raf = 0;
    const animate = () => {
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    worldRef.current = {
      renderer,
      scene,
      camera,
      sky,
      sunLight,
      hemiLight,
      ambientLight,
      ground,
      ridgeFar,
      ridgeMid,
      trees,
      clouds,
      primaryCloud: cloudPuffs[0] ?? null,
      primaryTree: trees.children[Math.floor(trees.children.length / 2)] ?? null,
      raf,
      resizeObserver,
    };

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      disposeObject3D(scene);
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      worldRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- reactive updates: real sun position, lighting, fog, palette ---
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;

    function update() {
      if (!world) return;
      const now = new Date();
      const sun = computeSun(now, lat, lon);
      // The Preetham sky model (three.js Sky) is only valid for a
      // above-horizon sun -- feed it a negative altitude (astronomical/
      // civil twilight, before isNight kicks in below -4°) and its
      // scattering terms break down to solid black instead of a dim dusk
      // glow. Clamp *only* the direction fed to the sky/light -- isNight
      // and the light-intensity falloff below still use the real altitude.
      const skyAltitude = Math.max(sun.altitude, 0.2);
      const sunDir = directionFromAzAlt(sun.azimuth, skyAltitude, azimuthOffsetForPeriod(period));
      const tuning = skyTuningFor(condition);
      const fogDist = fogDistanceFor(condition);

      const isNight = period === "night" || sun.altitude < -4;

      if (isNight) {
        world.sky.visible = false;
        world.scene.background = new THREE.Color(NIGHT_SKY_COLOR);
        world.sunLight.intensity = 0.05;
        world.hemiLight.intensity = 0.18;
        world.hemiLight.color.set(0x3a4a7a);
        world.hemiLight.groundColor.set(0x0a0a10);
        world.ambientLight.intensity = 0.1;
        world.renderer.toneMappingExposure = 0.7;
      } else {
        world.sky.visible = true;
        const u = world.sky.material.uniforms;
        u.turbidity.value = tuning.turbidity;
        u.rayleigh.value = tuning.rayleigh;
        u.mieCoefficient.value = tuning.mieCoefficient;
        u.mieDirectionalG.value = tuning.mieDirectionalG;
        u.sunPosition.value.copy(sunDir);
        world.renderer.toneMappingExposure = tuning.exposure;

        const altFactor = THREE.MathUtils.clamp(sun.altitude / 45, 0.08, 1);
        world.sunLight.intensity = 1.6 * altFactor;
        world.sunLight.position.copy(sunDir.clone().multiplyScalar(100));
        const warmth = THREE.MathUtils.clamp(1 - sun.altitude / 20, 0, 1);
        world.sunLight.color.copy(new THREE.Color(0xfff3d6).lerp(new THREE.Color(0xffffff), 1 - warmth));

        world.hemiLight.intensity = 0.75;
        world.hemiLight.color.set(0xbfd9ff);
        world.hemiLight.groundColor.set(palette.ground);
        world.ambientLight.intensity = 0.7;
      }

      // The decorative cloud puffs are a fixed part of the scene, but a
      // "clear" sky shouldn't show them -- they're specifically standing
      // in for the cloudy/partly_cloudy/etc. condition.
      world.clouds.visible = condition !== "clear";

      const fogColor = isNight
        ? new THREE.Color(NIGHT_SKY_COLOR)
        : new THREE.Color(palette.skyBottom).lerp(new THREE.Color(0xffffff), 0.15);
      world.scene.fog = new THREE.Fog(fogColor, fogDist.near, fogDist.far);

      const groundColor = new THREE.Color(palette.ground);
      if (isNight) groundColor.multiplyScalar(0.35);
      (world.ground.material as THREE.MeshStandardMaterial).color.copy(groundColor);

      const farColor = new THREE.Color(palette.skyBottom).lerp(new THREE.Color(palette.ground), 0.3);
      const midColor = new THREE.Color(palette.skyBottom).lerp(new THREE.Color(palette.ground), 0.6);
      if (isNight) {
        farColor.multiplyScalar(0.3);
        midColor.multiplyScalar(0.3);
      }
      (world.ridgeFar.material as THREE.MeshBasicMaterial).color.copy(farColor);
      (world.ridgeMid.material as THREE.MeshBasicMaterial).color.copy(midColor);

      if (onObjectPositions) {
        const sunWorld = world.camera.position.clone().add(sunDir.clone().multiplyScalar(200));
        const sunPos = isNight ? null : project(world.camera, sunWorld);
        const cloudPos =
          world.primaryCloud && world.clouds.visible
            ? project(world.camera, world.primaryCloud.getWorldPosition(new THREE.Vector3()))
            : null;
        const treePos = world.primaryTree ? project(world.camera, world.primaryTree.getWorldPosition(new THREE.Vector3())) : null;
        onObjectPositions({ sun: sunPos, cloud: cloudPos, tree: treePos });
      }
    }

    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette, period, condition, lat, lon]);

  return <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />;
}
