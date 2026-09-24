/**
 * CyberMon: Tekken Protocol - 60 FPS Fighting Game Engine
 * Features:
 * - 4-Limb Tekken combat system (1=LP, 2=RP, 3=LK, 4=RK)
 * - 2.5D Sidesteps with depth scaling & evasion
 * - Juggles, gravity scaling & wall splats
 * - High / Mid / Low block hierarchy & Firewall Guard Crush
 * - Dynamic Tekken camera (zoom, screen shake, slow-mo K.O.)
 * - Rich animated sprites with dynamic aura & particle engine
 * - Pokémon Type Matchups, Counter Hit floaters & Ghost motion trails
 */

const POKEMON_TYPE_EFFECTIVENESS = {
    FIRE: { strong: ["BUG", "STEEL", "GRASS"], weak: ["WATER", "FIRE", "DRAGON", "ROCK"] },
    WATER: { strong: ["FIRE", "GROUND", "ROCK"], weak: ["WATER", "GRASS", "DRAGON"] },
    ELECTRIC: { strong: ["WATER", "FLYING"], weak: ["ELECTRIC", "GRASS", "DRAGON", "GROUND"] },
    GRASS: { strong: ["WATER", "GROUND", "ROCK"], weak: ["FIRE", "GRASS", "POISON", "FLYING", "BUG", "DRAGON", "STEEL"] },
    FIGHTING: { strong: ["NORMAL", "STEEL", "DARK", "ROCK", "ICE"], weak: ["POISON", "FLYING", "PSYCHIC", "BUG", "GHOST", "FAIRY"] },
    PSYCHIC: { strong: ["FIGHTING", "POISON"], weak: ["PSYCHIC", "STEEL", "DARK"] },
    GHOST: { strong: ["PSYCHIC", "GHOST"], weak: ["DARK", "NORMAL"] },
    BUG: { strong: ["GRASS", "PSYCHIC", "DARK"], weak: ["FIRE", "FIGHTING", "POISON", "FLYING", "GHOST", "STEEL", "FAIRY"] },
    STEEL: { strong: ["ICE", "ROCK", "FAIRY"], weak: ["FIRE", "WATER", "ELECTRIC", "STEEL"] },
    POISON: { strong: ["GRASS", "FAIRY"], weak: ["POISON", "GROUND", "ROCK", "GHOST", "STEEL"] },
    DARK: { strong: ["PSYCHIC", "GHOST"], weak: ["FIGHTING", "DARK", "FAIRY"] },
    NORMAL: { strong: [], weak: ["ROCK", "STEEL", "GHOST"] }
};

function calculateTypeEffectiveness(attackerTypes, defenderTypes) {
    if (!attackerTypes || !defenderTypes) return 1.0;
    let multiplier = 1.0;
    for (const aType of attackerTypes) {
        const chart = POKEMON_TYPE_EFFECTIVENESS[aType];
        if (!chart) continue;
        for (const dType of defenderTypes) {
            if (chart.strong.includes(dType)) {
                multiplier *= 1.25;
            } else if (chart.weak.includes(dType)) {
                multiplier *= 0.85;
            }
        }
    }
    return multiplier;
}

class Fighter {
    constructor(charId, side = 1, isBot = false, difficulty = "apt_hacker") {
        this.charData = CHARACTERS[charId] || CHARACTERS.lucario;
        this.side = side; // 1 = Left, 2 = Right
        this.isBot = isBot;
        this.difficulty = difficulty;

        // Position & Physics
        this.x = side === 1 ? 300 : 700;
        this.y = 520;
        this.baseY = 520;
        this.vx = 0;
        this.vy = 0;
        this.z = 0; // -1 (background), 0 (neutral), 1 (foreground) sidestep lane
        this.targetZ = 0;
        this.facing = side === 1 ? 1 : -1;
        this.gravity = 0.85;

        // Combat Stats
        this.maxHp = this.charData.maxHp;
        this.hp = this.maxHp;
        this.maxFirewall = this.charData.maxFirewall;
        this.firewall = this.maxFirewall;
        this.threatMeter = 0; // 0 - 100 Zero-Day charge (fills by landing hits)
        this.rageUnlocked = false; // earned by answering the SOC challenge correctly
        this.inRage = false;

        // States
        // idle, walk_f, walk_b, crouch, jump, dash_f, dash_b, sidestep, attack, hitstun, blockstun, guard_crush, knockdown, wakeup, dead
        this.state = "idle";
        this.stateTime = 0;
        this.isAirborne = false;
        this.isJuggled = false;
        this.juggleHits = 0;
        this.isGroundedKnockdown = false;

        // Move execution
        this.currentMove = null;
        this.moveFrame = 0;
        this.hasHitThisMove = false;
        this.comboString = [];
        this.lastInputTime = 0;
        this.lightComboStep = 0;
        this.lastLightInputTime = 0;

        // Buffs from Cybersecurity Trivia
        this.buffs = {
            attackUp: 1.0,
            defenseUp: 1.0,
            speedUp: 1.0
        };

        // Inputs
        this.inputLeft = false;
        this.inputRight = false;
        this.inputUp = false;
        this.inputDown = false;
        this.lastTapForwardTime = 0;
        this.lastTapBackTime = 0;

        // Sprites
        this.spriteFrontImg = new Image();
        this.spriteFrontImg.src = this.charData.spriteFront;
        this.spriteBackImg = new Image();
        this.spriteBackImg.src = this.charData.spriteBack;

        // Shiny / Alt Form Sprites
        this.shinyFrontImg = new Image();
        this.shinyFrontImg.src = this.charData.shinySpriteFront || this.charData.spriteFront;
        this.shinyBackImg = new Image();
        this.shinyBackImg.src = this.charData.shinySpriteBack || this.charData.spriteBack;

        // Mega Evolution & Super Form Sprites
        this.megaFrontImg = new Image();
        this.megaFrontImg.src = this.charData.megaSpriteFront || this.charData.spriteFront;
        this.megaBackImg = new Image();
        this.megaBackImg.src = this.charData.megaSpriteBack || this.charData.spriteBack;
        this.isTransformed = false;
        this.transformTimer = 0;
        this.hitFlashFrames = 0;

        // Procedural Animation Offsets
        this.animOffsetX = 0;
        this.animOffsetY = 0;
        this.animScaleX = 1.0;
        this.animScaleY = 1.0;
        this.animTilt = 0;

        // High-Speed Ghost Motion Trails (Tekken / Extreme Speed After-images)
        this.ghostTrails = [];
        this.trailTimer = 0;

        // Projectiles
        this.projectiles = [];

        // Reference to opponent
        this.opponent = null;
    }

    get isDead() {
        return this.hp <= 0 || this.state === "dead";
    }

    canAct() {
        return (
            this.state === "idle" ||
            this.state === "walk_f" ||
            this.state === "walk_b" ||
            this.state === "crouch"
        );
    }

    update() {
        this.stateTime++;

        // Update Transform status
        if (this.transformTimer > 0) {
            this.transformTimer--;
            if (this.transformTimer <= 0) {
                this.isTransformed = false;
            }
        }
        if (this.hitFlashFrames > 0) {
            this.hitFlashFrames--;
        }

        // Update Rage status (HP < 35%)
        this.inRage = (this.hp / this.maxHp) <= 0.35;

        // Smoothly interpolate Z-axis lane for 2.5D Tekken sidestep
        this.z += (this.targetZ - this.z) * 0.2;

        // Auto-face opponent if not in locked action
        if (this.opponent && this.canAct()) {
            this.facing = this.x < this.opponent.x ? 1 : -1;
        }

        // Firewall auto-regen when not in blockstun
        if (this.state !== "blockstun" && this.state !== "guard_crush") {
            this.firewall = Math.min(this.maxFirewall, this.firewall + 0.35);
        }

        // State Machine Update
        switch (this.state) {
            case "idle":
            case "walk_f":
            case "walk_b":
            case "crouch":
                this.handleMovementInputs();
                break;

            case "dash_f":
                this.x += this.facing * this.charData.dashSpeed * this.buffs.speedUp;
                if (this.stateTime > 14) this.state = "idle";
                break;

            case "dash_b":
                this.x -= this.facing * (this.charData.dashSpeed * 0.75);
                if (this.stateTime > 12) this.state = "idle";
                break;

            case "sidestep":
                if (this.stateTime > 18) {
                    this.state = "idle";
                    this.targetZ = 0; // Return to neutral combat line
                }
                break;

            case "attack":
                this.updateAttack();
                break;

            case "hitstun":
                this.x -= this.facing * 1.5;
                if (this.stateTime > this.hitstunFrames) {
                    this.state = "idle";
                }
                break;

            case "blockstun":
                this.x -= this.facing * 1.8;
                if (this.stateTime > this.blockstunFrames) {
                    this.state = "idle";
                }
                break;

            case "guard_crush":
                if (this.stateTime > 80) {
                    this.firewall = this.maxFirewall * 0.5;
                    this.state = "idle";
                }
                break;

            case "knockdown":
                // Airborne or falling onto the ground
                if (this.y >= this.baseY) {
                    this.y = this.baseY;
                    this.vy = 0;
                    this.vx = 0;
                    this.isGroundedKnockdown = true;
                    if (this.stateTime > 45) {
                        this.state = "wakeup";
                        this.stateTime = 0;
                    }
                }
                break;

            case "wakeup":
                if (this.stateTime > 20) {
                    this.state = "idle";
                    this.isJuggled = false;
                    this.juggleHits = 0;
                    this.isGroundedKnockdown = false;
                }
                break;
        }

        // Apply Vertical Gravity & Juggle Physics
        if (this.isAirborne || this.isJuggled || this.y < this.baseY) {
            this.vy += this.gravity;
            this.y += this.vy;
            this.x += this.vx;

            // Hit ground
            if (this.y >= this.baseY) {
                this.y = this.baseY;
                this.vy = 0;
                this.vx = 0;
                this.isAirborne = false;

                if (this.isJuggled) {
                    this.state = "knockdown";
                    this.stateTime = 0;
                    this.isJuggled = false;
                    this.juggleHits = 0;
                    if (window.soundEngine) window.soundEngine.playHit("heavy");
                }
            }
        }

        // Arena Boundaries & Wall Splat Checks
        const stageLeft = 120;
        const stageRight = 880;
        if (this.x < stageLeft) {
            if (this.isJuggled && Math.abs(this.vx) > 3) {
                this.triggerWallSplat();
            }
            this.x = stageLeft;
            this.vx = 0;
        } else if (this.x > stageRight) {
            if (this.isJuggled && Math.abs(this.vx) > 3) {
                this.triggerWallSplat();
            }
            this.x = stageRight;
            this.vx = 0;
        }

        // Projectiles update
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.vx;
            p.life--;

            // Check hit with opponent
            if (this.opponent && Math.abs(p.x - this.opponent.x) < 45 && Math.abs(p.y - this.opponent.y) < 70) {
                this.opponent.takeDamage(p.damage, "mid", false, false, this);
                if (window.gameEngine) window.gameEngine.spawnSpark(p.x, p.y, "#00ffff");
                this.projectiles.splice(i, 1);
                continue;
            }

            if (p.life <= 0 || p.x < 50 || p.x > 950) {
                this.projectiles.splice(i, 1);
            }
        }

        // Capture high-speed ghost motion trails (After-images)
        const isHighSpeed = this.state === "dash_fwd" || this.state === "dash_back" || this.isTransformed || this.inRage || (this.state === "attack" && Math.abs(this.animOffsetX) > 8);
        if (isHighSpeed) {
            this.trailTimer = (this.trailTimer || 0) + 1;
            if (this.trailTimer % 3 === 0) {
                let activeSprite;
                const useBackSprite = (this.side === 1 && this.facing === -1) || (this.side === 2 && this.facing === 1);
                if (this.isTransformed) {
                    activeSprite = useBackSprite ? this.megaBackImg : this.megaFrontImg;
                } else if (this.inRage || this.state === "attack") {
                    activeSprite = useBackSprite ? (this.shinyBackImg.complete ? this.shinyBackImg : this.spriteBackImg) : (this.shinyFrontImg.complete ? this.shinyFrontImg : this.spriteFrontImg);
                } else {
                    activeSprite = useBackSprite ? this.spriteBackImg : this.spriteFrontImg;
                }

                this.ghostTrails.push({
                    x: this.x + (this.animOffsetX || 0),
                    y: this.y + this.z * 15 + (this.animOffsetY || 0),
                    z: this.z,
                    facing: this.facing,
                    animTilt: this.animTilt || 0,
                    animScaleX: this.animScaleX || 1.0,
                    animScaleY: this.animScaleY || 1.0,
                    sprite: activeSprite,
                    alpha: 0.55,
                    color: this.charData.color || (this.side === 1 ? "#00e5ff" : "#ff1744")
                });
                if (this.ghostTrails.length > 5) this.ghostTrails.shift();
            }
        }

        // Fade existing ghost trails
        for (let i = this.ghostTrails.length - 1; i >= 0; i--) {
            this.ghostTrails[i].alpha -= 0.05;
            if (this.ghostTrails[i].alpha <= 0) {
                this.ghostTrails.splice(i, 1);
            }
        }
    }

    triggerWallSplat() {
        if (window.gameEngine) {
            window.gameEngine.triggerCameraShake(12, 16);
            window.gameEngine.spawnSpark(this.x, this.y - 60, "#ff0055", 25);
            window.soundEngine.playHit("launch");
        }
        // Wall freeze bounce
        this.vy = -6;
        this.vx = this.facing * -2;
    }

    handleMovementInputs() {
        const isMovingForward = (this.facing === 1 && this.inputRight) || (this.facing === -1 && this.inputLeft);
        const isMovingBack = (this.facing === 1 && this.inputLeft) || (this.facing === -1 && this.inputRight);

        if (this.inputDown) {
            this.state = "crouch";
            return;
        }

        if (this.inputUp && !this.isAirborne) {
            this.isAirborne = true;
            this.vy = -14.5;
            this.vx = isMovingForward ? this.facing * 4 : (isMovingBack ? -this.facing * 3.5 : 0);
            this.state = "idle";
            if (window.soundEngine) window.soundEngine.playWhoosh();
            return;
        }

        if (isMovingForward) {
            this.state = "walk_f";
            this.x += this.facing * this.charData.speed * this.buffs.speedUp;
        } else if (isMovingBack) {
            this.state = "walk_b";
            this.x -= this.facing * (this.charData.speed * 0.75) * this.buffs.speedUp;
        } else {
            this.state = "idle";
        }
    }

    // Tekken 3D Sidestep (tap Up or Down while neutral)
    sidestep(direction = 1) {
        if (!this.canAct()) return;
        this.state = "sidestep";
        this.stateTime = 0;
        this.targetZ = direction; // 1 = Foreground, -1 = Background
        if (window.soundEngine) window.soundEngine.playWhoosh();
    }

    dash(direction = 1) {
        if (!this.canAct()) return;
        if (direction === this.facing) {
            this.state = "dash_f";
            this.stateTime = 0;
        } else {
            this.state = "dash_b";
            this.stateTime = 0;
        }
        if (window.soundEngine) window.soundEngine.playWhoosh();
    }

    // Simplified Modern Combat Controls
    handleLightInput() {
        const now = performance.now();
        if (now - this.lastLightInputTime < 600) {
            this.lightComboStep = (this.lightComboStep + 1) % 3;
        } else {
            this.lightComboStep = 0;
        }
        this.lastLightInputTime = now;

        if (this.lightComboStep === 0) {
            this.executeAttack("1");
        } else if (this.lightComboStep === 1) {
            this.executeAttack("2");
        } else {
            this.executeAttack("4");
        }
    }

    handleHeavyInput() {
        // Effortless launcher: sends opponent airborne for juggle combos
        if (this.charData.moves && this.charData.moves["df2"]) {
            this.executeAttack("df2");
        } else if (this.charData.moves && this.charData.moves["4"]) {
            this.executeAttack("4");
        } else {
            this.executeAttack("2");
        }
    }

    handleSpecialInput() {
        this.executeAttack("special");
    }

    handleSuperInput() {
        // Gated supermove: full meter + passed SOC challenge fires it,
        // full meter without auth opens the challenge instead.
        if (this.rageUnlocked && this.threatMeter >= 100) {
            this.executeRageArt();
            return;
        }
        if (this.inRage && this.threatMeter >= 100 && !this.rageUnlocked) {
            const modal = document.getElementById("trivia-modal");
            if (modal && modal.classList.contains("hidden") && window.uiManager &&
                typeof window.uiManager.triggerCyberTrivia === "function") {
                window.uiManager.pendingRageFighter = this;
                window.uiManager.triggerCyberTrivia("rage");
            }
        }
    }

    executeAttack(moveKey) {
        if (!this.canAct()) return;

        const move = this.charData.moves[moveKey];
        if (!move) return;

        this.currentMove = move;
        this.moveKey = moveKey;
        this.state = "attack";
        this.stateTime = 0;
        this.moveFrame = 0;
        this.hasHitThisMove = false;

        // Dashing attack impulse
        if (move.dashImpulse) {
            this.x += this.facing * move.dashImpulse;
        }

        if (window.soundEngine) {
            if (move.sound === "light") {
                window.soundEngine.playSlash();
            } else if (move.isLauncher) {
                window.soundEngine.playEarthShatter();
            } else {
                window.soundEngine.playWhoosh();
            }
        }
    }

    // Zero-Day Rage Art Ultimate (HP < 35% + full meter + passed SOC challenge)
    executeRageArt() {
        if (!this.inRage || this.threatMeter < 100 || !this.rageUnlocked || !this.canAct()) return;

        // Consume the charge and the authentication
        this.threatMeter = 0;
        this.rageUnlocked = false;

        this.currentMove = {
            name: this.charData.rageArtName,
            type: "mid",
            startup: 16,
            active: 10,
            recovery: 40,
            damage: 240,
            guardDamage: 90,
            isRageArt: true,
            sound: "heavy",
            range: 160,
            hitbox: { x: 50, y: -80, w: 110, h: 80 }
        };
        this.state = "attack";
        this.stateTime = 0;
        this.moveFrame = 0;
        this.hasHitThisMove = false;

        // Activate Mega Evolution Transform!
        this.isTransformed = true;
        this.transformTimer = 160;

        // Cinematic freeze & announcer
        if (window.gameEngine) {
            window.gameEngine.triggerSuperFreeze(70, this);
            if (window.soundEngine) {
                window.soundEngine.playMegaEvolve();
                window.soundEngine.playCry(this.charData.id, 1.0);
                window.soundEngine.announce(this.charData.rageArtName || "ZERO DAY EXPLOIT!");
            }
        }
    }

    updateAttack() {
        this.moveFrame++;
        const m = this.currentMove;
        if (!m) {
            this.state = "idle";
            this.resetAnimOffsets();
            return;
        }

        // Procedural Animation Offsets based on attack phase
        if (this.moveFrame < m.startup) {
            // 1. Wind-up phase: pull back, slight crouch, tilt back
            const progress = this.moveFrame / m.startup;
            this.animOffsetX = -this.facing * (m.lungeX || 12) * progress * 0.45;
            this.animOffsetY = 2 * progress;
            this.animScaleX = 0.95;
            this.animScaleY = 0.95;
            this.animTilt = -(m.tilt || 8) * progress * 0.5;
        } else if (this.moveFrame < m.startup + m.active) {
            // 2. Active Strike phase: forward lunge, dynamic stretch/squash, strike tilt!
            this.animOffsetX = this.facing * (m.lungeX || 16);
            this.animOffsetY = m.squashY ? (1 - m.squashY) * 15 : 0;
            this.animScaleX = m.stretchX || 1.18;
            this.animScaleY = m.squashY || 0.88;
            this.animTilt = (m.tilt || 14);

            if (!this.hasHitThisMove) {
                if (m.projectile) {
                    this.spawnProjectile(m);
                    this.hasHitThisMove = true;
                } else {
                    // Spawn visual attack effect on strike frame
                    if (window.gameEngine) {
                        const vfxType = m.vfx || "slash1";
                        const targetX = this.x + this.facing * (m.range * 0.8);
                        const targetY = this.y - 65;
                        window.gameEngine.spawnAttackVFX(vfxType, targetX, targetY, this.facing, this.charData);
                    }
                    this.checkHitboxCollision(m);
                }
            }
        } else {
            // 3. Recovery phase: smooth decay back to neutral stance
            const recTotal = Math.max(1, m.recovery);
            const recProgress = (this.moveFrame - m.startup - m.active) / recTotal;
            const remaining = Math.max(0, 1.0 - recProgress);
            this.animOffsetX *= remaining;
            this.animOffsetY *= remaining;
            this.animScaleX = 1.0 + (this.animScaleX - 1.0) * remaining;
            this.animScaleY = 1.0 + (this.animScaleY - 1.0) * remaining;
            this.animTilt *= remaining;
        }

        // Recovery finished
        if (this.moveFrame >= m.startup + m.active + m.recovery) {
            this.state = "idle";
            this.currentMove = null;
            this.resetAnimOffsets();
        }
    }

    resetAnimOffsets() {
        this.animOffsetX = 0;
        this.animOffsetY = 0;
        this.animScaleX = 1.0;
        this.animScaleY = 1.0;
        this.animTilt = 0;
    }

    spawnProjectile(move) {
        this.projectiles.push({
            x: this.x + this.facing * 50,
            y: this.y - 65,
            vx: this.facing * move.speed,
            damage: move.damage * this.buffs.attackUp,
            life: 60,
            color: this.charData.color
        });
    }

    checkHitboxCollision(move) {
        if (!this.opponent || this.opponent.isDead) return;

        // Sidestep Evasion Check: If opponent is actively sidestepping in a different Z-plane, linear attack whiffs!
        if (this.opponent.state === "sidestep" && Math.abs(this.opponent.z - this.z) > 0.4) {
            if (window.soundEngine) window.soundEngine.playCrowdGasp();
            if (window.gameEngine) {
                window.gameEngine.logCombatEvent("EVADE", `3D SIDESTEP EVASION! ${this.opponent.charData.name.toUpperCase()} cleanly dodged attack!`);
            }
            return; // Clean 3D evasion!
        }

        // Hitbox coordinates
        const hbX = this.facing === 1 ? this.x + move.hitbox.x : this.x - move.hitbox.x - move.hitbox.w;
        const hbY = this.y + move.hitbox.y;
        const hbW = move.hitbox.w;
        const hbH = move.hitbox.h;

        // Opponent Hurtbox
        const oppHurtX = this.opponent.x - this.opponent.charData.width / 2;
        const oppHurtY = this.opponent.y - this.opponent.charData.height;
        const oppHurtW = this.opponent.charData.width;
        const oppHurtH = this.opponent.charData.height;

        // Check AABB overlap
        if (
            hbX < oppHurtX + oppHurtW &&
            hbX + hbW > oppHurtX &&
            hbY < oppHurtY + oppHurtH &&
            hbY + hbH > oppHurtY
        ) {
            this.hasHitThisMove = true;
            const isCounterHit = (
                this.opponent.state === "attack" &&
                this.opponent.moveFrame < (this.opponent.currentMove ? this.opponent.currentMove.startup : 10)
            );

            this.opponent.takeDamage(
                move.damage * this.buffs.attackUp,
                move.type,
                move.isLauncher,
                isCounterHit,
                this
            );

            // Give threat meter
            this.threatMeter = Math.min(100, this.threatMeter + 12);
        }
    }

    takeDamage(rawDamage, attackType, isLauncher = false, isCounterHit = false, attacker = null) {
        if (this.state === "dead") return;

        // Guard Check
        const isGuardingHigh = (this.facing === 1 && this.inputLeft) || (this.facing === -1 && this.inputRight);
        const isGuardingLow = isGuardingHigh && this.inputDown;

        let blocked = false;
        if (!this.isAirborne && !this.isJuggled && this.state !== "guard_crush" && this.canAct()) {
            if (attackType === "high" && (isGuardingHigh || isGuardingLow)) blocked = true;
            else if (attackType === "mid" && isGuardingHigh && !this.inputDown) blocked = true;
            else if (attackType === "low" && isGuardingLow) blocked = true;
        }

        if (blocked) {
            // Block Successful: Deplete Firewall Integrity
            const guardDmg = rawDamage * 0.45;
            this.firewall -= guardDmg;
            this.state = "blockstun";
            this.stateTime = 0;
            this.blockstunFrames = 14;

            if (window.soundEngine) window.soundEngine.playBlock();
            if (window.gameEngine) {
                window.gameEngine.spawnShieldHex(this.x, this.y - 65);
                window.gameEngine.triggerCameraShake(3, 6);
            }

            // Firewall Breach / Guard Crush!
            if (this.firewall <= 0) {
                this.firewall = 0;
                this.state = "guard_crush";
                this.stateTime = 0;
                if (window.soundEngine) {
                    window.soundEngine.playBreach();
                    window.soundEngine.playCrowdOoh();
                    window.soundEngine.announce("SECURITY BREACH!");
                }
                if (window.gameEngine) {
                    window.gameEngine.triggerCameraShake(15, 20);
                    window.gameEngine.showBanner("SECURITY BREACH!", "#ff1744");
                    window.gameEngine.logCombatEvent("BREACH", `SECURITY BREACH! ${this.charData.name.toUpperCase()} Firewall collapsed!`);
                }
            }
            return;
        }

        // Clean Hit
        let damage = rawDamage / this.buffs.defenseUp;
        if (isCounterHit) damage *= 1.25;

        // Pokémon Type Effectiveness Matchup
        let typeMultiplier = 1.0;
        if (attacker && attacker.charData && attacker.charData.types && this.charData && this.charData.types) {
            typeMultiplier = calculateTypeEffectiveness(attacker.charData.types, this.charData.types);
        }
        const isSuperEffective = typeMultiplier > 1.15;
        if (isSuperEffective) damage *= 1.20;

        // White-out hit flash and hit-stop
        this.hitFlashFrames = (isCounterHit || isSuperEffective) ? 8 : 5;
        if (window.gameEngine) {
            window.gameEngine.triggerHitStop(isLauncher ? 6 : ((isCounterHit || isSuperEffective) ? 5 : 3));
        }

        // Juggle Damage Scaling
        if (this.isJuggled) {
            damage *= Math.max(0.4, 1.0 - this.juggleHits * 0.15);
            this.juggleHits++;
        }

        this.hp = Math.max(0, this.hp - damage);
        if (this.hp > 0 && (this.hp / this.maxHp) <= 0.25) {
            if (window.soundEngine) {
                window.soundEngine.startLowHpAlarm();
                window.soundEngine.setClimaxMode(true);
            }
            if (window.gameEngine) {
                window.gameEngine.logCombatEvent("ALERT", `CRITICAL DANGER ALERT! ${this.charData.name.toUpperCase()} entered low-health threshold!`);
            }
        }

        // Sparks & Sound
        if (window.soundEngine) {
            window.soundEngine.playHit(isLauncher ? "launch" : "heavy", isCounterHit || isSuperEffective);
            if (isCounterHit) {
                window.soundEngine.playCrowdOoh();
                window.soundEngine.announce("COUNTER HIT!");
            }
        }

        if (window.gameEngine) {
            const sparkColor = isCounterHit ? "#ffff00" : (isSuperEffective ? "#ffcb05" : (this.charData.color || "#00e5ff"));
            window.gameEngine.spawnSpark(this.x, this.y - 60, sparkColor, (isCounterHit || isSuperEffective) ? 30 : 18);
            window.gameEngine.triggerCameraShake((isCounterHit || isSuperEffective) ? 10 : 6, 12);
            if (isCounterHit) {
                window.gameEngine.spawnFloatingText(this.x, this.y - 95, "COUNTER HIT!", "#00e5ff", "CRITICAL BREACH (+25%)", 1.25);
                window.gameEngine.logCombatEvent("COUNTER", `COUNTER HIT! ${attacker ? attacker.charData.name.toUpperCase() : "ATTACKER"} dealt +25% bonus impact!`);
            }
            if (isSuperEffective) {
                window.gameEngine.spawnFloatingText(this.x, this.y - (isCounterHit ? 130 : 95), "SUPER EFFECTIVE!", "#ffcb05", "⚡ ZERO-DAY EXPLOIT (+20%)", 1.15);
                window.gameEngine.logCombatEvent("TYPE", `SUPER EFFECTIVE! ${attacker ? attacker.charData.name.toUpperCase() : "ATTACKER"} exploited ${this.charData.name.toUpperCase()} type weakness!`);
            }
        }

        // Launcher / Air Juggle State
        if (isLauncher || this.isJuggled) {
            this.isJuggled = true;
            this.isAirborne = true;
            const launchForce = attacker && attacker.currentMove && attacker.currentMove.launchForceY ? attacker.currentMove.launchForceY : -14.5;
            this.vy = launchForce;
            this.vx = (attacker ? attacker.facing : -this.facing) * 3.8;
            this.state = "knockdown";

            if (window.soundEngine) window.soundEngine.playCrowdCheer();
            if (window.gameEngine) {
                if (this.juggleHits === 1) {
                    window.gameEngine.logCombatEvent("LAUNCH", `AIRBORNE LAUNCH! ${attacker ? attacker.charData.name.toUpperCase() : "OPPONENT"} launched into the air!`);
                } else if (this.juggleHits >= 2) {
                    window.gameEngine.logCombatEvent("JUGGLE", `AIR JUGGLE x${this.juggleHits}! (${Math.round(damage)} DMG)`);
                }
            }
        } else {
            this.state = "hitstun";
            this.stateTime = 0;
            this.hitstunFrames = isCounterHit ? 26 : 16;
        }

        // Check K.O.
        if (this.hp <= 0) {
            this.hp = 0;
            this.state = "dead";
            if (window.gameEngine) {
                window.gameEngine.handleKO(attacker, this);
            }
        }
    }
}

class GameEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.p1 = null;
        this.p2 = null;
        this.botAI = null;
        this.running = false;
        this.frame = 0;

        // Game Mode: 'pvp_local', 'pvp_online', 'pve_bot', 'training'
        this.mode = 'pve_bot';
        this.stage = 'server_room';
        this.round = 1;
        this.p1Wins = 0;
        this.p2Wins = 0;
        this.matchOver = false;
        this.roundTime = 60; // 60-second Tekken timer
        this.roundTimer = null;

        // Dynamic Camera
        this.camX = 0;
        this.camY = 0;
        this.camZoom = 1.0;
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.slowMoFrames = 0;

        // Visual effects & Attack Animations
        this.sparks = [];
        this.shields = [];
        this.attackVFX = [];
        this.floatingTexts = [];
        this.isPaused = false;
        this.hitStopFrames = 0;
        this.bannerText = "";
        this.bannerColor = "#00e5ff";
        this.bannerTime = 0;

        // Frame History & Slow-Mo Replay ("Tekken KO Cam")
        this.frameHistory = [];
        this.isReplaying = false;
        this.replayBuffer = [];
        this.replayIndex = 0;
        this.replayTick = 0;
        this.replayWinner = null;
        this.replayLoser = null;
        this.onReplayComplete = null;

        // Keyboard State
        this.keys = {};
    }

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.setupKeyboard();
        this.setupGamepad();
    }

    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.code === "Escape" || e.code === "KeyP") {
                if (window.uiManager && window.uiManager.currentScreen === "battle") {
                    e.preventDefault();
                    window.uiManager.togglePause();
                    return;
                }
            }
            if (this.isReplaying && (e.code === "Space" || e.code === "Enter")) {
                e.preventDefault();
                this.stopSlowMoReplay();
                return;
            }
            if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
                e.preventDefault();
            }
            this.keys[e.code] = true;
            this.handlePlayerInput(e.code, true);
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.handlePlayerInput(e.code, false);
        });
    }

    setupGamepad() {
        // Poll gamepad inputs inside loop
    }

    handlePlayerInput(code, isDown) {
        if (!this.p1 || this.matchOver || this.isReplaying || this.isPaused) return;

        // Player 1 Controls: WASD for movement, U/I/J/K for Tekken 1,2,3,4 attacks
        // Or alternative F/G/H/V
        if (code === "KeyA") this.p1.inputLeft = isDown;
        if (code === "KeyD") this.p1.inputRight = isDown;
        if (code === "KeyW") this.p1.inputUp = isDown;
        if (code === "KeyS") this.p1.inputDown = isDown;

        // Double tap dash check
        if (code === "KeyD" && isDown) {
            const now = performance.now();
            if (now - (this.p1.lastTapForwardTime || 0) < 250) this.p1.dash(1);
            this.p1.lastTapForwardTime = now;
        }
        if (code === "KeyA" && isDown) {
            const now = performance.now();
            if (now - (this.p1.lastTapBackTime || 0) < 250) this.p1.dash(-1);
            this.p1.lastTapBackTime = now;
        }

        // Sidestep check (Double tap W / S)
        if (code === "KeyW" && isDown && !this.p1.inputLeft && !this.p1.inputRight) {
            const now = performance.now();
            if (now - (this.p1.lastTapUpTime || 0) < 260) this.p1.sidestep(-1);
            this.p1.lastTapUpTime = now;
        }
        if (code === "KeyS" && isDown && !this.p1.inputLeft && !this.p1.inputRight) {
            const now = performance.now();
            if (now - (this.p1.lastTapDownTime || 0) < 260) this.p1.sidestep(1);
            this.p1.lastTapDownTime = now;
        }

        // Player 1 Attacks (Modern Simplified Layout: J=Light, K=Heavy/Launcher, L=Special, Space=Super)
        if (isDown) {
            if (code === "KeyJ") {
                this.p1.handleLightInput();
            } else if (code === "KeyK") {
                this.p1.handleHeavyInput();
            } else if (code === "KeyL") {
                this.p1.handleSpecialInput();
            } else if (code === "Space" || code === "KeyU") {
                this.p1.handleSuperInput();
            } else if (code === "KeyI") {
                // Legacy Tekken RP
                if (this.p1.inputDown) this.p1.executeAttack("df2");
                else this.p1.executeAttack("2");
            } else if (code === "KeyO") {
                this.p1.executeAttack("4");
            }
        }

        // Local Player 2 Controls (Arrow Keys + Numpad or B/N/M/Enter)
        if (this.mode === 'pvp_local' && this.p2) {
            if (code === "ArrowLeft") this.p2.inputLeft = isDown;
            if (code === "ArrowRight") this.p2.inputRight = isDown;
            if (code === "ArrowUp") this.p2.inputUp = isDown;
            if (code === "ArrowDown") this.p2.inputDown = isDown;

            if (isDown) {
                // Simplified P2: Numpad 1 / KeyB = Light, Numpad 2 / KeyN = Heavy/Launcher, Numpad 3 / KeyM = Special, Enter = Super
                if (code === "Numpad1" || code === "Digit1" || code === "KeyB") {
                    this.p2.handleLightInput();
                } else if (code === "Numpad2" || code === "Digit2" || code === "KeyN") {
                    this.p2.handleHeavyInput();
                } else if (code === "Numpad3" || code === "Digit3" || code === "KeyM") {
                    this.p2.handleSpecialInput();
                } else if (code === "Enter" || code === "NumpadEnter") {
                    this.p2.handleSuperInput();
                } else if (code === "Numpad4" || code === "Digit9") {
                    this.p2.executeAttack("3");
                } else if (code === "Numpad5" || code === "Digit0") {
                    this.p2.executeAttack("4");
                } else if (code === "Numpad6" || code === "Minus") {
                    this.p2.executeAttack("special");
                }
            }
        }
    }

    startMatch(p1Char = "lucario", p2Char = "gengar", mode = "pve_bot", difficulty = "apt_hacker") {
        this.mode = mode;
        this.p1 = new Fighter(p1Char, 1, false);
        this.p2 = new Fighter(p2Char, 2, mode === "pve_bot", difficulty);

        this.p1.opponent = this.p2;
        this.p2.opponent = this.p1;

        if (mode === "pve_bot") {
            this.botAI = new BotAI(this.p2, this.p1, difficulty);
        } else {
            this.botAI = null;
        }

        this.round = 1;
        this.p1Wins = 0;
        this.p2Wins = 0;
        this.matchOver = false;
        this.isReplaying = false;
        this.frameHistory = [];
        this.replayBuffer = [];
        const replayOverlay = document.getElementById("replay-overlay");
        if (replayOverlay) replayOverlay.classList.add("hidden");
        this.startRound();

        if (!this.running) {
            this.running = true;
            requestAnimationFrame(() => this.gameLoop());
        }

        if (window.soundEngine) {
            window.soundEngine.init();
            window.soundEngine.startBGM();
        }
    }

    startRound() {
        this.isReplaying = false;
        const replayOverlay = document.getElementById("replay-overlay");
        if (replayOverlay) replayOverlay.classList.add("hidden");

        this.p1.hp = this.p1.maxHp;
        this.p1.firewall = this.p1.maxFirewall;
        this.p1.threatMeter = 0;
        this.p1.rageUnlocked = false;
        this.p1.x = 300;
        this.p1.y = 520;
        this.p1.state = "idle";
        this.p1.targetZ = 0;
        this.p1.z = 0;

        this.p2.hp = this.p2.maxHp;
        this.p2.firewall = this.p2.maxFirewall;
        this.p2.threatMeter = 0;
        this.p2.rageUnlocked = false;
        this.p2.x = 700;
        this.p2.y = 520;
        this.p2.state = "idle";
        this.p2.targetZ = 0;
        this.p2.z = 0;

        this.roundTime = 60;
        if (this.roundTimer) clearInterval(this.roundTimer);
        this.roundTimer = setInterval(() => {
            if (this.roundTime > 0 && !this.matchOver) {
                this.roundTime--;
                if (this.roundTime === 0) {
                    this.handleTimeOut();
                }
            }
        }, 1000);

        this.showBanner(`ROUND ${this.round}... FIGHT!`, "#00e5ff", 100);
        if (window.soundEngine) {
            window.soundEngine.setClimaxMode(false);
            window.soundEngine.announce(`Round ${this.round}. Fight!`);
        }
        this.logCombatEvent("ROUND", `ROUND ${this.round}... FIGHT!`);
    }

    handleKO(winner, loser) {
        if (this.matchOver) return;
        if (this.roundTimer) {
            clearInterval(this.roundTimer);
            this.roundTimer = null;
        }
        this.triggerCameraShake(18, 25);
        this.triggerSuperFreeze(75);

        if (winner === this.p1) this.p1Wins++;
        else if (winner === this.p2) this.p2Wins++;

        const isMatchDecider = (this.p1Wins >= 2 || this.p2Wins >= 2);

        if (window.soundEngine) {
            try {
                window.soundEngine.stopLowHpAlarm();
                window.soundEngine.setClimaxMode(false);
                if (loser) window.soundEngine.playCry(loser.charData.id, 0.9);
                window.soundEngine.playFaint();
                window.soundEngine.playCrowdRoar();
                window.soundEngine.announce("K.O.!");
            } catch (e) {
                console.error("Audio error in handleKO:", e);
            }
        }
        this.showBanner("K.O.!", "#ee1515", 120);
        this.logCombatEvent("KO", `K.O.! ${winner.charData.name.toUpperCase()} delivered the finishing blow!`);

        const proceedAfterKO = () => {
            if (this.p1Wins >= 2 || this.p2Wins >= 2) {
                this.matchOver = true;
                const victor = this.p1Wins >= 2 ? this.p1 : this.p2;
                this.showBanner(`${victor.charData.name.toUpperCase()} WINS!`, "#00e676", 200);
                this.logCombatEvent("VICTORY", `🏆 MATCH CONCLUDED // ${victor.charData.name.toUpperCase()} WINS CYBER CHAMPIONSHIP!`);
                if (window.uiManager && typeof window.uiManager.recordMatchResult === "function") {
                    try {
                        window.uiManager.recordMatchResult(victor === this.p1);
                    } catch (e) {
                        console.error("Error recording career stats:", e);
                    }
                }
                if (window.soundEngine) {
                    try {
                        if (typeof window.soundEngine.playVictory === "function") {
                            window.soundEngine.playVictory();
                        } else if (typeof window.soundEngine.playVictoryFanfare === "function") {
                            window.soundEngine.playVictoryFanfare();
                        }
                        if (typeof window.soundEngine.announce === "function") {
                            window.soundEngine.announce(`${victor.charData.name} wins!`);
                        }
                    } catch (e) {
                        console.error("Audio error in proceedAfterKO:", e);
                    }
                }
                if (window.uiManager && typeof window.uiManager.showVictoryScreen === "function") {
                    try {
                        window.uiManager.showVictoryScreen(victor);
                    } catch (e) {
                        console.error("Error showing victory screen:", e);
                    }
                }
            } else {
                this.round++;
                this.startRound();
            }
        };

        if (isMatchDecider) {
            setTimeout(() => {
                this.startSlowMoReplay(winner, loser, proceedAfterKO);
            }, 900);
        } else {
            setTimeout(proceedAfterKO, 2200);
        }
    }

    handleTimeOut() {
        if (this.matchOver) return;
        let winner = null;
        if (this.p1.hp > this.p2.hp) winner = this.p1;
        else if (this.p2.hp > this.p1.hp) winner = this.p2;

        this.showBanner("TIME UP!", "#ffea00", 120);
        if (window.soundEngine) window.soundEngine.announce("Time up!");

        setTimeout(() => {
            if (winner === this.p1) this.p1Wins++;
            else if (winner === this.p2) this.p2Wins++;

            if (this.p1Wins >= 2 || this.p2Wins >= 2) {
                this.matchOver = true;
                const victor = this.p1Wins >= 2 ? this.p1 : this.p2;
                this.showBanner(`${victor.charData.name.toUpperCase()} WINS!`, "#00e676", 200);
                if (window.uiManager && typeof window.uiManager.recordMatchResult === "function") {
                    try {
                        window.uiManager.recordMatchResult(victor === this.p1);
                    } catch (e) {
                        console.error("Error recording career stats:", e);
                    }
                }
                if (window.uiManager) window.uiManager.showVictoryScreen(victor);
            } else {
                this.round++;
                this.startRound();
            }
        }, 2000);
    }

    triggerCameraShake(intensity = 8, duration = 12) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
    }

    triggerSuperFreeze(frames = 30) {
        this.slowMoFrames = frames;
    }

    showBanner(text, color = "#00e5ff", frames = 90) {
        this.bannerText = text;
        this.bannerColor = color;
        this.bannerTime = frames;
    }

    spawnSpark(x, y, color = "#00e5ff", count = 18) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 8;
            this.sparks.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 15 + Math.random() * 15,
                maxLife: 30,
                color: color,
                size: 2 + Math.random() * 3
            });
        }
    }

    spawnShieldHex(x, y) {
        this.shields.push({
            x: x,
            y: y,
            radius: 25,
            life: 16,
            maxLife: 16
        });
    }

    triggerHitStop(frames = 3) {
        this.hitStopFrames = frames;
    }

    spawnAttackVFX(type, x, y, facing, charData) {
        this.attackVFX.push({
            type: type,
            x: x,
            y: y,
            facing: facing,
            color: charData.color || "#00e5ff",
            secondaryColor: (charData.themeColors && charData.themeColors.secondary) || "#ffcb05",
            charId: charData.id,
            life: 14,
            maxLife: 14
        });
    }

    renderAttackVFX(ctx) {
        for (const fx of this.attackVFX) {
            ctx.save();
            const progress = fx.life / fx.maxLife; // 1 -> 0
            const alpha = Math.max(0, progress);

            ctx.translate(fx.x, fx.y);
            ctx.scale(fx.facing, 1);

            if (fx.type === "slash1" || fx.type === "slash") {
                // Curved energy slash arc (Light jab 1)
                ctx.save();
                ctx.shadowColor = fx.color;
                ctx.shadowBlur = 18;
                ctx.strokeStyle = fx.color;
                ctx.lineWidth = 4 * alpha + 1;
                ctx.beginPath();
                ctx.arc(0, 0, 42 * (1.2 - progress * 0.2), -Math.PI * 0.45, Math.PI * 0.45, false);
                ctx.stroke();

                // Inner white-hot blade
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2 * alpha;
                ctx.beginPath();
                ctx.arc(0, 0, 42 * (1.2 - progress * 0.2), -Math.PI * 0.35, Math.PI * 0.35, false);
                ctx.stroke();
                ctx.restore();
            } else if (fx.type === "slash2" || fx.type === "cross_slash") {
                // Dual intersecting cross-slash blades (Light jab 2)
                ctx.save();
                ctx.shadowColor = fx.secondaryColor;
                ctx.shadowBlur = 20;
                ctx.strokeStyle = fx.secondaryColor;
                ctx.lineWidth = 5 * alpha;
                const len = 48 * (1.3 - progress * 0.3);

                ctx.beginPath();
                ctx.moveTo(-len * 0.7, -len * 0.7);
                ctx.lineTo(len * 0.7, len * 0.7);
                ctx.moveTo(-len * 0.7, len * 0.7);
                ctx.lineTo(len * 0.7, -len * 0.7);
                ctx.stroke();

                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2 * alpha;
                ctx.stroke();
                ctx.restore();
            } else if (fx.type === "low_arc") {
                // Low sweep dust & spark shockwave
                ctx.save();
                ctx.shadowColor = fx.color;
                ctx.shadowBlur = 15;
                ctx.strokeStyle = fx.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.ellipse(0, 50, 60 * (1.3 - progress * 0.3), 12, 0, 0, Math.PI);
                ctx.stroke();
                ctx.restore();
            } else if (fx.type === "crescent_arc") {
                // Heavy spinning crescent roundhouse blade
                ctx.save();
                ctx.shadowColor = fx.color;
                ctx.shadowBlur = 25;
                ctx.strokeStyle = fx.color;
                ctx.lineWidth = 6 * alpha;
                ctx.beginPath();
                ctx.arc(0, -10, 65 * (1.2 - progress * 0.2), -Math.PI * 0.6, Math.PI * 0.6);
                ctx.stroke();

                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2.5 * alpha;
                ctx.stroke();
                ctx.restore();
            } else if (fx.type === "rising_geyser") {
                // Volcanic / Electric / Aura rising geyser column (Heavy Launcher)
                ctx.save();
                ctx.shadowColor = fx.color;
                ctx.shadowBlur = 25;
                const geyserHeight = 140 * (1 - progress * 0.1);

                // Ground fracture fissure
                ctx.fillStyle = fx.secondaryColor;
                ctx.fillRect(-35, 55, 70, 8 * alpha);

                // Rising energy columns
                const grad = ctx.createLinearGradient(0, 60, 0, 60 - geyserHeight);
                grad.addColorStop(0, fx.secondaryColor);
                grad.addColorStop(0.5, fx.color);
                grad.addColorStop(1, "rgba(255, 255, 255, 0)");
                ctx.fillStyle = grad;

                ctx.beginPath();
                ctx.moveTo(-25, 60);
                ctx.lineTo(-8, 60 - geyserHeight);
                ctx.lineTo(8, 60 - geyserHeight);
                ctx.lineTo(25, 60);
                ctx.fill();

                // Core electric laser beam
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(-5, 60 - geyserHeight * 0.9, 10, geyserHeight * 0.9);
                ctx.restore();
            } else if (fx.type === "heavy_burst") {
                // Forward dash attack shockwave ring
                ctx.save();
                ctx.shadowColor = fx.color;
                ctx.shadowBlur = 22;
                ctx.strokeStyle = fx.color;
                ctx.lineWidth = 4 * alpha;
                ctx.beginPath();
                ctx.ellipse(0, 0, 45 * (1.4 - progress * 0.4), 30, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            } else if (fx.type === "super_flurry") {
                // Zero-Day Rage Art Anime Slash Flurry Lines
                ctx.save();
                ctx.shadowColor = "#ff1744";
                ctx.shadowBlur = 30;
                ctx.strokeStyle = "#ff1744";
                ctx.lineWidth = 4;
                for (let l = 0; l < 4; l++) {
                    const ang = (l * Math.PI / 4) + progress * 2;
                    ctx.beginPath();
                    ctx.moveTo(-120 * Math.cos(ang), -120 * Math.sin(ang));
                    ctx.lineTo(120 * Math.cos(ang), 120 * Math.sin(ang));
                    ctx.stroke();
                }
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }

            ctx.restore();
        }
    }

    spawnFloatingText(x, y, text, color = "#ffcb05", subText = "", scale = 1.0) {
        this.floatingTexts.push({
            x: x,
            y: y,
            text: text,
            subText: subText,
            color: color,
            scale: scale,
            life: 45,
            maxLife: 45
        });
    }

    renderFloatingTexts(ctx) {
        for (const ft of this.floatingTexts) {
            const alpha = Math.min(1.0, ft.life / 12);
            ctx.save();
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.font = `900 ${Math.round(18 * ft.scale)}px 'Orbitron', monospace, sans-serif`;
            ctx.textAlign = "center";
            ctx.shadowColor = ft.color;
            ctx.shadowBlur = 14;
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);

            if (ft.subText) {
                ctx.font = `bold ${Math.round(11 * ft.scale)}px 'Rajdhani', sans-serif`;
                ctx.fillStyle = "#ffffff";
                ctx.shadowColor = "#ffffff";
                ctx.shadowBlur = 6;
                ctx.fillText(ft.subText, ft.x, ft.y + 16 * ft.scale);
            }
            ctx.restore();
        }
    }

    renderGhostTrails(ctx, f) {
        if (!f || !f.ghostTrails || f.ghostTrails.length === 0) return;
        for (const ghost of f.ghostTrails) {
            if (!ghost.sprite || !ghost.sprite.complete || ghost.sprite.naturalWidth === 0) continue;
            ctx.save();
            const depthScale = 1.0 + ghost.z * 0.12;
            ctx.translate(ghost.x, ghost.y);
            ctx.scale(ghost.facing * depthScale * ghost.animScaleX, depthScale * ghost.animScaleY);
            if (ghost.animTilt) ctx.rotate((ghost.animTilt * Math.PI) / 180);

            ctx.globalAlpha = Math.max(0, ghost.alpha * 0.45);
            ctx.shadowColor = ghost.color;
            ctx.shadowBlur = 16;
            ctx.filter = "brightness(2) contrast(1.5)";
            const aspect = ghost.sprite.naturalWidth / ghost.sprite.naturalHeight;
            const drawH = f.charData.height * 1.15;
            const drawW = drawH * aspect;
            ctx.drawImage(ghost.sprite, -drawW / 2, -drawH, drawW, drawH);
            ctx.restore();
        }
    }

    gameLoop() {
        if (!this.running) return;

        if (this.isPaused) {
            this.render();
            requestAnimationFrame(() => this.gameLoop());
            return;
        }

        // Slow-Motion Final Hit Replay Loop (0.25x speed)
        if (this.isReplaying) {
            this.replayTick++;
            if (this.replayTick >= 4) {
                this.replayTick = 0;
                this.replayIndex++;
                if (this.replayIndex >= this.replayBuffer.length) {
                    this.stopSlowMoReplay();
                    requestAnimationFrame(() => this.gameLoop());
                    return;
                }
            }
            this.renderReplayFrame();
            requestAnimationFrame(() => this.gameLoop());
            return;
        }

        // Hit-stop impact freeze (gives heavy Tekken combat crunch)
        if (this.hitStopFrames > 0) {
            this.hitStopFrames--;
            this.render();
            requestAnimationFrame(() => this.gameLoop());
            return;
        }

        // Slow-mo freeze processing
        if (this.slowMoFrames > 0) {
            this.slowMoFrames--;
            if (this.slowMoFrames % 3 !== 0) {
                this.render();
                requestAnimationFrame(() => this.gameLoop());
                return;
            }
        }

        this.frame++;

        // Record snapshot for instant replay ring buffer
        if (!this.matchOver) {
            this.recordFrameSnapshot();

            // Update Bot AI
            if (this.botAI) {
                this.botAI.update();
            }
        }

        // Update Fighters
        if (this.p1) this.p1.update();
        if (this.p2) this.p2.update();

        // Update Camera Tracking & Zoom (Tekken Style)
        if (this.p1 && this.p2) {
            const midX = (this.p1.x + this.p2.x) / 2;
            const dist = Math.abs(this.p1.x - this.p2.x);
            // Smoothly target center
            this.camX += (midX - 500 - this.camX) * 0.08;

            // Zoom in on close range combat, zoom out on long range
            const targetZoom = Math.min(1.22, Math.max(0.92, 1.25 - (dist / 900)));
            this.camZoom += (targetZoom - this.camZoom) * 0.05;
        }

        // Camera Shake decay
        if (this.shakeDuration > 0) {
            this.shakeDuration--;
        } else {
            this.shakeIntensity = 0;
        }

        // Update particles
        for (let i = this.sparks.length - 1; i >= 0; i--) {
            const s = this.sparks[i];
            s.x += s.vx;
            s.y += s.vy;
            s.life--;
            if (s.life <= 0) this.sparks.splice(i, 1);
        }

        for (let i = this.shields.length - 1; i >= 0; i--) {
            const sh = this.shields[i];
            sh.radius += 1.5;
            sh.life--;
            if (sh.life <= 0) this.shields.splice(i, 1);
        }

        for (let i = this.attackVFX.length - 1; i >= 0; i--) {
            const fx = this.attackVFX[i];
            fx.life--;
            if (fx.life <= 0) this.attackVFX.splice(i, 1);
        }

        // Update & decay floating combat text
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y -= 0.85;
            ft.life--;
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }

        if (this.bannerTime > 0) this.bannerTime--;

        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.save();
        ctx.clearRect(0, 0, w, h);

        // Apply Camera Shake & Pan/Zoom
        let shakeOffsetX = 0;
        let shakeOffsetY = 0;
        if (this.shakeIntensity > 0) {
            shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity;
            shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity;
        }

        ctx.translate(w / 2 + shakeOffsetX, h / 2 + shakeOffsetY);
        ctx.scale(this.camZoom, this.camZoom);
        ctx.translate(-w / 2 - this.camX, -h / 2);

        // 1. Draw 2.5D Cyber Arena Background
        this.renderStage(ctx, w, h);

        // 2. Draw Fighter Shadows (depth based on Z axis)
        if (this.p1) this.renderShadow(ctx, this.p1);
        if (this.p2) this.renderShadow(ctx, this.p2);

        // 3. Draw Fighters & High-Speed Ghost Trails (sorted by Z axis for 2.5D depth)
        const fighters = [this.p1, this.p2].filter(Boolean).sort((a, b) => a.z - b.z);
        for (const f of fighters) {
            this.renderGhostTrails(ctx, f);
            this.renderFighter(ctx, f);
        }

        // 4. Draw Projectiles
        if (this.p1) this.renderProjectiles(ctx, this.p1);
        if (this.p2) this.renderProjectiles(ctx, this.p2);

        // 5. Draw Particles
        for (const s of this.sparks) {
            ctx.save();
            ctx.fillStyle = s.color;
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size * (s.life / s.maxLife), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 6. Draw Firewall Shield Hex Grids
        for (const sh of this.shields) {
            ctx.save();
            ctx.strokeStyle = `rgba(0, 229, 255, ${sh.life / sh.maxLife})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(sh.x, sh.y, sh.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 7. Draw Dynamic Attack Animations & VFX
        this.renderAttackVFX(ctx);

        // 8. Draw Floating Combat Text Floaters (Super Effective / Counter Hit)
        this.renderFloatingTexts(ctx);

        ctx.restore();

        // 7. Draw HUD (Static UI overlay)
        this.renderHUD(ctx, w, h);

        // 8. Draw Announcement Banner
        if (this.bannerTime > 0 && this.bannerText) {
            this.renderBanner(ctx, w, h);
        }
    }

    renderStage(ctx, w, h) {
        // 1. Pokémon Stadium Arena Dome Gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "#050b18");
        grad.addColorStop(0.45, "#0e1e38");
        grad.addColorStop(1, "#081220");
        ctx.fillStyle = grad;
        ctx.fillRect(-200, 0, w + 400, h);

        // 2. Stadium Crowd & Floodlight Beams
        ctx.save();
        // Left Floodlight Beam
        const leftBeam = ctx.createLinearGradient(40, 0, 350, 520);
        leftBeam.addColorStop(0, "rgba(255, 255, 255, 0.22)");
        leftBeam.addColorStop(1, "rgba(42, 117, 187, 0.0)");
        ctx.fillStyle = leftBeam;
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.lineTo(120, 0);
        ctx.lineTo(480, 560);
        ctx.lineTo(200, 560);
        ctx.fill();

        // Right Floodlight Beam
        const rightBeam = ctx.createLinearGradient(w - 40, 0, w - 350, 520);
        rightBeam.addColorStop(0, "rgba(255, 255, 255, 0.22)");
        rightBeam.addColorStop(1, "rgba(42, 117, 187, 0.0)");
        ctx.fillStyle = rightBeam;
        ctx.beginPath();
        ctx.moveTo(w - 30, 0);
        ctx.lineTo(w - 120, 0);
        ctx.lineTo(w - 480, 560);
        ctx.lineTo(w - 200, 560);
        ctx.fill();
        ctx.restore();

        // 3. Electronic Pokémon League Stadium Billboard
        ctx.save();
        ctx.fillStyle = "rgba(10, 22, 45, 0.92)";
        ctx.fillRect(150, 110, 700, 48);
        ctx.strokeStyle = "#ffcb05";
        ctx.lineWidth = 2;
        ctx.strokeRect(150, 110, 700, 48);

        ctx.font = "bold 16px 'Orbitron', monospace, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffcb05";
        ctx.shadowColor = "#ffcb05";
        ctx.shadowBlur = 10;
        ctx.fillText("⚡ POKÉMON LEAGUE // CYBER TOURNAMENT 2026 ⚡", 500, 140);
        ctx.restore();

        // 4. Stadium Grandstand Banners
        for (let x = -80; x <= w + 80; x += 180) {
            ctx.fillStyle = "#152642";
            ctx.fillRect(x, 175, 140, 240);
            ctx.strokeStyle = "rgba(42, 117, 187, 0.5)";
            ctx.lineWidth = 1;
            ctx.strokeRect(x, 175, 140, 240);

            // Crowd silhouettes / LED dots
            for (let y = 195; y < 400; y += 22) {
                const led = (Math.sin(this.frame * 0.04 + x + y) > 0) ? "#ffcb05" : "#2a75bb";
                ctx.fillStyle = led;
                ctx.fillRect(x + 15, y, 6, 4);
                ctx.fillRect(x + 35, y, 6, 4);
                ctx.fillRect(x + 55, y, 6, 4);
                ctx.fillRect(x + 75, y, 6, 4);
                ctx.fillRect(x + 95, y, 6, 4);
            }
        }

        // 5. Pokémon Stadium Turf Floor
        const floorY = 510;
        const turfGrad = ctx.createLinearGradient(0, floorY, 0, h);
        turfGrad.addColorStop(0, "#1e4726");
        turfGrad.addColorStop(0.5, "#17381d");
        turfGrad.addColorStop(1, "#0d2212");
        ctx.fillStyle = turfGrad;
        ctx.fillRect(-200, floorY, w + 400, h - floorY + 60);

        // Perspective Turf Grid Lines
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1.5;
        for (let y = floorY; y <= h + 50; y += 22) {
            ctx.beginPath();
            ctx.moveTo(-200, y);
            ctx.lineTo(w + 400, y);
            ctx.stroke();
        }
        for (let x = -200; x <= w + 400; x += 75) {
            ctx.beginPath();
            ctx.moveTo(x, floorY);
            ctx.lineTo((x - 500) * 1.55 + 500, h + 50);
            ctx.stroke();
        }

        // 6. The Center Pokéball Court Ring (Classic Stadium Center Circle)
        ctx.save();
        const courtCenterX = 500;
        const courtCenterY = 545;
        const rx = 160;
        const ry = 42;

        // Outer white border
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(courtCenterX, courtCenterY, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Top half: Red
        ctx.fillStyle = "rgba(238, 21, 21, 0.45)";
        ctx.beginPath();
        ctx.ellipse(courtCenterX, courtCenterY, rx - 2, ry - 1, 0, Math.PI, Math.PI * 2);
        ctx.fill();

        // Bottom half: White
        ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
        ctx.beginPath();
        ctx.ellipse(courtCenterX, courtCenterY, rx - 2, ry - 1, 0, 0, Math.PI);
        ctx.fill();

        // Center seam line
        ctx.strokeStyle = "#111111";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(courtCenterX - rx + 2, courtCenterY);
        ctx.lineTo(courtCenterX + rx - 2, courtCenterY);
        ctx.stroke();

        // Center Pokéball Button
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#111111";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(courtCenterX, courtCenterY, 28, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner core glow
        ctx.fillStyle = "#00e5ff";
        ctx.beginPath();
        ctx.ellipse(courtCenterX, courtCenterY, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 7. Left & Right Stage Ring Barriers
        const barrierGradLeft = ctx.createLinearGradient(90, 0, 60, 0);
        barrierGradLeft.addColorStop(0, "rgba(0, 229, 255, 0.45)");
        barrierGradLeft.addColorStop(1, "rgba(0, 229, 255, 0)");
        ctx.fillStyle = barrierGradLeft;
        ctx.fillRect(60, 80, 40, 450);

        const barrierGradRight = ctx.createLinearGradient(910, 0, 940, 0);
        barrierGradRight.addColorStop(0, "rgba(0, 229, 255, 0.45)");
        barrierGradRight.addColorStop(1, "rgba(0, 229, 255, 0)");
        ctx.fillStyle = barrierGradRight;
        ctx.fillRect(910, 80, 40, 450);
    }

    renderShadow(ctx, f) {
        const shadowScale = 1.0 + f.z * 0.15;
        const shadowAlpha = Math.max(0.2, 0.6 - (f.baseY - f.y) / 250);
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
        ctx.beginPath();
        ctx.ellipse(f.x, f.baseY + 5 + f.z * 15, 45 * shadowScale, 14 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    renderFighter(ctx, f) {
        ctx.save();

        // 2.5D Sidestep perspective scaling & Procedural Attack Transforms
        const depthScale = 1.0 + f.z * 0.12;
        const renderX = f.x + (f.animOffsetX || 0);
        const renderY = f.y + f.z * 15 + (f.animOffsetY || 0);

        ctx.translate(renderX, renderY);
        ctx.scale(f.facing * depthScale * (f.animScaleX || 1.0), depthScale * (f.animScaleY || 1.0));

        // Procedural Strike & Flinch Tilt
        let tilt = f.animTilt || 0;
        if (f.state === "hitstun") {
            tilt = -14 + Math.sin(f.stateTime * 1.5) * 4;
        } else if (f.state === "crouch") {
            tilt = 6;
        }
        if (tilt !== 0) {
            ctx.rotate((tilt * Math.PI) / 180);
        }

        // Mega Evolution Divine Aura
        if (f.isTransformed) {
            ctx.save();
            ctx.shadowColor = f.charData.color || "#00e5ff";
            ctx.shadowBlur = 35 + Math.sin(this.frame * 0.25) * 15;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(0, -f.charData.height * 0.52, f.charData.width * 0.7, f.charData.height * 0.65, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        } else if (f.inRage) {
            // Rage Art Cyber Aura Glow
            ctx.save();
            ctx.shadowColor = "#ff1744";
            ctx.shadowBlur = 25 + Math.sin(this.frame * 0.2) * 15;
            ctx.strokeStyle = "rgba(255, 23, 68, 0.6)";
            ctx.lineWidth = 4;
            ctx.strokeRect(-f.charData.width / 2 - 5, -f.charData.height - 5, f.charData.width + 10, f.charData.height + 10);
            ctx.restore();
        }

        // White-out Hit Flash on Clean Impact
        if (f.hitFlashFrames > 0) {
            ctx.filter = "brightness(3.5) contrast(2)";
        }

        // Select Active Sprite dynamically based on combat state & orientation
        let sprite;
        const useBackSprite = (f.side === 1 && f.facing === -1) || (f.side === 2 && f.facing === 1);

        if (f.isTransformed) {
            sprite = useBackSprite ? f.megaBackImg : f.megaFrontImg;
        } else if (f.inRage || f.state === "attack") {
            // When executing heavy attacks or in Rage mode, use shiny/overcharged sprite variation!
            sprite = useBackSprite ? (f.shinyBackImg.complete ? f.shinyBackImg : f.spriteBackImg) : (f.shinyFrontImg.complete ? f.shinyFrontImg : f.spriteFrontImg);
        } else {
            sprite = useBackSprite ? f.spriteBackImg : f.spriteFrontImg;
        }

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            const aspect = sprite.naturalWidth / sprite.naturalHeight;
            const drawH = f.charData.height * 1.15;
            const drawW = drawH * aspect;
            ctx.drawImage(sprite, -drawW / 2, -drawH, drawW, drawH);
        } else {
            // High-tech placeholder if sprite loading
            ctx.fillStyle = f.charData.color || "#00e5ff";
            ctx.fillRect(-f.charData.width / 2, -f.charData.height, f.charData.width, f.charData.height);
        }

        ctx.restore();
    }

    renderProjectiles(ctx, f) {
        for (const p of f.projectiles) {
            ctx.save();
            const id = f.charData.id;

            if (id === "lucario") {
                // Aura Sphere: Glowing blue sphere with dual rotating orbital rings
                ctx.fillStyle = "#00e5ff";
                ctx.shadowColor = "#00e5ff";
                ctx.shadowBlur = 22;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = "rgba(41, 182, 246, 0.85)";
                ctx.lineWidth = 3;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(this.frame * 0.15);
                ctx.beginPath();
                ctx.ellipse(0, 0, 28, 10, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.rotate(Math.PI / 2);
                ctx.beginPath();
                ctx.ellipse(0, 0, 28, 10, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            } else if (id === "gengar") {
                // Shadow Ball: Pulsing purple void with ghost souls
                ctx.fillStyle = "#735797";
                ctx.shadowColor = "#ab47bc";
                ctx.shadowBlur = 24;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = "#110520";
                ctx.beginPath();
                ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
                ctx.fill();

                for (let a = 0; a < 3; a++) {
                    const ang = this.frame * 0.12 + (a * Math.PI * 2 / 3);
                    const wx = p.x + Math.cos(ang) * 26;
                    const wy = p.y + Math.sin(ang) * 26;
                    ctx.fillStyle = "#e040fb";
                    ctx.beginPath();
                    ctx.arc(wx, wy, 5, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (id === "pikachu") {
                // Thunderbolt: Jagged multi-point electric bolt
                ctx.strokeStyle = "#ffea00";
                ctx.shadowColor = "#ffea00";
                ctx.shadowBlur = 20;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(p.x - p.vx * 2.5, p.y);
                ctx.lineTo(p.x - p.vx * 1.2, p.y - 14);
                ctx.lineTo(p.x, p.y + 14);
                ctx.lineTo(p.x + p.vx * 1.2, p.y);
                ctx.stroke();

                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
                ctx.fill();
            } else if (id === "greninja") {
                // Water Shuriken: Rapid 360° spinning 4-point ninja star
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(this.frame * 0.3);
                ctx.fillStyle = "rgba(99, 144, 240, 0.92)";
                ctx.shadowColor = "#00e5ff";
                ctx.shadowBlur = 18;
                ctx.beginPath();
                for (let i = 0; i < 4; i++) {
                    ctx.rotate(Math.PI / 2);
                    ctx.lineTo(0, -25);
                    ctx.lineTo(8, -8);
                }
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else if (id === "porygonz") {
                // Tri-Attack: RGB 3-color laser beam with binary 0/1 particles
                const colors = ["#ff1744", "#00e5ff", "#ffea00"];
                colors.forEach((col, idx) => {
                    ctx.fillStyle = col;
                    ctx.shadowColor = col;
                    ctx.shadowBlur = 12;
                    ctx.beginPath();
                    ctx.arc(p.x - idx * 10 * Math.sign(p.vx), p.y + (idx - 1) * 8, 8, 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.font = "bold 12px monospace";
                ctx.fillStyle = "#00e676";
                ctx.fillText(this.frame % 2 === 0 ? "1" : "0", p.x - p.vx * 2, p.y - 14);
            } else {
                // Default / Scizor / Blaziken / Mewtwo
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 16;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    renderHUD(ctx, w, h) {
        if (!this.p1 || !this.p2) return;

        // 1. Center Timer & Pokéball Emblem
        ctx.save();
        const centerX = w / 2;

        // Center mini Pokéball
        ctx.save();
        ctx.translate(centerX, 25);
        ctx.beginPath();
        ctx.arc(0, 0, 14, Math.PI, Math.PI * 2);
        ctx.fillStyle = "#ee1515";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#111111";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Timer numerals
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 38px 'Orbitron', monospace, sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = "#ffcb05";
        ctx.shadowBlur = 12;
        ctx.fillText(this.roundTime.toString().padStart(2, '0'), centerX, 68);

        // Round indicator
        ctx.font = "bold 14px 'Orbitron', monospace";
        ctx.fillStyle = "#ffcb05";
        ctx.fillText("ROUND " + this.round, centerX, 92);

        // P1 Won Pokéballs (Left of timer)
        for (let i = 0; i < 2; i++) {
            const bx = centerX - 45 - (i * 22);
            ctx.beginPath();
            ctx.arc(bx, 88, 7, 0, Math.PI * 2);
            ctx.fillStyle = (i < this.p1Wins) ? "#ee1515" : "#1c2838";
            ctx.fill();
            ctx.strokeStyle = "#ffcb05";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // P2 Won Pokéballs (Right of timer)
        for (let i = 0; i < 2; i++) {
            const bx = centerX + 45 + (i * 22);
            ctx.beginPath();
            ctx.arc(bx, 88, 7, 0, Math.PI * 2);
            ctx.fillStyle = (i < this.p2Wins) ? "#ee1515" : "#1c2838";
            ctx.fill();
            ctx.strokeStyle = "#ffcb05";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
        ctx.restore();

        // 2. PLAYER 1 POKÉMON BATTLE PLATE (Left)
        this.renderPokemonPlate(ctx, this.p1, 35, 20, 390, false);

        // 3. PLAYER 2 POKÉMON BATTLE PLATE (Right)
        this.renderPokemonPlate(ctx, this.p2, w - 425, 20, 390, true);

        // 4. In-Game Controls Bar (Bottom)
        this.renderControlsBar(ctx, w, h);
    }

    renderPokemonPlate(ctx, f, x, y, width, isP2) {
        ctx.save();
        const pColor = (f.charData.themeColors && f.charData.themeColors.primary) || "#2a75bb";

        // Plate Background Container
        ctx.fillStyle = "rgba(14, 25, 45, 0.92)";
        ctx.strokeStyle = pColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, width, 92, 8);
        ctx.fill();
        ctx.stroke();

        // Accent top border strip
        ctx.fillStyle = pColor;
        ctx.beginPath();
        ctx.roundRect(x, y, width, 5, [8, 8, 0, 0]);
        ctx.fill();

        // Pokémon Name & Gender / Level
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 19px 'Orbitron', monospace, sans-serif";
        ctx.textAlign = isP2 ? "right" : "left";
        const nameX = isP2 ? x + width - 14 : x + 14;
        ctx.fillText(f.charData.name.toUpperCase(), nameX, y + 26);

        // Level Badge
        ctx.font = "bold 12px 'Orbitron', monospace";
        ctx.fillStyle = "#ffcb05";
        const lvlX = isP2 ? x + 14 : x + width - 70;
        ctx.fillText("Lv. 100", lvlX, y + 26);

        // Type Pill Badges
        const types = f.charData.types || ["NORMAL"];
        let typeBadgeX = isP2 ? x + width - 170 : x + 125;
        types.forEach(t => {
            const tInfo = (window.POKEMON_TYPES && window.POKEMON_TYPES[t]) || { color: "#888", textColor: "#fff" };
            ctx.fillStyle = tInfo.color;
            ctx.beginPath();
            ctx.roundRect(typeBadgeX, y + 13, 44, 15, 4);
            ctx.fill();
            ctx.fillStyle = tInfo.textColor || "#fff";
            ctx.font = "bold 9px 'Orbitron', sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(t, typeBadgeX + 22, y + 24);
            typeBadgeX += 48;
        });

        // HP Bar Layout
        const barX = x + 44;
        const barY = y + 42;
        const barW = width - 58;
        const barH = 18;

        // The iconic [HP] Yellow Box Label
        ctx.fillStyle = "#ffcb05";
        ctx.beginPath();
        ctx.roundRect(x + 12, barY - 1, 26, 20, 3);
        ctx.fill();
        ctx.fillStyle = "#111111";
        ctx.font = "900 11px 'Orbitron', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("HP", x + 25, barY + 14);

        // HP Bar Track (Empty)
        ctx.fillStyle = "#111822";
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 4);
        ctx.fill();
        ctx.strokeStyle = "#334455";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Dynamic HP Color: Green (>50%), Yellow (20-50%), Red (<20%)
        const hpRatio = Math.max(0, f.hp / f.maxHp);
        let hpColor = "#38a169"; // Vibrant Green
        if (hpRatio <= 0.2) {
            hpColor = (this.frame % 30 < 15) ? "#e53e3e" : "#ff6b6b"; // Flashing Red
        } else if (hpRatio <= 0.5) {
            hpColor = "#ecc94b"; // Caution Yellow
        }

        if (hpRatio > 0) {
            ctx.fillStyle = hpColor;
            ctx.beginPath();
            const fillW = Math.max(6, barW * hpRatio);
            ctx.roundRect(barX, barY, fillW, barH, 4);
            ctx.fill();
        }

        // Numeric HP readout
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px 'Orbitron', monospace";
        ctx.textAlign = isP2 ? "right" : "left";
        ctx.fillText(Math.round(f.hp) + " / " + f.maxHp, isP2 ? barX + barW - 6 : barX + 6, barY + 13);

        // Firewall Defense Bar (Guard Gauge)
        const fwRatio = Math.max(0, f.firewall / f.maxFirewall);
        const fwY = y + 68;
        ctx.fillStyle = "#00e5ff";
        ctx.font = "10px 'Orbitron', monospace";
        ctx.textAlign = "left";
        ctx.fillText("FIREWALL", x + 14, fwY + 9);

        // Firewall Bar Track
        const fwBarX = x + 85;
        const fwBarW = width - 100;
        ctx.fillStyle = "#111822";
        ctx.fillRect(fwBarX, fwY, fwBarW, 8);
        ctx.fillStyle = "#00e5ff";
        ctx.fillRect(fwBarX, fwY, fwBarW * fwRatio, 8);

        // Zero-Day Charge Bar (fills by landing hits; full = SOC auth available)
        const zdY = fwY + 12;
        ctx.font = "8px 'Orbitron', monospace";
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffcb05";
        ctx.fillText("ZERO-DAY", x + 14, zdY + 7);
        const zdRatio = Math.max(0, Math.min(1, f.threatMeter / 100));
        ctx.fillStyle = "#111822";
        ctx.fillRect(fwBarX, zdY, fwBarW, 6);
        ctx.fillStyle = zdRatio >= 1 ? "#ff1744" : "#ab47bc";
        ctx.fillRect(fwBarX, zdY, fwBarW * zdRatio, 6);

        // Rage Art Super Prompt (3 states: charging / needs auth / ready)
        if (f.inRage) {
            ctx.fillStyle = (this.frame % 20 < 10) ? "#ee1515" : "#ffea00";
            ctx.font = "bold 11px 'Orbitron', monospace";
            ctx.textAlign = isP2 ? "right" : "left";
            const superKey = isP2 ? "ENTER" : "SPACE";
            let rageText;
            if (f.rageUnlocked && f.threatMeter >= 100) {
                rageText = `⚡ ZERO-DAY READY [${superKey}]`;
            } else if (f.threatMeter >= 100) {
                rageText = `⚡ METER FULL — SOC AUTH [${superKey}]`;
            } else {
                rageText = `◌ CHARGING ZERO-DAY ${Math.floor(zdRatio * 100)}%`;
            }
            ctx.fillText(rageText, isP2 ? x + width - 14 : x + 14, y + 106);
        }
        ctx.restore();
    }

    renderControlsBar(ctx, w, h) {
        ctx.save();
        const barH = 28;
        const barY = h - barH;
        ctx.fillStyle = "rgba(8, 16, 32, 0.88)";
        ctx.fillRect(0, barY, w, barH);
        ctx.strokeStyle = "rgba(255, 203, 5, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, barY);
        ctx.lineTo(w, barY);
        ctx.stroke();

        ctx.font = "bold 11px 'Orbitron', monospace, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffcb05";

        if (this.mode === 'pvp_local') {
            ctx.fillText("P1: [J] Light  [K] Launch  [L] Special  [SPACE] Super*  |  P2: [1/B] Light  [2/N] Launch  [3/M] Special  [ENTER] Super*  (*full meter + quiz)", w / 2, barY + 18);
        } else {
            ctx.fillText("CONTROLS:  [J] Light Attack / Combo   [K] Heavy / Launcher   [L] Special Move   [SPACE] Super* (*full meter + quiz)", w / 2, barY + 18);
        }
        ctx.restore();
    }

    renderBanner(ctx, w, h) {
        ctx.save();
        ctx.fillStyle = "rgba(5, 12, 25, 0.88)";
        ctx.fillRect(0, h / 2 - 70, w, 140);
        ctx.strokeStyle = this.bannerColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(0, h / 2 - 70, w, 140);

        ctx.font = "900 52px 'Orbitron', monospace, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = this.bannerColor;
        ctx.shadowColor = this.bannerColor;
        ctx.shadowBlur = 20;
        ctx.fillText(this.bannerText, w / 2, h / 2 + 18);
        ctx.restore();
    }

    // --- COMBAT EVENT TICKER & BROADCAST FEED ---
    logCombatEvent(type, message) {
        const tickerEl = document.getElementById("combat-ticker-text");
        if (!tickerEl) return;
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
        tickerEl.textContent = `[${timeStr}] [${type}] ${message}`;
        tickerEl.style.color = (type === "REPLAY" || type === "KO") ? "#ff1744" : ((type === "COUNTER" || type === "LAUNCH") ? "#ffcb05" : "#00e5ff");
    }

    // --- SLOW-MOTION FINAL HIT REPLAY ("TEKKEN KO CAM") ---
    cloneFighterSnapshot(f) {
        if (!f) return null;
        let activeSprite;
        const useBackSprite = (f.side === 1 && f.facing === -1) || (f.side === 2 && f.facing === 1);
        if (f.isTransformed) {
            activeSprite = useBackSprite ? f.megaBackImg : f.megaFrontImg;
        } else if (f.inRage || f.state === "attack") {
            activeSprite = useBackSprite ? (f.shinyBackImg.complete ? f.shinyBackImg : f.spriteBackImg) : (f.shinyFrontImg.complete ? f.shinyFrontImg : f.spriteFrontImg);
        } else {
            activeSprite = useBackSprite ? f.spriteBackImg : f.spriteFrontImg;
        }

        return {
            x: f.x,
            y: f.y,
            z: f.z,
            baseY: f.baseY,
            facing: f.facing,
            state: f.state,
            hp: f.hp,
            maxHp: f.maxHp,
            firewall: f.firewall,
            maxFirewall: f.maxFirewall,
            inRage: f.inRage,
            isTransformed: f.isTransformed,
            hitFlashFrames: f.hitFlashFrames,
            animOffsetX: f.animOffsetX,
            animOffsetY: f.animOffsetY,
            animScaleX: f.animScaleX,
            animScaleY: f.animScaleY,
            animTilt: f.animTilt,
            charData: f.charData,
            sprite: activeSprite
        };
    }

    recordFrameSnapshot() {
        if (this.isReplaying || !this.p1 || !this.p2) return;
        if (this.frameHistory.length >= 75) {
            this.frameHistory.shift();
        }
        this.frameHistory.push({
            p1: this.cloneFighterSnapshot(this.p1),
            p2: this.cloneFighterSnapshot(this.p2),
            camX: this.camX,
            camY: this.camY,
            camZoom: this.camZoom,
            shakeIntensity: this.shakeIntensity,
            roundTime: this.roundTime,
            bannerText: this.bannerText,
            bannerColor: this.bannerColor,
            attackVFX: this.attackVFX.map(v => ({ ...v })),
            sparks: this.sparks.map(s => ({ ...s }))
        });
    }

    startSlowMoReplay(winner, loser, onComplete) {
        if (this.frameHistory.length < 15) {
            if (onComplete) onComplete();
            return;
        }

        this.isReplaying = true;
        this.replayWinner = winner;
        this.replayLoser = loser;
        this.onReplayComplete = onComplete;

        // Extract the last 50 frames leading up to the final blow
        this.replayBuffer = this.frameHistory.slice(-50);
        this.replayIndex = 0;
        this.replayTick = 0;

        const overlay = document.getElementById("replay-overlay");
        if (overlay) overlay.classList.remove("hidden");

        this.logCombatEvent("REPLAY", `⏪ SLOW-MOTION FINISH REPLAY (0.25x SPEED) // ${winner.charData.name.toUpperCase()} FINISHING IMPACT`);
    }

    stopSlowMoReplay() {
        if (!this.isReplaying) return;
        this.isReplaying = false;
        const overlay = document.getElementById("replay-overlay");
        if (overlay) overlay.classList.add("hidden");

        if (this.onReplayComplete) {
            const cb = this.onReplayComplete;
            this.onReplayComplete = null;
            try {
                cb();
            } catch (err) {
                console.error("Error in onReplayComplete callback:", err);
            }
        }
    }

    renderReplayFrame() {
        const frameData = this.replayBuffer[this.replayIndex];
        if (!frameData) return;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.save();
        ctx.clearRect(0, 0, w, h);

        // Zoom in tighter on the finishing blow impact (1.32x zoom)
        const zoom = (frameData.camZoom || 1.0) * 1.32;
        const camX = frameData.camX || 0;

        ctx.translate(w / 2, h / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-w / 2 - camX, -h / 2);

        // 1. Stage
        this.renderStage(ctx, w, h);

        // 2. Shadows
        if (frameData.p1) this.renderSnapshotShadow(ctx, frameData.p1);
        if (frameData.p2) this.renderSnapshotShadow(ctx, frameData.p2);

        // 3. Fighters
        const fighters = [frameData.p1, frameData.p2].filter(Boolean).sort((a, b) => a.z - b.z);
        for (const f of fighters) {
            this.renderSnapshotFighter(ctx, f);
        }

        // 4. VFX & Sparks
        if (frameData.attackVFX) {
            this.attackVFX = frameData.attackVFX;
            this.renderAttackVFX(ctx);
        }
        if (frameData.sparks) {
            for (const s of frameData.sparks) {
                ctx.save();
                ctx.fillStyle = s.color;
                ctx.shadowColor = s.color;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        ctx.restore();

        // 5. Cinematic Replay Vignette
        ctx.save();
        const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.72);
        vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
        vignette.addColorStop(1, "rgba(0, 0, 0, 0.45)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        // 6. Static HUD
        this.renderHUD(ctx, w, h);
    }

    renderSnapshotShadow(ctx, f) {
        const shadowScale = 1.0 + f.z * 0.15;
        const shadowAlpha = Math.max(0.2, 0.6 - (f.baseY - f.y) / 250);
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
        ctx.beginPath();
        ctx.ellipse(f.x, f.baseY + 5 + f.z * 15, 45 * shadowScale, 14 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    renderSnapshotFighter(ctx, f) {
        ctx.save();
        const depthScale = 1.0 + f.z * 0.12;
        const renderX = f.x + (f.animOffsetX || 0);
        const renderY = f.y + f.z * 15 + (f.animOffsetY || 0);

        ctx.translate(renderX, renderY);
        ctx.scale(f.facing * depthScale * (f.animScaleX || 1.0), depthScale * (f.animScaleY || 1.0));

        if (f.animTilt) {
            ctx.rotate((f.animTilt * Math.PI) / 180);
        }

        if (f.isTransformed) {
            ctx.save();
            ctx.shadowColor = f.charData.color || "#00e5ff";
            ctx.shadowBlur = 35;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(0, -f.charData.height * 0.52, f.charData.width * 0.7, f.charData.height * 0.65, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        if (f.hitFlashFrames > 0) {
            ctx.filter = "brightness(3.5) contrast(2)";
        }

        const sprite = f.sprite;
        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            const aspect = sprite.naturalWidth / sprite.naturalHeight;
            const drawH = f.charData.height * 1.15;
            const drawW = drawH * aspect;
            ctx.drawImage(sprite, -drawW / 2, -drawH, drawW, drawH);
        } else {
            ctx.fillStyle = f.charData.color || "#00e5ff";
            ctx.fillRect(-f.charData.width / 2, -f.charData.height, f.charData.width, f.charData.height);
        }
        ctx.restore();
    }
}

window.gameEngine = new GameEngine();
