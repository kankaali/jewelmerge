function drawTrajectory() {
  if (!isAiming) return

  let pos = { ...currentBall.pos }
  let vel = {
    x: (aimStart.x - aimCurrent.x) * 0.03,
    y: (aimStart.y - aimCurrent.y) * 0.03
  }

  for (let i = 0; i < 180; i++) {
    const fake = {
      pos: { ...pos },
      vel: { ...vel },
      size: currentBall.size
    }

    applyPhysics(fake)
    pos = fake.pos
    vel = fake.vel

    ctx.fillStyle = `rgba(255,255,255,${1 - i / 180})`
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2)
    ctx.fill()

    // stop ONLY when touching blackhole
    if (Math.hypot(
      pos.x - CENTER.x,
      pos.y - CENTER.y
    ) < CORE_RADIUS + currentBall.size) break
  }
}
