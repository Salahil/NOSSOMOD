import { world, system, ItemStack, EntityInventoryComponent } from "@minecraft/server";
import { CONFIG } from "../../config.js";

const TOTEM_STASH_KEY = "eb_totem_stash";
const TOTEM_PENDING_KEY = "eb_totem_pending";

function playerHasTotem(player) {
    const inv = player.getComponent(EntityInventoryComponent.componentId);
    if (!inv?.container) return false;
    for (let i = 0; i < inv.container.size; i++) {
        if (inv.container.getItem(i)?.typeId === CONFIG.totem.full) return true;
    }
    return false;
}

function consumeOneTotem(player) {
    const inv = player.getComponent(EntityInventoryComponent.componentId);
    if (!inv?.container) return;
    for (let i = 0; i < inv.container.size; i++) {
        const stack = inv.container.getItem(i);
        if (stack?.typeId !== CONFIG.totem.full) continue;
        if (stack.amount > 1) {
            stack.amount -= 1;
            inv.container.setItem(i, stack);
        } else {
            inv.container.setItem(i, undefined);
        }
        return;
    }
}

function serializePlayerItems(player) {
    const inv = player.getComponent(EntityInventoryComponent.componentId);
    const equip = player.getComponent("equippable");
    const saved = { inventory: [], equipment: {} };

    if (inv?.container) {
        for (let i = 0; i < inv.container.size; i++) {
            const stack = inv.container.getItem(i);
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

function clearPlayerItems(player) {
    const inv = player.getComponent(EntityInventoryComponent.componentId);
    if (inv?.container) {
        for (let i = 0; i < inv.container.size; i++) inv.container.setItem(i, undefined);
    }
    const equip = player.getComponent("equippable");
    if (equip) {
        for (const slot of ["Head", "Chest", "Legs", "Feet", "Offhand", "Mainhand"]) {
            equip.setEquipment(slot, undefined);
        }
    }
}

function restorePlayerItems(player, saved) {
    const inv = player.getComponent(EntityInventoryComponent.componentId);
    if (inv?.container && saved.inventory) {
        for (const entry of saved.inventory) {
            const stack = new ItemStack(entry.typeId, entry.amount);
            if (entry.lore?.length) stack.setLore(entry.lore);
            inv.container.setItem(entry.slot, stack);
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

world.beforeEvents.entityDie.subscribe((event) => {
    const entity = event.deadEntity;
    if (entity?.typeId !== "minecraft:player") return;
    if (!playerHasTotem(entity)) return;

    entity.setDynamicProperty(TOTEM_STASH_KEY, JSON.stringify(serializePlayerItems(entity)));
    entity.setDynamicProperty(TOTEM_PENDING_KEY, true);
    consumeOneTotem(entity);
    clearPlayerItems(entity);
});

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
