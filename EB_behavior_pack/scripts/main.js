import { world, ItemStack } from "@minecraft/server";

// Configuração das chances de drop (0.01 = 1%, 1.0 = 100%)
const DROP_RATES = {
    "minecraft:sculk_sensor": 0.01,    // 1%
    "minecraft:sculk_catalyst": 0.10,  // 10%
    "minecraft:sculk_shrieker": 0.15   // 15%
};

const DROP_ITEM = "enormousbedrock:morganite_fragment";

// Escuta quando um jogador quebra um bloco
world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { block, dimension, player } = event;

    // Verifica se o bloco quebrado está na nossa lista
    const chance = DROP_RATES[block.typeId];

    // Se o bloco for um dos que queremos (chance existe)
    if (chance !== undefined) {
        
        // Se estiver no criativo, ignora (para não dropar enquanto constróis)
        if (player.getGameMode() === "creative") return;

        // Rola o dado (gera número entre 0.0 e 1.0)
        const roll = Math.random();

        // Se o número sorteado for menor que a chance, dropa!
        if (roll < chance) {
            const location = { 
                x: block.location.x + 0.5, 
                y: block.location.y + 0.5, 
                z: block.location.z + 0.5 
            };
            
            dimension.spawnItem(new ItemStack(DROP_ITEM, 1), location);
        }
    }
});