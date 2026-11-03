"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");

let Canvas = null;
try {
  Canvas = require("canvas");
} catch (_) {}

const ROOT = path.join(__dirname, "pokemon_world_data");
const DB_FILE = path.join(ROOT, "database.json");
const BACKUP_FILE = path.join(ROOT, "backup.json");

for (const dir of [ROOT]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const MAX_TEAM = 6;
const MAX_RECOVERY_COINS = 10000;
const BATTLE_TURNS = 40;
const REPLY_TIMEOUT = 10 * 60 * 1000;

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
const SHINY_CHANCE = 0.025;

const TYPE_LIST = [
  "Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting",
  "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost",
  "Dragon", "Dark", "Steel", "Fairy"
];

const TYPE_MAP = {
  Fire: ["Charmander","Charmeleon","Charizard","Vulpix","Ninetales","Growlithe","Arcanine","Ponyta","Rapidash","Magmar","Moltres","Cyndaquil","Quilava","Typhlosion","Torchic","Combusken","Blaziken","Chimchar","Monferno","Infernape","Tepig","Pignite","Emboar","Litten","Torracat","Incineroar","Fuecoco","Crocalor","Skeledirge"],
  Water: ["Squirtle","Wartortle","Blastoise","Psyduck","Golduck","Poliwag","Poliwhirl","Poliwrath","Tentacool","Tentacruel","Slowpoke","Slowbro","Seel","Dewgong","Shellder","Cloyster","Krabby","Kingler","Horsea","Seadra","Goldeen","Seaking","Staryu","Starmie","Magikarp","Gyarados","Lapras","Vaporeon","Omanyte","Omastar","Kabuto","Kabutops","Totodile","Croconaw","Feraligatr","Mudkip","Marshtomp","Swampert","Kyogre","Piplup","Prinplup","Empoleon","Froakie","Frogadier","Greninja","Popplio","Brionne","Primarina","Sobble","Drizzile","Inteleon","Quaxly","Quaxwell","Quaquaval"],
  Grass: ["Bulbasaur","Ivysaur","Venusaur","Oddish","Gloom","Vileplume","Bellsprout","Weepinbell","Victreebel","Chikorita","Bayleef","Meganium","Treecko","Grovyle","Sceptile","Turtwig","Grotle","Torterra","Snivy","Servine","Serperior","Rowlet","Dartrix","Decidueye","Grookey","Thwackey","Rillaboom","Sprigatito","Floragato","Meowscarada"],
  Electric: ["Pikachu","Raichu","Magnemite","Magneton","Voltorb","Electrode","Electabuzz","Jolteon","Zapdos","Mareep","Flaaffy","Ampharos","Shinx","Luxio","Luxray","Pawmi","Pawmo","Pawmot","Miraidon"],
  Psychic: ["Abra","Kadabra","Alakazam","Drowzee","Hypno","Slowpoke","Slowbro","MrMime","Mewtwo","Mew","Ralts","Kirlia","Gardevoir","Latias","Latios","Lunala"],
  Dragon: ["Dratini","Dragonair","Dragonite","Flygon","Altaria","Bagon","Shelgon","Salamence","Rayquaza","Gible","Gabite","Garchomp","Axew","Fraxure","Haxorus","Goodra","Dragapult","Frigibax","Arctibax","Baxcalibur"],
  Ghost: ["Gastly","Haunter","Gengar","Sableye","Rotom","Mimikyu","Decidueye","Dragapult"],
  Fairy: ["Clefairy","Clefable","Jigglypuff","Wigglytuff","Ralts","Kirlia","Gardevoir","Sylveon","Xerneas","Tinkatink","Tinkatuff","Tinkaton"],
  Rock: ["Geodude","Graveler","Golem","Onix","Rhyhorn","Rhydon","Aerodactyl","Regirock","Rockruff","Lycanroc"],
  Ground: ["Sandshrew","Sandslash","Diglett","Dugtrio","Cubone","Marowak","Trapinch","Vibrava","Flygon","Groudon","Gible","Gabite","Garchomp"],
  Fighting: ["Mankey","Primeape","Machop","Machoke","Machamp","Hitmonlee","Hitmonchan","Lucario","Blaziken","Infernape","Cobalion","Terrakion"],
  Poison: ["Ekans","Arbok","Nidoran","Nidorina","Nidoqueen","Nidorino","Nidoking","Zubat","Golbat","Oddish","Gloom","Vileplume","Koffing","Weezing"],
  Bug: ["Caterpie","Metapod","Butterfree","Weedle","Kakuna","Beedrill","Paras","Parasect","Venonat","Venomoth","Scyther","Pinsir"],
  Flying: ["Pidgey","Pidgeotto","Pidgeot","Spearow","Fearow","Zubat","Golbat","Doduo","Dodrio","Articuno","Zapdos","Moltres","Dragonite","Rayquaza","Talonflame","Corviknight"],
  Ice: ["Dewgong","Cloyster","Jynx","Articuno","Lapras","Regice","Kyurem","Glaceon"],
  Steel: ["Magnemite","Magneton","Steelix","Scizor","Aggron","Metagross","Dialga","Lucario","Empoleon","Aegislash","Corviknight"],
  Dark: ["Umbreon","Sableye","Sharpedo","Absol","Darkrai","Zorua","Zoroark","Greninja","Incineroar","Yveltal"],
  Normal: ["Rattata","Raticate","Pidgey","Pidgeotto","Pidgeot","Meowth","Persian","Eevee","Snorlax","Ditto","Tauros","Porygon","Arceus"]
};

const MOVES = [
  { name: "Quick Attack", power: 16, type: "Normal" },
  { name: "Tackle", power: 14, type: "Normal" },
  { name: "Thunderbolt", power: 24, type: "Electric" },
  { name: "Flamethrower", power: 24, type: "Fire" },
  { name: "Water Pulse", power: 22, type: "Water" },
  { name: "Vine Whip", power: 20, type: "Grass" },
  { name: "Psychic", power: 25, type: "Psychic" },
  { name: "Ice Beam", power: 24, type: "Ice" },
  { name: "Dragon Claw", power: 27, type: "Dragon" },
  { name: "Shadow Ball", power: 24, type: "Ghost" },
  { name: "Earthquake", power: 28, type: "Ground" },
  { name: "Iron Tail", power: 23, type: "Steel" },
  { name: "Moonblast", power: 27, type: "Fairy" },
  { name: "Rock Slide", power: 23, type: "Rock" },
  { name: "Aura Sphere", power: 26, type: "Fighting" },
  { name: "Bug Buzz", power: 22, type: "Bug" },
  { name: "Dark Pulse", power: 24, type: "Dark" },
  { name: "Air Slash", power: 22, type: "Flying" }
];

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
  "Boulder Badge","Cascade Badge","Thunder Badge","Rainbow Badge",
  "Soul Badge","Marsh Badge","Volcano Badge","Earth Badge"
];

function uid() {
  return crypto.randomBytes(5).toString("hex").toUpperCase();
}

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return fallback;
  }
}

let DB = readJSON(DB_FILE, {
  version: 5,
  players: {},
  activeHunts: {},
  battles: {},
  trades: {},
  offers: {},
  logs: []
});

DB.version = 5;
DB.players ||= {};
DB.activeHunts ||= {};
DB.battles ||= {};
DB.trades ||= {};
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
      id,
      name,
      coins: 500,
      xp: 0,
      level: 1,
      wins: 0,
      losses: 0,
      draws: 0,
      pokedex: [],
      pokemon: [],
      badges: [],
      items: {
        pokeball: 10,
        greatball: 3,
        ultraball: 1,
        potion: 5,
        superpotion: 2,
        revive: 1
      },
      history: [],
      recoveryCode: uid(),
      created: Date.now()
    };
  }

  const p = DB.players[id];
  p.name = name || p.name;
  p.coins = Number(p.coins) || 0;
  p.pokemon ||= [];
  p.badges ||= [];
  p.pokedex ||= [];
  p.items ||= {};
  p.history ||= [];
  p.xp ||= 0;
  p.level ||= 1;
  p.wins ||= 0;
  p.losses ||= 0;
  p.recoveryCode ||= uid();

  p.pokemon.forEach(mon => {
    mon.uid ||= uid();
    mon.level = Math.max(1, Number(mon.level) || 5);
    mon.maxHp = Math.max(20, Number(mon.maxHp) || 35 + mon.level * 3);
    mon.hp = Math.max(0, Math.min(mon.maxHp, Number(mon.hp ?? mon.maxHp)));
    mon.attack = Number(mon.attack) || 8 + mon.level * 2;
    mon.defense = Number(mon.defense) || 5 + mon.level;
    mon.xp ||= 0;
    mon.shiny = !!mon.shiny;
    mon.moves ||= [];
  });

  return p;
}

function speciesType(name) {
  for (const type of TYPE_LIST) {
    if ((TYPE_MAP[type] || []).includes(name)) return type;
  }
  return "Normal";
}

function rarity(name) {
  if (MYTHICAL.has(name)) return "Mythical";
  if (LEGENDARY.has(name)) return "Legendary";
  const roll = Math.random();
  if (roll < 0.04) return "Epic";
  if (roll < 0.15) return "Rare";
  if (roll < 0.40) return "Uncommon";
  return "Common";
}

function makePokemon(name, level = 5, shiny = Math.random() < SHINY_CHANCE) {
  const base = Math.max(1, Number(level) || 5);
  const type = speciesType(name);
  return {
    uid: uid(),
    name,
    type,
    rarity: rarity(name),
    shiny,
    level: base,
    xp: 0,
    maxHp: 35 + base * 4,
    hp: 35 + base * 4,
    attack: 9 + base * 2,
    defense: 6 + base,
    moves: MOVES.filter(m => m.type === type || m.type === "Normal")
      .slice(0, 4).map(m => m.name)
  };
}

function findPokemon(player, key) {
  if (!key) return null;
  return player.pokemon.find((m, i) =>
    m.uid.toLowerCase() === String(key).toLowerCase() ||
    m.name.toLowerCase() === String(key).toLowerCase() ||
    String(i + 1) === String(key)
  );
}

function healPokemon(mon, full = true) {
  if (!mon) return;
  mon.hp = full ? mon.maxHp : Math.min(mon.maxHp, mon.hp + 30);
}

function typeMultiplier(attackType, defendType) {
  const strong = {
    Fire: ["Grass","Ice","Bug","Steel"],
    Water: ["Fire","Ground","Rock"],
    Electric: ["Water","Flying"],
    Grass: ["Water","Ground","Rock"],
    Ice: ["Grass","Ground","Flying","Dragon"],
    Fighting: ["Normal","Ice","Rock","Dark","Steel"],
    Ground: ["Fire","Electric","Poison","Rock","Steel"],
    Psychic: ["Fighting","Poison"],
    Bug: ["Grass","Psychic","Dark"],
    Rock: ["Fire","Ice","Flying","Bug"],
    Ghost: ["Psychic","Ghost"],
    Dragon: ["Dragon"],
    Dark: ["Psychic","Ghost"],
    Steel: ["Ice","Rock","Fairy"],
    Fairy: ["Fighting","Dragon","Dark"],
    Poison: ["Grass","Fairy"],
    Flying: ["Grass","Fighting","Bug"]
  };
  const weak = {
    Fire: ["Fire","Water","Rock","Dragon"],
    Water: ["Water","Grass","Dragon"],
    Electric: ["Electric","Grass","Dragon"],
    Grass: ["Fire","Grass","Poison","Flying","Bug","Dragon","Steel"],
    Ice: ["Fire","Water","Ice","Steel"],
    Fighting: ["Poison","Flying","Psychic","Bug","Fairy"],
    Ground: ["Grass","Bug"],
    Psychic: ["Psychic","Steel"],
    Bug: ["Fire","Fighting","Poison","Flying","Ghost","Steel","Fairy"],
    Rock: ["Fighting","Ground","Steel"],
    Ghost: ["Dark"],
    Dragon: ["Steel"],
    Dark: ["Fighting","Dark","Fairy"],
    Steel: ["Fire","Water","Electric","Steel"],
    Fairy: ["Fire","Poison","Steel"],
    Poison: ["Poison","Ground","Rock","Ghost"],
    Flying: ["Electric","Rock","Steel"]
  };

  if ((strong[attackType] || []).includes(defendType)) return 1.6;
  if ((weak[attackType] || []).includes(defendType)) return 0.65;
  return 1;
}

function activeMons(player) {
  return player.pokemon.filter(m => m.hp > 0);
}

function trainerTeam(player, requested) {
  const list = (requested || []).map(x => findPokemon(player, x)).filter(Boolean);
  const unique = [...new Map(list.map(m => [m.uid, m])).values()];
  return unique.length ? unique : player.pokemon.filter(m => m.hp > 0).slice(0, MAX_TEAM);
}

function addLog(player, message) {
  player.history.unshift({ message, at: Date.now() });
  player.history = player.history.slice(0, 30);
  DB.logs.unshift({ id: player.id, message, at: Date.now() });
  DB.logs = DB.logs.slice(0, 100);
}

function safeName(name) {
  return String(name || "Trainer").replace(/[<>]/g, "").slice(0, 24);
}

function sceneBuffer(title, subtitle, lines = []) {
  if (!Canvas) return null;
  try {
    const canvas = Canvas.createCanvas(900, 520);
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, 900, 520);
    bg.addColorStop(0, "#101a38");
    bg.addColorStop(1, "#32134b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 900, 520);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      ctx.arc((i * 137) % 900, (i * 83) % 520, 3 + (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px Sans";
    ctx.fillText(String(title).slice(0, 30), 42, 75);

    ctx.fillStyle = "#b8c8ff";
    ctx.font = "23px Sans";
    ctx.fillText(String(subtitle).slice(0, 55), 45, 118);

    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(35, 155, 830, 315);

    ctx.fillStyle = "#ffffff";
    ctx.font = "26px Sans";
    lines.slice(0, 8).forEach((line, i) => {
      ctx.fillText(String(line).slice(0, 55), 65, 205 + i * 38);
    });

    ctx.fillStyle = "#7df9ff";
    ctx.font = "bold 17px Sans";
    ctx.fillText("POKEMON WORLD • TRAINER ARENA", 45, 495);

    return canvas.toBuffer("image/png");
  } catch (_) {
    return null;
  }
}

function sendScene(api, threadID, title, subtitle, lines, callback) {
  const buffer = sceneBuffer(title, subtitle, lines);
  const body = [title, subtitle, ...lines].join("\n");

  if (!buffer) return api.sendMessage(body, threadID, callback);

  return api.sendMessage({
    body,
    attachment: Readable.from(buffer)
  }, threadID, callback);
}

function sendText(api, threadID, body, callback) {
  return api.sendMessage(body, threadID, callback);
}

function registerReply(api, event, action, data = {}) {
  const key = uid();
  global.client ||= {};
  global.client.handleReply ||= [];
  global.client.handleReply.push({
    name: "pokemon",
    commandName: "pokemon",
    messageID: event.messageID,
    author: event.senderID,
    threadID: event.threadID,
    action,
    data,
    key,
    expires: Date.now() + REPLY_TIMEOUT
  });
  return key;
}

function cleanReplies() {
  if (!global.client?.handleReply) return;
  global.client.handleReply = global.client.handleReply.filter(r =>
    r.name !== "pokemon" || !r.expires || r.expires > Date.now()
  );
}

function parseTeamArgs(args) {
  return args.join(" ").split(",").map(s => s.trim()).filter(Boolean);
}

function createBattle(id, mode, p1, p2, team1, team2, extra = {}) {
  const battle = {
    id,
    mode,
    p1,
    p2,
    team1: team1.map(m => m.uid),
    team2: team2.map(m => m.uid),
    index1: 0,
    index2: 0,
    turn: p1,
    turns: 0,
    status: "active",
    extra,
    created: Date.now(),
    lastAction: "Battle started!"
  };
  DB.battles[id] = battle;
  return battle;
}

function battleMon(player, battle, side) {
  const ids = side === 1 ? battle.team1 : battle.team2;
  const index = side === 1 ? battle.index1 : battle.index2;
  const id = ids[index];
  return player.pokemon.find(m => m.uid === id) || null;
}

function aliveCount(player, battle, side) {
  const ids = side === 1 ? battle.team1 : battle.team2;
  return ids.filter(id => {
    const mon = player.pokemon.find(m => m.uid === id);
    return mon && mon.hp > 0;
  }).length;
}

function advanceFainted(player, battle, side) {
  const ids = side === 1 ? battle.team1 : battle.team2;
  let indexKey = side === 1 ? "index1" : "index2";

  while (battle[indexKey] < ids.length) {
    const mon = player.pokemon.find(m => m.uid === ids[battle[indexKey]]);
    if (mon && mon.hp > 0) return mon;
    battle[indexKey]++;
  }
  return null;
}

function battleStatusText(battle) {
  return `Battle ID: ${battle.id}\nMode: ${battle.mode}\nTurn: ${battle.turns}/${BATTLE_TURNS}`;
}

function battleScene(api, threadID, battle, p1, p2, note = "") {
  const a = battleMon(p1, battle, 1);
  const b = battleMon(p2, battle, 2);
  const lines = [
    `${p1.name}: ${a ? a.name : "No Pokémon"} ${a ? `${a.hp}/${a.maxHp} HP` : ""}`,
    `${p2.name}: ${b ? b.name : "No Pokémon"} ${b ? `${b.hp}/${b.maxHp} HP` : ""}`,
    `Turn: ${battle.turns} | Next: ${battle.turn === p1.id ? p1.name : p2.name}`,
    note || battle.lastAction,
    "Commands: p attack | p switch | p surrender",
    `Battle ID: ${battle.id}`
  ];
  sendScene(api, threadID, "⚔️ POKEMON BATTLE", `${p1.name} VS ${p2.name}`, lines);
}

function endBattle(battle, winnerId, loserId, reason) {
  const winner = DB.players[winnerId];
  const loser = DB.players[loserId];
  battle.status = "ended";
  battle.winner = winnerId;
  battle.reason = reason;

  if (winner) {
    winner.wins++;
    winner.coins += battle.mode === "gym" ? 300 : 150;
    winner.xp += 100;
    addLog(winner, `Won ${battle.mode} battle: ${reason}`);
  }
  if (loser) {
    loser.losses++;
    addLog(loser, `Lost ${battle.mode} battle: ${reason}`);
  }
  saveDB();
}

function findBattleFor(id) {
  return Object.values(DB.battles).find(b =>
    b.status === "active" && (b.p1 === id || b.p2 === id)
  );
}

function attackBattle(api, event, battle, attacker, defender, side) {
  const a = battleMon(attacker, battle, side);
  const d = battleMon(defender, battle, side === 1 ? 2 : 1);

  if (!a || !d) return false;

  const move = MOVES.find(m => a.moves.includes(m.name)) ||
    MOVES.find(m => m.type === a.type) || MOVES[0];

  const multiplier = typeMultiplier(move.type, d.type);
  const damage = Math.max(4, Math.floor(
    (move.power + a.attack * 0.45 - d.defense * 0.25) * multiplier *
    (0.85 + Math.random() * 0.3)
  ));

  d.hp = Math.max(0, d.hp - damage);
  battle.turns++;
  battle.lastAction = `${a.name} used ${move.name}! ${damage} damage!`;

  if (d.hp <= 0) {
    battle.lastAction += ` ${d.name} fainted!`;
    const next = advanceFainted(defender, battle, side === 1 ? 2 : 1);
    if (!next) {
      endBattle(battle, attacker.id, defender.id, "Opponent team defeated");
      sendScene(api, event.threadID, "🏆 VICTORY!", `${attacker.name} won!`, [
        battle.lastAction,
        `Reward: 150 coins`,
        "Your battle result has been saved."
      ]);
      return true;
    }
    battle.lastAction += ` ${defender.name} sent out ${next.name}!`;
  }

  if (battle.turns >= BATTLE_TURNS) {
    battle.status = "ended";
    battle.reason = "Turn limit reached";
    const aScore = aliveCount(attacker, battle, side);
    const dScore = aliveCount(defender, battle, side === 1 ? 2 : 1);
    if (aScore > dScore) endBattle(battle, attacker.id, defender.id, "Turn limit");
    else if (dScore > aScore) endBattle(battle, defender.id, attacker.id, "Turn limit");
    else {
      attacker.draws = (attacker.draws || 0) + 1;
      defender.draws = (defender.draws || 0) + 1;
      saveDB();
    }
  } else {
    battle.turn = defender.id;
  }

  saveDB();
  battleScene(api, event.threadID, battle, attacker, defender);
  return true;
}

function getTrainerName(event) {
  return safeName(event.senderName || "Trainer");
}

function usage() {
  return [
    "🎮 POKEMON WORLD COMMANDS",
    "p start — create trainer",
    "p hunt — find Pokémon",
    "p catch — catch found Pokémon",
    "p list pokemon — owned Pokémon",
    "p list badges — badge collection",
    "p coins — balance",
    "p add coins <amount> — recover your coins",
    "p add pokemon <name> — recover/add your Pokémon",
    "p add badge <1-8> — recover your badge",
    "p team — your team",
    "p profile — trainer profile",
    "p dex — Pokédex",
    "p heal — heal your Pokémon",
    "p fight <name/ID,...> — wild battle",
    "p pvp <@mention> — challenge a player",
    "p accept — accept PvP challenge",
    "p attack — attack in battle",
    "p switch <name/number> — switch Pokémon",
    "p surrender — surrender battle",
    "p gym <1-8> — challenge Gym Leader",
    "p offer pokemon <name> — offer Pokémon during PvP",
    "p offer coins <amount> — offer coins during PvP",
    "p accept offer — accept opponent offer",
    "p bag — inventory",
    "p shop — shop",
    "p buy <item> <amount> — buy item",
    "p recover — show your recovery code",
    "p restore <code> — restore your own trainer data",
    "p top — leaderboard"
  ].join("\n");
}
module.exports = {
  config: {
    name: "pokemon",
    aliases: ["p", "pk", "pok"],
    version: "5.0.0",
    author: "Si Fat",
    role: 0,
    shortDescription: "Ultimate Pokémon World RPG",
    longDescription: "Pokémon hunting, collection, multi-team battles, PvP, gyms, trades and recovery.",
    category: "game",
    guide: "{pn} start | hunt | catch | team | fight | pvp | gym | attack | switch | surrender"
  },

  onStart: async function ({ api, event, args }) {
    cleanReplies();

    const id = event.senderID;
    const threadID = event.threadID;
    const name = getTrainerName(event);
    const p = getPlayer(id, name);
    const cmd = (args[0] || "help").toLowerCase();
    const sub = (args[1] || "").toLowerCase();
    const rest = args.slice(1);
    const save = () => saveDB();

    if (cmd === "help" || cmd === "menu") {
      return sendScene(api, threadID, "POKEMON WORLD", "Your adventure starts here", usage().split("\n").slice(1));
    }

    if (cmd === "start" || cmd === "register") {
      save();
      return sendScene(api, threadID, "WELCOME TRAINER!", `Welcome ${p.name}`, [
        "Your Pokémon journey has begun!",
        `Starting coins: ${p.coins}`,
        "Use p hunt to find your first Pokémon.",
        `Recovery code: ${p.recoveryCode}`,
        "Keep your recovery code safe."
      ]);
    }

    if (cmd === "hunt" || cmd === "find") {
      if (DB.activeHunts[id] && DB.activeHunts[id].expires > Date.now()) {
        const h = DB.activeHunts[id];
        return sendScene(api, threadID, "WILD POKEMON!", `${h.mon.shiny ? "✨ SHINY " : ""}${h.mon.name} appeared!`, [
          `Type: ${h.mon.type}`,
          `Rarity: ${h.mon.rarity}`,
          `Level: ${h.mon.level}`,
          "Use p catch to try catching it.",
          "Use p hunt again after this encounter expires."
        ]);
      }

      const namePick = SPECIES_NAMES[Math.floor(Math.random() * SPECIES_NAMES.length)];
      const level = 3 + Math.floor(Math.random() * 20);
      const mon = makePokemon(namePick, level);
      DB.activeHunts[id] = { mon, expires: Date.now() + 3 * 60 * 1000 };
      save();

      return sendScene(api, threadID, "🌿 WILD ENCOUNTER!", `${mon.shiny ? "✨ SHINY " : ""}${mon.name} appeared!`, [
        `Type: ${mon.type}`,
        `Rarity: ${mon.rarity}`,
        `Level: ${mon.level}`,
        `HP: ${mon.hp}/${mon.maxHp}`,
        "Use p catch to catch it.",
        "Encounter expires in 3 minutes."
      ]);
    }

    if (cmd === "catch") {
      const hunt = DB.activeHunts[id];
      if (!hunt || hunt.expires < Date.now()) {
        delete DB.activeHunts[id];
        return sendText(api, threadID, "❌ No active wild Pokémon. Use p hunt first.");
      }

      const mon = hunt.mon;
      const ball = p.items.ultraball > 0 ? "ultraball" :
        p.items.greatball > 0 ? "greatball" : "pokeball";

      if (!p.items[ball]) {
        return sendText(api, threadID, "❌ You have no Poké Balls. Use p shop.");
      }

      p.items[ball]--;
      const chance = ball === "ultraball" ? 0.85 : ball === "greatball" ? 0.68 : 0.48;
      const success = Math.random() < chance;

      delete DB.activeHunts[id];

      if (success) {
        if (p.pokemon.length >= 200) {
          p.items[ball]++;
          save();
          return sendText(api, threadID, "Your Pokémon storage is full (200). Release or transfer Pokémon first.");
        }
        p.pokemon.push(mon);
        if (!p.pokedex.includes(mon.name)) p.pokedex.push(mon.name);
        p.xp += 20;
        save();

        return sendScene(api, threadID, "🎉 CATCH SUCCESS!", `${mon.shiny ? "✨ SHINY " : ""}${mon.name} joined you!`, [
          `Level: ${mon.level}`,
          `Type: ${mon.type}`,
          `Rarity: ${mon.rarity}`,
          `Storage: ${p.pokemon.length}/200`,
          `Trainer XP: ${p.xp}`,
          "Your Pokémon has been saved."
        ]);
      }

      save();
      return sendScene(api, threadID, "POKEMON ESCAPED!", `${mon.name} escaped!`, [
        `Used: ${ball}`,
        "Try hunting again.",
        "Great Balls and Ultra Balls improve catch chance."
      ]);
    }

    if (cmd === "list" && sub === "pokemon" || cmd === "pokemonlist") {
      if (!p.pokemon.length) return sendText(api, threadID, "You have no Pokémon yet. Use p hunt.");
      const lines = p.pokemon.slice(0, 35).map((m, i) =>
        `${i + 1}. ${m.shiny ? "✨" : ""}${m.name} Lv.${m.level} | ${m.hp}/${m.maxHp} HP | ${m.type} | ${m.uid}`
      );
      if (p.pokemon.length > 35) lines.push(`...and ${p.pokemon.length - 35} more. Total: ${p.pokemon.length}`);
      return sendScene(api, threadID, "YOUR POKEMON STORAGE", `${p.pokemon.length}/200 Pokémon`, lines);
    }

    if (cmd === "list" && sub === "badges" || cmd === "badges") {
      const lines = BADGES.map((b, i) =>
        `${p.badges.includes(String(i + 1)) ? "🏅" : "🔒"} ${i + 1}. ${b}`
      );
      return sendScene(api, threadID, "BADGE COLLECTION", `${p.badges.length}/8 badges`, lines);
    }

    if (cmd === "coins" || cmd === "balance") {
      return sendScene(api, threadID, "TRAINER WALLET", p.name, [
        `Coins: ${p.coins}`,
        `Pokémon: ${p.pokemon.length}`,
        `Badges: ${p.badges.length}/8`,
        `Recovery code: ${p.recoveryCode}`
      ]);
    }

    if (cmd === "add" && sub === "coins") {
      const amount = Math.floor(Number(args[2]));
      if (!Number.isFinite(amount) || amount < 1 || amount > MAX_RECOVERY_COINS) {
        return sendText(api, threadID, `Use: p add coins 1-${MAX_RECOVERY_COINS}`);
      }
      p.coins += amount;
      addLog(p, `Self recovery: ${amount} coins`);
      save();
      return sendScene(api, threadID, "COINS RESTORED", "Your own wallet has been updated", [
        `Added: ${amount} coins`,
        `New balance: ${p.coins}`,
        "This command can only modify your own account."
      ]);
    }

    if (cmd === "add" && sub === "pokemon") {
      const pokemonName = args.slice(2).join(" ").trim();
      const found = SPECIES_NAMES.find(n => n.toLowerCase() === pokemonName.toLowerCase());
      if (!found) return sendText(api, threadID, "Pokémon not found. Use p dex to view the catalog.");
      if (p.pokemon.length >= 200) return sendText(api, threadID, "Your storage is full (200).");
      const mon = makePokemon(found, 5, false);
      p.pokemon.push(mon);
      if (!p.pokedex.includes(found)) p.pokedex.push(found);
      addLog(p, `Recovered Pokémon: ${found}`);
      save();
      return sendScene(api, threadID, "POKEMON RESTORED", `${found} added to your storage`, [
        `Level: ${mon.level}`,
        `Type: ${mon.type}`,
        `Storage: ${p.pokemon.length}/200`
      ]);
    }

    if (cmd === "add" && sub === "badge") {
      const n = String(args[2] || "");
      const index = Number(n);
      if (!Number.isInteger(index) || index < 1 || index > 8) {
        return sendText(api, threadID, "Use p add badge 1-8.");
      }
      if (!p.badges.includes(n)) p.badges.push(n);
      addLog(p, `Badge recovery: ${BADGES[index - 1]}`);
      save();
      return sendScene(api, threadID, "BADGE RESTORED", BADGES[index - 1], [
        "Badge added to your collection.",
        `Your badges: ${p.badges.length}/8`
      ]);
    }

    if (cmd === "recover" || cmd === "recovery") {
      return sendScene(api, threadID, "YOUR RECOVERY CODE", "Keep this code safe", [
        `Code: ${p.recoveryCode}`,
        "Use p restore YOUR_CODE to recover your own trainer profile.",
        "Never share your recovery code with others."
      ]);
    }

    if (cmd === "restore") {
      const code = String(args[1] || "").toUpperCase();
      if (!code) return sendText(api, threadID, "Use: p restore YOUR_RECOVERY_CODE");

      const source = Object.values(DB.players).find(x => x.recoveryCode === code);
      if (!source) return sendText(api, threadID, "❌ Recovery code not found.");

      if (source.id !== id) {
        return sendText(api, threadID, "❌ This recovery code belongs to another account. You can only restore your own data.");
      }

      save();
      return sendScene(api, threadID, "DATA CHECKED", "Your trainer data is already active", [
        `Trainer: ${p.name}`,
        `Pokémon: ${p.pokemon.length}`,
        `Coins: ${p.coins}`,
        `Badges: ${p.badges.length}`
      ]);
    }

    if (cmd === "profile" || cmd === "me") {
      return sendScene(api, threadID, "TRAINER PROFILE", p.name, [
        `Level: ${p.level}`,
        `XP: ${p.xp}`,
        `Coins: ${p.coins}`,
        `Pokémon: ${p.pokemon.length}`,
        `Badges: ${p.badges.length}/8`,
        `Wins: ${p.wins} | Losses: ${p.losses}`,
        `Recovery: ${p.recoveryCode}`
      ]);
    }

    if (cmd === "team") {
      const requested = args.slice(1);
      if (requested.length) {
        const selected = parseTeamArgs(requested);
        const mons = trainerTeam(p, selected);
        if (mons.length > 6) return sendText(api, threadID, "Your battle team can contain up to 6 Pokémon.");
        p.team = mons.map(m => m.uid);
        save();
        return sendScene(api, threadID, "BATTLE TEAM SAVED", `${mons.length} Pokémon selected`, mons.map((m, i) => `${i + 1}. ${m.name} Lv.${m.level} HP ${m.hp}/${m.maxHp}`));
      }
      const team = p.team?.map(uid => p.pokemon.find(m => m.uid === uid)).filter(Boolean) || p.pokemon.slice(0, 6);
      return sendScene(api, threadID, "YOUR TEAM", `${team.length}/6 selected`, team.map((m, i) => `${i + 1}. ${m.name} Lv.${m.level} HP ${m.hp}/${m.maxHp}`));
    }

    if (cmd === "dex" || cmd === "pokedex") {
      const page = Math.max(1, Number(args[1]) || 1);
      const start = (page - 1) * 30;
      const lines = SPECIES_NAMES.slice(start, start + 30).map((n, i) =>
        `${p.pokedex.includes(n) ? "✅" : "❔"} ${start + i + 1}. ${n}`
      );
      return sendScene(api, threadID, "POKEDEX", `Page ${page} | ${SPECIES_NAMES.length} Pokémon`, lines);
    }

    if (cmd === "heal") {
      if (!p.pokemon.length) return sendText(api, threadID, "You have no Pokémon.");
      const target = args[1] ? findPokemon(p, args[1]) : null;
      if (target) {
        if (!p.items.potion && !p.items.superpotion && !p.items.revive) return sendText(api, threadID, "You have no healing items. Use p shop.");
        if (target.hp <= 0 && p.items.revive > 0) {
          p.items.revive--;
          target.hp = Math.ceil(target.maxHp / 2);
        } else if (p.items.superpotion > 0) {
          p.items.superpotion--;
          target.hp = Math.min(target.maxHp, target.hp + 60);
        } else if (p.items.potion > 0) {
          p.items.potion--;
          target.hp = Math.min(target.maxHp, target.hp + 30);
        } else return sendText(api, threadID, "You need a Revive to restore a fainted Pokémon.");
        save();
        return sendScene(api, threadID, "HEALING COMPLETE", target.name, [`HP: ${target.hp}/${target.maxHp}`]);
      }
      if (!p.items.potion && !p.items.superpotion && !p.items.revive) return sendText(api, threadID, "You have no healing items.");
      let healed = 0;
      for (const mon of p.pokemon) {
        if (mon.hp <= 0 && p.items.revive > 0) {
          p.items.revive--;
          mon.hp = Math.ceil(mon.maxHp / 2);
          healed++;
        } else if (mon.hp > 0 && mon.hp < mon.maxHp && p.items.superpotion > 0) {
          p.items.superpotion--;
          mon.hp = Math.min(mon.maxHp, mon.hp + 60);
          healed++;
        } else if (mon.hp > 0 && mon.hp < mon.maxHp && p.items.potion > 0) {
          p.items.potion--;
          mon.hp = Math.min(mon.maxHp, mon.hp + 30);
          healed++;
        }
      }
      save();
      return sendScene(api, threadID, "TEAM HEALED", "Healing items used", [
        `Pokémon healed: ${healed}`,
        `Potions left: ${p.items.potion || 0}`,
        `Super Potions left: ${p.items.superpotion || 0}`,
        `Revives left: ${p.items.revive || 0}`
      ]);
    }

    if (cmd === "fight" || cmd === "battle") {
      if (findBattleFor(id)) return sendText(api, threadID, "You are already in a battle.");

      const requested = parseTeamArgs(args.slice(1));
      const team = requested.length ? trainerTeam(p, requested) :
        (p.team?.map(uid => p.pokemon.find(m => m.uid === uid)).filter(Boolean) || p.pokemon.filter(m => m.hp > 0).slice(0, 6));

      const usable = team.filter(m => m && m.hp > 0);
      if (!usable.length) return sendText(api, threadID, "You need at least one healthy Pokémon. Use p heal.");

      const wildCount = Math.min(usable.length, 1 + Math.floor(Math.random() * 3));
      const wild = [];
      for (let i = 0; i < wildCount; i++) {
        const species = SPECIES_NAMES[Math.floor(Math.random() * SPECIES_NAMES.length)];
        wild.push(makePokemon(species, 5 + Math.floor(Math.random() * 15)));
      }

      p.pokemon.push(...wild);
      const wildIds = wild.map(m => m.uid);
      p.pokemon = p.pokemon.filter(m => !wildIds.includes(m.uid));

      const opponent = {
        id: "WILD_" + uid(),
        name: "Wild Team",
        pokemon: wild
      };
      const opponentKey = opponent.id;
      DB.players[opponentKey] = opponent;

      const battle = createBattle(uid(), "wild", id, opponentKey, usable, wild);
      battle.turn = id;
      save();

      return sendScene(api, threadID, "⚔️ WILD TEAM BATTLE!", `${p.name} VS Wild Team`, [
        `Your team: ${usable.map(m => m.name).join(", ")}`,
        `Wild team: ${wild.map(m => m.name).join(", ")}`,
        `Battle ID: ${battle.id}`,
        "Use p attack to attack.",
        "Use p switch 2 to change Pokémon.",
        "Use p surrender to end the battle."
      ]);
    }

    if (cmd === "pvp" || cmd === "challenge") {
      if (findBattleFor(id)) return sendText(api, threadID, "You are already in a battle.");
      const target = Object.keys(event.mentions || {})[0];
      if (!target) return sendText(api, threadID, "Mention a player: p pvp @player");
      if (target === id) return sendText(api, threadID, "You cannot challenge yourself.");

      const opponent = getPlayer(target, event.mentions[target]);
      if (!p.pokemon.some(m => m.hp > 0) || !opponent.pokemon.some(m => m.hp > 0)) {
        return sendText(api, threadID, "Both players need at least one healthy Pokémon.");
      }

      DB.offers[target] = {
        type: "pvp",
        from: id,
        to: target,
        expires: Date.now() + REPLY_TIMEOUT
      };
      save();

      registerReply(api, event, "pvp", { from: id, to: target });
      return sendScene(api, threadID, "⚔️ PVP CHALLENGE SENT", `${p.name} challenged ${opponent.name}`, [
        "Opponent can type p accept to begin.",
        "Each player can bring up to 6 Pokémon.",
        "A fainted Pokémon stays fainted until healed."
      ]);
    }

    if (cmd === "accept" && sub !== "offer") {
      const offer = DB.offers[id];
      if (!offer || offer.type !== "pvp" || offer.expires < Date.now()) {
        return sendText(api, threadID, "No active PvP challenge.");
      }
      const challenger = getPlayer(offer.from);
      if (findBattleFor(id) || findBattleFor(offer.from)) return sendText(api, threadID, "One player is already in a battle.");

      const team1 = challenger.pokemon.filter(m => m.hp > 0).slice(0, 6);
      const team2 = p.pokemon.filter(m => m.hp > 0).slice(0, 6);
      if (!team1.length || !team2.length) return sendText(api, threadID, "Both players need healthy Pokémon.");

      delete DB.offers[id];
      const battle = createBattle(uid(), "pvp", offer.from, id, team1, team2);
      battle.turn = offer.from;
      save();

      return sendScene(api, threadID, "PVP BATTLE START!", `${challenger.name} VS ${p.name}`, [
        `Battle ID: ${battle.id}`,
        `Your team: ${team2.map(m => m.name).join(", ")}`,
        "Challenger moves first.",
        "Use p attack, p switch or p surrender."
      ]);
    }

    if (cmd === "attack") {
      const battle = findBattleFor(id);
      if (!battle) return sendText(api, threadID, "You are not in a battle.");
      if (battle.turn !== id) return sendText(api, threadID, "Wait for your opponent's turn.");

      const side = battle.p1 === id ? 1 : 2;
      const attacker = getPlayer(id);
      const defender = getPlayer(side === 1 ? battle.p2 : battle.p1);

      return attackBattle(api, event, battle, attacker, defender, side);
    }

    if (cmd === "switch") {
      const battle = findBattleFor(id);
      if (!battle) return sendText(api, threadID, "You are not in a battle.");
      if (battle.turn !== id) return sendText(api, threadID, "Wait for your turn.");

      const side = battle.p1 === id ? 1 : 2;
      const player = getPlayer(id);
      const key = args[1];
      const mon = findPokemon(player, key);

      if (!mon) return sendText(api, threadID, "Pokémon not found. Use p list pokemon.");
      if (mon.hp <= 0) return sendText(api, threadID, "That Pokémon has fainted.");
      const ids = side === 1 ? battle.team1 : battle.team2;
      if (!ids.includes(mon.uid)) return sendText(api, threadID, "That Pokémon is not registered in this battle team.");

      const index = ids.indexOf(mon.uid);
      if (side === 1) battle.index1 = index;
      else battle.index2 = index;

      battle.turns++;
      battle.turn = side === 1 ? battle.p2 : battle.p1;
      battle.lastAction = `${player.name} switched to ${mon.name}!`;
      save();

      return sendScene(api, threadID, "POKEMON SWITCHED", mon.name, [
        `HP: ${mon.hp}/${mon.maxHp}`,
        `Next turn: ${getPlayer(battle.turn).name}`,
        `Battle ID: ${battle.id}`
      ]);
    }

    if (cmd === "surrender" || cmd === "forfeit") {
      const battle = findBattleFor(id);
      if (!battle) return sendText(api, threadID, "You are not in a battle.");
      const opponentID = battle.p1 === id ? battle.p2 : battle.p1;

      endBattle(battle, opponentID, id, "Opponent surrendered");
      return sendScene(api, threadID, "🏳️ SURRENDERED", `${p.name} left the battle`, [
        "The battle has ended.",
        "Your remaining Pokémon have not been removed.",
        "Fainted Pokémon must be healed before reuse."
      ]);
    }

    if (cmd === "gym") {
      const number = Number(args[1]);
      const gym = GYMS.find(g => g.id === number);
      if (!gym) return sendText(api, threadID, "Use p gym 1-8.");
      if (findBattleFor(id)) return sendText(api, threadID, "Finish your current battle first.");
      if (number > 1 && !p.badges.includes(String(number - 1))) {
        return sendText(api, threadID, `You need ${BADGES[number - 2]} first.`);
      }

      const team = p.pokemon.filter(m => m.hp > 0).slice(0, 6);
      if (!team.length) return sendText(api, threadID, "You need healthy Pokémon. Use p heal.");

      const leaderNames = {
        1: ["Geodude","Onix"],
        2: ["Staryu","Starmie"],
        3: ["Voltorb","Raichu","Electabuzz"],
        4: ["Bellsprout","Tangela","Vileplume"],
        5: ["Koffing","Muk","Weezing"],
        6: ["Kadabra","MrMime","Alakazam"],
        7: ["Ponyta","Magmar","Arcanine"],
        8: ["Rhyhorn","Dugtrio","Nidoking","Rhydon"]
      };

      const enemyTeam = leaderNames[number].map((n, i) => makePokemon(n, 12 + number * 3 + i * 2));
      const leader = {
        id: "GYM_" + number + "_" + uid(),
        name: gym.leader,
        pokemon: enemyTeam
      };
      DB.players[leader.id] = leader;

      const battle = createBattle(uid(), "gym", id, leader.id, team, enemyTeam, { gym: number });
      battle.turn = id;
      save();

      return sendScene(api, threadID, `🏟️ ${gym.name}`, `${gym.leader} challenges you!`, [
        `Gym type: ${gym.type}`,
        `Your team: ${team.map(m => m.name).join(", ")}`,
        `Leader team: ${enemyTeam.map(m => m.name).join(", ")}`,
        "Gym Leaders can switch Pokémon after one faints.",
        "Use p attack, p switch or p surrender."
      ]);
    }

    if (cmd === "offer" && (sub === "pokemon" || sub === "coins")) {
      const battle = findBattleFor(id);
      if (!battle || battle.mode !== "pvp") return sendText(api, threadID, "Offers are available only during PvP battles.");

      const opponentID = battle.p1 === id ? battle.p2 : battle.p1;
      const amountOrName = args.slice(2).join(" ").trim();
      if (!amountOrName) return sendText(api, threadID, `Use p offer ${sub} VALUE`);

      let offerData;
      if (sub === "coins") {
        const amount = Math.floor(Number(amountOrName));
        if (!Number.isFinite(amount) || amount < 1 || amount > p.coins) return sendText(api, threadID, "Invalid coin amount or insufficient coins.");
        offerData = { type: "coins", amount };
      } else {
        const mon = findPokemon(p, amountOrName);
        if (!mon) return sendText(api, threadID, "Pokémon not found.");
        if (battle.team1.includes(mon.uid) || battle.team2.includes(mon.uid)) {
          return sendText(api, threadID, "You cannot offer a Pokémon currently fighting in this battle.");
        }
        offerData = { type: "pokemon", uid: mon.uid, name: mon.name };
      }

      DB.offers[opponentID] = {
        type: "trade",
        from: id,
        to: opponentID,
        data: offerData,
        battleId: battle.id,
        expires: Date.now() + REPLY_TIMEOUT
      };
      save();

      return sendScene(api, threadID, "🤝 TRADE OFFER SENT", `Offer sent to ${getPlayer(opponentID).name}`, [
        sub === "coins" ? `Coins offered: ${offerData.amount}` : `Pokémon offered: ${offerData.name}`,
        "Opponent can type p accept offer.",
        "The battle continues while the offer is pending."
      ]);
    }

    if (cmd === "accept" && sub === "offer") {
      const offer = DB.offers[id];
      if (!offer || offer.type !== "trade" || offer.expires < Date.now()) {
        return sendText(api, threadID, "No active trade offer.");
      }

      const sender = getPlayer(offer.from);
      if (offer.data.type === "coins") {
        if (sender.coins < offer.data.amount) return sendText(api, threadID, "Sender no longer has enough coins.");
        sender.coins -= offer.data.amount;
        p.coins += offer.data.amount;
      } else {
        const mon = sender.pokemon.find(m => m.uid === offer.data.uid);
        if (!mon) return sendText(api, threadID, "The offered Pokémon is no longer available.");
        if (p.pokemon.length >= 200) return sendText(api, threadID, "Your Pokémon storage is full.");
        sender.pokemon = sender.pokemon.filter(m => m.uid !== mon.uid);
        p.pokemon.push(mon);
        if (!p.pokedex.includes(mon.name)) p.pokedex.push(mon.name);
      }

      delete DB.offers[id];
      addLog(p, `Accepted offer from ${sender.name}`);
      addLog(sender, `Offer accepted by ${p.name}`);
      save();

      return sendScene(api, threadID, "🤝 TRADE COMPLETE!", "Both trainers' data has been saved", [
        offer.data.type === "coins" ? `${offer.data.amount} coins transferred.` : `${offer.data.name} transferred to your storage.`,
        `Your coins: ${p.coins}`,
        `Your Pokémon: ${p.pokemon.length}`
      ]);
    }

    if (cmd === "bag" || cmd === "inventory") {
      return sendScene(api, threadID, "TRAINER BAG", p.name, [
        `Poké Balls: ${p.items.pokeball || 0}`,
        `Great Balls: ${p.items.greatball || 0}`,
        `Ultra Balls: ${p.items.ultraball || 0}`,
        `Potions: ${p.items.potion || 0}`,
        `Super Potions: ${p.items.superpotion || 0}`,
        `Revives: ${p.items.revive || 0}`,
        `Coins: ${p.coins}`
      ]);
    }

    if (cmd === "shop") {
      return sendScene(api, threadID, "POKEMON SHOP", "Use p buy ITEM AMOUNT", [
        "pokeball — 50 coins",
        "greatball — 120 coins",
        "ultraball — 250 coins",
        "potion — 60 coins",
        "superpotion — 130 coins",
        "revive — 200 coins"
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
      if (p.coins < total) return sendText(api, threadID, `You need ${total} coins. Your balance: ${p.coins}`);

      p.coins -= total;
      p.items[item] = (p.items[item] || 0) + amount;
      save();

      return sendScene(api, threadID, "PURCHASE SUCCESS", item, [
        `Quantity: ${amount}`,
        `Spent: ${total} coins`,
        `Remaining: ${p.coins} coins`
      ]);
    }

    if (cmd === "top" || cmd === "rank") {
      const top = Object.values(DB.players)
        .filter(x => x.id && !String(x.id).startsWith("WILD_") && !String(x.id).startsWith("GYM_"))
        .sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.coins || 0) - (a.coins || 0))
        .slice(0, 10);

      return sendScene(api, threadID, "🏆 TRAINER RANKING", "Top trainers", top.map((x, i) =>
        `${i + 1}. ${x.name} | Wins: ${x.wins || 0} | Coins: ${x.coins || 0}`
      ));
    }

    if (cmd === "evolve") {
      const mon = findPokemon(p, args.slice(1).join(" "));
      if (!mon) return sendText(api, threadID, "Use p evolve PokémonName");
      const evolutions = {
        Bulbasaur: "Ivysaur", Ivysaur: "Venusaur",
        Charmander: "Charmeleon", Charmeleon: "Charizard",
        Squirtle: "Wartortle", Wartortle: "Blastoise",
        Pikachu: "Raichu", Eevee: "Vaporeon",
        Dratini: "Dragonair", Dragonair: "Dragonite",
        Gastly: "Haunter", Haunter: "Gengar",
        Machop: "Machoke", Machoke: "Machamp",
        Ralts: "Kirlia", Kirlia: "Gardevoir",
        Riolu: "Lucario", Gible: "Gabite", Gabite: "Garchomp"
      };

      const next = evolutions[mon.name];
      if (!next) return sendText(api, threadID, `${mon.name} has no configured evolution in this version.`);
      if (mon.level < 16) return sendText(api, threadID, "This Pokémon needs level 16 to evolve.");

      mon.name = next;
      mon.type = speciesType(next);
      mon.maxHp += 15;
      mon.hp = mon.maxHp;
      mon.attack += 5;
      mon.defense += 4;
      mon.moves = MOVES.filter(m => m.type === mon.type || m.type === "Normal").slice(0, 4).map(m => m.name);
      save();

      return sendScene(api, threadID, "✨ EVOLUTION!", `${next} evolved!`, [
        `Level: ${mon.level}`,
        `HP: ${mon.hp}/${mon.maxHp}`,
        `Attack: ${mon.attack}`,
        `Defense: ${mon.defense}`
      ]);
    }

    if (cmd === "backup") {
      save();
      return sendText(api, threadID, "✅ Your game database has been backed up.");
    }

    if (cmd === "history") {
      return sendScene(api, threadID, "BATTLE HISTORY", p.name,
        (p.history || []).slice(0, 8).map((h, i) => `${i + 1}. ${h.message}`)
      );
    }

    if (cmd === "release") {
      const mon = findPokemon(p, args.slice(1).join(" "));
      if (!mon) return sendText(api, threadID, "Use p release PokémonName");
      if (findBattleFor(id)) return sendText(api, threadID, "You cannot release Pokémon during a battle.");
      p.pokemon = p.pokemon.filter(m => m.uid !== mon.uid);
      if (p.team) p.team = p.team.filter(uid => uid !== mon.uid);
      save();
      return sendScene(api, threadID, "POKEMON RELEASED", mon.name, [
        "This Pokémon was removed from your storage.",
        "Your other Pokémon remain safe."
      ]);
    }

    return sendText(api, threadID, usage());
  },

  onReply: async function ({ api, event, Reply }) {
    cleanReplies();

    if (!Reply || Reply.name !== "pokemon" || Reply.threadID !== event.threadID) return;
    if (Reply.author && Reply.author !== event.senderID) return;

    if (Reply.action === "pvp") {
      return sendText(api, event.threadID, "PvP challenge is pending. The challenged player must use p accept.");
    }
  }
};
