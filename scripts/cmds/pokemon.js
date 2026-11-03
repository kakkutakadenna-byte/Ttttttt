"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");

let Canvas;
try { Canvas = require("canvas"); } catch (_) { Canvas = null; }

const ROOT = path.join(__dirname, "pokemon_world_data");
const DB_FILE = path.join(ROOT, "database.json");
const BACKUP_FILE = path.join(ROOT, "backup.json");

fs.mkdirSync(ROOT, { recursive: true });

const MAX_TEAM = 6;
const MAX_STORAGE = 200;
const MAX_TURNS = 50;
const REPLY_TIMEOUT = 600000;

const SPECIES_NAMES = `
Bulbasaur Ivysaur Venusaur Charmander Charmeleon Charizard Squirtle Wartortle Blastoise
Caterpie Metapod Butterfree Weedle Kakuna Beedrill Pidgey Pidgeotto Pidgeot Rattata Raticate
Spearow Fearow Ekans Arbok Pikachu Raichu Sandshrew Sandslash Nidoran Nidorina Nidoqueen
Nidorino Nidoking Clefairy Clefable Vulpix Ninetales Jigglypuff Wigglytuff Zubat Golbat
Oddish Gloom Vileplume Paras Parasect Venonat Venomoth Diglett Dugtrio Meowth Persian
Psyduck Golduck Mankey Primeape Growlithe Arcanine Poliwag Poliwhirl Poliwrath Abra Kadabra
Alakazam Machop Machoke Machamp Bellsprout Weepinbell Victreebel Tentacool Tentacruel
Geodude Graveler Golem Ponyta Rapidash Slowpoke Slowbro Magnemite Magneton Farfetchd
Doduo Dodrio Seel Dewgong Grimer Muk Shellder Cloyster Gastly Haunter Gengar Onix
Drowzee Hypno Krabby Kingler Voltorb Electrode Exeggcute Exeggutor Cubone Marowak
Hitmonlee Hitmonchan Lickitung Koffing Weezing Rhyhorn Rhydon Chansey Tangela Kangaskhan
Horsea Seadra Goldeen Seaking Staryu Starmie MrMime Scyther Jynx Electabuzz Magmar Pinsir
Tauros Magikarp Gyarados Lapras Ditto Eevee Vaporeon Jolteon Flareon Porygon Omanyte
Omastar Kabuto Kabutops Aerodactyl Snorlax Articuno Zapdos Moltres Dratini Dragonair Dragonite
Mewtwo Mew Chikorita Bayleef Meganium Cyndaquil Quilava Typhlosion Totodile Croconaw Feraligatr
Celebi Treecko Grovyle Sceptile Torchic Combusken Blaziken Mudkip Marshtomp Swampert
Ralts Kirlia Gardevoir Sableye Mawile Aron Lairon Aggron Roselia Gulpin Swalot Carvanha
Sharpedo Wailmer Wailord Trapinch Vibrava Flygon Swablu Altaria Bagon Shelgon Salamence
Beldum Metang Metagross Regirock Regice Registeel Latias Latios Kyogre Groudon Rayquaza
Turtwig Grotle Torterra Chimchar Monferno Infernape Piplup Prinplup Empoleon Riolu Lucario
Gible Gabite Garchomp Rotom Dialga Palkia Giratina Darkrai Arceus Snivy Servine Serperior
Tepig Pignite Emboar Oshawott Dewott Samurott Zorua Zoroark Axew Fraxure Haxorus
Cobalion Terrakion Virizion Reshiram Zekrom Kyurem Froakie Frogadier Greninja Fletchling
Fletchinder Talonflame Honedge Doublade Aegislash Sylveon Goodra Xerneas Yveltal Zygarde
Rowlet Dartrix Decidueye Litten Torracat Incineroar Popplio Brionne Primarina Rockruff
Lycanroc Mimikyu Jangmo-o Hakamo-o Kommo-o Solgaleo Lunala Necrozma Grookey Thwackey
Rillaboom Scorbunny Raboot Cinderace Sobble Drizzile Inteleon Corviknight Dragapult
Zacian Zamazenta Eternatus Sprigatito Floragato Meowscarada Fuecoco Crocalor Skeledirge
Quaxly Quaxwell Quaquaval Pawmi Pawmo Pawmot Tinkatink Tinkatuff Tinkaton Frigibax
Arctibax Baxcalibur Koraidon Miraidon
`.trim().split(/\s+/);

const LEGENDARY = new Set(`
Articuno Zapdos Moltres Mewtwo Mew Celebi Regirock Regice Registeel Latias Latios
Kyogre Groudon Rayquaza Dialga Palkia Giratina Darkrai Arceus Cobalion Terrakion
Virizion Reshiram Zekrom Kyurem Xerneas Yveltal Zygarde Solgaleo Lunala Necrozma
Zacian Zamazenta Eternatus Koraidon Miraidon
`.split(/\s+/));

const MYTHICAL = new Set(["Mew", "Celebi", "Darkrai", "Arceus"]);

const TYPE_MAP = {
  Fire: "Charmander Charmeleon Charizard Vulpix Ninetales Growlithe Arcanine Ponyta Rapidash Magmar Moltres Cyndaquil Quilava Typhlosion Torchic Combusken Blaziken Chimchar Monferno Infernape Tepig Pignite Emboar Litten Torracat Incineroar Fuecoco Crocalor Skeledirge".split(" "),
  Water: "Squirtle Wartortle Blastoise Psyduck Golduck Poliwag Poliwhirl Poliwrath Tentacool Tentacruel Slowpoke Slowbro Seel Dewgong Shellder Cloyster Krabby Kingler Horsea Seadra Goldeen Seaking Staryu Starmie Magikarp Gyarados Lapras Vaporeon Omanyte Omastar Kabuto Kabutops Totodile Croconaw Feraligatr Mudkip Marshtomp Swampert Kyogre Piplup Prinplup Empoleon Froakie Frogadier Greninja Popplio Brionne Primarina Sobble Drizzile Inteleon Quaxly Quaxwell Quaquaval".split(" "),
  Grass: "Bulbasaur Ivysaur Venusaur Oddish Gloom Vileplume Bellsprout Weepinbell Victreebel Chikorita Bayleef Meganium Treecko Grovyle Sceptile Turtwig Grotle Torterra Snivy Servine Serperior Rowlet Dartrix Decidueye Grookey Thwackey Rillaboom Sprigatito Floragato Meowscarada".split(" "),
  Electric: "Pikachu Raichu Magnemite Magneton Voltorb Electrode Electabuzz Jolteon Zapdos Mareep Flaaffy Ampharos Shinx Luxio Luxray Pawmi Pawmo Pawmot Miraidon".split(" "),
  Psychic: "Abra Kadabra Alakazam Drowzee Hypno Slowpoke Slowbro MrMime Mewtwo Mew Ralts Kirlia Gardevoir Latias Latios Lunala".split(" "),
  Dragon: "Dratini Dragonair Dragonite Flygon Altaria Bagon Shelgon Salamence Rayquaza Gible Gabite Garchomp Axew Fraxure Haxorus Goodra Dragapult Frigibax Arctibax Baxcalibur".split(" "),
  Ghost: "Gastly Haunter Gengar Sableye Rotom Mimikyu Decidueye Dragapult".split(" "),
  Fairy: "Clefairy Clefable Jigglypuff Wigglytuff Ralts Kirlia Gardevoir Sylveon Xerneas Tinkatink Tinkatuff Tinkaton".split(" "),
  Rock: "Geodude Graveler Golem Onix Rhyhorn Rhydon Aerodactyl Regirock Rockruff Lycanroc".split(" "),
  Ground: "Sandshrew Sandslash Diglett Dugtrio Cubone Marowak Trapinch Vibrava Flygon Groudon Gible Gabite Garchomp".split(" "),
  Fighting: "Mankey Primeape Machop Machoke Machamp Hitmonlee Hitmonchan Lucario Blaziken Infernape Cobalion Terrakion".split(" "),
  Poison: "Ekans Arbok Nidoran Nidorina Nidoqueen Nidorino Nidoking Zubat Golbat Oddish Gloom Vileplume Koffing Weezing".split(" "),
  Bug: "Caterpie Metapod Butterfree Weedle Kakuna Beedrill Paras Parasect Venonat Venomoth Scyther Pinsir".split(" "),
  Flying: "Pidgey Pidgeotto Pidgeot Spearow Fearow Zubat Golbat Doduo Dodrio Articuno Zapdos Moltres Dragonite Rayquaza Talonflame Corviknight".split(" "),
  Ice: "Dewgong Cloyster Jynx Articuno Lapras Regice Kyurem Glaceon".split(" "),
  Steel: "Magnemite Magneton Steelix Scizor Aggron Metagross Dialga Lucario Empoleon Aegislash Corviknight".split(" "),
  Dark: "Umbreon Sableye Sharpedo Absol Darkrai Zorua Zoroark Greninja Incineroar Yveltal".split(" "),
  Normal: "Rattata Raticate Pidgey Pidgeotto Pidgeot Meowth Persian Eevee Snorlax Ditto Tauros Porygon Arceus".split(" ")
};

const TYPE_LIST = Object.keys(TYPE_MAP);

const MOVES = [
  ["Quick Attack", 16, "Normal"], ["Tackle", 14, "Normal"],
  ["Thunderbolt", 27, "Electric"], ["Flamethrower", 27, "Fire"],
  ["Water Pulse", 23, "Water"], ["Vine Whip", 21, "Grass"],
  ["Psychic", 28, "Psychic"], ["Ice Beam", 26, "Ice"],
  ["Dragon Claw", 29, "Dragon"], ["Shadow Ball", 26, "Ghost"],
  ["Earthquake", 30, "Ground"], ["Iron Tail", 25, "Steel"],
  ["Moonblast", 29, "Fairy"], ["Rock Slide", 25, "Rock"],
  ["Aura Sphere", 28, "Fighting"], ["Bug Buzz", 24, "Bug"],
  ["Dark Pulse", 26, "Dark"], ["Air Slash", 24, "Flying"],
  ["Poison Jab", 24, "Poison"]
].map(([name, power, type]) => ({ name, power, type }));

const GYMS = [
  { id: 1, name: "Pewter Gym", leader: "Brock", type: "Rock", reward: 300 },
  { id: 2, name: "Cerulean Gym", leader: "Misty", type: "Water", reward: 450 },
  { id: 3, name: "Vermilion Gym", leader: "Lt. Surge", type: "Electric", reward: 600 },
  { id: 4, name: "Celadon Gym", leader: "Erika", type: "Grass", reward: 750 },
  { id: 5, name: "Fuchsia Gym", leader: "Koga", type: "Poison", reward: 900 },
  { id: 6, name: "Saffron Gym", leader: "Sabrina", type: "Psychic", reward: 1100 },
  { id: 7, name: "Cinnabar Gym", leader: "Blaine", type: "Fire", reward: 1400 },
  { id: 8, name: "Viridian Gym", leader: "Giovanni", type: "Ground", reward: 1800 }
];

const BADGES = [
  "Boulder Badge", "Cascade Badge", "Thunder Badge", "Rainbow Badge",
  "Soul Badge", "Marsh Badge", "Volcano Badge", "Earth Badge"
];

const EVOLUTIONS = {
  Bulbasaur: [16, "Ivysaur"], Ivysaur: [32, "Venusaur"],
  Charmander: [16, "Charmeleon"], Charmeleon: [36, "Charizard"],
  Squirtle: [16, "Wartortle"], Wartortle: [36, "Blastoise"],
  Pikachu: [20, "Raichu"], Eevee: [20, "Vaporeon"],
  Dratini: [30, "Dragonair"], Dragonair: [55, "Dragonite"],
  Gastly: [25, "Haunter"], Haunter: [40, "Gengar"],
  Machop: [28, "Machoke"], Machoke: [40, "Machamp"],
  Ralts: [20, "Kirlia"], Kirlia: [30, "Gardevoir"],
  Gible: [24, "Gabite"], Gabite: [48, "Garchomp"],
  Treecko: [16, "Grovyle"], Grovyle: [36, "Sceptile"],
  Torchic: [16, "Combusken"], Combusken: [36, "Blaziken"],
  Mudkip: [16, "Marshtomp"], Marshtomp: [36, "Swampert"]
};

function uid() {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

function readJSON(file, fallback) {
  try {
    return fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : fallback;
  } catch (_) {
    return fallback;
  }
}

let DB = readJSON(DB_FILE, {
  version: 8,
  players: {},
  hunts: {},
  battles: {},
  offers: {},
  logs: []
});

DB.version = 8;
DB.players ||= {};
DB.hunts ||= {};
DB.battles ||= {};
DB.offers ||= {};
DB.logs ||= [];

function saveDB() {
  try {
    const temp = DB_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(DB, null, 2));
    fs.renameSync(temp, DB_FILE);
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(DB, null, 2));
  } catch (e) {
    console.error("[POKEMON SAVE]", e);
  }
}

function getPlayer(id, name = "Trainer") {
  if (!DB.players[id]) {
    DB.players[id] = {
      id, name, coins: 500, xp: 0, level: 1,
      wins: 0, losses: 0, draws: 0,
      pokemon: [], team: [], badges: [], pokedex: [],
      items: {
        pokeball: 10, greatball: 3, ultraball: 1,
        potion: 5, superpotion: 2, revive: 1
      },
      history: [], recoveryCode: uid(),
      created: Date.now()
    };
  }

  const p = DB.players[id];
  p.name = name || p.name;
  p.coins = Math.max(0, Number(p.coins) || 0);
  p.pokemon ||= [];
  p.team ||= [];
  p.badges ||= [];
  p.pokedex ||= [];
  p.items ||= {};
  p.history ||= [];
  p.xp ||= 0;
  p.level ||= 1;
  p.wins ||= 0;
  p.losses ||= 0;
  p.draws ||= 0;
  p.recoveryCode ||= uid();

  for (const key of ["pokeball", "greatball", "ultraball", "potion", "superpotion", "revive"]) {
    p.items[key] = Math.max(0, Number(p.items[key]) || 0);
  }

  for (const mon of p.pokemon) {
    mon.uid ||= uid();
    mon.level = Math.max(1, Number(mon.level) || 5);
    mon.maxHp = Math.max(20, Number(mon.maxHp) || 35 + mon.level * 4);
    mon.hp = Math.max(0, Math.min(mon.maxHp, Number(mon.hp ?? mon.maxHp)));
    mon.attack = Number(mon.attack) || 9 + mon.level * 2;
    mon.defense = Number(mon.defense) || 6 + mon.level;
    mon.xp ||= 0;
    mon.moves ||= ["Tackle"];
    mon.type ||= speciesType(mon.name);
    mon.shiny = !!mon.shiny;
  }

  return p;
}

function speciesType(name) {
  for (const type of TYPE_LIST) {
    if (TYPE_MAP[type].includes(name)) return type;
  }
  return "Normal";
}

function rarity(name) {
  if (MYTHICAL.has(name)) return "Mythical";
  if (LEGENDARY.has(name)) return "Legendary";
  const n = Math.random();
  if (n < 0.04) return "Epic";
  if (n < 0.15) return "Rare";
  if (n < 0.4) return "Uncommon";
  return "Common";
}

function makePokemon(name, level = 5, shiny = Math.random() < 0.025) {
  const type = speciesType(name);
  const lv = Math.max(1, Math.min(100, Number(level) || 5));
  const moves = MOVES.filter(m => m.type === type || m.type === "Normal")
    .slice(0, 4).map(m => m.name);

  return {
    uid: uid(), name, type, rarity: rarity(name), shiny,
    level: lv, xp: 0,
    maxHp: 35 + lv * 4,
    hp: 35 + lv * 4,
    attack: 9 + lv * 2,
    defense: 6 + lv,
    moves: moves.length ? moves : ["Tackle"]
  };
}

function findPokemon(player, key) {
  if (!key) return null;
  const value = String(key).trim().toLowerCase();
  return player.pokemon.find((m, i) =>
    m.uid.toLowerCase() === value ||
    m.name.toLowerCase() === value ||
    String(i + 1) === value
  ) || null;
}

function healPokemon(mon, full = true) {
  if (mon) mon.hp = full ? mon.maxHp : Math.min(mon.maxHp, mon.hp + 30);
}

function typeMultiplier(atk, def) {
  const strong = {
    Fire: ["Grass", "Ice", "Bug", "Steel"],
    Water: ["Fire", "Ground", "Rock"],
    Electric: ["Water", "Flying"],
    Grass: ["Water", "Ground", "Rock"],
    Ice: ["Grass", "Ground", "Flying", "Dragon"],
    Fighting: ["Normal", "Ice", "Rock", "Dark", "Steel"],
    Ground: ["Fire", "Electric", "Poison", "Rock", "Steel"],
    Psychic: ["Fighting", "Poison"],
    Bug: ["Grass", "Psychic", "Dark"],
    Rock: ["Fire", "Ice", "Flying", "Bug"],
    Ghost: ["Psychic", "Ghost"],
    Dragon: ["Dragon"],
    Dark: ["Psychic", "Ghost"],
    Steel: ["Ice", "Rock", "Fairy"],
    Fairy: ["Fighting", "Dragon", "Dark"],
    Poison: ["Grass", "Fairy"],
    Flying: ["Grass", "Fighting", "Bug"]
  };

  const weak = {
    Fire: ["Fire", "Water", "Rock", "Dragon"],
    Water: ["Water", "Grass", "Dragon"],
    Electric: ["Electric", "Grass", "Dragon"],
    Grass: ["Fire", "Grass", "Poison", "Flying", "Bug", "Dragon", "Steel"],
    Ice: ["Fire", "Water", "Ice", "Steel"],
    Fighting: ["Poison", "Flying", "Psychic", "Bug", "Fairy"],
    Ground: ["Grass", "Bug"],
    Psychic: ["Psychic", "Steel"],
    Bug: ["Fire", "Fighting", "Poison", "Flying", "Ghost", "Steel", "Fairy"],
    Rock: ["Fighting", "Ground", "Steel"],
    Ghost: ["Dark"],
    Dragon: ["Steel"],
    Dark: ["Fighting", "Dark", "Fairy"],
    Steel: ["Fire", "Water", "Electric", "Steel"],
    Fairy: ["Fire", "Poison", "Steel"],
    Poison: ["Poison", "Ground", "Rock", "Ghost"],
    Flying: ["Electric", "Rock", "Steel"]
  };

  if ((strong[atk] || []).includes(def)) return 1.6;
  if ((weak[atk] || []).includes(def)) return 0.65;
  return 1;
}

function addLog(player, message) {
  player.history.unshift({ message, at: Date.now() });
  player.history = player.history.slice(0, 30);
  DB.logs.unshift({ id: player.id, message, at: Date.now() });
  DB.logs = DB.logs.slice(0, 150);
}

function parseTeamArgs(args) {
  return args.join(" ").split(",").map(x => x.trim()).filter(Boolean);
}

function getTeam(player, requested = []) {
  let mons = requested.length
    ? requested.map(x => findPokemon(player, x)).filter(Boolean)
    : (player.team || []).map(id => player.pokemon.find(m => m.uid === id)).filter(Boolean);

  if (!mons.length) mons = player.pokemon.filter(m => m.hp > 0).slice(0, MAX_TEAM);

  return [...new Map(mons.filter(m => m.hp > 0).map(m => [m.uid, m])).values()]
    .slice(0, MAX_TEAM);
}

function battleMon(player, battle, side) {
  const ids = side === 1 ? battle.team1 : battle.team2;
  const index = side === 1 ? battle.index1 : battle.index2;
  return player.pokemon.find(m => m.uid === ids[index]) || null;
}

function advanceFainted(player, battle, side) {
  const ids = side === 1 ? battle.team1 : battle.team2;
  const key = side === 1 ? "index1" : "index2";

  while (battle[key] < ids.length) {
    const mon = player.pokemon.find(m => m.uid === ids[battle[key]]);
    if (mon && mon.hp > 0) return mon;
    battle[key]++;
  }
  return null;
}

function aliveCount(player, battle, side) {
  const ids = side === 1 ? battle.team1 : battle.team2;
  return ids.filter(id => {
    const m = player.pokemon.find(x => x.uid === id);
    return m && m.hp > 0;
  }).length;
}

function createBattle(mode, p1, p2, team1, team2, extra = {}) {
  const battle = {
    id: uid(), mode, p1: p1.id, p2: p2.id,
    team1: team1.map(m => m.uid),
    team2: team2.map(m => m.uid),
    index1: 0, index2: 0,
    turn: p1.id, turns: 0, status: "active",
    extra, created: Date.now(),
    lastAction: "Battle started!"
  };
  DB.battles[battle.id] = battle;
  return battle;
}

function findBattleFor(id) {
  return Object.values(DB.battles).find(b =>
    b.status === "active" && (b.p1 === id || b.p2 === id)
  );
}

function isNPC(id) {
  return String(id).startsWith("NPC_");
}

function safeName(name) {
  return String(name || "Trainer").replace(/[<>]/g, "").slice(0, 24);
}

function getBattlePlayers(battle) {
  return {
    p1: getPlayer(battle.p1),
    p2: getPlayer(battle.p2)
  };
}

// ================ DIRECT CHAT IMAGE RENDERER ================

function rr(ctx, x, y, w, h, r, color, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (color) {
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function typeColor(type) {
  return {
    Fire: "#ff603b", Water: "#399cff", Grass: "#45d483",
    Electric: "#ffd447", Psychic: "#d477ff", Dragon: "#9865ff",
    Ghost: "#8b72d9", Ice: "#76eaff", Dark: "#65708d",
    Fairy: "#ff9bd4", Rock: "#c49a69", Ground: "#d9a64e",
    Fighting: "#e85b58", Poison: "#bd6ad9", Bug: "#a7c94c",
    Flying: "#8fb7ff", Steel: "#a8b7cc", Normal: "#b7bdc9"
  }[type] || "#aab5cc";
}

function drawBar(ctx, x, y, w, h, hp, max) {
  rr(ctx, x, y, w, h, 9, "#17213c");
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, max)));
  const color = ratio > 0.5 ? "#36e69b" : ratio > 0.2 ? "#ffd447" : "#ff5577";
  if (ratio > 0) rr(ctx, x + 3, y + 3, (w - 6) * ratio, h - 6, 7, color);
}

function drawCreature(ctx, x, y, size, type, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);

  const color = typeColor(type);

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.45, size * 0.55, size * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createRadialGradient(-size * 0.2, -size * 0.25, 4, 0, 0, size * 0.65);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, "#171b38");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.43, size * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size * 0.24, -size * 0.28);
  ctx.lineTo(-size * 0.43, -size * 0.75);
  ctx.lineTo(-size * 0.02, -size * 0.48);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(size * 0.2, -size * 0.25);
  ctx.lineTo(size * 0.45, -size * 0.7);
  ctx.lineTo(size * 0.35, -size * 0.1);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-size * 0.15, -size * 0.08, size * 0.09, 0, Math.PI * 2);
  ctx.arc(size * 0.16, -size * 0.08, size * 0.09, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(-size * 0.13, -size * 0.07, size * 0.04, 0, Math.PI * 2);
  ctx.arc(size * 0.18, -size * 0.07, size * 0.04, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function sceneBuffer(title, subtitle, lines = [], battleData = null) {
  if (!Canvas) return null;

  try {
    const W = 1200, H = 675;
    const canvas = Canvas.createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#071329");
    bg.addColorStop(0.48, "#17264c");
    bg.addColorStop(1, "#32134b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(150,190,255,${0.04 + (i % 5) * 0.018})`;
      ctx.beginPath();
      ctx.arc((i * 173) % W, (i * 97) % H, 2 + i % 5, 0, Math.PI * 2);
      ctx.fill();
    }

    rr(ctx, 28, 22, W - 56, 100, 24, "rgba(255,255,255,0.09)");
    ctx.fillStyle = "#fff";
    ctx.font = "bold 43px Sans";
    ctx.fillText(String(title).slice(0, 36), 55, 75);
    ctx.fillStyle = "#b9ceff";
    ctx.font = "22px Sans";
    ctx.fillText(String(subtitle).slice(0, 65), 58, 105);

    if (battleData && (battleData.a || battleData.b)) {
      const a = battleData.a, b = battleData.b;

      rr(ctx, 35, 145, 1130, 365, 28, "rgba(7,12,35,0.72)");
      rr(ctx, 65, 165, 420, 105, 20, "rgba(20,40,75,0.96)");
      rr(ctx, 715, 165, 420, 105, 20, "rgba(55,25,75,0.96)");

      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px Sans";
      ctx.fillText(String(battleData.nameA || "Trainer").slice(0, 20), 90, 207);
      ctx.fillText(String(battleData.nameB || "Opponent").slice(0, 20), 740, 207);

      ctx.font = "20px Sans";
      ctx.fillStyle = "#c7dcff";
      ctx.fillText(a ? `${a.name} Lv.${a.level}` : "No Pokémon", 90, 241);
      ctx.fillText(b ? `${b.name} Lv.${b.level}` : "No Pokémon", 740, 241);

      if (a) drawBar(ctx, 90, 250, 350, 14, a.hp, a.maxHp);
      if (b) drawBar(ctx, 740, 250, 350, 14, b.hp, b.maxHp);

      if (a) drawCreature(ctx, 320, 365, 115, a.type, false);
      if (b) drawCreature(ctx, 875, 365, 115, b.type, true);

      ctx.textAlign = "center";
      ctx.font = "bold 65px Sans";
      ctx.fillStyle = "#ffe27a";
      ctx.fillText("VS", 600, 350);

      rr(ctx, 65, 525, 1070, 95, 20, "rgba(255,255,255,0.09)");
      ctx.textAlign = "left";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 25px Sans";
      ctx.fillText(String(battleData.note || "Battle in progress").slice(0, 65), 90, 565);
      ctx.font = "19px Sans";
      ctx.fillStyle = "#a9caff";
      ctx.fillText(
        `Turn ${battleData.turns || 0} • ${battleData.mode || "Battle"} • ${battleData.id || ""}`,
        90, 598
      );
    } else {
      rr(ctx, 35, 145, 1130, 480, 28, "rgba(7,12,35,0.72)");
      ctx.fillStyle = "#fff";
      ctx.font = "25px Sans";
      lines.slice(0, 11).forEach((line, i) =>
        ctx.fillText(String(line).slice(0, 75), 75, 210 + i * 36)
      );
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#79efff";
    ctx.font = "bold 19px Sans";
    ctx.fillText("POKEMON WORLD • ULTIMATE TRAINER ARENA", 600, 655);

    return canvas.toBuffer("image/png");
  } catch (e) {
    console.error("[POKEMON IMAGE]", e);
    return null;
  }
}

function sendText(api, threadID, body, callback) {
  return api.sendMessage(body, threadID, callback);
}

function sendScene(api, threadID, title, subtitle, lines = [], battleData = null) {
  const buffer = sceneBuffer(title, subtitle, lines, battleData);
  const body = [title, subtitle, ...lines].filter(Boolean).join("\n");

  if (!buffer) return api.sendMessage(body, threadID);

  // Messenger attachment: image appears directly in chat
  return api.sendMessage({
    body,
    attachment: Readable.from([buffer])
  }, threadID);
}

function battleScene(api, threadID, battle, p1, p2, note = "") {
  const a = battleMon(p1, battle, 1);
  const b = battleMon(p2, battle, 2);

  return sendScene(
    api, threadID, "⚔️ POKEMON BATTLE",
    `${p1.name} VS ${p2.name}`,
    [
      `${p1.name}: ${a ? `${a.name} ${a.hp}/${a.maxHp} HP` : "No Pokémon"}`,
      `${p2.name}: ${b ? `${b.name} ${b.hp}/${b.maxHp} HP` : "No Pokémon"}`,
      `Turn: ${battle.turns}/${MAX_TURNS}`,
      note || battle.lastAction,
      "Commands: p attack | p switch 2 | p surrender"
    ],
    {
      a, b, nameA: p1.name, nameB: p2.name,
      turns: battle.turns, mode: battle.mode,
      id: battle.id, note: note || battle.lastAction
    }
  );
}

function usage() {
  return [
    "🎮 POKEMON WORLD ULTIMATE",
    "p start — register trainer",
    "p hunt — find wild Pokémon",
    "p catch — catch Pokémon",
    "p list pokemon — Pokémon storage",
    "p list badges — badge collection",
    "p team — view team",
    "p team 1,2,3 — select battle team",
    "p fight — wild team battle",
    "p fight Pikachu,Charizard — choose team",
    "p pvp @mention — challenge player",
    "p accept — accept PvP challenge",
    "p attack — attack",
    "p switch 2 — switch Pokémon",
    "p surrender — surrender",
    "p gym 1-8 — challenge gym",
    "p offer pokemon Pikachu — trade Pokémon",
    "p offer coins 500 — offer coins",
    "p offer badge 1 — offer badge",
    "p accept offer — accept trade",
    "p daily — daily reward",
    "p profile — trainer profile",
    "p coins — wallet",
    "p bag — inventory",
    "p shop — item shop",
    "p buy potion 2 — buy items",
    "p heal — heal team",
    "p evolve Pikachu — evolve Pokémon",
    "p dex 1 — Pokédex",
    "p top — leaderboard",
    "p history — battle history",
    "p recover — recovery code",
    "p restore CODE — restore backup",
    "p release Pikachu — release Pokémon"
  ].join("\n");
}
module.exports = {
  config: {
    name: "pokemon",
    aliases: ["p", "pk", "pok"],
    version: "8.0.0",
    author: "Si Fat",
    role: 0,
    shortDescription: "Pokemon World Ultimate RPG",
    longDescription: "Pokemon collection, hunting, team battles, PvP, gyms, trading and RPG.",
    category: "game",
    guide: "{pn} start | hunt | catch | fight | gym | pvp | attack | switch | daily"
  },

  onStart: async function ({ api, event, args }) {
    const id = event.senderID;
    const threadID = event.threadID;
    const name = safeName(event.senderName || "Trainer");
    const p = getPlayer(id, name);

    const cmd = String(args[0] || "help").toLowerCase();
    const sub = String(args[1] || "").toLowerCase();
    const save = () => saveDB();

    // ================= HELP =================

    if (cmd === "help" || cmd === "menu") {
      return sendScene(api, threadID, "POKEMON WORLD", "Ultimate Trainer Adventure", usage().split("\n").slice(1));
    }

    // ================= START =================

    if (cmd === "start" || cmd === "register") {
      save();

      return sendScene(api, threadID, "WELCOME TRAINER!", `Welcome ${p.name}`, [
        "Your Pokémon adventure begins!",
        `Coins: ${p.coins}`,
        "Use p hunt to find Pokémon.",
        `Recovery code: ${p.recoveryCode}`,
        "Keep your recovery code safe."
      ]);
    }

    // ================= HUNT =================

    if (cmd === "hunt" || cmd === "find") {
      const old = DB.hunts[id];

      if (old && old.expires > Date.now()) {
        const m = old.mon;

        return sendScene(api, threadID, "WILD ENCOUNTER!", `${m.name} appeared!`, [
          `Type: ${m.type}`,
          `Rarity: ${m.rarity}`,
          `Level: ${m.level}`,
          `HP: ${m.hp}/${m.maxHp}`,
          "Use p catch to catch it."
        ]);
      }

      const species = SPECIES_NAMES[Math.floor(Math.random() * SPECIES_NAMES.length)];
      const mon = makePokemon(species, 3 + Math.floor(Math.random() * 20));

      DB.hunts[id] = {
        mon,
        expires: Date.now() + 180000
      };

      save();

      return sendScene(api, threadID, "🌿 WILD POKEMON!", `${mon.shiny ? "✨ SHINY " : ""}${mon.name} appeared!`, [
        `Type: ${mon.type}`,
        `Rarity: ${mon.rarity}`,
        `Level: ${mon.level}`,
        `HP: ${mon.hp}/${mon.maxHp}`,
        "Use p catch to catch this Pokémon.",
        "Encounter expires in 3 minutes."
      ]);
    }

    // ================= CATCH =================

    if (cmd === "catch") {
      const hunt = DB.hunts[id];

      if (!hunt || hunt.expires < Date.now()) {
        delete DB.hunts[id];
        return sendText(api, threadID, "❌ No active Pokémon. Use p hunt.");
      }

      if (p.pokemon.length >= MAX_STORAGE) {
        return sendText(api, threadID, "Your Pokémon storage is full.");
      }

      const ball = p.items.ultraball > 0 ? "ultraball" :
        p.items.greatball > 0 ? "greatball" : "pokeball";

      if (!p.items[ball]) {
        return sendText(api, threadID, "No Poké Balls available. Use p shop.");
      }

      p.items[ball]--;

      const chance = {
        ultraball: 0.85,
        greatball: 0.68,
        pokeball: 0.48
      }[ball];

      const mon = hunt.mon;
      delete DB.hunts[id];

      if (Math.random() < chance) {
        p.pokemon.push(mon);

        if (!p.pokedex.includes(mon.name)) {
          p.pokedex.push(mon.name);
        }

        p.xp += 20;
        save();

        return sendScene(api, threadID, "🎉 CATCH SUCCESS!", `${mon.name} joined you!`, [
          `Level: ${mon.level}`,
          `Type: ${mon.type}`,
          `Rarity: ${mon.rarity}`,
          `Storage: ${p.pokemon.length}/${MAX_STORAGE}`,
          `Trainer XP: ${p.xp}`
        ]);
      }

      save();

      return sendScene(api, threadID, "POKEMON ESCAPED!", `${mon.name} escaped!`, [
        `Used: ${ball}`,
        "Try hunting again."
      ]);
    }

    // ================= LIST =================

    if ((cmd === "list" && sub === "pokemon") || cmd === "pokemonlist") {
      if (!p.pokemon.length) {
        return sendText(api, threadID, "You have no Pokémon. Use p hunt.");
      }

      const page = Math.max(1, Number(args[2]) || 1);
      const start = (page - 1) * 30;

      const lines = p.pokemon.slice(start, start + 30).map((m, i) =>
        `${start + i + 1}. ${m.shiny ? "✨" : ""}${m.name} Lv.${m.level} | ${m.hp}/${m.maxHp} HP | ${m.type} | ID:${m.uid}`
      );

      lines.push(`Total: ${p.pokemon.length}/${MAX_STORAGE}`);
      lines.push(`Page: ${page}`);

      return sendScene(api, threadID, "YOUR POKEMON STORAGE", p.name, lines);
    }

    if ((cmd === "list" && sub === "badges") || cmd === "badges") {
      return sendScene(api, threadID, "BADGE COLLECTION", `${p.badges.length}/8`, BADGES.map((b, i) =>
        `${p.badges.includes(String(i + 1)) ? "🏅" : "🔒"} ${i + 1}. ${b}`
      ));
    }

    // ================= TEAM =================

    if (cmd === "team") {
      const requested = parseTeamArgs(args.slice(1));

      if (requested.length) {
        const selected = requested.map(x => findPokemon(p, x)).filter(Boolean);

        const unique = [...new Map(selected.map(m => [m.uid, m])).values()]
          .filter(m => m.hp > 0);

        if (!unique.length) {
          return sendText(api, threadID, "No healthy Pokémon selected.");
        }

        if (unique.length > MAX_TEAM) {
          return sendText(api, threadID, "Maximum 6 Pokémon allowed.");
        }

        p.team = unique.map(m => m.uid);
        save();

        return sendScene(api, threadID, "TEAM SAVED!", `${unique.length}/6 Pokémon`, unique.map((m, i) =>
          `${i + 1}. ${m.name} Lv.${m.level} HP ${m.hp}/${m.maxHp}`
        ));
      }

      const team = getTeam(p);

      return sendScene(api, threadID, "YOUR BATTLE TEAM", `${team.length}/6 Pokémon`, team.map((m, i) =>
        `${i + 1}. ${m.name} Lv.${m.level} HP ${m.hp}/${m.maxHp}`
      ));
    }

    // ================= POKEDEX =================

    if (cmd === "dex" || cmd === "pokedex") {
      const page = Math.max(1, Number(args[1]) || 1);
      const start = (page - 1) * 30;

      const lines = SPECIES_NAMES.slice(start, start + 30).map((n, i) =>
        `${p.pokedex.includes(n) ? "✅" : "❔"} ${start + i + 1}. ${n}`
      );

      return sendScene(api, threadID, "POKEDEX", `Page ${page} | ${SPECIES_NAMES.length} Pokémon`, lines);
    }

    // ================= PROFILE =================

    if (cmd === "profile" || cmd === "me") {
      return sendScene(api, threadID, "TRAINER PROFILE", p.name, [
        `Level: ${p.level}`,
        `XP: ${p.xp}`,
        `Coins: ${p.coins}`,
        `Pokémon: ${p.pokemon.length}`,
        `Badges: ${p.badges.length}/8`,
        `Wins: ${p.wins}`,
        `Losses: ${p.losses}`,
        `Draws: ${p.draws}`,
        `Recovery: ${p.recoveryCode}`
      ]);
    }

    if (cmd === "coins" || cmd === "balance") {
      return sendScene(api, threadID, "TRAINER WALLET", p.name, [
        `Coins: ${p.coins}`,
        `Pokémon: ${p.pokemon.length}`,
        `Badges: ${p.badges.length}/8`
      ]);
    }

    // ================= DAILY =================

    if (cmd === "daily") {
      const today = new Date().toISOString().slice(0, 10);

      if (p.daily === today) {
        return sendText(api, threadID, "You already claimed today's reward.");
      }

      const reward = 150 + Math.min(p.level * 10, 200);

      p.daily = today;
      p.coins += reward;
      p.xp += 30;

      save();

      return sendScene(api, threadID, "🎁 DAILY REWARD", "Reward claimed!", [
        `Coins: +${reward}`,
        "XP: +30",
        `New balance: ${p.coins}`
      ]);
    }

    // ================= HEAL =================

    if (cmd === "heal") {
      const target = args[1] ? findPokemon(p, args[1]) : null;

      if (target) {
        if (target.hp <= 0) {
          if (!p.items.revive) return sendText(api, threadID, "You need a Revive.");
          p.items.revive--;
          target.hp = Math.ceil(target.maxHp / 2);
        } else if (p.items.superpotion > 0) {
          p.items.superpotion--;
          target.hp = Math.min(target.maxHp, target.hp + 60);
        } else if (p.items.potion > 0) {
          p.items.potion--;
          target.hp = Math.min(target.maxHp, target.hp + 30);
        } else {
          return sendText(api, threadID, "No healing items available.");
        }

        save();

        return sendScene(api, threadID, "HEALING COMPLETE", target.name, [
          `HP: ${target.hp}/${target.maxHp}`
        ]);
      }

      let count = 0;

      for (const mon of p.pokemon) {
        if (mon.hp <= 0 && p.items.revive > 0) {
          p.items.revive--;
          mon.hp = Math.ceil(mon.maxHp / 2);
          count++;
        } else if (mon.hp > 0 && mon.hp < mon.maxHp && p.items.superpotion > 0) {
          p.items.superpotion--;
          mon.hp = Math.min(mon.maxHp, mon.hp + 60);
          count++;
        } else if (mon.hp > 0 && mon.hp < mon.maxHp && p.items.potion > 0) {
          p.items.potion--;
          mon.hp = Math.min(mon.maxHp, mon.hp + 30);
          count++;
        }
      }

      save();

      return sendScene(api, threadID, "TEAM HEALING", "Healing completed", [
        `Pokémon healed: ${count}`,
        `Potion: ${p.items.potion}`,
        `Super Potion: ${p.items.superpotion}`,
        `Revive: ${p.items.revive}`
      ]);
    }

    // ================= BATTLE ENGINE =================

    if (cmd === "fight" || cmd === "battle") {
      if (findBattleFor(id)) {
        return sendText(api, threadID, "Finish your current battle first.");
      }

      const requested = parseTeamArgs(args.slice(1));
      const team = getTeam(p, requested);

      if (!team.length) {
        return sendText(api, threadID, "You need healthy Pokémon. Use p hunt.");
      }

      const count = Math.min(team.length, 1 + Math.floor(Math.random() * 3));
      const wildMons = [];

      for (let i = 0; i < count; i++) {
        const species = SPECIES_NAMES[Math.floor(Math.random() * SPECIES_NAMES.length)];
        wildMons.push(makePokemon(species, 5 + Math.floor(Math.random() * 15)));
      }

      const npc = {
        id: "NPC_WILD_" + uid(),
        name: "Wild Team",
        coins: 0,
        xp: 0,
        level: 1,
        wins: 0,
        losses: 0,
        draws: 0,
        pokemon: wildMons,
        team: [],
        badges: [],
        pokedex: [],
        items: {},
        history: [],
        recoveryCode: uid()
      };

      DB.players[npc.id] = npc;

      const battle = createBattle("wild", p, npc, team, wildMons);
      save();

      return battleScene(api, threadID, battle, p, npc, "Wild team appeared!");
    }

    // ================= GYM =================

    if (cmd === "gym") {
      const number = Number(args[1]);
      const gym = GYMS.find(g => g.id === number);

      if (!gym) return sendText(api, threadID, "Use p gym 1-8.");

      if (findBattleFor(id)) {
        return sendText(api, threadID, "Finish your current battle first.");
      }

      if (number > 1 && !p.badges.includes(String(number - 1))) {
        return sendText(api, threadID, `You need ${BADGES[number - 2]} first.`);
      }

      const team = getTeam(p);

      if (!team.length) {
        return sendText(api, threadID, "You need healthy Pokémon.");
      }

      const leaderNames = {
        1: ["Geodude", "Onix"],
        2: ["Staryu", "Starmie"],
        3: ["Voltorb", "Raichu", "Electabuzz"],
        4: ["Bellsprout", "Tangela", "Vileplume"],
        5: ["Koffing", "Muk", "Weezing"],
        6: ["Kadabra", "MrMime", "Alakazam"],
        7: ["Ponyta", "Magmar", "Arcanine"],
        8: ["Rhyhorn", "Dugtrio", "Nidoking", "Rhydon"]
      };

      const enemyTeam = leaderNames[number].map((n, i) =>
        makePokemon(n, 12 + number * 3 + i * 2, false)
      );

      const npc = {
        id: "NPC_GYM_" + number + "_" + uid(),
        name: gym.leader,
        coins: 0,
        xp: 0,
        level: 1,
        wins: 0,
        losses: 0,
        draws: 0,
        pokemon: enemyTeam,
        team: [],
        badges: [],
        pokedex: [],
        items: {},
        history: [],
        recoveryCode: uid()
      };

      DB.players[npc.id] = npc;

      const battle = createBattle("gym", p, npc, team, enemyTeam, {
        gym: number
      });

      save();

      return battleScene(api, threadID, battle, p, npc, `${gym.leader} challenges you!`);
    }

    // ================= PVP =================

    if (cmd === "pvp" || cmd === "challenge") {
      if (findBattleFor(id)) {
        return sendText(api, threadID, "You are already in a battle.");
      }

      const target = Object.keys(event.mentions || {})[0];

      if (!target) return sendText(api, threadID, "Mention a player: p pvp @player");
      if (target === id) return sendText(api, threadID, "You cannot challenge yourself.");
      if (findBattleFor(target)) return sendText(api, threadID, "That player is already battling.");

      const opponent = getPlayer(target, event.mentions[target]);

      if (!getTeam(p).length || !getTeam(opponent).length) {
        return sendText(api, threadID, "Both players need healthy Pokémon.");
      }

      DB.offers[target] = {
        type: "pvp",
        from: id,
        to: target,
        threadID,
        expires: Date.now() + REPLY_TIMEOUT
      };

      save();

      return sendScene(api, threadID, "⚔️ PVP CHALLENGE", `${p.name} challenged ${opponent.name}`, [
        "Opponent: use p accept",
        "Both players can bring up to 6 Pokémon.",
        "The challenger moves first."
      ]);
    }

    if (cmd === "accept" && sub !== "offer") {
      const offer = DB.offers[id];

      if (!offer || offer.type !== "pvp" || offer.expires < Date.now()) {
        return sendText(api, threadID, "No active PvP challenge.");
      }

      if (findBattleFor(id) || findBattleFor(offer.from)) {
        return sendText(api, threadID, "One player is already in a battle.");
      }

      const challenger = getPlayer(offer.from);
      const team1 = getTeam(challenger);
      const team2 = getTeam(p);

      if (!team1.length || !team2.length) {
        return sendText(api, threadID, "Both players need healthy Pokémon.");
      }

      delete DB.offers[id];

      const battle = createBattle("pvp", challenger, p, team1, team2);

      save();

      return battleScene(api, threadID, battle, challenger, p, "PvP started! Challenger moves first.");
    }

    // ================= ATTACK =================

    if (cmd === "attack" || cmd === "hit") {
      const battle = findBattleFor(id);

      if (!battle) return sendText(api, threadID, "You are not in a battle.");
      if (battle.turn !== id) return sendText(api, threadID, "Wait for your opponent's turn.");

      const side = battle.p1 === id ? 1 : 2;
      const attacker = getPlayer(id);
      const defender = getPlayer(side === 1 ? battle.p2 : battle.p1);

      const a = battleMon(attacker, battle, side);
      const d = battleMon(defender, battle, side === 1 ? 2 : 1);

      if (!a || !d) {
        return sendText(api, threadID, "No active Pokémon. Try switching.");
      }

      const move = MOVES.filter(m =>
        a.moves.includes(m.name) || m.type === a.type
      ).sort((x, y) => y.power - x.power)[0] || MOVES[0];

      const multiplier = typeMultiplier(move.type, d.type);

      const damage = Math.max(4, Math.floor(
        (move.power + a.attack * 0.45 - d.defense * 0.25) *
        multiplier *
        (0.85 + Math.random() * 0.3)
      ));

      d.hp = Math.max(0, d.hp - damage);

      battle.turns++;

      battle.lastAction =
        `${a.name} used ${move.name}! ${damage} damage!` +
        (multiplier > 1 ? " Super effective!" :
          multiplier < 1 ? " Not very effective!" : "");

      if (d.hp <= 0) {
        battle.lastAction += ` ${d.name} fainted!`;

        const next = advanceFainted(
          defender, battle, side === 1 ? 2 : 1
        );

        if (!next) {
          endBattle(battle, attacker.id, defender.id, "Opponent team defeated");

          return sendScene(api, threadID, "🏆 VICTORY!", `${attacker.name} won!`, [
            battle.lastAction,
            `Reward: ${battle.reward || 0} coins`,
            battle.badgeReward ? `Badge: ${battle.badgeReward}` : "",
            "Battle data saved."
          ].filter(Boolean));
        }

        battle.lastAction += ` ${defender.name} sent out ${next.name}!`;
      }

      if (battle.turns >= MAX_TURNS) {
        const { p1, p2 } = getBattlePlayers(battle);
        const alive1 = aliveCount(p1, battle, 1);
        const alive2 = aliveCount(p2, battle, 2);

        if (alive1 > alive2) {
          endBattle(battle, p1.id, p2.id, "Turn limit");
        } else if (alive2 > alive1) {
          endBattle(battle, p2.id, p1.id, "Turn limit");
        } else {
          battle.status = "ended";
          battle.reason = "Draw";
          p.draws++;
          if (!isNPC(defender.id)) defender.draws++;
          save();
        }

        return sendText(api, threadID, "Battle ended: turn limit reached.");
      }

      battle.turn = defender.id;

      save();

      // NPC takes its turn automatically
      if (isNPC(defender.id)) {
        const npcMon = advanceFainted(defender, battle, side === 1 ? 2 : 1);
        const humanMon = advanceFainted(attacker, battle, side);

        if (!npcMon || !humanMon) {
          endBattle(battle, attacker.id, defender.id, "Team defeated");
          return sendText(api, threadID, "🏆 Battle completed!");
        }

        const npcMove = MOVES.filter(m =>
          npcMon.moves.includes(m.name) || m.type === npcMon.type
        ).sort((x, y) => y.power - x.power)[0] || MOVES[0];

        const npcMultiplier = typeMultiplier(npcMove.type, humanMon.type);

        const npcDamage = Math.max(4, Math.floor(
          (npcMove.power + npcMon.attack * 0.45 - humanMon.defense * 0.25) *
          npcMultiplier *
          (0.85 + Math.random() * 0.3)
        ));

        humanMon.hp = Math.max(0, humanMon.hp - npcDamage);
        battle.turns++;

        battle.lastAction += ` ${npcMon.name} used ${npcMove.name}! ${npcDamage} damage!`;

        if (humanMon.hp <= 0) {
          battle.lastAction += ` ${humanMon.name} fainted!`;

          const nextHuman = advanceFainted(attacker, battle, side);

          if (!nextHuman) {
            endBattle(battle, defender.id, attacker.id, "Your team was defeated");

            return sendScene(api, threadID, "BATTLE LOST", `${attacker.name} lost!`, [
              battle.lastAction,
              "Use p heal to restore your Pokémon."
            ]);
          }

          battle.lastAction += ` Send out ${nextHuman.name}!`;
        }

        battle.turn = attacker.id;
        save();

        const players = getBattlePlayers(battle);

        return battleScene(
          api, threadID, battle, players.p1, players.p2,
          battle.lastAction
        );
      }

      const players = getBattlePlayers(battle);

      return battleScene(api, threadID, battle, players.p1, players.p2);
    }

    // ================= SWITCH =================

    if (cmd === "switch") {
      const battle = findBattleFor(id);

      if (!battle) return sendText(api, threadID, "You are not in a battle.");
      if (battle.turn !== id) return sendText(api, threadID, "Wait for your turn.");

      const side = battle.p1 === id ? 1 : 2;
      const mon = findPokemon(p, args.slice(1).join(" "));

      if (!mon) return sendText(api, threadID, "Pokémon not found.");
      if (mon.hp <= 0) return sendText(api, threadID, "That Pokémon has fainted.");

      const ids = side === 1 ? battle.team1 : battle.team2;

      if (!ids.includes(mon.uid)) {
        return sendText(api, threadID, "This Pokémon is not in your battle team.");
      }

      const current = battleMon(p, battle, side);

      if (current && current.uid === mon.uid) {
        return sendText(api, threadID, "This Pokémon is already active.");
      }

      const index = ids.indexOf(mon.uid);

      if (side === 1) battle.index1 = index;
      else battle.index2 = index;

      battle.turns++;
      battle.lastAction = `${p.name} switched to ${mon.name}!`;

      const opponentID = side === 1 ? battle.p2 : battle.p1;
      battle.turn = opponentID;

      save();

      // NPC counterattack after switch
      if (isNPC(opponentID)) {
        const npc = getPlayer(opponentID);
        const npcSide = side === 1 ? 2 : 1;
        const enemy = advanceFainted(npc, battle, npcSide);

        if (enemy) {
          const move = MOVES.filter(m =>
            enemy.moves.includes(m.name) || m.type === enemy.type
          ).sort((a, b) => b.power - a.power)[0] || MOVES[0];

          const mult = typeMultiplier(move.type, mon.type);
          const damage = Math.max(4, Math.floor(
            (move.power + enemy.attack * 0.45 - mon.defense * 0.25) *
            mult * (0.85 + Math.random() * 0.3)
          ));

          mon.hp = Math.max(0, mon.hp - damage);
          battle.turns++;
          battle.lastAction += ` ${enemy.name} counterattacked for ${damage} damage!`;

          if (mon.hp <= 0) {
            const next = advanceFainted(p, battle, side);

            if (!next) {
              endBattle(battle, opponentID, id, "Your team was defeated");
              return sendText(api, threadID, "Your team was defeated.");
            }

            battle.lastAction += ` ${next.name} entered the battle!`;
          }

          battle.turn = id;
        }
      }

      save();

      const players = getBattlePlayers(battle);

      return battleScene(api, threadID, battle, players.p1, players.p2);
    }

    // ================= SURRENDER =================

    if (cmd === "surrender" || cmd === "forfeit") {
      const battle = findBattleFor(id);

      if (!battle) return sendText(api, threadID, "You are not in a battle.");

      const opponentID = battle.p1 === id ? battle.p2 : battle.p1;

      endBattle(battle, opponentID, id, "Opponent surrendered");

      return sendScene(api, threadID, "🏳️ SURRENDERED", `${p.name} surrendered`, [
        "Battle ended.",
        "Your Pokémon remain in storage.",
        "Heal fainted Pokémon before using them again."
      ]);
    }

    // ================= TRADE OFFER =================

    if (cmd === "offer" &&
        ["pokemon", "coins", "badge"].includes(sub)) {
      const battle = findBattleFor(id);

      if (!battle || battle.mode !== "pvp") {
        return sendText(api, threadID, "Trade offers are available during PvP only.");
      }

      const opponentID = battle.p1 === id ? battle.p2 : battle.p1;
      const value = args.slice(2).join(" ").trim();

      if (!value) {
        return sendText(api, threadID, `Use p offer ${sub} VALUE`);
      }

      let data;

      if (sub === "coins") {
        const amount = Math.floor(Number(value));

        if (!Number.isFinite(amount) || amount < 1 || amount > p.coins) {
          return sendText(api, threadID, "Invalid amount or insufficient coins.");
        }

        data = { type: "coins", amount };
      } else if (sub === "pokemon") {
        const mon = findPokemon(p, value);

        if (!mon) return sendText(api, threadID, "Pokémon not found.");

        if (battle.team1.includes(mon.uid) || battle.team2.includes(mon.uid)) {
          return sendText(api, threadID, "You cannot offer an active battle Pokémon.");
        }

        data = { type: "pokemon", uid: mon.uid, name: mon.name };
      } else {
        const number = Number(value);

        if (!Number.isInteger(number) || number < 1 || number > 8) {
          return sendText(api, threadID, "Use p offer badge 1-8.");
        }

        if (!p.badges.includes(String(number))) {
          return sendText(api, threadID, "You do not own this badge.");
        }

        data = {
          type: "badge",
          number,
          name: BADGES[number - 1]
        };
      }

      DB.offers[opponentID] = {
        type: "trade",
        from: id,
        to: opponentID,
        data,
        battleId: battle.id,
        expires: Date.now() + REPLY_TIMEOUT
      };

      save();

      return sendScene(api, threadID, "🤝 TRADE OFFER SENT!", `To ${getPlayer(opponentID).name}`, [
        `Offer: ${data.name || data.amount}`,
        "Opponent can use p accept offer."
      ]);
    }

    // ================= ACCEPT TRADE =================

    if (cmd === "accept" && sub === "offer") {
      const offer = DB.offers[id];

      if (!offer || offer.type !== "trade" || offer.expires < Date.now()) {
        return sendText(api, threadID, "No active trade offer.");
      }

      const sender = getPlayer(offer.from);
      const data = offer.data;

      if (data.type === "coins") {
        if (sender.coins < data.amount) {
          return sendText(api, threadID, "Sender no longer has enough coins.");
        }

        sender.coins -= data.amount;
        p.coins += data.amount;
      }

      if (data.type === "pokemon") {
        const mon = sender.pokemon.find(m => m.uid === data.uid);

        if (!mon) return sendText(api, threadID, "Offered Pokémon is unavailable.");
        if (p.pokemon.length >= MAX_STORAGE) return sendText(api, threadID, "Your storage is full.");

        sender.pokemon = sender.pokemon.filter(m => m.uid !== mon.uid);
        sender.team = (sender.team || []).filter(x => x !== mon.uid);

        p.pokemon.push(mon);

        if (!p.pokedex.includes(mon.name)) {
          p.pokedex.push(mon.name);
        }
      }

      if (data.type === "badge") {
        const badge = String(data.number);

        if (!sender.badges.includes(badge)) {
          return sendText(api, threadID, "Sender no longer owns this badge.");
        }

        if (p.badges.includes(badge)) {
          return sendText(api, threadID, "You already own this badge.");
        }

        sender.badges = sender.badges.filter(x => x !== badge);
        p.badges.push(badge);
      }

      delete DB.offers[id];

      addLog(p, `Accepted trade from ${sender.name}`);
      addLog(sender, `Trade accepted by ${p.name}`);

      save();

      return sendScene(api, threadID, "🤝 TRADE COMPLETE!", "Transfer successful", [
        data.type === "coins" ? `${data.amount} coins received.` :
          `${data.name} received.`,
        `Your coins: ${p.coins}`,
        `Your Pokémon: ${p.pokemon.length}`,
        `Your badges: ${p.badges.length}`
      ]);
    }

    // ================= INVENTORY =================

    if (cmd === "bag" || cmd === "inventory") {
      return sendScene(api, threadID, "TRAINER BAG", p.name, [
        `Poké Balls: ${p.items.pokeball}`,
        `Great Balls: ${p.items.greatball}`,
        `Ultra Balls: ${p.items.ultraball}`,
        `Potions: ${p.items.potion}`,
        `Super Potions: ${p.items.superpotion}`,
        `Revives: ${p.items.revive}`,
        `Coins: ${p.coins}`
      ]);
    }

    // ================= SHOP =================

    if (cmd === "shop") {
      return sendScene(api, threadID, "POKEMON SHOP", "Buy items with coins", [
        "pokeball — 50 coins",
        "greatball — 120 coins",
        "ultraball — 250 coins",
        "potion — 60 coins",
        "superpotion — 130 coins",
        "revive — 200 coins",
        "Use p buy ITEM AMOUNT"
      ]);
    }

    if (cmd === "buy") {
      const item = String(args[1] || "").toLowerCase();
      const amount = Math.max(1, Math.min(99, Math.floor(Number(args[2]) || 1)));

      const prices = {
        pokeball: 50,
        greatball: 120,
        ultraball: 250,
        potion: 60,
        superpotion: 130,
        revive: 200
      };

      if (!prices[item]) return sendText(api, threadID, "Unknown item. Use p shop.");

      const total = prices[item] * amount;

      if (p.coins < total) {
        return sendText(api, threadID, `Need ${total} coins. Balance: ${p.coins}`);
      }

      p.coins -= total;
      p.items[item] += amount;

      save();

      return sendScene(api, threadID, "PURCHASE SUCCESS!", item, [
        `Quantity: ${amount}`,
        `Spent: ${total}`,
        `Remaining: ${p.coins}`
      ]);
    }

    // ================= EVOLUTION =================

    if (cmd === "evolve") {
      const mon = findPokemon(p, args.slice(1).join(" "));

      if (!mon) return sendText(api, threadID, "Use p evolve PokémonName.");

      const evolution = EVOLUTIONS[mon.name];

      if (!evolution) {
        return sendText(api, threadID, `${mon.name} has no configured evolution.`);
      }

      if (mon.level < evolution[0]) {
        return sendText(api, threadID, `Needs level ${evolution[0]} to evolve.`);
      }

      const oldName = mon.name;
      mon.name = evolution[1];
      mon.type = speciesType(mon.name);
      mon.maxHp += 15;
      mon.hp = mon.maxHp;
      mon.attack += 5;
      mon.defense += 4;
      mon.moves = MOVES.filter(m =>
        m.type === mon.type || m.type === "Normal"
      ).slice(0, 4).map(m => m.name);

      if (!p.pokedex.includes(mon.name)) p.pokedex.push(mon.name);

      save();

      return sendScene(api, threadID, "✨ EVOLUTION!", `${oldName} evolved into ${mon.name}!`, [
        `Level: ${mon.level}`,
        `HP: ${mon.hp}/${mon.maxHp}`,
        `Attack: ${mon.attack}`,
        `Defense: ${mon.defense}`
      ]);
    }

    // ================= RECOVERY =================

    if (cmd === "recover" || cmd === "recovery") {
      return sendScene(api, threadID, "RECOVERY CODE", "Keep this code private", [
        `Code: ${p.recoveryCode}`,
        "Use p restore CODE to restore a saved profile."
      ]);
    }

    if (cmd === "restore") {
      const code = String(args[1] || "").toUpperCase();

      if (!code) return sendText(api, threadID, "Use p restore YOUR_CODE.");

      const backup = readJSON(BACKUP_FILE, null);

      if (!backup || !backup.players) {
        return sendText(api, threadID, "No valid backup database found.");
      }

      const source = Object.values(backup.players).find(x =>
        x.recoveryCode === code
      );

      if (!source) {
        return sendText(api, threadID, "Recovery code not found in backup.");
      }

      if (source.id !== id) {
        return sendText(api, threadID, "This recovery code belongs to another account.");
      }

      DB.players[id] = JSON.parse(JSON.stringify(source));
      DB.players[id].id = id;

      save();

      return sendScene(api, threadID, "DATA RESTORED!", p.name, [
        `Pokémon: ${DB.players[id].pokemon.length}`,
        `Coins: ${DB.players[id].coins}`,
        `Badges: ${DB.players[id].badges.length}`,
        "Your backup profile has been restored."
      ]);
    }

    // ================= SELF DATA RECOVERY =================

    if (cmd === "add" && sub === "coins") {
      const amount = Math.floor(Number(args[2]));

      if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
        return sendText(api, threadID, "Use p add coins 1-10000.");
      }

      p.coins += amount;
      addLog(p, `Manual recovery: ${amount} coins`);

      save();

      return sendScene(api, threadID, "COINS RESTORED", "Your account updated", [
        `Added: ${amount}`,
        `Balance: ${p.coins}`
      ]);
    }

    if (cmd === "add" && sub === "pokemon") {
      const name = args.slice(2).join(" ").trim();
      const species = SPECIES_NAMES.find(x => x.toLowerCase() === name.toLowerCase());

      if (!species) return sendText(api, threadID, "Pokémon not found.");
      if (p.pokemon.length >= MAX_STORAGE) return sendText(api, threadID, "Storage full.");

      const mon = makePokemon(species, 5, false);
      p.pokemon.push(mon);

      if (!p.pokedex.includes(species)) p.pokedex.push(species);

      addLog(p, `Pokémon restored: ${species}`);
      save();

      return sendScene(api, threadID, "POKEMON RESTORED", species, [
        `Level: ${mon.level}`,
        `Type: ${mon.type}`,
        `Storage: ${p.pokemon.length}/${MAX_STORAGE}`
      ]);
    }

    if (cmd === "add" && sub === "badge") {
      const number = Number(args[2]);

      if (!Number.isInteger(number) || number < 1 || number > 8) {
        return sendText(api, threadID, "Use p add badge 1-8.");
      }

      if (!p.badges.includes(String(number))) {
        p.badges.push(String(number));
      }

      save();

      return sendScene(api, threadID, "BADGE RESTORED", BADGES[number - 1], [
        `Badges: ${p.badges.length}/8`
      ]);
    }

    // ================= BACKUP =================

    if (cmd === "backup") {
      save();

      return sendText(api, threadID, "✅ Pokémon database backup saved.");
    }

    // ================= HISTORY =================

    if (cmd === "history") {
      return sendScene(api, threadID, "BATTLE HISTORY", p.name,
        p.history.slice(0, 10).map((h, i) => `${i + 1}. ${h.message}`)
      );
    }

    // ================= RELEASE =================

    if (cmd === "release") {
      if (findBattleFor(id)) {
        return sendText(api, threadID, "Cannot release Pokémon during battle.");
      }

      const mon = findPokemon(p, args.slice(1).join(" "));

      if (!mon) return sendText(api, threadID, "Pokémon not found.");

      p.pokemon = p.pokemon.filter(m => m.uid !== mon.uid);
      p.team = p.team.filter(x => x !== mon.uid);

      save();

      return sendScene(api, threadID, "POKEMON RELEASED", mon.name, [
        "Pokémon removed from your storage."
      ]);
    }

    // ================= LEADERBOARD =================

    if (cmd === "top" || cmd === "rank") {
      const top = Object.values(DB.players)
        .filter(x => x.id && !isNPC(x.id))
        .sort((a, b) =>
          (b.wins || 0) - (a.wins || 0) ||
          (b.coins || 0) - (a.coins || 0)
        )
        .slice(0, 10);

      return sendScene(api, threadID, "🏆 TRAINER LEADERBOARD", "Top trainers", top.map((x, i) =>
        `${i + 1}. ${x.name} | Wins: ${x.wins || 0} | Coins: ${x.coins || 0}`
      ));
    }

    return sendText(api, threadID, usage());
  },

  onReply: async function () {
    // PvP and trade acceptance are command-based.
    // No reply handler is required.
  }
};
