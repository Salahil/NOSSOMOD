import { world, system, ItemStack, BlockPermutation, EquipmentSlot } from "@minecraft/server";
import { CONFIG } from "../../config.js";

const GOLDEN_EGG_ID = CONFIG.goldenEgg.item;
const EMPTY_SPAWNER_ID = CONFIG.goldenEgg.emptySpawner;
const VANILLA_SPAWNER_ID = "minecraft:mob_spawner";

console.log("[GoldenEgg] Script inicializado. IDs: egg=" + GOLDEN_EGG_ID + " empty=" + EMPTY_SPAWNER_ID);

const VANILLA_SPAWN_EGG_MAP = {
    "minecraft:zombie": "minecraft:zombie_spawn_egg",
    "minecraft:creeper": "minecraft:creeper_spawn_egg",
    "minecraft:skeleton": "minecraft:skeleton_spawn_egg",
    "minecraft:spider": "minecraft:spider_spawn_egg",
    "minecraft:zombified_piglin": "minecraft:zombie_pigman_spawn_egg",
    "minecraft:enderman": "minecraft:enderman_spawn_egg",
    "minecraft:blaze": "minecraft:blaze_spawn_egg",
    "minecraft:magma_cube": "minecraft:magma_cube_spawn_egg",
    "minecraft:ghast": "minecraft:ghast_spawn_egg",
    "minecraft:cave_spider": "minecraft:cave_spider_spawn_egg",
    "minecraft:silverfish": "minecraft:silverfish_spawn_egg",
    "minecraft:slime": "minecraft:slime_spawn_egg",
    "minecraft:witch": "minecraft:witch_spawn_egg",
    "minecraft:guardian": "minecraft:guardian_spawn_egg",
    "minecraft:elder_guardian": "minecraft:elder_guardian_spawn_egg",
    "minecraft:wither_skeleton": "minecraft:wither_skeleton_spawn_egg",
    "minecraft:stray": "minecraft:stray_spawn_egg",
    "minecraft:husk": "minecraft:husk_spawn_egg",
    "minecraft:zombie_villager": "minecraft:zombie_villager_spawn_egg",
    "minecraft:evoker": "minecraft:evocation_illager_spawn_egg",
    "minecraft:vindicator": "minecraft:vindicator_spawn_egg",
    "minecraft:vex": "minecraft:vex_spawn_egg",
    "minecraft:illusioner": "minecraft:illusioner_spawn_egg",
    "minecraft:drowned": "minecraft:drowned_spawn_egg",
    "minecraft:hoglin": "minecraft:hoglin_spawn_egg",
    "minecraft:piglin": "minecraft:piglin_spawn_egg",
    "minecraft:piglin_brute": "minecraft:piglin_brute_spawn_egg",
    "minecraft:zoglin": "minecraft:zoglin_spawn_egg",
    "minecraft:sheep": "minecraft:sheep_spawn_egg",
    "minecraft:pig": "minecraft:pig_spawn_egg",
    "minecraft:cow": "minecraft:cow_spawn_egg",
    "minecraft:chicken": "minecraft:chicken_spawn_egg",
    "minecraft:rabbit": "minecraft:rabbit_spawn_egg",
    "minecraft:mooshroom": "minecraft:mooshroom_spawn_egg",
    "minecraft:squid": "minecraft:squid_spawn_egg",
    "minecraft:bat": "minecraft:bat_spawn_egg",
    "minecraft:ocelot": "minecraft:ocelot_spawn_egg",
    "minecraft:wolf": "minecraft:wolf_spawn_egg",
    "minecraft:horse": "minecraft:horse_spawn_egg",
    "minecraft:donkey": "minecraft:donkey_spawn_egg",
    "minecraft:mule": "minecraft:mule_spawn_egg",
    "minecraft:skeleton_horse": "minecraft:skeleton_horse_spawn_egg",
    "minecraft:zombie_horse": "minecraft:zombie_horse_spawn_egg",
    "minecraft:parrot": "minecraft:parrot_spawn_egg",
    "minecraft:dolphin": "minecraft:dolphin_spawn_egg",
    "minecraft:tropicalfish": "minecraft:tropical_fish_spawn_egg",
    "minecraft:pufferfish": "minecraft:pufferfish_spawn_egg",
    "minecraft:salmon": "minecraft:salmon_spawn_egg",
    "minecraft:cod": "minecraft:cod_spawn_egg",
    "minecraft:turtle": "minecraft:turtle_spawn_egg",
    "minecraft:phantom": "minecraft:phantom_spawn_egg",
    "minecraft:panda": "minecraft:panda_spawn_egg",
    "minecraft:pillager": "minecraft:pillager_spawn_egg",
    "minecraft:ravager": "minecraft:ravager_spawn_egg",
    "minecraft:wandering_trader": "minecraft:wandering_trader_spawn_egg",
    "minecraft:villager": "minecraft:villager_spawn_egg",
    "minecraft:cat": "minecraft:cat_spawn_egg",
    "minecraft:fox": "minecraft:fox_spawn_egg",
    "minecraft:bee": "minecraft:bee_spawn_egg",
    "minecraft:strider": "minecraft:strider_spawn_egg",
    "minecraft:axolotl": "minecraft:axolotl_spawn_egg",
    "minecraft:glow_squid": "minecraft:glow_squid_spawn_egg",
    "minecraft:goat": "minecraft:goat_spawn_egg",
    "minecraft:warden": "minecraft:warden_spawn_egg",
    "minecraft:frog": "minecraft:frog_spawn_egg",
    "minecraft:tadpole": "minecraft:tadpole_spawn_egg",
    "minecraft:allay": "minecraft:allay_spawn_egg",
    "minecraft:iron_golem": "minecraft:iron_golem_spawn_egg",
    "minecraft:bogged": "minecraft:bogged_spawn_egg",
    "minecraft:breeze": "minecraft:breeze_spawn_egg",
    "minecraft:armadillo": "minecraft:armadillo_spawn_egg",
    "minecraft:camel": "minecraft:camel_spawn_egg",
    "minecraft:sniffer": "minecraft:sniffer_spawn_egg",
    "minecraft:ender_dragon": "minecraft:ender_dragon_spawn_egg",
    "minecraft:wither": "minecraft:wither_spawn_egg"
};

function resolveSpawnEggId(entityTypeId) {
    if (!entityTypeId) return null;
    if (VANILLA_SPAWN_EGG_MAP[entityTypeId]) return VANILLA_SPAWN_EGG_MAP[entityTypeId];
    if (entityTypeId.includes(":")) {
        const [ns, name] = entityTypeId.split(":");
        return `${ns}:${name}_spawn_egg`;
    }
    return `minecraft:${entityTypeId}_spawn_egg`;
}

function spawnEggItemExists(spawnEggId) {
    try {
        const item = new ItemStack(spawnEggId, 1);
        return item && item.typeId === spawnEggId;
    } catch (e) {
        console.warn("[GoldenEgg] spawnEggItemExists falhou para " + spawnEggId + ": " + e);
        return false;
    }
}

function giveItemToPlayer(player, itemStack) {
    try {
        const inv = player.getComponent("inventory")?.container;
        if (inv && typeof inv.addItem === "function") {
            const leftover = inv.addItem(itemStack);
            if (leftover && leftover.amount > 0) {
                player.dimension.spawnItem(leftover, player.location);
            }
            return true;
        }
    } catch (e) {
        console.warn("[GoldenEgg] Falha ao adicionar no inventário: " + e);
    }
    player.dimension.spawnItem(itemStack, player.location);
    return true;
}

function getEquippable(player) {
    if (!player) return null;
    try {
        let comp = player.getComponent("minecraft:equippable");
        if (comp) return comp;
    } catch (e) {
        console.warn("[GoldenEgg] getComponent minecraft:equippable falhou: " + e);
    }
    try {
        let comp = player.getComponent("equippable");
        if (comp) return comp;
    } catch (e) {
        console.warn("[GoldenEgg] getComponent equippable falhou: " + e);
    }
    try {
        if (player.equipment) return player.equipment;
    } catch (e) {
        console.warn("[GoldenEgg] player.equipment falhou: " + e);
    }
    return null;
}

function getHeldMainhand(player) {
    const equip = getEquippable(player);
    if (!equip) {
        console.warn("[GoldenEgg] Componente equippable indisponível para o jogador " + (player.nameTag || player.name || player.id));
        return null;
    }
    try {
        if (typeof equip.getEquipment === "function") {
            let slotId = EquipmentSlot ? EquipmentSlot.Mainhand : "Mainhand";
            try {
                return equip.getEquipment(slotId);
            } catch (e1) {
                try { return equip.getEquipment("Mainhand"); } catch (e2) {
                    console.warn("[GoldenEgg] Ambas as chamadas getEquipment falharam: " + e1 + " | " + e2);
                }
            }
        }
    } catch (e) {
        console.warn("[GoldenEgg] getHeldMainhand erro: " + e);
    }
    return null;
}

function setHeldMainhand(player, itemStack) {
    const equip = getEquippable(player);
    if (!equip) return false;
    try {
        if (typeof equip.setEquipment === "function") {
            let slotId = EquipmentSlot ? EquipmentSlot.Mainhand : "Mainhand";
            try {
                equip.setEquipment(slotId, itemStack);
                return true;
            } catch (e1) {
                try { equip.setEquipment("Mainhand", itemStack); return true; } catch (e2) {}
            }
        }
    } catch (e) {
        console.warn("[GoldenEgg] setHeldMainhand erro: " + e);
    }
    return false;
}

function hasOneGoldenEgg(player) {
    const held = getHeldMainhand(player);
    return !!(held && held.typeId === GOLDEN_EGG_ID && held.amount >= 1);
}

function consumeOneGoldenEgg(player) {
    const held = getHeldMainhand(player);
    if (!held || held.typeId !== GOLDEN_EGG_ID || held.amount < 1) {
        console.warn("[GoldenEgg] consumeOneGoldenEgg falhou: item não encontrado na mão");
        return false;
    }
    if (held.amount > 1) {
        held.amount -= 1;
        const ok = setHeldMainhand(player, held);
        if (!ok) console.warn("[GoldenEgg] consumeOneGoldenEgg: setEquipment retornou false (stack)");
        return ok;
    } else {
        const ok = setHeldMainhand(player, undefined);
        if (!ok) console.warn("[GoldenEgg] consumeOneGoldenEgg: clear mão falhou");
        return ok;
    }
}

function getSpawnerEntityTypeId(block) {
    try {
        const comp = block.getComponent("minecraft:spawner");
        if (comp && comp.entityType && comp.entityType.id) {
            return comp.entityType.id;
        }
    } catch (e) {
        console.warn("[GoldenEgg] getSpawnerEntityTypeId componente spawner falhou: " + e);
    }
    try {
        const perm = block.permutation;
        if (!perm || !perm.getState) return null;
        const candidates = [
            "spawner_entity_identifier",
            "minecraft:entity_type",
            "entity_type",
            "SpawnData"
        ];
        for (const key of candidates) {
            try {
                const v = perm.getState(key);
                if (typeof v === "string" && v.length > 0) return v;
            } catch {}
        }
    } catch (e) {
        console.warn("[GoldenEgg] getSpawnerEntityTypeId permutation state falhou: " + e);
    }
    try {
        const data = block.getDynamicProperty("spawner_entity_identifier") ||
                     block.getDynamicProperty("entity_type");
        if (typeof data === "string" && data) return data;
    } catch (e) {
        console.warn("[GoldenEgg] getSpawnerEntityTypeId dynamic prop falhou: " + e);
    }
    return null;
}

function clearSpawnerBlock(block) {
    try {
        block.setPermutation(BlockPermutation.resolve(EMPTY_SPAWNER_ID));
        return true;
    } catch (e1) {
        try {
            block.setType(EMPTY_SPAWNER_ID);
            return true;
        } catch (e2) {
            console.error("[GoldenEgg] clearSpawnerBlock falhou ambos os métodos: " + e1 + " | " + e2);
            return false;
        }
    }
}

function handleSpawnerInteract(player, block) {
    console.log("[GoldenEgg] handleSpawnerInteract iniciado com block=" + block.typeId + " player=" + (player.name || player.id));
    const entityTypeId = getSpawnerEntityTypeId(block);
    if (!entityTypeId) {
        player.onScreenDisplay.setActionBar("§cEste gerador está vazio ou não possui entidade vinculada.");
        console.warn("[GoldenEgg] Spawner sem entidade");
        return false;
    }
    console.log("[GoldenEgg] Spawner tem entidade: " + entityTypeId);

    if (!hasOneGoldenEgg(player)) {
        console.warn("[GoldenEgg] Jogador não tem golden egg na mão");
        return false;
    }

    const spawnEggId = resolveSpawnEggId(entityTypeId);
    if (!spawnEggId || !spawnEggItemExists(spawnEggId)) {
        player.onScreenDisplay.setActionBar(`§cSem ovo de spawn correspondente para: ${entityTypeId}`);
        console.warn("[GoldenEgg] Sem ovo correspondente a " + entityTypeId + " -> " + spawnEggId);
        return false;
    }

    if (!clearSpawnerBlock(block)) {
        player.onScreenDisplay.setActionBar("§cFalha ao limpar o gerador.");
        return false;
    }

    if (!consumeOneGoldenEgg(player)) {
        console.error("[GoldenEgg] CONSUMO FALHOU após limpar o spawner! Rolback não é possível.");
        return false;
    }

    const spawnedItem = new ItemStack(spawnEggId, 1);
    giveItemToPlayer(player, spawnedItem);

    const loc = block.location;
    try { block.dimension.playSound("random.orb", loc); } catch (e) {}
    try {
        block.dimension.spawnParticle("minecraft:egg_destroy", {
            x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5
        });
    } catch (e) {}
    player.onScreenDisplay.setActionBar(`§e§lGerador limpo! Obtido ovo de spawn (${entityTypeId}).`);
    console.log("[GoldenEgg] Spawner limpo com sucesso");
    return true;
}

console.log("[GoldenEgg] Registrando beforeEvents.playerInteractWithBlock (handler de spawner).");
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    try {
        const { player, block } = event;
        if (!player || !block) return;

        if (block.typeId !== VANILLA_SPAWNER_ID) return;

        const held = getHeldMainhand(player);
        if (!held || held.typeId !== GOLDEN_EGG_ID) return;

        console.log("[GoldenEgg] Evento spawner interact aceito. block=" + block.typeId + " held=" + (held?.typeId));
        event.cancel = true;
        system.run(() => {
            try {
                handleSpawnerInteract(player, block);
            } catch (err) {
                console.error("[GoldenEgg] Erro em handleSpawnerInteract (system.run): " + err);
            }
        });
    } catch (e) {
        console.error("[GoldenEgg] Erro no handler playerInteractWithBlock (spawner): " + e);
    }
});

function handleMobInteract(player, entity) {
    console.log("[GoldenEgg] handleMobInteract iniciado com entity=" + entity.typeId + " player=" + (player.name || player.id));
    const entityTypeId = entity.typeId;
    const spawnEggId = resolveSpawnEggId(entityTypeId);
    if (!spawnEggId || !spawnEggItemExists(spawnEggId)) {
        player.onScreenDisplay.setActionBar(`§cEntidade ${entityTypeId} não tem ovo de spawn correspondente.`);
        console.warn("[GoldenEgg] Entidade " + entityTypeId + " nao tem ovo correspondente -> " + spawnEggId);
        return false;
    }

    if (!hasOneGoldenEgg(player)) {
        console.warn("[GoldenEgg] Jogador não tem golden egg na mão (mob)");
        return false;
    }

    try {
        entity.remove();
    } catch (e) {
        player.onScreenDisplay.setActionBar("§cFalha ao remover entidade.");
        console.error("[GoldenEgg] entity.remove() falhou: " + e);
        return false;
    }

    if (!consumeOneGoldenEgg(player)) {
        console.error("[GoldenEgg] CONSUMO FALHOU após despawnear entidade!");
        return false;
    }

    const spawnedItem = new ItemStack(spawnEggId, 1);
    giveItemToPlayer(player, spawnedItem);

    const loc = player.location;
    try { player.dimension.playSound("mob.chicken.plop", loc); } catch (e) {}
    try { player.dimension.spawnParticle("minecraft:egg_destroy", loc); } catch (e) {}
    player.onScreenDisplay.setActionBar(`§aEntidade capturada! Ovo de spawn (${entityTypeId}) adicionado ao inventário.`);
    console.log("[GoldenEgg] Entidade capturada com sucesso");
    return true;
}

console.log("[GoldenEgg] Registrando afterEvents.playerInteractWithEntity.");
world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    try {
        const { player, target } = event;
        if (!player || !target || !target.isValid()) {
            return;
        }
        if (target.typeId === "minecraft:player" || target.typeId === "minecraft:item") return;

        const held = getHeldMainhand(player);
        if (!held || held.typeId !== GOLDEN_EGG_ID) return;

        console.log("[GoldenEgg] Evento entity interact aceito. entity=" + target.typeId + " held=" + held.typeId);
        handleMobInteract(player, target);
    } catch (e) {
        console.error("[GoldenEgg] Erro no handler playerInteractWithEntity: " + e);
    }
});

console.log("[GoldenEgg] Registrando afterEvents.entityDie (drop de ovo de galinha).");
world.afterEvents.entityDie.subscribe((event) => {
    try {
        const entity = event.deadEntity;
        if (!entity || entity.typeId !== "minecraft:chicken") return;

        if (Math.random() < CONFIG.goldenEgg.chickenDropChance) {
            const dim = entity.dimension;
            const loc = entity.location;

            system.runTimeout(() => {
                try {
                    const items = dim.getEntities({
                        type: "minecraft:item",
                        location: loc,
                        maxDistance: 3
                    });

                    let eggFound = false;
                    for (const itemEnt of items) {
                        try {
                            const itemStack = itemEnt.getComponent("item")?.itemStack;
                            if (itemStack && itemStack.typeId === "minecraft:egg") {
                                itemEnt.remove();
                                eggFound = true;
                                break;
                            }
                        } catch {}
                    }

                    dim.spawnItem(new ItemStack(GOLDEN_EGG_ID, 1), loc);
                    try { dim.playSound("random.levelup", loc); } catch {}
                    if (eggFound) {
                        for (const p of world.getPlayers()) {
                            try {
                                const dist = Math.hypot(p.location.x - loc.x, p.location.y - loc.y, p.location.z - loc.z);
                                if (dist < 12) {
                                    p.onScreenDisplay.setActionBar("§6§lGalinha deixou cair um OVO DOURADO!");
                                }
                            } catch {}
                        }
                    }
                } catch (e) {
                    console.error("[GoldenEgg] Erro no timeout de drop de galinha: " + e);
                }
            }, 2);
        }
    } catch (e) {
        console.error("[GoldenEgg] Erro no handler entityDie: " + e);
    }
});

function isHoldingEmptySpawner(player) {
    const held = getHeldMainhand(player);
    return !!(held && held.typeId === EMPTY_SPAWNER_ID && held.amount >= 1);
}

function consumeOneEmptySpawner(player) {
    const held = getHeldMainhand(player);
    if (!held || held.typeId !== EMPTY_SPAWNER_ID || held.amount < 1) return false;

    if (held.amount > 1) {
        held.amount -= 1;
        return setHeldMainhand(player, held);
    } else {
        return setHeldMainhand(player, undefined);
    }
}

console.log("[GoldenEgg] Registrando beforeEvents.playerPlaceBlock (colocar empty_spawner -> vanilla spawner).");
world.beforeEvents.playerPlaceBlock.subscribe((event) => {
    try {
        const { player, block, permutationToPlace } = event;
        if (!player || !block) return;
        const placeTypeId = permutationToPlace?.type?.id;
        if (placeTypeId !== EMPTY_SPAWNER_ID) return;

        console.log("[GoldenEgg] Evento colocar empty_spawner block, cancelando e substituindo por vanilla.");
        event.cancel = true;
        system.run(() => {
            try {
                try {
                    block.setPermutation(BlockPermutation.resolve(VANILLA_SPAWNER_ID));
                } catch {
                    try { block.setType(VANILLA_SPAWNER_ID); } catch (err) {
                        console.error("[GoldenEgg] Falha ao colocar vanilla spawner (placeBlock): " + err);
                        return;
                    }
                }
                consumeOneEmptySpawner(player);
                try { block.dimension.playSound("dig.stone", block.location); } catch {}
            } catch (e) {
                console.error("[GoldenEgg] Erro no system.run de placeBlock empty: " + e);
            }
        });
    } catch (e) {
        console.error("[GoldenEgg] Erro no handler playerPlaceBlock: " + e);
    }
});

console.log("[GoldenEgg] Registrando beforeEvents.playerInteractWithBlock (colocar empty_spawner pelo topo).");
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    try {
        const { player, block, blockFace } = event;
        if (!player || !block) return;
        if (!isHoldingEmptySpawner(player)) return;
        const above = block.above();
        if (!above) return;
        if (above.typeId !== "minecraft:air") return;

        console.log("[GoldenEgg] Evento interact para empty_spawner no ar acima.");
        event.cancel = true;
        system.run(() => {
            try {
                try {
                    above.setPermutation(BlockPermutation.resolve(VANILLA_SPAWNER_ID));
                } catch {
                    try { above.setType(VANILLA_SPAWNER_ID); } catch (err) {
                        console.error("[GoldenEgg] Falha ao colocar vanilla spawner (interact ar): " + err);
                        return;
                    }
                }
                consumeOneEmptySpawner(player);
                try { above.dimension.playSound("dig.stone", above.location); } catch {}
            } catch (e) {
                console.error("[GoldenEgg] Erro no system.run de interact empty: " + e);
            }
        });
    } catch (e) {
        console.error("[GoldenEgg] Erro no handler playerInteractWithBlock (empty topo): " + e);
    }
});

console.log("[GoldenEgg] Todos os handlers foram registrados com sucesso.");
