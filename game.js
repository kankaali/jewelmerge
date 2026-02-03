/* ============================
   FULL RESPONSIVE SPUTNIKA GAME
   ============================ */

const { Engine, Render, Runner, World, Bodies, Body, Events, Vector } = Matter;

/* ---------- GAME STATE ---------- */
let engine, render, runner;
let currentPlanet = null;
let canDrop = true;
let isAiming = false;
let aim = { x: 0, y: 0 };

let WIDTH, HEIGHT;
let SPAWN, CENTER, BUBBLE_RADIUS;
let walls = {};
const MAX_STRETCH = 160;
const MAX_SPEED = 10;

/* ---------- PLANETS ---------- */
const PLANETS = [
  { r: 14, c: "#94a3b8" },
  { r: 18, c: "#38bdf8" },
  { r: 22, c: "#22c55e" },
  { r: 28, c: "#f59e0b" },
  { r: 36, c: "#fbbf24" },
  { r: 44, c: "#f59e0b" },
  { r: 52, c: "#ef4444" },
  { r: 60, c: "#fde047" } // Sun
];

/* ---------- INIT GAME ---------- */
function init() {
  const container = document.getElementById("game");
  WIDTH = container.clientWidth;
  HEIGHT = container.clientHeight;

  SPAWN = { x: WIDTH / 2, y: Math.max(80, HEIGHT * 0.12) };
  CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
  BUBBLE_RADIUS = Math.min(WIDTH, HEIGHT) * 0.42;

  engine = Engine.create();
  engine.world.gravity.y = 0;

  render = Render.create({
    element: container,
    engine,
    options: {
      width: WIDTH,
      height: HEIGHT,
      background: "#0b0f1a",
      wireframes: false,
      pixelRatio: window.devicePixelRatio
    }
  });

  runner = Runner.create();
  Runner.run(runner, engine);
  Render.run(render);

  createWalls();
  spawnPlanet();
  bindInput();
}

/* ---------- CREATE WALLS / BUBBLE ---------- */
function createWalls() {
  const t = 60;
  walls.ground = Bodies.rectangle(WIDTH / 2, HEIGHT + t / 2, WIDTH, t, { isStatic: true });
  walls.left = Bodies.rectangle(-t / 2, HEIGHT / 2, t, HEIGHT, { isStatic: true });
  walls.right = Bodies.rectangle(WIDTH + t / 2, HEIGHT / 2, t, HEIGHT, { isStatic: true });

  World.add(engine.world, Object.values(walls));

  // Draw circular bubble for reference (invisible physical boundaries)
  const bubble = Bodies.circle(
    WIDTH / 2,
    HEIGHT / 2,
    BUBBLE_RADIUS,
    { isStatic: true, render: { fillStyle: "transparent", strokeStyle: "#334155", lineWidth: 3 } }
  );
  World.add(engine.world, bubble);
}

/* ---------- CREATE PLANET ---------- */
function createPlanet(level, x = SPAWN.x, y = SPAWN.y) {
  const p = PLANETS[level % PLANETS.length];
  const scale = BUBBLE_RADIUS / 180;
  return Bodies.circle(x, y, p.r * scale, {
    restitution: 0.6,
    friction: 0.1,
    density: 0.002 * (level + 1),
    label: "planet",
    planetLevel: level,
    render: { fillStyle: p.c }
  });
}

/* ---------- SPAWN PLANET ---------- */
function spawnPlanet() {
  const level = 0; // start from smallest
  currentPlanet = createPlanet(level, SPAWN.x, SPAWN.y);
  Body.setStatic(currentPlanet, true);
  World.add(engine.world, currentPlanet);
  canDrop = true;
}

/* ---------- INPUT ---------- */
function getPointer(e) {
  const rect = render.canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function bindInput() {
  render.canvas.addEventListener("pointerdown", e => {
    if (!currentPlanet || !canDrop) return;
    isAiming = true;
    aim = getPointer(e);
  });

  render.canvas.addEventListener("pointermove", e => {
    if (isAiming) aim = getPointer(e);
  });

  window.addEventListener("pointerup", () => {
    if (!isAiming || !currentPlanet) return;

    let dx = SPAWN.x - aim.x;
    let dy = SPAWN.y - aim.y;

    const len = Math.min(Math.hypot(dx, dy), MAX_STRETCH);
    const speed = (len / MAX_STRETCH) * MAX_SPEED;
    const nx = dx / (len || 1);
    const ny = dy / (len || 1);

    Body.setStatic(currentPlanet, false);
    Body.setVelocity(currentPlanet, { x: nx * speed, y: ny * speed });

    currentPlanet = null;
    isAiming = false;
    canDrop = false;

    setTimeout(spawnPlanet, 700);
  });

  Events.on(render, "afterRender", drawTrajectory);
}

/* ---------- TRAJECTORY ---------- */
function drawTrajectory() {
  if (!isAiming || !currentPlanet) return;

  const ctx = render.context;
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(SPAWN.x, SPAWN.y);

  let dx = SPAWN.x - aim.x;
  let dy = SPAWN.y - aim.y;
  let len = Math.min(Math.hypot(dx, dy), MAX_STRETCH);
  let vx = (dx / len) * ((len / MAX_STRETCH) * MAX_SPEED);
  let vy = (dy / len) * ((len / MAX_STRETCH) * MAX_SPEED);

  let x = SPAWN.x, y = SPAWN.y;
  for (let i = 0; i < 25; i++) {
    x += vx * 3;
    y += vy * 3;
    if (x < 20 || x > WIDTH - 20) vx *= -1;
    ctx.lineTo(x, y);
  }

  ctx.stroke();
  ctx.setLineDash([]);
}

/* ---------- COSMIC GRAVITY ---------- */
Events.on(engine, "beforeUpdate", () => {
  const bodies = engine.world.bodies.filter(b => b.label === "planet");
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      const d = Vector.sub(b.position, a.position);
      const dist = Vector.magnitude(d) || 1;
      const f = 0.000001 * a.mass * b.mass;
      const force = Vector.mult(Vector.normalise(d), f);
      Body.applyForce(a, a.position, force);
      Body.applyForce(b, b.position, Vector.neg(force));
    }
  }
});

/* ---------- MERGE LOGIC ---------- */
Events.on(engine, "collisionStart", e => {
  e.pairs.forEach(p => {
    const a = p.bodyA, b = p.bodyB;
    if (
      a.label === "planet" &&
      b.label === "planet" &&
      a.planetLevel === b.planetLevel &&
      a.planetLevel < PLANETS.length - 1
    ) {
      const level = a.planetLevel + 1;
      const pos = Vector.div(Vector.add(a.position, b.position), 2);
      World.remove(engine.world, a);
      World.remove(engine.world, b);
      World.add(engine.world, createPlanet(level, pos.x, pos.y));
    }
  });
});

/* ---------- GAME OVER ---------- */
const outsideTimers = new Map();
Events.on(engine, "afterUpdate", () => {
  engine.world.bodies.forEach(b => {
    if (b.label !== "planet" || b.isStatic) return;
    const dist = Vector.magnitude(Vector.sub(b.position, CENTER));
    const allowed = BUBBLE_RADIUS - (b.circleRadius || 0);
    if (dist > allowed) {
      outsideTimers.set(b, (outsideTimers.get(b) || 0) + 1);
      if (outsideTimers.get(b) > 60) {
        alert("Game Over");
        location.reload();
      }
    } else {
      outsideTimers.delete(b);
    }
  });
});

/* ---------- RESIZE ---------- */
window.addEventListener("resize", () => {
  const container = document.getElementById("game");
  WIDTH = container.clientWidth;
  HEIGHT = container.clientHeight;
  SPAWN = { x: WIDTH / 2, y: Math.max(80, HEIGHT * 0.12) };
  CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
  BUBBLE_RADIUS = Math.min(WIDTH, HEIGHT) * 0.42;

  Render.stop(render);
  render.canvas.remove();
  World.clear(engine.world);
  Engine.clear(engine);

  init();
});

/* ---------- START GAME ---------- */
init();
