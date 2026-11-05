"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "pokemonu_data");
const DB_FILE = path.join(ROOT, "database.json");
const BACKUP_FILE = path.join(ROOT, "backup.json");

fs.mkdirSync(ROOT, { recursive: true });

const CONFIG = {
  MAX_TEAM: 6,
  MAX_STORAGE: 200,
  MAX_LEVEL: 100,
  HUNT_COOLDOWN: 60000,
  ENCOUNTER_TIME: 180000
};

const STARTERS = [
  { id: 1, name: "Bulbasaur", type: ["Grass", "Poison"], rarity: "Common" },
  { id: 4, name: "Charmander", type: ["Fire"], rarity: "Common" },
  { id: 7, name: "Squirtle", type: ["Water"], rarity: "Common" }
];

const GODS = [
  { id: 493, name: "Arceus", type: ["Normal"], rarity: "God" },
  { id: 890, name: "Eternatus", type: ["Poison", "Dragon"], rarity: "God" },
  { id: 800, name: "Necrozma", type: ["Psychic"], rarity: "God" },
  { id: 720, name: "Hoopa", type: ["Psychic", "Ghost"], rarity: "God" },
  { id: 384, name: "Rayquaza", type: ["Dragon", "Flying"], rarity: "God" }
];

const GYMS = [
  { name: "Pewter Gym", leader: "Brock", type: "Rock", badge: "Boulder Badge", level: 12 },
  { name: "Cerulean Gym", leader: "Misty", type: "Water", badge: "Cascade Badge", level: 18 },
  { name: "Vermilion Gym", leader: "Lt. Surge", type: "Electric", badge: "Thunder Badge", level: 24 },
  { name: "Celadon Gym", leader: "Erika", type: "Grass", badge: "Rainbow Badge", level: 30 },
  { name: "Fuchsia Gym", leader: "Koga", type: "Poison", badge: "Soul Badge", level: 38 },
  { name: "Saffron Gym", leader: "Sabrina", type: "Psychic", badge: "Marsh Badge", level: 45 },
  { name: "Cinnabar Gym", leader: "Blaine", type: "Fire", badge: "Volcano Badge", level: 52 },
  { name: "Viridian Gym", leader: "Giovanni", type: "Ground", badge: "Earth Badge", level: 60 }
];

const SHOP = {
  pokeball: 100,
  greatball: 300,
  ultraball: 700,
  masterball: 5000,
  godball: 25000,
  potion: 150,
  revive: 500
};

const BALLS = {
  pokeball: 1,
  greatball: 1.5,
  ultraball: 2,
  masterball: 100,
  godball: 100
};

const GOD_IDS = new Set(GODS.map(x => x.id));

function uid() {
  return "PK-" + crypto.randomBytes(6).toString("hex").toUpperCase();
}

function recoveryCode() {
  return "REC-" + crypto.randomBytes(12).toString("hex").toUpperCase();
}

function defaultDB() {
  return {
    version: 3,
    players: {},
    uniquePokemon: {},
    events: {},
    battles: {},
    speciesCache: {}
  };
}

function writeJSON(file, data) {
  const temp = file + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, file);
}

function loadDB() {
  for (const file of [DB_FILE, BACKUP_FILE]) {
    try {
      if (!fs.existsSync(file)) continue;
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!data || typeof data !== "object") continue;
      data.players ||= {};
      data.uniquePokemon ||= {};
      data.events ||= {};
      data.battles ||= {};
      data.speciesCache ||= {};
      data.version = 3;
      return data;
    } catch (e) {
      console.error("[POKEMONU LOAD]", e);
    }
  }
  return defaultDB();
}

let DB = loadDB();

function saveDB() {
  try {
    writeJSON(DB_FILE, DB);
    writeJSON(BACKUP_FILE, DB);
    return true;
  } catch (e) {
    console.error("[POKEMONU SAVE]", e);
    return false;
  }
}

function getPlayer(id) {
  if (!DB.players[id]) {
    DB.players[id] = {
      id,
      started: false,
      coins: 1000,
      xp: 0,
      level: 1,
      pokemon: [],
      team: [],
      pokedex: [],
      badges: [],
      inventory: {
        pokeball: 10,
        greatball: 3,
        ultraball: 1,
        masterball: 0,
        godball: 0,
        potion: 5,
        revive: 1
      },
      recovery: recoveryCode(),
      wins: 0,
      losses: 0,
      draws: 0,
      huntTime: 0,
      catchTime: 0
    };
  }

  const p = DB.players[id];
  p.pokemon ||= [];
  p.team ||= [];
  p.pokedex ||= [];
  p.badges ||= [];
  p.inventory ||= {};
  p.coins ??= 1000;
  p.xp ??= 0;
  p.level ??= 1;
  p.started ??= false;
  p.recovery ||= recoveryCode();
  p.wins ??= 0;
  p.losses ??= 0;
  p.draws ??= 0;
  p.huntTime ??= 0;
  p.catchTime ??= 0;

  for (const item of Object.keys(SHOP)) {
    p.inventory[item] ??= 0;
  }

  return p;
}

function createPokemon(species, level = 5) {
  const hp = 20 + level * 5;
  return {
    uid: uid(),
    speciesId: species.id,
    name: species.name,
    type: [...species.type],
    rarity: species.rarity || "Common",
    level,
    xp: 0,
    hp,
    maxHp: hp,
    attack: 5 + level * 2,
    defense: 5 + level,
    moves: ["Tackle"],
    caughtAt: Date.now(),
    recovery: recoveryCode(),
    shiny: Math.random() < 0.005
  };
}

function sendText(api, threadID, message, replyID) {
  return api.sendMessage(message, threadID, null, replyID);
}

function getSprite(id) {
  return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/" + id + ".png";
}

function sendPokemonImage(api, threadID, message, pokemon, replyID) {
  return new Promise(resolve => {
    let done = false;

    const fallback = () => {
      if (done) return;
      done = true;
      resolve(sendText(api, threadID, message, replyID));
    };

    const req = https.get(getSprite(pokemon.speciesId), res => {
      if (res.statusCode !== 200) {
        res.resume();
        return fallback();
      }

      res.on("error", fallback);

      try {
        api.sendMessage(
          { body: message, attachment: res },
          threadID,
          err => {
            if (err) fallback();
            else {
              done = true;
              resolve(true);
            }
          },
          replyID
        );
      } catch (e) {
        fallback();
      }
    });

    req.setTimeout(12000, () => {
      req.destroy();
      fallback();
    });

    req.on("error", fallback);
  });
}

function saveProgress(player) {
  player.recovery = recoveryCode();
  return saveDB();
}

function randomRarity() {
  const n = Math.random() * 100;
  if (n < 0.5) return "Mythical";
  if (n < 2.5) return "Legendary";
  if (n < 10) return "Epic";
  if (n < 35) return "Rare";
  return "Common";
}

function fallbackSpecies() {
  const list = [
    [10, "Caterpie", ["Bug"], "Common"],
    [16, "Pidgey", ["Normal", "Flying"], "Common"],
    [25, "Pikachu", ["Electric"], "Rare"],
    [37, "Vulpix", ["Fire"], "Rare"],
    [39, "Jigglypuff", ["Normal", "Fairy"], "Rare"],
    [52, "Meowth", ["Normal"], "Common"],
    [58, "Growlithe", ["Fire"], "Rare"],
    [74, "Geodude", ["Rock", "Ground"], "Common"],
    [92, "Gastly", ["Ghost", "Poison"], "Rare"],
    [133, "Eevee", ["Normal"], "Rare"],
    [147, "Dratini", ["Dragon"], "Epic"],
    [150, "Mewtwo", ["Psychic"], "Legendary"],
    [151, "Mew", ["Psychic"], "Mythical"],
    [249, "Lugia", ["Psychic", "Flying"], "Legendary"],
    [250, "Ho-Oh", ["Fire", "Flying"], "Legendary"],
    [384, "Rayquaza", ["Dragon", "Flying"], "Legendary"],
    [487, "Giratina", ["Ghost", "Dragon"], "Legendary"],
    [493, "Arceus", ["Normal"], "Mythical"]
  ];

  const rarity = randomRarity();
  let pool = list.filter(x => x[3] === rarity);
  if (!pool.length) pool = list.filter(x => x[3] === "Common");
  const s = pool[Math.floor(Math.random() * pool.length)];

  return { id: s[0], name: s[1], type: s[2], rarity: s[3] };
}

function apiGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 12000 }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        if (res.statusCode !== 200) {
          return reject(new Error("API status " + res.statusCode));
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("API timeout")));
    req.on("error", reject);
  });
}

async function getRandomPokemon() {
  const id = 1 + Math.floor(Math.random() * 1025);

  if (DB.speciesCache[id]) {
    return DB.speciesCache[id];
  }

  try {
    const data = await apiGet("https://pokeapi.co/api/v2/pokemon/" + id);
    const species = {
      id,
      name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
      type: data.types.map(x =>
        x.type.name.charAt(0).toUpperCase() + x.type.name.slice(1)
      ),
      rarity: randomRarity()
    };

    const god = GODS.find(x => x.id === id);
    if (god) Object.assign(species, god);

    DB.speciesCache[id] = species;
    return species;
  } catch (e) {
    console.error("[POKEMON API]", e.message);
    return fallbackSpecies();
  }
}

function playerHasUnique(species) {
  return !!DB.uniquePokemon[species.id];
}

function registerUnique(player, pokemon) {
  if (!GOD_IDS.has(pokemon.speciesId)) return true;

  const current = DB.uniquePokemon[pokemon.speciesId];
  if (current && current.owner !== player.id) return false;

  DB.uniquePokemon[pokemon.speciesId] = {
    owner: player.id,
    pokemonUID: pokemon.uid,
    name: pokemon.name
  };
  return true;
}

function catchChance(rarity, ball) {
  const base = {
    Common: 80,
    Rare: 55,
    Epic: 35,
    Legendary: 18,
    Mythical: 12,
    God: 4
  }[rarity] || 50;

  return Math.min(100, base * (BALLS[ball] || 1));
}

function makePlayerMessage(player) {
  return [
    "🎮 POKÉMON WORLD TRAINER",
    "━━━━━━━━━━━━━━━━━━",
    `💰 Coins: ${player.coins}`,
    `⭐ Level: ${player.level}`,
    `✨ XP: ${player.xp}`,
    `🎒 Pokémon: ${player.pokemon.length}/${CONFIG.MAX_STORAGE}`,
    `🏅 Badges: ${player.badges.length}`,
    `⚔️ Wins: ${player.wins}`,
    `❌ Losses: ${player.losses}`,
    `🤝 Draws: ${player.draws}`,
    `🔐 Recovery: ${player.recovery}`,
    "━━━━━━━━━━━━━━━━━━"
  ].join("\n");
}

module.exports.config = {
  name: "pokemonu",
  aliases: ["p"],
  version: "3.1.0",
  author: "Si Fat",
  role: 0,
  category: "games",
  shortDescription: "Pokémon World RPG",
  longDescription: "Pokémon hunting, catching, training, gyms and battles.",
  guide: "{pn} help"
};

module.exports.onStart = async function ({ api, event, args }) {
  const { senderID, threadID, messageID } = event;
  const command = String(args[0] || "help").toLowerCase();
  const player = getPlayer(senderID);
  const reply = msg => sendText(api, threadID, msg, messageID);

  if (command === "help") {
    return reply(
      "🎮 POKÉMON WORLD\n━━━━━━━━━━━━━━━━━━\n" +
      "p start - Start journey\n" +
      "p starter bulbasaur/charmander/squirtle\n" +
      "p profile - Trainer profile\n" +
      "p hunt - Find Pokémon\n" +
      "p catch [ball] - Catch Pokémon\n" +
      "p team - View team\n" +
      "p dex [page] - Pokédex\n" +
      "p god - God Pokémon list\n" +
      "p god hunt - Search God Pokémon\n" +
      "p info 1 - Pokémon details\n" +
      "p train 1 - Train Pokémon\n" +
      "p heal 1 - Heal Pokémon\n" +
      "p revive 1 - Revive Pokémon\n" +
      "p evolve 1 - Evolve Pokémon\n" +
      "p battle 1 - Wild battle\n" +
      "p gym - Gym list\n" +
      "p gym 1 - Challenge gym\n" +
      "p shop - Shop\n" +
      "p buy pokeball 5 - Buy items\n" +
      "p bag - Inventory\n" +
      "p badges - View badges\n" +
      "p setteam 1 - Add to team\n" +
      "p removeteam 1 - Remove from team\n" +
      "p recovery - Recovery code\n" +
      "p export - Export trainer\n" +
      "━━━━━━━━━━━━━━━━━━"
    );
  }

  if (command === "start") {
    if (player.started) return reply("Your journey has already started!");
    player.started = true;
    saveProgress(player);
    return reply(
      "🌍 Welcome to Pokémon World!\n\n" +
      "Choose your starter:\n" +
      "p starter bulbasaur\n" +
      "p starter charmander\n" +
      "p starter squirtle\n\n" +
      "Recovery: " + player.recovery
    );
  }

  if (!player.started) {
    return reply("Start your journey first: p start");
  }

  if (command === "starter") {
    if (player.pokemon.length) return reply("You already have a Pokémon.");

    const name = String(args[1] || "").toLowerCase();
    const species = STARTERS.find(x => x.name.toLowerCase() === name);
    if (!species) return reply("Choose bulbasaur, charmander or squirtle.");

    const pokemon = createPokemon(species, 5);
    player.pokemon.push(pokemon);
    player.team.push(pokemon.uid);
    player.pokedex.push(pokemon.speciesId);
    saveProgress(player);

    return sendPokemonImage(
      api, threadID,
      `🎉 STARTER OBTAINED!\n${pokemon.name}\nLevel: ${pokemon.level}\n` +
      `Type: ${pokemon.type.join("/")}\nUID: ${pokemon.uid}\n` +
      `Recovery: ${pokemon.recovery}\nTrainer Recovery: ${player.recovery}`,
      pokemon, messageID
    );
  }

  if (command === "profile") return reply(makePlayerMessage(player));

  if (command === "god") {
    if (String(args[1] || "").toLowerCase() === "hunt") {
      if (Date.now() - player.huntTime < CONFIG.HUNT_COOLDOWN) {
        return reply("⏳ Wait before hunting again.");
      }

      player.huntTime = Date.now();
      const available = GODS.filter(x => !playerHasUnique(x));

      if (!available.length) {
        saveDB();
        return reply("Every God Pokémon has already been claimed!");
      }

      if (Math.random() > 0.03) {
        saveDB();
        return reply("🌌 You searched the God Realm, but nothing appeared.");
      }

      const species = available[Math.floor(Math.random() * available.length)];
      const wild = createPokemon(species, 60 + Math.floor(Math.random() * 21));

      DB.events[senderID] = {
        wild,
        expires: Date.now() + CONFIG.ENCOUNTER_TIME,
        attempts: 0,
        god: true
      };
      saveDB();

      return sendPokemonImage(
        api, threadID,
        `👑 GOD POKÉMON APPEARED!\n${wild.name}\n` +
        `Level: ${wild.level}\nType: ${wild.type.join("/")}\n` +
        "Only one copy can be owned!\n" +
        "Use: p catch godball",
        wild, messageID
      );
    }

    return reply(
      "👑 GOD POKÉMON ARCHIVE\n━━━━━━━━━━━━━━━━━━\n" +
      GODS.map((g, i) => {
        const owner = DB.uniquePokemon[g.id];
        return `${i + 1}. ${g.name}\nStatus: ${owner ? "Owned" : "Available"}\n` +
          `Owner: ${owner ? owner.owner : "Nobody"}`;
      }).join("\n\n") +
      "\n\nSearch: p god hunt"
    );
  }

  if (command === "hunt") {
    if (!player.pokemon.length) return reply("Choose a starter first.");

    const remaining = CONFIG.HUNT_COOLDOWN - (Date.now() - player.huntTime);
    if (remaining > 0) {
      return reply(`⏳ Wait ${Math.ceil(remaining / 1000)} seconds.`);
    }

    player.huntTime = Date.now();
    let species = await getRandomPokemon();

    if (playerHasUnique(species)) species = fallbackSpecies();

    const wild = createPokemon(species, 3 + Math.floor(Math.random() * 15));
    DB.events[senderID] = {
      wild,
      expires: Date.now() + CONFIG.ENCOUNTER_TIME,
      attempts: 0,
      god: false
    };
    saveDB();

    return sendPokemonImage(
      api, threadID,
      `🌲 WILD POKÉMON APPEARED!\n${wild.name}\n` +
      `Level: ${wild.level}\nType: ${wild.type.join("/")}\n` +
      `Rarity: ${wild.rarity}\n\nUse p catch [ball]`,
      wild, messageID
    );
  }

  if (command === "catch") {
    const encounter = DB.events[senderID];

    if (!encounter || encounter.expires < Date.now()) {
      delete DB.events[senderID];
      saveDB();
      return reply("No active Pokémon. Use p hunt.");
    }

    if (player.pokemon.length >= CONFIG.MAX_STORAGE) {
      return reply("Your Pokémon storage is full!");
    }

    const wild = encounter.wild;
    let ball = String(args[1] || "").toLowerCase();

    if (!ball) {
      ball = encounter.god ? "godball" :
        player.inventory.masterball > 0 ? "masterball" :
        player.inventory.ultraball > 0 ? "ultraball" :
        player.inventory.greatball > 0 ? "greatball" : "pokeball";
    }

    if (!BALLS[ball]) {
      return reply("Use pokeball, greatball, ultraball, masterball or godball.");
    }

    if (!player.inventory[ball]) return reply(`You don't have ${ball}.`);
    if (encounter.god && !["godball", "masterball"].includes(ball)) {
      return reply("God Pokémon require Godball or Masterball!");
    }

    if (wild.rarity === "God" && playerHasUnique(wild)) {
      delete DB.events[senderID];
      saveDB();
      return reply("This God Pokémon has already been claimed!");
    }

    player.inventory[ball]--;
    player.catchTime = Date.now();
    encounter.attempts++;

    const chance = catchChance(wild.rarity, ball);

    if (Math.random() * 100 < chance) {
      if (!registerUnique(player, wild)) {
        delete DB.events[senderID];
        saveDB();
        return reply("Another trainer claimed this Pokémon first!");
      }

      wild.recovery = recoveryCode();
      player.pokemon.push(wild);
      if (player.team.length < CONFIG.MAX_TEAM) player.team.push(wild.uid);
      if (!player.pokedex.includes(wild.speciesId)) {
        player.pokedex.push(wild.speciesId);
      }

      delete DB.events[senderID];
      saveProgress(player);

      return sendPokemonImage(
        api, threadID,
        `🎉 CAUGHT ${wild.name}!\nLevel: ${wild.level}\n` +
        `Rarity: ${wild.rarity}\nBall: ${ball}\nUID: ${wild.uid}\n` +
        `Pokémon Recovery: ${wild.recovery}\nTrainer Recovery: ${player.recovery}`,
        wild, messageID
      );
    }

    const escape = {
      Common: 8, Rare: 15, Epic: 25,
      Legendary: 35, Mythical: 45, God: 60
    }[wild.rarity] || 15;

    if (Math.random() * 100 < escape) {
      delete DB.events[senderID];
      saveDB();
      return reply(`💨 ${wild.name} escaped! Your ${ball} was used.`);
    }

    encounter.expires = Date.now() + CONFIG.ENCOUNTER_TIME;
    saveDB();

    return reply(
      `❌ ${wild.name} broke free!\nBall used: ${ball}\n` +
      `Catch chance: ${chance.toFixed(1)}%\n` +
      "It is still here. Try another ball!"
    );
  }
  // ==========================================
  // TEAM
  // ==========================================

  if (command === "team") {
    const list = player.team.map((id, i) => {
      const p = player.pokemon.find(x => x.uid === id);
      return p
        ? `${i + 1}. ${p.name} Lv.${p.level} ❤️ ${p.hp}/${p.maxHp}`
        : null;
    }).filter(Boolean);

    return reply(
      "⚔️ YOUR TEAM\n\n" +
      (list.join("\n") || "Your team is empty.") +
      `\n\nTeam size: ${player.team.length}/${CONFIG.MAX_TEAM}`
    );
  }

  if (command === "setteam") {
    const index = Number(args[1] || 1) - 1;
    const p = player.pokemon[index];

    if (!p) return reply("Pokémon not found.");
    if (player.team.includes(p.uid)) return reply("Already in your team.");
    if (player.team.length >= CONFIG.MAX_TEAM) {
      return reply("Team is full. Maximum 6 Pokémon.");
    }

    player.team.push(p.uid);
    saveProgress(player);
    return reply(`${p.name} added to your team!`);
  }

  if (command === "removeteam") {
    const index = Number(args[1] || 1) - 1;
    const p = player.pokemon[index];

    if (!p) return reply("Pokémon not found.");
    if (!player.team.includes(p.uid)) return reply("Not in your team.");
    if (player.team.length <= 1) {
      return reply("You must keep at least one Pokémon in your team.");
    }

    player.team = player.team.filter(x => x !== p.uid);
    saveProgress(player);
    return reply(`${p.name} removed from your team.`);
  }

  // ==========================================
  // POKEDEX
  // ==========================================

  if (command === "dex") {
    const page = Math.max(1, Number(args[1]) || 1);
    const ids = [...new Set(player.pokedex)].sort((a, b) => a - b);
    const start = (page - 1) * 30;

    const output = ids.slice(start, start + 30).map(id => {
      const p = player.pokemon.find(x => x.speciesId === id);
      const cached = DB.speciesCache[id];
      return `#${id} ${p ? p.name : cached ? cached.name : "Discovered"}`;
    });

    return reply(
      `📖 POKÉDEX\nDiscovered: ${ids.length}\nPage: ${page}\n\n` +
      (output.join("\n") || "No Pokémon found.") +
      `\n\nNext page: p dex ${page + 1}`
    );
  }

  // ==========================================
  // POKEMON INFO
  // ==========================================

  if (command === "info") {
    const p = player.pokemon[Number(args[1] || 1) - 1];
    if (!p) return reply("Pokémon not found.");

    return sendPokemonImage(
      api, threadID,
      `📖 POKÉMON INFO\n\nName: ${p.name}\nLevel: ${p.level}\n` +
      `XP: ${p.xp}\nType: ${p.type.join("/")}\nRarity: ${p.rarity}\n` +
      `Shiny: ${p.shiny ? "YES ✨" : "No"}\n` +
      `HP: ${p.hp}/${p.maxHp}\nAttack: ${p.attack}\n` +
      `Defense: ${p.defense}\nUID: ${p.uid}\nRecovery: ${p.recovery}`,
      p, messageID
    );
  }

  // ==========================================
  // TRAIN
  // ==========================================

  if (command === "train") {
    const p = player.pokemon[Number(args[1] || 1) - 1];
    if (!p) return reply("Pokémon not found.");
    if (p.hp <= 0) return reply("Your Pokémon has fainted. Revive it first.");

    const gained = 20 + Math.floor(Math.random() * 31);
    p.xp += gained;
    let levelUp = false;

    while (p.xp >= p.level * 50 && p.level < CONFIG.MAX_LEVEL) {
      p.xp -= p.level * 50;
      p.level++;
      p.maxHp += 5;
      p.hp = Math.min(p.maxHp, p.hp + 5);
      p.attack += 2;
      p.defense++;
      levelUp = true;
    }

    p.recovery = recoveryCode();
    saveProgress(player);

    return sendPokemonImage(
      api, threadID,
      `🏋️ TRAINING COMPLETE!\n${p.name}\n+${gained} XP\n` +
      `Level: ${p.level}\n${levelUp ? "⭐ LEVEL UP!\n" : ""}` +
      `HP: ${p.hp}/${p.maxHp}\nRecovery: ${p.recovery}`,
      p, messageID
    );
  }

  // ==========================================
  // HEAL
  // ==========================================

  if (command === "heal") {
    const p = player.pokemon[Number(args[1] || 1) - 1];
    if (!p) return reply("Pokémon not found.");
    if (p.hp >= p.maxHp) return reply("Already fully healed.");
    if (player.inventory.potion <= 0) return reply("No Potions available.");

    player.inventory.potion--;
    p.hp = p.maxHp;
    p.recovery = recoveryCode();
    saveProgress(player);

    return sendPokemonImage(
      api, threadID,
      `💚 ${p.name} healed!\nHP: ${p.hp}/${p.maxHp}\nRecovery: ${p.recovery}`,
      p, messageID
    );
  }

  // ==========================================
  // REVIVE
  // ==========================================

  if (command === "revive") {
    const p = player.pokemon[Number(args[1] || 1) - 1];
    if (!p) return reply("Pokémon not found.");
    if (p.hp > 0) return reply("This Pokémon has not fainted.");
    if (player.inventory.revive <= 0) return reply("No Revive available.");

    player.inventory.revive--;
    p.hp = Math.max(1, Math.floor(p.maxHp / 2));
    p.recovery = recoveryCode();
    saveProgress(player);

    return sendPokemonImage(
      api, threadID,
      `✨ ${p.name} revived!\nHP: ${p.hp}/${p.maxHp}\nRecovery: ${p.recovery}`,
      p, messageID
    );
  }

  // ==========================================
  // EVOLUTION
  // ==========================================

  if (command === "evolve") {
    const p = player.pokemon[Number(args[1] || 1) - 1];
    if (!p) return reply("Pokémon not found.");
    if (p.level < 16) return reply("Level 16 required for evolution.");

    const evo = {
      Bulbasaur: [2, "Ivysaur", ["Grass", "Poison"]],
      Ivysaur: [3, "Venusaur", ["Grass", "Poison"]],
      Charmander: [5, "Charmeleon", ["Fire"]],
      Charmeleon: [6, "Charizard", ["Fire", "Flying"]],
      Squirtle: [8, "Wartortle", ["Water"]],
      Wartortle: [9, "Blastoise", ["Water"]],
      Caterpie: [11, "Metapod", ["Bug"]],
      Metapod: [12, "Butterfree", ["Bug", "Flying"]],
      Pidgey: [17, "Pidgeotto", ["Normal", "Flying"]],
      Pidgeotto: [18, "Pidgeot", ["Normal", "Flying"]],
      Pikachu: [26, "Raichu", ["Electric"]],
      Vulpix: [38, "Ninetales", ["Fire"]],
      Growlithe: [59, "Arcanine", ["Fire"]],
      Geodude: [75, "Graveler", ["Rock", "Ground"]],
      Graveler: [76, "Golem", ["Rock", "Ground"]],
      Gastly: [93, "Haunter", ["Ghost", "Poison"]],
      Haunter: [94, "Gengar", ["Ghost", "Poison"]],
      Dratini: [148, "Dragonair", ["Dragon"]],
      Dragonair: [149, "Dragonite", ["Dragon", "Flying"]],
      Eevee: [134, "Vaporeon", ["Water"]]
    };

    const next = evo[p.name];
    if (!next) return reply("No evolution configured for this Pokémon.");

    const oldName = p.name;
    const oldUID = p.uid;

    p.speciesId = next[0];
    p.name = next[1];
    p.type = [...next[2]];
    p.uid = uid();
    p.level++;
    p.maxHp += 20;
    p.hp = Math.min(p.maxHp, p.hp + 20);
    p.attack += 10;
    p.defense += 5;
    p.recovery = recoveryCode();

    player.team = player.team.map(x => x === oldUID ? p.uid : x);

    if (!player.pokedex.includes(p.speciesId)) {
      player.pokedex.push(p.speciesId);
    }

    saveProgress(player);

    return sendPokemonImage(
      api, threadID,
      `✨ EVOLUTION!\n${oldName} → ${p.name}\n` +
      `New Level: ${p.level}\nOld UID: ${oldUID}\nNew UID: ${p.uid}\n` +
      `Pokémon Recovery: ${p.recovery}\nTrainer Recovery: ${player.recovery}`,
      p, messageID
    );
  }

  // ==========================================
  // WILD BATTLE
  // ==========================================

  if (command === "battle") {
    const p = player.pokemon[Number(args[1] || 1) - 1];
    if (!p) return reply("Pokémon not found.");
    if (p.hp <= 0) return reply("Your Pokémon has fainted.");

    const species = await getRandomPokemon();
    const enemy = createPokemon(
      species,
      Math.max(3, p.level + Math.floor(Math.random() * 5) - 2)
    );

    const myPower = p.attack + p.level * 2;
    const enemyPower = enemy.attack + enemy.level * 2;
    const won = myPower >= enemyPower;

    if (won) {
      const reward = 50 + enemy.level * 5;
      player.coins += reward;
      player.wins++;
      p.xp += 30;
      p.hp = Math.max(1, p.hp - 10);
    } else {
      player.losses++;
      p.hp = Math.max(0, p.hp - 25);
    }

    p.recovery = recoveryCode();
    saveProgress(player);

    return sendPokemonImage(
      api, threadID,
      `⚔️ BATTLE RESULT\n${p.name} VS ${enemy.name}\n\n` +
      (won ? `🏆 VICTORY!\n+${50 + enemy.level * 5} Coins\n+30 XP` : "❌ DEFEAT!") +
      `\nYour HP: ${p.hp}/${p.maxHp}\nRecovery: ${p.recovery}`,
      p, messageID
    );
  }

  // ==========================================
  // GYMS
  // ==========================================

  if (command === "gym") {
    if (!args[1] || args[1] === "list") {
      return reply(
        "🏅 GYM LEAGUE\n\n" +
        GYMS.map((g, i) =>
          `${i + 1}. ${g.name}\nLeader: ${g.leader}\nType: ${g.type}\n` +
          `Badge: ${g.badge}\nRequired level: ${g.level}`
        ).join("\n\n") +
        "\n\nChallenge: p gym 1"
      );
    }

    const gym = GYMS[Number(args[1]) - 1];
    if (!gym) return reply("Invalid gym number.");
    if (player.badges.includes(gym.badge)) {
      return reply("You already own this badge.");
    }

    const p = player.pokemon[Number(args[2] || 1) - 1];
    if (!p) return reply("Pokémon not found.");
    if (p.level < gym.level) return reply(`Required level: ${gym.level}`);
    if (p.hp <= 0) return reply("Your Pokémon has fainted.");

    const enemyPower = gym.level * 7;
    const myPower = p.attack + p.level * 3;
    const won = myPower >= enemyPower;

    if (won) {
      player.badges.push(gym.badge);
      player.coins += gym.level * 100;
      player.wins++;
      p.xp += 100;
      p.hp = Math.max(1, p.hp - 15);
    } else {
      player.losses++;
      p.hp = Math.max(0, p.hp - 30);
    }

    p.recovery = recoveryCode();
    saveProgress(player);

    return sendPokemonImage(
      api, threadID,
      `🏟️ GYM BATTLE\nLeader: ${gym.leader}\nGym: ${gym.name}\n` +
      `Your Pokémon: ${p.name}\n` +
      (won
        ? `🏆 YOU WON!\n🏅 Badge: ${gym.badge}\n+${gym.level * 100} Coins`
        : "❌ You lost the gym battle. Train and try again.") +
      `\nHP: ${p.hp}/${p.maxHp}\nRecovery: ${p.recovery}`,
      p, messageID
    );
  }

  // ==========================================
  // SHOP
  // ==========================================

  if (command === "shop") {
    return reply(
      "🛒 POKÉMON SHOP\n\n" +
      Object.entries(SHOP).map(([name, price]) =>
        `${name}: ${price} Coins`
      ).join("\n") +
      "\n\nBuy: p buy pokeball 5"
    );
  }

  if (command === "buy") {
    const item = String(args[1] || "").toLowerCase();
    const amount = Math.floor(Number(args[2] || 1));

    if (!SHOP[item]) return reply("Unknown shop item. Use p shop.");
    if (!Number.isFinite(amount) || amount < 1 || amount > 100) {
      return reply("Amount must be between 1 and 100.");
    }

    const cost = SHOP[item] * amount;
    if (player.coins < cost) return reply("Not enough coins.");

    player.coins -= cost;
    player.inventory[item] += amount;
    saveProgress(player);

    return reply(
      `✅ Purchase successful!\nItem: ${item}\nAmount: ${amount}\n` +
      `Cost: ${cost}\nRemaining coins: ${player.coins}`
    );
  }

  // ==========================================
  // INVENTORY
  // ==========================================

  if (command === "bag" || command === "inventory") {
    return reply(
      "🎒 YOUR INVENTORY\n\n" +
      Object.entries(player.inventory).map(([k, v]) => `${k}: ${v}`).join("\n") +
      `\n\nCoins: ${player.coins}`
    );
  }

  // ==========================================
  // BADGES
  // ==========================================

  if (command === "badges") {
    return reply(
      "🏅 YOUR BADGES\n\n" +
      (player.badges.join("\n") || "No badges yet.") +
      `\n\nTotal: ${player.badges.length}/8`
    );
  }

  // ==========================================
  // RECOVERY / EXPORT
  // ==========================================

  if (command === "recovery") {
    return reply(
      "🔐 TRAINER RECOVERY\n\n" +
      `Your recovery code:\n${player.recovery}\n\n` +
      "Keep this code safe. It identifies your trainer, but cannot restore deleted data by itself.\n" +
      "Use p export to create a backup."
    );
  }

  if (command === "export") {
    const snapshot = {
      version: 1,
      id: player.id,
      recovery: player.recovery,
      data: player
    };

    const encoded = Buffer.from(JSON.stringify(snapshot)).toString("base64");

    return reply(
      "📦 TRAINER EXPORT\n\n" +
      encoded +
      "\n\nSave this entire code somewhere safe. Use p restore followed by the code to restore."
    );
  }

  if (command === "restore") {
    const encoded = String(args[1] || "").trim();
    if (!encoded) return reply("Usage: p restore YOUR_EXPORT_CODE");

    try {
      const snapshot = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
      const data = snapshot.data;

      if (
        !data ||
        !Array.isArray(data.pokemon) ||
        !Array.isArray(data.team) ||
        !Array.isArray(data.pokedex) ||
        !Array.isArray(data.badges) ||
        !data.inventory ||
        !Number.isFinite(data.coins) ||
        data.pokemon.length > CONFIG.MAX_STORAGE
      ) {
        return reply("Invalid backup data.");
      }

      for (const p of data.pokemon) {
        if (
          !p ||
          !Number.isFinite(p.speciesId) ||
          typeof p.name !== "string" ||
          typeof p.uid !== "string" ||
          !Number.isFinite(p.level) ||
          !Number.isFinite(p.hp) ||
          !Number.isFinite(p.maxHp)
        ) {
          return reply("Backup contains invalid Pokémon data.");
        }
      }

      const uniqueInBackup = data.pokemon.filter(p => GOD_IDS.has(p.speciesId));

      for (const p of uniqueInBackup) {
        const owner = DB.uniquePokemon[p.speciesId];
        if (owner && owner.owner !== senderID) {
          return reply(`${p.name} is already owned by another trainer. Restore denied.`);
        }
      }

      data.id = senderID;
      data.recovery = recoveryCode();
      data.started = true;

      DB.players[senderID] = data;

      for (const p of uniqueInBackup) {
        DB.uniquePokemon[p.speciesId] = {
          owner: senderID,
          pokemonUID: p.uid,
          name: p.name
        };
      }

      saveDB();

      return reply(
        "✅ TRAINER RESTORED!\n" +
        `Pokémon: ${data.pokemon.length}\n` +
        `New recovery code: ${data.recovery}`
      );
    } catch (e) {
      return reply("Invalid export code. Make sure the entire code was copied.");
    }
  }

  return reply("Unknown command. Use p help.");
};  
