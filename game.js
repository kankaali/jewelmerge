const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

canvas.width = innerWidth
canvas.height = innerHeight

// ================= CORE =================
const CENTER = { x: canvas.width / 2, y: canvas.height * 0.28 }
const CORE_RADIUS = 26

// ================= PHYSICS =================
const G = 0.52                    // strength of pull toward black hole
const SOFTEN = 1600               // softens gravity near center (prevents snapping)

const BASE_DAMP = 0.996           // global space friction
const SURFACE_DAMP = 0.94         // energy loss while rolling on black hole

// ================= LAUNCH =================
const LAUNCH_SCALE = 0.045
const MAX_LAUNCH_SPEED = 7.2

// ================= QUADRATIC WELL (BOUNDARY) =================

// Radius of invisible circular "arena"
// Balls are free INSIDE this radius
// Only outside this does the bowl force appear
const BOWL_RADIUS = Math.min(canvas.width, canvas.height) * 0.15
// 👆 Increase → wider playable area
// 👆 Decrease → tighter, more focused orbits

// Strength of the quadratic pull back toward center
// Acts like a soft wall, not a hard collision
const BOWL_K = 0.008
// 👆 Increase → stronger pull back when escaping
// 👆 Decrease → looser, floatier outer space

// ================= GAME =================
let balls = []
let currentBall = null
let nextLevel = randLevel()

let aiming = false
let aimStart = null
let aimNow = null

// ================= BALL =================
function createBall(x, y, lvl, vx = 0, vy = 0) {
  const r = 22 + lvl * 6
  return {
    pos: { x, y },
    vel: { x: vx, y: vy },
    r,
    lvl,
    surface: false,
    drift: (Math.random() - 0.5) * 0.00035 // tiny surface irregularity
  }
}

// ================= SPAWN =================
function spawn() {
  currentBall = createBall(
    canvas.width / 2,
    canvas.height - 82,   // launch distance from black hole
    nextLevel
  )
  nextLevel = randLevel()
}

// ================= PHYSICS =================
function applyPhysics(b) {
  const dx = CENTER.x - b.pos.x
  const dy = CENTER.y - b.pos.y
  const d2 = dx * dx + dy * dy + 0.0001
  const d = Math.sqrt(d2)

  const nx = dx / d
  const ny = dy / d

  // ---- PURE BLACK HOLE GRAVITY ----
  // Always pulls inward, strongest near center
  const g = G / (d2 + SOFTEN)
  b.vel.x += nx * g
  b.vel.y += ny * g

  // ---- QUADRATIC WELL BOUNDARY ----
  // This is the OUTER invisible bowl
  // Keeps balls from flying away forever
  if (d > BOWL_RADIUS) {
    const excess = d - BOWL_RADIUS
    // Force grows smoothly the farther the ball escapes
    b.vel.x += nx * excess * BOWL_K
    b.vel.y += ny * excess * BOWL_K
    // Result: soft circular containment, no hard edges
  }

  // ---- GLOBAL DAMPING ----
  // Bigger balls lose more energy → feel heavier
  const sizeDamp = 1 - b.r * 0.00018
  b.vel.x *= BASE_DAMP * sizeDamp
  b.vel.y *= BASE_DAMP * sizeDamp

  // ---- BLACK HOLE SURFACE ----
  const surfaceDist = CORE_RADIUS + b.r
  if (d < surfaceDist + 14) {
    const vx = b.vel.x
    const vy = b.vel.y

    const radial = vx * nx + vy * ny
    const tx = -ny
    const ty = nx
    let tangential = vx * tx + vy * ty

    // stop sinking into black hole
    if (radial < 0) {
      b.vel.x -= nx * radial
      b.vel.y -= ny * radial
    }

    // rolling friction
    tangential *= SURFACE_DAMP
    b.vel.x = tx * tangential + tx * b.drift
    b.vel.y = ty * tangential + ty * b.drift

    b.surface = true
    b.pos.x = CENTER.x - nx * surfaceDist
    b.pos.y = CENTER.y - ny * surfaceDist
  } else {
    b.surface = false
  }

  b.pos.x += b.vel.x
  b.pos.y += b.vel.y
}

// ================= COLLISIONS =================
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

        a.pos.x -= nx * overlap * 0.5
        a.pos.y -= ny * overlap * 0.5
        b.pos.x += nx * overlap * 0.5
        b.pos.y += ny * overlap * 0.5

        if (a.surface || b.surface) {
          const tx = -ny
          const ty = nx
          a.vel.x += tx * 0.01
          a.vel.y += ty * 0.01
          b.vel.x -= tx * 0.01
          b.vel.y -= ty * 0.01
        }

        if (a.lvl === b.lvl) {
          merge(a, b)
          return
        }
      }
    }
  }
}

// ================= MERGE =================
function merge(a, b) {
  balls = balls.filter(x => x !== a && x !== b)
  balls.push(createBall(
    (a.pos.x + b.pos.x) / 2,
    (a.pos.y + b.pos.y) / 2,
    a.lvl + 1
  ))
}

// ================= TRAJECTORY =================
function drawTrajectory() {
  if (!aiming) return

  let pos = { ...currentBall.pos }

  let vx = (aimStart.x - aimNow.x) * LAUNCH_SCALE
  let vy = (aimStart.y - aimNow.y) * LAUNCH_SCALE
  const mag = Math.hypot(vx, vy)
  if (mag > MAX_LAUNCH_SPEED) {
    vx *= MAX_LAUNCH_SPEED / mag
    vy *= MAX_LAUNCH_SPEED / mag
  }

  let vel = { x: vx, y: vy }

  for (let i = 0; i < 160; i++) {
    const fake = { pos: { ...pos }, vel: { ...vel }, r: currentBall.r, drift: 0 }
    applyPhysics(fake)
    pos = fake.pos
    vel = fake.vel

    ctx.fillStyle = `rgba(255,255,255,${1 - i / 160})`
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ================= DRAW =================
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

// ================= LOOP =================
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
  const mag = Math.hypot(vx, vy)
  if (mag > MAX_LAUNCH_SPEED) {
    vx *= MAX_LAUNCH_SPEED / mag
    vy *= MAX_LAUNCH_SPEED / mag
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
