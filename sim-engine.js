function fuelEmpty(s) {
  if (s.fuel <= 0.05) s.fuelEmpty = true;
  else if (s.fuelEmpty && s.fuel >= s.maxFuel * 0.1) s.fuelEmpty = false;
  return !!s.fuelEmpty;
}
function slowFactor(s) {
  let f = 1;
  if (fuelEmpty(s)) f *= 0.28;
  if (s.energy <= 0.5) f *= 0.8;
  return f;
}
function fuelUseOf(s) { return (SHIP_CLASSES[s.shipClass] || SHIP_CLASSES.fighter).fuelUse || 1; }
function w1EnergyCost(s) { return 2.2 + 1.2 * (SHIP_CLASSES[s.shipClass] || SHIP_CLASSES.fighter).dmgMult; }
function getShipSwitchCost(ship, targetClass) {
  const cls = SHIP_CLASSES[targetClass] || SHIP_CLASSES.fighter;
  const sf = 1 + (ship.switchCount || 0) * 0.75;
  return { mat: Math.round(25 * cls.sizeTier * sf), pts: Math.round(6 * cls.sizeTier * sf), en: Math.round(15 * cls.sizeTier * sf) };
}
function abilCost(L) { return { mat: 25 + 20 * L, pts: 6 + 5 * L, en: 10 + 5 * L }; }
function ownedAbils(ship) { return ABIL_KEYS.filter(k => (ship.abil[k] || 0) > 0); }

function addShipCargo(ship, amount) {
  if (amount <= 0) return 0;
  const added = Math.min(Math.max(0, ship.maxCargo - ship.cargo), amount);
  ship.cargo += added; ship.materials = ship.cargo; return added;
}
function removeShipCargo(ship, amount) {
  if (amount <= 0) return 0;
  const removed = Math.min(ship.cargo, amount);
  ship.cargo -= removed; ship.materials = ship.cargo; return removed;
}
function getShipUpgradeCost(ship, key) {
  const def = SHIP_UPGRADE_DEFS.find(d => d.key === key), lvl = (ship.levels[key] || 1) - 1;
  return { mat: def.baseMat + lvl * def.stepMat, pts: def.basePts + lvl * def.stepPts, en: def.baseEn + lvl * def.stepEn };
}
function getBaseUpgradeCost(base, key) {
  const def = BASE_UPGRADE_DEFS.find(d => d.key === key), lvl = base.levels[key] - 1;
  return { mat: def.baseMat + lvl * def.stepMat, pts: def.basePts + lvl * def.stepPts, en: def.baseEn + lvl * def.stepEn };
}

function setSecondaryWeapon(ship, w2Type) {
  if (!ship || !["twin", "seeker", "beam"].includes(w2Type)) return;
  if (gameMode === "online") { sendNetAction({ type: "setW2", w2Type }); return; }
  ship.w2Type = w2Type;
  playToneAt(ship.x, ship.y, 380, 560, 0.1, "triangle", 0.03, true);
}

function switchShipClass(ship, targetClass) {
  if (!ship || !SHIP_CLASSES[targetClass]) return false;
  if (gameMode === "online") { sendNetAction({ type: "switchClass", shipClass: targetClass }); return true; }
  const ownBase = window.state.bases[ship.team];
  if (ship.respawnTimer > 0 || dist(ship, ownBase) > ownBase.radius + 140 || ship.shipClass === targetClass) return false;
  const cost = getShipSwitchCost(ship, targetClass);
  if (ship.materials >= cost.mat && ship.points >= cost.pts && ship.energy >= cost.en) {
    removeShipCargo(ship, cost.mat); ship.points -= cost.pts; ship.energy -= cost.en;
    ship.shipClass = targetClass; ship.switchCount = (ship.switchCount || 0) + 1;
    recalcShipStats(ship, true);
    spawnParticles(ship.x, ship.y, "#7cc4ff", 14, true);
    playToneAt(ship.x, ship.y, 320, 640, 0.16, "triangle", 0.045, true);
    return true;
  }
  return false;
}

function buyShipUpgrade(key, ship = getPlayerRef()) {
  if (!ship) return false;
  if (gameMode === "online" && ship === getPlayerRef()) { sendNetAction({ type: "buyShipUpgrade", key }); return true; }
  if (ship.respawnTimer > 0) return false;
  const cost = getShipUpgradeCost(ship, key);
  if (ship.materials >= cost.mat && ship.points >= cost.pts && ship.energy >= cost.en) {
    removeShipCargo(ship, cost.mat); ship.points -= cost.pts; ship.energy -= cost.en;
    ship.levels[key] = (ship.levels[key] || 1) + 1; ship.points += 4;
    recalcShipStats(ship, false);
    playToneAt(ship.x, ship.y, 440, 660, 0.12, "triangle", 0.04);
    return true;
  }
  return false;
}

function buyBaseUpgrade(key, base, sponsorShip = null) {
  if (!base) return false;
  if (gameMode === "online") { sendNetAction({ type: "buyBaseUpgrade", key }); return true; }
  const cost = getBaseUpgradeCost(base, key);
  const availMat = base.materials + (sponsorShip ? sponsorShip.materials : 0);
  const availPts = base.points + (sponsorShip ? sponsorShip.points : 0);
  if (availMat >= cost.mat && availPts >= cost.pts && base.energy >= cost.en) {
    let rm = cost.mat, fm = Math.min(base.materials, rm); base.materials -= fm; rm -= fm;
    if (rm > 0 && sponsorShip) removeShipCargo(sponsorShip, rm);
    let rp = cost.pts, fp = Math.min(base.points, rp); base.points -= fp; rp -= fp;
    if (rp > 0 && sponsorShip) sponsorShip.points -= rp;
    base.energy -= cost.en; base.levels[key] += 1; base.points += 5;
    recalcBaseStats(base, false);
    playToneAt(base.x, base.y, 280, 520, 0.14, "sine", 0.04, false, 2200);
    return true;
  }
  return false;
}

function buyAbility(key, ship, slot) {
  ship = ship || getPlayerRef();
  if (!ship || !ABIL[key]) return false;
  if (gameMode === "online" && ship === getPlayerRef()) { sendNetAction({ type: "buyAbility", key, slot }); return true; }
  if (ship.respawnTimer > 0) return false;
  const L = ship.abil[key] || 0;
  if (L >= ABIL_MAX) return false;
  let target = null, replaced = null;
  if (L === 0) {
    const freeQ = !ship.slotQ, freeE = !ship.slotE;
    if (freeQ || freeE) {
      if (!slot) target = freeQ ? "Q" : "E";
      else if ((slot === "Q" && freeQ) || (slot === "E" && freeE)) target = slot;
      else return false;
    } else {
      if (slot !== "Q" && slot !== "E") return false;
      target = slot; replaced = slot === "Q" ? ship.slotQ : ship.slotE;
    }
  }
  const c = abilCost(L);
  if (ship.materials >= c.mat && ship.points >= c.pts && ship.energy >= c.en) {
    removeShipCargo(ship, c.mat); ship.points -= c.pts; ship.energy -= c.en;
    if (replaced) { ship.abil[replaced] = 0; ship.abilCd[replaced] = 0; }
    if (target === "Q") ship.slotQ = key; else if (target === "E") ship.slotE = key;
    ship.abil[key] = L + 1;
    playToneAt(ship.x, ship.y, 520, 880, 0.18, "triangle", 0.05, true);
    return true;
  }
  return false;
}

function portalSpotFree(x, y, r, self) {
  const st = window.state;
  if (Math.abs(x) > HALF - 60 || Math.abs(y) > HALF - 60) return false;
  if (Math.hypot(x - st.star.x, y - st.star.y) < st.star.radius + r + 20) return false;
  for (const pl of st.planets) if (Math.hypot(x - pl.x, y - pl.y) < pl.radius + r + 20) return false;
  for (const k of ["blue", "red"]) { const b = st.bases[k]; if (Math.hypot(x - b.x, y - b.y) < b.radius + r + 20) return false; }
  for (const t of st.turrets) if (Math.hypot(x - t.x, y - t.y) < t.radius + r + 20) return false;
  for (const n of st.nodes) if (n.respawnTimer <= 0 && Math.hypot(x - n.x, y - n.y) < n.radius + r + 10) return false;
  for (const s of st.ships) if (s !== self && s.respawnTimer <= 0 && Math.hypot(x - s.x, y - s.y) < s.radius + r + 15) return false;
  if (st.kraken && Math.hypot(x - st.kraken.x, y - st.kraken.y) < st.kraken.radius + r + 30) return false;
  return true;
}

function useAbility(ship, slot) {
  if (!ship) return false;
  if (gameMode === "online" && ship === getPlayerRef()) { sendNetAction({ type: "useAbility", slot }); return true; }
  const st = window.state;
  if (!st || st.gameOver || ship.respawnTimer > 0) return false;
  const key = slot === "Q" ? ship.slotQ : ship.slotE;
  if (!key || !ABIL[key]) return false;
  const L = ship.abil[key] || 0;
  if (L <= 0) return false;
  if ((ship.abilCd[key] || 0) > 0) { playToneAt(ship.x, ship.y, 180, 120, 0.08, "square", 0.03, true); return false; }
  let ok = true;
  if (key === "help") {
    st.flashes = st.flashes || [];
    st.flashes.push({ x: ship.x, y: ship.y, team: ship.team, t: 3, max: 3, ring: 0 });
    for (const s of st.ships) if (s !== ship && s.team === ship.team && s.respawnTimer <= 0) { s.helpT = 8 + 2 * L; s.helpX = ship.x; s.helpY = ship.y; }
    spawnParticles(ship.x, ship.y, "#ffd43b", 16, true);
    [0, 170, 340].forEach((d, i) => setTimeout(() => playToneAt(ship.x, ship.y, 700 + i * 160, 950 + i * 160, 0.14, "square", 0.05, true, 4000), d));
  } else if (key === "cloak") {
    ship.cloakT = 4 + 1.5 * L;
    spawnParticles(ship.x, ship.y, "#b197fc", 14, true);
    playToneAt(ship.x, ship.y, 900, 160, 0.4, "sine", 0.06, true);
  } else if (key === "portal") {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const md = ship.isPlayer ? Math.hypot(mouse.x - cx, mouse.y - cy) : 520;
    const maxD = Math.min(Math.max(md, 160), 450 + 120 * L);
    let fx = null, fy = null;
    for (let k = 0; k <= 16; k++) {
      const d = maxD * (1 - k / 16);
      if (d < 70) break;
      const tx = ship.x + Math.cos(ship.angle) * d, ty = ship.y + Math.sin(ship.angle) * d;
      if (portalSpotFree(tx, ty, ship.radius + 14, ship)) { fx = tx; fy = ty; break; }
    }
    if (fx === null) { ok = false; playToneAt(ship.x, ship.y, 180, 110, 0.12, "square", 0.04, true); }
    else {
      spawnParticles(ship.x, ship.y, "#9775fa", 18, true);
      ship.x = fx; ship.y = fy; ship.vx *= 0.3; ship.vy *= 0.3;
      spawnParticles(fx, fy, "#d0bfff", 18, true);
      playToneAt(fx, fy, 200, 1200, 0.3, "sawtooth", 0.05, true);
    }
  } else if (key === "shield") {
    ship.shieldT = 5 + 1.5 * L; ship.shieldMax = 50 + 70 * L; ship.shieldHp = ship.shieldMax;
    spawnParticles(ship.x, ship.y, "#6fd6ff", 12, true);
    playToneAt(ship.x, ship.y, 300, 800, 0.3, "triangle", 0.06, true);
  } else if (key === "heal") {
    const range = 600 + 150 * L;
    for (const s of st.ships) {
      if (s.team === ship.team && s.respawnTimer <= 0 && Math.hypot(s.x - ship.x, s.y - ship.y) <= range) {
        s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.5);
        spawnParticles(s.x, s.y, "#51e07f", 12, true);
      }
    }
    st.shockwaves.push({ x: ship.x, y: ship.y, r: 10, maxR: range, color: "#51e07f", life: 0.7, maxLife: 0.7 });
  } else if (key === "dmg") {
    ship.dmgBoostT = 6 + 1.5 * L; ship.dmgMult = 1.5 + 0.1 * L;
    spawnParticles(ship.x, ship.y, "#ff8a3d", 14, true);
    playToneAt(ship.x, ship.y, 140, 500, 0.3, "sawtooth", 0.06, true);
  }
  if (ok) ship.abilCd[key] = Math.max(8, ABIL[key].cd(L));
  return ok;
}

function spawnPickups(x, y, count, matValue = 8, ptValue = 4) {
  const st = window.state;
  for (let i = 0; i < count && st.pickups.length < 260; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(25, 130);
    st.pickups.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, radius: 6, mat: matValue, pts: ptValue, life: 45 });
  }
}

function spawnParticles(x, y, color, count = 8, shockwave = false) {
  const st = window.state;
  if (!st) return;
  for (let i = 0; i < count && st.particles.length < 450; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(35, shockwave ? 240 : 165);
    st.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: rand(2, 5.5), life: rand(0.3, 0.75), maxLife: 0.75, color });
  }
  if (shockwave && st.shockwaves && st.shockwaves.length < 60) {
    st.shockwaves.push({ x, y, r: 8, maxR: 85, color, life: 0.38, maxLife: 0.38 });
  }
}

function resolveCircleCollision(a, b, restitution = 0.65) {
  if (!a || !b) return null;
  const dx = (b.x || 0) - (a.x || 0), dy = (b.y || 0) - (a.y || 0), d = Math.hypot(dx, dy);
  const minDist = (a.radius || 10) + (b.radius || 10);
  if (d <= 0.0001 || d >= minDist) return null;
  const nx = dx / d, ny = dy / d, overlap = minDist - d;
  const invA = a.immovable ? 0 : (1 / Math.max(0.1, a.mass || 1));
  const invB = b.immovable ? 0 : (1 / Math.max(0.1, b.mass || 1));
  const invSum = invA + invB;
  if (invSum <= 0) return null;
  a.x -= nx * overlap * (invA / invSum); a.y -= ny * overlap * (invA / invSum);
  b.x += nx * overlap * (invB / invSum); b.y += ny * overlap * (invB / invSum);
  const relNormal = ((b.vx || 0) - (a.vx || 0)) * nx + ((b.vy || 0) - (a.vy || 0)) * ny;
  if (relNormal < 0) {
    const j = (-(1 + restitution) * relNormal) / invSum;
    if (!a.immovable) { a.vx = (a.vx || 0) - j * invA * nx; a.vy = (a.vy || 0) - j * invA * ny; }
    if (!b.immovable) { b.vx = (b.vx || 0) + j * invB * nx; b.vy = (b.vy || 0) + j * invB * ny; }
    return Math.abs(relNormal);
  }
  return 0;
}

function computeTeamCompositeScore(team) {
  const st = window.state;
  const kills = st.teamKills[team] || 0, deaths = st.teamDeaths[team] || 0;
  const kdRatio = (kills + 1) / (deaths + 1);
  const kdPoints = kdRatio * 35 + kills * 12 - deaths * 6;
  const holdTime = st.turretHoldTime[team] || 0;
  const base = st.bases[team];
  const baseHpPct = base.maxHp > 0 ? (base.hp / base.maxHp) : 0;
  const baseArmorPct = base.maxArmor > 0 ? (base.armor / base.maxArmor) : 0;
  const basePoints = baseHpPct * 80 + baseArmorPct * 25;
  const teamPts = st.ships.filter(s => s.team === team).reduce((a, s) => a + (Number.isFinite(s.points) ? s.points : 0), 0) + (Number.isFinite(base.points) ? base.points : 0);
  return { total: Math.round(kdPoints + holdTime * 0.45 + basePoints + teamPts * 0.35), kdRatio: kdRatio.toFixed(2), holdTime: Math.round(holdTime), basePct: Math.round(baseHpPct * 100), teamPts };
}

function recordResult(winnerTeam) {
  const bC = computeTeamCompositeScore("blue"), rC = computeTeamCompositeScore("red"), p = getPlayerRef();
  const list = loadHist();
  list.push({ win: winnerTeam === "blue", bScore: bC.total, rScore: rC.total, kills: p ? (p.kills || 0) : 0, deaths: p ? (p.deaths || 0) : 0, min: Math.round(window.state.matchTime / 6) / 10, diff: settings.diff, d: Date.now() });
  while (list.length > 12) list.shift();
  saveHist(list);
}

function finishMatch(winnerTeam, reasonText) {
  const st = window.state;
  if (!st || st.gameOver) return;
  const p = getPlayerRef();
  const mins = (st.matchTime / 60).toFixed(2);
  st.gameOver = winnerTeam === "blue" ? "KÉK CSAPAT GYŐZÖTT!" : "PIROS CSAPAT GYŐZÖTT!";
  document.getElementById("end-title").textContent = st.gameOver;
  document.getElementById("end-sub").textContent = `${reasonText} | Játékidő: ${fmtClock(st.matchTime)} (${mins} perc) | Pontjaid: ${p ? p.points : 0} | Legyőzött: ${p ? p.kills : 0} | Vesztett: ${p ? p.deaths : 0}`;
  const bComp = computeTeamCompositeScore("blue"), rComp = computeTeamCompositeScore("red");
  document.getElementById("report-stats").innerHTML = `
    <div class="report-box"><strong style="color:#74c0fc;">Kék Csapat Összérték: ${bComp.total}</strong><br>Arány: ${st.teamKills.blue}/${st.teamDeaths.blue} (${bComp.kdRatio})<br>Bázisok tartási idő: ${bComp.holdTime} mp<br>Főbázis: ${bComp.basePct}% | Pont: ${bComp.teamPts}</div>
    <div class="report-box"><strong style="color:#ff8787;">Piros Csapat Összérték: ${rComp.total}</strong><br>Arány: ${st.teamKills.red}/${st.teamDeaths.red} (${rComp.kdRatio})<br>Bázisok tartási idő: ${rComp.holdTime} mp<br>Főbázis: ${rComp.basePct}% | Pont: ${rComp.teamPts}</div>
    <div class="report-box"><strong style="color:#ffd43b;">Saját Teljesítmény (Te)</strong><br>Játékidő: <strong>${fmtClock(st.matchTime)} (${mins} perc)</strong><br>Legyőzött: <strong>${p ? p.kills : 0}</strong> | Vesztett: <strong>${p ? p.deaths : 0}</strong><br>Pontszám: <strong>${p ? p.points : 0}</strong></div>
  `;
  drawReportCharts();
  drawHistoryChart(document.getElementById("chart-last"));
  document.getElementById("overlay").classList.add("show");
  try { recordResult(winnerTeam); } catch (_) {}
}

function getEnergyFireFactor(ship) {
  const ratio = (ship.energy || 0) / Math.max(1, ship.maxEnergy || 100);
  if (ratio <= 0) return { rateMult: 0.25, dmgMult: 0.45, low: true };
  if (ratio < 0.15) return { rateMult: 0.45, dmgMult: 0.7, low: true };
  return { rateMult: 1.0, dmgMult: 1.0, low: false };
}

function dmgMulFor(ship) {
  let m = ship.dmgBoostT > 0 ? ship.dmgMult : 1;
  if (ship.team === "red") m *= D().redDmg;
  return m;
}

function fireWeapon1(ship, aimAngle) {
  const st = window.state;
  if (!ship || ship.w1Cd > 0) return;
  const ef = getEnergyFireFactor(ship);
  ship.energy = Math.max(0, ship.energy - (ship.energy > 0 ? w1EnergyCost(ship) : 0));
  ship.w1Cd = (ship.w1Interval || 0.24) / ef.rateMult;
  const speed = 560;
  if (st.projectiles.length < 360) {
    st.projectiles.push({
      ownerId: ship.id, team: ship.team, kind: "w1",
      x: ship.x + Math.cos(aimAngle) * (ship.radius + 6), y: ship.y + Math.sin(aimAngle) * (ship.radius + 6),
      vx: Math.cos(aimAngle) * speed, vy: Math.sin(aimAngle) * speed,
      dmg: ship.w1Dmg * dmgMulFor(ship) * ef.dmgMult, life: (ship.w1Range || 450) / speed,
      color: ship.team === "blue" ? "#74c0fc" : "#ff8787"
    });
  }
  playToneAt(ship.x, ship.y, 680, 260, 0.07, "square", 0.025);
}

function fireWeapon2(ship, aimAngle) {
  const st = window.state;
  if (!ship || ship.w2Cd > 0) return;
  const ef = getEnergyFireFactor(ship);
  const m = dmgMulFor(ship) * ef.dmgMult;
  const w2Type = ship.w2Type || "twin";
  if (w2Type === "seeker") {
    ship.energy = Math.max(0, ship.energy - (ship.energy > 0 ? 16 : 0));
    ship.w2Cd = (1.15 * (SHIP_CLASSES[ship.shipClass]?.reloadMult || 1)) / ef.rateMult;
    if (st.projectiles.length < 360) {
      st.projectiles.push({
        ownerId: ship.id, team: ship.team, kind: "seeker",
        x: ship.x + Math.cos(aimAngle) * (ship.radius + 8), y: ship.y + Math.sin(aimAngle) * (ship.radius + 8),
        vx: Math.cos(aimAngle) * 430, vy: Math.sin(aimAngle) * 430,
        dmg: ship.w2Dmg * 1.15 * m, life: rand(1.0, 5.0), homingTime: 1.6, color: "#ffa94d"
      });
    }
    playToneAt(ship.x, ship.y, 320, 520, 0.14, "sawtooth", 0.035);
    return;
  }
  if (w2Type === "beam") {
    ship.energy = Math.max(0, ship.energy - (ship.energy > 0 ? 24 : 0));
    ship.w2Cd = (1.85 * (SHIP_CLASSES[ship.shipClass]?.reloadMult || 1)) / ef.rateMult;
    const range = (ship.w2Range || 330) * 1.55;
    const ex = ship.x + Math.cos(aimAngle) * range, ey = ship.y + Math.sin(aimAngle) * range;
    const beamDmg = ship.w2Dmg * 1.9 * m, beamColor = ship.team === "blue" ? "#66d9e8" : "#ff6b6b";
    st.beams.push({ x1: ship.x + Math.cos(aimAngle) * (ship.radius + 6), y1: ship.y + Math.sin(aimAngle) * (ship.radius + 6), x2: ex, y2: ey, color: beamColor, life: 0.16, width: 6 });
    playToneAt(ship.x, ship.y, 920, 210, 0.22, "sawtooth", 0.045);
    const lenSq = Math.max(1, (ex - ship.x) ** 2 + (ey - ship.y) ** 2);
    const hitSeg = (tx, ty, rad) => {
      const t = clamp(((tx - ship.x) * (ex - ship.x) + (ty - ship.y) * (ey - ship.y)) / lenSq, 0, 1);
      return Math.hypot(tx - (ship.x + t * (ex - ship.x)), ty - (ship.y + t * (ey - ship.y))) <= rad + 12;
    };
    for (const s of st.ships) if (s.team !== ship.team && s.respawnTimer <= 0 && hitSeg(s.x, s.y, s.radius)) { damageShip(s, beamDmg, ship); spawnParticles(s.x, s.y, beamColor, 8); }
    const eb = st.bases[ship.team === "blue" ? "red" : "blue"];
    if (hitSeg(eb.x, eb.y, eb.radius)) { damageBase(eb, beamDmg, ship); spawnParticles(eb.x, eb.y, beamColor, 8); }
    for (const n of st.nodes) if (n.respawnTimer <= 0 && hitSeg(n.x, n.y, n.radius)) { damageNode(n, beamDmg, ship); spawnParticles(n.x, n.y, "#ffd43b", 6); }
    return;
  }
  ship.energy = Math.max(0, ship.energy - (ship.energy > 0 ? 12 : 0));
  ship.w2Cd = (ship.w2Interval || 0.75) / ef.rateMult;
  for (const spread of [-0.08, 0.08]) {
    if (st.projectiles.length >= 360) break;
    const a = aimAngle + spread;
    st.projectiles.push({
      ownerId: ship.id, team: ship.team, kind: "w2",
      x: ship.x + Math.cos(a) * (ship.radius + 8), y: ship.y + Math.sin(a) * (ship.radius + 8),
      vx: Math.cos(a) * 440, vy: Math.sin(a) * 440, dmg: ship.w2Dmg * m, life: (ship.w2Range || 330) / 440,
      color: ship.team === "blue" ? "#a5d8ff" : "#ffa8a8"
    });
  }
  playToneAt(ship.x, ship.y, 380, 140, 0.14, "sawtooth", 0.035);
}

function damageNode(node, amount, attackerShip = null) {
  if (!node || node.respawnTimer > 0) return;
  node.hp -= amount;
  if (node.hp > 0) return;
  const matCount = randInt(1, 3);
  spawnPickups(node.x, node.y, matCount, Math.max(4, Math.round(node.rewardMat / matCount)), Math.max(2, Math.round(node.rewardPts / matCount)));
  spawnParticles(node.x, node.y, "#ffd43b", 14, true);
  playExplosionSoundAt(node.x, node.y, false);
  if (attackerShip) attackerShip.points += Math.max(4, Math.round(node.rewardPts * 0.4));
  node.respawnTimer = 6.0;
}

function damageTurret(turret, amount, attackerShip = null) {
  if (!turret) return;
  turret.hp -= amount;
  if (turret.hp > 0) return;
  spawnPickups(turret.x, turret.y, 3, 10, 6);
  spawnParticles(turret.x, turret.y, "#ffa94d", 18, true);
  playExplosionSoundAt(turret.x, turret.y, true);
  if (attackerShip) attackerShip.points += 20;
  turret.owner = null; turret.captureProgress = 0; turret.hp = turret.maxHp;
}

function damageBase(base, amount, attackerShip = null) {
  const st = window.state;
  if (!base || st.gameOver) return;
  base.underAttackTimer = 4.0;
  let rem = amount;
  if (base.armor > 0) { const ab = Math.min(base.armor, rem * 0.7); base.armor -= ab; rem -= ab; }
  base.hp -= rem;
  if (base.hp > 0) return;
  base.hp = 0;
  spawnPickups(base.x, base.y, 6, 12, 8);
  spawnParticles(base.x, base.y, base.team === "blue" ? "#4dabf7" : "#ff6b6b", 30, true);
  playExplosionSoundAt(base.x, base.y, true);
  if (attackerShip) attackerShip.points += 50;
  finishMatch(base.team === "red" ? "blue" : "red", "Az ellenséges főbázis megsemmisült");
}

function damageShip(ship, amount, attackerShip = null) {
  const st = window.state;
  if (!ship || ship.respawnTimer > 0 || st.gameOver) return;
  if (ship.team === "blue") amount *= D().taken;
  if (ship.cloakT > 0) amount *= 0.5;
  let rem = amount;
  if (ship.shieldHp > 0) {
    const ab = Math.min(ship.shieldHp, rem);
    ship.shieldHp -= ab; rem -= ab; ship.shieldHit = 0.25;
    if (ship.shieldHp <= 0) ship.shieldT = 0;
    if (rem <= 0) return;
  }
  if (ship.armor > 0) { const ab = Math.min(ship.armor, rem * 0.75); ship.armor -= ab; rem -= ab; ship.armorHit = 0.2; }
  ship.hp -= rem;
  if (ship.hp > 0) return;
  ship.hp = 0; ship.deaths = (ship.deaths || 0) + 1;
  st.teamDeaths[ship.team] = (st.teamDeaths[ship.team] || 0) + 1;
  if (attackerShip && attackerShip.team !== ship.team) {
    attackerShip.kills = (attackerShip.kills || 0) + 1;
    st.teamKills[attackerShip.team] = (st.teamKills[attackerShip.team] || 0) + 1;
    attackerShip.points += 35; addShipCargo(attackerShip, 15);
  }
  ship.cloakT = 0; ship.shieldT = 0; ship.shieldHp = 0; ship.dmgBoostT = 0; ship.helpT = 0;
  ship.respawnTimer = 5.0; ship.waitingForBuildMat = true; ship.shipClass = "fighter";
  spawnPickups(ship.x, ship.y, 3, 10, 8);
  spawnParticles(ship.x, ship.y, ship.team === "blue" ? "#4dabf7" : "#ff6b6b", 22, true);
  playExplosionSoundAt(ship.x, ship.y, true);
}

function updateOffline(dt) {
  const st = window.state;
  if (!st || st.gameOver || menuOpen) return;
  st.time += dt; st.matchTime += dt;
  soundCd = Math.max(0, soundCd - dt);
  alarmBeepCd = Math.max(0, alarmBeepCd - dt);

  for (const t of st.turrets) if (t.owner === "blue" || t.owner === "red") st.turretHoldTime[t.owner] += dt;

  const nextMinuteSec = Math.max(BASE_MATCH_DURATION, (Math.floor(st.matchTime / 60) + 1) * 60);
  const targetMark = st.matchTime < BASE_MATCH_DURATION ? BASE_MATCH_DURATION : nextMinuteSec;
  const rem = targetMark - st.matchTime;
  if (rem > 0 && rem <= 15) {
    st.timeAlarmText = `IDŐ ALARM: ${Math.ceil(rem)} mp a ${Math.round(targetMark / 60)}. perces határig!`;
    if (alarmBeepCd <= 0) { alarmBeepCd = 1.2; const p = getPlayerRef(); if (p) playToneAt(p.x, p.y, 880, 620, 0.14, "triangle", 0.05, true); }
  } else st.timeAlarmText = "";

  st.historyCd -= dt;
  if (st.historyCd <= 0) {
    st.historyCd = 3.0;
    const bC = computeTeamCompositeScore("blue"), rC = computeTeamCompositeScore("red");
    if (st.history.length > 240) st.history.shift();
    st.history.push({ t: Math.round(st.matchTime), bScore: bC.total, rScore: rC.total, bHp: bC.basePct, rHp: rC.basePct, bKills: st.teamKills.blue, rKills: st.teamKills.red });
  }

  if (st.matchTime >= st.nextJudgeTime) {
    const bC = computeTeamCompositeScore("blue"), rC = computeTeamCompositeScore("red");
    if (Math.abs(bC.total - rC.total) <= 28 && st.matchTime < MAX_MATCH_DURATION) {
      st.targetDuration = Math.min(MAX_MATCH_DURATION, st.nextJudgeTime + 60);
      st.nextJudgeTime += 60;
      st.judgeNote = `Bíró: Szoros (${Math.abs(bC.total - rC.total)} eltérés) — +1p hosszabbítás (${Math.round(st.nextJudgeTime / 60)}:00-ig)`;
    } else {
      finishMatch(bC.total >= rC.total ? "blue" : "red", `Bírói döntés (Kék: ${bC.total} vs Piros: ${rC.total})`);
      return;
    }
  }

  for (const team of ["blue", "red"]) {
    const b = st.bases[team], opp = team === "blue" ? "red" : "blue";
    b.underAttackTimer = Math.max(0, b.underAttackTimer - dt);
    b.noMatAlertTimer = Math.max(0, b.noMatAlertTimer - dt);
    b.fireCd = Math.max(0, b.fireCd - dt);
    b.hp = Math.min(b.maxHp, b.hp + (b.maxHp / 60) * dt);
    b.armor = Math.min(b.maxArmor, b.armor + (b.maxArmor / 60) * dt);
    b.fuel = Math.min(b.maxFuel, b.fuel + (b.maxFuel / 150) * dt);
    b.energy = Math.min(b.maxEnergy, b.energy + (b.maxEnergy / 110) * dt);
    if (b.materials >= 1 && b.energy >= 2) {
      const burn = Math.min(b.materials, 0.8 * dt);
      b.materials -= burn; b.energy = Math.max(0, b.energy - dt);
      b.buildMaterials = Math.min(b.maxStorage, b.buildMaterials + burn * 1.6);
    }
    b.autoUpgradeCd -= dt;
    if (b.autoUpgradeCd <= 0) {
      b.autoUpgradeCd = rand(2.2, 4.8);
      for (const k of [...BASE_UPGRADE_DEFS.map(u => u.key)].sort(() => Math.random() - 0.5)) if (buyBaseUpgrade(k, b, null)) break;
    }
    if (b.fireCd <= 0) {
      const tgt = st.ships.find(s => s.team === opp && s.respawnTimer <= 0 && !(s.cloakT > 0) && dist(b, s) < 470);
      if (tgt && st.projectiles.length < 360) {
        b.fireCd = 0.42;
        const a = Math.atan2(tgt.y - b.y, tgt.x - b.x);
        st.projectiles.push({ ownerId: "base-" + team, team, kind: "base", x: b.x + Math.cos(a) * 62, y: b.y + Math.sin(a) * 62, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, dmg: 26, life: 1.0, color: team === "blue" ? "#74c0fc" : "#ffa8a8" });
      }
    }
    b.droneBuildCd -= dt;
    if (st.drones.filter(d => d.team === team).length < 5 && b.droneBuildCd <= 0 && b.buildMaterials >= 22 && b.energy >= 15) {
      b.droneBuildCd = rand(6, 13); b.buildMaterials -= 22; b.energy -= 15;
      st.drones.push(createDrone(team, b.x + rand(-40, 40), b.y + rand(-40, 40)));
    }
  }

  for (let i = st.drones.length - 1; i >= 0; i--) {
    const dr = st.drones[i], ownB = st.bases[dr.team];
    if (dr.hp <= 0) { st.drones.splice(i, 1); continue; }
    dr.aiTimer -= dt;
    if (!dr.target || dr.aiTimer <= 0) {
      dr.aiTimer = rand(0.3, 0.7);
      const nd = st.nodes.find(n => n.respawnTimer <= 0 && dist(n, ownB) < 900);
      dr.target = dr.cargo >= dr.maxCargo ? ownB : (nd || ownB);
    }
    const dx = dr.target.x - dr.x, dy = dr.target.y - dr.y, d = Math.hypot(dx, dy);
    if (d > 24 && d > 0.001) { dr.vx += (dx / d) * 265 * dt; dr.vy += (dy / d) * 265 * dt; }
    dr.vx *= Math.pow(0.2, dt); dr.vy *= Math.pow(0.2, dt);
    dr.x = clamp(dr.x + dr.vx * dt, -HALF + 20, HALF - 20); dr.y = clamp(dr.y + dr.vy * dt, -HALF + 20, HALF - 20);
    if (d < ownB.radius + 75 && dr.cargo > 0) {
      const del = Math.min(dr.cargo, Math.max(0, ownB.maxStorage - ownB.materials));
      ownB.materials += del; dr.cargo -= del;
    }
  }

  if (!st.kraken) {
    st.krakenSpawnCd -= dt;
    if (st.krakenSpawnCd <= 0) {
      st.krakenSpawnCd = rand(38, 60);
      st.kraken = { x: rand(-1200, 1200), y: rand(-900, 900), vx: 0, vy: 0, radius: 42, mass: 45, hp: 1400, maxHp: 1400, attackCd: 1.0, tentaclePhase: 0 };
    }
  } else {
    const k = st.kraken;
    k.tentaclePhase += dt * 4.2; k.attackCd = Math.max(0, k.attackCd - dt);
    const tgt = st.ships.find(s => s.respawnTimer <= 0 && dist(k, s) < 680);
    if (tgt) {
      const dx = tgt.x - k.x, dy = tgt.y - k.y, d = Math.hypot(dx, dy) || 1;
      k.vx += (dx / d) * 140 * dt; k.vy += (dy / d) * 140 * dt;
      if (k.attackCd <= 0 && d < 340 && st.projectiles.length < 360) {
        k.attackCd = 1.15; const a = Math.atan2(dy, dx);
        st.projectiles.push({ ownerId: "kraken", team: "kraken", kind: "kraken", x: k.x, y: k.y, vx: Math.cos(a) * 390, vy: Math.sin(a) * 390, dmg: 22, life: 1.0, color: "#da77f2" });
      }
    }
    k.vx *= Math.pow(0.25, dt); k.vy *= Math.pow(0.25, dt);
    k.x = clamp(k.x + k.vx * dt, -HALF + 60, HALF - 60); k.y = clamp(k.y + k.vy * dt, -HALF + 60, HALF - 60);
  }

  const player = getPlayerRef();
  const camX = player.x - canvas.width / 2, camY = player.y - canvas.height / 2;

  for (const s of st.ships) {
    s.w1Cd = Math.max(0, s.w1Cd - dt); s.w2Cd = Math.max(0, s.w2Cd - dt);
    s.baseDepositCd = Math.max(0, (s.baseDepositCd || 0) - dt);
    s.cloakT = Math.max(0, (s.cloakT || 0) - dt); s.dmgBoostT = Math.max(0, (s.dmgBoostT || 0) - dt);
    s.shieldHit = Math.max(0, (s.shieldHit || 0) - dt); s.armorHit = Math.max(0, (s.armorHit || 0) - dt);
    if (s.shieldT > 0) { s.shieldT -= dt; if (s.shieldT <= 0) s.shieldHp = 0; }
    if (s.helpT > 0) s.helpT -= dt;
    for (const k of ABIL_KEYS) if ((s.abilCd[k] || 0) > 0) s.abilCd[k] = Math.max(0, s.abilCd[k] - dt);

    if (s.respawnTimer > 0) {
      s.respawnTimer -= dt;
      if (s.respawnTimer <= 0) {
        const b = st.bases[s.team];
        if (b.buildMaterials >= 35) {
          b.buildMaterials -= 35; s.waitingForBuildMat = false; s.shipClass = "fighter";
          s.x = b.x + rand(-70, 70); s.y = b.y + rand(-70, 70); s.vx = 0; s.vy = 0;
          recalcShipStats(s, true);
        } else { s.respawnTimer = 1.0; s.waitingForBuildMat = true; }
      }
      continue;
    }

    const slow = slowFactor(s), fuelUse = fuelUseOf(s);
    if (s.isPlayer) {
      s.angle = Math.atan2((mouse.y + camY) - s.y, (mouse.x + camX) - s.x);
      let ax = (keys["KeyD"] || keys["ArrowRight"] ? 1 : 0) - (keys["KeyA"] || keys["ArrowLeft"] ? 1 : 0);
      let ay = (keys["KeyS"] || keys["ArrowDown"] ? 1 : 0) - (keys["KeyW"] || keys["ArrowUp"] ? 1 : 0);
      if (ax || ay) {
        const l = Math.hypot(ax, ay); ax /= l; ay /= l;
        s.vx += ax * s.thrustBase * s.throttle * slow * dt;
        s.vy += ay * s.thrustBase * s.throttle * slow * dt;
        if (s.fuel > 0) s.fuel = Math.max(0, s.fuel - 2.6 * fuelUse * s.throttle * dt);
      }
      if (mouse.downLeft) fireWeapon1(s, s.angle);
      if (mouse.downRight || keys["Space"]) fireWeapon2(s, s.angle);
    } else {
      s.aiTimer -= dt;
      const opp = s.team === "blue" ? "red" : "blue", ownB = st.bases[s.team], enemyB = st.bases[opp];
      if (!s.aiTarget || s.aiTimer <= 0) {
        s.aiTimer = rand(0.45, 1.0);
        const en = st.ships.find(o => o.team === opp && o.respawnTimer <= 0 && !(o.cloakT > 0) && dist(s, o) < 600);
        if (s.hp < s.maxHp * 0.35 || s.cargo >= s.maxCargo) s.aiTarget = ownB;
        else if (en) s.aiTarget = en;
        else s.aiTarget = enemyB;
      }
      const dx = s.aiTarget.x - s.x, dy = s.aiTarget.y - s.y, d = Math.hypot(dx, dy) || 1;
      s.angle = Math.atan2(dy, dx);
      if (d > 140) {
        s.vx += (dx / d) * s.thrustBase * 0.85 * slow * dt;
        s.vy += (dy / d) * s.thrustBase * 0.85 * slow * dt;
        if (s.fuel > 0) s.fuel = Math.max(0, s.fuel - 2.2 * fuelUse * dt);
      }
      if (d < s.w1Range) { fireWeapon1(s, s.angle); if (d < s.w2Range) fireWeapon2(s, s.angle); }
      if (Math.random() < 0.05) buyShipUpgrade(SHIP_UPGRADE_DEFS[randInt(0, SHIP_UPGRADE_DEFS.length - 1)].key, s);
    }

    const nearN = st.nodes.find(n => n.respawnTimer <= 0 && dist(s, n) < s.miningRange);
    if (nearN && st.beams.length < 180) {
      st.beams.push({ x1: s.x, y1: s.y, x2: nearN.x, y2: nearN.y, color: "#74c0fc", life: 0.06 });
      damageNode(nearN, s.miningDps * dt, s);
    }

    s.vx *= Math.pow(0.18, dt); s.vy *= Math.pow(0.18, dt);
    const maxSpd = s.maxSpeed * (s.isPlayer ? s.throttle : 1) * slow, spd = Math.hypot(s.vx, s.vy);
    if (spd > maxSpd && spd > 0.001) { s.vx = (s.vx / spd) * maxSpd; s.vy = (s.vy / spd) * maxSpd; }
    s.x = clamp(s.x + s.vx * dt, -HALF + 30, HALF - 30); s.y = clamp(s.y + s.vy * dt, -HALF + 30, HALF - 30);

    const ownB = st.bases[s.team];
    if (dist(s, ownB) < ownB.radius + 130) {
      if (s.baseDepositCd <= 0 && s.cargo >= 5) {
        s.baseDepositCd = 1.2;
        const tax = removeShipCargo(s, Math.max(2, Math.floor(s.cargo * 0.25)));
        ownB.materials = Math.min(ownB.maxStorage, ownB.materials + tax);
      }
      s.hp = Math.min(s.maxHp, s.hp + 26 * dt); s.armor = Math.min(s.maxArmor, s.armor + 22 * dt);
      s.fuel = Math.min(s.maxFuel, s.fuel + 16 * dt); s.energy = Math.min(s.maxEnergy, s.energy + 22 * dt);
    } else {
      s.hp = Math.min(s.maxHp, s.hp + s.regenRate * 0.35 * dt);
      s.armor = Math.min(s.maxArmor, s.armor + s.regenRate * 0.45 * dt);
      s.energy = Math.min(s.maxEnergy, s.energy + 3.2 * dt);
    }
  }

  for (const n of st.nodes) {
    if (n.respawnTimer > 0) { n.respawnTimer -= dt; if (n.respawnTimer <= 0) placeNodeEnteringSystem(n); continue; }
    n.rot += n.rotSpeed * dt; n.x += n.vx * dt; n.y += n.vy * dt;
    if (Math.abs(n.x) > HALF + 220 || Math.abs(n.y) > HALF + 220) placeNodeEnteringSystem(n);
  }

  const activeShips = st.ships.filter(s => s.respawnTimer <= 0);
  for (let i = 0; i < activeShips.length; i++) {
    for (let j = i + 1; j < activeShips.length; j++) {
      const imp = resolveCircleCollision(activeShips[i], activeShips[j], 0.7);
      if (imp && imp > 55) { damageShip(activeShips[i], imp * 0.14, activeShips[j]); damageShip(activeShips[j], imp * 0.14, activeShips[i]); }
    }
  }

  for (const t of st.turrets) {
    t.fireCd = Math.max(0, t.fireCd - dt);
    let bN = 0, rN = 0;
    for (const s of activeShips) if (dist(s, t) < 135) { if (s.team === "blue") bN++; else rN++; }
    if (bN > rN) t.captureProgress = clamp(t.captureProgress + (18 + bN * 6) * dt, -100, 100);
    else if (rN > bN) t.captureProgress = clamp(t.captureProgress - (18 + rN * 6) * dt, -100, 100);
    if (t.captureProgress >= 60) t.owner = "blue"; else if (t.captureProgress <= -60) t.owner = "red"; else if (Math.abs(t.captureProgress) < 15) t.owner = null;
    if (t.owner && t.fireCd <= 0) {
      const tgt = activeShips.find(s => s.team !== t.owner && !(s.cloakT > 0) && dist(s, t) < 420);
      if (tgt && st.projectiles.length < 360) {
        t.fireCd = 0.85; const a = Math.atan2(tgt.y - t.y, tgt.x - t.x);
        st.projectiles.push({ ownerId: "turret-" + t.id, team: t.owner, kind: "turret", x: t.x, y: t.y, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, dmg: 18, life: 1.0, color: t.owner === "blue" ? "#4dabf7" : "#ff6b6b" });
      }
    }
  }

  for (let i = st.pickups.length - 1; i >= 0; i--) {
    const pk = st.pickups[i]; pk.life -= dt;
    if (pk.life <= 0) { st.pickups.splice(i, 1); continue; }
    for (const s of activeShips) {
      if (s.cargo >= s.maxCargo) continue;
      const d = Math.hypot(s.x - pk.x, s.y - pk.y);
      if (d < 110 && d > 1) { pk.vx += ((s.x - pk.x) / d) * 260 * dt; pk.vy += ((s.y - pk.y) / d) * 260 * dt; }
      if (d < s.radius + pk.radius + 6 && addShipCargo(s, pk.mat) > 0) { s.points += pk.pts; st.pickups.splice(i, 1); break; }
    }
    if (st.pickups[i]) { pk.x = clamp(pk.x + pk.vx * dt, -HALF + 20, HALF - 20); pk.y = clamp(pk.y + pk.vy * dt, -HALF + 20, HALF - 20); }
  }

  for (let i = st.projectiles.length - 1; i >= 0; i--) {
    const p = st.projectiles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0) { st.projectiles.splice(i, 1); continue; }
    const att = st.ships.find(s => s.id === p.ownerId) || null;
    let hit = false;
    if (st.kraken && p.team !== "kraken" && Math.hypot(st.kraken.x - p.x, st.kraken.y - p.y) < st.kraken.radius + 6) {
      st.kraken.hp -= p.dmg;
      if (st.kraken.hp <= 0) { spawnPickups(st.kraken.x, st.kraken.y, 8, 16, 12); spawnParticles(st.kraken.x, st.kraken.y, "#da77f2", 30, true); st.kraken = null; }
      hit = true;
    }
    if (!hit) for (const s of activeShips) if (s.team !== p.team && Math.hypot(s.x - p.x, s.y - p.y) < s.radius + 5) { damageShip(s, p.dmg, att); hit = true; break; }
    if (!hit) for (const tk of ["blue", "red"]) if (tk !== p.team && Math.hypot(st.bases[tk].x - p.x, st.bases[tk].y - p.y) < st.bases[tk].radius + 4) { damageBase(st.bases[tk], p.dmg, att); hit = true; break; }
    if (!hit) for (const n of st.nodes) if (n.respawnTimer <= 0 && Math.hypot(n.x - p.x, n.y - p.y) < n.radius + 5) { damageNode(n, p.dmg, att); hit = true; break; }
    if (hit) st.projectiles.splice(i, 1);
  }

  for (let i = st.beams.length - 1; i >= 0; i--) { st.beams[i].life -= dt; if (st.beams[i].life <= 0) st.beams.splice(i, 1); }
  for (let i = st.particles.length - 1; i >= 0; i--) {
    const pt = st.particles[i]; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
    if (pt.life <= 0) st.particles.splice(i, 1);
  }
  for (let i = st.shockwaves.length - 1; i >= 0; i--) {
    const sw = st.shockwaves[i]; sw.life -= dt; sw.r += (sw.maxR - sw.r) * Math.min(1, dt * 11);
    if (sw.life <= 0) st.shockwaves.splice(i, 1);
  }
}

function updateOnlineVisuals(dt) {
  const st = window.state;
  if (!st || !st.ships) return;
  st.time += dt;
  for (const s of st.ships) {
    if (s.respawnTimer > 0) continue;
    s.x = clamp(s.x + (s.vx || 0) * dt, -HALF + 30, HALF - 30);
    s.y = clamp(s.y + (s.vy || 0) * dt, -HALF + 30, HALF - 30);
    if (typeof s.targetX === "number" && typeof s.targetY === "number") {
      const blend = Math.min(1, dt * 12);
      s.x += (s.targetX - s.x) * blend;
      s.y += (s.targetY - s.y) * blend;
    }
  }
  for (let i = st.beams.length - 1; i >= 0; i--) { st.beams[i].life -= dt; if (st.beams[i].life <= 0) st.beams.splice(i, 1); }
  for (let i = st.particles.length - 1; i >= 0; i--) {
    const pt = st.particles[i]; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
    if (pt.life <= 0) st.particles.splice(i, 1);
  }
  for (let i = st.shockwaves.length - 1; i >= 0; i--) {
    const sw = st.shockwaves[i]; sw.life -= dt; sw.r += (sw.maxR - sw.r) * Math.min(1, dt * 11);
    if (sw.life <= 0) st.shockwaves.splice(i, 1);
  }
}
