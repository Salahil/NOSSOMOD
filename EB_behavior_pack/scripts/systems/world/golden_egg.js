import { world, system, ItemStack, BlockPermutation } from "@minecraft/server";
import { CONFIG } from "../../config.js";

const GOLDEN_EGG_ID = CONFIG.goldenEgg.item;
const EMPTY_SPAWNER_ID = CONFIG.goldenEgg.emptySpawner;
const VANILLA_SPAWNER_ID = "minecraft:mob_spawner";

function buildSpawnEggId(entityTypeId) {
    if (!entityTypeId) return null;
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
    } catch {
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
    } catch {}
    player.dimension.spawnItem(itemStack, player.location);
    return true;
}

function consumeOneGoldenEgg(player) {
    const equip = player.getComponent("equippable");
    if (!equip) return false;
    const held = equip.getEquipment("Mainhand");
    if (!held || held.typeId !== GOLDEN_EGG_ID || held.amount < 1) return false;

    if (held.amount > 1) {
        held.amount -= 1;
        equip.setEquipment("Mainhand", held);
    } else {
        equip.setEquipment("Mainhand", undefined);
    }
    return true;
}

function getSpawnerEntityTypeId(block) {
    try {
        const comp = block.getComponent("minecraft:spawner");
        if (comp && comp.entityType && comp.entityType.id) {
            return comp.entityType.id;
        }
    } catch {}
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
    } catch {}
    try {
        const data = block.getDynamicProperty("spawner_entity_identifier") ||
                     block.getDynamicProperty("entity_type");
        if (typeof data === "string" && data) return data;
    } catch {}
    return null;
}

function clearSpawnerBlock(block) {
    try {
        block.setPermutation(BlockPermutation.resolve(EMPTY_SPAWNER_ID));
        return true;
    } catch {
        try {
            block.setType(EMPTY_SPAWNER_ID);
            return true;
        } catch {
            return false;
        }
    }
}

function handleSpawnerInteract(player, block) {
    const entityTypeId = getSpawnerEntityTypeId(block);
    if (!entityTypeId) {
        player.onScreenDisplay.setActionBar("§cEste gerador está vazio ou não possui entidade vinculada.");
        return false;
    }

    const spawnEggId = buildSpawnEggId(entityTypeId);
    if (!spawnEggId || !spawnEggItemExists(spawnEggId)) {
        player.onScreenDisplay.setActionBar(`§cSem ovo de spawn correspondente para: ${entityTypeId}`);
        return false;
    }

    if (!clearSpawnerBlock(block)) {
        player.onScreenDisplay.setActionBar("§cFalha ao limpar o gerador.");
        return false;
    }

    if (!consumeOneGoldenEgg(player)) {
        return false;
    }

    const spawnedItem = new ItemStack(spawnEggId, 1);
    giveItemToPlayer(player, spawnedItem);

    const loc = block.location;
    block.dimension.playSound("random.orb", loc);
    block.dimension.spawnParticle("minecraft:egg_destroy", {
        x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5
    });
    player.onScreenDisplay.setActionBar(`§e§lGerador limpo! Obtido ovo de spawn (${entityTypeId}).`);
    return true;
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, block } = event;
    if (block.typeId !== VANILLA_SPAWNER_ID) return;

    const equip = player.getComponent("equippable");
    if (!equip) return;
    const held = equip.getEquipment("Mainhand");
    if (!held || held.typeId !== GOLDEN_EGG_ID) return;

    event.cancel = true;
    system.run(() => {
        handleSpawnerInteract(player, block);
    });
});

function handleMobInteract(player, entity) {
    const entityTypeId = entity.typeId;
    const spawnEggId = buildSpawnEggId(entityTypeId);
    if (!spawnEggId || !spawnEggItemExists(spawnEggId)) {
        player.onScreenDisplay.setActionBar(`§cEntidade ${entityTypeId} não tem ovo de spawn correspondente.`);
        return false;
    }

    try {
        entity.remove();
    } catch {
        player.onScreenDisplay.setActionBar("§cFalha ao remover entidade.");
        return false;
    }

    if (!consumeOneGoldenEgg(player)) {
        return false;
    }

    const spawnedItem = new ItemStack(spawnEggId, 1);
    giveItemToPlayer(player, spawnedItem);

    const loc = player.location;
    player.dimension.playSound("mob.chicken.plop", loc);
    player.dimension.spawnParticle("minecraft:egg_destroy", loc);
    player.onScreenDisplay.setActionBar(`§aEntidade capturada! Ovo de spawn (${entityTypeId}) adicionado ao inventário.`);
    return true;
}

world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const { player, target } = event;
    if (!target || !target.isValid()) return;
    if (target.typeId === "minecraft:player" || target.typeId === "minecraft:item") return;

    const equip = player.getComponent("equippable");
    if (!equip) return;
    const held = equip.getEquipment("Mainhand");
    if (!held || held.typeId !== GOLDEN_EGG_ID) return;

    handleMobInteract(player, target);
});

world.afterEvents.entityDie.subscribe((event) => {
    const entity = event.deadEntity;
    if (!entity || entity.typeId !== "minecraft:chicken") return;

    if (Math.random() < CONFIG.goldenEgg.chickenDropChance) {
        const dim = entity.dimension;
        const loc = entity.location;

        system.runTimeout(() => {
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
        }, 2);
    }
});

function isHoldingEmptySpawner(player) {
    const equip = player.getComponent("equippable");
    if (!equip) return false;
    const held = equip.getEquipment("Mainhand");
    return !!(held && held.typeId === EMPTY_SPAWNER_ID && held.amount >= 1);
}

function consumeOneEmptySpawner(player) {
    const equip = player.getComponent("equippable");
    if (!equip) return false;
    const held = equip.getEquipment("Mainhand");
    if (!held || held.typeId !== EMPTY_SPAWNER_ID || held.amount < 1) return false;

    if (held.amount > 1) {
        held.amount -= 1;
        equip.setEquipment("Mainhand", held);
    } else {
        equip.setEquipment("Mainhand", undefined);
    }
    return true;
}

world.beforeEvents.playerPlaceBlock.subscribe((event) => {
    const { player, block, permutationToPlace } = event;
    const placeTypeId = permutationToPlace?.type?.id;
    if (placeTypeId !== EMPTY_SPAWNER_ID) return;

    event.cancel = true;
    system.run(() => {
        try {
            block.setPermutation(BlockPermutation.resolve(VANILLA_SPAWNER_ID));
        } catch {
            try { block.setType(VANILLA_SPAWNER_ID); } catch { return; }
        }
        consumeOneEmptySpawner(player);
        try { block.dimension.playSound("dig.stone", block.location); } catch {}
    });
});

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, block, blockFace } = event;
    if (!isHoldingEmptySpawner(player)) return;
    const above = block.above();
    if (!above) return;
    if (above.typeId !== "minecraft:air") return;

    event.cancel = true;
    system.run(() => {
        try {
            above.setPermutation(BlockPermutation.resolve(VANILLA_SPAWNER_ID));
        } catch {
            try { above.setType(VANILLA_SPAWNER_ID); } catch { return; }
        }
        consumeOneEmptySpawner(player);
        try { above.dimension.playSound("dig.stone", above.location); } catch {}
    });
});
