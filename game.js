// ====== SETUP ======
const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

canvas.width = innerWidth
canvas.height = innerHeight

const CENTER = { x: canvas.width / 2, y: canvas.height * 0.25 }

const CORE_RADIUS = 18
const CAPTURE_RADIUS = 140
const ORBIT_RADIUS = 110
let GAMEOVER_RADIUS = 190

const G = 0.6
const SUN_LEVEL = 8

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
    size: 10 + level * 4,
    state: "free",
    angle: 0,
    angularSpeed: 0,
    radius: 0
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

// ====== UPDATE LOOP ======
function update() {
  for (let ball of balls) {
    if (ball.state === "free") applyGravity(ball)
    if (ball.state === "orbiting") orbit(ball)
  }
  checkCollisions()
}

// ====== GRAVITY ======
function applyGravity(ball) {
  const dx = CENTER.x - ball.pos.x
  const dy = CENTER.y - ball.pos.y
  const dist = Math.hypot(dx, dy)

  if (dist < CAPTURE_RADIUS) {
    capture(ball)
    return
  }

  const nx = dx / dist
  const ny = dy / dist

  ball.vel.x += nx * G
  ball.vel.y += ny * G

  ball.pos.x += ball.vel.x
  ball.pos.y += ball.vel.y
}

// ====== CAPTURE ======
function capture(ball) {
  ball.state = "orbiting"
  ball.angle = Math.atan2(
    ball.pos.y - CENTER.y,
    ball.pos.x - CENTER.x
  )
  ball.radius = ORBIT_RADIUS
  ball.angularSpeed = clamp(
    (ball.vel.x + ball.vel.y) * 0.01,
    -0.03,
     0.03
  )
}

// ====== ORBIT ======
function orbit(ball) {
  ball.angle += ball.angularSpeed
  ball.pos.x = CENTER.x + Math.cos(ball.angle) * ball.radius
  ball.pos.y = CENTER.y + Math.sin(ball.angle) * ball.radius
}

// ====== COLLISIONS ======
function checkCollisions() {
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i]
      const b = balls[j]

      if (a.state !== "orbiting" || b.state !== "orbiting") continue

      const d = Math.hypot(
        a.pos.x - b.pos.x,
        a.pos.y - b.pos.y
      )

      if (d < a.size + b.size && a.level === b.level) {
        merge(a, b)
        return
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

// ====== DRAW ======
function drawCore() {
  ctx.strokeStyle = "rgba(255,255,255,0.1)"
  ctx.beginPath()
  ctx.arc(CENTER.x, CENTER.y, CAPTURE_RADIUS, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = "rgba(255,255,255,0.2)"
  ctx.beginPath()
  ctx.arc(CENTER.x, CENTER.y, ORBIT_RADIUS, 0, Math.PI * 2)
  ctx.stroke()

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
    "#4dd0e1",
    "#81c784",
    "#ffd54f",
    "#ff8a65",
    "#ba68c8",
    "#f06292",
    "#90a4ae",
    "#ff5252",
    "#fff176"
  ]
  return colors[level] || "#fff"
}

// ====== AIMING LINE ======
function drawAimingLine() {
  if (!isAiming) return

  let simPos = { x: currentBall.pos.x, y: currentBall.pos.y }
  let simVel = {
    x: (aimStart.x - aimCurrent.x) * 0.08,
    y: (aimStart.y - aimCurrent.y) * 0.08
  }

  ctx.strokeStyle = "rgba(255,255,255,0.4)"
  ctx.beginPath()
  ctx.moveTo(simPos.x, simPos.y)

  for (let i = 0; i < 30; i++) {
    const dx = CENTER.x - simPos.x
    const dy = CENTER.y - simPos.y
    const dist = Math.hypot(dx, dy)
    if (dist < CAPTURE_RADIUS) break

    const nx = dx / dist
    const ny = dy / dist

    simVel.x += nx * G
    simVel.y += ny * G

    simPos.x += simVel.x
    simPos.y += simVel.y
    ctx.lineTo(simPos.x, simPos.y)
  }

  ctx.stroke()
}

// ====== TOUCH INPUT ======
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
  const dx = aimStart.x - aimCurrent.x
  const dy = aimStart.y - aimCurrent.y

  currentBall.vel.x = dx * 0.08
  currentBall.vel.y = dy * 0.08
  currentBall.state = "free"

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
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function randLevel() {
  return Math.floor(Math.random() * 3)
}

// ====== START ======
spawnCurrentBall()
loop()
