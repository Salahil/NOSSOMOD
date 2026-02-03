import { world, system, ItemStack } from "@minecraft/server";
import { CONFIG, getRuneByIngredient, getRuneById } from "../config.js";

// Roda a cada segundo para checar itens no chão (Rituais)
system.runInterval(() => {
    const dims = ["overworld", "nether", "the_end"];
    for (const d of dims) {
        const dim = world.getDimension(d);
        // Otimização: Só busca se tiver players na dimensão
        if (dim.getPlayers().length === 0) continue;

        const items = dim.getEntities({ type: "minecraft:item" });
        for (const entity of items) {
            try {
                const stack = entity.getComponent("item").itemStack;
                
                // 1. Criar Runa (Runa Vazia + Ingrediente)
                if (stack.typeId === "enormousbedrock:empty_rune") {
                    tryCraftRune(entity, dim);
                }
                // 2. Aplicar Runa (Runa Pronta + Equip)
                else if (getRuneById(stack.typeId)) {
                    tryApplyRune(entity, dim, stack.typeId);
                }
            } catch (e) {}
        }
    }
}, 20);

// Ritual do Núcleo (Prensa)
world.afterEvents.pistonActivate.subscribe((event) => {
    // ... (Copiar aquele código do pistão aqui) ...
    // Vou resumir para caber na resposta, mas use a lógica do pistão que já aprovamos.
    const { block, dimension, isExpanding } = event;
    if (!isExpanding) return;
    const face = block.permutation.getState("facing_direction");
    const gold = block.getRelative(face);
    if (gold.typeId !== "minecraft:gold_block") return;
    const lava = gold.getRelative(face);
    if (!lava.typeId.includes("lava")) return;
    const obs = lava.getRelative(face);
    if (obs.typeId !== "minecraft:crying_obsidian") return;

    system.runTimeout(() => {
        dimension.spawnParticle("minecraft:huge_explosion_emitter", lava.location);
        dimension.setBlockType(lava.location, "enormousbedrock:hell_core");
        dimension.setBlockType(gold.location, "minecraft:air"); // Limpa onde o ouro estava
        obs.setType("minecraft:obsidian");
    }, 4);
});

function tryCraftRune(runeEntity, dim) {
    const loc = runeEntity.location;
    // Checa Mesa + Núcleo
    let table = dim.getBlock(loc);
    if (table.typeId !== "minecraft:enchanting_table") table = dim.getBlock({x:loc.x, y:loc.y-1, z:loc.z});
    if (table?.typeId !== "minecraft:enchanting_table" || table.getRelative("down").typeId !== "enormousbedrock:hell_core") return;

    const nearby = dim.getEntities({ type: "minecraft:item", location: loc, maxDistance: 1.5 });
    for (const other of nearby) {
        if (other.id === runeEntity.id) continue;
        const ingStack = other.getComponent("item").itemStack;
        const runeDef = getRuneByIngredient(ingStack.typeId);
        
        if (runeDef) {
            // Sucesso
            dim.spawnParticle("minecraft:totem_particle", loc);
            dim.playSound("block.enchanting_table.use", loc);
            dim.spawnItem(new ItemStack(runeDef.id, 1), loc);
            runeEntity.kill();
            other.kill();
            break;
        }
    }
}

function tryApplyRune(runeEntity, dim, runeId) {
    const loc = runeEntity.location;
    let table = dim.getBlock(loc);
    if (table.typeId !== "minecraft:enchanting_table") table = dim.getBlock({x:loc.x, y:loc.y-1, z:loc.z});
    if (table?.typeId !== "minecraft:enchanting_table" || table.getRelative("down").typeId !== "enormousbedrock:hell_core") return;

    const nearby = dim.getEntities({ type: "minecraft:item", location: loc, maxDistance: 1.5 });
    const runeDef = getRuneById(runeId);

    for (const other of nearby) {
        if (other.id === runeEntity.id) continue;
        const equipStack = other.getComponent("item").itemStack;
        
        // Verifica se é equipável (não é outra runa)
        if (!equipStack.typeId.includes("rune") && !equipStack.typeId.includes("fragment")) {
            let lore = equipStack.getLore() || [];
            
            if (!lore.includes(runeDef.name)) {
                lore.push(runeDef.name);
                equipStack.setLore(lore);
                
                dim.spawnItem(equipStack, loc);
                dim.spawnParticle("minecraft:knockback_roar_particle", loc);
                dim.playSound("block.anvil.use", loc);
                
                runeEntity.kill();
                other.kill();
                break;
            }
        }
    }
}