export const CONFIG = {
    // Morganita
    morganite: {
        item: "enormousbedrock:morganite_fragment",
        // Produção: ~0.01–0.05. Testes: 0.5 ou 1.0
        chance: 0.5,
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
    },
    hellCore: {
        id: "enormousbedrock:hell_core"
    },
    goldenEgg: {
        item: "enormousbedrock:golden_egg",
        emptySpawner: "enormousbedrock:empty_spawner",
        chickenDropChance: 0.001
    },
    runeForge: {
        emptyRune: "enormousbedrock:empty_rune",
        // Janela em ticks após usar a mesa (60s)
        sessionWindowTicks: 1200,
        // Verifica inventário para converter runa após encantar
        convertPollTicks: 5,
        // Distância máxima do jogador até a mesa vinculada no momento da conversão
        maxDistanceFromTable: 6,
        // Probabilidade ponderada por tier (soma não precisa ser 1)
        tiers: {
            1: [
                { id: "enormousbedrock:warrior_rune", weight: 65 },
                { id: "enormousbedrock:guardian_rune", weight: 35 }
            ],
            2: [
                { id: "enormousbedrock:noble_rune", weight: 55 },
                { id: "enormousbedrock:tinker_rune", weight: 30 },
                { id: "enormousbedrock:sorcerer_rune", weight: 15 }
            ],
            3: [
                { id: "enormousbedrock:emperor_rune", weight: 60 },
                { id: "enormousbedrock:immortal_rune", weight: 28 },
                { id: "enormousbedrock:devil_rune", weight: 12 }
            ]
        },
        lightning: {
            radius: 20,
            minSeconds: 5,
            maxSeconds: 15,
            scanIntervalTicks: 80
        }
    },
    vacuumHopper: {
        radius: 8,
        pullStrength: 0.99,
        collectHeight: 0.65,
        tickInterval: 4
    },
    pistonBuff: {
        maxChain: 12,
        immovableBlocks: [
            "minecraft:bedrock",
            "minecraft:obsidian",
            "minecraft:crying_obsidian",
            "minecraft:barrier",
            "minecraft:end_portal",
            "minecraft:end_portal_frame",
            "minecraft:nether_portal",
            "minecraft:respawn_anchor"
        ]
    },
    durability: {
        tags: {
            oxidationImmune: "enormousbedrock:oxidation_immune",
            fireImmune: "enormousbedrock:fire_immune_armor"
        },
        tool: {
            correctUseSaveChance: 0.55,
            wrongUseExtraDamage: 1,
            swordOnMobSaveChance: 0.7,
            swordOnPlantExtra: 3,
            slimeDissolveDamage: 4,
            axeOnShieldSaveChance: 0.5
        },
        armor: {
            combatWearMultiplier: 0.22,
            fireDamagePerTick: 5,
            waterDamageInterval: 40,
            waterDamageAmount: 3
        },
        arrowRecoveryChance: 0.2
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