import { world, system } from "@minecraft/server";
import { CONFIG } from "../../config.js";
import { HELL_CORE_ID, ADJACENT_OFFSETS, PISTON_FACE_OFFSET, blockPosAdd } from "../../lib/hell_core.js";
import { safeGetBlock, setBlockId } from "../../lib/blocks.js";

const IMMOVABLE = new Set(CONFIG.pistonBuff.immovableBlocks);

// Mapa para trackear a última posição conhecida dos hell_cores
const hellCorePositions = new Map();

// Função para gerar uma chave única para cada posição
function posKey(dimId, pos) {
    return `${dimId}:${pos.x},${pos.y},${pos.z}`;
}

// Função para verificar se é um pistão
function isPiston(block) {
    return block?.typeId?.includes("piston");
}

// Função para verificar se o bloco pode ser substituído (ar, água, lava)
function canPlaceBlockAt(dim, pos) {
    const block = safeGetBlock(dim, pos.x, pos.y, pos.z);
    if (!block) return false;
    const id = block.typeId;
    return id === "minecraft:air" || 
           id === "minecraft:water" || 
           id === "minecraft:flowing_water" ||
           id === "minecraft:lava" || 
           id === "minecraft:flowing_lava";
}

// Verifica a situação de pistão + hell_core + bloco imóvel e faz o "empurrão"
function checkAndPushImmovable(dimension, pistonBlock, pistonFace) {
    const dir = PISTON_FACE_OFFSET[pistonFace];
    if (!dir) return;

    // Posição onde o pistão empurra
    const pushedPos = blockPosAdd(pistonBlock.location, dir);
    const pushedBlock = safeGetBlock(dimension, pushedPos.x, pushedPos.y, pushedPos.z);
    
    // Verifica se o bloco a ser empurrado é imóvel
    if (!pushedBlock || !IMMOVABLE.has(pushedBlock.typeId)) return;

    // Posição onde o bloco iria ser empurrado
    const targetPos = blockPosAdd(pushedPos, dir);
    
    // Verifica se o local de destino está livre
    if (!canPlaceBlockAt(dimension, targetPos)) return;

    // Faz o "empurrão": move o bloco imóvel
    const savedBlockType = pushedBlock.typeId;
    const savedBlockPermutation = pushedBlock.permutation;
    
    // Remove o bloco original
    setBlockId(dimension, pushedPos, "minecraft:air");
    
    // Coloca o bloco na nova posição
    const targetBlock = safeGetBlock(dimension, targetPos.x, targetPos.y, targetPos.z);
    if (targetBlock) {
        targetBlock.setPermutation(savedBlockPermutation);
    }
    
    // Adiciona efeitos visuais/som
    try {
        dimension.spawnParticle("minecraft:villager_angry", {
            x: targetPos.x + 0.5,
            y: targetPos.y + 0.5,
            z: targetPos.z + 0.5
        });
        dimension.playSound("dig.stone", targetPos, { pitch: 0.6, volume: 0.8 });
    } catch {}
}

// Sistema de eventos do pistão
world.afterEvents.pistonActivate.subscribe((event) => {
    const { dimension, isExpanding, piston } = event;
    
    // Se não está expandindo, não faz nada
    if (!isExpanding) return;
    
    const pistonBlock = piston?.block;
    if (!pistonBlock) return;
    
    // Verifica se tem hell_core adjacente ao pistão
    let hasAdjacentHellCore = false;
    for (const off of ADJACENT_OFFSETS) {
        const adjPos = blockPosAdd(pistonBlock.location, off);
        const adjBlock = safeGetBlock(dimension, adjPos.x, adjPos.y, adjPos.z);
        if (adjBlock?.typeId === HELL_CORE_ID) {
            hasAdjacentHellCore = true;
            break;
        }
    }
    
    if (!hasAdjacentHellCore) return;
    
    // Verifica a face do pistão e tenta empurrar
    const face = pistonBlock.permutation.getState("facing_direction");
    if (face === undefined) return;
    
    checkAndPushImmovable(dimension, pistonBlock, face);
});

// Sistema para trackear o movimento dos hell_cores
system.runInterval(() => {
    const currentHellCores = new Map();
    
    // Encontra todos os hell_cores no mundo carregado
    for (const player of world.getAllPlayers()) {
        const dimension = player.dimension;
        const px = Math.floor(player.location.x);
        const py = Math.floor(player.location.y);
        const pz = Math.floor(player.location.z);
        
        for (let dx = -16; dx <= 16; dx++) {
            for (let dy = -8; dy <= 8; dy++) {
                for (let dz = -16; dz <= 16; dz++) {
                    const pos = { x: px + dx, y: py + dy, z: pz + dz };
                    const block = safeGetBlock(dimension, pos.x, pos.y, pos.z);
                    
                    if (block?.typeId === HELL_CORE_ID) {
                        const key = posKey(dimension.id, pos);
                        currentHellCores.set(key, { dimension, pos, block });
                    }
                }
            }
        }
    }
    
    // Verifica hell_cores que mudaram de posição
    for (const [key, data] of currentHellCores) {
        // Se não estava no mapa antes, é novo ou se moveu
        if (!hellCorePositions.has(key)) {
            // Verifica se tem pistões adjacentes
            for (const off of ADJACENT_OFFSETS) {
                const adjPos = blockPosAdd(data.pos, off);
                const adjBlock = safeGetBlock(data.dimension, adjPos.x, adjPos.y, adjPos.z);
                
                if (isPiston(adjBlock)) {
                    const face = adjBlock.permutation.getState("facing_direction");
                    if (face !== undefined) {
                        checkAndPushImmovable(data.dimension, adjBlock, face);
                    }
                }
            }
        }
    }
    
    // Atualiza o mapa de posições
    hellCorePositions.clear();
    for (const [key, data] of currentHellCores) {
        hellCorePositions.set(key, true);
    }
}, 2);
