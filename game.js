const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

canvas.width = innerWidth
canvas.height = innerHeight

// ================= CORE =================
const CENTER = { x: canvas.width / 2, y: canvas.height * 0.28 }
const CORE_RADIUS = 26

// ================= PHYSICS =================
const G = 920
const SOFTEN = 1600

const BASE_DAMP = 0.9975
const SURFACE_DAMP = 0.945
const LAUNCH_POWER = 0.06

// ---- CLOSED GRAVITY BOWL ----
const BOWL_RADIUS = Math.min(canvas.width, canvas.height) * 0.42
const BOWL_SOFT_EDGE = 0.92        // where slowdown begins
const BOWL_PUSH = 0.55             // inward correction strength

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
    drift: (Math.random() - 0.5) * 0.0003
  }
}

// ================= SPAWN =================
function spawn() {
  currentBall = createBall(
    canvas.width / 2,
    canvas.height - 90,
    nextLevel
  )
  nextLevel = randLevel()
}

// ================= PHYSICS =================
function applyPhysics(b) {
  const dx = CENTER.x - b.pos.x
  const dy = CENTER.y - b.pos.y
  const d2 = dx * dx + dy * dy
  const d = Math.sqrt(d2)

  const nx = dx / d
  const ny = dy / d

  // ---- GRAVITY (PURE) ----
  const f = G / (d2 + SOFTEN)
  b.vel.x += nx * f
  b.vel.y += ny * f

  // ---- CLOSED BOWL (APOAPSIS TURNAROUND) ----
  const ox = b.pos.x - CENTER.x
  const oy = b.pos.y - CENTER.y
  const od = Math.hypot(ox, oy)

  if (od > BOWL_RADIUS * BOWL_SOFT_EDGE) {
    const t = Math.min(1, (od - BOWL_RADIUS * BOWL_SOFT_EDGE) / (BOWL_RADIUS * 0.08))
    const onx = ox / od
    const ony = oy / od

    // suppress outward velocity smoothly
    const vr = b.vel.x * onx + b.vel.y * ony
    if (vr > 0) {
      b.vel.x -= onx * vr * t * BOWL_PUSH
      b.vel.y -= ony * vr * t * BOWL_PUSH
    }
  }

  // ---- DAMPING ----
  b.vel.x *= BASE_DAMP
  b.vel.y *= BASE_DAMP

  // ---- BLACK HOLE SURFACE ----
  const surfaceDist = CORE_RADIUS + b.r

  if (d < surfaceDist + 16) {
    const vx = b.vel.x
    const vy = b.vel.y

    const radial = vx * nx + vy * ny
    const tx = -ny
    const ty = nx
    let tangential = vx * tx + vy * ty

    // kill inward penetration only
    if (radial < 0) {
      b.vel.x -= nx * radial
      b.vel.y -= ny * radial
    }

    tangential *= SURFACE_DAMP
    b.vel.x = tx * tangential
    b.vel.y = ty * tangential

    // micro rolling
    b.vel.x += tx * b.drift
    b.vel.y += ty * b.drift

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
          a.vel.x += tx * 0.012
          a.vel.y += ty * 0.012
          b.vel.x -= tx * 0.012
          b.vel.y -= ty * 0.012
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
  let vel = {
    x: (aimStart.x - aimNow.x) * LAUNCH_POWER,
    y: (aimStart.y - aimNow.y) * LAUNCH_POWER
  }

  for (let i = 0; i < 180; i++) {
    const fake = { pos: { ...pos }, vel: { ...vel }, r: currentBall.r }
    applyPhysics(fake)
    pos = fake.pos
    vel = fake.vel

    const d = Math.hypot(pos.x - CENTER.x, pos.y - CENTER.y)
    if (d > BOWL_RADIUS * 1.01) break

    ctx.fillStyle = `rgba(255,255,255,${1 - i / 180})`
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2)
    ctx.fill()

    if (d < CORE_RADIUS + currentBall.r) break
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
  currentBall.vel.x = (aimStart.x - aimNow.x) * LAUNCH_POWER
  currentBall.vel.y = (aimStart.y - aimNow.y) * LAUNCH_POWER
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
