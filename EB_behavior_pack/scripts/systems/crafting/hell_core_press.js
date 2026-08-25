import { system, world, ItemStack } from "@minecraft/server";
import { safeGetBlock, setBlockId } from "../../lib/blocks.js";
import { HELL_CORE_ID } from "../../lib/hell_core.js";

// Armazena rituais ativos
const activeRituals = new Map();
const RITUAL_DURATION = 5 * 20; // 5 segundos em ticks
const PARTICLE_RATE_MAX = 10;

function posKey(dimId, pos) {
    return `${dimId}:${pos.x},${pos.y},${pos.z}`;
}

function isLavaSource(block) {
    if (!block) return false;
    if (block.typeId !== "minecraft:lava" && block.typeId !== "minecraft:flowing_lava") return false;
    // Verifica o estado de liquid_depth (para fonte é 0)
    try {
        const perm = block.permutation;
        const depth = perm.getState("liquid_depth");
        return depth === 0;
    } catch (e) {
        return block.typeId === "minecraft:lava";
    }
}

function isCryingObsidian(block) {
    return block?.typeId === "minecraft:crying_obsidian";
}

function checkRitual(dimension, pos) {
    console.log("Verificando ritual na posição:", pos);
    
    // Verifica se o centro é fonte de lava
    const center = safeGetBlock(dimension, pos.x, pos.y, pos.z);
    console.log("Centro é lava fonte:", isLavaSource(center));
    if (!isLavaSource(center)) return false;

    // Verifica as 4 direções horizontais + abaixo
    const checks = [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
        { x: 0, y: -1, z: 0 }
    ];

    let allObsidian = true;
    for (const off of checks) {
        const checkPos = {
            x: pos.x + off.x,
            y: pos.y + off.y,
            z: pos.z + off.z
        };
        const checkBlock = safeGetBlock(dimension, checkPos.x, checkPos.y, checkPos.z);
        const isObsidian = isCryingObsidian(checkBlock);
        console.log(`Posição ${checkPos.x},${checkPos.y},${checkPos.z} é obsidiana chorona: ${isObsidian}`);
        if (!isObsidian) {
            allObsidian = false;
        }
    }
    
    console.log("Todos os lados são obsidiana chorona:", allObsidian);
    return allObsidian;
}

function startRitual(dimension, pos) {
    const key = posKey(dimension.id, pos);
    if (activeRituals.has(key)) return;

    console.log("INICIANDO RITUAL na posição:", pos);
    activeRituals.set(key, {
        dimension,
        pos: { ...pos },
        startTick: system.currentTick
    });
}

function completeRitual(ritual) {
    const { dimension, pos } = ritual;
    console.log("COMPLETANDO RITUAL na posição:", pos);

    // 1. Substituir a lava central por ar primeiro (evita queimar o item)
    setBlockId(dimension, pos, "minecraft:air");

    // 2. Explodir (mas não destruir nada)
    try {
        dimension.createExplosion(
            { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 },
            1,
            { breaksBlocks: false, causesFire: false }
        );
    } catch (e) {
        console.error("Erro explodindo:", e);
    }

    // 3. Spawnar item do Hell Core ACIMA da posição central (evita cair na lava)
    try {
        console.log("Spawnando item:", HELL_CORE_ID);
        const hellCoreItem = new ItemStack(HELL_CORE_ID, 1);
        const itemEntity = dimension.spawnItem(
            hellCoreItem,
            { x: pos.x + 0.5, y: pos.y + 1.2, z: pos.z + 0.5 }
        );
        console.log("Item spawnado com sucesso:", itemEntity?.typeId);
    } catch (e) {
        console.error("Erro ao spawnar item:", e);
    }

    // 4. Convertendo as obsidianas choronas para normal (4 laterais + abaixo)
    const obsidianPositions = [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
        { x: 0, y: -1, z: 0 }
    ];
    for (const off of obsidianPositions) {
        const op = {
            x: pos.x + off.x,
            y: pos.y + off.y,
            z: pos.z + off.z
        };
        setBlockId(dimension, op, "minecraft:obsidian");
    }

    // 5. Convertendo areia da alma para terra da alma em raio de 5 blocos
    for (let dx = -5; dx <= 5; dx++) {
        for (let dz = -5; dz <= 5; dz++) {
            for (let dy = -2; dy <= 2; dy++) {
                const checkPos = {
                    x: pos.x + dx,
                    y: pos.y + dy,
                    z: pos.z + dz
                };
                const block = safeGetBlock(dimension, checkPos.x, checkPos.y, checkPos.z);
                if (block?.typeId === "minecraft:soul_sand") {
                    setBlockId(dimension, checkPos, "minecraft:soul_soil");
                }
            }
        }
    }

    activeRituals.delete(posKey(dimension.id, pos));
}

function updateRituals() {
    const toRemove = [];

    for (const [key, ritual] of activeRituals) {
        const elapsed = system.currentTick - ritual.startTick;
        const progress = Math.min(elapsed / RITUAL_DURATION, 1);
        const particleRate = Math.floor(progress * PARTICLE_RATE_MAX);

        // Spawnar partículas de alma nas obsidianas choronas
        const pos = ritual.pos;
        const obsidianPositions = [
            { x: 1, y: 0, z: 0 },
            { x: -1, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 },
            { x: 0, y: 0, z: -1 },
            { x: 0, y: -1, z: 0 }
        ];

        for (const off of obsidianPositions) {
            const op = {
                x: pos.x + off.x + 0.5,
                y: pos.y + off.y + 1, // Acima da obsidiana
                z: pos.z + off.z + 0.5
            };

            for (let i = 0; i < particleRate; i++) {
                try {
                    ritual.dimension.spawnParticle(
                        "minecraft:soul_particle",
                        op
                    );
                } catch (e) {}
            }
        }

        if (elapsed >= RITUAL_DURATION) {
            completeRitual(ritual);
            toRemove.push(key);
        }
    }

    for (const k of toRemove) {
        activeRituals.delete(k);
    }
}

// Verificar quando blocos são colocados
world.afterEvents.playerPlaceBlock.subscribe((event) => {
    const { block, dimension } = event;
    console.log("Bloco colocado:", block.typeId, block.location);

    // Se colocou lava, checa se ritual está completo
    if (isLavaSource(block)) {
        console.log("Lava fonte colocada, verificando ritual");
        if (checkRitual(dimension, block.location)) {
            startRitual(dimension, block.location);
        }
    }

    // Se colocou obsidiana chorona, checa se ritual está completo
    if (isCryingObsidian(block)) {
        console.log("Obsidiana chorona colocada, verificando em volta");
        // Verifica em volta para encontrar centro de lava
        const nearbyChecks = [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: -1, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 },
            { x: 0, y: 0, z: -1 },
            { x: 0, y: 1, z: 0 }
        ];

        for (const off of nearbyChecks) {
            const checkPos = {
                x: block.location.x + off.x,
                y: block.location.y + off.y,
                z: block.location.z + off.z
            };
            if (checkRitual(dimension, checkPos)) {
                startRitual(dimension, checkPos);
            }
        }
    }
});

// Loop de atualização dos rituais
system.runInterval(updateRituals, 1);

// Verifica periodicamente todos os blocos de lava
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const dimension = player.dimension;
        const px = Math.floor(player.location.x);
        const py = Math.floor(player.location.y);
        const pz = Math.floor(player.location.z);
        
        // Procura lava fonte em volta do player
        for (let dx = -16; dx <= 16; dx++) {
            for (let dy = -8; dy <= 8; dy++) {
                for (let dz = -16; dz <= 16; dz++) {
                    const pos = {
                        x: px + dx,
                        y: py + dy,
                        z: pz + dz
                    };
                    const block = safeGetBlock(dimension, pos.x, pos.y, pos.z);
                    if (isLavaSource(block)) {
                        if (checkRitual(dimension, pos)) {
                            startRitual(dimension, pos);
                        }
                    }
                }
            }
        }
    }
}, 40); // Verifica a cada 2 segundos
