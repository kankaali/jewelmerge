const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

canvas.width = innerWidth
canvas.height = innerHeight

// ===== CORE =====
const CENTER = { x: canvas.width / 2, y: canvas.height * 0.28 }
const CORE_RADIUS = 24

// ===== PHYSICS =====
const G = 720
const SOFTEN = 1200
const BASE_DAMP = 0.998
const SURFACE_DAMP = 0.92
const LAUNCH_POWER = 0.055

// ===== CAMERA =====
let camScale = 1
let camTarget = 1
const CAM_LERP = 0.07
const MIN_SCALE = 0.6

// ===== GAME =====
let balls = []
let currentBall = null
let nextLevel = randLevel()

let aiming = false
let aimStart = null
let aimNow = null

// ===== BALL =====
function createBall(x, y, lvl, vx = 0, vy = 0) {
  const r = 20 + lvl * 6
  return {
    pos: { x, y },
    vel: { x: vx, y: vy },
    r,
    lvl,
    surface: false,
    drift: (Math.random() - 0.5) * 0.0006
  }
}

// ===== SPAWN =====
function spawn() {
  currentBall = createBall(canvas.width / 2, canvas.height - 90, nextLevel)
  nextLevel = randLevel()
}

// ===== PHYSICS =====
function applyPhysics(b) {
  const dx = CENTER.x - b.pos.x
  const dy = CENTER.y - b.pos.y
  const d = Math.hypot(dx, dy)

  const nx = dx / d
  const ny = dy / d

  // gravity
  const f = G / (d * d + SOFTEN)
  b.vel.x += nx * f
  b.vel.y += ny * f

  // damping
  b.vel.x *= BASE_DAMP
  b.vel.y *= BASE_DAMP

  const surfaceDist = CORE_RADIUS + b.r

  if (d < surfaceDist + 18) {
    // ---- SURFACE CONSTRAINT ----
    const vx = b.vel.x
    const vy = b.vel.y

    const radial = vx * nx + vy * ny
    const tx = -ny
    const ty = nx
    let tangential = vx * tx + vy * ty

    // kill radial escape
    if (radial < 0) {
      b.vel.x -= nx * radial
      b.vel.y -= ny * radial
    }

    // preserve tangential rolling
    tangential *= SURFACE_DAMP
    b.vel.x = tx * tangential
    b.vel.y = ty * tangential

    // micro motion
    b.vel.x += tx * b.drift
    b.vel.y += ty * b.drift

    b.surface = true

    // hard position clamp
    b.pos.x = CENTER.x - nx * surfaceDist
    b.pos.y = CENTER.y - ny * surfaceDist
  } else {
    b.surface = false
  }

  b.pos.x += b.vel.x
  b.pos.y += b.vel.y
}

// ===== COLLISION =====
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

        // tangential impulse only if surface-bound
        if (a.surface || b.surface) {
          const tx = -ny
          const ty = nx
          const impulse = 0.04
          a.vel.x += tx * impulse
          a.vel.y += ty * impulse
          b.vel.x -= tx * impulse
          b.vel.y -= ty * impulse
        }

        if (a.lvl === b.lvl) {
          merge(a, b)
          return
        }
      }
    }
  }
}

// ===== MERGE =====
function merge(a, b) {
  balls = balls.filter(x => x !== a && x !== b)
  balls.push(createBall(
    (a.pos.x + b.pos.x) / 2,
    (a.pos.y + b.pos.y) / 2,
    a.lvl + 1
  ))
}

// ===== CAMERA =====
function updateCamera(maxRadius) {
  const safe = Math.min(canvas.width, canvas.height) * 0.42
  if (maxRadius > safe) {
    camTarget = Math.max(MIN_SCALE, safe / maxRadius)
  } else camTarget = 1

  camScale += (camTarget - camScale) * CAM_LERP
}

// ===== TRAJECTORY =====
function drawTrajectory() {
  if (!aiming) return 0

  let pos = { ...currentBall.pos }
  let vel = {
    x: (aimStart.x - aimNow.x) * LAUNCH_POWER,
    y: (aimStart.y - aimNow.y) * LAUNCH_POWER
  }

  let maxR = 0

  for (let i = 0; i < 140; i++) {
    const fake = { pos: { ...pos }, vel: { ...vel }, r: currentBall.r }
    applyPhysics(fake)
    pos = fake.pos
    vel = fake.vel

    const d = Math.hypot(pos.x - CENTER.x, pos.y - CENTER.y)
    maxR = Math.max(maxR, d)

    ctx.fillStyle = `rgba(255,255,255,${1 - i / 140})`
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2)
    ctx.fill()

    if (d < CORE_RADIUS + currentBall.r) break
  }
  return maxR
}

// ===== DRAW =====
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

// ===== LOOP =====
function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  let maxRadius = 0
  balls.forEach(b => {
    applyPhysics(b)
    maxRadius = Math.max(maxRadius,
      Math.hypot(b.pos.x - CENTER.x, b.pos.y - CENTER.y))
  })

  resolveCollisions()

  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.scale(camScale, camScale)
  ctx.translate(-canvas.width / 2, -canvas.height / 2)

  drawCore()
  balls.forEach(drawBall)
  if (currentBall) drawBall(currentBall)

  const trajR = drawTrajectory()
  maxRadius = Math.max(maxRadius, trajR)

  ctx.restore()

  updateCamera(maxRadius)
  requestAnimationFrame(loop)
}

// ===== INPUT =====
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

// ===== UTIL =====
function randLevel() {
  return Math.floor(Math.random() * 3)
}

// ===== START =====
spawn()
loop()
