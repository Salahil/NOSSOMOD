import { world, system } from "@minecraft/server";
import { getRuneById } from "../../config.js";

system.runInterval(() => {
    for (const dimId of ["overworld", "nether", "the_end"]) {
        const dim = world.getDimension(dimId);
        if (dim.getPlayers().length === 0) continue;

        for (const entity of dim.getEntities({ type: "minecraft:item" })) {
            try {
                const stack = entity.getComponent("item")?.itemStack;
                if (!stack) continue;

                if (getRuneById(stack.typeId)) {
                    tryApplyRune(entity, dim, stack.typeId);
                }
            } catch { /* entidade inválida */ }
        }
    }
}, 20);

function getAnvilOnHellCore(dim, loc) {
    let anvil = dim.getBlock(loc);
    if (anvil.typeId !== "minecraft:anvil") {
        anvil = dim.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
    }
    if (anvil?.typeId !== "minecraft:anvil") return null;
    const below = anvil.offset({ x: 0, y: -1, z: 0 });
    if (below?.typeId !== "enormousbedrock:hell_core") return null;
    return anvil;
}

function tryApplyRune(runeEntity, dim, runeId) {
    const loc = runeEntity.location;
    if (!getAnvilOnHellCore(dim, loc)) return;

    const runeDef = getRuneById(runeId);
    const nearby = dim.getEntities({ type: "minecraft:item", location: loc, maxDistance: 1.5 });

    for (const other of nearby) {
        if (other.id === runeEntity.id) continue;
        const equipStack = other.getComponent("item")?.itemStack;
        if (!equipStack) continue;
        if (equipStack.typeId.includes("rune") || equipStack.typeId.includes("fragment")) continue;

        const lore = equipStack.getLore() || [];
        if (lore.includes(runeDef.name)) continue;

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
