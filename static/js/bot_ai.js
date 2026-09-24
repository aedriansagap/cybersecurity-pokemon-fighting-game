/**
 * CyberMon: Tekken Protocol - Bot AI Engine
 * Supports 4 Cyber Threat Tiers:
 * 1. Script Kiddie (Easy)
 * 2. White Hat Sentinel (Medium)
 * 3. APT Infiltrator (Hard)
 * 4. Zero-Day Overlord (Nightmare)
 */

class BotAI {
    constructor(fighter, opponent, difficulty = "apt_hacker") {
        this.fighter = fighter;
        this.opponent = opponent;
        this.difficulty = difficulty;
        this.decisionTimer = 0;
        this.decisionInterval = this.getInterval();
        this.juggleQueue = [];
    }

    getInterval() {
        switch (this.difficulty) {
            case "script_kiddie": return 24; // Slow reaction (~400ms)
            case "white_hat": return 14;     // Medium (~230ms)
            case "apt_hacker": return 7;      // Sharp (~110ms)
            case "zero_day_overlord": return 2; // Near frame-perfect
            default: return 12;
        }
    }

    update() {
        if (!this.fighter || !this.opponent || this.fighter.isDead || this.opponent.isDead) return;

        this.decisionTimer++;
        if (this.decisionTimer < this.decisionInterval) return;
        this.decisionTimer = 0;

        const dist = Math.abs(this.fighter.x - this.opponent.x);
        const oppFacing = this.opponent.facing;
        const oppAttacking = this.opponent.state === "attack" || this.opponent.state === "launcher";
        const oppAirborne = this.opponent.isAirborne || this.opponent.isJuggled;

        // Reset inputs
        this.fighter.inputLeft = false;
        this.fighter.inputRight = false;
        this.fighter.inputDown = false;
        this.fighter.inputUp = false;

        // Handle Juggle Combo Follow-up
        if (oppAirborne && this.juggleQueue.length > 0) {
            const nextMove = this.juggleQueue.shift();
            this.fighter.executeAttack(nextMove);
            return;
        }

        // Check if opponent is airborne - queue juggle combo!
        if (oppAirborne && dist < 120 && this.fighter.canAct()) {
            if (this.difficulty === "apt_hacker" || this.difficulty === "zero_day_overlord") {
                this.juggleQueue = ["1", "2", "4"];
                const nextMove = this.juggleQueue.shift();
                this.fighter.executeAttack(nextMove);
                return;
            }
        }

        // Defensive Reaction (Guard / Sidestep)
        if (oppAttacking && dist < 130) {
            const currentOppMove = this.opponent.currentMove;
            const blockChance = {
                "script_kiddie": 0.25,
                "white_hat": 0.65,
                "apt_hacker": 0.88,
                "zero_day_overlord": 0.98
            }[this.difficulty];

            if (Math.random() < blockChance) {
                // Guard back
                if (this.fighter.facing === 1) {
                    this.fighter.inputLeft = true;
                } else {
                    this.fighter.inputRight = true;
                }

                // If low attack, crouch block!
                if (currentOppMove && currentOppMove.type === "low") {
                    this.fighter.inputDown = true;
                }

                // High-level sidestep dodge
                if ((this.difficulty === "apt_hacker" || this.difficulty === "zero_day_overlord") && Math.random() < 0.35) {
                    this.fighter.sidestep(Math.random() > 0.5 ? 1 : -1);
                }
                return;
            }
        }

        // Zero-Day Rage Art: bot must also charge the meter and pass its own
        // "SOC challenge" (simulated per difficulty) before it can fire.
        if (this.fighter.inRage && this.fighter.threatMeter >= 100 && this.fighter.canAct()) {
            if (!this.fighter.rageUnlocked) {
                const authChance = {
                    "script_kiddie": 0.004,
                    "white_hat": 0.01,
                    "apt_hacker": 0.02,
                    "zero_day_overlord": 0.04
                }[this.difficulty];
                if (Math.random() < authChance) {
                    this.fighter.rageUnlocked = true;
                    if (window.gameEngine) window.gameEngine.showBanner("BOT AUTHENTICATED ITS ZERO-DAY!", "#ff1744", 100);
                }
            }
            const rageThreshold = {
                "script_kiddie": 0.1,
                "white_hat": 0.3,
                "apt_hacker": 0.6,
                "zero_day_overlord": 0.9
            }[this.difficulty];

            if (dist < 140 && Math.random() < rageThreshold && (!oppAttacking || this.difficulty === "zero_day_overlord")) {
                this.fighter.executeRageArt();
                return;
            }
        }

        // Spacing & Neutral Game
        if (dist > 180) {
            // Close distance or shoot projectile
            if (Math.random() < 0.2 && this.fighter.charData.moves.special.projectile) {
                this.fighter.executeAttack("special");
            } else {
                // Move towards opponent
                if (this.fighter.x < this.opponent.x) {
                    this.fighter.inputRight = true;
                } else {
                    this.fighter.inputLeft = true;
                }
            }
        } else if (dist < 75) {
            // Close Range Pressure
            if (!this.fighter.canAct()) return;

            const roll = Math.random();
            if (this.difficulty === "script_kiddie") {
                if (roll < 0.5) this.fighter.executeAttack("1");
                else if (roll < 0.8) this.fighter.executeAttack("2");
                else this.fighter.executeAttack("3");
            } else if (this.difficulty === "white_hat") {
                if (roll < 0.3) this.fighter.executeAttack("1");
                else if (roll < 0.55) this.fighter.executeAttack("2");
                else if (roll < 0.8) this.fighter.executeAttack("3"); // Low check
                else this.fighter.executeAttack("df2"); // Launcher
            } else {
                // APT & Nightmare: Frame traps and Launcher confirms
                if (roll < 0.35) {
                    // df+2 launcher
                    this.fighter.executeAttack("df2");
                } else if (roll < 0.6) {
                    // Low sweep
                    this.fighter.executeAttack("3");
                } else if (roll < 0.85) {
                    // Quick jab check
                    this.fighter.executeAttack("1");
                } else {
                    // Sidestep mixup
                    this.fighter.sidestep(Math.random() > 0.5 ? 1 : -1);
                }
            }
        } else {
            // Mid Range (75 - 180px)
            if (!this.fighter.canAct()) return;

            const roll = Math.random();
            if (roll < 0.35) {
                // f,f+2 Dashing strike
                this.fighter.executeAttack("ff2");
            } else if (roll < 0.6) {
                // Approach
                if (this.fighter.x < this.opponent.x) {
                    this.fighter.inputRight = true;
                } else {
                    this.fighter.inputLeft = true;
                }
            } else if (roll < 0.8) {
                // Roundhouse 4 poke
                this.fighter.executeAttack("4");
            } else {
                // Backdash / Spacing check
                if (this.fighter.x < this.opponent.x) {
                    this.fighter.inputLeft = true;
                } else {
                    this.fighter.inputRight = true;
                }
            }
        }
    }
}

window.BotAI = BotAI;
