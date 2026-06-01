import { world, system } from "@minecraft/server";
import { CONFIG } from "../../config.js";
import { isBuffedPiston, PISTON_FACE_OFFSET, blockPosAdd } from "../../lib/hell_core.js";
import { tryHellCorePress } from "../crafting/hell_core_press.js";

const IMMOVABLE = new Set(CONFIG.pistonBuff.immovableBlocks);

function canPlaceBlock(dim, pos) {
    const block = dim.getBlock(pos);
    if (!block) return false;
    const id = block.typeId;
    if (id === "minecraft:air") return true;
    if (id === "minecraft:water" || id === "minecraft:flowing_water") return true;
    if (id === "minecraft:lava" || id === "minecraft:flowing_lava") return true;
    return false;
}

function tryPushImmovableChain(event) {
    const { block, dimension, isExpanding } = event;
    if (!isExpanding) return;
    if (!isBuffedPiston(dimension, block.location)) return;

    const face = block.permutation.getState("facing_direction");
    if (face === undefined) return;

    const dir = PISTON_FACE_OFFSET[face];
    if (!dir) return;

    let current = block.getRelative(dir);
    const maxChain = CONFIG.pistonBuff.maxChain;

    for (let i = 0; i < maxChain; i++) {
        const typeId = current?.typeId;
        if (!typeId || typeId === "minecraft:air") break;

        if (!IMMOVABLE.has(typeId)) {
            current = current.getRelative(dir);
            continue;
        }

        const destPos = blockPosAdd(current.location, dir);
        if (!canPlaceBlock(dimension, destPos)) break;

        const savedType = typeId;
        const savedLoc = { ...current.location };

        system.runTimeout(() => {
            try {
                dimension.setBlockType(savedLoc, "minecraft:air");
                dimension.setBlockType(destPos, savedType);
                dimension.spawnParticle("minecraft:villager_angry", {
                    x: destPos.x + 0.5,
                    y: destPos.y + 0.5,
                    z: destPos.z + 0.5
                });
                dimension.playSound("dig.stone", destPos, { pitch: 0.6, volume: 0.8 });
            } catch { /* chunk descarregado */ }
        }, 2);

        break;
    }
}

world.afterEvents.pistonActivate.subscribe((event) => {
    if (tryHellCorePress(event)) return;
    tryPushImmovableChain(event);
});
