/* ================================
   SPUTNIKA MOBILE – STABLE BUILD
   ================================ */

const {
  Engine,
  Render,
  World,
  Bodies,
  Body,
  Events,
  Vector
} = Matter;

/* ---------- Screen (Mobile Only) ---------- */
const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

/* ---------- Engine ---------- */
const engine = Engine.create();
engine.gravity.y = 0;

/* ---------- Renderer ---------- */
const render = Render.create({
  element: document.body,
  engine: engine,
  options: {
    width: WIDTH,
    height: HEIGHT,
    wireframes: false,
    background: "#0b0f1a"
  }
});

Engine.run(engine);
Render.run(render);

/* ---------- Bubble ---------- */
const CENTER = {
  x: WIDTH / 2,
  y: HEIGHT * 0.6
};

const BUBBLE_RADIUS = Math.min(WIDTH, HEIGHT) * 0.4;

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

/* ---------- Planet Levels ---------- */
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
  { r: 60, c: "#fde047" }
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
    render: {
      fillStyle: PLANETS[level].c
    }
  });
}

/* ---------- Spawn ---------- */
let heldPlanet = null;

function spawnPlanet() {
  heldPlanet = createPlanet(
    0,
    CENTER.x,
    CENTER.y - BUBBLE_RADIUS - 40
  );
  Body.setStatic(heldPlanet, true);
  World.add(engine.world, heldPlanet);
}

spawnPlanet();

/* ---------- Touch Launch ---------- */
render.canvas.addEventListener("touchstart", e => {
  if (!heldPlanet) return;

  const t = e.touches[0];
  const rect = render.canvas.getBoundingClientRect();

  const target = {
    x: t.clientX - rect.left,
    y: t.clientY - rect.top
  };

  const dir = Vector.normalise(
    Vector.sub(heldPlanet.position, target)
  );

  Body.setStatic(heldPlanet, false);
  Body.applyForce(
    heldPlanet,
    heldPlanet.position,
    Vector.mult(dir, 0.035)
  );

  heldPlanet = null;
  setTimeout(spawnPlanet, 700);
});

/* ---------- Merge ---------- */
Events.on(engine, "collisionStart", event => {
  event.pairs.forEach(pair => {
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

/* ---------- Gravity ---------- */
Events.on(engine, "beforeUpdate", () => {
  const planets = engine.world.bodies.filter(b => b.label === "planet");

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i];
      const b = planets[j];

      const dir = Vector.sub(b.position, a.position);
      const force = Vector.mult(
        Vector.normalise(dir),
        0.0000008 * a.mass * b.mass
      );

      Body.applyForce(a, a.position, force);
      Body.applyForce(b, b.position, Vector.neg(force));
    }
  }
});

/* ---------- Game Over ---------- */
const timers = new Map();

Events.on(engine, "afterUpdate", () => {
  engine.world.bodies.forEach(b => {
    if (b.label !== "planet" || b.isStatic) return;

    const dist = Vector.magnitude(
      Vector.sub(b.position, CENTER)
    );

    const limit = BUBBLE_RADIUS - b.circleRadius;

    if (dist > limit) {
      timers.set(b, (timers.get(b) || 0) + 1);
      if (timers.get(b) > 60) {
        alert("Game Over");
        location.reload();
      }
    } else {
      timers.delete(b);
    }
  });
});
