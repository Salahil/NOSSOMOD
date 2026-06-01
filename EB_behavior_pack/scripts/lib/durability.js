import { GameMode } from "@minecraft/server";

const DURABILITY = "minecraft:durability";

export function hasDurability(item) {
    return !!item?.hasComponent(DURABILITY);
}

export function getDamage(item) {
    return item?.getComponent(DURABILITY)?.damage ?? 0;
}

export function getMaxDamage(item) {
    return item?.getComponent(DURABILITY)?.maxDurability ?? 0;
}

export function setDamage(item, value) {
    const comp = item?.getComponent(DURABILITY);
    if (!comp) return item;
    comp.damage = Math.max(0, Math.min(value, comp.maxDurability));
    return item;
}

export function changeDamage(item, delta) {
    if (!item || !hasDurability(item)) return item;
    return setDamage(item, getDamage(item) + delta);
}

export function setMainhand(player, item) {
    player.getComponent("equippable")?.setEquipment("Mainhand", item);
}

export function isCreative(player) {
    try {
        return player.getGameMode() === GameMode.Creative || player.getGameMode() === GameMode.Spectator;
    } catch {
        return false;
    }
}

export function itemHasTag(item, tagId) {
    try {
        return item?.hasTag?.(tagId) === true;
    } catch {
        return false;
    }
}

const AXE = "_axe";
const SWORD = "_sword";
const PICKAXE = "_pickaxe";
const SHOVEL = "_shovel";
const HOE = "_hoe";
const SHEARS = "shears";

export function getToolKind(typeId) {
    if (!typeId) return null;
    if (typeId === "minecraft:shears") return "shears";
    if (typeId.includes(AXE)) return "axe";
    if (typeId.includes(SWORD)) return "sword";
    if (typeId.includes(PICKAXE)) return "pickaxe";
    if (typeId.includes(SHOVEL)) return "shovel";
    if (typeId.includes(HOE)) return "hoe";
    return null;
}

const WOOD_SUFFIX = ["_log", "_wood", "_stem", "_hyphae", "_planks", "_bamboo_block"];
const WOOD_IDS = new Set([
    "minecraft:bamboo",
    "minecraft:melon",
    "minecraft:pumpkin",
    "minecraft:carved_pumpkin",
    "minecraft:lit_pumpkin"
]);

const PLANT_SUFFIX = ["_leaves", "_sapling", "_crop", "_roots", "_sprouts"];
const PLANT_IDS = new Set([
    "minecraft:grass",
    "minecraft:tall_grass",
    "minecraft:fern",
    "minecraft:large_fern",
    "minecraft:dead_bush",
    "minecraft:vine",
    "minecraft:glow_lichen",
    "minecraft:seagrass",
    "minecraft:kelp",
    "minecraft:twisting_vines",
    "minecraft:weeping_vines",
    "minecraft:sugar_cane",
    "minecraft:bamboo",
    "minecraft:cactus",
    "minecraft:sweet_berry_bush",
    "minecraft:nether_wart",
    "minecraft:wheat",
    "minecraft:carrots",
    "minecraft:potatoes",
    "minecraft:beetroot"
]);

const DIRT_IDS = new Set([
    "minecraft:dirt",
    "minecraft:grass_block",
    "minecraft:podzol",
    "minecraft:mycelium",
    "minecraft:dirt_with_roots",
    "minecraft:mud",
    "minecraft:muddy_mangrove_roots",
    "minecraft:farmland",
    "minecraft:dirt_path"
]);

const SAND_GRAVEL = new Set([
    "minecraft:sand",
    "minecraft:red_sand",
    "minecraft:gravel",
    "minecraft:soul_sand",
    "minecraft:soul_soil"
]);

const STONE_SUFFIX = [
    "_ore",
    "_stone",
    "_deepslate",
    "_blackstone",
    "_basalt",
    "_concrete",
    "_terracotta",
    "_brick",
    "_wall",
    "_stairs",
    "_slab"
];
const STONE_IDS = new Set([
    "minecraft:obsidian",
    "minecraft:crying_obsidian",
    "minecraft:netherrack",
    "minecraft:end_stone",
    "minecraft:ancient_debris",
    "minecraft:coal_block",
    "minecraft:iron_block",
    "minecraft:gold_block",
    "minecraft:diamond_block",
    "minecraft:netherite_block"
]);

export function blockCategory(blockId) {
    if (!blockId) return "other";
    if (WOOD_IDS.has(blockId) || WOOD_SUFFIX.some((s) => blockId.includes(s))) return "wood";
    if (PLANT_IDS.has(blockId) || PLANT_SUFFIX.some((s) => blockId.includes(s))) return "plant";
    if (DIRT_IDS.has(blockId)) return "dirt";
    if (SAND_GRAVEL.has(blockId)) return "sand";
    if (STONE_IDS.has(blockId) || STONE_SUFFIX.some((s) => blockId.includes(s))) return "stone";
    return "other";
}

export function isSlimeFamily(typeId) {
    return typeId === "minecraft:slime" || typeId === "minecraft:magma_cube";
}

export function snapshotArmor(player) {
    const equip = player.getComponent("equippable");
    if (!equip) return {};
    const snap = {};
    for (const slot of ["Head", "Chest", "Legs", "Feet"]) {
        const item = equip.getEquipment(slot);
        if (item && hasDurability(item)) snap[slot] = getDamage(item);
    }
    return snap;
}

export function applyArmorSnapReduction(player, beforeSnap, multiplier) {
    const equip = player.getComponent("equippable");
    if (!equip || !beforeSnap) return;
    for (const slot of ["Head", "Chest", "Legs", "Feet"]) {
        if (beforeSnap[slot] === undefined) continue;
        const item = equip.getEquipment(slot);
        if (!item || !hasDurability(item)) continue;
        const after = getDamage(item);
        const delta = after - beforeSnap[slot];
        if (delta <= 0) continue;
        setDamage(item, beforeSnap[slot] + delta * multiplier);
        equip.setEquipment(slot, item);
    }
}
