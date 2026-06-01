import { ItemStack, world } from "@minecraft/server";

export const RUNE_WORKBENCH_ID = "enormousbedrock:rune_workbench";
export const ENCHANT_TABLE_ID = "minecraft:enchanting_table";

export function locKey(dim, loc) {
    return `${dim.id}:${loc.x},${loc.y},${loc.z}`;
}

export function getBlockContainer(block) {
    return block?.getComponent("minecraft:inventory")?.container;
}

export function serializeContainer(container) {
    if (!container) return [];
    const out = [];
    for (let i = 0; i < container.size; i++) {
        const stack = container.getItem(i);
        if (!stack) continue;
        out.push({
            slot: i,
            typeId: stack.typeId,
            amount: stack.amount,
            lore: stack.getLore() ?? []
        });
    }
    return out;
}

export function writeContainer(container, entries) {
    if (!container) return;
    for (let i = 0; i < container.size; i++) container.setItem(i, undefined);
    for (const entry of entries) {
        const stack = new ItemStack(entry.typeId, entry.amount);
        if (entry.lore?.length) stack.setLore(entry.lore);
        container.setItem(entry.slot, stack);
    }
}

export function loadSavedInventory(dim, loc) {
    const raw = world.getDynamicProperty(`eb_wb_${locKey(dim, loc)}`);
    if (!raw) return [];
    try {
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export function saveInventory(dim, loc, container) {
    world.setDynamicProperty(`eb_wb_${locKey(dim, loc)}`, JSON.stringify(serializeContainer(container)));
}

export function clearSavedInventory(dim, loc) {
    world.setDynamicProperty(`eb_wb_${locKey(dim, loc)}`, undefined);
}
