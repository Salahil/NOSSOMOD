// Importa os sistemas para que eles comecem a rodar
import "./systems/mana.js";
import "./systems/combat.js";
import "./systems/passive.js";
import "./systems/crafting.js";

// Lógica isolada que sobrou (Drop da Morganita e Totem)
// Você pode mover isso para um systems/world.js se quiser ser perfeccionista,
// mas pode deixar aqui também.

import { world, system, ItemStack, EntityComponentTypes, ItemComponentTypes } from "@minecraft/server";
import { CONFIG } from "./config.js";

// Drop Morganita
world.afterEvents.playerBreakBlock.subscribe((event) => {
    // ... (Código do drop que já fizemos) ...
    // Use CONFIG.morganite...
});

// Totem
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    // ... (Código do vinculo do totem) ...
});

world.beforeEvents.entityDie.subscribe((event) => {
    // ... (Código da morte do totem) ...
});