/** Limites Y típicos do mundo Bedrock (Overworld/Nether/End). */
export const WORLD_Y_MIN = -64;
export const WORLD_Y_MAX = 320;

export function isYInWorld(y) {
    return y >= WORLD_Y_MIN && y <= WORLD_Y_MAX;
}

export function safeGetBlock(dimension, x, y, z) {
    if (!dimension || !isYInWorld(Math.floor(y))) return undefined;
    try {
        return dimension.getBlock({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) });
    } catch {
        return undefined;
    }
}

/** API 2.0 — prefira block.setType em vez de dimension.setBlockType. */
export function setBlockId(dimension, loc, typeId) {
    const block = safeGetBlock(dimension, loc.x, loc.y, loc.z);
    if (!block) return false;
    try {
        block.setType(typeId);
        return true;
    } catch {
        return false;
    }
}
