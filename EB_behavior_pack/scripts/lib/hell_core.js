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

/** API 2.0: getRelative foi substituído por offset. */
export function blockOffset(block, offset) {
    return block?.offset(offset);
}

/** Evita LocationOutOfWorldBoundariesError em varreduras grandes. */
export function isPosInBuildBounds(dim, pos) {
    const range = dim.heightRange;
    if (!range) return pos.y >= -64 && pos.y <= 320;
    return pos.y >= range.min && pos.y <= range.max;
}

export function isHellCore(block) {
    return block?.typeId === HELL_CORE_ID;
}

/** Funil vanilla tocando em um hell_core (qualquer face). */
export function isVacuumHopper(dim, hopperPos) {
    if (!isPosInBuildBounds(dim, hopperPos)) return false;

    let hopper;
    try {
        hopper = dim.getBlock(hopperPos);
    } catch {
        return false;
    }
    if (hopper?.typeId !== "minecraft:hopper") return false;

    for (const off of ADJACENT_OFFSETS) {
        const adj = blockPosAdd(hopperPos, off);
        if (!isPosInBuildBounds(dim, adj)) continue;
        try {
            if (isHellCore(dim.getBlock(adj))) return true;
        } catch { /* fora dos limites */ }
    }
    return false;
}

/** Pistão com hell_core encostado (qualquer face do pistão). */
export function isBuffedPiston(dim, pistonPos) {
    if (!isPosInBuildBounds(dim, pistonPos)) return false;

    let piston;
    try {
        piston = dim.getBlock(pistonPos);
    } catch {
        return false;
    }
    if (!piston?.typeId?.includes("piston")) return false;

    for (const off of ADJACENT_OFFSETS) {
        const adj = blockPosAdd(pistonPos, off);
        if (!isPosInBuildBounds(dim, adj)) continue;
        try {
            if (isHellCore(dim.getBlock(adj))) return true;
        } catch { /* fora dos limites */ }
    }
    return false;
}
