/* ============================
   RESPONSIVE SPUTNIKA CLONE
   ============================ */

const {
  Engine, Render, World, Bodies, Body, Events, Vector
} = Matter;

/* ---------- Responsive Size ---------- */
function getGameSize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = 9 / 16;

  if (w / h > aspect) {
    return { width: h * aspect, height: h };
  } else {
    return { width: w, height: w / aspect };
  }
}

let { width, height } = getGameSize();

/* ---------- Engine ---------- */
const engine = Engine.create();
engine.gravity.y = 0;

/* ---------- Renderer ---------- */
const render = Render.create({
  element: document.body,
  engine,
  options: {
    width,
    height,
    background: "#0b0f1a",
    wireframes: false,
    pixelRatio: window.devicePixelRatio
  }
});

Engine.run(engine);
Render.run(render);

/* ---------- Resize Handler ---------- */
window.addEventListener("resize", () => {
  ({ width, height } = getGameSize());

  render.canvas.width = width;
  render.canvas.height = height;
  render.options.width = width;
  render.options.height = height;

  CENTER.x = width / 2;
  CENTER.y = height * 0.6;

  Body.setPosition(bubble, CENTER);
});

/* ---------- Planet Definitions ---------- */
const PLANETS = [
  { r: 10, c: "#6ee7ff" },
  { r: 14, c: "#60a5fa" },
  { r: 18, c: "#818cf8" },
  { r: 22, c: "#a78bfa" },
  { r: 26, c: "#f472b6" },
  { r: 30, c: "#fb7185" },
  { r: 36, c: "#fbbf24" },
  { r: 44, c: "#f59e0b" },
  { r: 52, c: "#ef4444" },
  { r: 60, c: "#fde047" } // Sun
];

/* ---------- Bubble ---------- */
const CENTER = { x: width / 2, y: height * 0.6 };
let BUBBLE_RADIUS = Math.min(width, height) * 0.42;

const bubble = Bodies.circle(
  CENTER.x,
  CENTER.y,
  BUBBLE_RADIUS,
  {
    isStatic: true,
    render: {
      fillStyle: "transparent",
      strokeStyle: "#334155",
      lineWidth: 3
    }
  }
);

World.add(engine.world, bubble);

/* ---------- Planet Creation ---------- */
function createPlanet(level, x, y) {
  const p = PLANETS[level];
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

/* ---------- Spawn & Queue ---------- */
let currentPlanet = null;

function spawnPlanet() {
  currentPlanet = createPlanet(0, CENTER.x, height * 0.12);
  Body.setStatic(currentPlanet, true);
  World.add(engine.world, currentPlanet);
}

spawnPlanet();

/* ---------- Input (Mouse + Touch) ---------- */
function launch(x, y) {
  if (!currentPlanet) return;

  const dir = Vector.normalise(
    Vector.sub(currentPlanet.position, { x, y })
  );

  Body.setStatic(currentPlanet, false);
  Body.applyForce(
    currentPlanet,
    currentPlanet.position,
    Vector.mult(dir, 0.03)
  );

  currentPlanet = null;
  setTimeout(spawnPlanet, 700);
}

render.canvas.addEventListener("mousedown", e => {
  launch(e.offsetX, e.offsetY);
});

render.canvas.addEventListener("touchstart", e => {
  const t = e.touches[0];
  const r = render.canvas.getBoundingClientRect();
  launch(t.clientX - r.left, t.clientY - r.top);
});

/* ---------- Merge Logic ---------- */
Events.on(engine, "collisionStart", e => {
  e.pairs.forEach(p => {
    const a = p.bodyA;
    const b = p.bodyB;

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

/* ---------- Cosmic Gravity ---------- */
Events.on(engine, "beforeUpdate", () => {
  const bodies = engine.world.bodies.filter(b => b.label === "planet");

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];

      const d = Vector.sub(b.position, a.position);
      const dist = Vector.magnitude(d) || 1;
      const f = 0.000001 * a.mass * b.mass;

      const force = Vector.mult(Vector.normalise(d), f);
      Body.applyForce(a, a.position, force);
      Body.applyForce(b, b.position, Vector.neg(force));
    }
  }
});

/* ---------- Game Over Logic ---------- */
const outside = new Map();

Events.on(engine, "afterUpdate", () => {
  engine.world.bodies.forEach(b => {
    if (b.label !== "planet") return;

    const dist = Vector.magnitude(Vector.sub(b.position, CENTER));

    if (dist > BUBBLE_RADIUS) {
      outside.set(b, (outside.get(b) || 0) + 1);
      if (outside.get(b) > 60) {
        alert("Game Over");
        location.reload();
      }
    } else {
      outside.delete(b);
    }
  });
});
