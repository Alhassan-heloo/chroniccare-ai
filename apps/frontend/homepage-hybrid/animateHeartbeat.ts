import { CircleGeometry, DoubleSide, Mesh, MeshBasicMaterial, OrthographicCamera, Scene, WebGLRenderer } from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { gsap } from 'gsap';

const SWEEP_SECONDS = 4.6;
const WIDE_BEAT_COUNT = 3;
const NARROW_BEAT_COUNT = 2;
const HEAD_RADIUS = 2.5;

type Point = readonly [number, number];

export type HeartbeatAnimation = {
  setPlaying: (playing: boolean) => void;
  dispose: () => void;
};

function lineWithPoints(points: number) {
  const geometry = new LineGeometry();
  geometry.setPositions(new Float32Array(points * 3));
  const line = new Line2(geometry, new LineMaterial({ depthTest: false, depthWrite: false }));
  line.frustumCulled = false;
  return line;
}

function setSegmentEnd(geometry: LineGeometry, index: number, x: number, y: number) {
  geometry.getAttribute('instanceEnd').setXYZ(index, x, y, 0);
  // Both endpoints share the same interleaved GPU buffer.
  geometry.getAttribute('instanceEnd').needsUpdate = true;
}

function writeSegment(geometry: LineGeometry, index: number, start: Point, end: Point) {
  geometry.getAttribute('instanceStart').setXYZ(index, start[0], start[1], 0);
  setSegmentEnd(geometry, index, end[0], end[1]);
}

export function createHeartbeat(
  host: HTMLDivElement,
  shape: SVGSVGElement,
  waveform: readonly Point[],
  showFallback: () => void,
): HeartbeatAnimation | undefined {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true });
  if (!context) return;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  } catch {
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return;
  }

  const scene = new Scene();
  const camera = new OrthographicCamera(0, 1, 0, 1, 0.1, 10);
  camera.position.z = 1;
  const guide = lineWithPoints(2);
  guide.material.transparent = true;
  guide.material.opacity = 0.28;

  const trace = lineWithPoints(WIDE_BEAT_COUNT * waveform.length + 2);
  // The camera uses screen coordinates (Y points down), which flips the circle's face.
  const head = new Mesh(
    new CircleGeometry(HEAD_RADIUS, 16),
    new MeshBasicMaterial({ depthTest: false, depthWrite: false, side: DoubleSide }),
  );
  head.renderOrder = 1;
  scene.add(guide, trace, head);

  const sweep = { progress: 0 };
  let width = 0;
  let baselineY = 0;
  let path: Point[] = [];
  let partialSegment = -1;

  function render() {
    if (path.length < 2) return;

    const x = sweep.progress * width;
    const nextIndex = path.findIndex(([pointX]) => pointX >= x);
    // x=0 still uses the first segment so the head starts on the baseline.
    const segment = Math.max(0, nextIndex - 1);
    const [fromX, fromY] = path[segment]!;
    const [toX, toY] = path[segment + 1]!;
    const fraction = (x - fromX) / (toX - fromX);
    const y = fromY + (toY - fromY) * fraction;

    // Restore the previously clipped segment before drawing the new head segment.
    // The other segments always stay at the screen coordinates assigned on resize.
    if (partialSegment !== -1 && partialSegment !== segment) {
      const [previousX, previousY] = path[partialSegment + 1]!;
      setSegmentEnd(trace.geometry, partialSegment, previousX, previousY);
    }
    setSegmentEnd(trace.geometry, segment, x, y);
    partialSegment = segment;
    trace.geometry.instanceCount = segment + (fraction > 0 ? 1 : 0);

    const guideStart = x + HEAD_RADIUS * 2;
    guide.geometry.instanceCount = guideStart < width ? 1 : 0;
    if (guideStart < width) writeSegment(guide.geometry, 0, [guideStart, baselineY], [width, baselineY]);

    head.position.set(x, y, 0);
    renderer.render(scene, camera);
  }

  function updateTheme() {
    const style = getComputedStyle(host);
    const thickness = parseFloat(style.getPropertyValue('--heartbeat-thickness'));
    trace.material.color.set(style.getPropertyValue('--heartbeat-line').trim());
    guide.material.color.copy(trace.material.color);
    head.material.color.copy(trace.material.color).lerp(headWhite, 0.34);
    guide.material.linewidth = trace.material.linewidth = thickness;
  }

  const headWhite = head.material.color.clone().set('#ffffff');

  function resize() {
    const bounds = host.getBoundingClientRect();
    const beatBounds = shape.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    width = bounds.width;
    const beatCount = width < 760 ? NARROW_BEAT_COUNT : WIDE_BEAT_COUNT;
    const spacing = width / beatCount;
    const beatWidth = Math.min(beatBounds.width, spacing * 0.74);
    const scaleX = beatWidth / shape.viewBox.baseVal.width;
    const scaleY = beatBounds.height / shape.viewBox.baseVal.height;
    baselineY = waveform[0]![1] * scaleY;

    path = [[0, baselineY]];
    for (let beat = 0; beat < beatCount; beat++) {
      const start = (beat + 0.5) * spacing - beatWidth / 2;
      for (const [x, y] of waveform) path.push([start + x * scaleX, y * scaleY]);
    }
    path.push([width, baselineY]);

    for (let index = 1; index < path.length; index++) {
      writeSegment(trace.geometry, index - 1, path[index - 1]!, path[index]!);
    }
    partialSegment = -1;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, bounds.height, false);
    camera.right = width;
    camera.bottom = bounds.height;
    camera.updateProjectionMatrix();
    render();
  }

  const tween = gsap.to(sweep, {
    progress: 1, duration: SWEEP_SECONDS, ease: 'none', repeat: -1, paused: true, onUpdate: render,
  });
  const sizeObserver = new ResizeObserver(resize);
  const themeObserver = new MutationObserver(() => {
    updateTheme();
    render();
  });
  const theme = host.closest('.hybrid');

  function dispose() {
    tween.kill();
    sizeObserver.disconnect();
    themeObserver.disconnect();
    canvas.removeEventListener('webglcontextlost', showFallback);
    canvas.remove();
    delete host.dataset.webgl;
    for (const object of [guide, trace, head]) {
      object.geometry.dispose();
      object.material.dispose();
    }
    renderer.dispose();
    if (!context?.isContextLost()) renderer.forceContextLoss();
  }

  try {
    updateTheme();
    resize();
    canvas.addEventListener('webglcontextlost', showFallback);
    sizeObserver.observe(host);
    if (theme) themeObserver.observe(theme, { attributeFilter: ['data-theme'] });
    host.append(canvas);
    host.dataset.webgl = 'active';
    return { setPlaying: playing => { tween.paused(!playing); }, dispose };
  } catch {
    dispose();
  }
}