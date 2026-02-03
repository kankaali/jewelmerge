/* ===============================
   SPUTNIKA STYLE MERGE GAME
   FULLY RESPONSIVE – STABLE
   =============================== */

const {
  Engine, Render, World, Bodies, Body, Events, Vector
} = Matter;

/* ---------- Screen Size ---------- */
const SCREEN = {
  w: Math.min(window.innerWidth, 480),
  h: window.innerHeight
};

/* ---------- Engine ---------- */
const engine = Engine.create();
engine.gravity.y = 0;

/* ---------- Renderer ---------- */
const render = Render.create({
  element: document.body,
  engine,
  options: {
    width: SCREEN.w,
    height: SCREEN.h,
    wireframes: false,
    background: "#0b0f1a",
    pixelRatio: window.devicePixelRatio
  }
});

Engine.run(engine);
Render.run(render);

/* ---------- Play Area ---------- */
const CENTER = {
  x: SCREEN.w / 2,
  y: SCREEN.h * 0.6
};

const BUBBLE_RADIUS = Math.min(SCREEN.w, SCREEN.h) * 0.42;

/* ---------- Bubble Wall ---------- */
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

/* ---------- Planet Data ---------- */
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

/* ---------- Create Planet ---------- */
function createPlanet(level, x, y) {
  const scale = BUBBLE_RADIUS / 180;
  return Bodies.circle(x, y, PLANETS[level].r * scale, {
    label: "planet",
    planetLevel: level,
    restitution: 0.6,
    friction: 0.1,
    density: 0.0015 * (level + 1),
    render: { fillStyle: PLANETS[level].c }
  });
}

/* ---------- Spawning ---------- */
let heldPlanet = null;

function spawnPlanet() {
  heldPlanet = createPlanet(
    0,
    CENTER.x,
    CENTER.y - BUBBLE_RADIUS - 30
  );
  Body.setStatic(heldPlanet, true);
  World.add(engine.world, heldPlanet);
}

spawnPlanet();

/* ---------- Input ---------- */
function launch(x, y) {
  if (!heldPlanet) return;

  const dir = Vector.normalise(
    Vector.sub(heldPlanet.position, { x, y })
  );

  Body.setStatic(heldPlanet, false);
  Body.applyForce(
    heldPlanet,
    heldPlanet.position,
    Vector.mult(dir, 0.035)
  );

  heldPlanet = null;
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
  e.pairs.forEach(pair => {
    const a = pair.bodyA;
    const b = pair.bodyB;

    if (
      a.label === "planet" &&
      b.label === "planet" &&
      a.planetLevel === b.planetLevel &&
      a.planetLevel < PLANETS.length - 1
    ) {
      const level = a.planetLevel + 1;
      const pos = Vector.div(
        Vector.add(a.position, b.position),
        2
      );

      World.remove(engine.world, a);
      World.remove(engine.world, b);
      World.add(engine.world, createPlanet(level, pos.x, pos.y));
    }
  });
});

/* ---------- Cosmic Gravity ---------- */
Events.on(engine, "beforeUpdate", () => {
  const planets = engine.world.bodies.filter(b => b.label === "planet");

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i];
      const b = planets[j];

      const dir = Vector.sub(b.position, a.position);
      const dist = Vector.magnitude(dir) || 1;
      const strength = 0.0000008 * a.mass * b.mass;

      const force = Vector.mult(Vector.normalise(dir), strength);
      Body.applyForce(a, a.position, force);
      Body.applyForce(b, b.position, Vector.neg(force));
    }
  }
});

/* ---------- Game Over (CORRECT & STABLE) ---------- */
const escapeTimers = new Map();

Events.on(engine, "afterUpdate", () => {
  engine.world.bodies.forEach(b => {
    if (b.label !== "planet") return;
    if (b.isStatic) return;

    const dist = Vector.magnitude(
      Vector.sub(b.position, CENTER)
    );

    const limit = BUBBLE_RADIUS - b.circleRadius;

    if (dist > limit) {
      escapeTimers.set(b, (escapeTimers.get(b) || 0) + 1);

      if (escapeTimers.get(b) > 60) {
        alert("Game Over");
        location.reload();
      }
    } else {
      escapeTimers.delete(b);
    }
  });
});
