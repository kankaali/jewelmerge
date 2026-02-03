// ====== SETUP ======
const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

canvas.width = innerWidth
canvas.height = innerHeight

const CENTER = { x: canvas.width / 2, y: canvas.height * 0.28 }

// ---- CORE ----
const CORE_RADIUS = 20

// ---- PHYSICS TUNING ----
const GRAVITY_BASE = 0.06
const GRAVITY_MAX = 0.38

const FAR_RADIUS = 420
const MID_RADIUS = 260
const NEAR_RADIUS = 150
const CONTACT_RADIUS = CORE_RADIUS + 4

const GLOBAL_DAMPING = 0.995

let balls = []
let currentBall = null
let nextLevel = randLevel()

let isAiming = false
let aimStart = null
let aimCurrent = null

// ====== BALL ======
function createBall(x, y, level, vx = 0, vy = 0) {
  const size = 16 + level * 6
  return {
    pos: { x, y },
    vel: { x: vx, y: vy },
    level,
    size
  }
}

// ====== SPAWN ======
function spawnBall() {
  currentBall = createBall(
    canvas.width / 2,
    canvas.height - 90,
    nextLevel
  )
  nextLevel = randLevel()
}

// ====== SMOOTHSTEP ======
function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// ====== CORE PHYSICS ======
function applyPhysics(ball) {
  const dx = CENTER.x - ball.pos.x
  const dy = CENTER.y - ball.pos.y
  const dist = Math.hypot(dx, dy)
  const nx = dx / dist
  const ny = dy / dist

  // ---- GRAVITY CURVE ----
  const gFactor =
    smoothstep(FAR_RADIUS, MID_RADIUS, dist) * 0.4 +
    smoothstep(MID_RADIUS, NEAR_RADIUS, dist) * 0.6

  const gravity = GRAVITY_BASE + (GRAVITY_MAX - GRAVITY_BASE) * gFactor

  ball.vel.x += nx * gravity
  ball.vel.y += ny * gravity

  // ---- VELOCITY DECOMPOSITION ----
  const vr = ball.vel.x * nx + ball.vel.y * ny
  const vtX = ball.vel.x - vr * nx
  const vtY = ball.vel.y - vr * ny

  // ---- TANGENTIAL DAMPING (VERY SMOOTH) ----
  const tangentialFade = smoothstep(MID_RADIUS, NEAR_RADIUS, dist)
  const tangentialKeep = 1 - tangentialFade * 0.92

  ball.vel.x = vr * nx + vtX * tangentialKeep
  ball.vel.y = vr * ny + vtY * tangentialKeep

  // ---- RADIAL SOFT DAMPING (VERY LATE) ----
  const radialFade = smoothstep(NEAR_RADIUS, CONTACT_RADIUS + ball.size, dist)
  ball.vel.x *= 1 - radialFade * 0.35
  ball.vel.y *= 1 - radialFade * 0.35

  // ---- SURFACE SOFT CONSTRAINT ----
  const surfaceDist = CONTACT_RADIUS + ball.size
  if (dist < surfaceDist) {
    ball.pos.x = CENTER.x - nx * surfaceDist
    ball.pos.y = CENTER.y - ny * surfaceDist

    ball.vel.x *= 0.25
    ball.vel.y *= 0.25
  }

  // ---- GLOBAL DAMPING ----
  ball.vel.x *= GLOBAL_DAMPING
  ball.vel.y *= GLOBAL_DAMPING

  ball.pos.x += ball.vel.x
  ball.pos.y += ball.vel.y
}

// ====== COLLISIONS (POSITIONAL, CALM) ======
function resolveBallCollisions() {
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i]
      const b = balls[j]

      const dx = b.pos.x - a.pos.x
      const dy = b.pos.y - a.pos.y
      const dist = Math.hypot(dx, dy)
      const minDist = a.size + b.size

      if (dist < minDist && dist > 0) {
        const nx = dx / dist
        const ny = dy / dist
        const overlap = minDist - dist

        a.pos.x -= nx * overlap * 0.5
        a.pos.y -= ny * overlap * 0.5
        b.pos.x += nx * overlap * 0.5
        b.pos.y += ny * overlap * 0.5

        if (a.level === b.level) {
          merge(a, b)
          return
        }
      }
    }
  }
}

// ====== MERGE ======
function merge(a, b) {
  balls = balls.filter(x => x !== a && x !== b)
  balls.push(
    createBall(
      (a.pos.x + b.pos.x) / 2,
      (a.pos.y + b.pos.y) / 2,
      a.level + 1
    )
  )
}

// ====== UPDATE ======
function update() {
  for (const b of balls) applyPhysics(b)
  resolveBallCollisions()
}

// ====== DRAW ======
function drawCore() {
  ctx.fillStyle = "#000"
  ctx.beginPath()
  ctx.arc(CENTER.x, CENTER.y, CORE_RADIUS, 0, Math.PI * 2)
  ctx.fill()
}

function drawBall(b) {
  ctx.fillStyle = ballColor(b.level)
  ctx.beginPath()
  ctx.arc(b.pos.x, b.pos.y, b.size, 0, Math.PI * 2)
  ctx.fill()
}

function ballColor(lvl) {
  const c = ["#4dd0e1","#81c784","#ffd54f","#ff8a65","#ba68c8","#f06292"]
  return c[lvl] || "#eee"
}

// ====== TRAJECTORY (EXACT SAME PHYSICS) ======
function drawTrajectory() {
  if (!isAiming) return

  let pos = { ...currentBall.pos }
  let vel = {
    x: (aimStart.x - aimCurrent.x) * 0.032,
    y: (aimStart.y - aimCurrent.y) * 0.032
  }

  for (let i = 0; i < 90; i++) {
    const fake = { pos, vel, size: currentBall.size }
    applyPhysics(fake)
    pos = fake.pos
    vel = fake.vel

    ctx.fillStyle = `rgba(255,255,255,${1 - i / 90})`
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2)
    ctx.fill()

    if (Math.hypot(pos.x - CENTER.x, pos.y - CENTER.y) < CORE_RADIUS + currentBall.size) break
  }
}

// ====== INPUT ======
canvas.addEventListener("touchstart", e => {
  const t = e.touches[0]
  isAiming = true
  aimStart = { x: t.clientX, y: t.clientY }
  aimCurrent = aimStart
})

canvas.addEventListener("touchmove", e => {
  if (!isAiming) return
  const t = e.touches[0]
  aimCurrent = { x: t.clientX, y: t.clientY }
})

canvas.addEventListener("touchend", () => {
  if (!isAiming) return
  shoot()
  isAiming = false
})

// ====== SHOOT ======
function shoot() {
  currentBall.vel.x = (aimStart.x - aimCurrent.x) * 0.032
  currentBall.vel.y = (aimStart.y - aimCurrent.y) * 0.032
  balls.push(currentBall)
  spawnBall()
}

// ====== LOOP ======
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  drawCore()
  balls.forEach(drawBall)
  if (currentBall) drawBall(currentBall)
  drawTrajectory()

  update()
  requestAnimationFrame(loop)
}

// ====== UTILS ======
function randLevel() {
  return Math.floor(Math.random() * 3)
}

// ====== START ======
spawnBall()
loop()
