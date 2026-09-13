/**
 * CyberMon: Tekken Protocol - UI & Screen Manager
 * Manages Main Menu, Character Select, Stage Select, Cybersecurity Trivia Modal,
 * Online Room Matchmaking, and Victory Podium.
 */

class UIManager {
    constructor() {
        this.currentScreen = "menu";
        this.selectedP1Char = "lucario";
        this.selectedP2Char = "gengar";
        this.selectedMode = "pve_bot";
        this.selectedDifficulty = "apt_hacker";
        this.activeTrivia = null;
        this.triviaTimer = null;
        this.triviaTimeLeft = 10;
    }

    init() {
        this.bindEvents();
        this.renderCharacterGrid();
        this.updateCharacterPreview();
    }

    bindEvents() {
        // Mode buttons
        document.getElementById("btn-mode-bot").addEventListener("click", () => {
            this.selectedMode = "pve_bot";
            this.showScreen("char-select");
            window.soundEngine.init();
            window.soundEngine.playUiBeep(520);
        });

        document.getElementById("btn-mode-local").addEventListener("click", () => {
            this.selectedMode = "pvp_local";
            this.showScreen("char-select");
            window.soundEngine.init();
            window.soundEngine.playUiBeep(520);
        });

        document.getElementById("btn-mode-online").addEventListener("click", () => {
            this.selectedMode = "pvp_online";
            this.showScreen("online-lobby");
            window.soundEngine.init();
            window.soundEngine.playUiBeep(520);
        });

        document.getElementById("btn-mode-training").addEventListener("click", () => {
            this.selectedMode = "pve_bot";
            this.selectedDifficulty = "script_kiddie";
            this.showScreen("char-select");
            window.soundEngine.init();
            window.soundEngine.playUiBeep(520);
        });

        // Online Lobby Buttons
        document.getElementById("btn-create-room").addEventListener("click", () => {
            const randomCode = "CYBER-" + Math.floor(100 + Math.random() * 900);
            document.getElementById("room-code-input").value = randomCode;
            this.joinOnlineRoom(randomCode);
        });

        document.getElementById("btn-join-room").addEventListener("click", () => {
            const code = document.getElementById("room-code-input").value.trim();
            if (code) {
                this.joinOnlineRoom(code);
            } else {
                alert("Please enter a valid room code!");
            }
        });

        // Character Select Controls
        document.getElementById("btn-start-fight").addEventListener("click", () => {
            window.soundEngine.playUiBeep(680);
            this.startCombat();
        });

        document.getElementById("btn-back-to-menu").addEventListener("click", () => {
            this.showScreen("menu");
            window.soundEngine.playUiBeep(400);
        });

        // Difficulty selector
        const diffSelect = document.getElementById("bot-difficulty");
        if (diffSelect) {
            diffSelect.addEventListener("change", (e) => {
                this.selectedDifficulty = e.target.value;
            });
        }

        // BGM selector
        const bgmSelect = document.getElementById("bgm-select");
        if (bgmSelect) {
            bgmSelect.addEventListener("change", (e) => {
                if (window.soundEngine) {
                    window.soundEngine.switchTrack(e.target.value);
                }
            });
        }

        // Rematch & Return to Menu on Victory
        document.getElementById("btn-rematch").addEventListener("click", () => {
            document.getElementById("victory-overlay").classList.add("hidden");
            this.startCombat();
        });

        document.getElementById("btn-victory-menu").addEventListener("click", () => {
            document.getElementById("victory-overlay").classList.add("hidden");
            this.showScreen("menu");
            window.soundEngine.stopBGM();
        });

        // Incident Response Trivia Button in HUD / Menu
        document.getElementById("btn-trigger-trivia").addEventListener("click", () => {
            this.triggerCyberTrivia();
        });

        // Controls Modal Toggle
        document.getElementById("btn-view-controls").addEventListener("click", () => {
            document.getElementById("controls-modal").classList.remove("hidden");
        });

        document.getElementById("btn-close-controls").addEventListener("click", () => {
            document.getElementById("controls-modal").classList.add("hidden");
        });
    }

    showScreen(screenId) {
        document.querySelectorAll(".game-screen").forEach(el => el.classList.add("hidden"));
        const target = document.getElementById(`screen-${screenId}`);
        if (target) target.classList.remove("hidden");
        this.currentScreen = screenId;
    }

    renderCharacterGrid() {
        const grid = document.getElementById("character-grid");
        grid.innerHTML = "";

        Object.values(CHARACTERS).forEach(char => {
            const card = document.createElement("div");
            card.className = `char-card ${char.id === this.selectedP1Char ? 'active' : ''}`;
            card.dataset.charId = char.id;

            const types = char.types || ["NORMAL"];
            const typeBadges = types.map(t => {
                const tInfo = (window.POKEMON_TYPES && window.POKEMON_TYPES[t]) || { color: "#888", textColor: "#fff" };
                return `<span class="type-pill" style="background:${tInfo.color}; color:${tInfo.textColor || '#fff'}">${t}</span>`;
            }).join(" ");

            card.innerHTML = `
                <img src="${char.icon}" class="char-icon" alt="${char.name}">
                <div class="char-card-info">
                    <div class="char-card-name">${char.name}</div>
                    <div class="char-card-types">${typeBadges}</div>
                    <div class="char-card-arch">${char.archetype}</div>
                </div>
            `;

            card.addEventListener("click", () => {
                this.selectedP1Char = char.id;
                document.querySelectorAll(".char-card").forEach(c => c.classList.remove("active"));
                card.classList.add("active");
                this.updateCharacterPreview();
                if (window.soundEngine) {
                    window.soundEngine.playCry(char.id);
                    window.soundEngine.playUiBeep(600);
                }
            });

            grid.appendChild(card);
        });
    }

    updateCharacterPreview() {
        const char = CHARACTERS[this.selectedP1Char];
        if (!char) return;

        document.getElementById("preview-name").textContent = char.name;
        document.getElementById("preview-title").textContent = char.title;

        const types = char.types || ["NORMAL"];
        const typeBadges = types.map(t => {
            const tInfo = (window.POKEMON_TYPES && window.POKEMON_TYPES[t]) || { color: "#888", textColor: "#fff" };
            return `<span class="type-pill" style="background:${tInfo.color}; color:${tInfo.textColor || '#fff'}">${t}</span>`;
        }).join(" ");

        document.getElementById("preview-archetype").innerHTML = `${typeBadges} &bull; ${char.archetype}`;
        document.getElementById("preview-desc").textContent = char.rageArtDesc;
        document.getElementById("preview-rage-art").textContent = `RAGE ART: ${char.rageArtName}`;

        const img = document.getElementById("preview-sprite");
        img.src = char.spriteFront;

        // Dynamic theme glow on preview stage
        const previewStage = document.querySelector(".preview-stage");
        if (previewStage && char.themeColors) {
            previewStage.style.borderColor = char.themeColors.primary;
            previewStage.style.boxShadow = `0 0 25px ${char.themeColors.glow || 'rgba(42, 117, 187, 0.4)'}`;
        }

        // Populate move list with simplified controls
        const moveListEl = document.getElementById("preview-moves");
        moveListEl.innerHTML = `
            <li><span class="cmd">[J] Light Combo</span> ${char.moves["1"].name} <span class="dmg">${char.moves["1"].damage} DMG [Rapid Taps Auto-Chain!]</span></li>
            <li><span class="cmd">[K] Heavy Launcher</span> ${char.moves.df2.name} <span class="dmg">${char.moves.df2.damage} DMG [AIR JUGGLE ⚡]</span></li>
            <li><span class="cmd">[L] Special Move</span> ${char.moves.special.name} <span class="dmg">${char.moves.special.damage} DMG [PROJECTILE/RUSH]</span></li>
            <li><span class="cmd">[SPACE] Super Move</span> ${char.rageArtName} <span class="dmg">240 DMG [ZERO-DAY EXPLOIT]</span></li>
            <li><span class="cmd">WASD</span> Movement &amp; Guard <span class="dmg">Hold Back: Guard | Double Tap: Dash/3D Sidestep</span></li>
        `;
    }

    startCombat() {
        this.showScreen("battle");
        const canvas = document.getElementById("game-canvas");
        window.gameEngine.init(canvas);

        // Pick opponent character
        if (this.selectedMode === "pve_bot") {
            const rosterKeys = Object.keys(CHARACTERS).filter(k => k !== this.selectedP1Char);
            this.selectedP2Char = rosterKeys[Math.floor(Math.random() * rosterKeys.length)];
        } else if (this.selectedMode === "pvp_local") {
            // Player 2 default
            this.selectedP2Char = this.selectedP2Char || "gengar";
        }

        window.gameEngine.startMatch(
            this.selectedP1Char,
            this.selectedP2Char,
            this.selectedMode,
            this.selectedDifficulty
        );
    }

    joinOnlineRoom(roomId) {
        document.getElementById("online-status").textContent = `Connecting to room ${roomId}...`;
        window.networkManager.connect(
            roomId,
            (welcomeData) => {
                document.getElementById("online-status").textContent = `Connected as ${welcomeData.role.toUpperCase()}! Waiting for opponent...`;
                if (welcomeData.p1_connected && welcomeData.p2_connected) {
                    document.getElementById("online-status").textContent = "Both fighters ready! Starting match...";
                    setTimeout(() => {
                        this.selectedMode = "pvp_online";
                        this.startCombat();
                    }, 1200);
                }
            },
            (msg) => {
                if (msg.type === "start_match") {
                    this.selectedMode = "pvp_online";
                    this.selectedP1Char = msg.p1_char;
                    this.selectedP2Char = msg.p2_char;
                    this.startCombat();
                } else if (msg.type === "input" && window.gameEngine.p2) {
                    // Sync online inputs
                    const ins = msg.inputs;
                    if (ins) {
                        window.gameEngine.p2.inputLeft = ins.left;
                        window.gameEngine.p2.inputRight = ins.right;
                        window.gameEngine.p2.inputUp = ins.up;
                        window.gameEngine.p2.inputDown = ins.down;
                        if (ins.attack) window.gameEngine.p2.executeAttack(ins.attack);
                        if (ins.rageArt) window.gameEngine.p2.executeRageArt();
                    }
                }
            },
            () => {
                document.getElementById("online-status").textContent = "Disconnected from room.";
            }
        );
    }

    async triggerCyberTrivia() {
        try {
            const res = await fetch("/api/trivia/random");
            const data = await res.json();
            this.activeTrivia = data;
            this.showTriviaModal(data);
        } catch (e) {
            console.error("Failed to load trivia", e);
        }
    }

    showTriviaModal(trivia) {
        const modal = document.getElementById("trivia-modal");
        modal.classList.remove("hidden");

        document.getElementById("trivia-category").textContent = `[${trivia.category.toUpperCase()}] SOC INCIDENT ALERT`;
        document.getElementById("trivia-question").textContent = trivia.question;

        const optionsContainer = document.getElementById("trivia-options");
        optionsContainer.innerHTML = "";

        trivia.options.forEach((opt, idx) => {
            const btn = document.createElement("button");
            btn.className = "trivia-opt-btn";
            btn.textContent = `[${idx + 1}] ${opt}`;
            btn.addEventListener("click", () => this.submitTriviaAnswer(idx));
            optionsContainer.appendChild(btn);
        });

        // 10-second countdown timer
        this.triviaTimeLeft = 10;
        const timerEl = document.getElementById("trivia-timer-num");
        timerEl.textContent = this.triviaTimeLeft;

        if (this.triviaTimer) clearInterval(this.triviaTimer);
        this.triviaTimer = setInterval(() => {
            this.triviaTimeLeft--;
            timerEl.textContent = this.triviaTimeLeft;
            if (this.triviaTimeLeft <= 0) {
                clearInterval(this.triviaTimer);
                this.closeTriviaModal("Time expired! No buff applied.");
            }
        }, 1000);
    }

    async submitTriviaAnswer(selectedIdx) {
        if (this.triviaTimer) clearInterval(this.triviaTimer);

        try {
            const res = await fetch("/api/trivia/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question_id: this.activeTrivia.id,
                    selected_option: selectedIdx
                })
            });
            const result = await res.json();

            if (result.correct) {
                window.soundEngine.playUiBeep(880);
                window.soundEngine.announce("PATCH VERIFIED! TACTICAL BUFF GRANTED!");
                // Apply buff to Player 1
                if (window.gameEngine.p1) {
                    const buff = result.buff;
                    if (buff.effect === "guard_restore") {
                        window.gameEngine.p1.firewall = window.gameEngine.p1.maxFirewall;
                    } else if (buff.effect === "attack_up") {
                        window.gameEngine.p1.buffs.attackUp = 1.25;
                    } else if (buff.effect === "threat_meter") {
                        window.gameEngine.p1.threatMeter = 100;
                    }
                    window.gameEngine.showBanner(`BUFF: ${buff.name.toUpperCase()}!`, "#00e676", 120);
                }
                this.closeTriviaModal(`Correct! ${result.explanation}`);
            } else {
                window.soundEngine.playUiBeep(220);
                this.closeTriviaModal(`Incorrect! ${result.explanation}`);
            }
        } catch (e) {
            console.error("Trivia check failed", e);
            this.closeTriviaModal("Verification error.");
        }
    }

    closeTriviaModal(message) {
        const modal = document.getElementById("trivia-modal");
        const expEl = document.getElementById("trivia-explanation");
        expEl.textContent = message;
        expEl.classList.remove("hidden");

        setTimeout(() => {
            modal.classList.add("hidden");
            expEl.classList.add("hidden");
        }, 2500);
    }

    showVictoryScreen(winner) {
        const overlay = document.getElementById("victory-overlay");
        overlay.classList.remove("hidden");

        document.getElementById("victory-winner-name").textContent = winner.charData.name.toUpperCase();
        document.getElementById("victory-winner-title").textContent = winner.charData.title;
        document.getElementById("victory-sprite").src = winner.charData.spriteFront;
    }
}

window.uiManager = new UIManager();
document.addEventListener("DOMContentLoaded", () => {
    window.uiManager.init();
});
