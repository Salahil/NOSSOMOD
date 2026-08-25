import { world, system, ItemStack, BlockPermutation } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { CONFIG } from "../../config.js";
import { HELL_CORE_ID } from "../../lib/hell_core.js";
import { safeGetBlock, setBlockId } from "../../lib/blocks.js";

const RUNE_ALTAR_BLOCK_ID = "enormousbedrock:rune_altar";
const EMPTY_RUNE_ID = "enormousbedrock:empty_rune";
const SOUL_SAND_ID = "minecraft:soul_sand";
const SOUL_SOIL_ID = "minecraft:soul_soil";
const ENCHANT_BOOK_ID = "enormousbedrock:enchant_book";
const ENCHANT_TABLE_ID = "minecraft:enchanting_table";

const activeSessions = new Map();
const bookEntities = new Map();
const tableLightning = new Map();

function weightedPick(entries) {
  const total = entries.reduce((acc, e) => acc + (e.weight ?? 0), 0);
  if (total <= 0) return null;
  let roll = Math.random() * total;
  for (const e of entries) {
    roll -= e.weight ?? 0;
    if (roll <= 0) return e.id;
  }
  return entries[entries.length - 1]?.id ?? null;
}

function generateRuneOptions() {
  const options = [];
  
  const tier1 = weightedPick(CONFIG.runeForge.tiers[1]);
  const tier2 = weightedPick(CONFIG.runeForge.tiers[2]);
  const tier3 = weightedPick(CONFIG.runeForge.tiers[3]);
  
  if (tier1) options.push({ tier: 1, runeId: tier1 });
  if (tier2) options.push({ tier: 2, runeId: tier2 });
  if (tier3) options.push({ tier: 3, runeId: tier3 });
  
  return options;
}

function hasHellCoreBelow(dim, loc) {
  const below = safeGetBlock(dim, loc.x, loc.y - 1, loc.z);
  return below?.typeId === HELL_CORE_ID;
}

function altarKey(dimId, loc) {
  return `${dimId}:${loc.x},${loc.y},${loc.z}`;
}

function randomDelayTicks(minSeconds, maxSeconds) {
  const secs = minSeconds + Math.random() * (maxSeconds - minSeconds);
  return Math.max(20, Math.floor(secs * 20));
}

function findNearestLightningRod(dim, center, radius) {
  let nearest = null;
  let best = Number.POSITIVE_INFINITY;

  for (let x = center.x - radius; x <= center.x + radius; x++) {
    for (let z = center.z - radius; z <= center.z + radius; z++) {
      const yMin = Math.max(center.y - radius, -64);
      const yMax = Math.min(center.y + radius, 320);
      for (let y = yMin; y <= yMax; y++) {
        const block = safeGetBlock(dim, x, y, z);
        if (block?.typeId !== "minecraft:lightning_rod") continue;
        const d2 = (x - center.x) ** 2 + (y - center.y) ** 2 + (z - center.z) ** 2;
        if (d2 < best) {
          best = d2;
          nearest = { x, y, z };
        }
      }
    }
  }
  return nearest;
}

function strikeNearTable(dim, tableLoc) {
  const radius = CONFIG.runeForge.lightning.radius;
  const rod = findNearestLightningRod(dim, tableLoc, radius);
  const target = rod ?? {
    x: tableLoc.x + Math.floor(Math.random() * 5 - 2),
    y: tableLoc.y,
    z: tableLoc.z + Math.floor(Math.random() * 5 - 2)
  };

  try {
    dim.spawnEntity("minecraft:lightning_bolt", {
      x: target.x + 0.5,
      y: target.y + 1,
      z: target.z + 0.5
    });
  } catch { /* chunk descarregado */ }
}

function tryConvertBlockToRuneAltar(dim, loc) {
  const block = safeGetBlock(dim, loc.x, loc.y, loc.z);
  if (!block) return;
  
  if (block.typeId === ENCHANT_TABLE_ID && hasHellCoreBelow(dim, loc)) {
    setBlockId(dim, loc, RUNE_ALTAR_BLOCK_ID);
  }
}

function tryConvertBlockToVanillaTable(dim, loc) {
  const block = safeGetBlock(dim, loc.x, loc.y, loc.z);
  if (!block) return;
  
  if (block.typeId === RUNE_ALTAR_BLOCK_ID && !hasHellCoreBelow(dim, loc)) {
    setBlockId(dim, loc, ENCHANT_TABLE_ID);
  }
}

function spawnBookEntity(dim, x, y, z) {
  const key = `${dim.id}_${x}_${y}_${z}`;
  if (bookEntities.has(key)) return;
  
  try {
    const book = dim.spawnEntity(ENCHANT_BOOK_ID, { x: x + 0.5, y: y + 0.85, z: z + 0.5 });
    bookEntities.set(key, book.id);
  } catch (e) {
    console.error("Failed to spawn book entity:", e);
  }
}

function removeBookEntity(dim, x, y, z) {
  const key = `${dim.id}_${x}_${y}_${z}`;
  const bookId = bookEntities.get(key);
  if (!bookId) return;
  
  const entities = dim.getEntities({ type: ENCHANT_BOOK_ID });
  for (const entity of entities) {
    if (entity.id === bookId) {
      entity.remove();
      break;
    }
  }
  bookEntities.delete(key);
}

function isSoulSandOrSoil(item) {
  return item.typeId === SOUL_SAND_ID || item.typeId === SOUL_SOIL_ID;
}

function getRuneName(runeId) {
  const runeNames = {
    "enormousbedrock:warrior_rune": "Runa: Guerreiro",
    "enormousbedrock:emperor_rune": "Runa: Imperador",
    "enormousbedrock:tinker_rune": "Runa: Artífice",
    "enormousbedrock:noble_rune": "Runa: Nobre",
    "enormousbedrock:immortal_rune": "Runa: Imortal",
    "enormousbedrock:sorcerer_rune": "Runa: Feiticeiro",
    "enormousbedrock:guardian_rune": "Runa: Guardião",
    "enormousbedrock:devil_rune": "Runa: Diabo"
  };
  return runeNames[runeId] || "Runa Desconhecida";
}

function calculateTierCost(tier) {
  switch (tier) {
    case 1: return 5;
    case 2: return 15;
    case 3: return 30;
    default: return 5;
  }
}

function checkBookshelfBonus(dim, x, y, z) {
  let bonus = 0;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) + Math.abs(dz) <= 2) continue;
      try {
        const block = dim.getBlock({ x: x + dx, y: y, z: z + dz });
        if (block?.typeId === "minecraft:bookshelf") {
          bonus += 1;
        }
      } catch {}
    }
  }
  return Math.min(bonus, 15);
}

function applyEnchantment(player, optionIndex) {
  const session = activeSessions.get(player.id);
  if (!session) return false;
  
  const option = session.options[optionIndex];
  if (!option) return false;
  
  const cost = calculateTierCost(option.tier);
  if (player.experienceLevel < cost) {
    player.onScreenDisplay.setActionBar("§cVocê não tem XP suficiente!");
    return false;
  }
  
  const dim = world.getDimension(session.dimId);
  const block = dim.getBlock({ x: session.x, y: session.y, z: session.z });
  
  const container = block?.getComponent("minecraft:inventory")?.container;
  if (!container) return false;
  
  const runeSlot = container.getItem(0);
  const soulSlot = container.getItem(1);
  
  if (!runeSlot || runeSlot.typeId !== EMPTY_RUNE_ID) {
    player.onScreenDisplay.setActionBar("§cVocê precisa de uma Runa Vazia!");
    return false;
  }
  
  if (!soulSlot || !isSoulSandOrSoil(soulSlot)) {
    player.onScreenDisplay.setActionBar("§cVocê precisa de Areia da Alma!");
    return false;
  }
  
  player.addLevels(-cost);
  
  soulSlot.amount -= 1;
  if (soulSlot.amount <= 0) {
    container.setItem(1, undefined);
  } else {
    container.setItem(1, soulSlot);
  }
  
  container.setItem(0, new ItemStack(option.runeId, 1));
  
  dim.playSound("block.enchanting_table.use", { x: session.x + 0.5, y: session.y + 0.5, z: session.z + 0.5 }, { pitch: 1.2 });
  
  for (let i = 0; i < 20; i++) {
    dim.spawnParticle("enormousbedrock:rune_altar_particle", {
      x: session.x + 0.5 + (Math.random() - 0.5) * 1.5,
      y: session.y + 0.5,
      z: session.z + 0.5 + (Math.random() - 0.5) * 1.5
    });
  }
  
  return true;
}

function showRuneAltarUI(player, block) {
  const dim = block.dimension;
  const loc = block.location;
  
  const session = {
    dimId: dim.id,
    x: loc.x,
    y: loc.y,
    z: loc.z,
    options: generateRuneOptions()
  };
  
  activeSessions.set(player.id, session);
  
  // Abrir o inventário do altar primeiro (para colocar os itens)
  try {
    const inv = block.getComponent("minecraft:inventory");
    if (inv && typeof inv.open === "function") {
      inv.open(player);
    }
  } catch (e) {
    console.error("Failed to open container:", e);
  }
  
  // Esperar um pouco para o jogador colocar os itens, depois mostrar a UI
  system.runTimeout(() => {
    const form = new ActionFormData()
      .title("Altar de Runas")
      .body("Selecione uma das opções abaixo para infundir sua runa vazia!");
    
    // Adicionar botões para cada opção
    for (let i = 0; i < session.options.length; i++) {
      const option = session.options[i];
      const cost = calculateTierCost(option.tier);
      const runeName = getRuneName(option.runeId);
      const tierText = option.tier === 1 ? "Tier 1" : option.tier === 2 ? "Tier 2" : "Tier 3";
      form.button(`${tierText} - ${runeName}\nCusto: ${cost} XP`);
    }
    
    // Mostrar o formulário
    form.show(player).then((response) => {
      if (response.canceled) return;
      
      const selectedIndex = response.selection;
      if (selectedIndex !== undefined) {
        // Aplicar o encantamento
        const success = applyEnchantment(player, selectedIndex);
        
        // Se deu certo, podemos reabrir a UI com novas opções se quiser
        if (success) {
          // Esperar um pouco e reabrir para novas opções
          system.runTimeout(() => {
            showRuneAltarUI(player, block);
          }, 10);
        }
      }
    });
  }, 10);
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const { player, block } = event;
  
  if (block.typeId !== RUNE_ALTAR_BLOCK_ID) return;
  
  if (player.isSneaking) return;
  
  showRuneAltarUI(player, block);
});

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  const { block } = event;
  const dim = block.dimension;
  const loc = block.location;
  
  if (block.typeId === RUNE_ALTAR_BLOCK_ID) {
    spawnBookEntity(dim, loc.x, loc.y, loc.z);
  } else if (block.typeId === ENCHANT_TABLE_ID) {
    tryConvertBlockToRuneAltar(dim, loc);
  } else if (block.typeId === HELL_CORE_ID) {
    // Check block above
    const aboveLoc = { x: loc.x, y: loc.y + 1, z: loc.z };
    tryConvertBlockToRuneAltar(dim, aboveLoc);
  }
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  const { block, brokenBlockPermutation } = event;
  const dim = block.dimension;
  const loc = block.location;
  
  if (brokenBlockPermutation?.type?.id === RUNE_ALTAR_BLOCK_ID) {
    removeBookEntity(dim, loc.x, loc.y, loc.z);
    
    for (const [playerId, session] of activeSessions.entries()) {
      if (session.dimId === dim.id && 
          session.x === loc.x && 
          session.y === loc.y && 
          session.z === loc.z) {
        activeSessions.delete(playerId);
      }
    }
  } else if (brokenBlockPermutation?.type?.id === HELL_CORE_ID) {
    // Check block above
    const aboveLoc = { x: loc.x, y: loc.y + 1, z: loc.z };
    tryConvertBlockToVanillaTable(dim, aboveLoc);
  }
});

system.runInterval(() => {
  const particlesPerTick = 2;
  
  for (const player of world.getAllPlayers()) {
    const dim = player.dimension;
    const px = Math.floor(player.location.x);
    const py = Math.floor(player.location.y);
    const pz = Math.floor(player.location.z);
    
    for (let dx = -8; dx <= 8; dx++) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dz = -8; dz <= 8; dz++) {
          try {
            const x = px + dx;
            const y = py + dy;
            const z = pz + dz;
            const block = dim.getBlock({ x, y, z });
            
            if (block?.typeId !== RUNE_ALTAR_BLOCK_ID) continue;
            
            const bookKey = `${dim.id}_${x}_${y}_${z}`;
            if (!bookEntities.has(bookKey)) {
              spawnBookEntity(dim, x, y, z);
            }
            
            for (let i = 0; i < particlesPerTick; i++) {
              dim.spawnParticle("enormousbedrock:rune_altar_particle", {
                x: x + 0.5 + (Math.random() - 0.5),
                y: y + 0.5 + Math.random() * 1.5,
                z: z + 0.5 + (Math.random() - 0.5)
              });
            }
          } catch {}
        }
      }
    }
  }
}, 1);

system.runInterval(() => {
    const seen = new Set();
    const now = system.currentTick;
    const { radius, minSeconds, maxSeconds, scanIntervalTicks } = CONFIG.runeForge.lightning;

    for (const player of world.getAllPlayers()) {
        const dim = player.dimension;
        const px = Math.floor(player.location.x);
        const py = Math.floor(player.location.y);
        const pz = Math.floor(player.location.z);

        for (let x = px - radius; x <= px + radius; x++) {
            for (let z = pz - radius; z <= pz + radius; z++) {
                const yMin = Math.max(py - radius, -64);
                const yMax = Math.min(py + radius, 320);
                for (let y = yMin; y <= yMax; y++) {
                    const loc = { x, y, z };
                    const block = safeGetBlock(dim, x, y, z);
                    
                    // Verifica para converter mesa vanilla em altar
                    if (block?.typeId === ENCHANT_TABLE_ID && hasHellCoreBelow(dim, loc)) {
                        setBlockId(dim, loc, RUNE_ALTAR_BLOCK_ID);
                        continue;
                    }
                    
                    // Verifica para converter altar em mesa vanilla
                    if (block?.typeId === RUNE_ALTAR_BLOCK_ID && !hasHellCoreBelow(dim, loc)) {
                        setBlockId(dim, loc, ENCHANT_TABLE_ID);
                        removeBookEntity(dim, x, y, z);
                        continue;
                    }
                    
                    if (block?.typeId !== RUNE_ALTAR_BLOCK_ID || !hasHellCoreBelow(dim, loc)) continue;

                    const key = altarKey(dim.id, loc);
                    seen.add(key);

                    const state = tableLightning.get(key) ?? {
                        nextTick: now + randomDelayTicks(minSeconds, maxSeconds),
                        dimId: dim.id,
                        loc: { ...loc }
                    };

                    if (now >= state.nextTick) {
                        strikeNearTable(dim, loc);
                        state.nextTick = now + randomDelayTicks(minSeconds, maxSeconds);
                    }

                    tableLightning.set(key, state);
                }
            }
        }
    }

    for (const key of tableLightning.keys()) {
        if (!seen.has(key)) tableLightning.delete(key);
    }
}, CONFIG.runeForge.lightning.scanIntervalTicks);
