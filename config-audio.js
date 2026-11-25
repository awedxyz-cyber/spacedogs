const errBanner = document.getElementById("err-banner");
let errHideTimer = null, lastErrMsg = "", lastErrTime = 0;

function showError(msg) {
  const clean = String(msg || "Ismeretlen hiba");
  const now = performance.now();
  if (clean === lastErrMsg && now - lastErrTime < 4500) return;
  lastErrMsg = clean; lastErrTime = now;
  if (errBanner) {
    errBanner.style.display = "block";
    errBanner.textContent = "Szkript értesítés (automatikusan eltűnik): " + clean;
    clearTimeout(errHideTimer);
    errHideTimer = setTimeout(() => { errBanner.style.display = "none"; }, 4000);
  }
}

window.addEventListener("error", e => showError(e.message || "Szkript hiba"));
window.addEventListener("unhandledrejection", e => showError(String(e.reason || "Promise hiba")));

function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function clamp(v, lo, hi) { const num = Number.isFinite(v) ? v : lo; return Math.max(lo, Math.min(hi, num)); }
function dist(a, b) { return (!a || !b) ? Infinity : Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0)); }
function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const WORLD_SIZE = 4400;
const HALF = WORLD_SIZE / 2;
let BASE_MATCH_DURATION = 180;
let MAX_MATCH_DURATION = 300;
let gameMode = "offline";

const SHIP_CLASSES = {
  fighter: {
    name: "Vadász", sizeTier: 1, radius: 12, mass: 1.4,
    speedMult: 1.25, thrustMult: 1.3, dmgMult: 0.65, rangeMult: 0.8,
    regenMult: 1.25, reloadMult: 1.0, hpMult: 0.8, armorMult: 0.6, baseCargo: 55,
    fuelMult: 1.0, fuelUse: 0.8, energyMult: 0.9
  },
  cruiser: {
    name: "Cirkáló", sizeTier: 2, radius: 16, mass: 2.7,
    speedMult: 0.8, thrustMult: 0.85, dmgMult: 1.15, rangeMult: 1.0,
    regenMult: 1.0, reloadMult: 1.25, hpMult: 1.35, armorMult: 1.3, baseCargo: 95,
    fuelMult: 1.2, fuelUse: 1.0, energyMult: 1.0
  },
  battleship: {
    name: "Anyahajó", sizeTier: 3, radius: 22, mass: 5.0,
    speedMult: 0.5, thrustMult: 0.58, dmgMult: 2.2, rangeMult: 1.3,
    regenMult: 0.6, reloadMult: 2.0, hpMult: 2.2, armorMult: 2.0, baseCargo: 160,
    fuelMult: 1.6, fuelUse: 1.5, energyMult: 1.3
  }
};

const SHIP_UPGRADE_DEFS = [
  { key: "hp", label: "1. Élet", baseMat: 25, stepMat: 15, basePts: 5, stepPts: 5, baseEn: 10, stepEn: 5 },
  { key: "armor", label: "2. Páncél", baseMat: 25, stepMat: 15, basePts: 5, stepPts: 5, baseEn: 10, stepEn: 5 },
  { key: "w1", label: "3. 1. Fegyver", baseMat: 30, stepMat: 20, basePts: 8, stepPts: 6, baseEn: 15, stepEn: 8 },
  { key: "w2", label: "4. 2. Fegyver", baseMat: 35, stepMat: 20, basePts: 10, stepPts: 8, baseEn: 18, stepEn: 8 },
  { key: "regen", label: "5. Regeneráció", baseMat: 25, stepMat: 15, basePts: 5, stepPts: 5, baseEn: 12, stepEn: 6 },
  { key: "fuel", label: "6. Üzemanyag", baseMat: 20, stepMat: 15, basePts: 5, stepPts: 4, baseEn: 10, stepEn: 5 },
  { key: "energy", label: "7. Energia", baseMat: 20, stepMat: 15, basePts: 5, stepPts: 4, baseEn: 10, stepEn: 5 },
  { key: "speed", label: "8. Sebesség", baseMat: 25, stepMat: 15, basePts: 6, stepPts: 5, baseEn: 12, stepEn: 6 },
  { key: "mining", label: "9. Bányászat", baseMat: 25, stepMat: 15, basePts: 6, stepPts: 5, baseEn: 12, stepEn: 6 },
  { key: "cargo", label: "0. Raktár", baseMat: 20, stepMat: 14, basePts: 5, stepPts: 4, baseEn: 10, stepEn: 5 }
];

const BASE_UPGRADE_DEFS = [
  { key: "hp", label: "Bázis Élet", baseMat: 40, stepMat: 25, basePts: 10, stepPts: 8, baseEn: 30, stepEn: 15 },
  { key: "armor", label: "Bázis Páncél", baseMat: 40, stepMat: 25, basePts: 10, stepPts: 8, baseEn: 30, stepEn: 15 },
  { key: "storage", label: "Bázis Raktár", baseMat: 35, stepMat: 20, basePts: 8, stepPts: 6, baseEn: 25, stepEn: 12 },
  { key: "energy", label: "Bázis Energia", baseMat: 35, stepMat: 20, basePts: 8, stepPts: 6, baseEn: 25, stepEn: 12 },
  { key: "fuel", label: "Bázis Üzemanyag", baseMat: 35, stepMat: 20, basePts: 8, stepPts: 6, baseEn: 25, stepEn: 12 }
];

const ABIL = {
  help:   { name: "Segítség",    desc: "Csapattársak a helyedre jönnek, hang + térkép villanás", cd: L => 28 - 2 * L },
  cloak:  { name: "Láthatatlan", desc: "Ellenség nem lát, -50% sebzés",                        cd: L => 32 - 2 * L },
  portal: { name: "Portál",      desc: "Ugrás az egér irányába szabad helyre",                 cd: L => 20 - 2 * L },
  shield: { name: "Pajzs",       desc: "Extra látható pajzs",                                   cd: L => 26 - 2 * L },
  heal:   { name: "Gyógyítás",   desc: "Csapat +50% max élet nagyobb távolságban",              cd: L => 38 - 3 * L },
  dmg:    { name: "Extra sebzés",desc: "Megnövelt sebzés egy ideig",                            cd: L => 30 - 2 * L }
};
const ABIL_KEYS = Object.keys(ABIL);
const ABIL_MAX = 5;

let audioCtx = null, ambientStarted = false, soundCd = 0, alarmBeepCd = 0, master = null, muted = false, voices = 0;

function bus() {
  if (!master) {
    master = audioCtx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 6;
    master.connect(comp); comp.connect(audioCtx.destination);
  }
  return master;
}

window.addEventListener("keydown", e => {
  if (e.code === "KeyM") { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.9; }
});

function startAmbientSpaceHum() {
  if (!audioCtx || ambientStarted) return;
  try {
    const osc1 = audioCtx.createOscillator(), osc2 = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
    osc1.type = "sine"; osc1.frequency.setValueAtTime(52, audioCtx.currentTime);
    osc2.type = "triangle"; osc2.frequency.setValueAtTime(78, audioCtx.currentTime);
    filter.type = "lowpass"; filter.frequency.setValueAtTime(165, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.011, audioCtx.currentTime);
    osc1.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(bus());
    osc1.start(); osc2.start();
    const lfo = audioCtx.createOscillator(), lfoG = audioCtx.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 60;
    lfo.connect(lfoG); lfoG.connect(filter.frequency); lfo.start();
    ambientStarted = true;
  } catch (_) {}
}

function ensureAudio() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().then(() => startAmbientSpaceHum()).catch(() => {});
    } else if (audioCtx && audioCtx.state === "running") {
      startAmbientSpaceHum();
    }
  } catch (_) {}
}

window.addEventListener("pointerdown", ensureAudio, { passive: true });
window.addEventListener("keydown", ensureAudio, { passive: true });

function getPlayerRef() {
  if (!window.state || !Array.isArray(window.state.ships)) return null;
  if (window.state.myShipId) {
    const found = window.state.ships.find(s => s.id === window.state.myShipId);
    if (found) return found;
  }
  return window.state.ships[0] || null;
}

function getDistanceGain(x, y, maxDist = 1750, minGain = 0.05) {
  const p = getPlayerRef();
  if (!p || typeof x !== "number" || typeof y !== "number") return 0.5;
  const d = Math.hypot(x - p.x, y - p.y);
  if (d >= maxDist) return 0;
  return Math.max(minGain, Math.pow(1 - d / maxDist, 1.55));
}

function playToneAt(x, y, freq, endFreq, dur, type = "sine", gainVal = 0.04, force = false, maxDist = 1750) {
  if (!audioCtx || audioCtx.state !== "running") return;
  if (!force && soundCd > 0) return;
  if (voices > 36) return;
  const distGain = getDistanceGain(x, y, maxDist, 0.05);
  if (distGain <= 0.001) return;
  try {
    const now = audioCtx.currentTime, gain = audioCtx.createGain(), p = getPlayerRef();
    if (audioCtx.createStereoPanner && p && typeof x === "number") {
      const pn = audioCtx.createStereoPanner();
      pn.pan.value = clamp((x - p.x) / 900, -0.8, 0.8);
      gain.connect(pn); pn.connect(bus());
    } else gain.connect(bus());
    gain.gain.setValueAtTime(gainVal * distGain * 0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.0006, now + dur);
    const mk = (t, f, e, det) => {
      const o = audioCtx.createOscillator();
      o.type = t; o.detune.value = det;
      o.frequency.setValueAtTime(Math.max(40, f), now);
      if (e) o.frequency.exponentialRampToValueAtTime(Math.max(35, e), now + dur);
      o.connect(gain); o.start(now); o.stop(now + dur + 0.02);
      return o;
    };
    voices++;
    const o1 = mk(type, freq, endFreq, 0);
    mk(type, freq, endFreq, -11);
    mk(type === "sine" ? "triangle" : "sine", freq * 0.5, endFreq ? endFreq * 0.5 : 0, 5);
    o1.onended = () => { voices = Math.max(0, voices - 1); };
  } catch (_) {}
}

function playExplosionSoundAt(x, y, big = false) {
  if (!audioCtx || audioCtx.state !== "running") return;
  const distGain = getDistanceGain(x, y, big ? 2300 : 1550, 0.05);
  if (distGain <= 0.001) return;
  try {
    const dur = big ? 0.42 : 0.18, len = Math.floor(audioCtx.sampleRate * dur);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    const src = audioCtx.createBufferSource(), filter = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(big ? 360 : 620, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(75, audioCtx.currentTime + dur);
    gain.gain.setValueAtTime((big ? 0.12 : 0.055) * distGain, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0008, audioCtx.currentTime + dur);
    src.buffer = buf; src.connect(filter); filter.connect(gain); gain.connect(bus()); src.start();
    const t0 = audioCtx.currentTime, th = audioCtx.createOscillator(), tg = audioCtx.createGain();
    th.type = "sine"; th.frequency.setValueAtTime(big ? 120 : 160, t0); th.frequency.exponentialRampToValueAtTime(30, t0 + dur);
    tg.gain.setValueAtTime((big ? 0.16 : 0.07) * distGain, t0); tg.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    th.connect(tg); tg.connect(bus()); th.start(t0); th.stop(t0 + dur);
  } catch (_) {}
}

const TIME_OPTS = [1, 2, 3, 5, 8];
const DIFFS = [
  { name: "Könnyű", taken: 0.75, redDmg: 0.8, aiRate: 1.6, aiSkip: 0.6, desc: "Az ellenség gyengébb és ritkábban használ képességet, a kék csapat kevesebbet sérül." },
  { name: "Normál", taken: 1, redDmg: 1, aiRate: 1, aiSkip: 0.35, desc: "Kiegyensúlyozott csata." },
  { name: "Nehéz", taken: 1.3, redDmg: 1.25, aiRate: 0.6, aiSkip: 0.15, desc: "Az ellenség erősebb, gyorsabban fejlődik és okosabban használja a képességeit." }
];
const settings = { minutes: 3, diff: 1, onlineUrl: "", onlineRoom: "global-5v5", onlineTeam: "auto" };
function D() { return DIFFS[settings.diff] || DIFFS[1]; }

let histMem = [];
function lsGet(k) { try { return window.localStorage.getItem(k); } catch (_) { return null; } }
function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (_) {} }
function loadHist() {
  const raw = lsGet("spacedogs5v5_hist");
  if (raw) { try { const a = JSON.parse(raw); if (Array.isArray(a)) return a; } catch (_) {} }
  return histMem.slice();
}
function saveHist(list) { histMem = list.slice(); lsSet("spacedogs5v5_hist", JSON.stringify(list)); }
(function loadSettings() {
  try {
    const o = JSON.parse(lsGet("spacedogs5v5_settings") || "null");
    if (o) {
      if (TIME_OPTS.includes(o.minutes)) settings.minutes = o.minutes;
      if (DIFFS[o.diff]) settings.diff = o.diff;
      if (typeof o.onlineUrl === "string") settings.onlineUrl = o.onlineUrl;
      if (typeof o.onlineRoom === "string" && o.onlineRoom.trim()) settings.onlineRoom = o.onlineRoom.trim();
      if (["auto", "blue", "red"].includes(o.onlineTeam)) settings.onlineTeam = o.onlineTeam;
    }
  } catch (_) {}
})();
