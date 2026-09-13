/**
 * CyberMon: Tekken Protocol - 60 FPS Fighting Game Engine
 * Features:
 * - 4-Limb Tekken combat system (1=LP, 2=RP, 3=LK, 4=RK)
 * - 2.5D Sidesteps with depth scaling & evasion
 * - Juggles, gravity scaling & wall splats
 * - High / Mid / Low block hierarchy & Firewall Guard Crush
 * - Dynamic Tekken camera (zoom, screen shake, slow-mo K.O.)
 * - Rich animated sprites with dynamic aura & particle engine
 */

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
        this.threatMeter = 0; // 0 - 100
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

        // Projectiles
        this.projectiles = [];

        // Reference to opponent
        this.opponent = null;
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

        if (window.soundEngine) window.soundEngine.playWhoosh();
    }

    // Zero-Day Rage Art Ultimate (Available at HP < 35%)
    executeRageArt() {
        if (!this.inRage || !this.canAct()) return;

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

        // Cinematic freeze & announcer
        if (window.gameEngine) {
            window.gameEngine.triggerSuperFreeze(60, this);
            window.soundEngine.playRageArt();
            window.soundEngine.announce("ZERO DAY EXPLOIT!");
        }
    }

    updateAttack() {
        this.moveFrame++;
        const m = this.currentMove;
        if (!m) {
            this.state = "idle";
            return;
        }

        // Active Hitbox Frames
        if (this.moveFrame >= m.startup && this.moveFrame < m.startup + m.active) {
            if (!this.hasHitThisMove) {
                if (m.projectile) {
                    this.spawnProjectile(m);
                    this.hasHitThisMove = true;
                } else {
                    this.checkHitboxCollision(m);
                }
            }
        }

        // Recovery finished
        if (this.moveFrame >= m.startup + m.active + m.recovery) {
            this.state = "idle";
            this.currentMove = null;
        }
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
                    window.soundEngine.announce("SECURITY BREACH!");
                }
                if (window.gameEngine) {
                    window.gameEngine.triggerCameraShake(15, 20);
                    window.gameEngine.showBanner("SECURITY BREACH!", "#ff1744");
                }
            }
            return;
        }

        // Clean Hit
        let damage = rawDamage / this.buffs.defenseUp;
        if (isCounterHit) damage *= 1.25;

        // Juggle Damage Scaling
        if (this.isJuggled) {
            damage *= Math.max(0.4, 1.0 - this.juggleHits * 0.15);
            this.juggleHits++;
        }

        this.hp = Math.max(0, this.hp - damage);

        // Sparks & Sound
        if (window.soundEngine) {
            window.soundEngine.playHit(isLauncher ? "launch" : "heavy", isCounterHit);
            if (isCounterHit) window.soundEngine.announce("COUNTER HIT!");
        }

        if (window.gameEngine) {
            const sparkColor = isCounterHit ? "#ffff00" : (this.charData.color || "#00e5ff");
            window.gameEngine.spawnSpark(this.x, this.y - 60, sparkColor, isCounterHit ? 30 : 18);
            window.gameEngine.triggerCameraShake(isCounterHit ? 10 : 6, 12);
        }

        // Launcher / Air Juggle State
        if (isLauncher || this.isJuggled) {
            this.isJuggled = true;
            this.isAirborne = true;
            const launchForce = attacker && attacker.currentMove && attacker.currentMove.launchForceY ? attacker.currentMove.launchForceY : -14.5;
            this.vy = launchForce;
            this.vx = (attacker ? attacker.facing : -this.facing) * 3.8;
            this.state = "knockdown";
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

        // Visual effects
        this.sparks = [];
        this.shields = [];
        this.bannerText = "";
        this.bannerColor = "#00e5ff";
        this.bannerTime = 0;

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
        if (!this.p1) return;

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

        // Player 1 Attacks (J=1/LP, I=2/RP, K=3/LK, O=4/RK, U=Special, Space=RageArt)
        if (isDown) {
            if (code === "KeyJ") {
                this.p1.executeAttack("1");
            } else if (code === "KeyI") {
                // Check if df+2 launcher input
                if (this.p1.inputDown && ((this.p1.facing === 1 && this.p1.inputRight) || (this.p1.facing === -1 && this.p1.inputLeft))) {
                    this.p1.executeAttack("df2");
                } else if ((this.p1.facing === 1 && this.p1.inputRight) || (this.p1.facing === -1 && this.p1.inputLeft)) {
                    this.p1.executeAttack("ff2");
                } else {
                    this.p1.executeAttack("2");
                }
            } else if (code === "KeyK") {
                this.p1.executeAttack("3");
            } else if (code === "KeyO" || code === "KeyL") {
                this.p1.executeAttack("4");
            } else if (code === "KeyU") {
                this.p1.executeAttack("special");
            } else if (code === "Space") {
                this.p1.executeRageArt();
            }
        }

        // Local Player 2 Controls (Arrow Keys + Numpad or 7/8/4/5)
        if (this.mode === 'pvp_local' && this.p2) {
            if (code === "ArrowLeft") this.p2.inputLeft = isDown;
            if (code === "ArrowRight") this.p2.inputRight = isDown;
            if (code === "ArrowUp") this.p2.inputUp = isDown;
            if (code === "ArrowDown") this.p2.inputDown = isDown;

            if (isDown) {
                if (code === "Numpad1" || code === "Digit7") this.p2.executeAttack("1");
                else if (code === "Numpad2" || code === "Digit8") {
                    if (this.p2.inputDown && ((this.p2.facing === 1 && this.p2.inputRight) || (this.p2.facing === -1 && this.p2.inputLeft))) {
                        this.p2.executeAttack("df2");
                    } else {
                        this.p2.executeAttack("2");
                    }
                } else if (code === "Numpad4" || code === "Digit9") this.p2.executeAttack("3");
                else if (code === "Numpad5" || code === "Digit0") this.p2.executeAttack("4");
                else if (code === "Numpad6" || code === "Minus") this.p2.executeAttack("special");
                else if (code === "Enter" || code === "NumpadEnter") this.p2.executeRageArt();
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
        this.p1.hp = this.p1.maxHp;
        this.p1.firewall = this.p1.maxFirewall;
        this.p1.x = 300;
        this.p1.y = 520;
        this.p1.state = "idle";
        this.p1.targetZ = 0;
        this.p1.z = 0;

        this.p2.hp = this.p2.maxHp;
        this.p2.firewall = this.p2.maxFirewall;
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
            window.soundEngine.announce(`Round ${this.round}. Fight!`);
        }
    }

    handleKO(winner, loser) {
        if (this.matchOver) return;
        this.triggerCameraShake(18, 25);
        this.triggerSuperFreeze(75);

        if (winner === this.p1) this.p1Wins++;
        else if (winner === this.p2) this.p2Wins++;

        this.showBanner("K.O.!", "#ff1744", 120);
        if (window.soundEngine) window.soundEngine.announce("K.O.!");

        setTimeout(() => {
            if (this.p1Wins >= 2 || this.p2Wins >= 2) {
                this.matchOver = true;
                const victor = this.p1Wins >= 2 ? this.p1 : this.p2;
                this.showBanner(`${victor.charData.name.toUpperCase()} WINS!`, "#00e676", 200);
                if (window.soundEngine) window.soundEngine.announce(`${victor.charData.name} wins!`);
                if (window.uiManager) window.uiManager.showVictoryScreen(victor);
            } else {
                this.round++;
                this.startRound();
            }
        }, 2200);
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

    gameLoop() {
        if (!this.running) return;

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

        // Update Bot AI
        if (this.botAI) {
            this.botAI.update();
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

        // 3. Draw Fighters (sorted by Z axis for 2.5D depth)
        const fighters = [this.p1, this.p2].filter(Boolean).sort((a, b) => a.z - b.z);
        for (const f of fighters) {
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

        ctx.restore();

        // 7. Draw HUD (Static UI overlay)
        this.renderHUD(ctx, w, h);

        // 8. Draw Announcement Banner
        if (this.bannerTime > 0 && this.bannerText) {
            this.renderBanner(ctx, w, h);
        }
    }

    renderStage(ctx, w, h) {
        // Cyber Arena Gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "#050b14");
        grad.addColorStop(0.65, "#0d1b2a");
        grad.addColorStop(1, "#02070e");
        ctx.fillStyle = grad;
        ctx.fillRect(-200, 0, w + 400, h);

        // Cyber Server Towers in Background
        for (let x = -100; x <= 1100; x += 150) {
            ctx.fillStyle = "#112233";
            ctx.fillRect(x, 140, 90, 360);

            // Blinking green/amber server LEDs
            for (let y = 160; y < 480; y += 22) {
                const ledColor = (Math.sin(this.frame * 0.05 + x + y) > 0) ? "#00e676" : "#ff9100";
                ctx.fillStyle = ledColor;
                ctx.fillRect(x + 10, y, 6, 3);
                ctx.fillRect(x + 22, y, 6, 3);
                ctx.fillStyle = "#00e5ff";
                ctx.fillRect(x + 40, y, 35, 2);
            }
        }

        // Floor Grid (Tekken perspective grid)
        const floorY = 520;
        ctx.strokeStyle = "rgba(0, 229, 255, 0.35)";
        ctx.lineWidth = 1.5;

        // Horizontal perspective lines
        for (let y = floorY; y <= h + 50; y += 24) {
            ctx.beginPath();
            ctx.moveTo(-200, y);
            ctx.lineTo(w + 400, y);
            ctx.stroke();
        }

        // Vertical converging grid lines
        for (let x = -200; x <= w + 400; x += 60) {
            ctx.beginPath();
            ctx.moveTo(x, floorY);
            ctx.lineTo((x - 500) * 1.6 + 500, h + 50);
            ctx.stroke();
        }

        // Digital Firewall Stage Barriers (Left & Right boundaries)
        const barrierGradLeft = ctx.createLinearGradient(120, 0, 80, 0);
        barrierGradLeft.addColorStop(0, "rgba(255, 23, 68, 0.4)");
        barrierGradLeft.addColorStop(1, "rgba(255, 23, 68, 0)");
        ctx.fillStyle = barrierGradLeft;
        ctx.fillRect(80, 100, 40, 430);

        const barrierGradRight = ctx.createLinearGradient(880, 0, 920, 0);
        barrierGradRight.addColorStop(0, "rgba(255, 23, 68, 0.4)");
        barrierGradRight.addColorStop(1, "rgba(255, 23, 68, 0)");
        ctx.fillStyle = barrierGradRight;
        ctx.fillRect(880, 100, 40, 430);
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

        // 2.5D Sidestep perspective scaling
        const depthScale = 1.0 + f.z * 0.12;
        const renderY = f.y + f.z * 15;

        ctx.translate(f.x, renderY);
        ctx.scale(f.facing * depthScale, depthScale);

        // Rage Art Cyber Aura Glow
        if (f.inRage) {
            ctx.save();
            ctx.shadowColor = "#ff1744";
            ctx.shadowBlur = 25 + Math.sin(this.frame * 0.2) * 15;
            ctx.strokeStyle = "rgba(255, 23, 68, 0.6)";
            ctx.lineWidth = 4;
            ctx.strokeRect(-f.charData.width / 2 - 5, -f.charData.height - 5, f.charData.width + 10, f.charData.height + 10);
            ctx.restore();
        }

        // Draw Official Pokémon Animated Sprite
        const sprite = (f.facing === 1) ? f.spriteFrontImg : f.spriteBackImg;
        if (sprite.complete && sprite.naturalWidth > 0) {
            const aspect = sprite.naturalWidth / sprite.naturalHeight;
            const drawH = f.charData.height * 1.15;
            const drawW = drawH * aspect;
            ctx.drawImage(sprite, -drawW / 2, -drawH, drawW, drawH);
        } else {
            // High-tech placeholder if sprite loading
            ctx.fillStyle = f.charData.color || "#00e5ff";
            ctx.fillRect(-f.charData.width / 2, -f.charData.height, f.charData.width, f.charData.height);
        }

        // Attack Spark Trails
        if (f.state === "attack" && f.currentMove) {
            ctx.strokeStyle = f.charData.color || "#00e5ff";
            ctx.lineWidth = 3;
            ctx.strokeRect(f.currentMove.hitbox.x, f.currentMove.hitbox.y, f.currentMove.hitbox.w, f.currentMove.hitbox.h);
        }

        ctx.restore();
    }

    renderProjectiles(ctx, f) {
        for (const p of f.projectiles) {
            ctx.save();
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
            ctx.fill();

            // Energy core
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    renderHUD(ctx, w, h) {
        if (!this.p1 || !this.p2) return;

        // Timer in center
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 38px 'Orbitron', monospace, sans-serif";
        ctx.textAlign = "center";
        ctx.shadowColor = "#00e5ff";
        ctx.shadowBlur = 10;
        ctx.fillText(this.roundTime.toString().padStart(2, '0'), w / 2, 60);

        // Round Win Markers
        ctx.font = "bold 16px 'Orbitron', monospace";
        ctx.fillStyle = "#00e5ff";
        ctx.fillText(`ROUND ${this.round}`, w / 2, 90);

        // P1 Win Dots
        for (let i = 0; i < 2; i++) {
            ctx.beginPath();
            ctx.arc(w / 2 - 40 - (i * 20), 85, 6, 0, Math.PI * 2);
            ctx.fillStyle = (i < this.p1Wins) ? "#ffea00" : "#223344";
            ctx.fill();
            ctx.strokeStyle = "#00e5ff";
            ctx.stroke();
        }
        // P2 Win Dots
        for (let i = 0; i < 2; i++) {
            ctx.beginPath();
            ctx.arc(w / 2 + 40 + (i * 20), 85, 6, 0, Math.PI * 2);
            ctx.fillStyle = (i < this.p2Wins) ? "#ffea00" : "#223344";
            ctx.fill();
            ctx.strokeStyle = "#00e5ff";
            ctx.stroke();
        }

        // P1 Health Bar (Left)
        const barW = 380;
        const barH = 26;
        const p1HpRatio = Math.max(0, this.p1.hp / this.p1.maxHp);
        ctx.fillStyle = "rgba(10, 20, 35, 0.85)";
        ctx.fillRect(40, 35, barW, barH);
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 35, barW, barH);

        const p1Grad = ctx.createLinearGradient(40, 0, 40 + barW, 0);
        p1Grad.addColorStop(0, this.p1.inRage ? "#ff1744" : "#ffea00");
        p1Grad.addColorStop(1, this.p1.inRage ? "#d50000" : "#00e676");
        ctx.fillStyle = p1Grad;
        ctx.fillRect(40 + (barW * (1 - p1HpRatio)), 35, barW * p1HpRatio, barH);

        // P1 Firewall (Guard) Bar
        const p1FwRatio = Math.max(0, this.p1.firewall / this.p1.maxFirewall);
        ctx.fillStyle = "#00bcd4";
        ctx.fillRect(40 + (barW * (1 - p1FwRatio)), 65, barW * p1FwRatio, 8);

        // P1 Name & Title
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px 'Orbitron', monospace";
        ctx.textAlign = "left";
        ctx.fillText(this.p1.charData.name.toUpperCase(), 40, 28);
        ctx.font = "12px 'Orbitron', monospace";
        ctx.fillStyle = "#00e5ff";
        ctx.fillText(`FIREWALL: ${Math.round(p1FwRatio * 100)}%`, 40, 88);

        // P2 Health Bar (Right)
        const p2HpRatio = Math.max(0, this.p2.hp / this.p2.maxHp);
        const p2StartX = w - 40 - barW;
        ctx.fillStyle = "rgba(10, 20, 35, 0.85)";
        ctx.fillRect(p2StartX, 35, barW, barH);
        ctx.strokeStyle = "#00e5ff";
        ctx.strokeRect(p2StartX, 35, barW, barH);

        const p2Grad = ctx.createLinearGradient(p2StartX, 0, p2StartX + barW, 0);
        p2Grad.addColorStop(0, this.p2.inRage ? "#ff1744" : "#00e676");
        p2Grad.addColorStop(1, this.p2.inRage ? "#d50000" : "#ffea00");
        ctx.fillStyle = p2Grad;
        ctx.fillRect(p2StartX, 35, barW * p2HpRatio, barH);

        // P2 Firewall Bar
        const p2FwRatio = Math.max(0, this.p2.firewall / this.p2.maxFirewall);
        ctx.fillStyle = "#00bcd4";
        ctx.fillRect(p2StartX, 65, barW * p2FwRatio, 8);

        // P2 Name & Title
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px 'Orbitron', monospace";
        ctx.textAlign = "right";
        ctx.fillText(this.p2.charData.name.toUpperCase(), w - 40, 28);
        ctx.font = "12px 'Orbitron', monospace";
        ctx.fillStyle = "#00e5ff";
        ctx.fillText(`FIREWALL: ${Math.round(p2FwRatio * 100)}%`, w - 40, 88);

        // RAGE Indicator
        if (this.p1.inRage) {
            ctx.fillStyle = "#ff1744";
            ctx.font = "bold 16px 'Orbitron', monospace";
            ctx.textAlign = "left";
            ctx.fillText("⚡ RAGE ART READY [SPACE]", 40, 110);
        }
        if (this.p2.inRage) {
            ctx.fillStyle = "#ff1744";
            ctx.font = "bold 16px 'Orbitron', monospace";
            ctx.textAlign = "right";
            ctx.fillText(this.mode === 'pvp_local' ? "[ENTER] RAGE ART READY ⚡" : "RAGE ART READY ⚡", w - 40, 110);
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
}

window.gameEngine = new GameEngine();
