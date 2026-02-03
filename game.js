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

// ====== BALL FACTORY ======
function createBall(x, y, level, vx = 0, vy = 0) {
  return {
    pos: { x, y },
    vel: { x: vx, y: vy },
    level,
    size: 10 + level * 4,
    state: "free",
    angle: 0,
    angularSpeed: 0
  }
}

// ====== UPDATE LOOP ======
function update() {
  for (let ball of balls) {

    if (ball.state === "free") {
      applyGravity(ball)
    }

    if (ball.state === "orbiting") {
      orbit(ball)
    }
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

// ====== UTILS ======
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function randLevel() {
  return Math.floor(Math.random() * 3)
}
