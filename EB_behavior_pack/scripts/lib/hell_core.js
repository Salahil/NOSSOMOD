export const HELL_CORE_ID = "enormousbedrock:hell_core";

export const ADJACENT_OFFSETS = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 }
];

/** facing_direction do pistão (0–5) → offset de bloco empurrado */
export const PISTON_FACE_OFFSET = [
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 }
];

export function blockPosAdd(pos, offset) {
    return { x: pos.x + offset.x, y: pos.y + offset.y, z: pos.z + offset.z };
}

export function isHellCore(block) {
    return block?.typeId === HELL_CORE_ID;
}

/** Funil vanilla tocando em um hell_core (qualquer face). */
export function isVacuumHopper(dim, hopperPos) {
    const hopper = dim.getBlock(hopperPos);
    if (hopper?.typeId !== "minecraft:hopper") return false;

    for (const off of ADJACENT_OFFSETS) {
        const core = dim.getBlock(blockPosAdd(hopperPos, off));
        if (isHellCore(core)) return true;
    }
    return false;
}

/** Pistão com hell_core encostado (qualquer face do pistão). */
export function isBuffedPiston(dim, pistonPos) {
    const piston = dim.getBlock(pistonPos);
    if (!piston?.typeId?.includes("piston")) return false;

    for (const off of ADJACENT_OFFSETS) {
        if (isHellCore(dim.getBlock(blockPosAdd(pistonPos, off)))) return true;
    }
    return false;
}
