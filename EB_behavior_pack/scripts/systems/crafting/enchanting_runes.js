import { world, system, ItemStack } from "@minecraft/server";
import { CONFIG } from "../../config.js";
import { safeGetBlock, isYInWorld } from "../../lib/blocks.js";

const TABLE_SESSIONS = new Map();
const TABLE_LIGHTNING = new Map();

function locKey(dimId, loc) {
    return `${dimId}:${loc.x},${loc.y},${loc.z}`;
}

function hasHellCoreBelow(block) {
    if (!block) return false;
    const belowY = block.location.y - 1;
    if (!isYInWorld(belowY)) return false;
    const below = safeGetBlock(block.dimension, block.location.x, belowY, block.location.z);
    return below?.typeId === CONFIG.hellCore.id;
}

function weightedPick(entries) {
    const total = entries.reduce((acc, e) => acc + (e.weight ?? 0), 0);
    if (total <= 0) return null;
    let roll = Math.random() * total;
    for (const e of entries) {
        roll -= (e.weight ?? 0);
        if (roll <= 0) return e.id;
    }
    return entries[entries.length - 1]?.id;
}

function randomDelayTicks(minSeconds, maxSeconds) {
    const secs = minSeconds + Math.random() * (maxSeconds - minSeconds);
    return Math.max(20, Math.floor(secs * 20));
}

function clampTier(value) {
    if (value <= 1) return 1;
    if (value === 2) return 2;
    return 3;
}

function deriveTierByXpSpent(session) {
    const spent = Math.max(1, session?.xpSpent ?? 1);
    return clampTier(spent);
}

function isSessionValid(player, session, nowTick) {
    if (!session) return false;
    if (nowTick > session.expiresAtTick) return false;

    const dim = world.getDimension(session.dimId);
    const table = safeGetBlock(dim, session.tableLoc.x, session.tableLoc.y, session.tableLoc.z);
    if (table?.typeId !== "minecraft:enchanting_table") return false;
    if (!hasHellCoreBelow(table)) return false;

    const d = Math.sqrt(
        (player.location.x - session.tableLoc.x - 0.5) ** 2 +
        (player.location.y - session.tableLoc.y - 0.5) ** 2 +
        (player.location.z - session.tableLoc.z - 0.5) ** 2
    );
    return d <= CONFIG.runeForge.maxDistanceFromTable;
}

function bindTableSession(player, block) {
    TABLE_SESSIONS.set(player.id, {
        dimId: block.dimension.id,
        tableLoc: { ...block.location },
        levelAtOpen: player.level,
        xpSpent: 0,
        awaitingConvert: false,
        expiresAtTick: system.currentTick + CONFIG.runeForge.sessionWindowTicks
    });
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

function tryConvertPlayerRunes(player, nowTick) {
    const session = TABLE_SESSIONS.get(player.id);
    if (!isSessionValid(player, session, nowTick)) return false;
    if ((session.xpSpent ?? 0) < 1) return false;

    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return false;

    const runeSlots = findEmptyRuneSlots(inventory);
    if (runeSlots.length === 0) return false;

    const tier = deriveTierByXpSpent(session);
    const table = CONFIG.runeForge.tiers?.[tier];
    if (!table?.length) return false;

    const resultId = weightedPick(table);
    if (!resultId) return false;

    inventory.setItem(runeSlots[0], new ItemStack(resultId, 1));
    player.onScreenDisplay.setActionBar(`§dRuna forjada (Tier ${tier})`);
    player.dimension.playSound("block.enchanting_table.use", player.location, { pitch: 1.2 });

    session.xpSpent = 0;
    session.levelAtOpen = player.level;
    session.awaitingConvert = false;
    return true;
}

function trackXpSpend(player, session) {
    const spent = Math.max(0, (session.levelAtOpen ?? player.level) - player.level);
    if (spent > 0) {
        session.xpSpent = (session.xpSpent ?? 0) + spent;
        session.levelAtOpen = player.level;
        session.awaitingConvert = true;
    }
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

function randomPointAround(center, radius) {
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    return {
        x: Math.floor(center.x + Math.cos(ang) * dist),
        y: center.y,
        z: Math.floor(center.z + Math.sin(ang) * dist)
    };
}

function strikeNearTable(dim, tableLoc) {
    const radius = CONFIG.runeForge.lightning.radius;
    const rod = findNearestLightningRod(dim, tableLoc, radius);
    const target = rod ?? randomPointAround(tableLoc, radius);
    const strikeY = Math.min(Math.max(target.y, -64), 320);

    try {
        dim.spawnEntity("minecraft:lightning_bolt", {
            x: target.x + 0.5,
            y: strikeY + 1,
            z: target.z + 0.5
        });
    } catch { /* chunk descarregado */ }
}

function tryBindEnchantingTable(player, block) {
    if (block.typeId !== "minecraft:enchanting_table") return;
    if (!hasHellCoreBelow(block)) return;
    bindTableSession(player, block);
}

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    try {
        tryBindEnchantingTable(event.player, event.block);
    } catch { /* posição inválida */ }
});

const interactBefore = world.beforeEvents?.playerInteractWithBlock;
if (interactBefore) {
    interactBefore.subscribe((event) => {
        if (!event.isFirstEvent) return;
        try {
            tryBindEnchantingTable(event.player, event.block);
        } catch { /* posição inválida */ }
    });
}

if (world.afterEvents.playerInventoryItemChange) {
    world.afterEvents.playerInventoryItemChange.subscribe((event) => {
        const session = TABLE_SESSIONS.get(event.player.id);
        if (!session) return;
        trackXpSpend(event.player, session);
        tryConvertPlayerRunes(event.player, system.currentTick);
    });
}

system.runInterval(() => {
    const now = system.currentTick;
    for (const player of world.getPlayers()) {
        const session = TABLE_SESSIONS.get(player.id);
        if (!session || now > session.expiresAtTick) continue;
        trackXpSpend(player, session);
        tryConvertPlayerRunes(player, now);
    }
}, CONFIG.runeForge.convertPollTicks);

system.runInterval(() => {
    const seenTables = new Set();
    const now = system.currentTick;
    const radius = CONFIG.runeForge.lightning.radius;
    const min = CONFIG.runeForge.lightning.minSeconds;
    const max = CONFIG.runeForge.lightning.maxSeconds;

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
                    const b = safeGetBlock(dim, x, y, z);
                    if (b?.typeId !== "minecraft:enchanting_table") continue;
                    if (!hasHellCoreBelow(b)) continue;

                    const key = locKey(dim.id, b.location);
                    seenTables.add(key);

                    const state = TABLE_LIGHTNING.get(key) ?? {
                        nextTick: now + randomDelayTicks(min, max),
                        dimId: dim.id,
                        loc: { ...b.location }
                    };

                    if (now >= state.nextTick) {
                        strikeNearTable(dim, b.location);
                        state.nextTick = now + randomDelayTicks(min, max);
                    }

                    TABLE_LIGHTNING.set(key, state);
                }
            }
        }
    }

    for (const key of TABLE_LIGHTNING.keys()) {
        if (!seenTables.has(key)) TABLE_LIGHTNING.delete(key);
    }

    for (const [playerId, s] of TABLE_SESSIONS.entries()) {
        if (now > s.expiresAtTick) TABLE_SESSIONS.delete(playerId);
    }
}, CONFIG.runeForge.lightning.scanIntervalTicks);
