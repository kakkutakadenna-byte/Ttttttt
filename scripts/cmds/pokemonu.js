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
  PREFIX: "p",
  MAX_TEAM: 6,
  STARTER_COINS: 1000,
  MAX_LEVEL: 100,
  HUNT_COOLDOWN: 60000,
  CATCH_COOLDOWN: 3000
};

const STARTERS = [
  { id: 1, name: "Bulbasaur", type: ["Grass", "Poison"] },
  { id: 4, name: "Charmander", type: ["Fire"] },
  { id: 7, name: "Squirtle", type: ["Water"] }
];

const SPECIES = [
  { id: 10, name: "Caterpie", type: ["Bug"], rarity: "Common" },
  { id: 16, name: "Pidgey", type: ["Normal", "Flying"], rarity: "Common" },
  { id: 25, name: "Pikachu", type: ["Electric"], rarity: "Rare" },
  { id: 37, name: "Vulpix", type: ["Fire"], rarity: "Rare" },
  { id: 39, name: "Jigglypuff", type: ["Normal", "Fairy"], rarity: "Rare" },
  { id: 52, name: "Meowth", type: ["Normal"], rarity: "Common" },
  { id: 58, name: "Growlithe", type: ["Fire"], rarity: "Rare" },
  { id: 74, name: "Geodude", type: ["Rock", "Ground"], rarity: "Common" },
  { id: 92, name: "Gastly", type: ["Ghost", "Poison"], rarity: "Rare" },
  { id: 133, name: "Eevee", type: ["Normal"], rarity: "Rare" },
  { id: 147, name: "Dratini", type: ["Dragon"], rarity: "Epic" },
  { id: 150, name: "Mewtwo", type: ["Psychic"], rarity: "Legendary", unique: true },
  { id: 151, name: "Mew", type: ["Psychic"], rarity: "Mythical", unique: true },
  { id: 249, name: "Lugia", type: ["Psychic", "Flying"], rarity: "Legendary", unique: true },
  { id: 250, name: "Ho-Oh", type: ["Fire", "Flying"], rarity: "Legendary", unique: true },
  { id: 384, name: "Rayquaza", type: ["Dragon", "Flying"], rarity: "Legendary", unique: true },
  { id: 487, name: "Giratina", type: ["Ghost", "Dragon"], rarity: "Legendary", unique: true },
  { id: 493, name: "Arceus", type: ["Normal"], rarity: "Mythical", unique: true }
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
  return "REC-" + crypto.randomBytes(8).toString("hex").toUpperCase();
}

function defaultDB() {
  return {
    version: 1,
    players: {},
    uniquePokemon: {},
    battles: {},
    events: {},
    lastBackup: Date.now()
  };
}

function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const db = defaultDB();
      saveDB(db);
      return db;
    }

    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

    db.players ||= {};
    db.uniquePokemon ||= {};
    db.battles ||= {};
    db.events ||= {};

    return db;
  } catch (error) {
    console.error("[POKEMONU] Database error:", error);

    if (fs.existsSync(BACKUP_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(BACKUP_FILE, "utf8"));
      } catch (_) {}
    }

    return defaultDB();
  }
}

let DB = loadDB();

function saveDB() {
  const temp = DB_FILE + ".tmp";

  fs.writeFileSync(temp, JSON.stringify(DB, null, 2));
  fs.renameSync(temp, DB_FILE);

  try {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(DB, null, 2));
  } catch (error) {
    console.error("[POKEMONU] Backup error:", error);
  }
}

function getPlayer(id) {
  if (!DB.players[id]) {
    DB.players[id] = {
      id,
      started: false,
      coins: CONFIG.STARTER_COINS,
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

  return DB.players[id];
}

function createPokemon(species, level = 5) {
  return {
    uid: uid(),
    speciesId: species.id,
    name: species.name,
    type: [...species.type],
    rarity: species.rarity || "Common",
    level,
    xp: 0,
    hp: 20 + level * 5,
    maxHp: 20 + level * 5,
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

  https.get(url, response => {
    if (response.statusCode !== 200) {
      response.resume();
      return api.sendMessage(message, threadID, null, replyID);
    }

    api.sendMessage({
      body: message,
      attachment: response
    }, threadID, null, replyID);
  }).on("error", () => {
    api.sendMessage(message, threadID, null, replyID);
  });
}

function getRandomPokemon() {
  const roll = Math.random() * 100;

  let pool;

  if (roll < 1) {
    pool = SPECIES.filter(p => p.rarity === "Mythical");
  } else if (roll < 3) {
    pool = SPECIES.filter(p => p.rarity === "Legendary");
  } else if (roll < 12) {
    pool = SPECIES.filter(p => p.rarity === "Epic");
  } else if (roll < 35) {
    pool = SPECIES.filter(p => p.rarity === "Rare");
  } else {
    pool = SPECIES.filter(p => p.rarity === "Common");
  }

  if (!pool.length) pool = SPECIES;

  return pool[Math.floor(Math.random() * pool.length)];
}

function playerHasUnique(species) {
  return !!DB.uniquePokemon[species.id];
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
  version: "1.0.0",
  author: "Si Fat",
  role: 0,
  category: "games",
  shortDescription: "Pokémon World RPG",
  longDescription: "Pokémon adventure, catching, training and battles.",
  guide: "{pn} start | hunt | catch | profile | team | dex"
};

module.exports.onStart = async function ({
  api,
  event,
  args
}) {
  const { senderID, threadID, messageID } = event;

  const command = (args[0] || "help").toLowerCase();
  const player = getPlayer(senderID);

  const reply = message => {
    return api.sendMessage(message, threadID, null, messageID);
  };

  // HELP
  if (command === "help") {
    return reply(
      "🎮 POKÉMON WORLD ULTIMATE\n" +
      "━━━━━━━━━━━━━━━━━━\n" +
      "p start - Start your journey\n" +
      "p starter - Choose starter\n" +
      "p profile - Trainer profile\n" +
      "p hunt - Find wild Pokémon\n" +
      "p catch - Catch encountered Pokémon\n" +
      "p team - View your team\n" +
      "p dex - Pokédex\n" +
      "p heal - Heal your Pokémon\n" +
      "p train - Train Pokémon\n" +
      "p gym - Challenge a gym\n" +
      "p recovery - Show recovery code\n" +
      "p backup - Create backup\n" +
      "━━━━━━━━━━━━━━━━━━"
    );
  }

  // START
  if (command === "start") {
    if (player.started) {
      return reply("You already started your Pokémon journey!");
    }

    player.started = true;
    player.recovery = recoveryCode();

    saveDB();

    return reply(
      "🌍 WELCOME TO THE POKÉMON WORLD!\n\n" +
      "Your adventure begins now.\n\n" +
      "Choose your starter:\n" +
      "p starter bulbasaur\n" +
      "p starter charmander\n" +
      "p starter squirtle\n\n" +
      `🔐 Recovery Code: ${player.recovery}`
    );
  }

  if (!player.started && command !== "start") {
    return reply("Start your journey first! Type: p start");
  }

  // STARTER
  if (command === "starter") {
    if (player.pokemon.length) {
      return reply("You already have a Pokémon starter!");
    }

    const choice = (args[1] || "").toLowerCase();
    const species = STARTERS.find(p => p.name.toLowerCase() === choice);

    if (!species) {
      return reply("Choose: bulbasaur, charmander or squirtle.");
    }

    const pokemon = createPokemon(species, 5);

    player.pokemon.push(pokemon);
    player.team.push(pokemon.uid);
    player.pokedex.push(species.id);

    player.recovery = recoveryCode();
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
      `Recovery Code: ${player.recovery}\n\n` +
      "Your Pokémon journey begins!",
      pokemon,
      messageID
    );
  }

  // PROFILE
  if (command === "profile") {
    return reply(makePlayerMessage(player));
  }

  // HUNT
  if (command === "hunt") {
    if (Date.now() - player.huntTime < CONFIG.HUNT_COOLDOWN) {
      return reply("⏳ Your next hunt is not ready yet!");
    }

    if (!player.pokemon.length) {
      return reply("Choose a starter first!");
    }

    player.huntTime = Date.now();

    const species = getRandomPokemon();

    if (species.unique && playerHasUnique(species)) {
      saveDB();
      return reply("🌲 You explored the area, but found nothing this time!");
    }

    DB.events[senderID] = {
      species,
      expires: Date.now() + 120000
    };

    saveDB();

    const wild = createPokemon(species, 3 + Math.floor(Math.random() * 12));

    DB.events[senderID].wild = wild;

    saveDB();

    return sendPokemonImage(
      api,
      threadID,
      `🌲 WILD POKÉMON APPEARED!\n\n` +
      `Name: ${wild.name}\n` +
      `Type: ${wild.type.join("/")}\n` +
      `Level: ${wild.level}\n` +
      `Rarity: ${wild.rarity}\n\n` +
      "Use p catch to try catching it!\n" +
      "The encounter expires in 2 minutes.",
      wild,
      messageID
    );
  }

  // CATCH
  if (command === "catch") {
    const encounter = DB.events[senderID];

    if (!encounter || encounter.expires < Date.now()) {
      delete DB.events[senderID];
      saveDB();
      return reply("❌ No active wild Pokémon! Use p hunt first.");
    }

    if (player.pokemon.length >= 200) {
      return reply("Your Pokémon storage is full!");
    }

    if (Date.now() - player.catchTime < CONFIG.CATCH_COOLDOWN) {
      return reply("Please wait before trying again.");
    }

    player.catchTime = Date.now();

    const wild = encounter.wild;
    const species = encounter.species;

    if (species.unique && playerHasUnique(species)) {
      delete DB.events[senderID];
      saveDB();
      return reply("This unique Pokémon has already been caught!");
    }

    const ball = player.inventory.pokeball > 0
      ? "pokeball"
      : player.inventory.greatball > 0
        ? "greatball"
        : player.inventory.ultraball > 0
          ? "ultraball"
          : null;

    if (!ball) {
      return reply("You have no Poké Balls! Visit the shop in a future update.");
    }

    player.inventory[ball]--;

    const chance = {
      Common: 75,
      Rare: 55,
      Epic: 35,
      Legendary: 15,
      Mythical: 10
    };

    const success = Math.random() * 100 < (chance[wild.rarity] || 50);

    if (!success) {
      delete DB.events[senderID];
      saveDB();
      return reply(`💨 ${wild.name} escaped! Your ${ball} was used.`);
    }

    wild.recovery = recoveryCode();

    player.pokemon.push(wild);

    if (player.team.length < CONFIG.MAX_TEAM) {
      player.team.push(wild.uid);
    }

    if (!player.pokedex.includes(wild.speciesId)) {
      player.pokedex.push(wild.speciesId);
    }

    if (species.unique) {
      DB.uniquePokemon[species.id] = {
        owner: senderID,
        pokemonUID: wild.uid
      };
    }

    player.recovery = recoveryCode();

    delete DB.events[senderID];

    saveDB();

    return sendPokemonImage(
      api,
      threadID,
      `🎉 POKÉMON CAUGHT!\n\n` +
      `Name: ${wild.name}\n` +
      `Level: ${wild.level}\n` +
      `Rarity: ${wild.rarity}\n` +
      `UID: ${wild.uid}\n` +
      `Pokémon Recovery: ${wild.recovery}\n` +
      `Trainer Recovery: ${player.recovery}\n\n` +
      "Your new Pokémon has been saved!",
      wild,
      messageID
    );
  }

  // TEAM
  if (command === "team") {
    if (!player.pokemon.length) {
      return reply("Your team is empty!");
    }

    const list = player.team.map((id, index) => {
      const p = player.pokemon.find(x => x.uid === id);
      return p
        ? `${index + 1}. ${p.name} Lv.${p.level} ❤️${p.hp}/${p.maxHp}\nUID: ${p.uid}`
        : null;
    }).filter(Boolean);

    return reply("⚔️ YOUR POKÉMON TEAM\n\n" + list.join("\n\n"));
  }

  // POKEDEX
  if (command === "dex") {
    const list = player.pokedex.map(id => {
      const p = SPECIES.find(x => x.id === id);
      return p ? `#${id} ${p.name}` : null;
    }).filter(Boolean);

    return reply(
      `📖 POKÉDEX\n\nDiscovered: ${list.length}\n\n` +
      (list.join("\n") || "No Pokémon discovered.")
    );
  }

  // RECOVERY
  if (command === "recovery") {
    return reply(
      "🔐 TRAINER RECOVERY INFORMATION\n\n" +
      `Trainer ID: ${senderID}\n` +
      `Recovery Code: ${player.recovery}\n\n` +
      "Keep this code safe. It is needed to restore your trainer."
    );
  }

  // BACKUP
  if (command === "backup") {
    try {
      fs.writeFileSync(
        BACKUP_FILE,
        JSON.stringify(DB, null, 2)
      );

      return reply("✅ Pokémon World database backup created!");
    } catch (error) {
      console.error(error);
      return reply("❌ Backup failed.");
    }
  }

  return reply("Unknown Pokémon command. Type p help.");
};

  // ==========================================
  // PART 2: TRAINING, EVOLUTION, HEALING
  // ==========================================

  if (command === "train") {
    const index = Number(args[1] || 1) - 1;
    const pokemon = player.pokemon[index];

    if (!pokemon) return reply("❌ Pokémon not found.");

    if (pokemon.hp <= 0) {
      return reply("Your Pokémon needs healing first!");
    }

    const gained = 20 + Math.floor(Math.random() * 31);
    pokemon.xp += gained;

    let message = `🏋️ TRAINING COMPLETE!\n\n${pokemon.name}\n+${gained} XP`;

    const needed = pokemon.level * 50;

    if (pokemon.xp >= needed && pokemon.level < CONFIG.MAX_LEVEL) {
      pokemon.xp -= needed;
      pokemon.level++;
      pokemon.maxHp += 5;
      pokemon.hp = Math.min(pokemon.maxHp, pokemon.hp + 5);
      pokemon.attack += 2;
      pokemon.defense += 1;
      pokemon.recovery = recoveryCode();
      player.recovery = recoveryCode();

      message +=
        `\n\n⭐ LEVEL UP!\nNew Level: ${pokemon.level}` +
        `\nNew UID: ${pokemon.uid}` +
        `\nPokémon Recovery: ${pokemon.recovery}` +
        `\nTrainer Recovery: ${player.recovery}`;
    }

    saveDB();

    return sendPokemonImage(
      api, threadID, message, pokemon, messageID
    );
  }

  // HEAL
  if (command === "heal") {
    const index = Number(args[1] || 1) - 1;
    const pokemon = player.pokemon[index];

    if (!pokemon) return reply("❌ Pokémon not found.");

    if (player.inventory.potion <= 0) {
      return reply("❌ You have no Potions!");
    }

    player.inventory.potion--;

    pokemon.hp = pokemon.maxHp;

    pokemon.recovery = recoveryCode();
    player.recovery = recoveryCode();

    saveDB();

    return sendPokemonImage(
      api,
      threadID,
      `💚 HEALING COMPLETE!\n\n${pokemon.name}\nHP: ${pokemon.hp}/${pokemon.maxHp}\nUID: ${pokemon.uid}\nRecovery: ${pokemon.recovery}`,
      pokemon,
      messageID
    );
  }

  // EVOLUTION
  if (command === "evolve") {
    const index = Number(args[1] || 1) - 1;
    const pokemon = player.pokemon[index];

    if (!pokemon) return reply("❌ Pokémon not found.");

    const evolutions = {
      "Bulbasaur": { id: 2, name: "Ivysaur", type: ["Grass", "Poison"] },
      "Ivysaur": { id: 3, name: "Venusaur", type: ["Grass", "Poison"] },
      "Charmander": { id: 5, name: "Charmeleon", type: ["Fire"] },
      "Charmeleon": { id: 6, name: "Charizard", type: ["Fire", "Flying"] },
      "Squirtle": { id: 8, name: "Wartortle", type: ["Water"] },
      "Wartortle": { id: 9, name: "Blastoise", type: ["Water"] },
      "Caterpie": { id: 11, name: "Metapod", type: ["Bug"] },
      "Metapod": { id: 12, name: "Butterfree", type: ["Bug", "Flying"] },
      "Pidgey": { id: 17, name: "Pidgeotto", type: ["Normal", "Flying"] },
      "Pidgeotto": { id: 18, name: "Pidgeot", type: ["Normal", "Flying"] },
      "Pikachu": { id: 26, name: "Raichu", type: ["Electric"] },
      "Vulpix": { id: 38, name: "Ninetales", type: ["Fire"] },
      "Geodude": { id: 75, name: "Graveler", type: ["Rock", "Ground"] },
      "Graveler": { id: 76, name: "Golem", type: ["Rock", "Ground"] },
      "Gastly": { id: 93, name: "Haunter", type: ["Ghost", "Poison"] },
      "Haunter": { id: 94, name: "Gengar", type: ["Ghost", "Poison"] },
      "Dratini": { id: 148, name: "Dragonair", type: ["Dragon"] },
      "Dragonair": { id: 149, name: "Dragonite", type: ["Dragon", "Flying"] }
    };

    const next = evolutions[pokemon.name];

    if (!next) {
      return reply("This Pokémon has no evolution available in this evolution table.");
    }

    if (pokemon.level < 16) {
      return reply("Your Pokémon needs to reach level 16 first!");
    }

    const oldName = pokemon.name;
    const oldUID = pokemon.uid;

    pokemon.name = next.name;
    pokemon.speciesId = next.id;
    pokemon.type = next.type;

    pokemon.uid = uid();
    pokemon.recovery = recoveryCode();

    pokemon.level += 1;
    pokemon.maxHp += 20;
    pokemon.hp = pokemon.maxHp;
    pokemon.attack += 10;
    pokemon.defense += 5;

    player.pokedex.push(next.id);
    player.pokedex = [...new Set(player.pokedex)];

    player.recovery = recoveryCode();

    saveDB();

    return sendPokemonImage(
      api,
      threadID,
      `✨ EVOLUTION COMPLETE!\n\n${oldName} → ${pokemon.name}\n\nOld UID: ${oldUID}\nNew UID: ${pokemon.uid}\nLevel: ${pokemon.level}\nHP: ${pokemon.hp}/${pokemon.maxHp}\nRecovery: ${pokemon.recovery}\nTrainer Recovery: ${player.recovery}`,
      pokemon,
      messageID
    );
  }

  // ==========================================
  // POKÉMON BATTLE ENGINE
  // ==========================================

  if (command === "battle") {
    const index = Number(args[1] || 1) - 1;
    const pokemon = player.pokemon[index];

    if (!pokemon) return reply("❌ Pokémon not found.");

    if (pokemon.hp <= 0) {
      return reply("Your Pokémon has fainted. Use p heal first.");
    }

    const opponentSpecies = getRandomPokemon();
    const opponent = createPokemon(
      opponentSpecies,
      Math.max(3, pokemon.level + Math.floor(Math.random() * 5) - 2)
    );

    let playerHP = pokemon.hp;
    let opponentHP = opponent.maxHp;

    const typeChart = {
      Fire: { Grass: 2, Water: 0.5 },
      Water: { Fire: 2, Grass: 0.5 },
      Grass: { Water: 2, Fire: 0.5 },
      Electric: { Water: 2, Ground: 0 },
      Ground: { Electric: 2, Fire: 2 },
      Rock: { Flying: 2, Fire: 2 }
    };

    const multiplier = (attacker, defender) => {
      let result = 1;
      const attackType = attacker.type[0];

      for (const type of defender.type) {
        if (typeChart[attackType] &&
            typeChart[attackType][type] !== undefined) {
          result *= typeChart[attackType][type];
        }
      }

      return result;
    };

    const attackDamage = (attacker, defender) => {
      const effectiveness = multiplier(attacker, defender);
      return Math.max(
        1,
        Math.floor(
          (attacker.attack * 0.7 - defender.defense * 0.25) *
          effectiveness
        )
      );
    };

    let rounds = 0;

    while (playerHP > 0 && opponentHP > 0 && rounds < 30) {
      rounds++;

      opponentHP -= attackDamage(pokemon, opponent);

      if (opponentHP <= 0) break;

      playerHP -= attackDamage(opponent, pokemon);
    }

    pokemon.hp = Math.max(0, playerHP);

    const won = opponentHP <= 0 && pokemon.hp > 0;

    let result;

    if (won) {
      const reward = 50 + opponent.level * 5;

      player.coins += reward;
      player.xp += 30;
      player.wins++;

      result =
        `🏆 VICTORY!\n+${reward} Coins\n+30 XP`;
    } else {
      player.losses++;
      result = "❌ Battle lost! Train and try again.";
    }

    pokemon.recovery = recoveryCode();
    player.recovery = recoveryCode();

    saveDB();

    return sendPokemonImage(
      api,
      threadID,
      `⚔️ POKÉMON BATTLE RESULT\n━━━━━━━━━━━━━━━━━━\n` +
      `${pokemon.name} vs ${opponent.name}\n` +
      `Your HP: ${pokemon.hp}/${pokemon.maxHp}\n` +
      `Opponent HP: ${Math.max(0, opponentHP)}/${opponent.maxHp}\n` +
      `Rounds: ${rounds}\n\n${result}\n\n` +
      `UID: ${pokemon.uid}\nRecovery: ${pokemon.recovery}\nTrainer Recovery: ${player.recovery}`,
      pokemon,
      messageID
    );
  }

  // ==========================================
  // GYM SYSTEM
  // ==========================================

  if (command === "gym") {
    if (args[1] === "list" || !args[1]) {
      return reply(
        "🏅 POKÉMON GYMS\n\n" +
        GYMS.map((g, i) =>
          `${i + 1}. ${g.name}\nLeader: ${g.leader}\nType: ${g.type}\nBadge: ${g.badge}`
        ).join("\n\n") +
        "\n\nUse: p gym 1"
      );
    }

    const gymIndex = Number(args[1]) - 1;
    const gym = GYMS[gymIndex];

    if (!gym) return reply("Invalid gym number.");

    if (player.badges.includes(gym.badge)) {
      return reply("You already own this gym badge!");
    }

    const index = Number(args[2] || 1) - 1;
    const pokemon = player.pokemon[index];

    if (!pokemon) return reply("Choose a valid Pokémon.");

    if (pokemon.level < gym.level) {
      return reply(`Your Pokémon needs level ${gym.level} to challenge this gym.`);
    }

    if (pokemon.hp <= 0) {
      return reply("Heal your Pokémon before challenging this gym.");
    }

    const leaderPower = gym.level * 5 + 20;
    const damage = Math.max(1, pokemon.attack - leaderPower * 0.25);

    const won = damage * 5 > leaderPower * 3;

    if (!won) {
      pokemon.hp = Math.max(0, pokemon.hp - 20);
      player.losses++;
      saveDB();

      return reply(
        `❌ ${gym.leader} defeated you!\n` +
        `Your ${pokemon.name} needs more training.\n` +
        `HP: ${pokemon.hp}/${pokemon.maxHp}`
      );
    }

    player.badges.push(gym.badge);
    player.coins += 250;
    player.xp += 100;
    player.wins++;

    pokemon.recovery = recoveryCode();
    player.recovery = recoveryCode();

    saveDB();

    return sendPokemonImage(
      api,
      threadID,
      `🏆 GYM VICTORY!\n\nLeader: ${gym.leader}\nGym: ${gym.name}\n\n` +
      `🏅 Obtained: ${gym.badge}\n` +
      `💰 Reward: 250 Coins\n` +
      `⭐ XP: +100\n\nUID: ${pokemon.uid}\n` +
      `Recovery: ${pokemon.recovery}\nTrainer Recovery: ${player.recovery}`,
      pokemon,
      messageID
    );
  }

  // ==========================================
  // PART 3: SHOP AND INVENTORY
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
    const item = (args[1] || "").toLowerCase();
    const amount = Math.floor(Number(args[2] || 1));

    if (!SHOP[item] || !Number.isSafeInteger(amount) ||
        amount < 1 || amount > 99) {
      return reply("Invalid item or amount.");
    }

    const cost = SHOP[item] * amount;

    if (player.coins < cost) {
      return reply("Not enough coins!");
    }

    player.coins -= cost;
    player.inventory[item] =
      (player.inventory[item] || 0) + amount;

    player.recovery = recoveryCode();
    saveDB();

    return reply(
      `✅ PURCHASE COMPLETE!\n\n` +
      `Item: ${item}\nQuantity: ${amount}\n` +
      `Cost: ${cost} coins\n` +
      `Balance: ${player.coins}\n` +
      `Recovery: ${player.recovery}`
    );
  }

  if (command === "bag" || command === "inventory") {
    return reply(
      "🎒 TRAINER INVENTORY\n\n" +
      Object.entries(player.inventory)
        .map(([name, amount]) => `${name}: ${amount}`)
        .join("\n") +
      `\n\nCoins: ${player.coins}`
    );
  }

  // ==========================================
  // PART 3: BADGES
  // ==========================================

  if (command === "badges") {
    return reply(
      "🏅 YOUR GYM BADGES\n\n" +
      (player.badges.length
        ? player.badges.map((b, i) => `${i + 1}. ${b}`).join("\n")
        : "You haven't earned any badges yet.") +
      `\n\nTotal: ${player.badges.length}/8`
    );
  }

  // ==========================================
  // PART 3: TEAM MANAGEMENT
  // ==========================================

  if (command === "setteam") {
    const index = Number(args[1]) - 1;
    const pokemon = player.pokemon[index];

    if (!pokemon) {
      return reply("Invalid Pokémon number. Check p team.");
    }

    if (player.team.includes(pokemon.uid)) {
      return reply("This Pokémon is already in your team.");
    }

    if (player.team.length >= CONFIG.MAX_TEAM) {
      return reply("Your team is full! Maximum 6 Pokémon.");
    }

    player.team.push(pokemon.uid);
    saveDB();

    return reply(
      `✅ ${pokemon.name} joined your battle team!\n` +
      `Team members: ${player.team.length}/6`
    );
  }

  if (command === "removeteam") {
    const index = Number(args[1]) - 1;

    if (!Number.isInteger(index) ||
        index < 0 || index >= player.team.length) {
      return reply("Invalid team position.");
    }

    const removed = player.team.splice(index, 1)[0];

    saveDB();

    return reply(
      `Removed Pokémon UID ${removed} from your team.`
    );
  }

  // ==========================================
  // PART 3: POKÉMON DETAILS
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
  // PART 3: DATA EXPORT
  // ==========================================

  if (command === "export") {
    const snapshot = {
      version: 1,
      player: JSON.parse(JSON.stringify(player)),
      exportedAt: Date.now()
    };

    const encoded = Buffer.from(
      JSON.stringify(snapshot),
      "utf8"
    ).toString("base64");

    return reply(
      "🔐 POKÉMON DATA EXPORT\n\n" +
      "Save the complete code below somewhere safe.\n" +
      "It contains your trainer and Pokémon data.\n\n" +
      encoded
    );
  }

  // ==========================================
  // PART 3: DATA RESTORE
  // ==========================================

  if (command === "restore") {
    const encoded = args[1];

    if (!encoded || encoded.length > 500000) {
      return reply("Provide a valid export code.");
    }

    try {
      const snapshot = JSON.parse(
        Buffer.from(encoded, "base64").toString("utf8")
      );

      const restored = snapshot.player;

      if (
        snapshot.version !== 1 ||
        !restored ||
        !Array.isArray(restored.pokemon) ||
        !Array.isArray(restored.team) ||
        !restored.inventory ||
        restored.pokemon.length > 200 ||
        restored.team.length > 6 ||
        !Number.isFinite(restored.coins) ||
        restored.coins < 0
      ) {
        return reply("Invalid or damaged backup.");
      }

      for (const pokemon of restored.pokemon) {
        if (
          typeof pokemon.uid !== "string" ||
          typeof pokemon.name !== "string" ||
          !Number.isInteger(pokemon.level) ||
          !Number.isInteger(pokemon.hp) ||
          !Number.isInteger(pokemon.maxHp) ||
          !Array.isArray(pokemon.type)
        ) {
          return reply("Backup contains invalid Pokémon data.");
        }
      }

      restored.id = senderID;

      DB.players[senderID] = restored;

      for (const pokemon of restored.pokemon) {
        const species = SPECIES.find(
          p => p.id === pokemon.speciesId
        );

        if (species && species.unique) {
          DB.uniquePokemon[species.id] = {
            owner: senderID,
            pokemonUID: pokemon.uid
          };
        }
      }

      saveDB();

      return reply(
        "✅ TRAINER DATA RESTORED!\n\n" +
        `Pokémon: ${restored.pokemon.length}\n` +
        `Coins: ${restored.coins}\n` +
        `Level: ${restored.level}\n` +
        `Badges: ${restored.badges.length}\n` +
        `Recovery: ${restored.recovery}`
      );

    } catch (error) {
      return reply("❌ Invalid export code.");
    }
  }

  // ==========================================
  // PART 4: RANDOM TRAINER CHALLENGES
  // ==========================================

  if (command === "trainer") {
    if (!player.pokemon.length) {
      return reply("Choose a starter first!");
    }

    const trainers = [
      "Youngster Joey",
      "Bug Catcher Sam",
      "Lass Anna",
      "Super Nerd Mark",
      "Pokémon Ranger",
      "Ace Trainer",
      "Collector James"
    ];

    const trainer = trainers[
      Math.floor(Math.random() * trainers.length)
    ];

    const species = getRandomPokemon();
    const opponent = createPokemon(
      species,
      5 + Math.floor(Math.random() * 15)
    );

    const pokemon = player.pokemon.find(
      p => player.team.includes(p.uid) && p.hp > 0
    );

    if (!pokemon) {
      return reply("Your battle team has no healthy Pokémon!");
    }

    const power = pokemon.attack + pokemon.level * 2;
    const enemyPower = opponent.attack + opponent.level * 2;

    const won = power >= enemyPower;

    if (won) {
      const reward = 100 + opponent.level * 10;
      player.coins += reward;
      player.xp += 50;
      player.wins++;
    } else {
      pokemon.hp = Math.max(0, pokemon.hp - 15);
      player.losses++;
    }

    player.recovery = recoveryCode();
    saveDB();

    return sendPokemonImage(
      api,
      threadID,
      `🎒 TRAINER ENCOUNTER!\n\n` +
      `Trainer: ${trainer}\n` +
      `${pokemon.name} vs ${opponent.name}\n\n` +
      (won
        ? `🏆 YOU WON!\nReward: ${100 + opponent.level * 10} Coins\n+50 XP`
        : `❌ You lost!\n${pokemon.name} lost 15 HP.`) +
      `\n\nTrainer Recovery: ${player.recovery}`,
      pokemon,
      messageID
    );
  }

  // ==========================================
  // PART 4: FRIEND BATTLE CHALLENGE
  // ==========================================

  if (command === "challenge") {
    const targetID = Object.keys(event.mentions || {})[0];

    if (!targetID) {
      return reply("Mention a friend!\nExample: p challenge @friend");
    }

    if (targetID === senderID) {
      return reply("You cannot challenge yourself!");
    }

    if (!player.team.length) {
      return reply("You need a battle team first!");
    }

    const opponentPlayer = DB.players[targetID];

    if (!opponentPlayer || !opponentPlayer.started ||
        !opponentPlayer.team.length) {
      return reply("Your friend must start Pokémon World first.");
    }

    if (DB.battles[targetID]) {
      return reply("Your friend already has a pending battle.");
    }

    const challengeCode = uid();

    DB.battles[targetID] = {
      code: challengeCode,
      from: senderID,
      to: targetID,
      threadID,
      created: Date.now(),
      status: "pending"
    };

    saveDB();

    return reply(
      `⚔️ POKÉMON BATTLE CHALLENGE!\n\n` +
      `Challenge sent to your friend.\n` +
      `Battle Code: ${challengeCode}\n\n` +
      `Your friend can type:\np accept`
    );
  }

  // ==========================================
  // PART 4: ACCEPT FRIEND BATTLE
  // ==========================================

  if (command === "accept") {
    const challenge = DB.battles[senderID];

    if (!challenge || challenge.status !== "pending") {
      return reply("You don't have a pending challenge.");
    }

    if (Date.now() - challenge.created > 300000) {
      delete DB.battles[senderID];
      saveDB();
      return reply("This battle challenge has expired.");
    }

    const challenger = DB.players[challenge.from];

    if (!challenger || !challenger.started) {
      delete DB.battles[senderID];
      saveDB();
      return reply("The challenger is no longer available.");
    }

    const getHealthy = p => p.pokemon.find(
      x => p.team.includes(x.uid) && x.hp > 0
    );

    const first = getHealthy(challenger);
    const second = getHealthy(player);

    if (!first || !second) {
      return reply("Both trainers need a healthy team Pokémon.");
    }

    const firstPower = first.attack + first.level * 3;
    const secondPower = second.attack + second.level * 3;

    const draw = firstPower === secondPower;
    const firstWins = firstPower > secondPower;

    if (draw) {
      challenger.losses += 0;
      player.losses += 0;
    } else if (firstWins) {
      challenger.wins++;
      challenger.coins += 200;
      player.losses++;
    } else {
      player.wins++;
      player.coins += 200;
      challenger.losses++;
    }

    challenger.recovery = recoveryCode();
    player.recovery = recoveryCode();

    const result = draw
      ? "🤝 BATTLE DRAW!"
      : firstWins
        ? "🏆 CHALLENGER WINS!"
        : "🏆 DEFENDER WINS!";

    delete DB.battles[senderID];

    saveDB();

    const report =
      `⚔️ FRIEND BATTLE RESULT\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `${first.name} Lv.${first.level}\n` +
      `VS\n` +
      `${second.name} Lv.${second.level}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `${result}\n\n` +
      `Challenger Recovery: ${challenger.recovery}\n` +
      `Defender Recovery: ${player.recovery}`;

    api.sendMessage(report, challenge.threadID);
    return reply(report);
  }

  // ==========================================
  // PART 4: DECLINE CHALLENGE
  // ==========================================

  if (command === "decline") {
    if (!DB.battles[senderID]) {
      return reply("No pending battle challenge.");
    }

    delete DB.battles[senderID];
    saveDB();

    return reply("Battle challenge declined.");
  }
