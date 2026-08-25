import { world, system } from "@minecraft/server";
import { CONFIG } from "../../config.js";
import {
    blockCategory,
    getToolKind,
    hasDurability,
    changeDamage,
    setMainhand,
    isCreative,
    isSlimeFamily,
    itemHasTag,
    snapshotArmor,
    applyArmorSnapReduction
} from "../../lib/durability.js";

const D = CONFIG.durability;
const armorSnap = new Map();

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        armorSnap.set(player.id, snapshotArmor(player));
    }
}, 1);

function isOxidationImmune(item) {
    return itemHasTag(item, D.tags.oxidationImmune);
}

function isFireImmune(item) {
    return itemHasTag(item, D.tags.fireImmune);
}

function evaluateToolUse(toolId, blockId) {
    const tool = getToolKind(toolId);
    const block = blockCategory(blockId);

    if (!tool) return { correct: null, multiplier: 1 };

    if (tool === "axe") {
        if (block === "wood") return { correct: true, multiplier: 1 };
        if (block === "dirt" || block === "plant") return { correct: false, multiplier: 2 };
        return { correct: false, multiplier: 2 };
    }
    if (tool === "pickaxe") {
        if (block === "stone") return { correct: true, multiplier: 1 };
        if (block === "wood" || block === "dirt" || block === "plant") return { correct: false, multiplier: 2 };
        return { correct: false, multiplier: 1.5 };
    }
    if (tool === "shovel") {
        if (block === "dirt" || block === "sand") return { correct: true, multiplier: 1 };
        if (block === "stone" || block === "wood") return { correct: false, multiplier: 2 };
        return { correct: false, multiplier: 1.5 };
    }
    if (tool === "sword" || tool === "hoe") {
        if (block === "plant") return { correct: false, multiplier: 3 };
        return { correct: false, multiplier: 2 };
    }
    if (tool === "shears") {
        if (block === "plant" || block === "wood") return { correct: true, multiplier: 1 };
        return { correct: false, multiplier: 2 };
    }
    return { correct: null, multiplier: 1 };
}

world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { player, block } = event;
    if (isCreative(player)) return;

    const item = event.itemStackAfterBreak ?? player.getComponent("equippable")?.getEquipment("Mainhand");
    if (!item || !hasDurability(item)) return;

    const blockId = event.brokenBlockPermutation?.type?.id ?? block?.typeId;
    const use = evaluateToolUse(item.typeId, blockId);
    if (use.correct === null) return;

    let adjusted = item;
    if (use.correct && Math.random() < D.tool.correctUseSaveChance) {
        adjusted = changeDamage(adjusted, -1);
    } else if (!use.correct) {
        adjusted = changeDamage(adjusted, D.tool.wrongUseExtraDamage);
    }
    setMainhand(player, adjusted);
});

world.afterEvents.entityHurt.subscribe((event) => {
    const victim = event.hurtEntity;
    if (victim?.typeId === "minecraft:player") {
        const snap = armorSnap.get(victim.id);
        if (snap) {
            applyArmorSnapReduction(victim, snap, D.armor.combatWearMultiplier);
        }
        armorSnap.set(victim.id, snapshotArmor(victim));
        return;
    }

    const source = event.damageSource;
    const attacker = source.damagingEntity;
    if (attacker?.typeId !== "minecraft:player") return;

    const weapon = attacker.getComponent("equippable")?.getEquipment("Mainhand");
    if (!weapon || !hasDurability(weapon)) return;

    const tool = getToolKind(weapon.typeId);
    if (tool !== "sword") return;

    let adjusted = weapon;
    if (isSlimeFamily(victim.typeId)) {
        adjusted = changeDamage(adjusted, D.tool.slimeDissolveDamage);
    } else if (Math.random() < D.tool.swordOnMobSaveChance) {
        adjusted = changeDamage(adjusted, -1);
    }
    setMainhand(attacker, adjusted);
});

world.afterEvents.entityHitEntity.subscribe((event) => {
    const attacker = event.damagingEntity;
    const victim = event.hitEntity;
    if (attacker?.typeId !== "minecraft:player" || victim?.typeId !== "minecraft:player") return;

    const weapon = attacker.getComponent("equippable")?.getEquipment("Mainhand");
    if (!weapon || getToolKind(weapon.typeId) !== "axe") return;

    const off = victim.getComponent("equippable")?.getEquipment("Offhand");
    if (off?.typeId !== "minecraft:shield") return;

    if (Math.random() < D.tool.axeOnShieldSaveChance) {
        setMainhand(attacker, changeDamage(weapon, -1));
    }
});

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        if (isCreative(player)) continue;

        const equip = player.getComponent("equippable");
        if (!equip) continue;

        const onFire = player.getComponent("onfire")?.onFire ?? false;
        const inWater = player.isInWater;

        for (const slot of ["Head", "Chest", "Legs", "Feet"]) {
            const item = equip.getEquipment(slot);
            if (!item || !hasDurability(item)) continue;

            let piece = item;
            let changed = false;

            if (onFire && !isFireImmune(piece)) {
                piece = changeDamage(piece, D.armor.fireDamagePerTick);
                changed = true;
            }

            if (inWater && !isOxidationImmune(piece) && system.currentTick % D.armor.waterDamageInterval === 0) {
                piece = changeDamage(piece, D.armor.waterDamageAmount);
                changed = true;
            }

            if (changed) equip.setEquipment(slot, piece);
        }
    }
}, 10);
