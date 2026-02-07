// ================= CANVAS SETUP =================
// Grab the canvas element from HTML
const canvas = document.getElementById("game")

// 2D drawing context (everything is rendered here)
const ctx = canvas.getContext("2d")

// Make canvas full screen
canvas.width = innerWidth
canvas.height = innerHeight



// ================= BLACK HOLE CORE =================

// Position of the black hole
// X is centered, Y is lifted upward to create falling gameplay
const CENTER = {
  x: canvas.width / 2,
  y: canvas.height * 0.28
}

// Visual + physical radius of the black hole
// Affects landing distance and rolling behavior
const CORE_RADIUS = 26



// ================= GLOBAL PHYSICS =================

// Strength of gravitational pull toward black hole
// Increase = stronger inward acceleration
const G = 0.52

// Softening factor to prevent infinite gravity near center
// Higher = smoother, less violent near core
const SOFTEN = 1600

// Energy loss applied every frame (space drag)
const BASE_DAMP = 0.996

// Energy loss when rolling on black hole surface
const SURFACE_DAMP = 0.94



// ================= LAUNCH CONTROL =================

// Converts finger drag distance into velocity
const LAUNCH_SCALE = 0.035

// Minimum allowed launch strength
// Prevents weak, boring drops
const MIN_LAUNCH_SPEED = 2.4

// Maximum allowed launch strength
// Prevents escaping the bowl
const MAX_LAUNCH_SPEED = 7.2



// ================= INVISIBLE QUADRATIC BOWL =================

// Radius of the invisible circular boundary
// Controls how far balls can travel outward
const BOWL_RADIUS = Math.min(canvas.width, canvas.height) * 0.35

// Strength of the bowl’s inward push
// Higher = steeper “wall”
const BOWL_K = 0.0012



// ================= GAME STATE =================

// All launched balls
let balls = []

// Ball currently being aimed
let currentBall = null

// Next ball level (size)
let nextLevel = randLevel()

// Touch aiming state
let aiming = false
let aimStart = null
let aimNow = null



// ================= BALL CREATION =================
function createBall(x, y, lvl, vx = 0, vy = 0) {

  // Ball radius grows with level
  const r = 22 + lvl * 6

  // Mass grows quadratically with size
  // Heavy balls resist movement and collisions
  const mass = r * r * 0.02

  return {
    pos: { x, y },          // Position
    vel: { x: vx, y: vy },  // Velocity
    r,                      // Radius
    mass,                   // Mass (heaviness)
    lvl,                    // Level for merging
    surface: false,         // Is touching black hole?

    // Tiny random surface drift
    // Divided by mass so heavy balls barely move
    drift: (Math.random() - 0.5) * 0.00035 / mass
  }
}



// ================= SPAWN BALL =================
function spawn() {

  // Spawn ball at bottom of screen
  // Increase Y offset to increase fall distance
  currentBall = createBall(
    canvas.width / 2,
    canvas.height - 110,
    nextLevel
  )

  nextLevel = randLevel()
}



// ================= PHYSICS STEP =================
function applyPhysics(b) {

  // Vector from ball to black hole
  const dx = CENTER.x - b.pos.x
  const dy = CENTER.y - b.pos.y

  // Distance squared (with epsilon)
  const d2 = dx * dx + dy * dy + 0.0001
  const d = Math.sqrt(d2)

  // Normalized direction toward black hole
  const nx = dx / d
  const ny = dy / d



  // -------- BLACK HOLE GRAVITY --------
  // Inverse-square-like attraction
  const g = G / (d2 + SOFTEN)

  b.vel.x += nx * g
  b.vel.y += ny * g



  // -------- INVISIBLE BOWL FORCE --------
  // Only activates outside bowl radius
  if (d > BOWL_RADIUS) {
    const excess = d - BOWL_RADIUS

    // Pushes ball back inward
    b.vel.x += nx * excess * BOWL_K
    b.vel.y += ny * excess * BOWL_K
  }



  // -------- GLOBAL DAMPING --------
  // Larger balls lose more energy
  const sizeDamp = 1 - b.r * 0.00018

  b.vel.x *= BASE_DAMP * sizeDamp
  b.vel.y *= BASE_DAMP * sizeDamp



  // -------- BLACK HOLE SURFACE --------
  const surfaceDist = CORE_RADIUS + b.r

  if (d < surfaceDist + 14) {

    const vx = b.vel.x
    const vy = b.vel.y

    // Radial velocity toward center
    const radial = vx * nx + vy * ny

    // Tangential direction (around core)
    const tx = -ny
    const ty = nx

    let tangential = vx * tx + vy * ty

    // Kill inward velocity (prevents sinking)
    if (radial < 0) {
      b.vel.x -= nx * radial
      b.vel.y -= ny * radial
    }

    // Heavy balls roll less (inertia)
    const inertia = 1 / b.mass
    tangential *= SURFACE_DAMP * inertia

    // Apply rolling + tiny drift
    b.vel.x = tx * tangential + tx * b.drift
    b.vel.y = ty * tangential + ty * b.drift

    // Snap ball onto surface
    b.surface = true
    b.pos.x = CENTER.x - nx * surfaceDist
    b.pos.y = CENTER.y - ny * surfaceDist

  } else {
    b.surface = false
  }

  // Move ball
  b.pos.x += b.vel.x
  b.pos.y += b.vel.y
}



// ================= BALL COLLISIONS =================
function resolveCollisions() {

  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {

      const a = balls[i]
      const b = balls[j]

      const dx = b.pos.x - a.pos.x
      const dy = b.pos.y - a.pos.y
      const d = Math.hypot(dx, dy)

      const min = a.r + b.r

      if (d < min && d > 0) {

        const nx = dx / d
        const ny = dy / d
        const overlap = min - d

        // Separate balls
        a.pos.x -= nx * overlap * 0.5
        a.pos.y -= ny * overlap * 0.5
        b.pos.x += nx * overlap * 0.5
        b.pos.y += ny * overlap * 0.5

        // Small tangential push when on surface
        if (a.surface || b.surface) {
          const tx = -ny
          const ty = nx

          // Heavy balls ignore nudges
          const push = 0.01 / (a.mass + b.mass)

          a.vel.x += tx * push
          a.vel.y += ty * push
          b.vel.x -= tx * push
          b.vel.y -= ty * push
        }

        // Merge if same level
        if (a.lvl === b.lvl) {
          merge(a, b)
          return
        }
      }
    }
  }
}



// ================= MERGING =================
function merge(a, b) {

  balls = balls.filter(x => x !== a && x !== b)

  balls.push(
    createBall(
      (a.pos.x + b.pos.x) / 2,
      (a.pos.y + b.pos.y) / 2,
      a.lvl + 1
    )
  )
}



// ================= TRAJECTORY PREVIEW =================
function drawTrajectory() {

  if (!aiming) return

  let pos = { ...currentBall.pos }

  let vx = (aimStart.x - aimNow.x) * LAUNCH_SCALE
  let vy = (aimStart.y - aimNow.y) * LAUNCH_SCALE

  let speed = Math.hypot(vx, vy)

  // Clamp speed to allowed range
  if (speed < MIN_LAUNCH_SPEED) {
    vx *= MIN_LAUNCH_SPEED / speed
    vy *= MIN_LAUNCH_SPEED / speed
  }
  if (speed > MAX_LAUNCH_SPEED) {
    vx *= MAX_LAUNCH_SPEED / speed
    vy *= MAX_LAUNCH_SPEED / speed
  }

  let vel = { x: vx, y: vy }

  // Simulate future path
  for (let i = 0; i < 180; i++) {

    const fake = {
      pos: { ...pos },
      vel: { ...vel },
      r: currentBall.r,
      mass: currentBall.mass,
      drift: 0,
      surface: false
    }

    applyPhysics(fake)

    pos = fake.pos
    vel = fake.vel

    ctx.fillStyle = `rgba(255,255,255,${1 - i / 180})`
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2)
    ctx.fill()

    // Stop if reaches black hole
    if (Math.hypot(pos.x - CENTER.x, pos.y - CENTER.y) <
        CORE_RADIUS + currentBall.r) break
  }
}



// ================= DRAWING =================
function drawBall(b) {
  ctx.fillStyle = color(b.lvl)
  ctx.beginPath()
  ctx.arc(b.pos.x, b.pos.y, b.r, 0, Math.PI * 2)
  ctx.fill()
}

function drawCore() {
  ctx.fillStyle = "#000"
  ctx.beginPath()
  ctx.arc(CENTER.x, CENTER.y, CORE_RADIUS, 0, Math.PI * 2)
  ctx.fill()
}

function color(l) {
  return ["#4dd0e1","#81c784","#ffd54f","#ff8a65","#ba68c8","#f06292"][l] || "#eee"
}



// ================= MAIN LOOP =================
function loop() {

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  balls.forEach(applyPhysics)
  resolveCollisions()

  drawCore()
  balls.forEach(drawBall)
  if (currentBall) drawBall(currentBall)

  drawTrajectory()

  requestAnimationFrame(loop)
}



// ================= INPUT =================
canvas.addEventListener("touchstart", e => {
  aiming = true
  const t = e.touches[0]
  aimStart = { x: t.clientX, y: t.clientY }
  aimNow = aimStart
})

canvas.addEventListener("touchmove", e => {
  if (!aiming) return
  const t = e.touches[0]
  aimNow = { x: t.clientX, y: t.clientY }
})

canvas.addEventListener("touchend", () => {

  if (!aiming) return

  let vx = (aimStart.x - aimNow.x) * LAUNCH_SCALE
  let vy = (aimStart.y - aimNow.y) * LAUNCH_SCALE

  let speed = Math.hypot(vx, vy)

  if (speed < MIN_LAUNCH_SPEED) {
    vx *= MIN_LAUNCH_SPEED / speed
    vy *= MIN_LAUNCH_SPEED / speed
  }
  if (speed > MAX_LAUNCH_SPEED) {
    vx *= MAX_LAUNCH_SPEED / speed
    vy *= MAX_LAUNCH_SPEED / speed
  }

  currentBall.vel.x = vx
  currentBall.vel.y = vy

  balls.push(currentBall)
  spawn()

  aiming = false
})



// ================= UTIL =================
function randLevel() {
  return Math.floor(Math.random() * 3)
}



// ================= START =================
spawn()
loop()
