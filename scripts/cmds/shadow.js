
"use strict";

const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");

// ========================================
// SHADOW WAR V6 - ULTIMATE STRATEGY BATTLE
// ========================================

const DATA_FILE = path.join(__dirname, "shadow_war_data.json");
const CACHE_DIR = path.join(__dirname, "shadow_cache");

const MAX_HP = 300;
const MAX_ENERGY = 100;
const MAX_STAMINA = 100;
const HEAL_AMOUNT = 35;
const SECOND_WIND_HP = 50;
const MAX_COMEBACKS = 2;

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// ========================================
// DATABASE
// ========================================

function loadDB() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      if (data && typeof data.games === "object") return data;
    }
  } catch (e) {
    console.error("Shadow DB load error:", e);
  }

  return { games: {} };
}

let db = loadDB();

function saveDB() {
  try {
    const temp = DATA_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(db, null, 2));
    fs.renameSync(temp, DATA_FILE);
  } catch (e) {
    console.error("Shadow DB save error:", e);
  }
}

function makeCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function groupHasGame(threadID) {
  return Object.values(db.games).some(game =>
    ["waiting", "active"].includes(game.status) &&
    (
      game.player1?.threadID === threadID ||
      game.player2?.threadID === threadID
    )
  );
}

function getActiveGame(threadID) {
  return Object.values(db.games).find(game =>
    game.status === "active" &&
    (
      game.player1?.threadID === threadID ||
      game.player2?.threadID === threadID
    )
  );
}

function getPlayer(game, userID) {
  if (String(game.player1.userID) === String(userID)) return game.player1;
  if (String(game.player2?.userID) === String(userID)) return game.player2;
  return null;
}

function getOpponent(game, userID) {
  if (String(game.player1.userID) === String(userID)) return game.player2;
  if (String(game.player2?.userID) === String(userID)) return game.player1;
  return null;
}

function createPlayer(userID, threadID) {
  return {
    userID: String(userID),
    threadID,
    hp: MAX_HP,
    energy: 45,
    stamina: MAX_STAMINA,
    move: null,

    style: "balanced",
    element: "fire",
    weapon: "gauntlet",

    secondWind: true,
    comebacks: 0,
    counterReady: false,
    trapReady: false,
    cloneReady: false,

    burn: 0,
    poison: 0,
    freeze: 0,
    stun: 0,

    ultimateCooldown: 0,
    combo: 0,
    lastMove: null,
    totalDamage: 0,
    totalWins: 0
  };
}

// ========================================
// MOVE SYSTEM
// ========================================

const MOVES = {
  s1: "kick",
  s2: "punch",
  s3: "fire",
  s4: "dodge",
  s5: "heal",
  s6: "thunder",
  s7: "charge",
  s8: "feint",
  s9: "trap",
  s10: "clone",
  s11: "ultimate",
  s12: "focus"
};

const MOVE_NAMES = {
  kick: "KICK",
  punch: "PUNCH",
  fire: "FIRE ATTACK",
  dodge: "DODGE",
  heal: "HEAL",
  thunder: "THUNDER",
  charge: "ENERGY CHARGE",
  feint: "FAKE MOVE",
  trap: "TRAP",
  clone: "SHADOW CLONE",
  ultimate: "ULTIMATE",
  focus: "FOCUS"
};

const MOVE_EMOJI = {
  kick: "🦵",
  punch: "👊",
  fire: "🔥",
  dodge: "💨",
  heal: "❤️",
  thunder: "⚡",
  charge: "🔋",
  feint: "🎭",
  trap: "🪤",
  clone: "👥",
  ultimate: "🌟",
  focus: "🎯"
};

const ATTACK_MOVES = ["kick", "punch", "fire", "thunder", "ultimate"];

function moveHelp() {
  return (
    "⚔️ SHADOW WAR V6 — MOVE LIST\n\n" +
    "s1 = 🦵 Kick\n" +
    "s2 = 👊 Punch\n" +
    "s3 = 🔥 Fire Attack\n" +
    "s4 = 💨 Dodge\n" +
    "s5 = ❤️ Heal\n" +
    "s6 = ⚡ Thunder\n" +
    "s7 = 🔋 Charge Energy\n" +
    "s8 = 🎭 Fake Move\n" +
    "s9 = 🪤 Set Trap\n" +
    "s10 = 👥 Shadow Clone\n" +
    "s11 = 🌟 Ultimate Attack\n" +
    "s12 = 🎯 Focus\n\n" +
    "প্রতি রাউন্ডে একটি Move দাও।\n" +
    "দুজন Move দিলে একসঙ্গে Result প্রকাশ হবে।"
  );
}

// ========================================
// PLAYER CUSTOMIZATION
// ========================================

const STYLES = {
  aggressive: {
    name: "Aggressive",
    attack: 1.18,
    defense: 0.95,
    energy: 0.90
  },
  defensive: {
    name: "Defensive",
    attack: 0.90,
    defense: 0.78,
    energy: 1.05
  },
  balanced: {
    name: "Balanced",
    attack: 1,
    defense: 1,
    energy: 1
  },
  trickster: {
    name: "Trickster",
    attack: 0.96,
    defense: 0.92,
    energy: 1.10
  }
};

const ELEMENTS = ["fire", "ice", "thunder", "shadow", "nature"];

const WEAPONS = {
  sword: { name: "Sword", attack: 1.12, energy: 1 },
  staff: { name: "Staff", attack: 1.04, energy: 0.90 },
  dualblade: { name: "Dual Blade", attack: 1.08, energy: 1.05 },
  gauntlet: { name: "Gauntlet", attack: 1.06, energy: 0.95 }
};

function setPlayerOption(player, type, value) {
  value = String(value || "").toLowerCase();

  if (type === "style" && STYLES[value]) {
    player.style = value;
    return "⚔️ Fighting Style set: " + STYLES[value].name;
  }

  if (type === "element" && ELEMENTS.includes(value)) {
    player.element = value;
    return "✨ Element set: " + value.toUpperCase();
  }

  if (type === "weapon" && WEAPONS[value]) {
    player.weapon = value;
    return "🗡️ Weapon set: " + WEAPONS[value].name;
  }

  return null;
}

// ========================================
// MESSENGER FUNCTIONS
// ========================================

function sendText(api, threadID, message) {
  return new Promise(resolve => {
    api.sendMessage(message, threadID, error => {
      if (error) console.error("Shadow send error:", error);
      resolve(!error);
    });
  });
}

function sendImage(api, threadID, imagePath, message) {
  return new Promise(resolve => {
    try {
      const stream = fs.createReadStream(imagePath);

      stream.on("error", error => {
        console.error("Shadow stream error:", error);
      });

      api.sendMessage(
        { body: message, attachment: stream },
        threadID,
        error => {
          if (error) console.error("Shadow image send error:", error);
          resolve(!error);
        }
      );
    } catch (error) {
      console.error("Shadow image error:", error);
      resolve(false);
    }
  });
}

// ========================================
// BATTLE UTILITIES
// ========================================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getElementMultiplier(attacker, defender) {
  const strongAgainst = {
    fire: "nature",
    nature: "thunder",
    thunder: "ice",
    ice: "fire",
    shadow: "shadow"
  };

  if (strongAgainst[attacker] === defender) return 1.20;
  if (strongAgainst[defender] === attacker) return 0.85;
  return 1;
}

function getWeather() {
  const events = [
    { name: "Clear Sky", attack: 1, energy: 1 },
    { name: "Thunderstorm", attack: 1.08, energy: 0.95 },
    { name: "Heavy Rain", attack: 0.95, energy: 1.05 },
    { name: "Dark Fog", attack: 1, energy: 1 },
    { name: "Energy Storm", attack: 1.05, energy: 1.15 }
  ];

  return events[randomInt(0, events.length - 1)];
}

function getAttackPower(player, move) {
  const base = {
    kick: 18,
    punch: 14,
    fire: 25,
    thunder: 29,
    ultimate: 48
  };

  let power = base[move] || 0;

  const style = STYLES[player.style] || STYLES.balanced;
  const weapon = WEAPONS[player.weapon] || WEAPONS.gauntlet;

  power *= style.attack;
  power *= weapon.attack;

  if (player.counterReady) power *= 1.35;

  if (player.combo >= 2) {
    power *= 1 + Math.min(player.combo, 4) * 0.06;
  }

  return Math.floor(power);
}

function applyStatus(player) {
  let damage = 0;
  const effects = [];

  if (player.burn > 0) {
    damage += 7;
    player.burn--;
    effects.push("🔥 Burn");
  }

  if (player.poison > 0) {
    damage += 5;
    player.poison--;
    effects.push("☠️ Poison");
  }

  player.hp = Math.max(0, player.hp - damage);

  return { damage, effects };
}

// ========================================
// STRATEGY MOVE RESOLUTION
// ========================================

function resolveAttack(attacker, defender, move, enemyMove, weather) {
  let damage = 0;
  let critical = false;
  let status = "";
  let note = "";

  if (!ATTACK_MOVES.includes(move)) {
    return { damage, critical, status, note };
  }

  if (move === "ultimate") {
    if (attacker.energy < 65 || attacker.ultimateCooldown > 0) {
      return {
        damage: 0,
        critical: false,
        status: "",
        note: "Ultimate unavailable"
      };
    }

    attacker.energy -= 65;
    attacker.ultimateCooldown = 3;
  } else {
    const cost = move === "thunder" ? 20 : move === "fire" ? 15 : 8;

    if (attacker.stamina < cost) {
      return {
        damage: 0,
        critical: false,
        status: "",
        note: "Not enough stamina"
      };
    }

    attacker.stamina -= cost;
  }

  // Dodge
  if (enemyMove === "dodge") {
    const chance = 0.45;
    if (Math.random() < chance) {
      defender.counterReady = true;
      return {
        damage: 0,
        critical: false,
        status: "",
        note: "PERFECT DODGE! Counter unlocked"
      };
    }
    note = "Dodge failed!";
  }

  // Clone
  if (defender.cloneReady) {
    defender.cloneReady = false;

    if (Math.random() < 0.35) {
      return {
        damage: 0,
        critical: false,
        status: "",
        note: "Shadow Clone avoided the attack!"
      };
    }
  }

  // Trap
  if (defender.trapReady && ATTACK_MOVES.includes(move)) {
    defender.trapReady = false;
    damage += 16;
    note = "TRAP ACTIVATED!";
  }

  let power = getAttackPower(attacker, move);
  const elementBoost = getElementMultiplier(
    attacker.element,
    defender.element
  );

  power *= elementBoost;
  power *= weather.attack;

  if (enemyMove === "feint") power *= 0.90;

  critical = Math.random() < 0.10;
  if (critical) power *= 1.5;

  const defense = STYLES[defender.style] || STYLES.balanced;
  power *= defense.defense;

  damage += Math.max(0, Math.floor(power + randomInt(-3, 5)));

  if (move === "fire" && Math.random() < 0.30) {
    defender.burn = Math.max(defender.burn, 2);
    status = "Burn";
  }

  if (move === "thunder" && Math.random() < 0.25) {
    defender.stun = 1;
    status = "Stun";
  }

  if (move === "ultimate" && Math.random() < 0.30) {
    defender.freeze = 1;
    status = "Freeze";
  }

  attacker.totalDamage += damage;
  attacker.counterReady = false;

  return { damage, critical, status, note };
}

// ========================================
// RANDOM COMEBACK
// ========================================

function tryComeback(player) {
  if (
    player.comebacks >= MAX_COMEBACKS ||
    player.hp <= 0 ||
    player.hp > 150
  ) {
    return false;
  }

  let chance = player.hp <= 50 ? 0.30 :
    player.hp <= 90 ? 0.22 :
    player.hp <= 120 ? 0.15 : 0.08;

  if (Math.random() >= chance) return false;

  player.comebacks++;
  player.hp = Math.min(MAX_HP, player.hp + randomInt(25, 55));
  player.energy = Math.min(MAX_ENERGY, player.energy + 25);
  player.stamina = Math.min(MAX_STAMINA, player.stamina + 20);

  return true;
}

// ========================================
// ROUND ENGINE
// ========================================

function resolveRound(game) {
  const p1 = game.player1;
  const p2 = game.player2;

  const move1 = p1.move;
  const move2 = p2.move;
  const weather = game.weather || getWeather();

  const result = {
    round: game.round,
    move1,
    move2,
    damage1: 0,
    damage2: 0,
    heal1: 0,
    heal2: 0,
    critical1: false,
    critical2: false,
    status1: "",
    status2: "",
    note1: "",
    note2: "",
    comeback1: false,
    comeback2: false,
    weather: weather.name,
    message: "⚔️ BATTLE CONTINUES!"
  };

  // Status effects
  const effect1 = applyStatus(p1);
  const effect2 = applyStatus(p2);

  result.damage1 += effect1.damage;
  result.damage2 += effect2.damage;

  // Stun skips attack
  const canMove1 = p1.stun <= 0;
  const canMove2 = p2.stun <= 0;

  if (p1.stun > 0) p1.stun--;
  if (p2.stun > 0) p2.stun--;

  // Both attacks are calculated before HP changes
  let attack1 = canMove1
    ? resolveAttack(p1, p2, move1, move2, weather)
    : { damage: 0, critical: false, status: "", note: "Stunned!" };

  let attack2 = canMove2
    ? resolveAttack(p2, p1, move2, move1, weather)
    : { damage: 0, critical: false, status: "", note: "Stunned!" };

  result.damage1 += attack2.damage;
  result.damage2 += attack1.damage;

  result.critical1 = attack1.critical;
  result.critical2 = attack2.critical;
  result.status1 = attack2.status;
  result.status2 = attack1.status;
  result.note1 = attack2.note;
  result.note2 = attack1.note;

  p1.hp = Math.max(0, p1.hp - attack2.damage);
  p2.hp = Math.max(0, p2.hp - attack1.damage);

  // Heal
  if (move1 === "heal" && p1.hp > 0) {
    result.heal1 = Math.min(HEAL_AMOUNT, MAX_HP - p1.hp);
    p1.hp += result.heal1;
    p1.energy = Math.min(MAX_ENERGY, p1.energy + 8);
  }

  if (move2 === "heal" && p2.hp > 0) {
    result.heal2 = Math.min(HEAL_AMOUNT, MAX_HP - p2.hp);
    p2.hp += result.heal2;
    p2.energy = Math.min(MAX_ENERGY, p2.energy + 8);
  }

  // Charge
  if (move1 === "charge") {
    p1.energy = Math.min(MAX_ENERGY, p1.energy + 35);
    p1.stamina = Math.min(MAX_STAMINA, p1.stamina + 20);
  }

  if (move2 === "charge") {
    p2.energy = Math.min(MAX_ENERGY, p2.energy + 35);
    p2.stamina = Math.min(MAX_STAMINA, p2.stamina + 20);
  }

  // Focus
  if (move1 === "focus") {
    p1.energy = Math.min(MAX_ENERGY, p1.energy + 20);
    p1.stamina = Math.min(MAX_STAMINA, p1.stamina + 15);
  }

  if (move2 === "focus") {
    p2.energy = Math.min(MAX_ENERGY, p2.energy + 20);
    p2.stamina = Math.min(MAX_STAMINA, p2.stamina + 15);
  }

  // Fake move
  if (move1 === "feint") {
    p1.energy = Math.min(MAX_ENERGY, p1.energy + 10);
    p1.counterReady = Math.random() < 0.30;
  }

  if (move2 === "feint") {
    p2.energy = Math.min(MAX_ENERGY, p2.energy + 10);
    p2.counterReady = Math.random() < 0.30;
  }

  // Trap
  if (move1 === "trap") p1.trapReady = true;
  if (move2 === "trap") p2.trapReady = true;

  // Clone
  if (move1 === "clone") p1.cloneReady = true;
  if (move2 === "clone") p2.cloneReady = true;

  // Combo tracking
  for (const player of [p1, p2]) {
    if (ATTACK_MOVES.includes(player.move)) {
      player.combo = player.lastMove && player.lastMove !== player.move
        ? player.combo + 1
        : 1;
      player.lastMove = player.move;
    } else {
      player.combo = 0;
    }

    player.stamina = clamp(player.stamina + 5, 0, MAX_STAMINA);
    player.energy = clamp(player.energy + 3, 0, MAX_ENERGY);

    if (player.ultimateCooldown > 0 && player.move !== "ultimate") {
      player.ultimateCooldown--;
    }
  }

  // Second Wind: one guaranteed emergency recovery
  if (p1.hp <= 0 && p1.secondWind) {
    p1.hp = SECOND_WIND_HP;
    p1.secondWind = false;
    result.comeback1 = true;
  }

  if (p2.hp <= 0 && p2.secondWind) {
    p2.hp = SECOND_WIND_HP;
    p2.secondWind = false;
    result.comeback2 = true;
  }

  // Random comeback: can happen at low HP, not a guaranteed win
  if (!result.comeback1 && p1.hp > 0) {
    result.comeback1 = tryComeback(p1);
  }

  if (!result.comeback2 && p2.hp > 0) {
    result.comeback2 = tryComeback(p2);
  }

  if (result.comeback1 || result.comeback2) {
    result.message = "🔥 SURPRISE COMEBACK!";
  } else if (result.critical1 || result.critical2) {
    result.message = "💥 CRITICAL HIT!";
  } else if (attack1.note || attack2.note) {
    result.message = "💨 STRATEGY EFFECT ACTIVATED!";
  } else if (result.heal1 || result.heal2) {
    result.message = "❤️ HEALING ACTIVATED!";
  }

  // Damage labels: damage1 = received by P1, damage2 = received by P2
  result.hp1 = p1.hp;
  result.hp2 = p2.hp;
  result.energy1 = p1.energy;
  result.energy2 = p2.energy;
  result.stamina1 = p1.stamina;
  result.stamina2 = p2.stamina;

  p1.move = null;
  p2.move = null;

  game.round++;
  game.weather = getWeather();

  if (p1.hp <= 0 && p2.hp <= 0) {
    game.status = "finished";
    result.message = "🤝 BATTLE DRAW!";
  } else if (p1.hp <= 0) {
    game.status = "finished";
    result.message = "🏆 PLAYER 2 WINS!";
  } else if (p2.hp <= 0) {
    game.status = "finished";
    result.message = "🏆 PLAYER 1 WINS!";
  }

  return result;
}

// ========================================
// CANVAS GRAPHICS
// ========================================

function drawBar(ctx, x, y, width, height, value, max, color) {
  ctx.fillStyle = "#25253b";
  ctx.fillRect(x, y, width, height);

  const percent = clamp(value / max, 0, 1);

  ctx.fillStyle = color;
  ctx.fillRect(x, y, width * percent, height);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
}

function createBattleImage(game, result) {
  const canvas = createCanvas(1100, 760);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 1100, 760);
  bg.addColorStop(0, "#080817");
  bg.addColorStop(0.5, "#27103d");
  bg.addColorStop(1, "#080817");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1100, 760);

  // Stars
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.arc((i * 137) % 1100, (i * 83) % 760, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  // Arena glow
  const glow = ctx.createRadialGradient(550, 390, 30, 550, 390, 430);
  glow.addColorStop(0, "rgba(130,50,220,0.25)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1100, 760);

  ctx.textAlign = "center";

  ctx.fillStyle = "#ffca58";
  ctx.font = "bold 54px Arial";
  ctx.fillText("SHADOW WAR V6", 550, 70);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px Arial";
  ctx.fillText("ROUND " + result.round, 550, 120);

  // Fighter silhouettes
  function fighter(x, y, color, flip) {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 25;

    ctx.beginPath();
    ctx.arc(0, -75, 33, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillRect(-28, -40, 56, 100);

    ctx.lineWidth = 18;
    ctx.lineCap = "round";
    ctx.strokeStyle = color;

    ctx.beginPath();
    ctx.moveTo(-15, -15);
    ctx.lineTo(-70, 25);
    ctx.moveTo(15, -15);
    ctx.lineTo(70, -45);
    ctx.moveTo(-15, 55);
    ctx.lineTo(-55, 120);
    ctx.moveTo(15, 55);
    ctx.lineTo(65, 110);
    ctx.stroke();

    ctx.restore();
  }

  fighter(260, 390, "#54caff", false);
  fighter(840, 390, "#ff6685", true);

  ctx.fillStyle = "#54caff";
  ctx.font = "bold 28px Arial";
  ctx.fillText("PLAYER 1", 260, 175);

  ctx.fillStyle = "#ff6685";
  ctx.fillText("PLAYER 2", 840, 175);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Arial";
  ctx.fillText("HP " + game.player1.hp + "/" + MAX_HP, 260, 215);
  ctx.fillText("HP " + game.player2.hp + "/" + MAX_HP, 840, 215);

  drawBar(ctx, 90, 235, 340, 24, game.player1.hp, MAX_HP, "#20d88b");
  drawBar(ctx, 670, 235, 340, 24, game.player2.hp, MAX_HP, "#ff526c");

  ctx.fillStyle = "#69caff";
  ctx.font = "bold 18px Arial";
  ctx.fillText("ENERGY " + game.player1.energy, 260, 285);
  ctx.fillText("STAMINA " + game.player1.stamina, 260, 315);

  ctx.fillStyle = "#ff8da5";
  ctx.fillText("ENERGY " + game.player2.energy, 840, 285);
  ctx.fillText("STAMINA " + game.player2.stamina, 840, 315);

  ctx.fillStyle = "#ffca58";
  ctx.font = "bold 72px Arial";
  ctx.fillText("VS", 550, 410);

  ctx.fillStyle = "#54caff";
  ctx.font = "bold 23px Arial";
  ctx.fillText(
    MOVE_EMOJI[result.move1] + " " + MOVE_NAMES[result.move1],
    260, 535
  );

  ctx.fillStyle = "#ff6685";
  ctx.fillText(
    MOVE_EMOJI[result.move2] + " " + MOVE_NAMES[result.move2],
    840, 535
  );

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 25px Arial";
  ctx.fillText("DAMAGE RECEIVED", 550, 585);

  ctx.fillStyle = "#54caff";
  ctx.fillText("-" + result.damage1 + " HP", 260, 625);

  ctx.fillStyle = "#ff6685";
  ctx.fillText("-" + result.damage2 + " HP", 840, 625);

  ctx.fillStyle = "#ffca58";
  ctx.font = "bold 23px Arial";
  ctx.fillText(result.message, 550, 675);

  ctx.fillStyle = "#bbbbbb";
  ctx.font = "17px Arial";
  ctx.fillText("ARENA: " + result.weather + " • SECRET STRATEGY BATTLE", 550, 725);

  const file = path.join(
    CACHE_DIR,
    "battle_" + game.code + "_" + result.round + "_" + Date.now() + ".png"
  );

  fs.writeFileSync(file, canvas.toBuffer("image/png"));
  return file;
}

// ========================================
// RESULT BROADCAST
// ========================================

async function broadcastResult(api, game, result) {
  let ending = "";

  if (game.status === "finished") {
    if (game.player1.hp <= 0 && game.player2.hp <= 0) {
      ending = "\n\n🤝 BATTLE DRAW!";
    } else if (game.player1.hp <= 0) {
      ending = "\n\n🏆 PLAYER 2 WINS!";
    } else {
      ending = "\n\n🏆 PLAYER 1 WINS!";
    }
  }

  const message =
    "⚔️ SHADOW WAR V6 - ROUND " + result.round + "\n\n" +
    "🌦️ ARENA: " + result.weather + "\n\n" +
    "🔵 PLAYER 1: " + MOVE_NAMES[result.move1] + "\n" +
    "🔴 PLAYER 2: " + MOVE_NAMES[result.move2] + "\n\n" +
    "💥 PLAYER 1 RECEIVED: " + result.damage1 + " HP DAMAGE\n" +
    "💥 PLAYER 2 RECEIVED: " + result.damage2 + " HP DAMAGE\n\n" +
    "❤️ PLAYER 1 HP: " + game.player1.hp + "/" + MAX_HP + "\n" +
    "❤️ PLAYER 2 HP: " + game.player2.hp + "/" + MAX_HP + "\n\n" +
    "🔋 PLAYER 1 ENERGY: " + game.player1.energy + "\n" +
    "🔋 PLAYER 2 ENERGY: " + game.player2.energy + "\n" +
    "⚡ PLAYER 1 STAMINA: " + game.player1.stamina + "\n" +
    "⚡ PLAYER 2 STAMINA: " + game.player2.stamina + "\n\n" +
    (result.heal1 ? "💚 PLAYER 1 HEALED: +" + result.heal1 + " HP\n" : "") +
    (result.heal2 ? "💚 PLAYER 2 HEALED: +" + result.heal2 + " HP\n" : "") +
    (result.critical1 ? "💥 PLAYER 1 CRITICAL HIT!\n" : "") +
    (result.critical2 ? "💥 PLAYER 2 CRITICAL HIT!\n" : "") +
    (result.comeback1 ? "🔥 PLAYER 1 COMEBACK ACTIVATED!\n" : "") +
    (result.comeback2 ? "🔥 PLAYER 2 COMEBACK ACTIVATED!\n" : "") +
    (result.note1 ? "🔵 PLAYER 1 EFFECT: " + result.note1 + "\n" : "") +
    (result.note2 ? "🔴 PLAYER 2 EFFECT: " + result.note2 + "\n" : "") +
    (result.status1 ? "🔵 PLAYER 1 STATUS: " + result.status1 + "\n" : "") +
    (result.status2 ? "🔴 PLAYER 2 STATUS: " + result.status2 + "\n" : "") +
    "\n✨ " + result.message + ending;

  let imagePath = null;

  try {
    imagePath = createBattleImage(game, result);

    const sent = await Promise.all([
      sendImage(api, game.player1.threadID, imagePath, message),
      sendImage(api, game.player2.threadID, imagePath, message)
    ]);

    // If image delivery fails, send text as fallback.
    const fallback = [];

    if (!sent[0]) {
      fallback.push(sendText(api, game.player1.threadID, message));
    }

    if (!sent[1]) {
      fallback.push(sendText(api, game.player2.threadID, message));
    }

    if (fallback.length) await Promise.all(fallback);
  } catch (error) {
    console.error("Shadow broadcast error:", error);

    await Promise.all([
      sendText(api, game.player1.threadID, message),
      sendText(api, game.player2.threadID, message)
    ]);
  } finally {
    saveDB();

    if (imagePath) {
      setTimeout(() => {
        try {
          if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        } catch (e) {
          console.error("Shadow image cleanup error:", e);
        }
      }, 120000);
    }
  }
}

// ========================================
// PLAYER STATUS
// ========================================

function getStatusText(game, player, opponent) {
  const p1 = game.player1;
  const p2 = game.player2;

  return (
    "⚔️ SHADOW WAR V6 STATUS\n\n" +
    "🔵 PLAYER 1 UID: " + p1.userID + "\n" +
    "❤️ HP: " + p1.hp + "/" + MAX_HP + "\n" +
    "🔋 Energy: " + p1.energy + "/" + MAX_ENERGY + "\n" +
    "⚡ Stamina: " + p1.stamina + "/" + MAX_STAMINA + "\n" +
    "✨ Style: " + p1.style + "\n" +
    "🔥 Element: " + p1.element + "\n" +
    "🗡️ Weapon: " + p1.weapon + "\n\n" +

    "🔴 PLAYER 2 UID: " + p2.userID + "\n" +
    "❤️ HP: " + p2.hp + "/" + MAX_HP + "\n" +
    "🔋 Energy: " + p2.energy + "/" + MAX_ENERGY + "\n" +
    "⚡ Stamina: " + p2.stamina + "/" + MAX_STAMINA + "\n" +
    "✨ Style: " + p2.style + "\n" +
    "🔥 Element: " + p2.element + "\n" +
    "🗡️ Weapon: " + p2.weapon + "\n\n" +

    "🎯 ROUND: " + game.round + "\n" +
    "🌦️ ARENA: " + (game.weather?.name || "Clear Sky") + "\n" +
    "🔒 YOUR MOVE: " + (player.move ? "SUBMITTED" : "WAITING") + "\n" +
    "⚔️ OPPONENT MOVE: " + (opponent.move ? "SUBMITTED (HIDDEN)" : "WAITING") + "\n\n" +

    "🔥 YOUR COMEBACKS: " + player.comebacks + "/" + MAX_COMEBACKS + "\n" +
    "🛡️ SECOND WIND: " + (player.secondWind ? "AVAILABLE" : "USED") + "\n" +
    "🎯 COUNTER: " + (player.counterReady ? "READY" : "NOT READY") + "\n" +
    "🪤 TRAP: " + (player.trapReady ? "READY" : "NOT READY") + "\n" +
    "👥 CLONE: " + (player.cloneReady ? "READY" : "NOT READY")
  );
}

// ========================================
// HELP
// ========================================

function mainHelp() {
  return (
    "🌑 SHADOW WAR V6\n\n" +
    "⚔️ CREATE BATTLE\n" +
    "shadow create\n\n" +
    "🔗 JOIN BATTLE\n" +
    "অন্য গ্রুপে ৫ অক্ষরের Code পাঠাও।\n" +
    "অথবা shadow join CODE\n\n" +
    "📊 STATUS\n" +
    "shadow status\n\n" +
    "🎮 MOVE LIST\n" +
    "shadow moves\n\n" +
    "✨ FIGHTING STYLE\n" +
    "shadow style aggressive\n" +
    "shadow style defensive\n" +
    "shadow style balanced\n" +
    "shadow style trickster\n\n" +
    "🔥 ELEMENT\n" +
    "shadow element fire\n" +
    "shadow element ice\n" +
    "shadow element thunder\n" +
    "shadow element shadow\n" +
    "shadow element nature\n\n" +
    "🗡️ WEAPON\n" +
    "shadow weapon sword\n" +
    "shadow weapon staff\n" +
    "shadow weapon dualblade\n" +
    "shadow weapon gauntlet\n\n" +
    "🛑 QUIT\n" +
    "shadow quit\n\n" +
    "⚡ Bare Move: s1 থেকে s12"
  );
}

// ========================================
// MAIN HANDLER
// ========================================

async function handleAction(api, event, input) {
  const threadID = event.threadID;
  const userID = String(event.senderID);

  let action = String(input || "").trim();

  if (!action) action = "help";

  // Direct 5-character join code
  const directCode = action.toUpperCase();

  if (/^[A-Z0-9]{5}$/.test(directCode) && db.games[directCode]) {
    action = "join " + directCode;
  } else {
    action = action.toLowerCase();
  }

  // ====================================
  // HELP / MOVES
  // ====================================

  if (action === "help") {
    return sendText(api, threadID, mainHelp());
  }

  if (action === "moves") {
    return sendText(api, threadID, moveHelp());
  }

  // ====================================
  // CREATE
  // ====================================

  if (action === "create") {
    if (groupHasGame(threadID)) {
      return sendText(api, threadID, "❌ এই গ্রুপে আগে থেকেই Battle আছে!");
    }

    let code = makeCode();

    while (db.games[code]) {
      code = makeCode();
    }

    db.games[code] = {
      code,
      status: "waiting",
      round: 1,
      weather: getWeather(),

      player1: createPlayer(userID, threadID),
      player2: null,

      createdAt: Date.now()
    };

    saveDB();

    return sendText(api, threadID, code);
  }

  // ====================================
  // JOIN
  // ====================================

  if (action.startsWith("join ")) {
    const code = action.split(/\s+/)[1]?.toUpperCase();
    const game = db.games[code];

    if (!code || !game || game.status !== "waiting") {
      return sendText(
        api,
        threadID,
        "❌ ভুল Code অথবা Battle আর Join করা যাবে না!"
      );
    }

    if (game.player1.threadID === threadID) {
      return sendText(
        api,
        threadID,
        "❌ অন্য গ্রুপ থেকে এই Code দিতে হবে!"
      );
    }

    if (String(game.player1.userID) === userID) {
      return sendText(api, threadID, "❌ নিজের Battle-এ Join করা যাবে না!");
    }

    if (groupHasGame(threadID)) {
      return sendText(
        api,
        threadID,
        "❌ এই গ্রুপে আগে থেকেই একটি Battle আছে!"
      );
    }

    game.player2 = createPlayer(userID, threadID);
    game.status = "active";
    game.weather = getWeather();

    saveDB();

    const startMessage =
      "🎉 JOINING SUCCESSFUL!\n\n" +
      "🌑 SHADOW WAR V6 STARTED!\n\n" +
      "🔵 PLAYER 1 UID: " + game.player1.userID + "\n" +
      "🔴 PLAYER 2 UID: " + game.player2.userID + "\n\n" +
      "❤️ BOTH HP: " + MAX_HP + "\n" +
      "🔋 BOTH ENERGY: 45\n" +
      "⚡ BOTH STAMINA: 100\n" +
      "🔥 SECOND WIND: AVAILABLE\n" +
      "🌦️ ARENA: " + game.weather.name + "\n\n" +
      "প্রথমে নিজের Style, Element ও Weapon বেছে নিতে পারো:\n" +
      "shadow style balanced\n" +
      "shadow element fire\n" +
      "shadow weapon sword\n\n" +
      moveHelp() +
      "\n\n🔒 SECRET SIMULTANEOUS MOVES ACTIVE!";

    await Promise.all([
      sendText(api, game.player1.threadID, startMessage),
      sendText(api, game.player2.threadID, startMessage)
    ]);

    return;
  }

  // ====================================
  // FIND ACTIVE GAME
  // ====================================

  const game = getActiveGame(threadID);

  if (!game) {
    return sendText(
      api,
      threadID,
      "❌ এই গ্রুপে Active Battle নেই!\n\nনতুন Battle: shadow create"
    );
  }

  const player = getPlayer(game, userID);

  if (!player || player.threadID !== threadID) {
    return sendText(api, threadID, "❌ তুমি এই Battle-এর Player নও!");
  }

  const opponent = getOpponent(game, userID);

  // ====================================
  // STATUS
  // ====================================

  if (action === "status") {
    return sendText(
      api,
      threadID,
      getStatusText(game, player, opponent)
    );
  }

  // ====================================
  // QUIT
  // ====================================

  if (action === "quit") {
    game.status = "finished";
    saveDB();

    await Promise.all([
      sendText(api, game.player1.threadID, "🛑 SHADOW WAR বন্ধ করা হয়েছে!"),
      sendText(api, game.player2.threadID, "🛑 SHADOW WAR বন্ধ করা হয়েছে!")
    ]);

    return;
  }

  // ====================================
  // CUSTOMIZATION
  // ====================================

  const optionMatch = action.match(/^(style|element|weapon)\s+([a-z]+)$/);

  if (optionMatch) {
    if (player.move) {
      return sendText(
        api,
        threadID,
        "⏳ এই রাউন্ডের Move জমা দেওয়া হয়েছে। পরের রাউন্ডে পরিবর্তন করো।"
      );
    }

    const response = setPlayerOption(
      player,
      optionMatch[1],
      optionMatch[2]
    );

    if (!response) {
      return sendText(
        api,
        threadID,
        "❌ ভুল Option!\n\n" + mainHelp()
      );
    }

    saveDB();

    return sendText(
      api,
      threadID,
      "✅ " + response + "\n\n" +
      "⚔️ তোমার বর্তমান সেটিং:\n" +
      "Style: " + player.style + "\n" +
      "Element: " + player.element + "\n" +
      "Weapon: " + player.weapon
    );
  }

  // ====================================
  // SECRET MOVE
  // ====================================

  if (!Object.prototype.hasOwnProperty.call(MOVES, action)) {
    return sendText(api, threadID, moveHelp());
  }

  if (player.move) {
    return sendText(
      api,
      threadID,
      "⏳ তোমার চাল আগেই জমা হয়েছে!\nপ্রতিপক্ষের চালের অপেক্ষা করো।"
    );
  }

  // Ultimate checks before submission
  if (MOVES[action] === "ultimate") {
    if (player.energy < 65) {
      return sendText(
        api,
        threadID,
        "❌ Ultimate ব্যবহার করতে কমপক্ষে 65 Energy লাগবে!\n" +
        "বর্তমান Energy: " + player.energy
      );
    }

    if (player.ultimateCooldown > 0) {
      return sendText(
        api,
        threadID,
        "⏳ Ultimate Cooldown চলছে!\n" +
        "আরও " + player.ultimateCooldown + " Round অপেক্ষা করো।"
      );
    }
  }

  player.move = MOVES[action];
  saveDB();

  // Opponent has not submitted
  if (!opponent.move) {
    await sendText(
      api,
      threadID,
      "🔒 SECRET MOVE SUBMITTED!\n\n" +
      "✅ তোমার চাল গোপনে জমা হয়েছে।\n" +
      "⏳ প্রতিপক্ষের চালের অপেক্ষা করো..."
    );

    await sendText(
      api,
      opponent.threadID,
      "⚠️ তোমার প্রতিপক্ষ একটি Secret Move দিয়েছে!\n\n" +
      "এখন s1 থেকে s12-এর মধ্যে একটি Move দাও।\n" +
      "🔒 প্রতিপক্ষের চাল গোপন আছে!"
    );

    return;
  }

  // Both players submitted
  const result = resolveRound(game);
  saveDB();

  await broadcastResult(api, game, result);

  // Next round
  if (game.status === "active") {
    const nextMessage =
      "🔄 NEXT ROUND STARTED!\n\n" +
      "🎯 ROUND: " + game.round + "\n" +
      "🌦️ NEXT ARENA: " + game.weather.name + "\n\n" +
      "🔵 PLAYER 1 HP: " + game.player1.hp + "/" + MAX_HP + "\n" +
      "🔴 PLAYER 2 HP: " + game.player2.hp + "/" + MAX_HP + "\n\n" +
      "শুধু s1 থেকে s12 লিখে Move দাও।\n" +
      "🔒 তোমার চাল গোপন থাকবে!";

    await Promise.all([
      sendText(api, game.player1.threadID, nextMessage),
      sendText(api, game.player2.threadID, nextMessage)
    ]);
  }

  saveDB();
}

// ========================================
// GOATBOT COMMAND MODULE
// ========================================

module.exports = {
  config: {
    name: "shadow",
    aliases: ["shadowwar", "sw"],
    version: "6.0.0",
    author: "Shadow War",
    countDown: 2,
    role: 0,
    shortDescription: "Ultimate Strategy Cross-Group Battle",
    longDescription:
      "Play a strategy-based secret battle between two Messenger groups.",
    category: "games",
    guide:
      "{pn} create\n" +
      "Send the 5-character code in another group to join.\n" +
      "{pn} moves\n" +
      "{pn} status\n" +
      "{pn} style aggressive/defensive/balanced/trickster\n" +
      "{pn} element fire/ice/thunder/shadow/nature\n" +
      "{pn} weapon sword/staff/dualblade/gauntlet\n" +
      "{pn} quit\n" +
      "Bare moves: s1 to s12"
  },

  // PREFIX COMMANDS
  onStart: async function ({ api, event, args }) {
    const action = (args || []).join(" ").trim();
    return handleAction(api, event, action || "help");
  },

  // BARE TEXT: MOVES OR JOIN CODE
  onChat: async function ({ api, event }) {
    if (
      !event ||
      !event.body ||
      !event.senderID ||
      !event.threadID
    ) {
      return;
    }

    const message = event.body.trim();

    if (!message) return;

    const lower = message.toLowerCase();

    // Bare secret moves
    if (Object.prototype.hasOwnProperty.call(MOVES, lower)) {
      return handleAction(api, event, lower);
    }

    // Join by sending only the exact code
    const code = message.toUpperCase();

    if (/^[A-Z0-9]{5}$/.test(code) && db.games[code]) {
      return handleAction(api, event, code);
    }
  }
};
