import { system } from "@minecraft/server";
import { HELL_CORE_ID } from "../../lib/hell_core.js";

/** Ritual da prensa: pistão + ouro + lava + obsidiana chorona → hell_core */
export function tryHellCorePress(event) {
    const { block, dimension, isExpanding } = event;
    if (!isExpanding) return false;

    const face = block.permutation.getState("facing_direction");
    if (face === undefined) return false;

    const offsets = [
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 }
    ];
    const dir = offsets[face] ?? offsets[0];

    const gold = block.getRelative(dir);
    if (gold.typeId !== "minecraft:gold_block") return false;

    const lava = gold.getRelative(dir);
    if (!lava.typeId.includes("lava")) return false;

    const obs = lava.getRelative(dir);
    if (obs.typeId !== "minecraft:crying_obsidian") return false;

    system.runTimeout(() => {
        dimension.spawnParticle("minecraft:huge_explosion_emitter", lava.location);
        dimension.playSound("ambient.weather.thunder", lava.location, { volume: 1.2 });
        dimension.setBlockType(lava.location, HELL_CORE_ID);
        dimension.setBlockType(gold.location, "minecraft:air");
        obs.setType("minecraft:obsidian");
    }, 4);

    return true;
}
