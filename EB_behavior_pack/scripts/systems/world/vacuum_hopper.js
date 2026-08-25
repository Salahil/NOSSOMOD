import { world, system, ItemStack } from "@minecraft/server";
import { CONFIG } from "../../config.js";
import { isVacuumHopper, isHellCore, ADJACENT_OFFSETS, blockPosAdd, isPosInBuildBounds } from "../../lib/hell_core.js";

const { radius, pullStrength, collectHeight, tickInterval } = CONFIG.vacuumHopper;

function hopperIntakePos(hopperPos) {
    return {
        x: hopperPos.x + 0.5,
        y: hopperPos.y + 1 + collectHeight,
        z: hopperPos.z + 0.5
    };
}

function tryStoreInHopper(dim, hopperPos, itemEntity) {
    const block = dim.getBlock(hopperPos);
    const stack = itemEntity.getComponent("item")?.itemStack;
    if (!stack) return false;

    const inv = block?.getComponent("minecraft:inventory");
    const container = inv?.container;
    if (container) {
        for (let slot = 0; slot < container.size; slot++) {
            const existing = container.getItem(slot);
            if (!existing) {
                container.setItem(slot, stack);
                itemEntity.kill();
                return true;
            }
            if (existing.typeId === stack.typeId && existing.amount < existing.maxAmount) {
                const space = existing.maxAmount - existing.amount;
                const move = Math.min(space, stack.amount);
                existing.amount += move;
                container.setItem(slot, existing);
                if (move >= stack.amount) {
                    itemEntity.kill();
                } else {
                    itemEntity.getComponent("item").itemStack = new ItemStack(stack.typeId, stack.amount - move);
                }
                return true;
            }
        }
    }

    // Fallback: deixa o item em cima do funil para o vanilla recolher
    const intake = hopperIntakePos(hopperPos);
    itemEntity.teleport(intake);
    return false;
}

function pullItemToward(itemEntity, target) {
    const loc = itemEntity.location;
    const dx = target.x - loc.x;
    const dy = target.y - loc.y;
    const dz = target.z - loc.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 0.12) return dist;

    const step = Math.min(pullStrength, dist * 0.4);
    itemEntity.teleport({
        x: loc.x + (dx / dist) * step,
        y: loc.y + (dy / dist) * step,
        z: loc.z + (dz / dist) * step
    });
    return dist;
}

function collectVacuumTargets(dim, center, scan) {
    const hoppers = [];
    const cores = [];
    const cx = Math.floor(center.x);
    const cy = Math.floor(center.y);
    const cz = Math.floor(center.z);

    const yMin = dim.heightRange?.min ?? -64;
    const yMax = dim.heightRange?.max ?? 320;

    for (let x = cx - scan; x <= cx + scan; x++) {
        for (let y = Math.max(cy - scan, yMin); y <= Math.min(cy + scan, yMax); y++) {
            for (let z = cz - scan; z <= cz + scan; z++) {
                const pos = { x, y, z };
                if (!isPosInBuildBounds(dim, pos)) continue;
                if (isVacuumHopper(dim, pos)) hoppers.push(pos);
                try {
                    if (isHellCore(dim.getBlock(pos))) cores.push(pos);
                } catch { /* fora dos limites */ }
            }
        }
    }
    return { hoppers, cores };
}

function nearestHopperForItem(hoppers, itemLoc) {
    let bestHopper = null;
    let bestDist = radius + 1;

    for (const hopperPos of hoppers) {
        const hx = hopperPos.x + 0.5;
        const hy = hopperPos.y + 0.5;
        const hz = hopperPos.z + 0.5;
        const d = Math.sqrt(
            (itemLoc.x - hx) ** 2 + (itemLoc.y - hy) ** 2 + (itemLoc.z - hz) ** 2
        );
        if (d < bestDist) {
            bestDist = d;
            bestHopper = hopperPos;
        }
    }
    return bestHopper;
}

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const dim = player.dimension;
        const scan = radius + 3;
        const { hoppers, cores } = collectVacuumTargets(dim, player.location, scan);
        if (hoppers.length === 0) continue;

        const items = dim.getEntities({
            type: "minecraft:item",
            location: player.location,
            maxDistance: scan + 6
        });

        for (const itemEntity of items) {
            const iloc = itemEntity.location;
            let targetHopper = nearestHopperForItem(hoppers, iloc);

            if (!targetHopper && cores.length > 0) {
                let bestCore = null;
                let bestCoreDist = radius + 1;
                for (const corePos of cores) {
                    const d = Math.sqrt(
                        (iloc.x - corePos.x - 0.5) ** 2 +
                        (iloc.y - corePos.y - 0.5) ** 2 +
                        (iloc.z - corePos.z - 0.5) ** 2
                    );
                    if (d < bestCoreDist) {
                        bestCoreDist = d;
                        bestCore = corePos;
                    }
                }
                if (bestCore) {
                    for (const off of ADJACENT_OFFSETS) {
                        const adj = blockPosAdd(bestCore, off);
                        if (dim.getBlock(adj)?.typeId === "minecraft:hopper") {
                            targetHopper = adj;
                            break;
                        }
                    }
                }
            }

            if (!targetHopper) continue;

            const intake = hopperIntakePos(targetHopper);
            const dist = pullItemToward(itemEntity, intake);
            if (dist < 1.2) {
                tryStoreInHopper(dim, targetHopper, itemEntity);
            }
        }
    }
}, tickInterval);
