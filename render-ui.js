const canvas = document.getElementById("game");
const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
const mmCanvas = document.getElementById("minimap");
const mmCtx = mmCanvas && mmCanvas.getContext ? mmCanvas.getContext("2d") : null;
const miniSmallCanvas = document.getElementById("mini-map-small");
const miniSmallCtx = miniSmallCanvas && miniSmallCanvas.getContext ? miniSmallCanvas.getContext("2d") : null;
const chartScoreCanvas = document.getElementById("chart-score");
const chartScoreCtx = chartScoreCanvas && chartScoreCanvas.getContext ? chartScoreCanvas.getContext("2d") : null;
const chartBasesCanvas = document.getElementById("chart-bases");
const chartBasesCtx = chartBasesCanvas && chartBasesCanvas.getContext ? chartBasesCanvas.getContext("2d") : null;

function resize() {
  if (!canvas) return;
  canvas.width = Math.max(300, window.innerWidth);
  canvas.height = Math.max(200, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

let uiMode = "normal";
function setUiMode(mode) {
  uiMode = mode;
  document.body.classList.toggle("ui-off", mode === "off");
  document.body.classList.toggle("ui-mini", mode === "mini");
  document.getElementById("btn-mode-off").classList.toggle("active-mode", mode === "off");
  document.getElementById("btn-mode-mini").classList.toggle("active-mode", mode === "mini");
  document.getElementById("btn-mode-normal").classList.toggle("active-mode", mode === "normal");
}
document.getElementById("btn-mode-off").onclick = () => setUiMode("off");
document.getElementById("btn-mode-mini").onclick = () => setUiMode("mini");
document.getElementById("btn-mode-normal").onclick = () => setUiMode("normal");

const upgListShipEl = document.getElementById("upg-list-ship");
const upgListBaseEl = document.getElementById("upg-list-base");
const abilListEl = document.getElementById("upg-list-abil");
const shipUpgBtns = {}, baseUpgBtns = {}, abilRows = {};

SHIP_UPGRADE_DEFS.forEach(u => {
  const row = document.createElement("div"); row.className = "upg-item";
  const info = document.createElement("span"); info.id = "ship-upg-info-" + u.key;
  const btn = document.createElement("button"); btn.textContent = "Fejleszt";
  btn.onclick = () => buyShipUpgrade(u.key);
  shipUpgBtns[u.key] = btn; row.append(info, btn); upgListShipEl.appendChild(row);
});

BASE_UPGRADE_DEFS.forEach(u => {
  const row = document.createElement("div"); row.className = "upg-item";
  const info = document.createElement("span"); info.id = "base-upg-info-" + u.key;
  const btn = document.createElement("button"); btn.textContent = "Fejleszt";
  btn.onclick = () => {
    const st = window.state, p = getPlayerRef();
    buyBaseUpgrade(u.key, st ? st.bases[p ? p.team : "blue"] : null, p);
  };
  baseUpgBtns[u.key] = btn; row.append(info, btn); upgListBaseEl.appendChild(row);
});

const abilHint = document.createElement("div");
abilHint.style.cssText = "font-size:9px;color:#9fb3c8;margin-bottom:2px;";
abilHint.textContent = "Max 2 képesség: válassz Q vagy E gombot. Ár: anyag/pont/energia.";
abilListEl.appendChild(abilHint);

ABIL_KEYS.forEach(k => {
  const row = document.createElement("div"); row.className = "upg-item"; row.title = ABIL[k].desc;
  const info = document.createElement("span");
  const box = document.createElement("div"); box.style.cssText = "display:flex;gap:3px;";
  const buy = document.createElement("button"); buy.onclick = () => buyAbility(k);
  const bq = document.createElement("button"); bq.textContent = "Q"; bq.onclick = () => buyAbility(k, null, "Q");
  const be = document.createElement("button"); be.textContent = "E"; be.onclick = () => buyAbility(k, null, "E");
  box.append(buy, bq, be); row.append(info, box); abilListEl.appendChild(row);
  abilRows[k] = { info, buy, bq, be };
});

function showAbilTab(on) {
  abilListEl.style.display = on ? "block" : "none";
  document.getElementById("tab-abil").classList.toggle("active-tab", on);
  if (on) {
    upgListShipEl.style.display = "none"; upgListBaseEl.style.display = "none";
    document.getElementById("tab-ship").classList.remove("active-tab");
    document.getElementById("tab-base").classList.remove("active-tab");
  }
}
document.getElementById("tab-ship").onclick = () => { showAbilTab(false); upgListShipEl.style.display = "block"; upgListBaseEl.style.display = "none"; document.getElementById("tab-ship").classList.add("active-tab"); document.getElementById("tab-base").classList.remove("active-tab"); };
document.getElementById("tab-base").onclick = () => { showAbilTab(false); upgListShipEl.style.display = "none"; upgListBaseEl.style.display = "block"; document.getElementById("tab-base").classList.add("active-tab"); document.getElementById("tab-ship").classList.remove("active-tab"); };
document.getElementById("tab-abil").onclick = () => showAbilTab(true);
document.getElementById("btn-toggle-upg").onclick = () => document.getElementById("upgrades").classList.toggle("collapsed");

function refreshAbilUI(p) {
  if (!p) return;
  p.abil = p.abil || {}; p.abilCd = p.abilCd || {};
  const freeQ = !p.slotQ, freeE = !p.slotE, full = !freeQ && !freeE;
  for (const k of ABIL_KEYS) {
    const r = abilRows[k], L = p.abil[k] || 0, cd = p.abilCd[k] || 0, c = abilCost(L);
    const afford = p.materials >= c.mat && p.points >= c.pts && p.energy >= c.en;
    const costTxt = c.mat + "/" + c.pts + "/" + c.en;
    if (L > 0) {
      r.info.textContent = ABIL[k].name + " L" + L + (cd > 0 ? " (" + Math.ceil(cd) + "s)" : "");
      r.buy.style.display = "";
      r.buy.textContent = L >= ABIL_MAX ? "MAX" : "Fejl. " + costTxt;
      r.buy.disabled = L >= ABIL_MAX || !afford;
      const isQ = p.slotQ === k;
      r.bq.style.display = isQ ? "" : "none"; r.be.style.display = isQ ? "none" : "";
      r.bq.disabled = r.be.disabled = true;
      r.bq.classList.toggle("active-tab", isQ); r.be.classList.toggle("active-tab", !isQ);
    } else {
      r.info.textContent = ABIL[k].name + " [" + costTxt + "]";
      r.buy.style.display = "none"; r.bq.style.display = r.be.style.display = "";
      r.bq.classList.remove("active-tab"); r.be.classList.remove("active-tab");
      r.bq.textContent = full ? "↻Q" : "Q"; r.be.textContent = full ? "↻E" : "E";
      r.bq.disabled = !afford || (!freeQ && !full); r.be.disabled = !afford || (!freeE && !full);
    }
  }
  const fmt = (key, sl) => !key ? sl + ": —" : sl + ": " + ABIL[key].name + " L" + (p.abil[key] || 1) + ((p.abilCd[key] || 0) > 0 ? " " + Math.ceil(p.abilCd[key]) + "s" : " ✔");
  const el = document.getElementById("abil-hud");
  if (el) el.textContent = fmt(p.slotQ, "Q") + " | " + fmt(p.slotE, "E");
}

function drawHistoryChart(cv) {
  if (!cv || !cv.getContext) return;
  const c = cv.getContext("2d"), W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H); c.fillStyle = "rgba(6,10,20,0.85)"; c.fillRect(0, 0, W, H);
  const list = loadHist(); c.textAlign = "center"; c.font = "11px sans-serif";
  if (!list.length) { c.fillStyle = "#8fa8c8"; c.fillText("Még nincs lejátszott játék", W / 2, H / 2); return; }
  const L = 34, R = 8, T0 = 24, B = 24, n = list.length;
  const maxV = Math.max(50, ...list.map(g => Math.max(g.bScore, g.rScore, 0)));
  const gh = H - T0 - B, slot = (W - L - R) / n, bw = Math.min(18, slot * 0.34);
  for (let i = 0; i <= 4; i++) {
    const y = T0 + gh - (gh * i / 4);
    c.strokeStyle = "rgba(255,255,255,0.08)"; c.beginPath(); c.moveTo(L, y); c.lineTo(W - R, y); c.stroke();
    c.fillStyle = "#8fa8c8"; c.textAlign = "right"; c.fillText(String(Math.round(maxV * i / 4)), L - 4, y + 3);
  }
  list.forEach((g, i) => {
    const x0 = L + i * slot + slot / 2;
    const hb = gh * Math.max(0, g.bScore) / maxV, hr = gh * Math.max(0, g.rScore) / maxV;
    c.fillStyle = "#339af0"; c.fillRect(x0 - bw - 1, T0 + gh - hb, bw, hb);
    c.fillStyle = "#fa5252"; c.fillRect(x0 + 1, T0 + gh - hr, bw, hr);
    c.textAlign = "center"; c.font = "bold 11px sans-serif"; c.fillStyle = g.win ? "#51e07f" : "#ff6b6b";
    c.fillText(g.win ? "GY" : "V", x0, T0 + gh - Math.max(hb, hr) - 4);
    c.font = "10px sans-serif"; c.fillStyle = "#8fa8c8"; c.fillText(String(i + 1), x0, H - 9);
  });
}

function drawReportCharts() {
  const hist = window.state.history || [];
  if (chartScoreCtx && chartScoreCanvas) {
    const w = chartScoreCanvas.width, h = chartScoreCanvas.height;
    chartScoreCtx.clearRect(0, 0, w, h);
    const maxVal = Math.max(100, ...hist.map(p => Math.max(p.bScore, p.rScore))), pad = 22;
    const plot = (getter, color) => {
      if (hist.length < 2) return;
      chartScoreCtx.beginPath();
      hist.forEach((pt, idx) => {
        const x = pad + (idx / (hist.length - 1)) * (w - pad * 2);
        const y = h - pad - (getter(pt) / maxVal) * (h - pad * 2);
        if (idx === 0) chartScoreCtx.moveTo(x, y); else chartScoreCtx.lineTo(x, y);
      });
      chartScoreCtx.strokeStyle = color; chartScoreCtx.lineWidth = 2.5; chartScoreCtx.stroke();
    };
    plot(pt => pt.bScore, "#4dabf7"); plot(pt => pt.rScore, "#ff6b6b");
  }
  if (chartBasesCtx && chartBasesCanvas) {
    const w = chartBasesCanvas.width, h = chartBasesCanvas.height;
    chartBasesCtx.clearRect(0, 0, w, h);
    const bC = computeTeamCompositeScore("blue"), rC = computeTeamCompositeScore("red");
    const bars = [
      { label: "Kék Bázis %", val: bC.basePct, max: 100, color: "#339af0" },
      { label: "Piros Bázis %", val: rC.basePct, max: 100, color: "#fa5252" },
      { label: "Kék Legyőzés", val: window.state.teamKills.blue, max: Math.max(5, window.state.teamKills.blue + window.state.teamKills.red), color: "#74c0fc" },
      { label: "Piros Legyőzés", val: window.state.teamKills.red, max: Math.max(5, window.state.teamKills.blue + window.state.teamKills.red), color: "#ffa8a8" }
    ];
    const barW = 58, gap = 26, startX = 28, baseY = h - 26, maxBarH = h - 52;
    bars.forEach((b, i) => {
      const bh = (b.val / Math.max(1, b.max)) * maxBarH, x = startX + i * (barW + gap);
      chartBasesCtx.fillStyle = b.color; chartBasesCtx.fillRect(x, baseY - bh, barW, bh);
      chartBasesCtx.fillStyle = "#e6eefc"; chartBasesCtx.font = "10px sans-serif"; chartBasesCtx.textAlign = "center";
      chartBasesCtx.fillText(String(b.val), x + barW / 2, baseY - bh - 5);
      chartBasesCtx.fillText(b.label, x + barW / 2, h - 10);
    });
  }
}

function syncHUD() {
  const st = window.state, p = getPlayerRef();
  if (!st || !p) return;
  const clsName = (SHIP_CLASSES[p.shipClass] || SHIP_CLASSES.fighter).name;
  refreshAbilUI(p);
  document.getElementById("hud-ship-title").textContent = `${p.id} (${p.team === "blue" ? "KÉK" : "PIROS"} — ${clsName})`;
  const pct = (a, b) => Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100)) + "%";
  document.getElementById("b-hp").style.width = pct(p.hp, p.maxHp); document.getElementById("t-hp").textContent = Math.ceil(p.hp) + "/" + p.maxHp;
  document.getElementById("b-ar").style.width = pct(p.armor, p.maxArmor); document.getElementById("t-ar").textContent = Math.ceil(p.armor) + "/" + p.maxArmor;
  document.getElementById("b-fu").style.width = pct(p.fuel, p.maxFuel); document.getElementById("t-fu").textContent = Math.ceil(p.fuel) + "/" + p.maxFuel;
  document.getElementById("b-ca").style.width = pct(p.cargo, p.maxCargo); document.getElementById("t-ca").textContent = Math.floor(p.cargo) + "/" + p.maxCargo;
  document.getElementById("b-en").style.width = pct(p.energy, p.maxEnergy); document.getElementById("t-en").textContent = Math.ceil(p.energy) + "/" + p.maxEnergy;

  const ef = getEnergyFireFactor(p), fe = fuelEmpty(p), ee = p.energy <= 0.5, sw = document.getElementById("slow-warn");
  sw.style.display = (fe || ee) ? "block" : "none";
  sw.textContent = fe ? "ÜZEMANYAG KIFOGYOTT — motor lassítva" : "ENERGIA KIFOGYOTT — gyengébb, ritkább lövés";
  document.getElementById("low-en-warn").style.display = ef.low ? "block" : "none";

  document.getElementById("v-pts").textContent = p.points;
  document.getElementById("v-cargo").textContent = `${Math.floor(p.cargo)}/${p.maxCargo}`;
  document.getElementById("cargo-full-warn").style.display = p.cargo >= p.maxCargo ? "block" : "none";
  document.getElementById("v-thr").textContent = Math.round((p.throttle || 1) * 100) + "%";
  document.getElementById("v-my-kills").textContent = p.kills || 0;
  document.getElementById("v-my-deaths").textContent = p.deaths || 0;
  document.getElementById("v-bkills").textContent = st.teamKills.blue || 0;
  document.getElementById("v-rkills").textContent = st.teamKills.red || 0;
  document.getElementById("v-bdeaths").textContent = st.teamDeaths.blue || 0;
  document.getElementById("v-rdeaths").textContent = st.teamDeaths.red || 0;

  document.getElementById("timer-box").textContent = `Idő: ${fmtClock(st.matchTime)} / ${fmtClock(st.targetDuration)} (Max ${fmtClock(MAX_MATCH_DURATION)})`;
  document.getElementById("judge-box").textContent = st.judgeNote;
  const alarmEl = document.getElementById("time-alarm-box");
  if (st.timeAlarmText) { alarmEl.style.display = "block"; alarmEl.textContent = st.timeAlarmText; } else alarmEl.style.display = "none";

  document.getElementById("btn-w2-twin").classList.toggle("active-w2", (p.w2Type || "twin") === "twin");
  document.getElementById("btn-w2-seeker").classList.toggle("active-w2", p.w2Type === "seeker");
  document.getElementById("btn-w2-beam").classList.toggle("active-w2", p.w2Type === "beam");

  const myTeam = p.team || "blue", ownB = st.bases[myTeam], bb = st.bases.blue, rb = st.bases.red;
  document.getElementById("mb-hp").style.width = pct(p.hp, p.maxHp); document.getElementById("mb-ar").style.width = pct(p.armor, p.maxArmor);
  document.getElementById("mb-fu").style.width = pct(p.fuel, p.maxFuel); document.getElementById("mb-en").style.width = pct(p.energy, p.maxEnergy);
  document.getElementById("mb-ca").style.width = pct(p.cargo, p.maxCargo); document.getElementById("mb-bbase").style.width = pct(bb.hp, bb.maxHp); document.getElementById("mb-rbase").style.width = pct(rb.hp, rb.maxHp);

  const atBase = p.respawnTimer <= 0 && dist(p, ownB) <= ownB.radius + 140;
  document.getElementById("class-switch-hint").textContent = atBase ? "Hajótípus váltás (Bázison elérhető):" : "Hajótípus váltás (Menj a saját bázishoz):";
  for (const [clsKey, btnId] of [["fighter", "btn-sw-fighter"], ["cruiser", "btn-sw-cruiser"], ["battleship", "btn-sw-battleship"]]) {
    const btn = document.getElementById(btnId), c = getShipSwitchCost(p, clsKey), same = p.shipClass === clsKey;
    btn.textContent = `${SHIP_CLASSES[clsKey].name}${same ? " [Aktív]" : ""} — ${c.mat}a / ${c.pts}p / ${c.en}e`;
    btn.disabled = !atBase || same || p.materials < c.mat || p.points < c.pts || p.energy < c.en;
  }

  document.getElementById("v-bases").textContent = `Kék Bázis: ${Math.ceil((bb.hp / bb.maxHp) * 100)}% | Piros Bázis: ${Math.ceil((rb.hp / rb.maxHp) * 100)}%`;
  document.getElementById("v-turrets").textContent = `Tornyok: Kék ${st.turrets.filter(t => t.owner === "blue").length} - ${st.turrets.filter(t => t.owner === "red").length} Piros`;
  const droneCnt = st.drones.filter(d => d.team === myTeam).length;
  document.getElementById("base-status-pill").textContent = `${ownB.name} — Anyag: ${Math.floor(ownB.materials)}/${ownB.maxStorage} | Építőanyag: ${Math.floor(ownB.buildMaterials)} | Üzemanyag: ${Math.floor(ownB.fuel)}/${ownB.maxFuel} | Energia: ${Math.floor(ownB.energy)}/${ownB.maxEnergy} | Drónok: ${droneCnt}/5`;

  const alertBox = document.getElementById("alert-box"), alerts = [];
  if (gameMode === "online" && typeof netStatusText !== "undefined" && netStatusText) alerts.push(netStatusText);
  if (st.kraken) alerts.push("ÓRIÁS POLIP SZÖRNY!");
  if (ownB.underAttackTimer > 0) alerts.push("TÁMADÁS ALATT A BÁZIS!");
  if (ownB.materials < 10) alerts.push("KELL ALAPANYAG A BÁZISRA!");
  if (p.waitingForBuildMat && p.respawnTimer > 0) alerts.push("VÁRAKOZÁS ÉPÍTŐANYAGRA...");
  if (alerts.length > 0) { alertBox.style.display = "block"; alertBox.textContent = "RIADÓ: " + alerts.join(" | "); } else alertBox.style.display = "none";

  for (const u of SHIP_UPGRADE_DEFS) {
    const c = getShipUpgradeCost(p, u.key);
    document.getElementById("ship-upg-info-" + u.key).textContent = `${u.label} (Lv.${p.levels[u.key] || 1}) — ${c.mat}a / ${c.pts}p / ${c.en}e`;
    shipUpgBtns[u.key].disabled = p.materials < c.mat || p.points < c.pts || p.energy < c.en || p.respawnTimer > 0;
  }
  for (const u of BASE_UPGRADE_DEFS) {
    const c = getBaseUpgradeCost(ownB, u.key);
    document.getElementById("base-upg-info-" + u.key).textContent = `${u.label} (Lv.${ownB.levels[u.key]}) — ${c.mat}a / ${c.pts}p / ${c.en}e`;
    baseUpgBtns[u.key].disabled = (ownB.materials + p.materials) < c.mat || (ownB.points + p.points) < c.pts || ownB.energy < c.en;
  }
}

function renderMinimapBase(targetCanvas, targetCtx) {
  const st = window.state;
  if (!targetCanvas || !targetCtx || !st) return;
  targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  const scale = targetCanvas.width / WORLD_SIZE, toMm = v => (v + HALF) * scale, me = getPlayerRef();
  targetCtx.fillStyle = st.star.color; targetCtx.beginPath(); targetCtx.arc(toMm(st.star.x), toMm(st.star.y), 3.5, 0, Math.PI * 2); targetCtx.fill();
  for (const key of ["blue", "red"]) { const b = st.bases[key]; targetCtx.fillStyle = key === "blue" ? "#4dabf7" : "#ff6b6b"; targetCtx.fillRect(toMm(b.x) - 3.5, toMm(b.y) - 3.5, 7, 7); }
  for (const t of st.turrets) { targetCtx.fillStyle = t.owner === "blue" ? "#74c0fc" : (t.owner === "red" ? "#ffa8a8" : "#adb5bd"); targetCtx.beginPath(); targetCtx.arc(toMm(t.x), toMm(t.y), 2.5, 0, Math.PI * 2); targetCtx.fill(); }
  if (st.kraken) { targetCtx.fillStyle = "#da77f2"; targetCtx.beginPath(); targetCtx.arc(toMm(st.kraken.x), toMm(st.kraken.y), 4.5, 0, Math.PI * 2); targetCtx.fill(); }
  for (const dr of st.drones) { targetCtx.fillStyle = dr.team === "blue" ? "#a5d8ff" : "#ffc9c9"; targetCtx.fillRect(toMm(dr.x) - 1, toMm(dr.y) - 1, 2, 2); }
  for (const s of st.ships) {
    if (s.respawnTimer > 0) continue;
    targetCtx.fillStyle = (me && s.id === me.id) ? "#ffffff" : (s.team === "blue" ? "#339af0" : "#fa5252");
    targetCtx.fillRect(toMm(s.x) - 2, toMm(s.y) - 2, 4, 4);
  }
}

function renderMinimapTarget(c, cx) {
  renderMinimapBase(c, cx);
  const st = window.state, me = getPlayerRef();
  if (!st || !cx || !c || !st.flashes || !me) return;
  const sc = c.width / WORLD_SIZE;
  for (const f of st.flashes) {
    if (f.team !== me.team) continue;
    const a = clamp(f.t / f.max, 0, 1), pulse = ((f.max - f.t) % 0.6) / 0.6;
    cx.beginPath(); cx.arc((f.x + HALF) * sc, (f.y + HALF) * sc, 3 + pulse * 14, 0, Math.PI * 2);
    cx.strokeStyle = `rgba(255,230,80,${(1 - pulse) * (0.4 + 0.6 * a)})`; cx.lineWidth = 2; cx.stroke();
  }
}

function draw() {
  if (!ctx) return;
  if (canvas.width < 10 || canvas.height < 10) resize();
  const st = window.state;
  const bgColor = (st && st.theme && st.theme.bg) ? st.theme.bg : "#060816";
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.setLineDash([]);
  ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvas.width, canvas.height);

  const player = getPlayerRef();
  if (!st || !player) return;

  const camX = player.x - canvas.width / 2, camY = player.y - canvas.height / 2;
  ctx.save(); ctx.translate(-camX, -camY);
  const T = performance.now() / 1000;

  for (const nb of (st.nebulae || [])) {
    const grad = ctx.createRadialGradient(nb.x, nb.y, nb.radius * 0.1, nb.x, nb.y, nb.radius);
    grad.addColorStop(0, nb.color); grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(nb.x, nb.y, nb.radius, 0, Math.PI * 2); ctx.fill();
  }

  ctx.strokeStyle = `rgba(120, 170, 255, ${0.22 + 0.1 * Math.sin(T * 2)})`;
  ctx.lineWidth = 4; ctx.setLineDash([30, 22]); ctx.strokeRect(-HALF, -HALF, WORLD_SIZE, WORLD_SIZE); ctx.setLineDash([]);

  for (const sStar of (st.bgStars || [])) {
    ctx.fillStyle = `rgba(220,235,255,${sStar.alpha * (0.62 + 0.38 * Math.sin(T * 1.6 + sStar.x * 0.37))})`;
    ctx.fillRect(sStar.x, sStar.y, sStar.size, sStar.size);
  }

  const S = st.star;
  const sunAura = ctx.createRadialGradient(S.x, S.y, S.radius * 0.8, S.x, S.y, S.radius + 230);
  sunAura.addColorStop(0, "rgba(255, 212, 59, 0.25)"); sunAura.addColorStop(0.6, "rgba(151, 117, 250, 0.12)"); sunAura.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = sunAura; ctx.beginPath(); ctx.arc(S.x, S.y, S.radius + 230, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(S.x, S.y, S.radius, 0, Math.PI * 2); ctx.fillStyle = S.color; ctx.fill();

  for (const pl of (st.planets || [])) {
    ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.radius, 0, Math.PI * 2); ctx.fillStyle = pl.color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255, 224, 102, 0.35)"; ctx.stroke();
  }

  for (const key of ["blue", "red"]) {
    const b = st.bases[key], bl = key === "blue";
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius + 130, 0, Math.PI * 2);
    ctx.strokeStyle = bl ? "rgba(77,171,247,0.18)" : "rgba(255,107,107,0.18)"; ctx.lineWidth = 1.5; ctx.stroke();
    const hg = ctx.createRadialGradient(b.x - b.radius * 0.35, b.y - b.radius * 0.35, b.radius * 0.1, b.x, b.y, b.radius);
    hg.addColorStop(0, bl ? "#4a8fd6" : "#c4474d"); hg.addColorStop(1, bl ? "#0f2f55" : "#4d1316");
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fillStyle = hg; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = bl ? "#74c0fc" : "#ff8787"; ctx.stroke();
    const bw = 90;
    ctx.fillStyle = "#111"; ctx.fillRect(b.x - bw / 2, b.y - b.radius - 22, bw, 6);
    ctx.fillStyle = bl ? "#38d977" : "#ff6b6b"; ctx.fillRect(b.x - bw / 2, b.y - b.radius - 22, bw * Math.max(0, b.hp / b.maxHp), 6);
    ctx.fillStyle = "#111"; ctx.fillRect(b.x - bw / 2, b.y - b.radius - 14, bw, 5);
    ctx.fillStyle = "#74c0fc"; ctx.fillRect(b.x - bw / 2, b.y - b.radius - 14, bw * Math.max(0, b.armor / b.maxArmor), 5);
  }

  for (const t of (st.turrets || [])) {
    ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
    ctx.fillStyle = t.owner === "blue" ? "#2b6cb0" : (t.owner === "red" ? "#9b2c2c" : "#4a5568"); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = "#ced4da"; ctx.stroke();
    const cp = t.captureProgress / 100;
    ctx.fillStyle = "#111"; ctx.fillRect(t.x - 24, t.y - t.radius - 14, 48, 5);
    if (cp >= 0) { ctx.fillStyle = "#4dabf7"; ctx.fillRect(t.x, t.y - t.radius - 14, 24 * cp, 5); }
    else { ctx.fillStyle = "#ff6b6b"; ctx.fillRect(t.x + 24 * cp, t.y - t.radius - 14, 24 * Math.abs(cp), 5); }
  }

  if (st.kraken) {
    const k = st.kraken;
    ctx.save(); ctx.translate(k.x, k.y);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.sin((k.tentaclePhase || 0) + i) * 0.18;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (k.radius + 26), Math.sin(a) * (k.radius + 26));
      ctx.strokeStyle = "#cc5de8"; ctx.lineWidth = 5; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, k.radius, 0, Math.PI * 2); ctx.fillStyle = "#7b2cbf"; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = "#f3d9fa"; ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#111"; ctx.fillRect(k.x - 35, k.y - k.radius - 26, 70, 6);
    ctx.fillStyle = "#da77f2"; ctx.fillRect(k.x - 35, k.y - k.radius - 26, 70 * Math.max(0, (k.hp || 0) / Math.max(1, k.maxHp || 1)), 6);
  }

  for (const n of (st.nodes || [])) {
    if (n.respawnTimer > 0) continue;
    ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(n.rot || 0);
    if (n.type === "asteroid" && n.shape) {
      ctx.beginPath();
      n.shape.forEach((pt, idx) => { const px = Math.cos(pt.ang) * pt.r, py = Math.sin(pt.ang) * pt.r; if (idx === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
      ctx.closePath(); ctx.fillStyle = "#5c6670"; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = "#adb5bd"; ctx.stroke();
    } else if (n.type === "container") {
      ctx.fillStyle = "#f59f00"; ctx.fillRect(-n.radius * 0.75, -n.radius * 0.75, n.radius * 1.5, n.radius * 1.5);
    } else {
      ctx.beginPath(); ctx.moveTo(0, -n.radius); ctx.lineTo(n.radius, n.radius * 0.7); ctx.lineTo(-n.radius * 0.8, n.radius); ctx.closePath();
      ctx.fillStyle = "#495057"; ctx.fill(); ctx.strokeStyle = "#63e6be"; ctx.stroke();
    }
    ctx.restore();
  }

  for (const pk of (st.pickups || [])) {
    ctx.save(); ctx.translate(pk.x, pk.y); ctx.rotate(T * 2 + pk.x);
    ctx.beginPath(); ctx.moveTo(0, -pk.radius); ctx.lineTo(pk.radius, 0); ctx.lineTo(0, pk.radius); ctx.lineTo(-pk.radius, 0); ctx.closePath();
    ctx.fillStyle = "#ffd43b"; ctx.fill(); ctx.restore();
  }

  for (const bm of (st.beams || [])) {
    ctx.beginPath(); ctx.moveTo(bm.x1, bm.y1); ctx.lineTo(bm.x2, bm.y2);
    ctx.strokeStyle = bm.color; ctx.lineWidth = bm.width || 3; ctx.stroke();
  }

  for (const dr of (st.drones || [])) {
    ctx.save(); ctx.translate(dr.x, dr.y);
    ctx.fillStyle = dr.team === "blue" ? "#74c0fc" : "#ffa8a8";
    ctx.fillRect(-dr.radius, -dr.radius, dr.radius * 2, dr.radius * 2);
    ctx.restore();
  }

  for (const s of (st.ships || [])) {
    if (s.respawnTimer > 0) continue;
    const isMe = s.id === player.id;
    ctx.globalAlpha = s.cloakT > 0 ? (s.team === player.team ? 0.33 : 0.03) : 1;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
    ctx.beginPath();
    if (s.shipClass === "battleship") {
      ctx.moveTo(s.radius + 6, 0); ctx.lineTo(s.radius * 0.25, -s.radius * 0.95); ctx.lineTo(-s.radius, -s.radius * 0.88);
      ctx.lineTo(-s.radius * 0.75, 0); ctx.lineTo(-s.radius, s.radius * 0.88); ctx.lineTo(s.radius * 0.25, s.radius * 0.95);
    } else if (s.shipClass === "cruiser") {
      ctx.moveTo(s.radius + 5, 0); ctx.lineTo(-s.radius * 0.2, -s.radius * 0.82); ctx.lineTo(-s.radius, -s.radius * 0.55);
      ctx.lineTo(-s.radius * 0.65, 0); ctx.lineTo(-s.radius, s.radius * 0.55); ctx.lineTo(-s.radius * 0.2, s.radius * 0.82);
    } else {
      ctx.moveTo(s.radius + 4, 0); ctx.lineTo(-s.radius, -s.radius * 0.72); ctx.lineTo(-s.radius * 0.55, 0); ctx.lineTo(-s.radius, s.radius * 0.72);
    }
    ctx.closePath();
    ctx.fillStyle = s.team === "blue" ? "#339af0" : "#fa5252"; ctx.fill();
    ctx.lineWidth = isMe ? 2.5 : 1.5; ctx.strokeStyle = isMe ? "#ffffff" : "#111"; ctx.stroke();
    if (s.shieldHp > 0) {
      ctx.beginPath(); ctx.arc(0, 0, s.radius * 2.1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(160,235,255,0.75)"; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();

    if (uiMode === "normal") {
      const tag = s.shipClass === "battleship" ? "A" : (s.shipClass === "cruiser" ? "C" : "V");
      ctx.fillStyle = "#e6eefc"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`${s.id}[${tag}]${s.isHuman ? "★" : ""}`, s.x, s.y - s.radius - 10);
    }
    ctx.fillStyle = "#2b2b2b"; ctx.fillRect(s.x - 16, s.y - s.radius - 7, 32, 3);
    ctx.fillStyle = s.team === "blue" ? "#4dabf7" : "#ff6b6b";
    ctx.fillRect(s.x - 16, s.y - s.radius - 7, 32 * Math.max(0, s.hp / Math.max(1, s.maxHp)), 3);
    ctx.globalAlpha = 1;
  }

  for (const p of (st.projectiles || [])) {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === "seeker" ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = p.color; ctx.fill();
  }

  for (const sw of (st.shockwaves || [])) {
    ctx.save(); ctx.globalAlpha = clamp(sw.life / sw.maxLife, 0, 1) * 0.65;
    ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2); ctx.strokeStyle = sw.color; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
  }

  for (const pt of (st.particles || [])) {
    ctx.fillStyle = pt.color; ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.beginPath(); ctx.arc(pt.x, pt.y, Math.max(0.8, pt.size || 4), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (uiMode === "normal") renderMinimapTarget(mmCanvas, mmCtx);
  else if (uiMode === "mini") renderMinimapTarget(miniSmallCanvas, miniSmallCtx);
}
