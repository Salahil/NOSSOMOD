import { world } from "@minecraft/server";
import { CONFIG } from "../config.js";

function shouldNegateDamage(player, cause) {
    const equip = player.getComponent("equippable");
    if (!equip) return false;

    const chest = equip.getEquipment("Chest");
    const head = equip.getEquipment("Head");
    const legs = equip.getEquipment("Legs");
    const feet = equip.getEquipment("Feet");

    if (chest?.getLore()?.includes(CONFIG.runes.noble.name)) {
        if (cause === "fire" || cause === "fire_tick" || cause === "lava" || cause === "magma") {
            return true;
        }
    }

    if (head?.getLore()?.includes(CONFIG.runes.tinker.name) && cause === "lightning") {
        return true;
    }

    if (cause === "fall" && feet?.getLore()?.includes(CONFIG.runes.noble.name)) {
        return true;
    }

    if (legs?.getLore()?.includes(CONFIG.runes.guardian.name) && Math.random() < 0.15) {
        player.onScreenDisplay.setActionBar("§5§lEsquivou!");
        player.dimension.playSound("item.trident.return", player.location, { pitch: 1.5 });
        return true;
    }

    return false;
}

function applyRuneCombat(player, cause, event) {
    if (!shouldNegateDamage(player, cause)) return;

    if (event.cancel !== undefined) {
        event.cancel = true;
        return;
    }

    const hp = player.getComponent("health");
    const damage = event.damage ?? 0;
    if (hp && damage > 0) {
        hp.setCurrentValue(Math.min(hp.currentValue + damage, hp.effectiveMax));
    }
}

const hurtBefore = world.beforeEvents?.entityHurt;
if (hurtBefore) {
    hurtBefore.subscribe((event) => {
        const victim = event.hurtEntity;
        if (victim.typeId !== "minecraft:player") return;
        applyRuneCombat(victim, event.damageSource?.cause, event);
    });
} else {
    world.afterEvents.entityHurt.subscribe((event) => {
        const victim = event.hurtEntity;
        if (victim.typeId !== "minecraft:player") return;
        applyRuneCombat(victim, event.damageSource?.cause, event);
    });
}

world.afterEvents.entityHitEntity.subscribe((event) => {
    const attacker = event.damagingEntity;
    const victim = event.hitEntity;

    if (attacker.typeId !== "minecraft:player") return;

    const item = attacker.getComponent("equippable")?.getEquipment("Mainhand");
    if (!item) return;
    const lore = item.getLore() || [];

    if (lore.includes(CONFIG.runes.warrior.name)) {
        const hp = attacker.getComponent("health");
        if (hp) hp.setCurrentValue(Math.min(hp.currentValue + 2, hp.effectiveMax));
        attacker.dimension.spawnParticle("minecraft:heart_particle", attacker.location);
    }

    if (lore.includes(CONFIG.runes.tinker.name) && Math.random() < 0.3) {
        victim.dimension.spawnEntity("minecraft:lightning_bolt", victim.location);
    }
});
