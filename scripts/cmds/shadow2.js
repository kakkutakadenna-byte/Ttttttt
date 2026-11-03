// ======================================================
// COMPATIBILITY FIX
// ======================================================

roundedRect = function(ctx, x, y, w, h, r, fill) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
};

// ======================================================
// GAME HELPERS
// ======================================================

function getMoveLabel(move) {
  return MOVE_NAMES[move] || "UNKNOWN";
}

function getMoveCost(move) {
  return MOVE_COSTS[move] || { stamina: 0, energy: 0 };
}

function canAfford(player, move) {
  const cost = getMoveCost(move);
  return player.stamina >= cost.stamina && player.energy >= cost.energy;
}

function spendCost(player, move) {
  const cost = getMoveCost(move);
  player.stamina = Math.max(0, player.stamina - cost.stamina);
  player.energy = Math.max(0, player.energy - cost.energy);
}

function regenerate(player) {
  player.energy = clamp(player.energy + 9, 0, MAX_ENERGY);
  player.stamina = clamp(player.stamina + 12, 0, MAX_STAMINA);
}

function getElementMultiplier(attacker, defender) {
  const strongAgainst = {
    fire: "nature",
    nature: "ice",
    ice: "thunder",
    thunder: "shadow",
    shadow: "fire"
  };

  const weakAgainst = {
    fire: "shadow",
    nature: "fire",
    ice: "nature",
    thunder: "ice",
    shadow: "thunder"
  };

  if (strongAgainst[attacker.element] === defender.element) return 1.2;
  if (weakAgainst[attacker.element] === defender.element) return 0.85;
  return 1;
}

function getStyleMultiplier(player, move) {
  if (player.style === "aggressive" && BASE_DAMAGE[move]) return 1.12;
  if (player.style === "defensive" && move === "s4") return 1.15;
  if (player.style === "trickster" && (move === "s8" || move === "s10")) return 1.18;
  return 1;
}

function getWeaponMultiplier(player, move) {
  if (player.weapon === "sword" && ["s1", "s2", "s8"].includes(move)) return 1.08;
  if (player.weapon === "staff" && ["s3", "s6"].includes(move)) return 1.10;
  if (player.weapon === "dualblade" && ["s1", "s8"].includes(move)) return 1.12;
  if (player.weapon === "gauntlet" && ["s2", "s11"].includes(move)) return 1.10;
  return 1;
}

function calculateDamage(attacker, defender, move) {
  let damage = (BASE_DAMAGE[move] || 0) + randomInt(0, 8);

  damage *= getElementMultiplier(attacker, defender);
  damage *= getStyleMultiplier(attacker, move);
  damage *= getWeaponMultiplier(attacker, move);

  if (attacker.combo >= 2) damage *= 1.08;
  if (attacker.cloneReady) damage *= 1.15;

  let critical = chance(10);
  if (critical) damage *= 1.5;

  if (defender.style === "defensive") damage *= 0.92;

  if (defender.trapReady) {
    damage *= 1.15;
    defender.trapReady = false;
  }

  if (defender.cloneReady) {
    if (chance(35)) {
      defender.cloneReady = false;
      return { damage: 0, critical: false, blocked: true };
    }
  }

  return {
    damage: Math.max(1, Math.round(damage)),
    critical,
    blocked: false
  };
}

function applyDamage(attacker, defender, amount) {
  const damage = Math.max(0, Math.round(amount));
  defender.hp = Math.max(0, defender.hp - damage);
  attacker.totalDamage = (attacker.totalDamage || 0) + damage;
  return damage;
}

function applySecondWind(player) {
  if (player.hp > 0 && player.hp <= 50 && player.secondWind) {
    player.secondWind = false;
    player.hp = Math.min(MAX_HP, player.hp + 65);
    player.energy = clamp(player.energy + 20, 0, MAX_ENERGY);
    return true;
  }
  return false;
}

function applyStatusDamage(player) {
  let damage = 0;
  const messages = [];

  if (player.burn > 0) {
    const amount = 7;
    player.hp = Math.max(0, player.hp - amount);
    damage += amount;
    player.burn--;
    messages.push(`🔥 ${player.name}: Burn -${amount} HP`);
  }

  if (player.poison > 0) {
    const amount = 5;
    player.hp = Math.max(0, player.hp - amount);
    damage += amount;
    player.poison--;
    messages.push(`☠️ ${player.name}: Poison -${amount} HP`);
  }

  if (player.freeze > 0) player.freeze--;
  if (player.stun > 0) player.stun--;

  return { damage, messages };
}

function isDisabled(player) {
  return player.freeze > 0 || player.stun > 0;
}

function applyMoveStatus(attacker, defender, move) {
  if (move === "s3" && chance(35)) defender.burn = Math.max(defender.burn, 2);
  if (move === "s6" && chance(25)) defender.stun = Math.max(defender.stun, 1);
  if (move === "s8" && chance(20)) defender.freeze = Math.max(defender.freeze, 1);
  if (move === "s9") defender.stun = Math.max(defender.stun, 1);
  if (move === "s10") attacker.cloneReady = true;
}

function attackResult(attacker, defender, move, options = {}) {
  const result = calculateDamage(attacker, defender, move);

  if (result.blocked) {
    return {
      damage: 0,
      text: `${defender.name} blocked the attack with a clone!`
    };
  }

  let damage = result.damage;

  if (move === "s9") {
    defender.trapReady = true;
  }

  damage = applyDamage(attacker, defender, damage);
  applyMoveStatus(attacker, defender, move);

  if (attacker.cloneReady) attacker.cloneReady = false;

  attacker.combo = (attacker.combo || 0) + 1;
  defender.combo = 0;

  let text = `${attacker.name} used ${getMoveLabel(move)}: ${damage} damage`;
  if (result.critical) text += " — CRITICAL!";
  if (options.bonus) text += " — BONUS ATTACK!";

  return { damage, text, critical: result.critical };
}

function resolveUtilityMove(player, opponent, move) {
  if (move === "s5") {
    const before = player.hp;
    player.hp = Math.min(MAX_HP, player.hp + 35);
    return `${player.name} healed ${player.hp - before} HP`;
  }

  if (move === "s7") {
    player.energy = clamp(player.energy + 32, 0, MAX_ENERGY);
    player.stamina = clamp(player.stamina + 28, 0, MAX_STAMINA);
    return `${player.name} charged energy and stamina`;
  }

  if (move === "s12") {
    player.energy = clamp(player.energy + 18, 0, MAX_ENERGY);
    player.stamina = clamp(player.stamina + 18, 0, MAX_STAMINA);
    player.combo = Math.max(player.combo, 1);
    return `${player.name} focused and prepared`;
  }

  if (move === "s10") {
    player.cloneReady = true;
    return `${player.name} created a shadow clone`;
  }

  if (move === "s9") {
    player.trapReady = true;
    return `${player.name} prepared a shadow trap`;
  }

  return "";
}

function getWeather() {
  const list = ["clear", "storm", "ash"];
  return list[randomInt(0, list.length - 1)];
}

function weatherMessage(weather) {
  if (weather === "storm") return "⛈️ STORM ARENA";
  if (weather === "ash") return "🌋 ASH ARENA";
  return "🌌 SHADOW ARENA";
}

function moveIsAttack(move) {
  return ["s1", "s2", "s3", "s6", "s8", "s11"].includes(move);
}

// ======================================================
// ROUND RESOLUTION
// ======================================================

function resolveRound(game) {
  const p1 = game.p1;
  const p2 = game.p2;

  const m1 = p1.move;
  const m2 = p2.move;

  const lines = [];
  const visualMoves = [];

  const status1 = applyStatusDamage(p1);
  const status2 = applyStatusDamage(p2);

  lines.push(...status1.messages, ...status2.messages);

  if (p1.hp <= 0 || p2.hp <= 0) {
    game.lastResult = {
      lines,
      visualMoves: [],
      title: "STATUS DAMAGE"
    };
    return finishOrContinue(game);
  }

  const disabled1 = isDisabled(p1);
  const disabled2 = isDisabled(p2);

  if (disabled1) lines.push(`⛔ ${p1.name} cannot act this round`);
  if (disabled2) lines.push(`⛔ ${p2.name} cannot act this round`);

  const actual1 = disabled1 ? null : m1;
  const actual2 = disabled2 ? null : m2;

  if (actual1) spendCost(p1, actual1);
  if (actual2) spendCost(p2, actual2);

  let dodge1 = false;
  let dodge2 = false;

  const attack1 = actual1 && moveIsAttack(actual1);
  const attack2 = actual2 && moveIsAttack(actual2);

  // Dodge success is evaluated independently.
  if (actual1 === "s4" && attack2) dodge1 = chance(DODGE_CHANCE * 100);
  if (actual2 === "s4" && attack1) dodge2 = chance(DODGE_CHANCE * 100);

  if (actual1 === "s4") {
    lines.push(dodge1
      ? `💨 ${p1.name} successfully dodged!`
      : `💨 ${p1.name} tried to dodge!`);
    visualMoves.push({ move: "s4", attacker: p1, side: "left" });
  }

  if (actual2 === "s4") {
    lines.push(dodge2
      ? `💨 ${p2.name} successfully dodged!`
      : `💨 ${p2.name} tried to dodge!`);
    visualMoves.push({ move: "s4", attacker: p2, side: "right" });
  }

  // Both attack actions are resolved after dodge checks.
  if (attack1) {
    if (dodge2) {
      lines.push(`🌀 ${p2.name} avoided ${getMoveLabel(actual1)} completely!`);
    } else {
      const result = attackResult(p1, p2, actual1);
      lines.push(result.text);
      visualMoves.push({ move: actual1, attacker: p1, side: "left" });
    }
  } else if (actual1 && !["s4"].includes(actual1)) {
    const message = resolveUtilityMove(p1, p2, actual1);
    if (message) lines.push(message);
    visualMoves.push({ move: actual1, attacker: p1, side: "left" });
  }

  if (attack2) {
    if (dodge1) {
      lines.push(`🌀 ${p1.name} avoided ${getMoveLabel(actual2)} completely!`);
    } else {
      const result = attackResult(p2, p1, actual2);
      lines.push(result.text);
      visualMoves.push({ move: actual2, attacker: p2, side: "right" });
    }
  } else if (actual2 && !["s4"].includes(actual2)) {
    const message = resolveUtilityMove(p2, p1, actual2);
    if (message) lines.push(message);
    visualMoves.push({ move: actual2, attacker: p2, side: "right" });
  }

  const wind1 = applySecondWind(p1);
  const wind2 = applySecondWind(p2);

  if (wind1) lines.push(`✨ ${p1.name} activated SECOND WIND! +65 HP`);
  if (wind2) lines.push(`✨ ${p2.name} activated SECOND WIND! +65 HP`);

  regenerate(p1);
  regenerate(p2);

  // A successful dodge gives one manual, hidden bonus attack.
  const bonusQueue = [];
  if (dodge1 && p1.hp > 0 && p2.hp > 0) bonusQueue.push(p1.uid);
  if (dodge2 && p1.hp > 0 && p2.hp > 0) bonusQueue.push(p2.uid);

  p1.move = null;
  p2.move = null;
  p1.ready = false;
  p2.ready = false;

  game.lastResult = {
    lines,
    visualMoves,
    title: "ROUND " + game.round
  };

  if (p1.hp <= 0 || p2.hp <= 0) {
    return finishOrContinue(game);
  }

  if (bonusQueue.length) {
    game.phase = "bonus";
    game.bonusQueue = bonusQueue;
    game.bonusMoves = {};

    sendToGame(
      global.__shadowApi,
      game,
      "⚡ DODGE BONUS PHASE!\n" +
      "Successful dodge! You earned ONE manual bonus attack.\n" +
      "Choose an attack: s1, s2, s3, s6, s8, s11\n" +
      "Your bonus move stays secret until eligible players submit."
    );

    saveDB();
    return;
  }

  finishRound(game);
}

function resolveBonusPhase(game) {
  const p1 = game.p1;
  const p2 = game.p2;

  const queue = game.bonusQueue || [];
  const moves = game.bonusMoves || {};
  const lines = [];

  for (const uid of queue) {
    const attacker = uid === p1.uid ? p1 : p2;
    const defender = attacker === p1 ? p2 : p1;
    const move = moves[uid];

    if (!move || attacker.hp <= 0 || defender.hp <= 0) continue;

    if (!canAfford(attacker, move)) {
      lines.push(`${attacker.name} could not afford the bonus attack.`);
      continue;
    }

    spendCost(attacker, move);
    const result = attackResult(attacker, defender, move, { bonus: true });
    lines.push(result.text);
    applySecondWind(defender);
  }

  game.lastResult = {
    lines,
    visualMoves: queue
      .filter(uid => moves[uid])
      .map(uid => ({
        move: moves[uid],
        attacker: uid === p1.uid ? p1 : p2,
        side: uid === p1.uid ? "left" : "right"
      })),
    title: "DODGE BONUS ATTACK"
  };

  game.phase = "normal";
  game.bonusQueue = [];
  game.bonusMoves = {};

  finishRound(game);
}

function finishOrContinue(game) {
  if (game.p1.hp <= 0 || game.p2.hp <= 0) {
    finishGame(game);
  } else {
    finishRound(game);
  }
}

function finishRound(game) {
  game.phase = "normal";
  game.round = (game.round || 1) + 1;

  game.p1.move = null;
  game.p2.move = null;
  game.p1.ready = false;
  game.p2.ready = false;

  game.p1.energy = clamp(game.p1.energy + 5, 0, MAX_ENERGY);
  game.p2.energy = clamp(game.p2.energy + 5, 0, MAX_ENERGY);

  saveDB();
  announceRound(game);
}

function finishGame(game) {
  const p1 = game.p1;
  const p2 = game.p2;

  let result;
  if (p1.hp <= 0 && p2.hp <= 0) {
    result = "DRAW";
  } else if (p1.hp <= 0) {
    result = p2.name + " WINS!";
    p2.wins = (p2.wins || 0) + 1;
    p1.losses = (p1.losses || 0) + 1;
  } else {
    result = p1.name + " WINS!";
    p1.wins = (p1.wins || 0) + 1;
    p2.losses = (p2.losses || 0) + 1;
  }

  game.status = "finished";
  game.phase = "finished";
  game.finishedAt = Date.now();
  game.winner = result;

  saveDB();

  const message =
    "🏆 SHADOW WAR — MATCH OVER\n\n" +
    result + "\n\n" +
    `⚔️ ${p1.name}: ${Math.ceil(p1.hp)} HP\n` +
    `⚔️ ${p2.name}: ${Math.ceil(p2.hp)} HP\n\n` +
    `📊 ${p1.name}: ${p1.wins} wins / ${p1.losses} losses\n` +
    `📊 ${p2.name}: ${p2.wins} wins / ${p2.losses} losses\n\n` +
    "Create another match with: shadow create";

  sendToGame(global.__shadowApi, game, message);
  renderBattleImage(game, game.lastResult || { lines: [], visualMoves: [], title: "MATCH OVER" }, true);
}

// ======================================================
// CINEMATIC CANVAS RENDERING
// ======================================================

function drawPlayerPanel(ctx, player, x, side) {
  drawText(ctx, player.name.toUpperCase(), x, 65, 25, "#ffffff", side);
  drawText(
    ctx,
    `${player.style.toUpperCase()} • ${player.element.toUpperCase()} • ${player.weapon.toUpperCase()}`,
    x,
    96,
    14,
    ELEMENT_COLORS[player.element] || "#ffffff",
    side
  );
}

function drawBattleScene(game, result, finished = false) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  drawBackground(ctx, game);

  const p1 = game.p1;
  const p2 = game.p2;

  drawPlayerPanel(ctx, p1, 60, "left");
  drawPlayerPanel(ctx, p2, W - 60, "right");

  drawHealthBar(ctx, 60, 115, p1, ELEMENT_COLORS[p1.element]);
  drawHealthBar(ctx, W - 470, 115, p2, ELEMENT_COLORS[p2.element], true);

  drawEnergyBar(ctx, 60, 150, p1.energy);
  drawEnergyBar(ctx, W - 260, 150, p2.energy, true);

  drawText(ctx, `ROUND ${game.round || 1}`, W / 2, 75, 32, "#ffffff", "center");
  drawText(ctx, weatherMessage(game.weather), W / 2, 105, 15, "#b8caff", "center");

  const move1 = p1.move || (p1.ready ? "READY" : "WAITING");
  const move2 = p2.move || (p2.ready ? "READY" : "WAITING");

  drawFighter(ctx, 300, 590, p1, "left", "idle");
  drawFighter(ctx, 900, 590, p2, "right", "idle");

  if (result && Array.isArray(result.visualMoves)) {
    for (const item of result.visualMoves) {
      const x = item.side === "left" ? 300 : 900;
      const y = 590;
      const pose = poseForMove(item.move);

      drawFighter(
        ctx,
        x,
        y,
        item.attacker,
        item.side,
        pose,
        ELEMENT_COLORS[item.attacker.element]
      );

      drawMoveEffect(
        ctx,
        item.move,
        item.attacker,
        item.side === "left" ? p2 : p1,
        item.side
      );
    }
  }

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, 190);
  ctx.lineTo(W / 2, 620);
  ctx.stroke();

  // Battle log panel
  roundedRect(ctx, 80, 625, 1040, 105, 16, "rgba(5,8,20,0.88)");

  drawText(
    ctx,
    finished ? "MATCH RESULT" : (result.title || "BATTLE LOG"),
    W / 2,
    653,
    19,
    "#ffffff",
    "center"
  );

  const lines = (result.lines || []).slice(-3);
  lines.forEach((line, index) => {
    drawText(
      ctx,
      String(line).slice(0, 105),
      W / 2,
      678 + index * 17,
      13,
      "#dce7ff",
      "center"
    );
  });

  if (finished) {
    drawText(ctx, game.winner || "MATCH OVER", W / 2, 250, 42, "#ffe45c", "center");
  }

  return canvas;
}

function renderBattleImage(game, result, finished = false) {
  try {
    ensureDirectories();

    const canvas = drawBattleScene(game, result, finished);
    const file = path.join(
      CACHE_DIR,
      `shadow_${game.code}_${Date.now()}_${randomInt(1000, 9999)}.png`
    );

    fs.writeFileSync(file, canvas.toBuffer("image/png"));

    const api = global.__shadowApi;
    if (!api || typeof api.sendMessage !== "function") {
      try { fs.unlinkSync(file); } catch (_) {}
      return;
    }

    const targets = new Set([
      String(game.p1.threadID),
      ...(game.p2 ? [String(game.p2.threadID)] : [])
    ]);

    for (const tid of targets) {
      api.sendMessage(
        {
          body: `⚔️ SHADOW WAR • ${result.title || "BATTLE"}\n${(result.lines || []).join("\n")}`,
          attachment: fs.createReadStream(file)
        },
        tid,
        () => {}
      );
    }

    sleepSafeUnlink(file);
  } catch (err) {
    console.error("[SHADOW] Render error:", err);
  }
}

function announceRound(game) {
  if (game.status !== "active") return;

  const message =
    `⚔️ SHADOW WAR — ROUND ${game.round}\n` +
    `${game.p1.name}: ${Math.ceil(game.p1.hp)} HP | Energy ${game.p1.energy}\n` +
    `${game.p2.name}: ${Math.ceil(game.p2.hp)} HP | Energy ${game.p2.energy}\n\n` +
    "Choose your move secretly:\n" +
    "s1 Kick | s2 Punch | s3 Fire Blast | s4 Dodge\n" +
    "s5 Heal | s6 Thunder | s7 Charge | s8 Feint\n" +
    "s9 Shadow Trap | s10 Clone | s11 Ultimate | s12 Focus\n\n" +
    "Both players must submit a move.";

  sendToGame(global.__shadowApi, game, message);
  renderBattleImage(game, {
    title: `ROUND ${game.round}`,
    lines: ["Both fighters are ready.", "Choose your move secretly."],
    visualMoves: []
  });
}
// ======================================================
// FINAL GAME ANNOUNCEMENT
// ======================================================

// Shows the previous round's actual result image.
function announceRound(game) {
  if (!game || game.status !== "active") return;

  const result = game.lastResult || {
    title: `ROUND ${game.round}`,
    lines: ["Both fighters are ready."],
    visualMoves: []
  };

  const message =
    `⚔️ SHADOW WAR — ROUND ${game.round}\n\n` +
    `🔥 ${game.p1.name}: ${Math.ceil(game.p1.hp)} HP | Energy ${game.p1.energy} | Stamina ${game.p1.stamina}\n` +
    `❄️ ${game.p2.name}: ${Math.ceil(game.p2.hp)} HP | Energy ${game.p2.energy} | Stamina ${game.p2.stamina}\n\n` +
    "Choose your move secretly:\n" +
    "s1 Kick | s2 Punch | s3 Fire Blast | s4 Dodge\n" +
    "s5 Heal | s6 Thunder | s7 Charge | s8 Feint\n" +
    "s9 Shadow Trap | s10 Clone | s11 Ultimate | s12 Focus\n\n" +
    "Both players must submit a move.";

  sendToGame(global.__shadowApi, game, message);
  renderBattleImage(game, result);
}

// ======================================================
// DATABASE MIGRATION / SAFETY
// ======================================================

// Fixes HP=0 migration issue from older builds.
normalizePlayer = function(p) {
  const base = defaultPlayer(
    p.uid || "unknown",
    p.name || "Fighter",
    p.threadID || "unknown"
  );

  const merged = { ...base, ...p };

  const hp = Number(merged.hp);
  const energy = Number(merged.energy);
  const stamina = Number(merged.stamina);

  merged.hp = clamp(Number.isFinite(hp) ? hp : MAX_HP, 0, MAX_HP);
  merged.energy = clamp(Number.isFinite(energy) ? energy : 65, 0, MAX_ENERGY);
  merged.stamina = clamp(Number.isFinite(stamina) ? stamina : MAX_STAMINA, 0, MAX_STAMINA);

  if (!STYLES.includes(merged.style)) merged.style = "balanced";
  if (!ELEMENTS.includes(merged.element)) merged.element = "fire";
  if (!WEAPONS.includes(merged.weapon)) merged.weapon = "sword";

  merged.burn = Math.max(0, Number(merged.burn) || 0);
  merged.freeze = Math.max(0, Number(merged.freeze) || 0);
  merged.poison = Math.max(0, Number(merged.poison) || 0);
  merged.stun = Math.max(0, Number(merged.stun) || 0);

  merged.secondWind = merged.secondWind !== false;
  merged.combo = Math.max(0, Number(merged.combo) || 0);
  merged.totalDamage = Math.max(0, Number(merged.totalDamage) || 0);
  merged.wins = Math.max(0, Number(merged.wins) || 0);
  merged.losses = Math.max(0, Number(merged.losses) || 0);

  return merged;
};

// Recover older saved matches safely.
for (const game of Object.values(db.games)) {
  if (!game || !game.p1) continue;

  game.p1 = normalizePlayer(game.p1);
  if (game.p2) game.p2 = normalizePlayer(game.p2);

  game.phase = game.phase || "normal";
  game.bonusQueue = Array.isArray(game.bonusQueue) ? game.bonusQueue : [];
  game.bonusMoves = game.bonusMoves && typeof game.bonusMoves === "object"
    ? game.bonusMoves
    : {};

  game.weather = game.weather || "clear";
  game.round = Math.max(1, Number(game.round) || 1);
}

saveDB();

// ======================================================
// PLAYER / GAME LOOKUP
// ======================================================

function findGameByCode(code) {
  return db.games[String(code || "").toUpperCase()] || null;
}

function getNameFromEvent(event) {
  return cleanName(
    event.senderName ||
    event.name ||
    event.userName ||
    "Fighter"
  );
}

function getEventIDs(event) {
  return {
    threadID: String(event.threadID),
    senderID: String(event.senderID)
  };
}

function isValidCode(text) {
  return /^[A-HJ-NP-Z2-9]{5}$/i.test(String(text || "").trim());
}

function getMoveFromText(text) {
  const value = String(text || "").trim().toLowerCase();
  return /^s(?:[1-9]|1[0-2])$/.test(value) ? value : null;
}

function getStatusText(game) {
  const p1 = game.p1;
  const p2 = game.p2;

  return (
    `⚔️ SHADOW WAR — ${game.code}\n` +
    `Status: ${game.status.toUpperCase()}\n` +
    `Round: ${game.round}\n` +
    `Phase: ${game.phase || "normal"}\n` +
    `Weather: ${game.weather}\n\n` +
    `🔴 ${p1.name}\n` +
    `HP: ${Math.ceil(p1.hp)}/${MAX_HP}\n` +
    `Energy: ${p1.energy}/${MAX_ENERGY}\n` +
    `Stamina: ${p1.stamina}/${MAX_STAMINA}\n` +
    `Style: ${p1.style} | Element: ${p1.element} | Weapon: ${p1.weapon}\n` +
    `Wins: ${p1.wins} | Losses: ${p1.losses}\n\n` +
    (
      p2
        ? `🔵 ${p2.name}\n` +
          `HP: ${Math.ceil(p2.hp)}/${MAX_HP}\n` +
          `Energy: ${p2.energy}/${MAX_ENERGY}\n` +
          `Stamina: ${p2.stamina}/${MAX_STAMINA}\n` +
          `Style: ${p2.style} | Element: ${p2.element} | Weapon: ${p2.weapon}\n` +
          `Wins: ${p2.wins} | Losses: ${p2.losses}\n`
        : "Waiting for Player 2 to join..."
    )
  );
}

// ======================================================
// CREATE GAME
// ======================================================

function createGame(api, event) {
  const { threadID, senderID } = getEventIDs(event);

  if (groupHasGame(threadID)) {
    return sendText(
      api,
      "❌ এই Group-এ ইতিমধ্যে একটি Shadow War Game আছে।",
      threadID
    );
  }

  const code = makeCode();

  const game = {
    code,
    status: "waiting",
    phase: "normal",
    round: 1,
    weather: getWeather(),
    createdAt: Date.now(),

    p1: defaultPlayer(
      senderID,
      getNameFromEvent(event),
      threadID
    ),

    p2: null,

    bonusQueue: [],
    bonusMoves: {},

    lastResult: {
      title: "MATCH CREATED",
      lines: ["Waiting for the second fighter."],
      visualMoves: []
    }
  };

  db.games[code] = game;
  saveDB();

  sendText(
    api,
    "🌑 SHADOW WAR CREATED!\n\n" +
    `🎮 Match Code: ${code}\n\n` +
    "অন্য Messenger Group-এ গিয়ে শুধু এই Code পাঠাও:\n" +
    `👉 ${code}\n\n` +
    "Player 2 এই Code পাঠালেই Join হয়ে যাবে।\n" +
    "একই Group থেকে Join করা যাবে না।",
    threadID
  );
}

// ======================================================
// JOIN GAME
// ======================================================

function joinGame(api, event, rawCode) {
  const { threadID, senderID } = getEventIDs(event);
  const code = String(rawCode || "").trim().toUpperCase();

  if (!isValidCode(code)) {
    return sendText(api, "❌ Invalid Match Code.", threadID);
  }

  const game = findGameByCode(code);

  if (!game) {
    return sendText(api, "❌ এই Code-এর কোনো Game পাওয়া যায়নি।", threadID);
  }

  if (game.status !== "waiting" || game.p2) {
    return sendText(api, "❌ এই Match-এ ইতিমধ্যে Player Join করেছে অথবা Match শেষ।", threadID);
  }

  if (String(game.p1.threadID) === threadID) {
    return sendText(api, "❌ Player 2-কে অন্য Messenger Group থেকে Join করতে হবে।", threadID);
  }

  if (String(game.p1.uid) === senderID) {
    return sendText(api, "❌ নিজের Match-এ নিজেই Join করা যাবে না।", threadID);
  }

  if (groupHasGame(threadID)) {
    return sendText(
      api,
      "❌ এই Group-এ ইতিমধ্যে অন্য একটি Shadow War Match আছে।",
      threadID
    );
  }

  game.p2 = defaultPlayer(
    senderID,
    getNameFromEvent(event),
    threadID
  );

  game.status = "active";
  game.phase = "normal";
  game.round = 1;
  game.weather = getWeather();

  game.lastResult = {
    title: "MATCH STARTED",
    lines: [
      `${game.p1.name} VS ${game.p2.name}`,
      "The battle begins!"
    ],
    visualMoves: []
  };

  saveDB();

  const startMessage =
    "🔥 SHADOW WAR MATCH STARTED!\n\n" +
    `🔴 Player 1: ${game.p1.name}\n` +
    `🔵 Player 2: ${game.p2.name}\n\n` +
    `🎮 Match Code: ${code}\n` +
    `${weatherMessage(game.weather)}\n\n` +
    "দুই Player এখন Move দিতে পারবে।\n" +
    "Move গোপন থাকবে যতক্ষণ না দুইজন Submit করে।\n\n" +
    "প্রথম Move: s1 থেকে s12";

  sendToGame(api, game, startMessage);
  announceRound(game);
  saveDB();
}

// ======================================================
// MOVE SUBMISSION
// ======================================================

function submitMove(api, event, move) {
  const { threadID, senderID } = getEventIDs(event);
  const found = getGameForPlayer(threadID, senderID);

  if (!found) {
    return sendText(
      api,
      "❌ তুমি কোনো Active Shadow War Match-এ নেই।\n" +
      "Game শুরু করতে: shadow create",
      threadID
    );
  }

  const { game } = found;

  if (game.status !== "active") {
    return sendText(api, "❌ এই Match Active নেই।", threadID);
  }

  const player = getPlayerByThread(game, threadID, senderID);

  if (!player) {
    return sendText(api, "❌ Player পাওয়া যায়নি।", threadID);
  }

  // Bonus phase: only successful dodgers can submit one attack.
  if (game.phase === "bonus") {
    const allowed = (game.bonusQueue || []).includes(player.uid);

    if (!allowed) {
      return sendText(
        api,
        "⏳ অন্য Player-এর Dodge Bonus Attack-এর জন্য অপেক্ষা করো।",
        threadID
      );
    }

    if (game.bonusMoves[player.uid]) {
      return sendText(
        api,
        "❌ তুমি ইতিমধ্যে তোমার Bonus Attack Submit করেছ।",
        threadID
      );
    }

    if (!moveIsAttack(move)) {
      return sendText(
        api,
        "❌ Bonus Attack-এর জন্য শুধু এগুলো ব্যবহার করো:\n" +
        "s1, s2, s3, s6, s8, s11",
        threadID
      );
    }

    if (!canAfford(player, move)) {
      return sendText(
        api,
        "❌ এই Bonus Attack-এর জন্য তোমার Energy/Stamina যথেষ্ট নেই।",
        threadID
      );
    }

    game.bonusMoves[player.uid] = move;
    saveDB();

    sendText(
      api,
      "✅ তোমার Bonus Attack গোপনে Submit হয়েছে।",
      threadID
    );

    const allSubmitted = game.bonusQueue.every(
      uid => Boolean(game.bonusMoves[uid])
    );

    if (allSubmitted) {
      resolveBonusPhase(game);
      saveDB();
    }

    return;
  }

  if (game.phase !== "normal") {
    return sendText(api, "⏳ Game-এর পরবর্তী Phase-এর জন্য অপেক্ষা করো।", threadID);
  }

  if (player.ready || player.move) {
    return sendText(
      api,
      "❌ তুমি এই Round-এর Move ইতিমধ্যে Submit করেছ।",
      threadID
    );
  }

  if (!canAfford(player, move)) {
    return sendText(
      api,
      "❌ এই Move-এর জন্য তোমার Energy অথবা Stamina যথেষ্ট নেই।",
      threadID
    );
  }

  player.move = move;
  player.ready = true;

  saveDB();

  sendText(
    api,
    "✅ তোমার Move গোপনে Submit হয়েছে।\n" +
    "অন্য Player-এর Move-এর জন্য অপেক্ষা করো।",
    threadID
  );

  if (game.p1.ready && game.p2.ready) {
    resolveRound(game);
    saveDB();
  }
}

// ======================================================
// PLAYER SETTINGS
// ======================================================

function changeSetting(api, event, type, value) {
  const { threadID, senderID } = getEventIDs(event);
  const found = getGameForPlayer(threadID, senderID);

  if (!found) {
    return sendText(api, "❌ আগে Shadow War Match তৈরি অথবা Join করো।", threadID);
  }

  const game = found.game;
  const player = getPlayerByThread(game, threadID, senderID);

  if (game.status !== "waiting") {
    return sendText(
      api,
      "❌ Match শুরু হয়ে গেলে Style, Element বা Weapon পরিবর্তন করা যাবে না।",
      threadID
    );
  }

  value = String(value || "").toLowerCase();

  if (type === "style" && STYLES.includes(value)) {
    player.style = value;
  } else if (type === "element" && ELEMENTS.includes(value)) {
    player.element = value;
  } else if (type === "weapon" && WEAPONS.includes(value)) {
    player.weapon = value;
  } else {
    return sendText(
      api,
      "❌ Invalid option.\n\n" +
      `Styles: ${STYLES.join(", ")}\n` +
      `Elements: ${ELEMENTS.join(", ")}\n` +
      `Weapons: ${WEAPONS.join(", ")}`,
      threadID
    );
  }

  saveDB();

  sendText(
    api,
    `✅ ${type.toUpperCase()} সেট করা হয়েছে: ${value.toUpperCase()}`,
    threadID
  );
}

// ======================================================
// STATUS / QUIT / HELP
// ======================================================

function showStatus(api, event) {
  const { threadID, senderID } = getEventIDs(event);
  const found = getGameForPlayer(threadID, senderID);

  if (!found) {
    return sendText(api, "❌ তুমি কোনো Match-এ নেই।", threadID);
  }

  sendText(api, getStatusText(found.game), threadID);
}

function quitGame(api, event) {
  const { threadID, senderID } = getEventIDs(event);
  const found = getGameForPlayer(threadID, senderID);

  if (!found) {
    return sendText(api, "❌ তুমি কোনো Match-এ নেই।", threadID);
  }

  const game = found.game;

  if (game.status === "active") {
    return sendText(
      api,
      "⛔ Battle শুরু হয়ে গেলে মাঝপথে Quit করা যাবে না।\n" +
      "HP 0 হলে Match শেষ হবে।",
      threadID
    );
  }

  if (game.status === "waiting") {
    delete db.games[found.code];
    saveDB();

    sendToGame(
      api,
      game,
      `❌ ${game.p1.name} Waiting Match Cancel করেছে।`
    );

    return;
  }

  sendText(api, "এই Match ইতিমধ্যে শেষ হয়েছে।", threadID);
}

function helpText() {
  return (
    "🌑 SHADOW WAR — COMMAND GUIDE\n\n" +
    "🎮 GAME COMMANDS\n" +
    "shadow create — নতুন Match তৈরি\n" +
    "শুধু CODE — অন্য Group থেকে Join\n" +
    "shadow join CODE — বিকল্প Join পদ্ধতি\n" +
    "shadow status — Player Status\n" +
    "shadow quit — Waiting Match Cancel\n\n" +
    "⚔️ MOVES\n" +
    "s1 — Kick\n" +
    "s2 — Punch\n" +
    "s3 — Fire Blast\n" +
    "s4 — Dodge\n" +
    "s5 — Heal\n" +
    "s6 — Thunder\n" +
    "s7 — Power Charge\n" +
    "s8 — Feint\n" +
    "s9 — Shadow Trap\n" +
    "s10 — Clone\n" +
    "s11 — Ultimate\n" +
    "s12 — Focus\n\n" +
    "🌀 DODGE BONUS\n" +
    "Dodge সফল হলে প্রতিপক্ষের Attack সম্পূর্ণ Miss করবে।\n" +
    "এরপর নিজে একটি Bonus Attack বেছে নিতে পারবে:\n" +
    "s1, s2, s3, s6, s8 অথবা s11\n" +
    "Automatic Counter নেই।\n\n" +
    "🛠️ SETTINGS (শুধু Match শুরু হওয়ার আগে)\n" +
    "shadow style aggressive\n" +
    "shadow style defensive\n" +
    "shadow style balanced\n" +
    "shadow style trickster\n\n" +
    "shadow element fire\n" +
    "shadow element ice\n" +
    "shadow element thunder\n" +
    "shadow element shadow\n" +
    "shadow element nature\n\n" +
    "shadow weapon sword\n" +
    "shadow weapon staff\n" +
    "shadow weapon dualblade\n" +
    "shadow weapon gauntlet\n\n" +
    "📌 একই Match-এর দুই Player-কে আলাদা Messenger Group-এ থাকতে হবে।"
  );
}

// ======================================================
// COMMAND ROUTER
// ======================================================

function handleCommand(api, event, args) {
  global.__shadowApi = api;

  const threadID = String(event.threadID);
  const action = String(args[0] || "help").toLowerCase();

  if (action === "create" || action === "start") {
    return createGame(api, event);
  }

  if (action === "join") {
    return joinGame(api, event, args[1]);
  }

  if (action === "status" || action === "info") {
    return showStatus(api, event);
  }

  if (action === "quit" || action === "cancel") {
    return quitGame(api, event);
  }

  if (action === "style" || action === "element" || action === "weapon") {
    return changeSetting(api, event, action, args[1]);
  }

  if (action === "help" || action === "menu") {
    return sendText(api, helpText(), threadID);
  }

  const move = getMoveFromText(action);
  if (move) {
    return submitMove(api, event, move);
  }

  return sendText(api, helpText(), threadID);
}

// ======================================================
// BARE CODE JOIN + MOVE HANDLER
// ======================================================

function handleOnChat(api, event) {
  if (!event || !event.body || !event.threadID || !event.senderID) return;

  global.__shadowApi = api;

  const body = String(event.body).trim();

  // Do not intercept normal bot commands.
  if (/^[!/#.]?shadow(?:2)?(?:\s|$)/i.test(body)) return;

  // Bare 5-character code: automatic cross-group join.
  if (isValidCode(body)) {
    const game = findGameByCode(body.toUpperCase());

    if (game && game.status === "waiting" && !game.p2) {
      return joinGame(api, event, body);
    }
  }

  // Moves: s1 to s12.
  const move = getMoveFromText(body);
  if (move) {
    return submitMove(api, event, move);
  }
}

// ======================================================
// GOATBOT EXPORT
// ======================================================

module.exports = {
  config: {
    name: "shadow",
    version: "8.0.0",
    author: "Si Fat",
    countDown: 3,
    role: 0,
    shortDescription: "2.5D Cross-Group Fighting Game",
    longDescription: "SHADOW WAR — Cross-group multiplayer battle arena",
    category: "game",
    guide: {
      en:
        "{pn} create\n" +
        "{pn} join CODE\n" +
        "{pn} status\n" +
        "{pn} quit\n" +
        "{pn} help"
    }
  },

  onStart: async function({ api, event, args }) {
    return handleCommand(api, event, args || []);
  },

  run: async function({ api, event, args }) {
    return handleCommand(api, event, args || []);
  },

  onChat: async function({ api, event }) {
    return handleOnChat(api, event);
  }
};
