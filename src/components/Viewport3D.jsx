import { useEffect, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Default axonometric view direction: a little steeper than isometric.
const AXON_DIR = new Vector3(1, 0.86, 1.22).normalize();
const PERSP_FOV = 30;

// Flat tonal shading without lights: each face takes one of three fixed
// tones depending on which way it mostly faces, like a shaded axonometric.
function shadeColors(pos, base, shadow, amounts) {
  const out = new Float32Array(pos.length);
  const c = new Color();
  for (let i = 0; i < pos.length; i += 9) {
    const ux = pos[i + 3] - pos[i];
    const uy = pos[i + 4] - pos[i + 1];
    const uz = pos[i + 5] - pos[i + 2];
    const vx = pos[i + 6] - pos[i];
    const vy = pos[i + 7] - pos[i + 1];
    const vz = pos[i + 8] - pos[i + 2];
    const nx = Math.abs(uy * vz - uz * vy);
    const ny = Math.abs(uz * vx - ux * vz) * 1.08;
    const nz = Math.abs(ux * vy - uy * vx) * 0.94;
    const level = ny >= nx && ny >= nz ? 0 : nx >= nz ? 1 : 2;
    c.copy(base).lerp(shadow, amounts[level]);
    for (let k = 0; k < 3; k++) {
      out[i + k * 3] = c.r;
      out[i + k * 3 + 1] = c.g;
      out[i + k * 3 + 2] = c.b;
    }
  }
  return out;
}

// World-planar UVs so hatching keeps a constant density across faces.
function planarUV(pos, scale) {
  const uv = new Float32Array((pos.length / 3) * 2);
  for (let i = 0, t = 0; i < pos.length; i += 9) {
    const ux = pos[i + 3] - pos[i];
    const uy = pos[i + 4] - pos[i + 1];
    const uz = pos[i + 5] - pos[i + 2];
    const vx = pos[i + 6] - pos[i];
    const vy = pos[i + 7] - pos[i + 1];
    const vz = pos[i + 8] - pos[i + 2];
    const nx = Math.abs(uy * vz - uz * vy);
    const ny = Math.abs(uz * vx - ux * vz);
    const nz = Math.abs(ux * vy - uy * vx);
    for (let k = 0; k < 3; k++, t += 2) {
      const x = pos[i + k * 3];
      const y = pos[i + k * 3 + 1];
      const z = pos[i + k * 3 + 2];
      if (ny >= nx && ny >= nz) [uv[t], uv[t + 1]] = [x / scale, z / scale];
      else if (nx >= nz) [uv[t], uv[t + 1]] = [z / scale, y / scale];
      else [uv[t], uv[t + 1]] = [x / scale, y / scale];
    }
  }
  return uv;
}

function hatchTexture(palette) {
  const s = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, s, s);
  g.strokeStyle = palette.ink;
  g.lineWidth = 1.4;
  g.beginPath();
  for (let k = -s; k <= s; k += s / 2) {
    g.moveTo(k, s);
    g.lineTo(k + s, 0);
  }
  g.stroke();
  const tex = new CanvasTexture(cv);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function niceStep(x) {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const m = x / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function disposeGroup(group) {
  for (const child of [...group.children]) {
    child.geometry?.dispose();
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      if (!m) continue;
      m.map?.dispose();
      m.dispose();
    }
    group.remove(child);
  }
}

function buildScene(group, model, palette) {
  const ink = new Color(palette.ink);
  const shadow = new Color(palette.shadow);
  const toneColor = {
    paper: new Color(palette.paper),
    light: new Color(palette.light),
    mid: new Color(palette.mid),
    dark: new Color(palette.dark),
    hatch: new Color(palette.paper),
  };
  const { min, max } = model.bounds;
  const size = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 0.01);
  const edgeMat = new LineBasicMaterial({ color: ink });

  for (const solid of model.solids) {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(solid.positions, 3));
    geo.setAttribute('color', new BufferAttribute(shadeColors(solid.positions, toneColor[solid.tone] || toneColor.light, shadow, palette.shade), 3));
    const mat = new MeshBasicMaterial({
      vertexColors: true,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    if (solid.tone === 'hatch') {
      geo.setAttribute('uv', new BufferAttribute(planarUV(solid.positions, size / 40), 2));
      mat.map = hatchTexture(palette);
    }
    const mesh = new Mesh(geo, mat);
    mesh.name = `fill-${solid.tone}`;
    group.add(mesh);
    const edges = new LineSegments(new EdgesGeometry(geo, solid.crease), edgeMat.clone());
    edges.name = 'edges';
    group.add(edges);
  }
  edgeMat.dispose();

  for (const l of model.lines) {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(l.positions, 3));
    const color = l.tone === 'accent' ? palette.accent : palette.ink;
    const mat = new LineBasicMaterial({ color, transparent: l.tone === 'thin', opacity: l.tone === 'thin' ? 0.4 : 1 });
    const seg = new LineSegments(geo, mat);
    seg.name = `line-${l.tone}`;
    group.add(seg);
  }

  // Ground: small crosses on a regular grid, like survey ticks.
  const step = niceStep(size / 7);
  const pad = step;
  const x0 = Math.floor((min[0] - pad) / step) * step;
  const z0 = Math.floor((min[2] - pad) / step) * step;
  const x1 = Math.ceil((max[0] + pad) / step) * step;
  const z1 = Math.ceil((max[2] + pad) / step) * step;
  const y = min[1];
  const t = step * 0.08;
  const ticks = [];
  for (let x = x0; x <= x1 + 1e-6; x += step) {
    for (let z = z0; z <= z1 + 1e-6; z += step) {
      ticks.push(x - t, y, z, x + t, y, z, x, y, z - t, x, y, z + t);
    }
  }
  const tg = new BufferGeometry();
  tg.setAttribute('position', new BufferAttribute(new Float32Array(ticks), 3));
  const tm = new LineBasicMaterial({ color: palette.ink, transparent: true, opacity: 0.35 });
  const tl = new LineSegments(tg, tm);
  tl.name = 'ground';
  group.add(tl);
}

export default function Viewport3D({ model, palette, projection, fitKey, apiRef }) {
  const wrapRef = useRef(null);
  const ctx = useRef(null);

  // One renderer per mount.
  useEffect(() => {
    const wrap = wrapRef.current;
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.className = 'gl';
    wrap.appendChild(renderer.domElement);

    const scene = new Scene();
    const group = new Group();
    scene.add(group);
    const ortho = new OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
    const persp = new PerspectiveCamera(PERSP_FOV, 1, 0.01, 1000);
    const controls = new OrbitControls(ortho, renderer.domElement);
    controls.enableDamping = false;
    controls.zoomToCursor = true;

    const c = {
      renderer,
      scene,
      group,
      ortho,
      persp,
      controls,
      camera: ortho,
      viewH: 1,
      visible: true,
      dirty: true,
      autoFit: true,
      raf: 0,
      bounds: null,
    };
    ctx.current = c;

    const canDraw = () => c.visible && document.visibilityState === 'visible';
    c.render = () => {
      if (!canDraw()) {
        c.dirty = true;
        return;
      }
      if (c.raf) return;
      c.raf = requestAnimationFrame(() => {
        c.raf = 0;
        c.dirty = false;
        renderer.render(scene, c.camera);
      });
    };

    c.updateFrustum = () => {
      const { clientWidth: w, clientHeight: h } = wrap;
      const aspect = w / Math.max(h, 1);
      // Nudge the drawing up and left, clear of the title block.
      const ox = Math.min(120, w * 0.07);
      const oy = Math.min(60, h * 0.06);
      ortho.setViewOffset(w, h, ox, oy, w, h);
      persp.setViewOffset(w, h, ox, oy, w, h);
      ortho.left = -c.viewH * aspect;
      ortho.right = c.viewH * aspect;
      ortho.top = c.viewH;
      ortho.bottom = -c.viewH;
      ortho.updateProjectionMatrix();
      persp.aspect = aspect;
      persp.updateProjectionMatrix();
    };

    c.fit = (dir) => {
      if (!c.bounds) return;
      const { min, max } = c.bounds;
      const center = new Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
      const radius = Math.max(new Vector3(max[0] - min[0], max[1] - min[1], max[2] - min[2]).length() / 2, 0.05);
      const d = (dir || AXON_DIR).clone().normalize();
      const { clientWidth: w, clientHeight: h } = wrap;
      const aspect = w / Math.max(h, 1);
      const fitR = radius * 1.08 * Math.max(1, 1 / aspect);
      controls.target.copy(center);
      if (c.camera === ortho) {
        c.viewH = fitR;
        ortho.zoom = 1;
        ortho.position.copy(center).addScaledVector(d, radius * 6);
        ortho.near = 0.01;
        ortho.far = radius * 14;
      } else {
        const dist = fitR / Math.sin(((PERSP_FOV / 2) * Math.PI) / 180);
        persp.position.copy(center).addScaledVector(d, dist);
        persp.near = Math.max(dist / 200, 0.005);
        persp.far = dist * 10;
      }
      c.updateFrustum();
      controls.update();
      c.render();
    };

    const onChange = () => c.render();
    const onStart = () => {
      c.autoFit = false;
    };
    controls.addEventListener('change', onChange);
    controls.addEventListener('start', onStart);

    const ro = new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = wrap;
      if (!w || !h) return;
      renderer.setSize(w, h);
      if (c.autoFit) c.fit(c.camera.position.clone().sub(controls.target));
      else c.updateFrustum();
      c.render();
    });
    ro.observe(wrap);

    // Pause drawing when off-screen or when the tab is hidden.
    const io = new IntersectionObserver(([entry]) => {
      c.visible = entry.isIntersecting;
      if (c.visible && c.dirty) c.render();
    });
    io.observe(wrap);
    const onVis = () => {
      if (document.visibilityState === 'visible' && c.dirty) c.render();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(c.raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      controls.removeEventListener('change', onChange);
      controls.removeEventListener('start', onStart);
      controls.dispose();
      disposeGroup(group);
      renderer.dispose();
      renderer.domElement.remove();
      ctx.current = null;
    };
  }, []);

  // Rebuild geometry whenever the specimen or the sheet colour changes.
  useEffect(() => {
    const c = ctx.current;
    if (!c || !model) return;
    disposeGroup(c.group);
    buildScene(c.group, model, palette);
    c.renderer.setClearColor(palette.paper, 1);
    c.bounds = model.bounds;
    if (c.autoFit) c.fit(c.camera.position.clone().sub(c.controls.target));
    c.render();
  }, [model, palette]);

  // New tab: back to the default axonometric framing.
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.autoFit = true;
    c.fit(AXON_DIR);
  }, [fitKey]);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const next = projection === 'persp' ? c.persp : c.ortho;
    if (next === c.camera) return;
    const dir = c.camera.position.clone().sub(c.controls.target);
    c.camera = next;
    c.controls.object = next;
    c.fit(dir);
  }, [projection]);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      fit() {
        const c = ctx.current;
        c.autoFit = true;
        c.fit(AXON_DIR);
      },
      // Render once at 2x and read the pixels back in the same task.
      snapshot() {
        const c = ctx.current;
        const prev = c.renderer.getPixelRatio();
        c.renderer.setPixelRatio(2);
        c.renderer.setSize(wrapRef.current.clientWidth, wrapRef.current.clientHeight);
        c.renderer.render(c.scene, c.camera);
        const url = c.renderer.domElement.toDataURL('image/png');
        const w = c.renderer.domElement.width;
        const h = c.renderer.domElement.height;
        c.renderer.setPixelRatio(prev);
        c.renderer.setSize(wrapRef.current.clientWidth, wrapRef.current.clientHeight);
        c.render();
        return { url, w, h };
      },
      // Only the filled meshes; edges and ticks are drawing conventions.
      exportable() {
        const g = new Group();
        for (const child of ctx.current.group.children) {
          if (child.isMesh) g.add(new Mesh(child.geometry, child.material));
        }
        return g;
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  return <div className="viewport viewport-3d" ref={wrapRef} />;
}
