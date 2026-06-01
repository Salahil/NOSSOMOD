import { world, system, ItemStack } from "@minecraft/server";
import { CONFIG } from "../../config.js";
import { isVacuumHopper } from "../../lib/hell_core.js";

const { radius, pullStrength, collectHeight, tickInterval } = CONFIG.vacuumHopper;

function hopperTop(hopperPos) {
    return {
        x: hopperPos.x + 0.5,
        y: hopperPos.y + 1 + collectHeight,
        z: hopperPos.z + 0.5
    };
}

function tryStoreInHopper(dim, hopperPos, itemEntity) {
    const block = dim.getBlock(hopperPos);
    const inv = block?.getComponent("inventory");
    if (!inv?.container) return false;

    const stack = itemEntity.getComponent("item")?.itemStack;
    if (!stack) return false;

    for (let slot = 0; slot < inv.container.size; slot++) {
        const existing = inv.container.getItem(slot);
        if (!existing) {
            inv.container.setItem(slot, stack);
            itemEntity.kill();
            return true;
        }
        if (existing.typeId === stack.typeId && existing.amount < existing.maxAmount) {
            const space = existing.maxAmount - existing.amount;
            const move = Math.min(space, stack.amount);
            existing.amount += move;
            inv.container.setItem(slot, existing);
            if (move >= stack.amount) {
                itemEntity.kill();
            } else {
                const left = stack.amount - move;
                itemEntity.getComponent("item").itemStack = new ItemStack(stack.typeId, left);
            }
            return true;
        }
    }
    return false;
}

function pullItemToward(itemEntity, target) {
    const loc = itemEntity.location;
    const dx = target.x - loc.x;
    const dy = target.y - loc.y;
    const dz = target.z - loc.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 0.15) return dist;

    const step = Math.min(pullStrength, dist * 0.35);
    itemEntity.teleport({
        x: loc.x + (dx / dist) * step,
        y: loc.y + (dy / dist) * step,
        z: loc.z + (dz / dist) * step
    });
    return dist;
}

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const dim = player.dimension;
        const px = Math.floor(player.location.x);
        const py = Math.floor(player.location.y);
        const pz = Math.floor(player.location.z);
        const scan = radius + 2;

        const vacuumHoppers = [];
        for (let x = px - scan; x <= px + scan; x++) {
            for (let y = py - scan; y <= py + scan; y++) {
                for (let z = pz - scan; z <= pz + scan; z++) {
                    const pos = { x, y, z };
                    if (isVacuumHopper(dim, pos)) vacuumHoppers.push(pos);
                }
            }
        }
        if (vacuumHoppers.length === 0) continue;

        const items = dim.getEntities({
            type: "minecraft:item",
            location: player.location,
            maxDistance: scan + 4
        });

        for (const itemEntity of items) {
            const iloc = itemEntity.location;
            let bestHopper = null;
            let bestDist = radius + 1;

            for (const hopperPos of vacuumHoppers) {
                const hx = hopperPos.x + 0.5;
                const hy = hopperPos.y + 0.5;
                const hz = hopperPos.z + 0.5;
                const d = Math.sqrt(
                    (iloc.x - hx) ** 2 + (iloc.y - hy) ** 2 + (iloc.z - hz) ** 2
                );
                if (d < bestDist) {
                    bestDist = d;
                    bestHopper = hopperPos;
                }
            }
            if (!bestHopper) continue;

            const target = hopperTop(bestHopper);
            const dist = pullItemToward(itemEntity, target);

            if (dist < 0.9) {
                tryStoreInHopper(dim, bestHopper, itemEntity);
            }
        }
    }
}, tickInterval);
