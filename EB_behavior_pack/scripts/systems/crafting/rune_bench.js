import { world, system, ItemStack } from "@minecraft/server";
import { CONFIG, getRuneByIngredient } from "../../config.js";
import { HELL_CORE_ID } from "../../lib/hell_core.js";
import {
    RUNE_WORKBENCH_ID,
    getBlockContainer
} from "../../lib/workbench_inventory.js";

const EMPTY_RUNE = "enormousbedrock:empty_rune";

export function tryCraftRuneFromContainer(dim, loc) {
    const block = dim.getBlock(loc);
    const container = getBlockContainer(block);
    if (!container) return false;

    const stacks = [];
    for (let i = 0; i < container.size; i++) {
        const s = container.getItem(i);
        if (s) stacks.push({ slot: i, stack: s });
    }
    if (stacks.length < 2) return false;

    let emptySlot = null;
    let ingSlot = null;
    let ingDef = null;

    for (const { slot, stack } of stacks) {
        if (stack.typeId === EMPTY_RUNE) emptySlot = slot;
    }
    if (emptySlot === null) return false;

    for (const { slot, stack } of stacks) {
        if (slot === emptySlot) continue;
        const def = getRuneByIngredient(stack.typeId);
        if (def) {
            ingSlot = slot;
            ingDef = def;
            break;
        }
    }
    if (!ingDef) return false;

    container.setItem(emptySlot, undefined);
    container.setItem(ingSlot, undefined);

    const center = { x: loc.x + 0.5, y: loc.y + 1, z: loc.z + 0.5 };
    dim.spawnParticle("minecraft:totem_particle", center);
    dim.playSound("block.enchanting_table.use", center);
    dim.spawnItem(new ItemStack(ingDef.id, 1), center);
    return true;
}

export function processWorkbenchAt(dim, loc) {
    if (dim.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z })?.typeId !== HELL_CORE_ID) return;
    const typeId = dim.getBlock(loc)?.typeId;
    if (typeId !== RUNE_WORKBENCH_ID && typeId !== "minecraft:barrel") return;
    tryCraftRuneFromContainer(dim, loc);
}

system.runInterval(() => {
    for (const dimId of ["overworld", "nether", "the_end"]) {
        const dim = world.getDimension(dimId);
        if (dim.getPlayers().length === 0) continue;

        const r = CONFIG.enchantUi?.craftScanRadius ?? 6;
        for (const player of dim.getPlayers()) {
            const px = Math.floor(player.location.x);
            const py = Math.floor(player.location.y);
            const pz = Math.floor(player.location.z);

            for (let x = px - r; x <= px + r; x++) {
                for (let y = py - r; y <= py + r; y++) {
                    for (let z = pz - r; z <= pz + r; z++) {
                        if (dim.getBlock({ x, y, z })?.typeId === RUNE_WORKBENCH_ID) {
                            processWorkbenchAt(dim, { x, y, z });
                        }
                    }
                }
            }
        }
    }
}, 20);
