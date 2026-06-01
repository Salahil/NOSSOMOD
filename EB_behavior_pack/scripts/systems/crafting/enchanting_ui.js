import { world, system } from "@minecraft/server";
import { CONFIG } from "../../config.js";
import { HELL_CORE_ID } from "../../lib/hell_core.js";
import {
    RUNE_WORKBENCH_ID,
    ENCHANT_TABLE_ID,
    getBlockContainer,
    loadSavedInventory,
    saveInventory,
    writeContainer
} from "../../lib/workbench_inventory.js";
import { processWorkbenchAt } from "./rune_bench.js";

const BARREL_FALLBACK = "minecraft:barrel";
const activeSessions = new Map();

function hasHellCoreBelow(dim, loc) {
    return dim.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z })?.typeId === HELL_CORE_ID;
}

function isAltarBlock(typeId) {
    return typeId === RUNE_WORKBENCH_ID || typeId === BARREL_FALLBACK;
}

function tryOpenContainer(player, block) {
    if (!block) return;
    const inv = block.getComponent("minecraft:inventory");
    if (typeof inv?.open === "function") {
        try {
            inv.open(player);
            return;
        } catch { /* API indisponível */ }
    }
    if (typeof player.openContainer === "function") {
        try {
            player.openContainer(block.location);
        } catch { /* API indisponível */ }
    }
}

function activateWorkbench(player, dim, loc) {
    const saved = loadSavedInventory(dim, loc);
    dim.setBlockType(loc, RUNE_WORKBENCH_ID);

    system.run(() => {
        let block = dim.getBlock(loc);
        let container = getBlockContainer(block);

        if (!container) {
            dim.setBlockType(loc, BARREL_FALLBACK);
            block = dim.getBlock(loc);
            container = getBlockContainer(block);
        }

        if (container && saved.length) writeContainer(container, saved);

        player.onScreenDisplay.setActionBar(
            "§5§lAltar de Runas §r— §73 slots: qualquer item em qualquer posição"
        );
        dim.playSound("block.enchanting_table.use", {
            x: loc.x + 0.5,
            y: loc.y + 0.5,
            z: loc.z + 0.5
        });
        tryOpenContainer(player, block);
    });

    activeSessions.set(player.id, {
        dimId: dim.id,
        x: loc.x,
        y: loc.y,
        z: loc.z
    });
}

function deactivateWorkbench(dim, loc) {
    const block = dim.getBlock(loc);
    if (!isAltarBlock(block?.typeId)) return;

    processWorkbenchAt(dim, loc);

    const container = getBlockContainer(block);
    if (container) saveInventory(dim, loc, container);

    dim.setBlockType(loc, ENCHANT_TABLE_ID);
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, block, isFirstEvent } = event;
    if (!isFirstEvent) return;

    const dim = block.dimension;
    const loc = block.location;

    if (block.typeId === ENCHANT_TABLE_ID && hasHellCoreBelow(dim, loc)) {
        event.cancel = true;
        activateWorkbench(player, dim, loc);
        return;
    }

    if (block.typeId === RUNE_WORKBENCH_ID && hasHellCoreBelow(dim, loc)) {
        if (player.isSneaking) {
            event.cancel = true;
            deactivateWorkbench(dim, loc);
            activeSessions.delete(player.id);
            player.onScreenDisplay.setActionBar("§7Mesa de encantamentos restaurada.");
            return;
        }

        activeSessions.set(player.id, {
            dimId: dim.id,
            x: loc.x,
            y: loc.y,
            z: loc.z
        });
        system.run(() => tryOpenContainer(player, block));
        return;
    }

    if (block.typeId === BARREL_FALLBACK && hasHellCoreBelow(dim, loc) && activeSessions.has(player.id)) {
        if (player.isSneaking) {
            event.cancel = true;
            deactivateWorkbench(dim, loc);
            activeSessions.delete(player.id);
            player.onScreenDisplay.setActionBar("§7Mesa de encantamentos restaurada.");
        }
    }
});

system.runInterval(() => {
    const closeDist = CONFIG.enchantUi?.closeDistance ?? 8;

    for (const [playerId, session] of activeSessions.entries()) {
        const player = world.getAllPlayers().find((p) => p.id === playerId);
        if (!player) {
            activeSessions.delete(playerId);
            continue;
        }

        const dim = world.getDimension(session.dimId);
        const loc = { x: session.x, y: session.y, z: session.z };
        const block = dim.getBlock(loc);

        if (!isAltarBlock(block?.typeId)) {
            activeSessions.delete(playerId);
            continue;
        }

        const dist = Math.sqrt(
            (player.location.x - loc.x - 0.5) ** 2 +
            (player.location.y - loc.y - 0.5) ** 2 +
            (player.location.z - loc.z - 0.5) ** 2
        );

        if (dist > closeDist) {
            deactivateWorkbench(dim, loc);
            activeSessions.delete(playerId);
        }
    }
}, 20);
