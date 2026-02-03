// ====== SETUP ======
const canvas = document.getElementById("game")
const ctx = canvas.getContext("2d")

canvas.width = innerWidth
canvas.height = innerHeight

const CENTER = { x: canvas.width / 2, y: canvas.height * 0.25 }

const CORE_RADIUS = 18
const G = 0.5
const DAMPING = 0.99

let balls = []
let currentBall = null
let nextLevel = randLevel()

let isAiming = false
let aimStart = null
let aimCurrent = null

// ====== BALL FACTORY ======
function createBall(x, y, level, vx = 0, vy = 0) {
  const size = 10 + level * 4
  return {
    pos: { x, y },
    vel: { x: vx, y: vy },
    level,
    size,
    mass: size * size // important
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

// ====== GRAVITY (ALWAYS ON) ======
function applyGravity(ball) {
  const dx = CENTER.x - ball.pos.x
  const dy = CENTER.y - ball.pos.y
  const dist = Math.hypot(dx, dy)

  if (dist < CORE_RADIUS + ball.size) {
    const nx = dx / dist
    const ny = dy / dist
    ball.pos.x = CENTER.x - nx * (CORE_RADIUS + ball.size)
    ball.pos.y = CENTER.y - ny * (CORE_RADIUS + ball.size)
    return
  }

  const nx = dx / dist
  const ny = dy / dist

  ball.vel.x += nx * G
  ball.vel.y += ny * G

  ball.vel.x *= DAMPING
  ball.vel.y *= DAMPING

  ball.pos.x += ball.vel.x
  ball.pos.y += ball.vel.y
}

// ====== RIGID COLLISIONS (NO GAPS) ======
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

        const totalMass = a.mass + b.mass
        const ra = b.mass / totalMass
        const rb = a.mass / totalMass

        a.pos.x -= nx * overlap * ra
        a.pos.y -= ny * overlap * ra
        b.pos.x += nx * overlap * rb
        b.pos.y += ny * overlap * rb

        // impulse transfer (natural nudging)
        const tx = b.vel.x - a.vel.x
        const ty = b.vel.y - a.vel.y
        a.vel.x += tx * 0.02
        a.vel.y += ty * 0.02
        b.vel.x -= tx * 0.02
        b.vel.y -= ty * 0.02

        // merge
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

// ====== TRAJECTORY (TO BLACK HOLE) ======
function drawAimingLine() {
  if (!isAiming) return

  let pos = { ...currentBall.pos }
  let vel = {
    x: (aimStart.x - aimCurrent.x) * 0.05,
    y: (aimStart.y - aimCurrent.y) * 0.05
  }

  for (let i = 0; i < 50; i++) {
    const dx = CENTER.x - pos.x
    const dy = CENTER.y - pos.y
    const dist = Math.hypot(dx, dy)

    if (dist <= CORE_RADIUS + currentBall.size) break

    const nx = dx / dist
    const ny = dy / dist

    vel.x += nx * G
    vel.y += ny * G
    vel.x *= DAMPING
    vel.y *= DAMPING

    pos.x += vel.x
    pos.y += vel.y

    ctx.fillStyle = `rgba(255,255,255,${1 - i / 50})`
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
  const dx = aimStart.x - aimCurrent.x
  const dy = aimStart.y - aimCurrent.y

  currentBall.vel.x = dx * 0.05
  currentBall.vel.y = dy * 0.05

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
