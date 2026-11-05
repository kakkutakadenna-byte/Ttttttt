
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
  ENCOUNTER_TIME: 120000
};

const STARTERS = [
  { id: 1, name: "Bulbasaur", type: ["Grass", "Poison"], rarity: "Common" },
  { id: 4, name: "Charmander", type: ["Fire"], rarity: "Common" },
  { id: 7, name: "Squirtle", type: ["Water"], rarity: "Common" }
];

const SPECIES = [
  { id: 10, name: "Caterpie", type: ["Bug"], rarity: "Common" },
  { id: 11, name: "Metapod", type: ["Bug"], rarity: "Common" },
  { id: 12, name: "Butterfree", type: ["Bug", "Flying"], rarity: "Rare" },
  { id: 16, name: "Pidgey", type: ["Normal", "Flying"], rarity: "Common" },
  { id: 17, name: "Pidgeotto", type: ["Normal", "Flying"], rarity: "Rare" },
  { id: 18, name: "Pidgeot", type: ["Normal", "Flying"], rarity: "Epic" },
  { id: 25, name: "Pikachu", type: ["Electric"], rarity: "Rare" },
  { id: 26, name: "Raichu", type: ["Electric"], rarity: "Epic" },
  { id: 37, name: "Vulpix", type: ["Fire"], rarity: "Rare" },
  { id: 38, name: "Ninetales", type: ["Fire"], rarity: "Epic" },
  { id: 39, name: "Jigglypuff", type: ["Normal", "Fairy"], rarity: "Rare" },
  { id: 52, name: "Meowth", type: ["Normal"], rarity: "Common" },
  { id: 58, name: "Growlithe", type: ["Fire"], rarity: "Rare" },
  { id: 59, name: "Arcanine", type: ["Fire"], rarity: "Epic" },
  { id: 74, name: "Geodude", type: ["Rock", "Ground"], rarity: "Common" },
  { id: 75, name: "Graveler", type: ["Rock", "Ground"], rarity: "Rare" },
  { id: 76, name: "Golem", type: ["Rock", "Ground"], rarity: "Epic" },
  { id: 92, name: "Gastly", type: ["Ghost", "Poison"], rarity: "Rare" },
  { id: 93, name: "Haunter", type: ["Ghost", "Poison"], rarity: "Epic" },
  { id: 94, name: "Gengar", type: ["Ghost", "Poison"], rarity: "Epic" },
  { id: 133, name: "Eevee", type: ["Normal"], rarity: "Rare" },
  { id: 134, name: "Vaporeon", type: ["Water"], rarity: "Epic" },
  { id: 135, name: "Jolteon", type: ["Electric"], rarity: "Epic" },
  { id: 136, name: "Flareon", type: ["Fire"], rarity: "Epic" },
  { id: 147, name: "Dratini", type: ["Dragon"], rarity: "Epic" },
  { id: 148, name: "Dragonair", type: ["Dragon"], rarity: "Epic" },
  { id: 149, name: "Dragonite", type: ["Dragon", "Flying"], rarity: "Epic" },
  { id: 150, name: "Mewtwo", type: ["Psychic"], rarity: "Legendary", unique: true },
  { id: 151, name: "Mew", type: ["Psychic"], rarity: "Mythical", unique: true },
  { id: 249, name: "Lugia", type: ["Psychic", "Flying"], rarity: "Legendary", unique: true },
  { id: 250, name: "Ho-Oh", type: ["Fire", "Flying"], rarity: "Legendary", unique: true },
  { id: 384, name: "Rayquaza", type: ["Dragon", "Flying"], rarity: "Legendary", unique: true },
  { id: 487, name: "Giratina", type: ["Ghost", "Dragon"], rarity: "Legendary", unique: true },
  { id: 493, name: "Arceus", type: ["Normal"], rarity: "Mythical", unique: true },
  { id: 722, name: "Rowlet", type: ["Grass", "Flying"], rarity: "Rare" },
  { id: 723, name: "Dartrix", type: ["Grass", "Flying"], rarity: "Rare" },
  { id: 724, name: "Decidueye", type: ["Grass", "Ghost"], rarity: "Epic" },
  { id: 725, name: "Litten", type: ["Fire"], rarity: "Rare" },
  { id: 726, name: "Torracat", type: ["Fire"], rarity: "Rare" },
  { id: 727, name: "Incineroar", type: ["Fire", "Dark"], rarity: "Epic" },
  { id: 728, name: "Popplio", type: ["Water"], rarity: "Rare" },
  { id: 729, name: "Brionne", type: ["Water"], rarity: "Rare" },
  { id: 730, name: "Primarina", type: ["Water", "Fairy"], rarity: "Epic" }
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

function uid() {
  return "PK-" + crypto.randomBytes(6).toString("hex").toUpperCase();
}

function recoveryCode() {
  return "REC-" + crypto.randomBytes(12).toString("hex").toUpperCase();
}

function defaultDB() {
  return {
    version: 2,
    players: {},
    uniquePokemon: {},
    battles: {},
    events: {}
  };
}

function saveDB(data = DB) {
  try {
    const temp = DB_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(data, null, 2));
    fs.renameSync(temp, DB_FILE);

    fs.writeFileSync(
      BACKUP_FILE,
      JSON.stringify(data, null, 2)
    );

    return true;
  } catch (error) {
    console.error("[POKEMONU SAVE ERROR]", error);
    return false;
  }
}

function loadDB() {
  for (const file of [DB_FILE, BACKUP_FILE]) {
    try {
      if (!fs.existsSync(file)) continue;

      const data = JSON.parse(fs.readFileSync(file, "utf8"));

      if (!data || typeof data !== "object") continue;

      data.players ||= {};
      data.uniquePokemon ||= {};
      data.battles ||= {};
      data.events ||= {};
      data.version = 2;

      return data;
    } catch (error) {
      console.error("[POKEMONU LOAD ERROR]", error);
    }
  }

  return defaultDB();
}

let DB = loadDB();

function getPlayer(id) {
  if (!DB.players[id]) {
    DB.players[id] = {
      id,
      started: false,
      coins: 1000,
      xp: 0,
      level: 1,
      pokedex: [],
      pokemon: [],
      team: [],
      badges: [],
      inventory: {
        pokeball: 10,
        greatball: 3,
        ultraball: 1,
        potion: 5,
        revive: 1
      },
      recovery: recoveryCode(),
      wins: 0,
      losses: 0,
      huntTime: 0,
      catchTime: 0
    };
  }

  const p = DB.players[id];

  p.pokemon ||= [];
  p.team ||= [];
  p.badges ||= [];
  p.pokedex ||= [];
  p.inventory ||= {};
  p.inventory.pokeball ??= 10;
  p.inventory.greatball ??= 3;
  p.inventory.ultraball ??= 1;
  p.inventory.potion ??= 5;
  p.inventory.revive ??= 1;
  p.coins ??= 1000;
  p.xp ??= 0;
  p.level ??= 1;
  p.recovery ||= recoveryCode();

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
    recovery: recoveryCode()
  };
}

function getSprite(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function sendPokemonImage(api, threadID, message, pokemon, replyID) {
  const url = getSprite(pokemon.speciesId);

  const fallback = () =>
    api.sendMessage(message, threadID, null, replyID);

  https.get(url, response => {
    if (response.statusCode !== 200) {
      response.resume();
      return fallback();
    }

    api.sendMessage(
      { body: message, attachment: response },
      threadID,
      error => {
        if (error) fallback();
      },
      replyID
    );
  }).on("error", fallback);
}

function getRandomPokemon() {
  const roll = Math.random() * 100;

  let rarity;

  if (roll < 1) rarity = "Mythical";
  else if (roll < 3) rarity = "Legendary";
  else if (roll < 12) rarity = "Epic";
  else if (roll < 35) rarity = "Rare";
  else rarity = "Common";

  let pool = SPECIES.filter(p => p.rarity === rarity);

  if (!pool.length) pool = SPECIES;

  return pool[Math.floor(Math.random() * pool.length)];
}

function playerHasUnique(species) {
  return !!DB.uniquePokemon[species.id];
}

function saveProgress(player) {
  player.recovery = recoveryCode();
  return saveDB();
}

function makePlayerMessage(player) {
  return [
    "🎮 POKÉMON TRAINER PROFILE",
    "━━━━━━━━━━━━━━━━━━",
    `💰 Coins: ${player.coins}`,
    `⭐ Level: ${player.level}`,
    `✨ XP: ${player.xp}`,
    `🎒 Pokémon: ${player.pokemon.length}`,
    `🏅 Badges: ${player.badges.length}`,
    `⚔️ Wins: ${player.wins}`,
    `❌ Losses: ${player.losses}`,
    `🔐 Recovery: ${player.recovery}`,
    "━━━━━━━━━━━━━━━━━━"
  ].join("\n");
}

module.exports.config = {
  name: "pokemonu",
  aliases: ["p"],
  version: "2.0.0",
  author: "Si Fat",
  role: 0,
  category: "games",
  shortDescription: "Pokémon World RPG",
  longDescription: "Pokémon adventure, catching, training and battles.",
  guide: "{pn} help"
};

module.exports.onStart = async function ({
  api,
  event,
  args
}) {
  const { senderID, threadID, messageID } = event;

  const command = String(args[0] || "help").toLowerCase();
  const player = getPlayer(senderID);

  const reply = message =>
    api.sendMessage(message, threadID, null, messageID);

  if (command === "help") {
    return reply(
      "🎮 POKÉMON WORLD ULTIMATE\n" +
      "━━━━━━━━━━━━━━━━━━\n" +
      "p start - Start journey\n" +
      "p starter bulbasaur - Choose starter\n" +
      "p profile - Trainer profile\n" +
      "p hunt - Find Pokémon\n" +
      "p catch - Catch Pokémon\n" +
      "p team - View team\n" +
      "p dex - Pokédex\n" +
      "p info 1 - Pokémon details\n" +
      "p train 1 - Train Pokémon\n" +
      "p battle 1 - Wild battle\n" +
      "p evolve 1 - Evolve Pokémon\n" +
      "p heal 1 - Heal Pokémon\n" +
      "p gym - Gym list\n" +
      "p shop - Shop\n" +
      "p recovery - Recovery code\n" +
      "p export - Export data\n" +
      "p backup - Backup data\n" +
      "━━━━━━━━━━━━━━━━━━"
    );
  }

  if (command === "start") {
    if (player.started) {
      return reply("You have already started your Pokémon journey!");
    }

    player.started = true;
    saveProgress(player);

    return reply(
      "🌍 WELCOME TO THE POKÉMON WORLD!\n\n" +
      "Choose your starter:\n" +
      "p starter bulbasaur\n" +
      "p starter charmander\n" +
      "p starter squirtle\n\n" +
      `🔐 Recovery: ${player.recovery}`
    );
  }

  if (!player.started) {
    return reply("Start your journey first: p start");
  }

  if (command === "starter") {
    if (player.pokemon.length) {
      return reply("You already own a starter Pokémon!");
    }

    const choice = String(args[1] || "").toLowerCase();
    const species = STARTERS.find(
      p => p.name.toLowerCase() === choice
    );

    if (!species) {
      return reply("Choose bulbasaur, charmander or squirtle.");
    }

    const pokemon = createPokemon(species, 5);

    player.pokemon.push(pokemon);
    player.team.push(pokemon.uid);
    player.pokedex.push(pokemon.speciesId);

    saveProgress(player);
    pokemon.recovery = player.recovery;

    saveDB();

    return sendPokemonImage(
      api,
      threadID,
      `🎉 STARTER OBTAINED!\n\n` +
      `Name: ${pokemon.name}\n` +
      `Level: ${pokemon.level}\n` +
      `Type: ${pokemon.type.join("/")}\n` +
      `UID: ${pokemon.uid}\n` +
      `Recovery: ${player.recovery}`,
      pokemon,
      messageID
    );
  }

  if (command === "profile") {
    return reply(makePlayerMessage(player));
  }

  if (command === "hunt") {
    if (!player.pokemon.length) {
      return reply("Choose a starter first!");
    }

    if (Date.now() - player.huntTime < CONFIG.HUNT_COOLDOWN) {
      const seconds = Math.ceil(
        (CONFIG.HUNT_COOLDOWN - (Date.now() - player.huntTime)) / 1000
      );

      return reply(`⏳ Wait ${seconds} seconds before hunting again.`);
    }

    player.huntTime = Date.now();

    const species = getRandomPokemon();

    if (species.unique && playerHasUnique(species)) {
      saveDB();
      return reply("🌲 You explored, but found nothing this time.");
    }

    const wild = createPokemon(
      species,
      3 + Math.floor(Math.random() * 12)
    );

    DB.events[senderID] = {
      wild,
      expires: Date.now() + CONFIG.ENCOUNTER_TIME
    };

    saveDB();

    return sendPokemonImage(
      api,
      threadID,
      `🌲 WILD POKÉMON APPEARED!\n\n` +
      `Name: ${wild.name}\n` +
      `Type: ${wild.type.join("/")}\n` +
      `Level: ${wild.level}\n` +
      `Rarity: ${wild.rarity}\n\n` +
      "Use p catch to catch it!\n" +
      "Encounter expires in 2 minutes.",
      wild,
      messageID
    );
  }

  if (command === "catch") {
    const encounter = DB.events[senderID];

    if (!encounter || encounter.expires < Date.now()) {
      delete DB.events[senderID];
      saveDB();
      return reply("No active encounter! Use p hunt.");
    }

    if (player.pokemon.length >= CONFIG.MAX_STORAGE) {
      return reply("Your Pokémon storage is full!");
    }

    if (Date.now() - player.catchTime < 3000) {
      return reply("Please wait before catching again.");
    }

    const wild = encounter.wild;

    const ball = player.inventory.ultraball > 0
      ? "ultraball"
      : player.inventory.greatball > 0
        ? "greatball"
        : player.inventory.pokeball > 0
          ? "pokeball"
          : null;

    if (!ball) {
      return reply("No Poké Balls! Use p shop.");
    }

    if (wild.rarity === "Legendary" || wild.rarity === "Mythical") {
      const registered = SPECIES.find(s => s.id === wild.speciesId);

      if (registered && registered.unique && playerHasUnique(registered)) {
        delete DB.events[senderID];
        saveDB();
        return reply("This unique Pokémon already has an owner!");
      }
    }

    player.catchTime = Date.now();

    const catchRates = {
      Common: 75,
      Rare: 55,
      Epic: 35,
      Legendary: 15,
      Mythical: 10
    };

    const ballBonus = {
      pokeball: 0,
      greatball: 15,
      ultraball: 25
    };

    player.inventory[ball]--;

    const success = Math.random() * 100 <
      Math.min(95, catchRates[wild.rarity] + ballBonus[ball]);

    if (!success) {
      delete DB.events[senderID];
      saveDB();
      return reply(`${wild.name} escaped! Your ${ball} was used.`);
    }

    wild.recovery = recoveryCode();

    player.pokemon.push(wild);

    if (player.team.length < CONFIG.MAX_TEAM) {
      player.team.push(wild.uid);
    }

    if (!player.pokedex.includes(wild.speciesId)) {
      player.pokedex.push(wild.speciesId);
    }

    const species = SPECIES.find(s => s.id === wild.speciesId);

    if (species && species.unique) {
      DB.uniquePokemon[species.id] = {
        owner: senderID,
        pokemonUID: wild.uid
      };
    }

    delete DB.events[senderID];

    saveProgress(player);
    wild.recovery = player.recovery;
    saveDB();

    return sendPokemonImage(
      api,
      threadID,
      `🎉 POKÉMON CAUGHT!\n\n` +
      `Name: ${wild.name}\n` +
      `Level: ${wild.level}\n` +
      `Rarity: ${wild.rarity}\n` +
      `UID: ${wild.uid}\n` +
      `Recovery: ${player.recovery}\n\n` +
      "Your Pokémon has been saved!",
      wild,
      messageID
    );
  }

  if (command === "team") {
    const list = player.team.map((id, index) => {
      const pokemon = player.pokemon.find(p => p.uid === id);

      return pokemon
        ? `${index + 1}. ${pokemon.name} Lv.${pokemon.level}\n❤️ ${pokemon.hp}/${pokemon.maxHp}\nUID: ${pokemon.uid}`
        : null;
    }).filter(Boolean);

    return reply(
      "⚔️ YOUR BATTLE TEAM\n\n" +
      (list.join("\n\n") || "Your team is empty.") +
      `\n\n${player.team.length}/6 Pokémon`
    );
  }

  if (command === "dex") {
    const list = player.pokedex.map(id => {
      const pokemon = SPECIES.find(p => p.id === id);
      return pokemon ? `#${id} ${pokemon.name}` : null;
    }).filter(Boolean);

    return reply(
      `📖 POKÉDEX\n\nDiscovered: ${list.length}\n\n` +
      (list.join("\n") || "No Pokémon discovered.")
    );
  }

  // ==========================================
  // TRAINING AND LEVEL UP
  // ==========================================

  if (command === "train") {
    const index = Number(args[1] || 1) - 1;
    const pokemon = player.pokemon[index];

    if (!pokemon) return reply("Pokémon not found.");
    if (pokemon.hp <= 0) return reply("Heal your Pokémon first.");

    const gained = 20 + Math.floor(Math.random() * 31);
    pokemon.xp += gained;

    let message = `🏋️ TRAINING COMPLETE!\n${pokemon.name}\n+${gained} XP`;

    let leveled = false;

    while (
      pokemon.xp >= pokemon.level * 50 &&
      pokemon.level < CONFIG.MAX_LEVEL
    ) {
      pokemon.xp -= pokemon.level * 50;
      pokemon.level++;
      pokemon.maxHp += 5;
      pokemon.hp = Math.min(pokemon.maxHp, pokemon.hp + 5);
      pokemon.attack += 2;
      pokemon.defense += 1;
      leveled = true;
    }

    if (leveled) {
      pokemon.recovery = recoveryCode();
      player.recovery = recoveryCode();

      message +=
        `\n\n⭐ LEVEL UP!\nLevel: ${pokemon.level}` +
        `\nUID: ${pokemon.uid}` +
        `\nRecovery: ${pokemon.recovery}` +
        `\nTrainer Recovery: ${player.recovery}`;
    }

    saveDB();

    return sendPokemonImage(
      api, threadID, message, pokemon, messageID
    );
  }

  // ==========================================
  // HEALING
  // ==========================================

  if (command === "heal") {
    const index = Number(args[1] || 1) - 1;
    const pokemon = player.pokemon[index];

    if (!pokemon) return reply("Pokémon not found.");

    if (player.inventory.potion <= 0) {
      return reply("You have no Potions! Use p shop.");
    }

    if (pokemon.hp === pokemon.maxHp) {
      return reply("This Pokémon is already fully healed.");
    }

    player.inventory.potion--;
    pokemon.hp = pokemon.maxHp;

    pokemon.recovery = recoveryCode();
    saveProgress(player);

    return sendPokemonImage(
      api,
      threadID,
      `💚 HEALED!\n${pokemon.name}\n` +
      `HP: ${pokemon.hp}/${pokemon.maxHp}\n` +
      `UID: ${pokemon.uid}\nRecovery: ${player.recovery}`,
      pokemon,
      messageID
    );
  }

  if (command === "revive") {
    const index = Number(args[1] || 1) - 1;
    const pokemon = player.pokemon[index];

    if (!pokemon) return reply("Pokémon not found.");

    if (player.inventory.revive <= 0) {
      return reply("You have no Revives!");
    }

    if (pokemon.hp > 0) {
      return reply("This Pokémon has not fainted.");
    }

    player.inventory.revive--;
    pokemon.hp = Math.max(1, Math.floor(pokemon.maxHp / 2));

    pokemon.recovery = recoveryCode();
    saveProgress(player);

    return sendPokemonImage(
      api,
      threadID,
      `✨ REVIVE USED!\n${pokemon.name}\n` +
      `HP: ${pokemon.hp}/${pokemon.maxHp}\n` +
      `UID: ${pokemon.uid}\nRecovery: ${player.recovery}`,
      pokemon,
      messageID
    );
  }

  // ==========================================
  // EVOLUTION
  // ==========================================

  if (command === "evolve") {
    const index = Number(args[1] || 1) - 1;
    const pokemon = player.pokemon[index];

    if (!pokemon) return reply("Pokémon not found.");

    if (pokemon.level < 16) {
      return reply("Your Pokémon needs level 16 first.");
    }

    const evolutions = {
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

    const next = evolutions[pokemon.name];

    if (!next) {
      return reply(
        "No evolution is configured for this Pokémon yet."
      );
    }

    const oldName = pokemon.name;
    const oldUID = pokemon.uid;

    pokemon.name = next[1];
    pokemon.speciesId = next[0];
    pokemon.type = [...next[2]];
    pokemon.uid = uid();
    pokemon.recovery = recoveryCode();

    pokemon.level = Math.min(CONFIG.MAX_LEVEL, pokemon.level + 1);
    pokemon.maxHp += 20;
    pokemon.hp = pokemon.maxHp;
    pokemon.attack += 10;
    pokemon.defense += 5;

    player.team = player.team.map(id =>
      id === oldUID ? pokemon.uid : id
    );

    if (!player.pokedex.includes(pokemon.speciesId)) {
      player.pokedex.push(pokemon.speciesId);
    }

    player.recovery = recoveryCode();
    saveDB();

    return sendPokemonImage(
      api,
      threadID,
      `✨ EVOLUTION!\n\n${oldName} → ${pokemon.name}\n\n` +
      `Old UID: ${oldUID}\nNew UID: ${pokemon.uid}\n` +
      `Level: ${pokemon.level}\n` +
      `HP: ${pokemon.hp}/${pokemon.maxHp}\n` +
      `Recovery: ${pokemon.recovery}\n` +
      `Trainer Recovery: ${player.recovery}`,
      pokemon,
      messageID
    );
  }

  // ==========================================
  // POKÉMON DETAILS
  // ==========================================

  if (command === "info") {
    const index = Number(args[1] || 1) - 1;
    const pokemon = player.pokemon[index];

    if (!pokemon) return reply("Pokémon not found.");

    return sendPokemonImage(
      api,
      threadID,
      `📖 POKÉMON INFORMATION\n\n` +
      `Name: ${pokemon.name}\n` +
      `UID: ${pokemon.uid}\n` +
      `Level: ${pokemon.level}\n` +
      `XP: ${pokemon.xp}\n` +
      `Type: ${pokemon.type.join("/")}\n` +
      `Rarity: ${pokemon.rarity}\n` +
      `HP: ${pokemon.hp}/${pokemon.maxHp}\n` +
      `Attack: ${pokemon.attack}\n` +
      `Defense: ${pokemon.defense}\n` +
      `Recovery: ${pokemon.recovery}`,
      pokemon,
      messageID
    );
  }

  // ==========================================
  // WILD BATTLE
  // ==========================================

  if (command === "battle") {
    const index = Number(args[1] || 1) - 1;
    const pokemon = player.pokemon[index];

    if (!pokemon) return reply("Pokémon not found.");
    if (pokemon.hp <= 0) return reply("Heal your Pokémon first.");

    const species = getRandomPokemon();

    const opponent = createPokemon(
      species,
      Math.max(3, pokemon.level + Math.floor(Math.random() * 5) - 2)
    );

    const chart = {
      Fire: { Grass: 2, Water: 0.5, Bug: 2, Ice: 2 },
      Water: { Fire: 2, Ground: 2, Rock: 2, Grass: 0.5 },
      Grass: { Water: 2, Ground: 2, Rock: 2, Fire: 0.5 },
      Electric: { Water: 2, Flying: 2, Ground: 0 },
      Ground: { Electric: 2, Fire: 2, Rock: 2 },
      Rock: { Flying: 2, Fire: 2, Bug: 2 },
      Psychic: { Poison: 2, Fighting: 2 },
      Ghost: { Psychic: 2, Ghost: 2 }
    };

    function effectiveness(attacker, defender) {
      let result = 1;
      const type = attacker.type[0];

      for (const defenseType of defender.type) {
        if (
          chart[type] &&
          chart[type][defenseType] !== undefined
        ) {
          result *= chart[type][defenseType];
        }
      }

      return result;
    }

    function damage(attacker, defender) {
      const base = Math.max(
        1,
        attacker.attack - Math.floor(defender.defense / 3)
      );

      return Math.max(
        1,
        Math.floor(base * effectiveness(attacker, defender))
      );
    }

    let myHP = pokemon.hp;
    let enemyHP = opponent.hp;
    let rounds = 0;
    const battleLog = [];

    while (myHP > 0 && enemyHP > 0 && rounds < 30) {
      rounds++;

      const myDamage = damage(pokemon, opponent);
      enemyHP = Math.max(0, enemyHP - myDamage);

      battleLog.push(
        `${pokemon.name} dealt ${myDamage} damage!`
      );

      if (enemyHP <= 0) break;

      const enemyDamage = damage(opponent, pokemon);
      myHP = Math.max(0, myHP - enemyDamage);

      battleLog.push(
        `${opponent.name} dealt ${enemyDamage} damage!`
      );
    }

    pokemon.hp = myHP;

    const won = enemyHP <= 0;

    let result;

    if (won) {
      const reward = 50 + opponent.level * 5;

      player.coins += reward;
      player.xp += 30;
      player.wins++;

      result = `🏆 VICTORY!\n+${reward} Coins\n+30 XP`;
    } else {
      player.losses++;
      result = "❌ Battle lost!";
    }

    pokemon.recovery = recoveryCode();
    saveProgress(player);

    return sendPokemonImage(
      api,
      threadID,
      `⚔️ BATTLE RESULT\n\n` +
      `${pokemon.name} VS ${opponent.name}\n` +
      `Your HP: ${pokemon.hp}/${pokemon.maxHp}\n` +
      `Enemy HP: ${enemyHP}/${opponent.maxHp}\n\n` +
      `${result}\n\n` +
      `UID: ${pokemon.uid}\nRecovery: ${pokemon.recovery}\n` +
      `Trainer Recovery: ${player.recovery}`,
      pokemon,
      messageID
    );
  }

  // ==========================================
  // GYMS
  // ==========================================

  if (command === "gym") {
    if (!args[1] || args[1] === "list") {
      return reply(
        "🏅 POKÉMON GYMS\n\n" +
        GYMS.map((g, i) =>
          `${i + 1}. ${g.name}\nLeader: ${g.leader}\n` +
          `Type: ${g.type}\nBadge: ${g.badge}\nRequired Lv: ${g.level}`
        ).join("\n\n") +
        "\n\nChallenge: p gym 1"
      );
    }

    const gym = GYMS[Number(args[1]) - 1];

    if (!gym) return reply("Invalid gym number.");

    if (player.badges.includes(gym.badge)) {
      return reply("You already have this badge!");
    }

    const index = Number(args[2] || 1) - 1;
    const pokemon = player.pokemon[index];

    if (!pokemon) return reply("Pokémon not found.");

    if (pokemon.level < gym.level) {
      return reply(`You need a level ${gym.level} Pokémon.`);
    }

    if (pokemon.hp <= 0) {
      return reply("Heal your Pokémon first.");
    }

    const enemyPower = gym.level * 5 + 20;
    const myPower = pokemon.attack + pokemon.level * 2;
    const won = myPower >= enemyPower;

    if (!won) {
      pokemon.hp = Math.max(0, pokemon.hp - 20);
      player.losses++;
      saveProgress(player);

      return reply(
        `❌ ${gym.leader} defeated you!\n` +
        `${pokemon.name} HP: ${pokemon.hp}/${pokemon.maxHp}`
      );
    }

    player.badges.push(gym.badge);
    player.coins += 250;
    player.xp += 100;
    player.wins++;

    player.recovery = recoveryCode();
    saveDB();

    return sendPokemonImage(
      api,
      threadID,
      `🏆 GYM VICTORY!\n\n` +
      `Leader: ${gym.leader}\nGym: ${gym.name}\n` +
      `🏅 ${gym.badge}\n+250 Coins\n+100 XP\n\n` +
      `UID: ${pokemon.uid}\nRecovery: ${player.recovery}`,
      pokemon,
      messageID
    );
  }

  // ==========================================
  // SHOP
  // ==========================================

  const SHOP = {
    pokeball: 100,
    greatball: 300,
    ultraball: 700,
    potion: 150,
    revive: 500
  };

  if (command === "shop") {
    return reply(
      "🏪 POKÉMON SHOP\n\n" +
      Object.entries(SHOP)
        .map(([name, price]) => `${name}: ${price} coins`)
        .join("\n") +
      "\n\nBuy: p buy pokeball 5"
    );
  }

  if (command === "buy") {
    const item = String(args[1] || "").toLowerCase();
    const amount = Math.floor(Number(args[2] || 1));

    if (!SHOP[item] || !Number.isSafeInteger(amount) ||
        amount < 1 || amount > 99) {
      return reply("Invalid item or quantity.");
    }

    const cost = SHOP[item] * amount;

    if (player.coins < cost) {
      return reply("Not enough coins!");
    }

    player.coins -= cost;
    player.inventory[item] =
      (player.inventory[item] || 0) + amount;

    saveProgress(player);

    return reply(
      `✅ PURCHASE SUCCESSFUL!\n\n` +
      `Item: ${item}\nQuantity: ${amount}\n` +
      `Cost: ${cost}\nBalance: ${player.coins}\n` +
      `Recovery: ${player.recovery}`
    );
  }

  if (command === "bag" || command === "inventory") {
    return reply(
      "🎒 INVENTORY\n\n" +
      Object.entries(player.inventory)
        .map(([name, amount]) => `${name}: ${amount}`)
        .join("\n") +
      `\n\nCoins: ${player.coins}`
    );
  }

  // ==========================================
  // BADGES
  // ==========================================

  if (command === "badges") {
    return reply(
      "🏅 YOUR BADGES\n\n" +
      (player.badges.length
        ? player.badges.join("\n")
        : "No badges earned yet.") +
      `\n\nTotal: ${player.badges.length}/8`
    );
  }

  // ==========================================
  // TEAM MANAGEMENT
  // ==========================================

  if (command === "setteam") {
    const index = Number(args[1]) - 1;
    const pokemon = player.pokemon[index];

    if (!pokemon) return reply("Invalid Pokémon number.");

    if (player.team.includes(pokemon.uid)) {
      return reply("Already in your team.");
    }

    if (player.team.length >= CONFIG.MAX_TEAM) {
      return reply("Your team is full (6 Pokémon).");
    }

    player.team.push(pokemon.uid);
    saveDB();

    return reply(`${pokemon.name} joined your battle team!`);
  }

  if (command === "removeteam") {
    const index = Number(args[1]) - 1;

    if (!Number.isInteger(index) ||
        index < 0 || index >= player.team.length) {
      return reply("Invalid team position.");
    }

    const removed = player.team.splice(index, 1)[0];

    saveDB();

    return reply(`Removed Pokémon UID: ${removed}`);
  }

  // ==========================================
  // RANDOM TRAINERS
  // ==========================================

  if (command === "trainer") {
    const trainers = [
      "Youngster Joey",
      "Bug Catcher Sam",
      "Lass Anna",
      "Super Nerd Mark",
      "Pokémon Ranger",
      "Ace Trainer",
      "Collector James"
    ];

    const pokemon = player.pokemon.find(
      p => player.team.includes(p.uid) && p.hp > 0
    );

    if (!pokemon) {
      return reply("You need a healthy team Pokémon.");
    }

    const trainer = trainers[
      Math.floor(Math.random() * trainers.length)
    ];

    const species = getRandomPokemon();
    const enemy = createPokemon(
      species,
      5 + Math.floor(Math.random() * 15)
    );

    const won =
      pokemon.attack + pokemon.level * 2 >=
      enemy.attack + enemy.level * 2;

    if (won) {
      const reward = 100 + enemy.level * 10;
      player.coins += reward;
      player.xp += 50;
      player.wins++;
    } else {
      pokemon.hp = Math.max(0, pokemon.hp - 15);
      player.losses++;
    }

    saveProgress(player);

    return sendPokemonImage(
      api,
      threadID,
      `🎒 TRAINER BATTLE!\n\n` +
      `Trainer: ${trainer}\n` +
      `${pokemon.name} VS ${enemy.name}\n\n` +
      (won
        ? `🏆 VICTORY!\n+${100 + enemy.level * 10} Coins\n+50 XP`
        : `❌ DEFEAT!\n${pokemon.name} lost 15 HP.`) +
      `\n\nRecovery: ${player.recovery}`,
      pokemon,
      messageID
    );
  }

  // ==========================================
  // FRIEND CHALLENGES
  // ==========================================

  if (command === "challenge") {
    const targetID = Object.keys(event.mentions || {})[0];

    if (!targetID) {
      return reply("Mention a friend: p challenge @friend");
    }

    if (targetID === senderID) {
      return reply("You cannot challenge yourself!");
    }

    if (DB.battles[targetID]) {
      return reply("This player already has a pending challenge.");
    }

    const opponent = DB.players[targetID];

    if (!opponent || !opponent.started) {
      return reply("Your friend must start Pokémon World first.");
    }

    const healthy = p => p.pokemon.some(
      x => p.team.includes(x.uid) && x.hp > 0
    );

    if (!healthy(player) || !healthy(opponent)) {
      return reply("Both trainers need a healthy team Pokémon.");
    }

    const code = uid();

    DB.battles[targetID] = {
      code,
      from: senderID,
      to: targetID,
      threadID,
      created: Date.now()
    };

    saveDB();

    return reply(
      `⚔️ BATTLE CHALLENGE SENT!\n\n` +
      `Battle Code: ${code}\n` +
      `Your friend can type: p accept`
    );
  }

  if (command === "accept") {
    const challenge = DB.battles[senderID];

    if (!challenge) {
      return reply("No pending battle challenge.");
    }

    if (Date.now() - challenge.created > 300000) {
      delete DB.battles[senderID];
      saveDB();
      return reply("Challenge expired.");
    }

    const challenger = DB.players[challenge.from];

    if (!challenger) {
      delete DB.battles[senderID];
      saveDB();
      return reply("Challenger not found.");
    }

    const first = challenger.pokemon.find(
      p => challenger.team.includes(p.uid) && p.hp > 0
    );

    const second = player.pokemon.find(
      p => player.team.includes(p.uid) && p.hp > 0
    );

    if (!first || !second) {
      return reply("Both players need healthy Pokémon.");
    }

    const firstPower = first.attack + first.level * 3;
    const secondPower = second.attack + second.level * 3;

    let result;

    if (firstPower === secondPower) {
      result = "🤝 DRAW!";
    } else if (firstPower > secondPower) {
      result = "🏆 CHALLENGER WINS!";
      challenger.wins++;
      challenger.coins += 200;
      player.losses++;
    } else {
      result = "🏆 DEFENDER WINS!";
      player.wins++;
      player.coins += 200;
      challenger.losses++;
    }

    challenger.recovery = recoveryCode();
    player.recovery = recoveryCode();

    delete DB.battles[senderID];
    saveDB();

    const report =
      `⚔️ FRIEND BATTLE RESULT\n\n` +
      `${first.name} VS ${second.name}\n\n` +
      `${result}\n\n` +
      `Challenger Recovery: ${challenger.recovery}\n` +
      `Defender Recovery: ${player.recovery}`;

    api.sendMessage(report, challenge.threadID);
    return reply(report);
  }

  if (command === "decline") {
    if (!DB.battles[senderID]) {
      return reply("No pending challenge.");
    }

    delete DB.battles[senderID];
    saveDB();

    return reply("Battle challenge declined.");
  }

  // ==========================================
  // RECOVERY AND BACKUP
  // ==========================================

  if (command === "recovery") {
    return reply(
      "🔐 TRAINER RECOVERY\n\n" +
      `Trainer ID: ${senderID}\n` +
      `Recovery Code: ${player.recovery}\n\n` +
      "Use p export to save your complete trainer data."
    );
  }

  if (command === "backup") {
    if (!saveDB()) {
      return reply("❌ Backup failed.");
    }

    return reply("✅ Pokémon World database backup saved.");
  }

  if (command === "export") {
    const snapshot = {
      version: 2,
      player: JSON.parse(JSON.stringify(player)),
      exportedAt: Date.now()
    };

    const encoded = Buffer.from(
      JSON.stringify(snapshot)
    ).toString("base64");

    return reply(
      "🔐 YOUR TRAINER BACKUP\n\n" +
      "Save this entire code safely:\n\n" +
      encoded
    );
  }

  if (command === "restore") {
    const encoded = args[1];

    if (!encoded || encoded.length > 500000) {
      return reply("Provide a valid backup code.");
    }

    try {
      const snapshot = JSON.parse(
        Buffer.from(encoded, "base64").toString("utf8")
      );

      const restored = snapshot.player;

      if (
        snapshot.version !== 2 ||
        !restored ||
        !Array.isArray(restored.pokemon) ||
        !Array.isArray(restored.team) ||
        !Array.isArray(restored.badges) ||
        !Array.isArray(restored.pokedex) ||
        !restored.inventory ||
        !Number.isSafeInteger(restored.coins) ||
        restored.coins < 0 ||
        restored.pokemon.length > CONFIG.MAX_STORAGE ||
        restored.team.length > CONFIG.MAX_TEAM
      ) {
        return reply("Invalid or damaged backup.");
      }

      const validPokemon = restored.pokemon.every(p =>
        p &&
        typeof p.uid === "string" &&
        typeof p.name === "string" &&
        Number.isInteger(p.level) &&
        p.level >= 1 &&
        p.level <= CONFIG.MAX_LEVEL &&
        Number.isInteger(p.hp) &&
        Number.isInteger(p.maxHp) &&
        p.hp >= 0 &&
        p.hp <= p.maxHp &&
        Array.isArray(p.type)
      );

      if (!validPokemon) {
        return reply("Backup contains invalid Pokémon data.");
      }

      const validUIDs = new Set(
        restored.pokemon.map(p => p.uid)
      );

      if (
        restored.team.some(id => !validUIDs.has(id)) ||
        new Set(restored.pokemon.map(p => p.uid)).size !==
        restored.pokemon.length
      ) {
        return reply("Backup has invalid or duplicate Pokémon UIDs.");
      }

      const oldPlayer = DB.players[senderID];

      // Do not allow another trainer to claim a unique Pokémon.
      for (const pokemon of restored.pokemon) {
        const species = SPECIES.find(
          s => s.id === pokemon.speciesId && s.unique
        );

        if (!species) continue;

        const owner = DB.uniquePokemon[species.id];

        if (
          owner &&
          owner.owner !== senderID &&
          (!oldPlayer || !oldPlayer.pokemon.some(
            p => p.uid === owner.pokemonUID
          ))
        ) {
          return reply(
            `${pokemon.name} is already registered to another trainer.`
          );
        }
      }

      restored.id = senderID;
      restored.recovery = recoveryCode();

      DB.players[senderID] = restored;

      // Rebuild unique Pokémon ownership for this trainer.
      for (const pokemon of restored.pokemon) {
        const species = SPECIES.find(
          s => s.id === pokemon.speciesId && s.unique
        );

        if (species) {
          DB.uniquePokemon[species.id] = {
            owner: senderID,
            pokemonUID: pokemon.uid
          };
        }
      }

      saveDB();

      return reply(
        "✅ TRAINER RESTORED!\n\n" +
        `Pokémon: ${restored.pokemon.length}\n` +
        `Coins: ${restored.coins}\n` +
        `Level: ${restored.level}\n` +
        `Badges: ${restored.badges.length}\n` +
        `New Recovery: ${restored.recovery}`
      );

    } catch (error) {
      console.error("[POKEMONU RESTORE]", error);
      return reply("❌ Invalid backup code.");
    }
  }

  return reply(
    "Unknown Pokémon command!\nType p help."
  );
};
