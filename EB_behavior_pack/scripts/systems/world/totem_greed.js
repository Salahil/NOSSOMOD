import { world, system, ItemStack } from "@minecraft/server";
import { CONFIG } from "../../config.js";

const TOTEM_STASH_KEY = "eb_totem_stash";
const TOTEM_PENDING_KEY = "eb_totem_pending";
const TOTEM_SNAPSHOTS = new Map();

function getInventory(player) {
    return player.getComponent("minecraft:inventory")?.container;
}

function playerHasTotem(player) {
    const inv = getInventory(player);
    if (!inv) return false;
    for (let i = 0; i < inv.size; i++) {
        if (inv.getItem(i)?.typeId === CONFIG.totem.full) return true;
    }
    return false;
}

function removeOneTotemFromSaved(saved) {
    if (!saved?.inventory) return saved;
    for (const entry of saved.inventory) {
        if (entry.typeId !== CONFIG.totem.full) continue;
        entry.amount -= 1;
        if (entry.amount <= 0) {
            saved.inventory = saved.inventory.filter((e) => e !== entry);
        }
        return saved;
    }
    return saved;
}

function serializePlayerItems(player) {
    const inv = getInventory(player);
    const equip = player.getComponent("equippable");
    const saved = { inventory: [], equipment: {} };

    if (inv) {
        for (let i = 0; i < inv.size; i++) {
            const stack = inv.getItem(i);
            if (!stack) continue;
            saved.inventory.push({
                slot: i,
                typeId: stack.typeId,
                amount: stack.amount,
                lore: stack.getLore() ?? []
            });
        }
    }

    if (equip) {
        for (const slot of ["Head", "Chest", "Legs", "Feet", "Offhand", "Mainhand"]) {
            const stack = equip.getEquipment(slot);
            if (!stack) continue;
            saved.equipment[slot] = {
                typeId: stack.typeId,
                amount: stack.amount,
                lore: stack.getLore() ?? []
            };
        }
    }
    return saved;
}

function restorePlayerItems(player, saved) {
    const inv = getInventory(player);
    if (inv && saved.inventory) {
        for (const entry of saved.inventory) {
            const stack = new ItemStack(entry.typeId, entry.amount);
            if (entry.lore?.length) stack.setLore(entry.lore);
            inv.setItem(entry.slot, stack);
        }
    }
    const equip = player.getComponent("equippable");
    if (equip && saved.equipment) {
        for (const [slot, entry] of Object.entries(saved.equipment)) {
            const stack = new ItemStack(entry.typeId, entry.amount);
            if (entry.lore?.length) stack.setLore(entry.lore);
            equip.setEquipment(slot, stack);
        }
    }
}

function clearDeathDrops(dim, location, radius = 10) {
    try {
        const items = dim.getEntities({
            type: "minecraft:item",
            location,
            maxDistance: radius
        });
        for (const entity of items) {
            entity.kill();
        }
    } catch { /* chunk inválido */ }
}

function handleTotemDeath(player) {
    const snapshot = TOTEM_SNAPSHOTS.get(player.id) ?? serializePlayerItems(player);
    const hadTotem =
        playerHasTotem(player) ||
        snapshot.inventory?.some((e) => e.typeId === CONFIG.totem.full) ||
        Object.values(snapshot.equipment ?? {}).some((e) => e.typeId === CONFIG.totem.full);

    if (!hadTotem) return;

    const saved = removeOneTotemFromSaved(JSON.parse(JSON.stringify(snapshot)));
    const deathLoc = { ...player.location };

    try {
        player.setDynamicProperty(TOTEM_STASH_KEY, JSON.stringify(saved));
        player.setDynamicProperty(TOTEM_PENDING_KEY, true);
    } catch {
        return;
    }

    system.run(() => clearDeathDrops(player.dimension, deathLoc));
    TOTEM_SNAPSHOTS.delete(player.id);
}

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        if (playerHasTotem(player)) {
            TOTEM_SNAPSHOTS.set(player.id, serializePlayerItems(player));
        } else {
            TOTEM_SNAPSHOTS.delete(player.id);
        }
    }
}, 10);

const entityDieAfter = world.afterEvents?.entityDie;
if (entityDieAfter) {
    entityDieAfter.subscribe((event) => {
        const entity = event.deadEntity;
        if (entity?.typeId !== "minecraft:player") return;
        handleTotemDeath(entity);
    });
}

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    if (!player.getDynamicProperty(TOTEM_PENDING_KEY)) return;

    system.runTimeout(() => {
        const raw = player.getDynamicProperty(TOTEM_STASH_KEY);
        if (!raw) return;
        try {
            restorePlayerItems(player, JSON.parse(raw));
            player.onScreenDisplay.setActionBar("§6§lO Totem da Ganância devolveu seus pertences.");
        } catch { /* stash inválido */ }
        player.setDynamicProperty(TOTEM_PENDING_KEY, undefined);
        player.setDynamicProperty(TOTEM_STASH_KEY, undefined);
    }, 5);
});
