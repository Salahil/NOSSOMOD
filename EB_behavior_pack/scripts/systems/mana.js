import { world, system } from "@minecraft/server";
import { CONFIG } from "../config.js";

// Loop de Regeneração e UI
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        updateMana(player);
    }
}, 20); // 1 segundo

// Ganha mana ao matar mobs
world.afterEvents.entityDie.subscribe((event) => {
    const attacker = event.damageSource.damagingEntity;
    if (attacker?.typeId === "minecraft:player") {
        addMana(attacker, 5);
    }
});

function updateMana(player) {
    let current = player.getDynamicProperty("mana_current") ?? 0;
    let max = player.getDynamicProperty("mana_max") ?? CONFIG.mana.max_base;

    // Regen passiva (1 por segundo)
    // Se tiver Runa do Feiticeiro no capacete, regenera +1 (Total 2)
    const helmet = player.getComponent("equippable")?.getEquipment("Head");
    const regen = (helmet?.getLore()?.includes(CONFIG.runes.sorcerer.name)) ? 2 : 1;

    current = Math.min(current + regen, max);
    player.setDynamicProperty("mana_current", current);

    // Renderiza a Action Bar
    const pct = Math.min(current / max, 1);
    const filled = Math.floor(pct * 10);
    const bar = `§bMana: ` + CONFIG.mana.symbol_full.repeat(filled) + CONFIG.mana.symbol_empty.repeat(10 - filled) + ` §f(${Math.floor(current)}/${max})`;
    player.onScreenDisplay.setActionBar(bar);
}

export function addMana(player, amount) {
    let current = player.getDynamicProperty("mana_current") ?? 0;
    let max = player.getDynamicProperty("mana_max") ?? CONFIG.mana.max_base;
    player.setDynamicProperty("mana_current", Math.min(current + amount, max));
}

export function consumeMana(player, amount) {
    let current = player.getDynamicProperty("mana_current") ?? 0;
    if (current >= amount) {
        player.setDynamicProperty("mana_current", current - amount);
        return true;
    }
    return false;
}