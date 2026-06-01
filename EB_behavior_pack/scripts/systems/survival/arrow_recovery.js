import { world, ItemStack } from "@minecraft/server";
import { CONFIG } from "../../config.js";

const ARROW_HITS_KEY = "eb_arrow_hits";
const RECOVERABLE_MOBS = new Set([
    "minecraft:zombie",
    "minecraft:drowned",
    "minecraft:husk",
    "minecraft:skeleton",
    "minecraft:stray",
    "minecraft:bogged",
    "minecraft:pillager",
    "minecraft:vindicator",
    "minecraft:evoker",
    "minecraft:witch",
    "minecraft:piglin",
    "minecraft:piglin_brute",
    "minecraft:zombified_piglin"
]);

function registerArrowHit(victim) {
    if (!victim || !RECOVERABLE_MOBS.has(victim.typeId)) return;
    const hits = victim.getDynamicProperty(ARROW_HITS_KEY) ?? 0;
    victim.setDynamicProperty(ARROW_HITS_KEY, hits + 1);
}

world.afterEvents.entityHurt.subscribe((event) => {
    if (event.damageSource.damagingProjectile?.typeId !== "minecraft:arrow") return;
    registerArrowHit(event.hurtEntity);
});

world.afterEvents.entityDie.subscribe((event) => {
    const entity = event.deadEntity;
    if (!entity || !RECOVERABLE_MOBS.has(entity.typeId)) return;

    const hits = entity.getDynamicProperty(ARROW_HITS_KEY) ?? 0;
    if (hits <= 0) return;

    let recovered = 0;
    for (let i = 0; i < hits; i++) {
        if (Math.random() < CONFIG.durability.arrowRecoveryChance) recovered++;
    }

    if (recovered > 0) {
        entity.dimension.spawnItem(
            new ItemStack("minecraft:arrow", recovered),
            entity.location
        );
    }
    entity.setDynamicProperty(ARROW_HITS_KEY, undefined);
});
