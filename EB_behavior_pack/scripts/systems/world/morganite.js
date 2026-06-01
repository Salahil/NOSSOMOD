import { world, ItemStack } from "@minecraft/server";
import { CONFIG } from "../../config.js";

world.afterEvents.playerBreakBlock.subscribe((event) => {
    const blockId = event.block?.typeId;
    if (blockId !== CONFIG.morganite.targetBlock) return;
    if (Math.random() > CONFIG.morganite.chance) return;

    const { dimension, player } = event;
    const loc = event.block.location;
    dimension.spawnItem(new ItemStack(CONFIG.morganite.item, 1), {
        x: loc.x + 0.5,
        y: loc.y + 0.5,
        z: loc.z + 0.5
    });
    dimension.playSound(CONFIG.morganite.sound, loc);
    player.onScreenDisplay.setActionBar("§d§oUm fragmento de morganita brilhou no escuro...");
});
