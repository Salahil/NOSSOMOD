export const CONFIG = {
    // Morganita
    morganite: {
        item: "enormousbedrock:morganite_fragment",
        chance: 0.1, // 10%
        targetBlock: "minecraft:sculk",
        sound: "mob.ghast.scream"
    },
    // Totem
    totem: {
        full: "enormousbedrock:totem_of_greed",
        broken: "enormousbedrock:broken_totem",
        containers: ["minecraft:chest", "minecraft:trapped_chest", "minecraft:barrel"]
    },
    // Mana
    mana: {
        max_base: 20,
        symbol_full: "§b●",
        symbol_empty: "§7○"
    },
    // Runas (Definição dos IDs e Nomes)
    runes: {
        warrior:  { id: "enormousbedrock:warrior_rune",  name: "§cRuna: Guerreiro", trigger: "minecraft:iron_ingot" },
        emperor:  { id: "enormousbedrock:emperor_rune",  name: "§eRuna: Imperador", trigger: "minecraft:gold_ingot" },
        tinker:   { id: "enormousbedrock:tinker_rune",   name: "§6Runa: Artífice",  trigger: "minecraft:copper_ingot" },
        noble:    { id: "enormousbedrock:noble_rune",    name: "§bRuna: Nobre",     trigger: "minecraft:diamond" },
        immortal: { id: "enormousbedrock:immortal_rune", name: "§0Runa: Imortal",   trigger: "minecraft:netherite_ingot" },
        sorcerer: { id: "enormousbedrock:sorcerer_rune", name: "§dRuna: Feiticeiro",trigger: "minecraft:nether_star" },
        guardian: { id: "enormousbedrock:guardian_rune", name: "§5Runa: Guardião",  trigger: "minecraft:amethyst_shard" },
        devil:    { id: "enormousbedrock:devil_rune",    name: "§4Runa: Diabo",     trigger: "minecraft:redstone" }
    }
};

// Função auxiliar para achar runa pelo ingrediente
export function getRuneByIngredient(ingredientId) {
    return Object.values(CONFIG.runes).find(r => r.trigger === ingredientId);
}

// Função auxiliar para achar runa pelo ID do item
export function getRuneById(itemId) {
    return Object.values(CONFIG.runes).find(r => r.id === itemId);
}