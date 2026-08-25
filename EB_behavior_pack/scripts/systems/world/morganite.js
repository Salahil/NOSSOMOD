import { world, ItemStack } from "@minecraft/server";
import { CONFIG } from "../../config.js";

const SCULK_BLOCKS = new Set([
    "minecraft:sculk",
    "minecraft:sculk_catalyst",
    "minecraft:sculk_sensor",
    "minecraft:sculk_shrieker",
    "minecraft:sculk_vein"
]);

function tryDropMorganite(event) {
    // Após a quebra, event.block já é ar; usar a permutação do bloco quebrado.
    const blockId = event.brokenBlockPermutation?.type?.id;
    if (!blockId || !SCULK_BLOCKS.has(blockId)) return;
    if (Math.random() > CONFIG.morganite.chance) return;

    const { dimension, player, block } = event;
    const loc = block.location;
    dimension.spawnItem(new ItemStack(CONFIG.morganite.item, 1), {
        x: loc.x + 0.5,
        y: loc.y + 0.5,
        z: loc.z + 0.5
    });
    dimension.playSound(CONFIG.morganite.sound, loc);
    player.onScreenDisplay.setActionBar("§d§oUm fragmento de morganita brilhou no escuro...");
}

world.afterEvents.playerBreakBlock.subscribe(tryDropMorganite);
