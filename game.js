// ====== SETUP ======
const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

canvas.width = innerWidth
canvas.height = innerHeight

const CENTER = { x: canvas.width / 2, y: canvas.height * 0.28 }

// ---- CORE ----
const CORE_RADIUS = 22

// ---- PHYSICS ----
const G = 420        // gravity strength
const SOFTENING = 900 // prevents singularity
const BASE_DAMP = 0.995
const SURFACE_DAMP = 0.92

let balls = []
let currentBall = null
let nextLevel = randLevel()

let isAiming = false
let aimStart = null
let aimCurrent = null

// ====== BALL ======
function createBall(x, y, level, vx = 0, vy = 0) {
  const size = 18 + level * 6
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

// ====== GRAVITY (PURE, NO ZONES) ======
function applyPhysics(ball) {
  const dx = CENTER.x - ball.pos.x
  const dy = CENTER.y - ball.pos.y
  const distSq = dx * dx + dy * dy
  const dist = Math.sqrt(distSq)

  const nx = dx / dist
  const ny = dy / dist

  // ---- PURE CENTRAL FORCE ----
  const force = G / (distSq + SOFTENING)

  ball.vel.x += nx * force
  ball.vel.y += ny * force

  // ---- SMOOTH DISTANCE-BASED DAMPING (NOT FORCE) ----
  let damp = BASE_DAMP

  const surfaceDist = CORE_RADIUS + ball.size + 2
  if (dist < surfaceDist + 40) {
    const t = Math.max(0, Math.min(1, (surfaceDist + 40 - dist) / 40))
    damp = BASE_DAMP * (1 - t * (1 - SURFACE_DAMP))
  }

  ball.vel.x *= damp
  ball.vel.y *= damp

  // ---- POSITION ----
  ball.pos.x += ball.vel.x
  ball.pos.y += ball.vel.y

  // ---- SOFT SURFACE CONSTRAINT ----
  if (dist < surfaceDist) {
    ball.pos.x = CENTER.x - nx * surfaceDist
    ball.pos.y = CENTER.y - ny * surfaceDist
    ball.vel.x *= 0.35
    ball.vel.y *= 0.35
  }
}

// ====== COLLISIONS (CALM, NO EJECTION) ======
function resolveCollisions() {
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

        // very light impulse (no chaos)
        const dvx = b.vel.x - a.vel.x
        const dvy = b.vel.y - a.vel.y
        a.vel.x += dvx * 0.05
        a.vel.y += dvy * 0.05
        b.vel.x -= dvx * 0.05
        b.vel.y -= dvy * 0.05

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
  balls.forEach(applyPhysics)
  resolveCollisions()
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

// ====== TRAJECTORY (IDENTICAL PHYSICS) ======
function drawTrajectory() {
  if (!isAiming) return

  let pos = { ...currentBall.pos }
  let vel = {
    x: (aimStart.x - aimCurrent.x) * 0.03,
    y: (aimStart.y - aimCurrent.y) * 0.03
  }

  for (let i = 0; i < 100; i++) {
    const fake = {
      pos: { ...pos },
      vel: { ...vel },
      size: currentBall.size
    }

    applyPhysics(fake)
    pos = fake.pos
    vel = fake.vel

    ctx.fillStyle = `rgba(255,255,255,${1 - i / 100})`
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
  currentBall.vel.x = (aimStart.x - aimCurrent.x) * 0.03
  currentBall.vel.y = (aimStart.y - aimCurrent.y) * 0.03
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
