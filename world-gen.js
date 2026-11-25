function createAsteroidShape(radius) {
  const vertices = randInt(7, 13), shape = [];
  for (let i = 0; i < vertices; i++) shape.push({ ang: (i / vertices) * Math.PI * 2, r: radius * rand(0.68, 1.28) });
  return shape;
}

function placeNodeEnteringSystem(n) {
  const side = randInt(0, 3), margin = 120;
  let sx = 0, sy = 0;
  if (side === 0) { sx = rand(-HALF + 150, HALF - 150); sy = -HALF - margin; }
  else if (side === 1) { sx = HALF + margin; sy = rand(-HALF + 150, HALF - 150); }
  else if (side === 2) { sx = rand(-HALF + 150, HALF - 150); sy = HALF + margin; }
  else { sx = -HALF - margin; sy = rand(-HALF + 150, HALF - 150); }
  const ang = Math.atan2(rand(-HALF * 0.65, HALF * 0.65) - sy, rand(-HALF * 0.65, HALF * 0.65) - sx) + rand(-0.22, 0.22);
  const sp = n.type === "asteroid" ? rand(24, 76) : rand(14, 34);
  n.x = sx; n.y = sy; n.vx = Math.cos(ang) * sp; n.vy = Math.sin(ang) * sp;
  n.hp = n.maxHp; n.respawnTimer = 0; n.dropCooldown = 0;
  if (n.type === "asteroid") n.shape = createAsteroidShape(n.radius);
}

function recalcBaseStats(b, fill = false) {
  const prevHp = b.maxHp, prevAr = b.maxArmor;
  b.maxHp = 2600 + (b.levels.hp - 1) * 500;
  b.maxArmor = 900 + (b.levels.armor - 1) * 250;
  b.maxStorage = 400 + (b.levels.storage - 1) * 200;
  b.maxEnergy = 500 + (b.levels.energy - 1) * 200;
  b.maxFuel = 500 + (b.levels.fuel - 1) * 200;
  if (fill) { b.hp = b.maxHp; b.armor = b.maxArmor; }
  else {
    b.hp = clamp(b.hp + Math.max(0, b.maxHp - prevHp), 0, b.maxHp);
    b.armor = clamp(b.armor + Math.max(0, b.maxArmor - prevAr), 0, b.maxArmor);
  }
}

function createBase(team, name, x, y) {
  const b = {
    team, name, x, y, vx: 0, vy: 0, radius: 56, mass: 500, immovable: true,
    levels: { hp: 1, armor: 1, storage: 1, energy: 1, fuel: 1 },
    maxHp: 1500, hp: 1500, maxArmor: 500, armor: 500,
    maxStorage: 400, materials: 120, buildMaterials: 80,
    maxEnergy: 500, energy: 300, maxFuel: 500, fuel: 220, points: 50,
    underAttackTimer: 0, noMatAlertTimer: 0,
    droneBuildCd: rand(5, 11), autoUpgradeCd: rand(2.5, 5.5), fireCd: rand(0.2, 0.8), dropCooldown: 0
  };
  recalcBaseStats(b, true);
  return b;
}

function createDrone(team, x, y) {
  return {
    team, x, y, vx: rand(-20, 20), vy: rand(-20, 20), radius: 7, mass: 0.7,
    hp: 65, maxHp: 65, cargo: 0, maxCargo: 16, aiTimer: rand(0.2, 0.8), target: null
  };
}

function recalcShipStats(s, fill = false) {
  const cls = SHIP_CLASSES[s.shipClass] || SHIP_CLASSES.fighter;
  const prevHp = s.maxHp, prevAr = s.maxArmor, prevFu = s.maxFuel, prevEn = s.maxEnergy;
  s.radius = cls.radius; s.mass = cls.mass;
  s.maxHp = Math.round((180 + (s.levels.hp - 1) * 45) * cls.hpMult);
  s.maxArmor = Math.round((100 + (s.levels.armor - 1) * 35) * cls.armorMult);
  s.maxFuel = Math.round((100 + (s.levels.fuel - 1) * 35) * (cls.fuelMult || 1));
  s.maxEnergy = Math.round((140 + (s.levels.energy - 1) * 35) * (cls.energyMult || 1));
  s.regenRate = (3.5 + (s.levels.regen - 1) * 2.2) * cls.regenMult;
  s.w1Dmg = (15 + (s.levels.w1 - 1) * 4) * cls.dmgMult;
  s.w2Dmg = (26 + (s.levels.w2 - 1) * 6.5) * cls.dmgMult;
  s.w1Interval = 0.24 * cls.reloadMult;
  s.w2Interval = 0.75 * cls.reloadMult;
  s.w1Range = 450 * cls.rangeMult;
  s.w2Range = 330 * cls.rangeMult;
  s.maxSpeed = (290 + (s.levels.speed - 1) * 35) * cls.speedMult;
  s.thrustBase = (280 + (s.levels.speed - 1) * 32) * cls.thrustMult;
  s.miningDps = 38 + (s.levels.mining - 1) * 14;
  s.miningRange = (190 + (s.levels.mining - 1) * 16) * cls.rangeMult;
  s.maxCargo = (cls.baseCargo || 55) + ((s.levels.cargo || 1) - 1) * 30;
  s.cargo = clamp(s.materials || 0, 0, s.maxCargo);
  s.materials = s.cargo;
  if (fill) { s.hp = s.maxHp; s.armor = s.maxArmor; s.fuel = s.maxFuel; s.energy = s.maxEnergy; }
  else {
    s.hp = clamp(s.hp + Math.max(0, s.maxHp - prevHp), 0, s.maxHp);
    s.armor = clamp(s.armor + Math.max(0, s.maxArmor - prevAr), 0, s.maxArmor);
    s.fuel = clamp(s.fuel + Math.max(0, s.maxFuel - prevFu), 0, s.maxFuel);
    s.energy = clamp(s.energy + Math.max(0, s.maxEnergy - prevEn), 0, s.maxEnergy);
  }
}

function createShip(id, team, shipClass, x, y, isPlayer = false) {
  const w2Pool = ["twin", "seeker", "beam"];
  const s = {
    id, team, shipClass, isPlayer,
    w2Type: isPlayer ? "twin" : w2Pool[randInt(0, w2Pool.length - 1)],
    switchCount: 0, kills: 0, deaths: 0,
    x, y, vx: 0, vy: 0, angle: team === "blue" ? 0 : Math.PI, radius: 12, mass: 1.4,
    levels: { hp: 1, armor: 1, w1: 1, w2: 1, regen: 1, fuel: 1, energy: 1, speed: 1, mining: 1, cargo: 1 },
    maxHp: 120, hp: 120, maxArmor: 80, armor: 80, maxFuel: 100, fuel: 100, maxEnergy: 100, energy: 100, regenRate: 4,
    w1Dmg: 16, w1Cd: 0, w1Interval: 0.24, w1Range: 440, w2Dmg: 28, w2Cd: 0, w2Interval: 0.75, w2Range: 340,
    maxSpeed: 290, thrustBase: 280, throttle: 1.0, miningDps: 38, miningRange: 190,
    maxCargo: 55, cargo: 45, points: 10, materials: 45,
    respawnTimer: 0, waitingForBuildMat: false, baseDepositCd: 0,
    aiTimer: rand(0.2, 0.8), aiTarget: null, miningBeamTarget: null, dropCooldown: 0,
    abil: {}, abilCd: {}, slotQ: null, slotE: null, cloakT: 0, shieldT: 0, shieldHp: 0, shieldMax: 1, shieldHit: 0, armorHit: 0,
    aiAbT: undefined, aiBuyT: undefined, dmgBoostT: 0, dmgMult: 1, helpT: 0, helpX: 0, helpY: 0, fuelEmpty: false
  };
  recalcShipStats(s, true);
  return s;
}

function generateSolarSystem() {
  const bgThemes = [
    { bg: "#060816", neb1: "rgba(92, 54, 168, 0.16)", neb2: "rgba(42, 98, 196, 0.12)", neb3: "rgba(140, 48, 145, 0.11)" },
    { bg: "#050c18", neb1: "rgba(24, 96, 178, 0.17)", neb2: "rgba(56, 48, 152, 0.13)", neb3: "rgba(22, 132, 168, 0.11)" },
    { bg: "#090614", neb1: "rgba(116, 42, 156, 0.17)", neb2: "rgba(68, 46, 148, 0.14)", neb3: "rgba(168, 62, 118, 0.10)" },
    { bg: "#050d14", neb1: "rgba(20, 118, 158, 0.15)", neb2: "rgba(52, 72, 168, 0.13)", neb3: "rgba(88, 48, 158, 0.11)" }
  ];
  const theme = bgThemes[randInt(0, bgThemes.length - 1)];
  const star = { x: rand(-350, 350), y: rand(-350, 350), radius: rand(95, 135), color: ["#ffd43b", "#ffa94d", "#74c0fc", "#ff8787"][randInt(0, 3)], vx: 0, vy: 0, mass: 99999, immovable: true };
  const planets = [];
  for (let i = 0; i < randInt(3, 6); i++) {
    const ang = rand(0, Math.PI * 2), radDist = rand(520, 1750), pRadius = rand(34, 72);
    planets.push({
      x: star.x + Math.cos(ang) * radDist, y: star.y + Math.sin(ang) * radDist, radius: pRadius,
      color: ["#4c6ef5", "#2b8a3e", "#c92a2a", "#ae3ec9", "#15aabf", "#d9480f"][i % 6],
      vx: 0, vy: 0, mass: pRadius * 12, immovable: true, hp: pRadius * 25, maxHp: pRadius * 25, dropCooldown: 0
    });
  }
  const nebulae = Array.from({ length: 14 }, (_, idx) => ({
    x: rand(-HALF * 0.85, HALF * 0.85), y: rand(-HALF * 0.85, HALF * 0.85), radius: rand(240, 520),
    color: idx % 3 === 0 ? theme.neb1 : (idx % 3 === 1 ? theme.neb2 : theme.neb3)
  }));
  const blueBase = createBase("blue", "Kék Főbázis", -1650 + rand(-180, 180), rand(-600, 600));
  const redBase = createBase("red", "Piros Főbázis", 1650 + rand(-180, 180), rand(-600, 600));
  const turretSpots = [{ x: -850, y: -750 }, { x: -850, y: 750 }, { x: 0, y: 0 }, { x: 850, y: -750 }, { x: 850, y: 750 }];
  const turrets = turretSpots.map((sp, i) => ({
    id: i + 1, x: sp.x + rand(-220, 220), y: sp.y + rand(-220, 220), vx: 0, vy: 0, radius: 28, mass: 80, immovable: true,
    owner: null, captureProgress: 0, fireCd: rand(0.2, 1.0), hp: 400, maxHp: 400, dropCooldown: 0
  }));
  const nodes = [];
  for (let i = 0; i < 65; i++) {
    const type = i < 42 ? "asteroid" : (i < 54 ? "container" : "wreck");
    const radius = type === "asteroid" ? rand(13, 34) : rand(14, 21);
    const speedRange = type === "asteroid" ? rand(18, 72) : rand(10, 28);
    const moveAng = rand(0, Math.PI * 2);
    const maxHp = type === "asteroid" ? Math.round(radius * 3.2) : (type === "container" ? randInt(40, 70) : randInt(70, 120));
    nodes.push({
      id: i + 1, type, x: rand(-HALF + 220, HALF - 220), y: rand(-HALF + 220, HALF - 220),
      vx: Math.cos(moveAng) * speedRange, vy: Math.sin(moveAng) * speedRange,
      radius, mass: Math.max(1.2, (radius * radius) / 140), immovable: false,
      rot: rand(0, Math.PI * 2), rotSpeed: rand(-1.4, 1.4),
      shape: type === "asteroid" ? createAsteroidShape(radius) : null,
      hp: maxHp, maxHp,
      rewardMat: type === "container" ? randInt(18, 32) : (type === "wreck" ? randInt(15, 28) : Math.max(8, Math.round(radius * 0.7))),
      rewardPts: type === "wreck" ? 25 : (type === "container" ? 20 : 12),
      respawnTimer: 0, dropCooldown: 0
    });
  }
  const bgStars = Array.from({ length: 280 }, () => ({ x: rand(-HALF, HALF), y: rand(-HALF, HALF), size: rand(0.8, 2.4), alpha: rand(0.25, 0.92) }));
  const rosterClasses = ["fighter", "fighter", "cruiser", "cruiser", "battleship"];
  const ships = [];
  for (let i = 0; i < 5; i++) ships.push(createShip("B" + (i + 1), "blue", i === 0 ? "fighter" : rosterClasses[i], blueBase.x + 95, blueBase.y + (i - 2) * 55, i === 0));
  for (let i = 0; i < 5; i++) ships.push(createShip("R" + (i + 1), "red", rosterClasses[i], redBase.x - 95, redBase.y + (i - 2) * 55, false));
  const drones = [
    createDrone("blue", blueBase.x + 40, blueBase.y - 40),
    createDrone("blue", blueBase.x + 40, blueBase.y + 40),
    createDrone("red", redBase.x - 40, redBase.y - 40),
    createDrone("red", redBase.x - 40, redBase.y + 40)
  ];

  window.state = {
    myShipId: "B1",
    theme, nebulae, star, planets, bgStars,
    bases: { blue: blueBase, red: redBase },
    turrets, nodes, ships, drones,
    pickups: [], projectiles: [], beams: [], particles: [], shockwaves: [], flashes: [],
    kraken: null, krakenSpawnCd: rand(16, 28), balanceCd: 3.0,
    matchTime: 0, targetDuration: BASE_MATCH_DURATION, nextJudgeTime: BASE_MATCH_DURATION,
    judgeNote: `Bíró: ${fmtClock(BASE_MATCH_DURATION)}-nál bírálat (összérték)`,
    timeAlarmText: "",
    teamKills: { blue: 0, red: 0 }, teamDeaths: { blue: 0, red: 0 }, turretHoldTime: { blue: 0, red: 0 },
    history: [{ t: 0, bScore: 0, rScore: 0, bHp: 100, rHp: 100, bKills: 0, rKills: 0 }],
    historyCd: 0, gameOver: null, time: 0, started: false
  };
  const ov = document.getElementById("overlay");
  if (ov) ov.classList.remove("show");
}
