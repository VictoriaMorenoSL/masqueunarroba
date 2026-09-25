/* No dependencies. Real XYZ geometry projected through a perspective camera,
   drawn as continuous polylines on Canvas2D; no flat reference image is used. */
(() => {
  'use strict';
  const DEFAULTS = Object.freeze({ speed: 1.5, amplitude: 3, density: 200,
    opacity: 0.22, cursor: 0.57, background: '#151419', color: '#D99489' });
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  // GEOMETRY: shared grid topology. Subsamples smooth the lines without adding cells.
  function createGeometry(density) {
    const count = Math.round(clamp(density, 24, 240));
    const samples = count * 2 + 1;
    const points = new Float64Array(samples * samples * 3);
    const projected = new Float32Array(samples * samples * 2);
    const base = new Float64Array(samples * samples * 2);
    for (let j = 0; j < samples; j++) for (let i = 0; i < samples; i++) {
      const u = (i / (samples - 1) * 2 - 1);
      const v = (j / (samples - 1) * 2 - 1);
      // Radial compression gathers the woven grid into a small central region.
      // Unlike independent X/Y compression, this avoids a dense cross-shaped band.
      const radius2 = u * u + v * v;
      const gather = 0.22 + 0.78 * (1 - Math.exp(-radius2 * 5.2));
      const x = 34 * u * gather;
      const y = 34 * v * gather;
      const k = (j * samples + i) * 2;
      base[k] = x; base[k + 1] = y;
    }
    return { samples, points, projected, base };
  }

  // DEFORMATION: stable folds + broad, coordinated waves along the Z axis.
  // Integrated phase is never reset when speed changes.
  function deformGeometry(g, phase, amplitude, hover = { x: 0, y: 0, strength: 0 }) {
    // Cache the fixed composition once; each frame only evaluates the breathing field.
    const initialize = !g.shape;
    if (initialize) g.shape = new Float64Array(g.base.length / 2 * 5);
    for (let i = 0; i < g.base.length / 2; i++) {
      const offset = i * 5;
      if (initialize) {
      const u = g.base[i * 2], v = g.base[i * 2 + 1];
      const r = Math.hypot(u, v);
      const envelope = 1 - Math.exp(-r * r / 14);
      // Two flowing, non-periodic-looking shears bend the quadrilateral weave.
      // Their gentle twist follows the asymmetric S-curves in the reference.
      const twist = 0.19 * Math.exp(-r * r / 180);
      const sx = u * Math.cos(twist) - v * Math.sin(twist);
      const sy = u * Math.sin(twist) + v * Math.cos(twist);
      const x = sx + envelope * (2.15 * Math.sin(sy * 0.43 + sx * 0.14)
        + 0.55 * Math.sin(sy * 0.83 - sx * 0.18));
      const y = sy + envelope * (2.15 * Math.sin(sx * 0.39 - sy * 0.18 + 0.7)
        + 0.5 * Math.sin(sx * 0.78 + sy * 0.13));
      const valley = -11 * Math.exp(-((x + 0.35) ** 2 / 26 + (y - 0.3) ** 2 / 19));
      // Broad lobes rather than small ripples: a continuous fabric drawn inward.
      const folds = 0.9 * Math.sin(x * 0.40 + y * 0.19 + 0.6)
        * Math.cos(y * 0.32 - x * 0.12)
        + 0.35 * Math.sin(y * 0.57 - x * 0.22 + 1.4);
      const dx = x + 0.35, dy = y - 0.3;
      const radius = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const creaseEnvelope = (1 - Math.exp(-(radius ** 4) / 28))
        * Math.exp(-radius * radius / 550);
      // Uneven angular spacing and curved channels prevent a regular star pattern.
      const bend = 0.65 * Math.sin(angle * 2 + 0.6)
        + 0.27 * Math.sin(angle * 3 - 0.9) + radius * 0.13 + 0.8 * Math.sin(radius * 0.48);
      const inwardFolds = creaseEnvelope * (
        1.1 * Math.sin(6 * angle + bend + 0.5)
        + 0.33 * Math.sin(9 * angle - radius * 0.16 + 1.1));
        g.shape[offset] = x;
        g.shape[offset + 1] = y;
        g.shape[offset + 2] = r;
        g.shape[offset + 3] = valley;
        // Stronger fold height, with the previous central depth and framing.
        g.shape[offset + 4] = 1.35 * (folds + inwardFolds);
      }
      const x = g.shape[offset], y = g.shape[offset + 1], r = g.shape[offset + 2];
      const valley = g.shape[offset + 3], folds = g.shape[offset + 4];
      const breath = 0.65 * Math.sin(x * 0.23 + y * 0.17 + phase)
        + 0.4 * Math.cos(y * 0.31 - x * 0.13 - phase * 0.73)
        + 0.22 * Math.sin(r * 0.38 - phase * 0.53);
      g.points[i * 3] = x;
      g.points[i * 3 + 1] = y;
      g.points[i * 3 + 2] = valley + amplitude * (folds + breath)
        // Broad local depression follows the pointer without breaking continuity.
        - hover.strength * 3 * Math.exp(-((x - hover.x) ** 2 + (y - hover.y) ** 2) / 15);
    }
  }

  // KEY GEOMETRY: rounded silhouette, circular hole and three teeth.
  // The reference is interpreted as a 3D surface, never displayed as a bitmap.
  function keyDistance(x, y) {
    const head = 3.55 - Math.hypot(x + 4.45, y);
    const shaftEnd = 6.55;
    let lower = -1.35;
    // Smooth teeth along the lower edge; top edge remains straight.
    if (x > -0.9 && x < shaftEnd) {
      lower = -1.35 + 0.84 * Math.pow(Math.sin((x + 0.9) / 2.45 * Math.PI), 2);
    }
    const shaft = Math.min(x + 1.5, shaftEnd - x, 1.35 - y, y - lower);
    const tip = Math.min(x - shaftEnd, 7.95 - x, (7.95 - x) * 1.35 / 1.4 - Math.abs(y));
    const outer = Math.max(head, shaft, tip);
    const hole = Math.hypot(x + 5.9, y) - 1.03;
    return Math.min(outer, hole);
  }

  function createKeyTarget(g) {
    const n = g.samples;
    const points = new Float64Array(g.points.length);
    const inside = new Uint8Array(n * n);
    const distances = new Float64Array(n * n);
    for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
      const i = row * n + col;
      const u = col / (n - 1) * 16.3 - 8.15;
      const v = row / (n - 1) * 7.4 - 3.7;
      // Softly curve the rectangular weave while keeping the sampled silhouette.
      const x = u + 0.10 * Math.sin(v * 1.4) * Math.exp(-((u + 3) ** 2) / 20);
      const y = v + 0.15 * Math.sin(u * 0.75) * Math.cos(v * 0.42);
      const distance = keyDistance(x, y);
      inside[i] = distance >= 0 ? 1 : 0;
      distances[i] = distance;
      points[i * 3] = x;
      points[i * 3 + 1] = y;
      points[i * 3 + 2] = 0.85 * Math.sqrt(clamp(distance / 0.85, 0, 1));
    }
    // Trace the silhouette and hole through the sampled surface (marching squares).
    const outline = [];
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const ids = [r*n+c, r*n+c+1, (r+1)*n+c+1, (r+1)*n+c];
      const hits = [];
      for (let edge = 0; edge < 4; edge++) {
        const a = ids[edge], b = ids[(edge+1)%4];
        if (inside[a] === inside[b]) continue;
        const t = distances[a] / (distances[a] - distances[b]);
        hits.push(points[a*3] + (points[b*3]-points[a*3])*t,
          points[a*3+1] + (points[b*3+1]-points[a*3+1])*t, 0);
      }
      if (hits.length === 6 || hits.length === 12) outline.push(...hits);
    }
    const outlinePoints = new Float64Array(outline);
    return { points, inside, outline: {
      points: new Float64Array(outlinePoints.length),
      projected: new Float32Array(outlinePoints.length / 3 * 2),
      target: { points: outlinePoints }
    } };
  }

  function morphToKey(g, target, amount, time, width, height, sceneMix = 0) {
    // Fit horizontally on phones as well as desktops; the camera stays fixed.
    // Quintic ease-in/ease-out: zero velocity and acceleration at both ends.
    const easedScene = sceneMix ** 3 * (sceneMix * (sceneMix * 6 - 15) + 10);
    const scale = Math.min(1, width / Math.max(width, height)) * (0.87 - easedScene * 0.29);
    const yaw = amount * (0.10 + 0.23 * Math.sin(time * 0.53));
    const pitch = amount * (0.12 + 0.12 * Math.sin(time * 0.41));
    const roll = amount * (0.075 * Math.sin(time * 0.46) + easedScene * 2.82);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    for (let i = 0; i < g.points.length; i += 3) {
      const x = target.points[i], y = target.points[i + 1], z = target.points[i + 2];
      const xx = x * cy + z * sy, zz = z * cy - x * sy;
      const yy = y * cp - zz * sp, zzz = y * sp + zz * cp;
      const tx = (xx * cr - yy * sr) * scale + easedScene * 0.3 * Math.sin(time * 0.48);
      const ty = (xx * sr + yy * cr) * scale + 0.19 * Math.sin(time * 0.57);
      const tz = zzz * scale;
      g.points[i] += (tx - g.points[i]) * amount;
      g.points[i + 1] += (ty - g.points[i + 1]) * amount;
      g.points[i + 2] += (tz - g.points[i + 2]) * amount;
    }
  }

  // DOOR GEOMETRY: the same cloth vertices gather into a tall rectangular leaf.
  // Edge-biased spacing defines the frame before the PNG takes over the final detail.
  function createDoorTarget(g) {
    const n=g.samples,points=new Float64Array(g.points.length);
    for(let row=0;row<n;row++)for(let col=0;col<n;col++){
      const i=row*n+col,u=col/(n-1)*2-1,v=row/(n-1)*2-1;
      const edgeX=Math.sign(u)*(1-Math.pow(1-Math.abs(u),1.72));
      const edgeY=Math.sign(v)*(1-Math.pow(1-Math.abs(v),1.45));
      const x=edgeX*4.25,y=edgeY*7.1;
      const yaw=-.13,z=x*Math.sin(yaw)+.32*Math.cos(v*Math.PI*.5);
      points[i*3]=x*Math.cos(yaw);
      points[i*3+1]=y;
      points[i*3+2]=z;
    }
    return points;
  }

  function morphToDoor(g,target,amount) {
    const eased=amount*amount*(3-2*amount);
    for(let i=0;i<g.points.length;i+=3){
      g.points[i]+=(target[i]-g.points[i])*eased;
      g.points[i+1]+=(target[i+1]-g.points[i+1])*eased;
      g.points[i+2]+=(target[i+2]-g.points[i+2])*eased;
    }
  }

  // CAMERA: perspective projection with a scroll-controlled dolly along Z.
  class PerspectiveCamera {
    constructor() { this.x = 0; this.y = 0; this.z = 19; this.fov = 54 * Math.PI / 180; }
    update(pointer, sensitivity, dt) {
      const inertia = 1 - Math.exp(-dt * 3.2);
      this.x += (pointer.x * sensitivity * 2.2 - this.x) * inertia;
      this.y += (pointer.y * sensitivity * 1.5 - this.y) * inertia;
    }
    project(g, width, height) {
      // Orthonormal look-at basis aimed at the valley. Positive Z faces the viewer.
      const cameraX=this.x+(this.travelX||0),cameraY=this.y+(this.travelY||0);
      const length = Math.hypot(cameraX, cameraY, this.z + 3);
      const zx = cameraX / length, zy = cameraY / length, zz = (this.z + 3) / length;
      const rightLength = Math.hypot(zz, zx);
      const rx = zz / rightLength, rz = -zx / rightLength;
      const ux = zy * rz, uy = zz * rx - zx * rz, uz = -zy * rx;
      const focal = Math.max(width, height) / (2 * Math.tan(this.fov / 2));
      for (let i = 0; i < g.points.length / 3; i++) {
        const x = g.points[i * 3] - cameraX, y = g.points[i * 3 + 1] - cameraY;
        const z = g.points[i * 3 + 2] - this.z;
        const depth = -(x * zx + y * zy + z * zz);
        g.projected[i * 2] = width / 2 + focal * (x * rx + z * rz) / depth;
        g.projected[i * 2 + 1] = height / 2 - focal * (x * ux + y * uy + z * uz) / depth;
      }
    }
  }

  class MeshLayer {
    constructor(container, options = {}) {
      this.container = container;
      this.params = { ...DEFAULTS, ...options };
      this.current = { ...this.params };
      this.geometry = createGeometry(this.params.density);
      this.camera = new PerspectiveCamera();
      this.keyTarget = null;
      this.morph = 0;
      this.morphElapsed = 0;
      this.keyTime = 0;
      this.morphDuration = 4.5;
      this.pointer = { x: 0, y: 0, active: false };
      this.hover = { x: 0, y: 0, strength: 0 };
      this.phase = options.phase || 0; this.lastTime = null; this.destroyed = false;
      this.canvas = document.createElement('canvas');
      this.canvas.setAttribute('aria-hidden', 'true');
      container.append(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.finePointer = matchMedia('(hover: hover) and (pointer: fine)');
      this.events = new AbortController();
      const eventOptions = { signal: this.events.signal };
      this.pointerSurface = container.parentElement;
      this.pointerSurface.addEventListener('pointermove', e => {
        if (!this.finePointer.matches || this.motion.matches || e.pointerType === 'touch') return;
        if (e.target.closest?.('.mesh-controls')) { neutral(); return; }
        this.pointer.active = true;
        const rect = this.container.getBoundingClientRect();
        this.pointer.x = clamp((e.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
        this.pointer.y = clamp(1 - (e.clientY - rect.top) / rect.height * 2, -1, 1);
      }, eventOptions);
      const neutral = () => { this.pointer.x = this.pointer.y = 0; this.pointer.active = false; };
      this.pointerSurface.addEventListener('pointerleave', neutral, eventOptions);
      window.addEventListener('blur', neutral, eventOptions);
      this.motion.addEventListener('change', () => { neutral(); this.camera.x = this.camera.y = 0; }, eventOptions);
      this.finePointer.addEventListener('change', neutral, eventOptions);
      document.addEventListener('visibilitychange', () => { this.lastTime = null; neutral(); }, eventOptions);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
      this.resize();
      this.frame = this.frame.bind(this);
      this.raf = requestAnimationFrame(this.frame);
    }
    beginKeyMorph() {
      this.keyTarget = createKeyTarget(this.geometry);
      this.morphElapsed = 0;
      this.pointer.x = this.pointer.y = 0;
      this.pointer.active = false;
    }
    returnToMesh() {
      // The final scene reuses the living mesh, without retaining the key/door geometry.
      this.geometry = createGeometry(this.params.density);
      this.keyTarget = null;
      this.depthCloth = null;
      this.doorTargetGeometry = null;
      this.morph = 0;
      this.visualDoor = 0;
      this.doorProgress = 0;
    }
    setParameters(patch) {
      for (const [key, min, max] of [['speed',0,1.5],['amplitude',0,3],['opacity',0.03,0.6],['cursor',0,1.5]]) {
        if (Number.isFinite(patch[key])) this.params[key] = clamp(patch[key], min, max);
      }
      // Density is a construction parameter; no topology changes during animation.
    }
    resize() {
      this.width = Math.max(1, this.container.clientWidth);
      this.height = Math.max(1, this.container.clientHeight);
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    frame(now) {
      if (this.destroyed) return;
      const dt = this.lastTime === null ? 0 : Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      if (!document.hidden) {
        const smooth = this.motion.matches ? 1 : 1 - Math.exp(-dt * 7);
        for (const key of ['speed','amplitude','opacity','cursor']) this.current[key] += (this.params[key] - this.current[key]) * smooth;
        if (!this.motion.matches) this.phase += dt * this.current.speed * 0.45;
        this.camera.update(this.pointer, this.motion.matches ? 0 : this.current.cursor * (1 - this.morph * 0.8), dt);
        const follow = this.motion.matches ? 1 : 1 - Math.exp(-dt * 4.5);
        const focal = Math.max(this.width, this.height) / (2 * Math.tan(this.camera.fov / 2));
        this.hover.x += (this.pointer.x * this.width * 0.5 * 19 / focal - this.hover.x) * follow;
        this.hover.y += (this.pointer.y * this.height * 0.5 * 19 / focal - this.hover.y) * follow;
        const strength = this.pointer.active && !this.motion.matches ? this.current.cursor : 0;
        this.hover.strength += (strength - this.hover.strength) * follow;
        if (this.keyTarget) {
          this.morphElapsed += dt;
          const t = this.motion.matches ? 1 : clamp(this.morphElapsed / this.morphDuration, 0, 1);
          this.morph = t * t * t * (t * (t * 6 - 15) + 10);
          if (!this.motion.matches) this.keyTime += dt;
        }
        if (this.morph < 1) deformGeometry(this.geometry, this.phase, this.current.amplitude, this.hover);
        if (this.keyTarget) morphToKey(this.geometry, this.keyTarget, this.morph, this.keyTime, this.width, this.height, this.sceneMix || 0);
        const depth = this.depthProgress || 0;
        const blend = clamp((depth - .18) / .82, 0, 1);
        this.clothBlend = blend * blend * (3 - 2 * blend);
        const travelTarget=this.travelProgress||0;
        this.dolly=(this.dolly||0)+(travelTarget-(this.dolly||0))*(this.motion.matches?1:1-Math.exp(-dt*2.4));
        this.camera.z = 22 - 11*this.dolly - 6*Math.sin(Math.PI*depth);
        this.camera.fov=(54-7*this.dolly)*Math.PI/180;
        this.camera.travelX=Math.sin(this.phase*.72)*.75*this.dolly;
        this.camera.travelY=Math.cos(this.phase*.58)*.46*this.dolly;
        if (depth > 0) {
          if (!this.depthCloth) this.depthCloth = { base:this.geometry.base, points:new Float64Array(this.geometry.points.length) };
          deformGeometry(this.depthCloth, this.phase, this.current.amplitude, this.hover);
          for (let i=0;i<this.geometry.points.length;i++) this.geometry.points[i] += (this.depthCloth.points[i]-this.geometry.points[i])*this.clothBlend;
        }
        const doorTarget=this.doorProgress||0;
        this.visualDoor=(this.visualDoor||0)+(doorTarget-(this.visualDoor||0))*(this.motion.matches?1:1-Math.exp(-dt*3.35));
        const door=this.visualDoor;
        if(door>0){
          this.doorTargetGeometry||=createDoorTarget(this.geometry);
          morphToDoor(this.geometry,this.doorTargetGeometry,door);
        }
        this.camera.project(this.geometry, this.width, this.height);
        this.draw();
        if (this.morph === 1 && this.onMorphComplete) {
          const done = this.onMorphComplete; this.onMorphComplete = null; done();
        }
      }
      this.raf = requestAnimationFrame(this.frame);
    }
    draw() {
      const ctx = this.ctx, g = this.geometry, n = g.samples;
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.fillStyle = this.params.background;
      ctx.globalAlpha = 1 - (this.sceneMix || 0);
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.strokeStyle = this.params.color;
      ctx.lineWidth = 0.8 + this.morph * 0.15;
      // The same vertices move from cloth to key. Unused strands fade away.
      const path = (rowDirection, fixed, retained) => {
        let drawing = false;
        for (let step = 0; step < n; step++) {
          const index = rowDirection ? fixed * n + step : step * n + fixed;
          const show = !retained || this.keyTarget.inside[index];
          if (!show) { drawing = false; continue; }
          const k = index * 2;
          if (drawing) ctx.lineTo(g.projected[k], g.projected[k + 1]);
          else { ctx.moveTo(g.projected[k], g.projected[k + 1]); drawing = true; }
        }
      };
      const doorMeshVisibility=1-clamp(((this.visualDoor||0)-.76)/.24,0,1);
      ctx.globalAlpha = this.current.opacity * doorMeshVisibility * (1 - this.morph + this.morph * (this.clothBlend || 0));
      if (ctx.globalAlpha > 0) {
        ctx.beginPath();
        for (let row = 0; row < n; row += 2) path(true, row, false);
        for (let col = 0; col < n; col += 2) path(false, col, false);
        ctx.stroke();
      }
      if (this.keyTarget && this.morph > 0) {
        ctx.globalAlpha = 0.64 * this.morph * (1 - (this.clothBlend || 0));
        ctx.beginPath();
        for (let row = 0; row < n; row += 12) path(true, row, true);
        for (let col = 0; col < n; col += 8) path(false, col, true);
        ctx.stroke();
        const outline = this.keyTarget.outline;
        morphToKey(outline, outline.target, 1, this.keyTime, this.width, this.height, this.sceneMix || 0);
        this.camera.project(outline, this.width, this.height);
        ctx.globalAlpha = this.morph === 1 ? 0.64 * Math.max(0,1-(this.depthProgress||0)*5) : 0;
        ctx.beginPath();
        for (let i = 0; i < outline.projected.length; i += 4) {
          ctx.moveTo(outline.projected[i], outline.projected[i+1]);
          ctx.lineTo(outline.projected[i+2], outline.projected[i+3]);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    destroy() {
      this.destroyed = true; cancelAnimationFrame(this.raf);
      this.events.abort(); this.resizeObserver.disconnect(); this.canvas.remove();
    }
  }

  // Reusable background layer; no test controls in the interface.
  window.MeshPrototype = { MeshLayer, PerspectiveCamera, createGeometry, deformGeometry, createKeyTarget, keyDistance, morphToKey, DEFAULTS };
  // DATA SOURCE ADAPTER. Replace this class with an API-backed source exposing
  // sample(nowMs) => {today, year}; the view and animations need not change.
  class SimulatedEmailSource {
    constructor(now = Date.now()) {
      const d = new Date(now);
      this.day = d.toISOString().slice(0, 10);
      this.yearNumber = d.getUTCFullYear();
      this.rate = 3900000; // Illustrative rate, not a measured global statistic.
      this.today = (now - Date.UTC(this.yearNumber, d.getUTCMonth(), d.getUTCDate())) / 1000 * this.rate;
      this.year = (now - Date.UTC(this.yearNumber, 0, 1)) / 1000 * this.rate;
      this.last = now;
    }
    sample(now = Date.now()) {
      const d = new Date(now), dt = Math.max(0, now - this.last) / 1000;
      const increment = dt * this.rate * (1 + 0.025 * Math.sin(now / 13000));
      this.today += increment; this.year += increment; this.last = now;
      if (d.toISOString().slice(0, 10) !== this.day) {
        this.day = d.toISOString().slice(0, 10);
        this.today = (now - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 1000 * this.rate;
      }
      if (d.getUTCFullYear() !== this.yearNumber) {
        this.yearNumber = d.getUTCFullYear();
        this.year = (now - Date.UTC(this.yearNumber, 0, 1)) / 1000 * this.rate;
      }
      return { today: Math.floor(this.today), year: Math.floor(this.year) };
    }
  }

  function readableDate(now = new Date()) {
    return [now.getDate(), now.getMonth()+1, now.getFullYear()].map((n,i)=>i<2?String(n).padStart(2,'0'):n).join('-');
  }
  function relocateCharacter(scene, block) {
    // Reserve the heading, header and bottom-centre scroll cue, including text width.
    const candidates = [[.04,.32],[.26,.21],[.40,.16],[.61,.16],[.78,.24],[.08,.45],[.29,.40],
      [.50,.31],[.70,.43],[.84,.56],[.06,.64],[.30,.60],[.51,.62],[.73,.69],[.10,.79],
      [.24,.88],[.68,.87],[.82,.91],[.36,.71],[.56,.75],[.43,.25],[.80,.35],[.94,.72],[.05,.76],[.72,.73],[.32,.48]];
    const occupied = new Set(scene.characters.filter(other=>other!==block).map(other=>other.slot));
    const free = candidates.map((_,i)=>i).filter(i=>!occupied.has(i));
    block.slot = (free.length?free:candidates.map((_,i)=>i))[Math.floor(Math.random()*(free.length||candidates.length))];
    const p=candidates[block.slot];block.element.style.left=`${p[0]*100}%`;block.element.style.top=`${p[1]*100}%`;
  }
  function resetCharacterDepth(scene,block,now,{reposition=true,entry=false}={}) {
    if(reposition)relocateCharacter(scene,block);
    block.depth=entry?.12+Math.random()*.08:0;
    block.depthSpeed=.035+Math.random()*.07;
    block.depthScale=.82+Math.random()*.52;
    block.driftX=(Math.random()-.5)*110;
    block.driftY=(Math.random()-.5)*80;
    block.rotation=(Math.random()-.5)*14;
    block.waitUntil=entry?now:now+350+Math.random()*1900;
    const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÉØ@#&?/\\[]{}*';
    if(reposition){
      const length=4+Math.floor(Math.random()*12);
      block.element.textContent=Array.from({length},()=>alphabet[Math.floor(Math.random()*alphabet.length)]).join('');
      block.numeric=Math.random()<.23;block.value=Math.floor(Math.random()*10000000);
    }
  }
  function updateAmbientPresence(scene, now, dt) {
    const depthProgress=scene.dataDepthProgress||0;
    if(depthProgress<=0){
      scene.dataScrollImpulse=0;
      for(const block of scene.characters){
        block.prePhase??=Math.random()*Math.PI*2;
        if(!block.presenceStart){
          block.presenceStart=now+Math.random()*900;
          block.presenceLife=2400+Math.random()*3200;
        }
        const age=now-block.presenceStart;
        if(age>block.presenceLife){
          relocateCharacter(scene,block);
          block.presenceStart=now+250+Math.random()*1350;
          block.presenceLife=2400+Math.random()*3200;
          block.element.style.opacity='0';
          continue;
        }
        if(age<0){block.element.style.opacity='0';continue;}
        const fadeIn=Math.min(1,age/650),fadeOut=Math.min(1,(block.presenceLife-age)/750);
        const floatX=Math.sin(now*.00035+block.prePhase)*4;
        const floatY=Math.cos(now*.00028+block.prePhase)*3;
        block.element.style.opacity=String(Math.max(0,Math.min(fadeIn,fadeOut))*.88);
        block.element.style.transform=`translate3d(${floatX}px,${floatY}px,0) scale(1) rotate(${Math.sin(now*.00016+block.prePhase)*1.2}deg)`;
      }
      return;
    }
    scene.dataScrollImpulse=Math.max(0,(scene.dataScrollImpulse||0)-dt*1.15);
    for (const block of scene.characters) {
      if(block.depth===undefined)resetCharacterDepth(scene,block,now,{reposition:false,entry:true});
      if(now<block.waitUntil){block.element.style.opacity='0';continue;}
      const impulse=scene.dataScrollImpulse||0;
      block.depth+=dt*(block.depthSpeed*(.35+depthProgress*1.2)*(1+block.depth*.85)+impulse*(.025+block.depth*.055));
      if(block.depth>=1){resetCharacterDepth(scene,block,now);block.element.style.opacity='0';continue;}
      const entry=Math.min(1,block.depth/.12);
      const exit=block.depth<.62?1:Math.max(0,1-(block.depth-.62)/.38);
      const opacity=entry*exit*.92;
      const scale=(.52+Math.pow(block.depth,1.7)*4.2)*block.depthScale;
      const travel=Math.pow(block.depth,1.35);
      const floatX=Math.sin(now*.00045+block.slot)*7;
      const floatY=Math.cos(now*.00037+block.slot*.7)*5;
      block.element.style.opacity=String(opacity);
      block.element.style.transform=`translate3d(${block.driftX*travel+floatX}px,${block.driftY*travel+floatY}px,0) scale(${scale}) rotate(${block.rotation*travel}deg)`;
    }
  }
  function updateIdentity(scene, now) {
    if(now<(scene.identityNext||0))return;
    scene.identityNext=now+140;
    scene.ui.querySelector('.session-date').textContent=readableDate();
    const chars=Array.from(scene.email), alphabet='0123456789@#&?/';
    if(!scene.motion.matches && scene.elapsed%5>3.8 && scene.email!=='tu correo') {
      for(let i=0;i<2;i++){const at=Math.floor(Math.random()*chars.length);chars[at]=alphabet[Math.floor(Math.random()*alphabet.length)];}
    }
    scene.ui.querySelector('.session-email').textContent=chars.join('');
  }
  function dissolveSecondaryKeys(scene) {
    if(scene.fragments)return;
    scene.fragments=[];
    for(const key of scene.keys){
      const canvas=key.canvas,bounds=key.wrapper.getBoundingClientRect();
      for(let row=0;row<4;row++)for(let col=0;col<8;col++){
        const fragment=document.createElement('canvas');fragment.width=Math.ceil(canvas.width/8);fragment.height=Math.ceil(canvas.height/4);
        fragment.getContext('2d').drawImage(canvas,col*canvas.width/8,row*canvas.height/4,canvas.width/8,canvas.height/4,0,0,fragment.width,fragment.height);
        fragment.className='key-fragment';fragment.setAttribute('aria-hidden','true');
        fragment.style.width=`${bounds.width/8}px`;fragment.style.height=`${bounds.height/4}px`;
        const x=bounds.left+col*bounds.width/8,y=bounds.top+row*bounds.height/4;
        fragment.style.left=`${x}px`;fragment.style.top=`${y}px`;
        const angle=Math.atan2(y-scene.height/2,x-scene.width/2)+(Math.random()-.5);
        scene.ui.append(fragment);scene.fragments.push({element:fragment,dx:Math.cos(angle)*scene.width*.7,dy:Math.sin(angle)*scene.height*.8,spin:(Math.random()-.5)*220});
      }
    }
  }
  function setupDepthScroll(scene) {
    scene.depth=0;scene.depthStep=0;scene.depthFrom=0;scene.depthAge=0;
    scene.lastWheel=0;scene.scrollReady=0;scene.wheelSum=0;scene.worldSince=0;
    const advance = () => {
      const now=performance.now();
      if(scene.elapsed<3.5 || scene.depthStep>=4 || now<scene.scrollReady)return;
      if(scene.depthStep===2 && now-scene.worldSince<2800)return;
      scene.depthFrom=scene.depth;scene.depthStep++;scene.depthAge=0;
      scene.scrollReady=now+(scene.motion.matches?500:2600);
      scene.root.classList.add('is-scrolling');
      clearTimeout(scene.scrollIdleTimer);
      scene.scrollIdleTimer=setTimeout(()=>scene.root.classList.remove('is-scrolling'),scene.motion.matches?100:900);
      scene.root.classList.add('has-scrolled');
      scene.dataScrollImpulse=Math.min(2.8,(scene.dataScrollImpulse||0)+1.25);
      scene.active=false;scene.counter.hidden=true;
      scene.nodes.forEach(node=>node.element.setAttribute('aria-expanded','false'));
      if(scene.depthStep===1&&!scene.motion.matches)dissolveSecondaryKeys(scene);
      if(scene.depthStep===2)scene.worldSince=now;
      if(scene.depthStep===4)scene.doorSince=now;
    };
    const signal={signal:scene.events.signal};
    scene.root.addEventListener('wheel',event=>{
      if(event.ctrlKey||event.target.closest('.email-counter'))return;
      event.preventDefault();
      const now=performance.now(),quiet=now-scene.lastWheel>220;scene.lastWheel=now;
      if(quiet)scene.wheelSum=0;
      scene.wheelSum+=Math.max(0,event.deltaY)*(event.deltaMode===1?16:event.deltaMode===2?scene.height:1);
      scene.dataScrollImpulse=Math.min(2.8,(scene.dataScrollImpulse||0)+Math.max(0,event.deltaY)*.0045);
      if(now<scene.scrollReady){scene.wheelSum=0;return;}
      if(scene.wheelSum>40){advance();scene.wheelSum=0;}
    },{...signal,passive:false});
    window.addEventListener('keydown',event=>{
      if(event.target.closest('button,input,.email-counter'))return;
      if(['ArrowDown','PageDown',' '].includes(event.key)){event.preventDefault();advance();}
    },signal);
    let touchY=0;
    scene.root.addEventListener('touchstart',event=>{touchY=event.touches[0].clientY;}, {...signal,passive:true});
    scene.root.addEventListener('touchend',event=>{if(touchY-event.changedTouches[0].clientY>45)advance();},{...signal,passive:true});
    scene.advanceDepth=advance;
  }
  function updateDepthScroll(scene,dt) {
    scene.depthAge+=dt;
    const t=scene.motion.matches?1:Math.min(1,scene.depthAge/2.8);
    const eased=t*t*t*(t*(t*6-15)+10);
    scene.depth=scene.depthFrom+(scene.depthStep-scene.depthFrom)*eased;
    const depth=Math.min(1,scene.depth);
    scene.layer.depthProgress=depth;
    scene.layer.travelProgress=scene.finalActive?.14:Math.max(0,Math.min(1,(scene.depth-1)/2));
    scene.ui.style.setProperty('--depth',depth.toFixed(4));
    scene.ui.style.setProperty('--pointer-x',`${scene.layer.pointer.x*4}%`);
    scene.ui.style.setProperty('--pointer-y',`${scene.layer.pointer.y*4}%`);
    scene.ui.style.setProperty('--travel',String(scene.layer.travelProgress));
    const worldProgress=Math.max(0,scene.depth-1);
    const worldFade=Math.min(1,worldProgress);const worldEase=worldFade*worldFade*(3-2*worldFade);
    scene.dataDepthProgress=Math.max(0,Math.min(1,(scene.depth-1)/3));
    const doorProgress=scene.finalActive?0:Math.max(0,Math.min(1,scene.depth-3));
    scene.layer.doorProgress=doorProgress;
    const worldExit=Math.max(0,Math.min(1,scene.depth-2));
    scene.ui.style.setProperty('--world-opacity',String(.44*worldEase*(1-worldExit)*(1-doorProgress)));
    scene.ui.style.setProperty('--world-scale',String(scene.depth<=2?.82+worldEase*.18:1+Math.pow(scene.depth-2,1.55)*6));
    scene.ui.style.setProperty('--door-progress',String(doorProgress));
    scene.root.style.setProperty('--door-progress',String(doorProgress));
    const world=scene.ui.querySelector('.world-message');
    world.setAttribute('aria-hidden',String(scene.depth<=1));
    const cue=scene.ui.querySelector('.scroll-cue');
    cue.textContent='scroll';
    cue.style.visibility=scene.depthStep>=4?'hidden':'visible';
    if(scene.depthStep>=4) updateDoorSequence(scene);
    if(scene.fragments){
      for(const f of scene.fragments){f.element.style.transform=`translate3d(${f.dx*depth}px,${f.dy*depth}px,0) rotate(${f.spin*depth}deg) scale(${1+depth*.7})`;f.element.style.opacity=String(Math.max(0,1-depth*1.25));}
      if(depth>=1){scene.fragments.forEach(f=>f.element.remove());scene.fragments=[];}
    }
  }

  function createDoorAssets(scene) {
    const wrapper=document.createElement('div');wrapper.className='door-asset';wrapper.setAttribute('aria-hidden','true');
    const closed=document.createElement('span'),open=document.createElement('span');
    closed.className='door-state door-closed';open.className='door-state door-open-state';
    wrapper.append(closed,open);(scene.interaction||scene.ui).append(wrapper);
    scene.doorCanvas=wrapper;
  }

  function normalizeSpeech(value){return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\barroba\b/g,'@').replace(/\bpunto\b/g,'.').replace(/\s+/g,'');}

  // Opens the door only after the language layer validates a spoken phrase.
  function triggerDoorOpen(scene, transcript) {
    if(scene.languageDetected)return;
    scene.languageDetected=true;scene.root.classList.add('door-open');
    scene.ui.querySelector('.speech-debug').textContent=transcript;
    scene.recognition?.stop();
    if(scene.interaction&&scene.final)scene.finalTimer=setTimeout(()=>beginFinalTransition(scene),scene.motion.matches?20:1050);
  }

  function beginFinalTransition(scene) {
    if(scene.finalTransitionStarted)return;
    scene.finalTransitionStarted=true;
    scene.root.classList.add('critical-transition');
    scene.interaction.classList.remove('is-active');
    scene.interaction.classList.add('is-leaving');
    scene.finalRevealTimer=setTimeout(()=>activateFinalScene(scene),scene.motion.matches?20:1450);
  }

  function activateFinalScene(scene) {
    if(scene.finalActive)return;
    scene.finalActive=true;
    scene.layer.returnToMesh();
    scene.root.classList.add('final-scene-active');
    scene.interaction.classList.remove('is-leaving');
    scene.interaction.classList.add('is-hidden');
    scene.interaction.setAttribute('aria-hidden','true');
    scene.final.classList.remove('is-hidden');
    scene.final.classList.add('is-entering');
    scene.final.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>{
      scene.final.classList.remove('is-entering');
      scene.final.classList.add('is-active');
    });
  }

  function processRecognizedSpeech(scene, transcript, isFinal) {
    const clean=transcript.trim(),normalized=normalizeSpeech(clean);
    const emailLike=/^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(normalized);
    scene.ui.querySelector('.speech-debug').textContent=clean;
    // Only a completed transcript with an email structure may open the door.
    if(isFinal&&emailLike)triggerDoorOpen(scene,clean);
  }

  function startSpeechRecognition(scene) {
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){scene.speechFallback=true;return;}
    // SpeechRecognition: starts the language detector in Mexican Spanish.
    const recognition=new Recognition();scene.recognition=recognition;
    recognition.lang='es-MX';recognition.continuous=true;recognition.interimResults=true;
    // Speech event: collect both interim and final transcriptions.
    recognition.onresult=event=>{
      let transcript='';let final=false;
      for(let i=event.resultIndex;i<event.results.length;i++){transcript+=event.results[i][0].transcript;final=final||event.results[i].isFinal;}
      // Text processing: require a completed email-shaped phrase before opening.
      processRecognizedSpeech(scene,transcript,final);
    };
    recognition.onend=()=>{if(!scene.destroyed&&!scene.languageDetected)try{recognition.start();}catch(_){}};
    recognition.onerror=event=>{if(event.error==='not-allowed'||event.error==='service-not-allowed')scene.ui.querySelector('.voice-mic').classList.add('is-unavailable');};
    try{recognition.start();}catch(_){}
  }

  async function startVoiceMeter(scene) {
    if(scene.voiceStarted)return;scene.voiceStarted=true;
    const mic=scene.ui.querySelector('.voice-mic');mic.classList.add('is-listening');
    try {
      const stream=scene.root._microphoneStream||await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      scene.root._microphoneStream=stream;scene.voiceStream=stream;
      const AudioEngine=window.AudioContext||window.webkitAudioContext;
      const audio=new AudioEngine(),source=audio.createMediaStreamSource(stream),analyser=audio.createAnalyser();
      analyser.fftSize=512;analyser.smoothingTimeConstant=.76;source.connect(analyser);const data=new Uint8Array(analyser.fftSize);
      scene.audioContext=audio;scene.voiceLevel=0;scene.sustainedVoice=0;startSpeechRecognition(scene);
      // Web Audio API: controls only the microphone glow, never language logic.
      const sample=()=>{
        if(scene.destroyed)return;
        analyser.getByteTimeDomainData(data);let sum=0;for(const value of data){const n=(value-128)/128;sum+=n*n;}
        const raw=Math.sqrt(sum/data.length),target=Math.max(0,Math.min(1,(raw-.012)*13));
        scene.voiceLevel+=(target-scene.voiceLevel)*.16;mic.style.setProperty('--voice',scene.voiceLevel.toFixed(3));
        mic.classList.toggle('is-hearing',scene.voiceLevel>.09);
        scene.sustainedVoice=scene.voiceLevel>.12?scene.sustainedVoice+16.7:Math.max(0,scene.sustainedVoice-28);
        // Audio level drives only the glow. SpeechRecognition exclusively controls the door.
        scene.voiceRaf=requestAnimationFrame(sample);
      };sample();
    } catch (_) { mic.classList.add('is-unavailable'); }
  }

  function updateDoorSequence(scene) {
    if(!scene.doorCanvas)createDoorAssets(scene);
    const elapsed=performance.now()-(scene.doorSince||performance.now());
    if(elapsed>3000)scene.root.classList.add('door-ready');
    if(elapsed>3900)scene.root.classList.add('door-question');
    if(elapsed>6100){scene.root.classList.add('door-instruction');startVoiceMeter(scene);}
  }

  function setupMusicControl(scene) {
    const button=scene.ui.querySelector('.music-control');
    const audio=scene.root._backgroundAudio||new Audio('assets/audio.mp3');
    scene.root._backgroundAudio=audio;scene.audio=audio;audio.loop=true;audio.volume=.34;
    try{
      const saved=JSON.parse(sessionStorage.getItem('mesh-audio-state')||'null');
      if(saved&&Number.isFinite(saved.time)&&audio.currentTime===0)audio.currentTime=saved.time;
    }catch(_){}
    const persist=()=>{try{sessionStorage.setItem('mesh-audio-state',JSON.stringify({time:audio.currentTime,paused:audio.paused,savedAt:Date.now()}));}catch(_){}};
    const sync=()=>{
      const paused=audio.paused;
      button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?'Activar música':'Pausar música');
      button.classList.toggle('is-muted',paused);
    };
    const play=()=>audio.play().then(sync).catch(sync);
    play();
    scene.root.addEventListener('pointerdown',()=>{if(!scene.musicManuallyPaused&&audio.paused)play();},{once:true,signal:scene.events.signal});
    button.addEventListener('click',()=>{
      if(audio.paused){scene.musicManuallyPaused=false;play();}
      else{scene.musicManuallyPaused=true;audio.pause();sync();}
      persist();
    },{signal:scene.events.signal});
    scene.ui.querySelector('.learn-more')?.addEventListener('click',persist,{signal:scene.events.signal});
    window.addEventListener('pagehide',persist,{signal:scene.events.signal});
  }

  function setupReflectionAudio(root){
    const audio=new Audio('assets/audio.mp3');audio.loop=true;audio.volume=.34;root._backgroundAudio=audio;
    let saved=null;
    try{saved=JSON.parse(sessionStorage.getItem('mesh-audio-state')||'null');}catch(_){}
    if(saved&&Number.isFinite(saved.time)){
      const elapsed=saved.paused?0:Math.max(0,(Date.now()-(saved.savedAt||Date.now()))/1000);
      audio.currentTime=Math.max(0,saved.time+elapsed);
    }
    const play=()=>{if(!saved?.paused)audio.play().catch(()=>{});};
    play();root.addEventListener('pointerdown',play,{once:true});
    window.addEventListener('pagehide',()=>{try{sessionStorage.setItem('mesh-audio-state',JSON.stringify({time:audio.currentTime,paused:audio.paused,savedAt:Date.now()}));}catch(_){}});
  }

  function setupCustomCursor(root) {
    if(document.querySelector?.('.custom-cursor')||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
    const cursor=document.createElement('div');cursor.className='custom-cursor';document.body.append(cursor);
    const move=event=>{cursor.style.left=`${event.clientX}px`;cursor.style.top=`${event.clientY}px`;cursor.classList.add('is-visible');};
    window.addEventListener('pointermove',move);
    document.addEventListener('pointerover',event=>cursor.classList.toggle('is-large',Boolean(event.target.closest('button,a,input,[role="button"]'))));
    document.addEventListener('pointerleave',()=>cursor.classList.remove('is-visible'));
  }

  function initializeVisualization(root, layer) {
    if (root.visualization) return root.visualization;
    root.classList.add('inbox-page');
    root.setAttribute('aria-label', 'Bandeja de entrada: visualización global de correos');
    const ui = document.createElement('section');
    ui.className = 'inbox-scene';
    ui.setAttribute('aria-label', 'Visualización global de correos');
    ui.innerHTML = `
      <div class="scene-vignette" aria-hidden="true"></div>
      <div class="critical-vignette" aria-hidden="true"></div>
      <button type="button" class="music-control" aria-label="Pausar música" aria-pressed="false"><span aria-hidden="true"></span></button>
      <div class="interaction-stage experience-scene is-active">
      <div class="ambient-data" aria-hidden="true"></div>
      <svg class="data-network" aria-hidden="true"></svg>
      <div class="secondary-keys" aria-hidden="true"></div>
      <header class="inbox-heading">
        <h1><span class="inbox-title-art" role="img" aria-label="Bandeja de entrada"></span></h1>
        <div class="inbox-nomenclature" aria-label="Nomenclatura">
          <p class="nomenclature-row"><span class="legend-icon live-dot" aria-hidden="true">●</span><span>Nivel global</span></p>
          <p class="nomenclature-row"><span class="legend-icon discover-icon" aria-hidden="true"></span><span>Descubrir dato</span></p>
          <p class="nomenclature-row nomenclature-coral"><span class="legend-icon legend-today" aria-hidden="true"></span><span>Enviados hoy</span></p>
          <p class="nomenclature-row nomenclature-coral"><span class="legend-icon legend-year" aria-hidden="true"></span><span>Enviados este año</span></p>
        </div>
      </header>
      <div class="inbox-top-code"><time class="session-date"></time><span class="session-email"></span></div>
      <div class="world-message" role="img" aria-label="el mundo" aria-hidden="true"></div>
      <div class="door-frame" aria-hidden="true"></div>
      <div class="door-question-art" role="img" aria-label="¿abrirla?"></div>
      <div class="door-instruction-text">Para abrirla pronuncia tu correo electrónico</div>
      <button type="button" class="voice-mic" aria-label="Micrófono escuchando tu voz"><span aria-hidden="true"></span></button>
      <output class="speech-debug" aria-live="polite"></output>
      <button type="button" class="data-node" data-node-period="today" aria-label="Ver correos enviados hoy" aria-expanded="false">
        <span class="node-square" aria-hidden="true"></span><span class="click-tag">CLICK</span>
      </button>
      <button type="button" class="data-node" data-node-period="year" aria-label="Ver correos enviados este año" aria-expanded="false">
        <span class="node-square" aria-hidden="true"></span><span class="click-tag">CLICK</span>
      </button>
      <section class="email-counter" hidden aria-label="Contador de correos simulados">
        <div class="counter-signal" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="counter-toolbar"><button type="button" class="counter-close" aria-label="Cerrar contador">×</button></div>
        <output class="counter-number" aria-live="off"></output>
        <p class="counter-caption">correos enviados hoy</p>
        <p class="counter-source">Worldometer · The Radicati Group</p>
        <span class="counter-icon" aria-hidden="true"></span>
      </section>
      <div class="scroll-cue" aria-hidden="true">scroll</div>
      </div>
      <section class="final-scene experience-scene is-hidden" aria-label="Reflexión final" aria-hidden="true">
        <div class="final-message">
          <p>Abriste la puerta <strong>sin preguntar quién<br>estaba del otro lado.</strong></p>
          <p>¿Cuándo fue <strong>la última vez que cuestionaste<br>al sistema</strong> que te pide hacerlo?</p>
          <a class="learn-more" href="reflexion.html">Conoce más</a>
        </div>
      </section>`;
    root.append(ui);
    const scene = {
      root, layer, ui, width: innerWidth, height: innerHeight,
      motion: matchMedia('(prefers-reduced-motion: reduce)'),
      source: new SimulatedEmailSource(), active: false, period: 'today', elapsed: 0,
      nodeIndex: 3, nodeAge: 0, nodeWait: 8.2, nextText: 0,
      events: new AbortController(), characters: [], keys: [], connections: [], last: null,
      counter: ui.querySelector('.email-counter'), node: ui.querySelector('.data-node'),
      interaction:ui.querySelector('.interaction-stage'), final:ui.querySelector('.final-scene')
    };
    scene.clickAudio=new Audio('assets/al-click.mp3');
    scene.clickAudio.preload='auto';scene.clickAudio.volume=.55;
    scene.nodes = Array.from(ui.querySelectorAll('.data-node'), (element, i) => ({
      element, index: i ? 6 : 3, period: element.dataset.nodePeriod, age: i ? -0.5 : 0, wait: 3.7 + Math.random()
    }));
    scene.email=root.dataset.email || 'tu correo';
    if(scene.email==='tu correo')try{scene.email=sessionStorage.getItem('mesh-display-email')||scene.email;}catch(_){}
    scene.ui.querySelector('.session-email').setAttribute('aria-label',scene.email);
    root.visualization = scene;
    const signal = { signal: scene.events.signal };
    window.addEventListener('pagehide',()=>{
      scene.destroyed=true;
      if(scene.voiceRaf)cancelAnimationFrame(scene.voiceRaf);
      try{scene.recognition?.stop();}catch(_){}
      scene.audioContext?.close();
      scene.voiceStream?.getTracks().forEach(track=>track.stop());
      clearTimeout(scene.finalTimer);clearTimeout(scene.finalRevealTimer);
    },signal);
    const labels = ['&?/\\[]{}ÅÄÉØ^*', '[]{}ÅÄÉ', '8RG0@#&?/\\', '&?/*', '@#&?/\\', '[]{}ÅÄÉØ^+*W'];
    const locations = [[.29,.15],[.47,.18],[.31,.27],[.53,.32],[.27,.43],[.48,.62],[.68,.65],[.18,.70],[.35,.78],[.66,.80],[.82,.76],[.84,.46],[.09,.83],[.18,.91],[.91,.88],[.62,.13],[.34,.34],[.63,.26],[.12,.60],[.75,.70],[.28,.86],[.84,.91],[.46,.10],[.91,.65]];
    for (let i = 0; i < locations.length; i++) {
      const element = document.createElement('span');
      element.textContent = labels[i % labels.length];
      element.style.left = `${locations[i][0]*100}%`; element.style.top = `${locations[i][1]*100}%`;
      ui.querySelector('.ambient-data').append(element);
      scene.characters.push({ element, cursor:0, numeric:i%5===0, value:Math.floor(Math.random()*10000000), next:Math.random()*400, interval:[90,160,260,450][i%4] });
    }
    setupDepthScroll(scene);
    setupMusicControl(scene);
    setupCustomCursor(root);
    createDynamicConnections(scene);
    createClickInteraction(scene);
    updateKeyCharacters(scene);
    const resize = () => {
      const bounds = ui.getBoundingClientRect(); scene.width = bounds.width; scene.height = bounds.height;
      scene.anchors = scene.width < 650
        ? [[.12,.36],[.84,.30],[.16,.72],[.80,.66],[.54,.84],[.90,.48],[.40,.26]]
        : [[.32,.19],[.73,.14],[.72,.86],[.80,.61],[.48,.76],[.85,.28],[.16,.58]];
      scene.connections.forEach(connection => positionConnection(scene, connection));
      placeNode(scene); positionCounter(scene);
    };
    scene.resizeObserver = new ResizeObserver(resize); scene.resizeObserver.observe(ui); resize();
    const frame = now => {
      const dt = scene.last === null ? 0 : Math.min((now-scene.last)/1000, .05); scene.last = now;
      if (!document.hidden) {
        scene.elapsed += dt;
        updateDepthScroll(scene,dt);
        updateIdentity(scene,now);
        layer.sceneMix = scene.motion.matches ? 1 : Math.min(1, scene.elapsed/3.5);
        if (!scene.motion.matches) {
          updateCharacterBlocks(scene, now);
          updateAmbientPresence(scene,now,dt);
          animateDataPoints(scene, dt);
          for (const key of scene.keys) if (scene.depthStep===0 && now > key.next) { key.mutate(); key.next = now + 90 + Math.random()*160; }
        }
        for (const node of scene.nodes) {
          if (!scene.motion.matches) {
            node.age += dt;
            if (!scene.active && !node.element.contains(document.activeElement) && node.age > node.wait) {
              node.age = 0; node.wait = 3.6 + Math.random()*1.25;
              node.element.classList.remove('is-visible');
              const candidates = scene.anchors.map((_,i)=>i).filter(i=>!scene.nodes.some(other=>other!==node&&other.index===i));
              node.index = candidates[Math.floor(Math.random()*candidates.length)];
              placeNode(scene);
            }
          }
          if (scene.motion.matches || scene.elapsed > 4.8 && node.age > 1.15) node.element.classList.add('is-visible');
        }
        // Keep one discoverable interaction on screen even while the other node relocates.
        if (scene.elapsed > 4.8 && !scene.nodes.some(node=>node.element.classList.contains('is-visible')))
          scene.nodes[0].element.classList.add('is-visible');
        if (scene.active && now > (scene.nextCounter || 0)) {
          startEmailCounter(scene); scene.nextCounter = now + 100;
        }
      }
      scene.raf = requestAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange', () => { scene.last = null; }, signal);
    scene.motion.addEventListener('change', () => {
      scene.nodes.forEach(node => node.element.classList.add('is-visible'));
      if (scene.motion.matches) { layer.sceneMix = 1; animateDataPoints(scene, 0); }
    }, signal);
    scene.raf = requestAnimationFrame(frame);
    scene.destroy = () => { cancelAnimationFrame(scene.raf); scene.events.abort(); scene.resizeObserver.disconnect(); ui.remove(); root.visualization = null; };
    return scene;
  }

  function updateCharacterBlocks(scene, now) {
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÉØ@#&?/\\[]{}*';
    for (const block of scene.characters) if (now > block.next) {
      const text = Array.from(block.element.textContent);
      if (block.numeric) {
        block.value += Math.floor(100 + Math.random()*900)*(scene.active?2:1);
        block.element.textContent = String(block.value).padStart(10,'0');
      } else {
        for (let i=0;i<Math.min(text.length,3);i++) {
          const index = block.cursor++ % text.length;
          const old = alphabet.indexOf(text[index]);
          text[index] = alphabet[(Math.max(0,old)+1+Math.floor(Math.random()*(alphabet.length-1)))%alphabet.length];
        }
        block.element.textContent = text.join('');
      }
      block.next = now + block.interval*(.65+Math.random()*.7)*(scene.active?.7:1);
    }
  }

  async function updateKeyCharacters(scene) {
    // Preserve the supplied vector asset and its proportions. Rasterize it once
    // in a local canvas, locate individual connected glyphs, and mutate a few only.
    const image = new Image(); image.src = 'assets/llave-dos.svg';
    try { await image.decode(); } catch (_) { return; }
    if (!scene.ui.isConnected) return;
    const width=943, height=402, source=document.createElement('canvas');
    source.width=width;source.height=height;
    const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,width,height);
    const boxes=[];
    try {
      const data=ctx.getImageData(0,0,width,height).data, seen=new Uint8Array(width*height), queue=new Int32Array(width*height);
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const id=y*width+x;if(seen[id]||data[id*4+3]<100)continue;
        let head=0,tail=1,minX=x,maxX=x,minY=y,maxY=y;queue[0]=id;seen[id]=1;
        while(head<tail){const at=queue[head++],xx=at%width,yy=Math.floor(at/width);
          minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);minY=Math.min(minY,yy);maxY=Math.max(maxY,yy);
          for(const next of [xx>0?at-1:-1,xx<width-1?at+1:-1,yy>0?at-width:-1,yy<height-1?at+width:-1])
            if(next>=0&&!seen[next]&&data[next*4+3]>=100){seen[next]=1;queue[tail++]=next;}
        }
        if(maxY-minY>=13&&maxY-minY<33&&maxX-minX>=6&&maxX-minX<28&&tail>30)
          boxes.push({x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1});
      }
    } catch (_) { /* file:// may block pixel reads; the supplied asset still displays. */ }
    for(let index=0;index<4;index++){
      const wrapper=document.createElement('div');wrapper.className=`secondary-key secondary-key-${index}`;
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;wrapper.append(canvas);
      scene.ui.querySelector('.secondary-keys').append(wrapper);
      const context=canvas.getContext('2d');context.drawImage(source,0,0);
      const glyphs='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz@#&?/\\[]{}ÅÄÉØ*';
      const order=boxes.map((_,i)=>i);
      for(let j=order.length-1;j>0;j--){const k=Math.floor(Math.random()*(j+1));[order[j],order[k]]=[order[k],order[j]];}
      let cursor=0;
      const color=getComputedStyle(scene.root).getPropertyValue('--color-primary-text').trim();
      const key={canvas,wrapper,next:performance.now()+index*90,mutate(){
        // Visit every glyph within 20 updates (at most 5s), in shuffled order.
        if(!boxes.length)return;
        for(let n=0;n<Math.max(6,Math.ceil(boxes.length/20));n++){
          const box=boxes[order[cursor++%order.length]];
          context.clearRect(box.x-1,box.y-1,box.w+2,box.h+2);
          context.fillStyle=color;
          context.font=`${box.h*1.18}px "Roboto Mono", monospace`;
          context.textBaseline='top';context.fillText(glyphs[Math.floor(Math.random()*glyphs.length)],box.x,box.y-2,box.w);
        }
      }};scene.keys.push(key);
    }
  }

  function createDynamicConnections(scene) {
    const svg=scene.ui.querySelector('.data-network'), ns='http://www.w3.org/2000/svg';
    for(let i=0;i<5;i++){
      const line=document.createElementNS(ns,'line');line.setAttribute('stroke-dasharray','4 6');svg.append(line);
      const dots=Array.from({length:3},(_,j)=>{const dot=document.createElementNS(ns,'circle');dot.setAttribute('r',String(j?3.5:5));svg.append(dot);return {element:dot,phase:Math.random(),speed:.32+Math.random()*.23};});
      scene.connections.push({line,dots,a:i,b:(i+2)%7,age:i*.8,life:2.2+Math.random()*2});
    }
  }
  function positionConnection(scene,c){
    if(!scene.anchors)return;
    const a=scene.anchors[c.a],b=scene.anchors[c.b];c.x1=a[0]*scene.width;c.y1=a[1]*scene.height;c.x2=b[0]*scene.width;c.y2=b[1]*scene.height;
    for(const k of ['x1','x2','y1','y2'])c.line.setAttribute(k,c[k]);
  }
  function animateDataPoints(scene,dt){
    for(const c of scene.connections){
      c.age+=dt;
      if(c.age>c.life){c.age=0;c.life=2.2+Math.random()*2;c.a=Math.floor(Math.random()*scene.anchors.length);c.b=(c.a+1+Math.floor(Math.random()*5))%scene.anchors.length;positionConnection(scene,c);}
      const alpha=scene.motion.matches?.6:Math.min(1,c.age/.7,(c.life-c.age)/.7)*.65;
      c.line.style.opacity=alpha;
      for(const dot of c.dots){dot.phase=(dot.phase+dt*dot.speed*(scene.active?1.3:1))%1;
        dot.element.setAttribute('cx',c.x1+(c.x2-c.x1)*dot.phase);dot.element.setAttribute('cy',c.y1+(c.y2-c.y1)*dot.phase);dot.element.style.opacity=alpha;}
    }
  }
  function placeNode(scene){
    if(!scene.anchors)return;
    scene.nodes.forEach((node,i)=>{
      const p=scene.anchors[node.index];node.element.style.left=`${p[0]*100}%`;node.element.style.top=`${p[1]*100}%`;
      const c=scene.connections[i];c.b=node.index;if(c.a===c.b)c.a=(c.b+2)%scene.anchors.length;positionConnection(scene,c);
    });
  }
  function createClickInteraction(scene){
    const signal={signal:scene.events.signal};
    scene.nodes.forEach(node=>node.element.addEventListener('click',()=>{
      scene.root.scrollTop=0;
      node.element.focus({preventScroll:true});
      scene.clickAudio.currentTime=0;
      scene.clickAudio.play().catch(()=>{});
      scene.active=true;scene.period=node.period;scene.node=node.element;scene.nodeIndex=node.index;
      scene.counter.hidden=false;
      scene.counter.dataset.period=scene.period;
      scene.ui.classList.add('counter-open');
      scene.nodes.forEach(other=>other.element.setAttribute('aria-expanded',String(other===node)));
      scene.ui.querySelectorAll('[data-period]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.period===scene.period)));
      startEmailCounter(scene);positionCounter(scene);
    },signal));
    scene.ui.querySelector('.counter-close').addEventListener('click',()=>{
      scene.root.scrollTop=0;
      scene.active=false;scene.counter.hidden=true;
      scene.ui.classList.remove('counter-open');
      scene.nodes.forEach(node=>{node.element.setAttribute('aria-expanded','false');node.age=2;});scene.node.focus({preventScroll:true});
    },signal);
    scene.ui.querySelectorAll('[data-period]').forEach(button=>button.addEventListener('click',()=>{
      scene.period=button.dataset.period;
      scene.ui.querySelectorAll('[data-period]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
      startEmailCounter(scene);
    },signal));
    scene.ui.addEventListener('keydown',event=>{if(event.key==='Escape'&&scene.active)scene.ui.querySelector('.counter-close').click();},signal);
  }
  function positionCounter(scene){
    if(!scene.active)return;const p=scene.anchors[scene.nodeIndex];
    const w=scene.counter.offsetWidth,h=scene.counter.offsetHeight;
    let left=clamp(p[0]*scene.width-w/2,12,Math.max(12,scene.width-w-12));
    let top=clamp(p[1]*scene.height-h-18,72,Math.max(72,scene.height-h-20));
    const header=scene.ui.querySelector('.inbox-heading').getBoundingClientRect();
    const bounds=scene.ui.getBoundingClientRect();
    const headerRight=header.right-bounds.left+18,headerBottom=header.bottom-bounds.top+18;
    if(left<headerRight&&left+w>header.left-bounds.left&&top<headerBottom&&top+h>header.top-bounds.top){
      if(headerRight+w<=scene.width-12)left=headerRight;else top=headerBottom;
    }
    scene.counter.style.left=`${left}px`;scene.counter.style.top=`${top}px`;
  }
  function startEmailCounter(scene){
    const values=scene.source.sample();
    scene.counter.dataset.period=scene.period;
    scene.ui.querySelector('.counter-number').textContent=new Intl.NumberFormat('es-MX').format(values[scene.period]);
    scene.ui.querySelector('.counter-caption').textContent=scene.period==='today'?'correos enviados hoy':'correos enviados este año';
  }

  function transitionFromPreviousScreen(root,layer){
    root.querySelector('.welcome')?.remove();root.querySelector('.code-decoration')?.remove();
    root.classList.remove('is-leaving');root.classList.add('interaction-page');root.dataset.page='interaction';
    root.setAttribute('aria-label','Visualización de correos');root.setAttribute('tabindex','-1');root.focus({preventScroll:true});
    layer.onMorphComplete=()=>initializeVisualization(root,layer);
    layer.beginKeyMorph();
  }

  // ACCESS FLOW: local prototype gate, not server-side identity verification.
  // Email is kept only in this tab session for the requested header; no audio is stored or sent.
  const ACCESS_KEY = 'mesh-entry-v1';
  function emailFeedback(value) {
    if (!value.trim()) return 'Escribe tu correo electrónico para continuar.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Revisa tu correo: debe tener un formato como nombre@dominio.com.';
    return '';
  }
  function microphoneFeedback(error) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      return 'Necesitamos tu permiso de micrófono. Habilítalo en los permisos de este sitio y vuelve a pulsar continuar.';
    if (error.name === 'NotFoundError') return 'No encontramos un micrófono. Conecta uno y vuelve a intentarlo.';
    if (error.name === 'NotReadableError') return 'No pudimos abrir el micrófono. Revisa si otra aplicación lo está usando e inténtalo de nuevo.';
    return 'No se pudo acceder al micrófono. Revisa sus permisos y vuelve a intentarlo.';
  }
  function readTicket() {
    let ticket;
    try { ticket = JSON.parse(sessionStorage.getItem(ACCESS_KEY)); } catch (_) {}
    // file:// storage varies between browsers; a fragment is a local-only fallback.
    if (!ticket && location.hash.startsWith('#entry=')) {
      try { ticket = JSON.parse(decodeURIComponent(location.hash.slice(7))); } catch (_) {}
    }
    if (!ticket || ticket.allowed !== true || !Number.isFinite(ticket.created)
      || Date.now() - ticket.created > 15 * 60 * 1000 || ticket.created > Date.now() + 1000) return null;
    return ticket;
  }
  window.MeshEntry = { emailFeedback, microphoneFeedback };
  window.EmailVisualization = { SimulatedEmailSource, initializeVisualization };
  window.VoiceDoor = { normalizeSpeech, processRecognizedSpeech };

  const root = document.getElementById('mesh-demo');
  if (!root) return;
  const interaction = root.dataset.page === 'interaction';
  const reflection = root.dataset.page === 'reflection';
  const preview = root.dataset.preview === 'true' || (['127.0.0.1','localhost'].includes(location.hostname) && new URLSearchParams(location.search).get('preview') === '1');
  if(preview)root.dataset.preview='true';
  setupCustomCursor(root);
  const ticket = interaction && !preview ? readTicket() : null;
  if (interaction && !preview && !ticket) {
    location.replace('index.html');
    return;
  }
  const palette = getComputedStyle(root);
  const layer = new MeshLayer(root.querySelector('.mesh-layer'), {
    background: palette.getPropertyValue('--color-background').trim() || DEFAULTS.background,
    color: palette.getPropertyValue('--color-mesh').trim() || DEFAULTS.color,
    opacity: Number.parseFloat(palette.getPropertyValue('--mesh-opacity')) || DEFAULTS.opacity,
    phase: ticket && Number.isFinite(ticket.phase) ? ticket.phase : 0
  });
  root.meshLayer = layer;
  if(reflection){
    root.classList.add('reflection-page');
    setupReflectionAudio(root);
    const exitButton=root.querySelector('.reflection-exit');
    const exitSound=new Audio('assets/al-click.mp3');
    exitSound.preload='auto';exitSound.volume=.55;
    exitButton?.addEventListener('click',()=>{
      try{exitSound.currentTime=0;void exitSound.play();}catch(_){}
      root.classList.add('reflection-leaving');
      window.setTimeout(()=>{
        const previous=document.referrer ? new URL(document.referrer,location.href) : null;
        if(previous&&previous.origin===location.origin&&history.length>1)history.back();
        else location.href='index.html#interaccion';
      },matchMedia('(prefers-reduced-motion: reduce)').matches?0:260);
    });
    return;
  }
  if (interaction) {
    if (ticket) {
      layer.camera.x = clamp(Number(ticket.cameraX) || 0, -3.3, 3.3);
      layer.camera.y = clamp(Number(ticket.cameraY) || 0, -2.25, 2.25);
      if (ticket.hover) {
        layer.hover.x = clamp(Number(ticket.hover.x) || 0, -20, 20);
        layer.hover.y = clamp(Number(ticket.hover.y) || 0, -20, 20);
        layer.hover.strength = clamp(Number(ticket.hover.strength) || 0, 0, 1.5);
      }
      try { sessionStorage.setItem(ACCESS_KEY, JSON.stringify(ticket)); } catch (_) {}
      try { history.replaceState(null, '', 'interaccion.html'); } catch (_) {}
    }
    layer.onMorphComplete = () => {
      const scene=initializeVisualization(root, layer);
      // Local preview shortcut: shows the post-voice scene without changing the real microphone flow.
      if(preview&&new URLSearchParams(location.search).get('scene')==='final')
        window.setTimeout(()=>triggerDoorOpen(scene,'Vista previa'),420);
    };
    layer.beginKeyMorph();
    return;
  }

  const codes = root.querySelectorAll('[data-random-code]');
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#&?/\\';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let codeTimer;
  const tick = () => codes.forEach(code => {
    code.textContent = Array.from(code.textContent, character => Math.random() < 0.45
      ? alphabet[Math.floor(Math.random() * alphabet.length)] : character).join('');
  });
  const schedule = () => {
    clearInterval(codeTimer);
    if (root.dataset.page !== 'interaction' && !reducedMotion.matches && !document.hidden) codeTimer = setInterval(tick, 180);
  };
  reducedMotion.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', schedule);
  schedule();

  const form = root.querySelector('.access-form');
  const email = form.querySelector('[name="email"]');
  const button = form.querySelector('button[type="submit"]');
  const feedback = form.querySelector('.access-feedback');
  let busy = false;
  const showFeedback = (message, invalid = false) => {
    feedback.textContent = message;
    email.setAttribute('aria-invalid', String(invalid));
    root.classList.add('has-feedback');
  };
  email.addEventListener('input', () => {
    email.removeAttribute('aria-invalid');
    if (!busy) feedback.textContent = '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const validation = emailFeedback(email.value);
    if (validation) { showFeedback(validation, true); email.focus(); return; }
    if (!preview && (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)) {
      showFeedback('El navegador necesita un contexto seguro para el micrófono. Abre este prototipo en localhost o HTTPS.');
      return;
    }
    busy = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    if (!preview) showFeedback('Permite el micrófono en el aviso del navegador para continuar.');
    try {
      if (!preview) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        // Reuse this authorized stream later; the complete experience stays in this document.
        root._microphoneStream=stream;
      }
      feedback.textContent = '';
      clearInterval(codeTimer);
      root.classList.add('is-leaving');
      await new Promise(resolve => setTimeout(resolve, reducedMotion.matches ? 0 : 1000));
      root.dataset.email=email.value.trim();
      try { sessionStorage.setItem('mesh-display-email',root.dataset.email); } catch (_) {}
      const transition = { allowed: true, created: Date.now(), phase: layer.phase,
        cameraX: layer.camera.x, cameraY: layer.camera.y,
        hover: { ...layer.hover } };
      try { sessionStorage.setItem(ACCESS_KEY, JSON.stringify(transition)); } catch (_) {}
      // Keep the same canvas and key across screens: no document reload.
      try { history.pushState({ scene: 'interaction' }, '', preview ? 'index.html?preview=1#interaccion' : 'index.html#interaccion'); } catch (_) {}
      transitionFromPreviousScreen(root, layer);
    } catch (error) {
      root.classList.remove('is-leaving');
      showFeedback(microphoneFeedback(error));
      busy = false; button.disabled = false;
      form.removeAttribute('aria-busy');
      schedule();
    }
  });
  window.addEventListener('popstate', () => { if (!location.hash.includes('interaccion')) location.reload(); });
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    root.classList.remove('is-leaving');
    busy = false; button.disabled = false; form.removeAttribute('aria-busy');
    feedback.textContent = ''; schedule();
  });
  window.addEventListener('pagehide',()=>{
    root._microphoneStream?.getTracks().forEach(track=>track.stop());
  });

})();
