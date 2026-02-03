import { world, system } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { consumeMana } from "./mana.js";

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        applyPassives(player);
        handleElytra(player);
    }
}, 5); // Roda bem rápido (5 ticks = 0.25s) para a Elytra ficar suave

function handleElytra(player) {
    // FEITICEIRO: Voo com Elytra
    // Requisito: Estar usando Elytra com a Runa, estar planando E estar agachado (freio) ou pulando (impulso)
    if (!player.isGliding) return;
    
    const chest = player.getComponent("equippable").getEquipment("Chest");
    if (!chest?.getLore()?.includes(CONFIG.runes.sorcerer.name)) return;

    // Se apertar "Pulo" enquanto plana (detectado via isJumping ou hack de velocidade vertical)
    // O Bedrock não expõe "isJumping" facilmente em scripts server-side puros sem input event.
    // TRUQUE: Se o jogador olhar pra cima (> -45 graus) e estiver planando, damos impulso constante.
    
    const view = player.getViewDirection();
    
    // Se estiver olhando pra cima ou nivelado, gasta mana e impulsiona
    if (view.y > -0.2) { 
        // Custo de mana baixo para voo contínuo
        if (consumeMana(player, 0.2)) { 
            // Aplica força na direção que olha
            player.applyKnockback(view.x, view.z, 0.5, 0.0); // O parametro Y do KB é estranho, as vezes melhor usar applyImpulse se disponível na versão
            
            // Partícula legal
            player.dimension.spawnParticle("minecraft:end_rod", player.location);
        }
    }
}

function applyPassives(player) {
    // Rodar isso a cada 20 ticks (1s) é suficiente, mas como tá no loop de 5, usamos um contador ou deixamos leve
    if (system.currentTick % 20 !== 0) return;

    const equip = player.getComponent("equippable");
    let warriorPieces = 0;
    let immortalPieces = 0;

    ["Head", "Chest", "Legs", "Feet"].forEach(slot => {
        const item = equip.getEquipment(slot);
        const lore = item?.getLore() || [];

        // Contagens
        if (lore.includes(CONFIG.runes.warrior.name)) warriorPieces++;
        if (lore.includes(CONFIG.runes.immortal.name)) immortalPieces++;

        // Efeitos de Pés
        if (slot === "Feet") {
            if (lore.includes(CONFIG.runes.tinker.name) && player.isInWater) {
                player.addEffect("speed", 40, { amplifier: 2, showParticles: false });
            }
            if (lore.includes(CONFIG.runes.emperor.name)) {
                player.addEffect("speed", 40, { amplifier: 0, showParticles: false });
            }
        }
    });

    // GUERREIRO: Resistência (Simulando Vida Extra)
    // 1 peça = nada, 2 peças = Res I, 4 peças = Res II
    if (warriorPieces >= 2) {
        let amp = warriorPieces >= 4 ? 1 : 0;
        player.addEffect("resistance", 60, { amplifier: amp, showParticles: false });
    }

    // IMORTAL: Resistência Bruta
    if (immortalPieces >= 1) {
        let amp = immortalPieces >= 4 ? 3 : 1; 
        player.addEffect("resistance", 60, { amplifier: amp, showParticles: false });
        player.addEffect("regeneration", 60, { amplifier: 0, showParticles: false });
    }
}