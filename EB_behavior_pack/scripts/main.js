/**
 * Enormous Bedrock — ponto de entrada dos scripts.
 * Só importa módulos; a lógica fica em systems/.
 */

// Combate e progressão
import "./systems/mana.js";
import "./systems/combat.js";
import "./systems/passive.js";

// Crafting / rituais
import "./systems/crafting/enchanting_runes.js";
import "./systems/crafting/runes.js";

// Mundo (hell core e derivados)
import "./systems/world/morganite.js";
import "./systems/world/totem_greed.js";
import "./systems/world/vacuum_hopper.js";
import "./systems/world/hell_core_piston.js";

// Sobrevivência
import "./systems/survival/durability.js";
import "./systems/survival/arrow_recovery.js";
