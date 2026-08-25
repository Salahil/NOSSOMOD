import { world, system, ItemStack } from "@minecraft/server";
import { CONFIG } from "../../config.js";
import { HELL_CORE_ID } from "../../lib/hell_core.js";
import { safeGetBlock, setBlockId } from "../../lib/blocks.js";

export const RUNE_ALTAR_BLOCK_ID = "enormousbedrock:rune_altar";
export const RUNE_ALTAR_ITEM_ID = "enormousbedrock:rune_altar";
const ENCHANT_TABLE_ID = "minecraft:enchanting_table";

const playerSessions = new Map();
const tableLightning = new Map();

function altarKey(dimId, loc) {
    return `${dimId}:${loc.x},${loc.y},${loc.z}`;
}

function altarMarkerKey(dimId, loc) {
    return `eb_altar_${altarKey(dimId, loc)}`;
}

function isMarkedAltar(dimId, loc) {
    return world.getDynamicProperty(altarMarkerKey(dimId, loc)) === 1;
}

function markAltar(dimId, loc) {
    world.setDynamicProperty(altarMarkerKey(dimId, loc), 1);
}

function unmarkAltar(dimId, loc) {
    world.setDynamicProperty(altarMarkerKey(dimId, loc), undefined);
}

function hasHellCoreBelow(dim, loc) {
    const below = safeGetBlock(dim, loc.x, loc.y - 1, loc.z);
    return below?.typeId === HELL_CORE_ID;
}

function distanceToBlock(player, loc) {
    return Math.sqrt(
        (player.location.x - loc.x - 0.5) ** 2 +
        (player.location.y - loc.y - 0.5) ** 2 +
        (player.location.z - loc.z - 0.5) ** 2
    );
}

function isValidAltarBlock(dim, loc) {
    const block = safeGetBlock(dim, loc.x, loc.y, loc.z);
    if (block?.typeId !== ENCHANT_TABLE_ID) return false;
    if (!isMarkedAltar(dim.id, loc)) return false;
    return hasHellCoreBelow(dim, loc);
}

function weightedPick(entries) {
    const total = entries.reduce((acc, e) => acc + (e.weight ?? 0), 0);
    if (total <= 0) return null;
    let roll = Math.random() * total;
    for (const e of entries) {
        roll -= e.weight ?? 0;
        if (roll <= 0) return e.id;
    }
    return entries[entries.length - 1]?.id;
}

function clampTier(value) {
    if (value <= 1) return 1;
    if (value === 2) return 2;
    return 3;
}

function deriveTierByXpSpent(xpSpent) {
    return clampTier(Math.max(1, xpSpent ?? 1));
}

function findEmptyRuneSlots(inventory) {
    const slots = [];
    for (let slot = 0; slot < inventory.size; slot++) {
        if (inventory.getItem(slot)?.typeId === CONFIG.runeForge.emptyRune) {
            slots.push(slot);
        }
    }
    return slots;
}

function isSessionValid(player, session, nowTick) {
    if (!session) return false;
    if (nowTick > session.expiresAtTick) return false;

    const dim = world.getDimension(session.dimId);
    if (!isValidAltarBlock(dim, session.tableLoc)) return false;

    return distanceToBlock(player, session.tableLoc) <= CONFIG.runeForge.maxDistanceFromTable;
}

function bindSession(player, dim, loc) {
    playerSessions.set(player.id, {
        dimId: dim.id,
        tableLoc: { x: loc.x, y: loc.y, z: loc.z },
        levelAtOpen: player.level,
        xpSpent: 0,
        expiresAtTick: system.currentTick + CONFIG.runeForge.sessionWindowTicks
    });
    player.onScreenDisplay.setActionBar(
        "§5§lAltar de Runas §r— §7gaste XP na mesa para forjar uma runa vazia"
    );
}

function tryConvertPlayerRunes(player, nowTick) {
    const session = playerSessions.get(player.id);
    if (!isSessionValid(player, session, nowTick)) return false;
    if ((session.xpSpent ?? 0) < 1) return false;

    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return false;

    const runeSlots = findEmptyRuneSlots(inventory);
    if (runeSlots.length === 0) return false;

    const tier = deriveTierByXpSpent(session.xpSpent);
    const table = CONFIG.runeForge.tiers?.[tier];
    if (!table?.length) return false;

    const resultId = weightedPick(table);
    if (!resultId) return false;

    inventory.setItem(runeSlots[0], new ItemStack(resultId, 1));
    player.onScreenDisplay.setActionBar(`§dRuna forjada (Tier ${tier})`);
    player.dimension.playSound("block.enchanting_table.use", player.location, { pitch: 1.2 });

    session.xpSpent = 0;
    session.levelAtOpen = player.level;
    return true;
}

function trackXpSpend(player, session) {
    const spent = Math.max(0, (session.levelAtOpen ?? player.level) - player.level);
    if (spent <= 0) return;
    session.xpSpent = (session.xpSpent ?? 0) + spent;
    session.levelAtOpen = player.level;
}

/** Coloca mesa de encantamentos marcada (visual vanilla + UI nativa). */
function activateAltarSurface(dim, loc) {
    markAltar(dim.id, loc);
    setBlockId(dim, loc, ENCHANT_TABLE_ID);
}

function deactivateAltarSurface(dim, loc) {
    if (!hasHellCoreBelow(dim, loc)) {
        unmarkAltar(dim.id, loc);
        return;
    }
    setBlockId(dim, loc, RUNE_ALTAR_BLOCK_ID);
}

function tryBindAltarUse(player, block) {
    const dim = block.dimension;
    const loc = block.location;

    if (block.typeId === RUNE_ALTAR_BLOCK_ID) {
        if (!hasHellCoreBelow(dim, loc)) {
            player.onScreenDisplay.setActionBar("§cO Altar de Runas precisa estar sobre um Núcleo do Inferno.");
            return;
        }
        activateAltarSurface(dim, loc);
        bindSession(player, dim, loc);
        return;
    }

    if (block.typeId === ENCHANT_TABLE_ID && isMarkedAltar(dim.id, loc)) {
        if (!hasHellCoreBelow(dim, loc)) {
            player.onScreenDisplay.setActionBar("§cSem Núcleo do Inferno abaixo — altar inativo.");
            return;
        }
        bindSession(player, dim, loc);
    }
}

// —— Colocação: só sobre hell core ——
const placeBefore = world.beforeEvents?.playerPlaceBlock;
if (placeBefore) {
    placeBefore.subscribe((event) => {
        const perm = event.permutationToPlace;
        const placedId = perm?.type?.id;
        if (placedId !== RUNE_ALTAR_BLOCK_ID) return;

        const dim = event.dimension;
        const loc = event.block.location;
        if (!hasHellCoreBelow(dim, loc)) {
            event.cancel = true;
            event.player.onScreenDisplay.setActionBar(
                "§cColoque o Altar de Runas em cima de um Núcleo do Inferno."
            );
        }
    });
}

world.afterEvents.playerPlaceBlock.subscribe((event) => {
    const blockId = event.block?.typeId;
    if (blockId !== RUNE_ALTAR_BLOCK_ID) return;

    const dim = event.dimension;
    const loc = event.block.location;
    if (!hasHellCoreBelow(dim, loc)) return;

    system.run(() => {
        activateAltarSurface(dim, loc);
        event.player.onScreenDisplay.setActionBar("§5Altar de Runas ativado sobre o Núcleo.");
    });
});

// —— Uso da mesa ——
world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    try {
        tryBindAltarUse(event.player, event.block);
    } catch { /* chunk inválido */ }
});

const interactBefore = world.beforeEvents?.playerInteractWithBlock;
if (interactBefore) {
    interactBefore.subscribe((event) => {
        if (!event.isFirstEvent) return;
        try {
            tryBindAltarUse(event.player, event.block);
        } catch { /* chunk inválido */ }
    });
}

// —— Quebra: devolve item do altar ——
world.afterEvents.playerBreakBlock.subscribe((event) => {
    const loc = event.block.location;
    const dim = event.dimension;
    const brokenId = event.brokenBlockPermutation?.type?.id;

    if (brokenId === ENCHANT_TABLE_ID && isMarkedAltar(dim.id, loc)) {
        unmarkAltar(dim.id, loc);
        system.run(() => {
            for (const ent of dim.getEntities({
                type: "minecraft:item",
                location: loc,
                maxDistance: 2.5
            })) {
                const stack = ent.getComponent("item")?.itemStack;
                if (stack?.typeId === ENCHANT_TABLE_ID) ent.kill();
            }
            dim.spawnItem(new ItemStack(RUNE_ALTAR_ITEM_ID, 1), {
                x: loc.x + 0.5,
                y: loc.y + 0.5,
                z: loc.z + 0.5
            });
        });
        return;
    }

    if (brokenId === RUNE_ALTAR_BLOCK_ID) {
        unmarkAltar(dim.id, loc);
    }
});

// —— XP / conversão (somente com sessão válida no altar marcado) ——
system.runInterval(() => {
    const now = system.currentTick;
    for (const player of world.getPlayers()) {
        const session = playerSessions.get(player.id);
        if (!session) continue;

        if (!isSessionValid(player, session, now)) {
            playerSessions.delete(player.id);
            continue;
        }

        trackXpSpend(player, session);
        tryConvertPlayerRunes(player, now);
    }
}, CONFIG.runeForge.convertPollTicks);

// —— Raios em altares válidos ——
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

system.runInterval(() => {
    const seen = new Set();
    const now = system.currentTick;
    const { radius, minSeconds, maxSeconds, scanIntervalTicks } = CONFIG.runeForge.lightning;

    for (const player of world.getPlayers()) {
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
                    if (!isValidAltarBlock(dim, loc)) continue;

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

    for (const [playerId, session] of playerSessions.entries()) {
        const player = world.getAllPlayers().find((p) => p.id === playerId);
        if (!player || !isSessionValid(player, session, now)) {
            playerSessions.delete(playerId);
        }
    }
}, CONFIG.runeForge.lightning.scanIntervalTicks);
