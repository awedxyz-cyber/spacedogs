let menuOpen = true;
const keys = {};
const mouse = {
  x: (typeof canvas !== "undefined" && canvas) ? canvas.width / 2 : 600,
  y: (typeof canvas !== "undefined" && canvas) ? canvas.height / 2 : 350,
  downLeft: false,
  downRight: false
};

window.addEventListener("keydown", e => {
  keys[e.code] = true;
  if (e.code === "Escape") {
    const ov = document.getElementById("overlay");
    if (ov && ov.classList.contains("show")) return;
    if (menuOpen) {
      if (window.state && window.state.started) closeMenu();
    } else {
      openMenu("main");
    }
  }
  const st = window.state, p = getPlayerRef();
  if (!st || !p || menuOpen || st.gameOver) return;
  if (e.code === "KeyQ") useAbility(p, "Q");
  else if (e.code === "KeyE") useAbility(p, "E");
  else {
    const numMap = {
      Digit1: "hp", Digit2: "armor", Digit3: "w1", Digit4: "w2", Digit5: "regen",
      Digit6: "fuel", Digit7: "energy", Digit8: "speed", Digit9: "mining", Digit0: "cargo"
    };
    if (numMap[e.code]) buyShipUpgrade(numMap[e.code]);
  }
});

window.addEventListener("keyup", e => { keys[e.code] = false; });

if (typeof canvas !== "undefined" && canvas) {
  canvas.addEventListener("mousemove", e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener("mousedown", e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    if (e.button === 0) mouse.downLeft = true;
    else if (e.button === 2) mouse.downRight = true;
  });
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    const p = getPlayerRef();
    if (!p) return;
    p.throttle = clamp((p.throttle || 1) + (e.deltaY < 0 ? 0.1 : -0.1), 0.2, 1.0);
    if (gameMode === "online") sendNetAction({ type: "input", input: { throttle: p.throttle } });
  }, { passive: false });
}

window.addEventListener("mouseup", e => {
  if (e.button === 0) mouse.downLeft = false;
  else if (e.button === 2) mouse.downRight = false;
});

document.getElementById("btn-w2-twin").onclick = () => setSecondaryWeapon(getPlayerRef(), "twin");
document.getElementById("btn-w2-seeker").onclick = () => setSecondaryWeapon(getPlayerRef(), "seeker");
document.getElementById("btn-w2-beam").onclick = () => setSecondaryWeapon(getPlayerRef(), "beam");
document.getElementById("btn-sw-fighter").onclick = () => switchShipClass(getPlayerRef(), "fighter");
document.getElementById("btn-sw-cruiser").onclick = () => switchShipClass(getPlayerRef(), "cruiser");
document.getElementById("btn-sw-battleship").onclick = () => switchShipClass(getPlayerRef(), "battleship");

function showPage(id) {
  const target = String(id).startsWith("menu-") ? id : "menu-" + id;
  ["menu-main", "menu-offline", "menu-online", "menu-last"].forEach(p => {
    const el = document.getElementById(p);
    if (el) el.style.display = p === target ? "block" : "none";
  });
}

function openMenu(page = "main") {
  menuOpen = true;
  document.getElementById("m-resume").style.display = (window.state && window.state.started) ? "block" : "none";
  showPage(page);
  document.getElementById("menu").classList.add("show");
}

function closeMenu() {
  menuOpen = false;
  document.getElementById("menu").classList.remove("show");
}

function buildOptButtons() {
  const tr = document.getElementById("opt-time");
  tr.innerHTML = "";
  TIME_OPTS.forEach(m => {
    const b = document.createElement("button");
    b.textContent = m + " perc";
    b.classList.toggle("sel", settings.minutes === m);
    b.onclick = () => {
      settings.minutes = m;
      lsSet("spacedogs5v5_settings", JSON.stringify(settings));
      buildOptButtons();
    };
    tr.appendChild(b);
  });
  const dr = document.getElementById("opt-diff");
  dr.innerHTML = "";
  DIFFS.forEach((d, i) => {
    const b = document.createElement("button");
    b.textContent = d.name;
    b.classList.toggle("sel", settings.diff === i);
    b.onclick = () => {
      settings.diff = i;
      lsSet("spacedogs5v5_settings", JSON.stringify(settings));
      buildOptButtons();
    };
    dr.appendChild(b);
  });
  document.getElementById("diff-desc").textContent = D().desc;
}

function renderLast() {
  const list = loadHist(), el = document.getElementById("last-sum");
  if (!list.length) {
    el.textContent = "Még nincs mentett játék.";
    drawHistoryChart(document.getElementById("chart-hist"));
    return;
  }
  const w = list.filter(g => g.win).length;
  const avgB = Math.round(list.reduce((a, g) => a + g.bScore, 0) / list.length);
  const avgR = Math.round(list.reduce((a, g) => a + g.rScore, 0) / list.length);
  el.textContent = `${list.length} játék — Győzelmek: ${w}/${list.length} | Átlag összérték: Kék ${avgB} - Piros ${avgR}`;
  drawHistoryChart(document.getElementById("chart-hist"));
}

function startGame() {
  disconnectOnline();
  gameMode = "offline";
  BASE_MATCH_DURATION = settings.minutes * 60;
  MAX_MATCH_DURATION = BASE_MATCH_DURATION + 120;
  generateSolarSystem();
  window.state.started = true;
  closeMenu();
}

document.getElementById("m-resume").onclick = () => { if (window.state && window.state.started) closeMenu(); };
document.getElementById("m-offline").onclick = () => { buildOptButtons(); showPage("menu-offline"); };
document.getElementById("m-online").onclick = () => {
  document.getElementById("online-url").value = settings.onlineUrl || "";
  document.getElementById("online-room").value = settings.onlineRoom || "global-5v5";
  document.getElementById("online-team").value = settings.onlineTeam || "auto";
  setOnlineStatus(netConnected ? `Kapcsolódva: ${settings.onlineRoom}` : "Add meg a Render szerver címét.");
  showPage("menu-online");
};
document.getElementById("m-last").onclick = () => { renderLast(); showPage("menu-last"); };
document.getElementById("m-back1").onclick = () => showPage("menu-main");
document.getElementById("m-back-online").onclick = () => showPage("menu-main");
document.getElementById("m-back2").onclick = () => showPage("menu-main");
document.getElementById("m-start").onclick = startGame;
document.getElementById("m-connect-online").onclick = () => {
  settings.onlineUrl = document.getElementById("online-url").value.trim();
  settings.onlineRoom = document.getElementById("online-room").value.trim() || "global-5v5";
  settings.onlineTeam = document.getElementById("online-team").value || "auto";
  lsSet("spacedogs5v5_settings", JSON.stringify(settings));
  connectOnline();
};
document.getElementById("m-clear").onclick = () => { saveHist([]); renderLast(); };
document.getElementById("btn-menu").onclick = () => openMenu("main");
document.getElementById("btn-new-sys").onclick = () => {
  if (gameMode === "online") { sendNetAction({ type: "newSystem" }); return; }
  startGame();
};
document.getElementById("btn-restart").onclick = () => {
  if (gameMode === "online") {
    document.getElementById("overlay").classList.remove("show");
    sendNetAction({ type: "newSystem" });
    return;
  }
  startGame();
};
document.getElementById("btn-report-menu").onclick = () => {
  document.getElementById("overlay").classList.remove("show");
  openMenu("main");
};

generateSolarSystem();
openMenu("main");

let lastTime = performance.now();
function loop(now) {
  try {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    if (gameMode === "online") {
      sendPlayerInputFrame(now);
      updateOnlineVisuals(dt);
    } else {
      updateOffline(dt);
    }
    syncHUD();
    draw();
  } catch (err) {
    showError(err && err.message ? err.message : "Ciklus hiba");
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
