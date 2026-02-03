import { world, system, EntityComponentTypes } from "@minecraft/server";
import { CONFIG } from "../config.js";
import { addMana } from "./mana.js";

// 1. EVENTO "ANTES" DO DANO (Para Bloqueios e Imunidades)
world.beforeEvents.entityHurt.subscribe((event) => {
    const victim = event.hurtEntity;
    if (victim.typeId !== "minecraft:player") return;
    
    const damageSource = event.damageSource;
    const cause = damageSource.cause; // ex: "fire", "lava", "lightning"
    
    // Checa equipamentos
    const equip = victim.getComponent("equippable");
    const chest = equip.getEquipment("Chest");
    const head = equip.getEquipment("Head");
    const legs = equip.getEquipment("Legs");

    // --- IMUNIDADES REAIS (Sem Efeitos de Poção) ---
    
    // NOBRE (Peito): Imunidade a Fogo e Lava
    if (chest?.getLore()?.includes(CONFIG.runes.noble.name)) {
        if (cause === "fire" || cause === "fire_tick" || cause === "lava" || cause === "magma") {
            event.cancel = true; // Anula o dano na raiz
            return;
        }
    }

    // ARTÍFICE (Cabeça): Imunidade a Raios
    if (head?.getLore()?.includes(CONFIG.runes.tinker.name)) {
        if (cause === "lightning") {
            event.cancel = true;
            return;
        }
    }

    // NOBRE (Botas - Lógica simulada): Dano de Queda
    // (O jogo checa o equipamento antes do dano, mas a causa "fall" às vezes passa direto em scripts antigos.
    // Vamos garantir aqui)
    if (cause === "fall" && equip.getEquipment("Feet")?.getLore()?.includes(CONFIG.runes.noble.name)) {
        event.cancel = true;
        return;
    }

    // --- ESQUIVA (Guardião - Pernas) ---
    if (legs?.getLore()?.includes(CONFIG.runes.guardian.name)) {
        // 15% de chance de esquivar de QUALQUER dano
        if (Math.random() < 0.15) {
            event.cancel = true;
            victim.onScreenDisplay.setActionBar("§5§lEsquivou!");
            victim.dimension.playSound("item.trident.return", victim.location, { pitch: 1.5 });
            return;
        }
    }
});

// 2. EVENTO "DEPOIS" DO DANO (Para Contra-ataques e Efeitos ao Bater)
world.afterEvents.entityHitEntity.subscribe((event) => {
    const attacker = event.damagingEntity;
    const victim = event.hitEntity;
    
    if (attacker.typeId !== "minecraft:player") return;

    const item = attacker.getComponent("equippable").getEquipment("Mainhand");
    if (!item) return;
    const lore = item.getLore() || [];

    // GUERREIRO: Roubo de Vida (Vampirismo)
    if (lore.includes(CONFIG.runes.warrior.name)) {
        const hp = attacker.getComponent("health");
        // Cura real manipulando o componente de vida
        if (hp) hp.setCurrentValue(Math.min(hp.currentValue + 2, hp.effectiveMax));
        attacker.dimension.spawnParticle("minecraft:heart_particle", attacker.location);
    }

    // ARTÍFICE: Raio (Chance)
    if (lore.includes(CONFIG.runes.tinker.name) && Math.random() < 0.3) {
        victim.dimension.spawnEntity("minecraft:lightning_bolt", victim.location);
    }
    
    // IMPERADOR: Drop de Cabeça (Chance de 10%)
    if (lore.includes(CONFIG.runes.emperor.name) && victim.getComponent("health").currentValue <= 0) {
        // A lógica de drop precisa ser no evento entityDie para garantir, 
        // mas aqui já aplicamos o "golpe de misericórdia".
        // Vamos deixar o drop no entityDie no main ou aqui se o hit matar.
    }
});