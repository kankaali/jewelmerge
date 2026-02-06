// ====== SETUP ======
const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

canvas.width = innerWidth
canvas.height = innerHeight

const CENTER = { x: canvas.width / 2, y: canvas.height * 0.25 }

const CORE_RADIUS = 18
const LOCK_RADIUS = CORE_RADIUS + 2

const G = 0.22
const BASE_DAMPING = 0.998
const ORBIT_STRENGTH = 0.08   // how strongly orbit is enforced

let balls = []
let currentBall = null
let nextLevel = randLevel()

let isAiming = false
let aimStart = null
let aimCurrent = null

// ====== BALL FACTORY ======
function createBall(x, y, level, vx = 0, vy = 0) {
  return {
    pos: { x, y },
    vel: { x: vx, y: vy },
    level,
    size: 14 + level * 5
  }
}

// ====== SPAWN ======
function spawnCurrentBall() {
  currentBall = createBall(
    canvas.width / 2,
    canvas.height - 80,
    nextLevel
  )
  nextLevel = randLevel()
}

// ====== CONTINUOUS ORBITAL GRAVITY ======
function applyGravity(ball) {
  const dx = CENTER.x - ball.pos.x
  const dy = CENTER.y - ball.pos.y
  const dist = Math.hypot(dx, dy)

  if (dist === 0) return

  const nx = dx / dist
  const ny = dy / dist

  // ---- HARD CORE LOCK ----
  if (dist <= LOCK_RADIUS + ball.size) {
    ball.pos.x = CENTER.x - nx * (LOCK_RADIUS + ball.size)
    ball.pos.y = CENTER.y - ny * (LOCK_RADIUS + ball.size)
    ball.vel.x *= 0.15
    ball.vel.y *= 0.15
    return
  }

  // ---- RADIAL GRAVITY ----
  ball.vel.x += nx * G
  ball.vel.y += ny * G

  // ---- CONTINUOUS ORBIT CORRECTION ----
  // Desired circular orbital speed
  const desiredSpeed = Math.sqrt(G * dist)

  // Tangential direction (perpendicular to radial)
  const tx = -ny
  const ty = nx

  // Current tangential speed
  const currentTangential =
    ball.vel.x * tx + ball.vel.y * ty

  // Difference from perfect orbit
  const delta = desiredSpeed - currentTangential

  // Apply smooth correction
  ball.vel.x += tx * delta * ORBIT_STRENGTH
  ball.vel.y += ty * delta * ORBIT_STRENGTH

  // ---- DAMPING ----
  ball.vel.x *= BASE_DAMPING
  ball.vel.y *= BASE_DAMPING

  // ---- MOVE ----
  ball.pos.x += ball.vel.x
  ball.pos.y += ball.vel.y
}

// ====== COLLISIONS ======
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
  for (let ball of balls) applyGravity(ball)
  resolveCollisions()
}

// ====== DRAW ======
function drawCore() {
  ctx.fillStyle = "#000"
  ctx.beginPath()
  ctx.arc(CENTER.x, CENTER.y, CORE_RADIUS, 0, Math.PI * 2)
  ctx.fill()
}

function drawBall(ball) {
  ctx.fillStyle = ballColor(ball.level)
  ctx.beginPath()
  ctx.arc(ball.pos.x, ball.pos.y, ball.size, 0, Math.PI * 2)
  ctx.fill()
}

function ballColor(level) {
  const colors = [
    "#4dd0e1", "#81c784", "#ffd54f",
    "#ff8a65", "#ba68c8", "#f06292",
    "#90a4ae", "#ff5252", "#fff176"
  ]
  return colors[level] || "#fff"
}

// ====== AIM PREVIEW (ORBIT-ACCURATE) ======
function drawAimingLine() {
  if (!isAiming) return

  let pos = { ...currentBall.pos }
  let vel = {
    x: (aimStart.x - aimCurrent.x) * 0.035,
    y: (aimStart.y - aimCurrent.y) * 0.035
  }

  for (let i = 0; i < 90; i++) {
    const dx = CENTER.x - pos.x
    const dy = CENTER.y - pos.y
    const dist = Math.hypot(dx, dy)
    if (dist <= LOCK_RADIUS + currentBall.size) break

    const nx = dx / dist
    const ny = dy / dist
    const tx = -ny
    const ty = nx

    vel.x += nx * G
    vel.y += ny * G

    const desired = Math.sqrt(G * dist)
    const currentT = vel.x * tx + vel.y * ty
    const delta = desired - currentT

    vel.x += tx * delta * ORBIT_STRENGTH
    vel.y += ty * delta * ORBIT_STRENGTH

    vel.x *= BASE_DAMPING
    vel.y *= BASE_DAMPING

    pos.x += vel.x
    pos.y += vel.y

    ctx.fillStyle = `rgba(255,255,255,${1 - i / 90})`
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2)
    ctx.fill()
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
  shootBall()
  isAiming = false
})

// ====== SHOOT ======
function shootBall() {
  currentBall.vel.x = (aimStart.x - aimCurrent.x) * 0.035
  currentBall.vel.y = (aimStart.y - aimCurrent.y) * 0.035
  balls.push(currentBall)
  spawnCurrentBall()
}

// ====== LOOP ======
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawCore()
  for (let ball of balls) drawBall(ball)
  if (currentBall) drawBall(currentBall)
  drawAimingLine()
  update()
  requestAnimationFrame(loop)
}

// ====== UTILS ======
function randLevel() {
  return Math.floor(Math.random() * 3)
}

// ====== START ======
spawnCurrentBall()
loop()
