import { world, system, ItemStack } from "@minecraft/server";
import { CONFIG } from "../../config.js";

const TABLE_SESSIONS = new Map();
const TABLE_LIGHTNING = new Map();

function locKey(dimId, loc) {
    return `${dimId}:${loc.x},${loc.y},${loc.z}`;
}

function hasHellCoreBelow(block) {
    if (!block) return false;
    return block.dimension.getBlock({
        x: block.location.x,
        y: block.location.y - 1,
        z: block.location.z
    })?.typeId === CONFIG.hellCore.id;
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

function deriveTierByXpSpent(player, session) {
    const spent = Math.max(1, (session.levelBefore ?? player.level) - player.level);
    return clampTier(spent);
}

function isRecentlyBoundToHellCoreTable(player, nowTick) {
    const s = TABLE_SESSIONS.get(player.id);
    if (!s) return false;
    if (nowTick > s.expiresAtTick) return false;

    const dim = world.getDimension(s.dimId);
    const table = dim.getBlock(s.tableLoc);
    if (table?.typeId !== "minecraft:enchanting_table") return false;
    if (!hasHellCoreBelow(table)) return false;

    const d = Math.sqrt(
        (player.location.x - s.tableLoc.x - 0.5) ** 2 +
        (player.location.y - s.tableLoc.y - 0.5) ** 2 +
        (player.location.z - s.tableLoc.z - 0.5) ** 2
    );
    return d <= CONFIG.runeForge.maxDistanceFromTable;
}

function convertEnchantedEmptyRune(event) {
    const { player, slot, itemStack, beforeItemStack } = event;
    if (!itemStack || itemStack.typeId !== CONFIG.runeForge.emptyRune) return;
    if (!beforeItemStack || beforeItemStack.typeId !== CONFIG.runeForge.emptyRune) return;
    if (!isRecentlyBoundToHellCoreTable(player, system.currentTick)) return;

    const enchantable = itemStack.getComponent("minecraft:enchantable");
    const previousEnchantable = beforeItemStack.getComponent("minecraft:enchantable");
    const nowEnchants = enchantable?.getEnchantments?.() ?? [];
    const oldEnchants = previousEnchantable?.getEnchantments?.() ?? [];
    if (nowEnchants.length <= oldEnchants.length) return;

    const session = TABLE_SESSIONS.get(player.id);
    const tier = deriveTierByXpSpent(player, session ?? {});
    const table = CONFIG.runeForge.tiers?.[tier];
    if (!table?.length) return;

    const resultId = weightedPick(table);
    if (!resultId) return;

    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return;
    inventory.setItem(slot, new ItemStack(resultId, 1));

    const lvl = tier;
    player.onScreenDisplay.setActionBar(`§dRuna forjada (Tier ${lvl})`);
    player.dimension.playSound("block.enchanting_table.use", player.location, { pitch: 1.2 });
}

function findNearestLightningRod(dim, center, radius) {
    let nearest = null;
    let best = Number.POSITIVE_INFINITY;

    for (let x = center.x - radius; x <= center.x + radius; x++) {
        for (let y = center.y - radius; y <= center.y + radius; y++) {
            for (let z = center.z - radius; z <= center.z + radius; z++) {
                const block = dim.getBlock({ x, y, z });
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

    const strikePos = { x: target.x + 0.5, y: target.y + 1, z: target.z + 0.5 };
    try {
        dim.spawnEntity("minecraft:lightning_bolt", strikePos);
    } catch {
        // Ignora chunk descarregado/posição inválida
    }
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, block, isFirstEvent } = event;
    if (!isFirstEvent) return;
    if (block.typeId !== "minecraft:enchanting_table") return;
    if (!hasHellCoreBelow(block)) return;

    TABLE_SESSIONS.set(player.id, {
        dimId: block.dimension.id,
        tableLoc: { ...block.location },
        levelBefore: player.level,
        expiresAtTick: system.currentTick + CONFIG.runeForge.sessionWindowTicks
    });
});

if (world.afterEvents.playerInventoryItemChange) {
    world.afterEvents.playerInventoryItemChange.subscribe(convertEnchantedEmptyRune);
}

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
            for (let y = py - radius; y <= py + radius; y++) {
                for (let z = pz - radius; z <= pz + radius; z++) {
                    const b = dim.getBlock({ x, y, z });
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
