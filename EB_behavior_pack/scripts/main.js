import { world, system, ItemStack, EntityComponentTypes, ItemComponentTypes } from "@minecraft/server";

// --- CONFIGURAÇÕES ---
const CONFIG = {
    morganite: {
        item: "enormousbedrock:morganite_fragment",
        chance: 1 / 10, // 1 em 10 (aprox 10%)
        targetBlock: "minecraft:sculk",
        sound: "mob.ghast.scream" // Grito aterrorizante
    },
    totem: {
        full: "enormousbedrock:totem_of_greed",
        broken: "enormousbedrock:broken_totem",
        validContainers: ["minecraft:chest", "minecraft:trapped_chest", "minecraft:barrel"]
    }
};

// ==========================================================
// 1. SISTEMA DE DROP DA MORGANITA (SCULK + FORTUNA 3)
// ==========================================================
world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { block, player, dimension } = event;

    if (block.typeId !== CONFIG.morganite.targetBlock) return;
    if (player.getGameMode() === "creative") return;

    const inventory = player.getComponent(EntityComponentTypes.Inventory);
    const mainHandItem = inventory.container.getItem(player.selectedSlotIndex);

    if (!mainHandItem) return;

    const enchantments = mainHandItem.getComponent(ItemComponentTypes.Enchantable);
    if (!enchantments) return;

    if (enchantments.hasEnchantment("silk_touch")) return;
    
    const fortuneEnchant = enchantments.getEnchantment("fortune");
    const fortuneLevel = fortuneEnchant ? fortuneEnchant.level : 0;

    if (fortuneLevel < 3) return;

    // Rola o dado
    if (Math.random() < CONFIG.morganite.chance) {
        const location = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
        
        dimension.spawnItem(new ItemStack(CONFIG.morganite.item, 1), location);
        // O som que você pediu:
        dimension.playSound(CONFIG.morganite.sound, location, { volume: 0.8, pitch: 0.8 });
        dimension.spawnParticle("minecraft:soul_particle", location);
    }
});

// ==========================================================
// 2. SISTEMA DO TOTEM DA GANÂNCIA
// ==========================================================

// PARTE A: VINCULAR (Agachar + Clicar no Baú)
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, block, itemStack } = event;

    // Verifica se é baú ou barril
    if (!CONFIG.totem.validContainers.includes(block.typeId)) return;

    // Verifica se está segurando o totem
    if (!itemStack || itemStack.typeId !== CONFIG.totem.full) return;

    // Verifica se está agachado (obrigatório para evitar acidentes)
    if (!player.isSneaking) return;

    // --- LÓGICA DE VINCULO ---
    // Cancela a abertura do baú (para não abrir a tela)
    event.cancel = true;

    // Executa a lógica no próximo tick para evitar conflitos
    system.run(() => {
        const inventory = block.getComponent("inventory").container;
        const playerInv = player.getComponent(EntityComponentTypes.Inventory).container;

        // Tenta adicionar o totem ao baú
        const leftovers = inventory.addItem(itemStack);

        if (!leftovers) {
            // Se coube, remove da mão do jogador
            playerInv.setItem(player.selectedSlotIndex, undefined);
            
            // Salva coordenadas
            const locationData = JSON.stringify({
                x: block.location.x, 
                y: block.location.y, 
                z: block.location.z, 
                dim: block.dimension.id
            });
            player.setDynamicProperty("totem_chest_loc", locationData);

            // Feedback Visual e Sonoro (Partículas do END)
            player.sendMessage("§5§lPACTO SELADO:§r §dEste baú agora guarda sua alma.");
            player.dimension.playSound("block.end_portal.spawn", block.location);
            
            // Cria uma "explosão" de partículas
            for (let i = 0; i < 20; i++) {
                player.dimension.spawnParticle("minecraft:end_chest_particle", {
                    x: block.location.x + 0.5 + (Math.random() - 0.5),
                    y: block.location.y + 0.5 + (Math.random() - 0.5),
                    z: block.location.z + 0.5 + (Math.random() - 0.5)
                });
            }
        } else {
            player.sendMessage("§cO baú está cheio! Não cabe o Totem.");
        }
    });
});

// PARTE B: MORTE (Salvar Itens)
world.beforeEvents.entityDie.subscribe((event) => {
    const player = event.deadEntity;
    if (player.typeId !== "minecraft:player") return;

    const savedLoc = player.getDynamicProperty("totem_chest_loc");
    if (!savedLoc) return;

    const loc = JSON.parse(savedLoc);
    const dimension = world.getDimension(loc.dim);
    
    // Tenta carregar o bloco (pode falhar se estiver muito longe/unloaded)
    // Nota: Em scripts simples, acessar blocos em chunks não carregados é uma limitação.
    try {
        const chestBlock = dimension.getBlock({ x: loc.x, y: loc.y, z: loc.z });
        
        if (!chestBlock || !CONFIG.totem.validContainers.includes(chestBlock.typeId)) {
            player.sendMessage("§cSeu Baú da Ganância foi destruído ou não foi encontrado!");
            return;
        }

        const chestInv = chestBlock.getComponent("inventory").container;
        
        // Procura o Totem Inteiro no baú
        let totemSlot = -1;
        for (let i = 0; i < chestInv.size; i++) {
            const item = chestInv.getItem(i);
            if (item && item.typeId === CONFIG.totem.full) {
                totemSlot = i;
                break;
            }
        }

        if (totemSlot === -1) {
            player.sendMessage("§cO Totem da Ganância não está mais no baú!");
            return;
        }

        // --- REALIZAR O PACTO ---
        
        // 1. Quebra o Totem
        chestInv.setItem(totemSlot, new ItemStack(CONFIG.totem.broken, 1));

        // 2. Transfere Inventário
        const playerInv = player.getComponent(EntityComponentTypes.Inventory).container;
        
        for (let i = 0; i < playerInv.size; i++) {
            const item = playerInv.getItem(i);
            if (item) {
                const resto = chestInv.addItem(item);
                // Se coube, limpa do jogador. Se não, fica no jogador e cai no chão.
                if (!resto) {
                    playerInv.setItem(i, undefined);
                } else {
                    playerInv.setItem(i, resto);
                }
            }
        }

        player.sendMessage("§5§lGANÂNCIA:§r §dSeus itens foram salvos pelo pacto.");
        dimension.playSound("mob.endermen.portal", chestBlock.location);
        
    } catch (e) {
        console.warn("Erro ao acessar baú distante: " + e);
    }
});