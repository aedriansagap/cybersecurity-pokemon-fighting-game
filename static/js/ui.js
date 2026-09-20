/**
 * CyberMon: Tekken Protocol - UI & Screen Manager
 * Manages Main Menu, Character Select, Stage Select, Cybersecurity Trivia Modal,
 * Online Room Matchmaking, and Victory Podium.
 */

const TRAINERS = [
    { id: "red", name: "Champion Red", title: "Legendary Champion", sprite: "/static/assets/sprites/trainers/red.png" },
    { id: "cynthia", name: "Cynthia", title: "Sinnoh Champion", sprite: "/static/assets/sprites/trainers/cynthia.png" },
    { id: "steven", name: "Steven Stone", title: "Hoenn Champion", sprite: "/static/assets/sprites/trainers/steven.png" },
    { id: "blue", name: "Blue Oak", title: "Former Champion", sprite: "/static/assets/sprites/trainers/blue.png" },
    { id: "lance", name: "Lance", title: "Dragon Master", sprite: "/static/assets/sprites/trainers/lance.png" },
    { id: "n", name: "Natural (N)", title: "Plasma Prodigy", sprite: "/static/assets/sprites/trainers/n.png" }
];

const CYBER_DEPARTMENTS = [
    "SOC Incident Response",
    "Red Team / Pentesting",
    "Blue Team / Defense",
    "DevSecOps & Cloud Security",
    "Threat Intelligence & Hunting",
    "Cryptography & Identity",
    "Compliance & Governance",
    "Security Architecture"
];

const CYBER_TITLES = [
    "Zero-Day Hunter",
    "Buffer Overflow Specialist",
    "Firewall Architect",
    "Phishing Bait",
    "SOC Night Owl",
    "Kubernetes Wrangler",
    "Malware Reverse Engineer",
    "SIEM Query Overlord",
    "Patch Tuesday Survivor",
    "Root Access Baron",
    "Cyber Elite Four",
    "Penetration Test Lead"
];

class UIManager {
    constructor() {
        this.currentScreen = "menu";
        this.selectedP1Char = "lucario";
        this.selectedP2Char = "gengar";
        this.selectedMode = "pve_bot";
        this.selectedDifficulty = "apt_hacker";
        this.selectedTrainer = localStorage.getItem("cybermon_trainer") || "red";
        this.trainerHandle = localStorage.getItem("cybermon_handle") || "Champion Red";
        this.trainerDept = localStorage.getItem("cybermon_dept") || "SOC Incident Response";
        this.trainerTitle = localStorage.getItem("cybermon_title") || "Zero-Day Hunter";
        this.spectatorMode = localStorage.getItem("cybermon_spectator") === "true";
        this.onlineOpponentTrainer = "cynthia";
        this.onlineOpponentHandle = "Cynthia";
        this.onlineOpponentDept = "Red Team / Pentesting";
        this.onlineOpponentTitle = "Buffer Overflow Specialist";
        this.activeTrivia = null;
        this.triviaTimer = null;
        this.triviaTimeLeft = 10;

        const savedStats = localStorage.getItem("cybermon_career_stats");
        this.careerStats = savedStats ? JSON.parse(savedStats) : {
            matches: 0,
            wins: 0,
            losses: 0,
            streak: 0,
            bestStreak: 0
        };
    }

    init() {
        this.initTrainers();
        this.initProfileModal();
        this.updateTrainerCard();
        this.applySpectatorModeUI();
        this.bindEvents();
        this.renderCharacterGrid();
        this.updateCharacterPreview();
        this.bindHoverSounds();
    }

    initTrainers() {
        const grid = document.getElementById("trainer-avatar-grid");
        if (!grid) return;
        grid.innerHTML = "";

        TRAINERS.forEach(t => {
            const card = document.createElement("div");
            card.className = `trainer-avatar-card ${t.id === this.selectedTrainer ? 'active' : ''}`;
            card.dataset.trainerId = t.id;
            card.innerHTML = `
                <img src="${t.sprite}" class="trainer-card-sprite" alt="${t.name}">
                <div class="trainer-card-name">${t.name}</div>
                <div class="trainer-card-title">${t.title}</div>
            `;
            card.addEventListener("click", () => {
                this.selectedTrainer = t.id;
                localStorage.setItem("cybermon_trainer", t.id);
                document.querySelectorAll(".trainer-avatar-card").forEach(c => c.classList.remove("active"));
                card.classList.add("active");
                this.updateTrainerCard();
                if (window.soundEngine) {
                    window.soundEngine.playMenuSelect();
                }
            });
            grid.appendChild(card);
        });
    }

    initProfileModal() {
        const deptSelect = document.getElementById("select-trainer-dept");
        const titleSelect = document.getElementById("select-trainer-title");
        const handleInput = document.getElementById("input-trainer-handle");

        if (deptSelect && deptSelect.options.length === 0) {
            CYBER_DEPARTMENTS.forEach(d => {
                const opt = document.createElement("option");
                opt.value = d;
                opt.textContent = d;
                if (d === this.trainerDept) opt.selected = true;
                deptSelect.appendChild(opt);
            });
        }

        if (titleSelect && titleSelect.options.length === 0) {
            CYBER_TITLES.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t;
                opt.textContent = t;
                if (t === this.trainerTitle) opt.selected = true;
                titleSelect.appendChild(opt);
            });
        }

        if (handleInput) {
            handleInput.value = this.trainerHandle;
            handleInput.addEventListener("input", () => this.updateProfileModalPreview());
        }
        if (deptSelect) {
            deptSelect.addEventListener("change", () => this.updateProfileModalPreview());
        }
        if (titleSelect) {
            titleSelect.addEventListener("change", () => this.updateProfileModalPreview());
        }

        const btnSave = document.getElementById("btn-save-profile");
        if (btnSave) {
            btnSave.addEventListener("click", () => {
                const val = (handleInput.value || "").trim();
                this.trainerHandle = val || "Trainer";
                this.trainerDept = deptSelect.value;
                this.trainerTitle = titleSelect.value;

                localStorage.setItem("cybermon_handle", this.trainerHandle);
                localStorage.setItem("cybermon_dept", this.trainerDept);
                localStorage.setItem("cybermon_title", this.trainerTitle);

                this.updateTrainerCard();
                document.getElementById("profile-modal").classList.add("hidden");
                if (window.soundEngine) window.soundEngine.playUiBeep(660);
            });
        }

        const btnOpen = document.getElementById("btn-edit-profile");
        if (btnOpen) {
            btnOpen.addEventListener("click", () => {
                handleInput.value = this.trainerHandle;
                deptSelect.value = this.trainerDept;
                titleSelect.value = this.trainerTitle;
                this.updateProfileModalPreview();
                document.getElementById("profile-modal").classList.remove("hidden");
                if (window.soundEngine) window.soundEngine.playUiBeep(440);
            });
        }

        const btnClose = document.getElementById("btn-close-profile");
        if (btnClose) {
            btnClose.addEventListener("click", () => {
                document.getElementById("profile-modal").classList.add("hidden");
            });
        }
    }

    updateProfileModalPreview() {
        const trainer = TRAINERS.find(t => t.id === this.selectedTrainer) || TRAINERS[0];
        const prevAvatar = document.getElementById("profile-preview-avatar");
        const prevHandle = document.getElementById("profile-preview-handle");
        const prevDept = document.getElementById("profile-preview-dept");
        const prevTitle = document.getElementById("profile-preview-title");
        const handleInput = document.getElementById("input-trainer-handle");
        const deptSelect = document.getElementById("select-trainer-dept");
        const titleSelect = document.getElementById("select-trainer-title");

        if (prevAvatar) prevAvatar.src = trainer.sprite;
        if (prevHandle) prevHandle.textContent = (handleInput && handleInput.value.trim()) ? handleInput.value.trim().toUpperCase() : trainer.name.toUpperCase();
        if (prevDept && deptSelect) prevDept.textContent = deptSelect.value.toUpperCase();
        if (prevTitle && titleSelect) prevTitle.textContent = titleSelect.value.toUpperCase();
    }

    updateTrainerCard() {
        const trainer = TRAINERS.find(t => t.id === this.selectedTrainer) || TRAINERS[0];
        const menuAvatar = document.getElementById("menu-trainer-avatar");
        const menuName = document.getElementById("menu-trainer-name");
        const menuDept = document.getElementById("menu-trainer-dept");
        const menuTitle = document.getElementById("menu-trainer-title");
        const activeName = document.getElementById("active-trainer-name");
        const recEl = document.getElementById("menu-trainer-record");

        if (menuAvatar) menuAvatar.src = trainer.sprite;
        if (menuName) menuName.textContent = this.trainerHandle ? this.trainerHandle.toUpperCase() : trainer.name.toUpperCase();
        if (menuDept) menuDept.textContent = this.trainerDept.toUpperCase();
        if (menuTitle) menuTitle.textContent = this.trainerTitle.toUpperCase();
        if (activeName) activeName.textContent = this.trainerHandle ? this.trainerHandle.toUpperCase() : trainer.name.toUpperCase();
        if (recEl) {
            const winRate = this.careerStats.matches > 0 ? Math.round((this.careerStats.wins / this.careerStats.matches) * 100) : 0;
            recEl.textContent = `RECORD: ${this.careerStats.wins}W - ${this.careerStats.losses}L (${winRate}%) | STREAK: ${this.careerStats.streak}🔥`;
        }
        this.updateBadgeUnlocks();
    }

    updateBadgeUnlocks() {
        const badges = document.querySelectorAll(".badge-item");
        const wins = this.careerStats.wins || 0;
        const streak = this.careerStats.streak || 0;
        const thresholds = [1, 3, 5, 8, 12, 16, 20, 25];
        badges.forEach((b, idx) => {
            const req = thresholds[idx] || 1;
            const unlocked = (wins >= req) || (idx === 7 && streak >= 3);
            if (unlocked) {
                b.classList.add("unlocked");
                b.classList.remove("locked");
            } else {
                b.classList.remove("unlocked");
                b.classList.add("locked");
            }
        });
    }

    recordMatchResult(player1Won) {
        this.careerStats.matches++;
        if (player1Won) {
            this.careerStats.wins++;
            this.careerStats.streak++;
            if (this.careerStats.streak > this.careerStats.bestStreak) {
                this.careerStats.bestStreak = this.careerStats.streak;
            }
        } else {
            this.careerStats.losses++;
            this.careerStats.streak = 0;
        }
        localStorage.setItem("cybermon_career_stats", JSON.stringify(this.careerStats));
        this.updateTrainerCard();
    }

    togglePause() {
        if (!window.gameEngine || window.gameEngine.matchOver || this.selectedMode === "pvp_online") return;
        const modal = document.getElementById("pause-modal");
        if (!modal) return;
        const isPaused = !window.gameEngine.isPaused;
        window.gameEngine.isPaused = isPaused;
        if (isPaused) {
            modal.classList.remove("hidden");
            if (window.soundEngine) window.soundEngine.playMenuSelect();
        } else {
            modal.classList.add("hidden");
            if (window.soundEngine) window.soundEngine.playMenuSelect();
        }
    }

    toggleSpectatorMode() {
        this.spectatorMode = !this.spectatorMode;
        localStorage.setItem("cybermon_spectator", this.spectatorMode);
        this.applySpectatorModeUI();
        if (window.soundEngine) {
            window.soundEngine.playUiBeep(this.spectatorMode ? 720 : 360);
        }
        if (window.gameEngine) {
            window.gameEngine.logCombatEvent(
                "SYS",
                this.spectatorMode ? "BROADCAST SPECTATOR MODE ACTIVATED (1080P/4K VIEW)" : "STANDARD COMBAT VIEW RESTORED"
            );
        }
    }

    applySpectatorModeUI() {
        const container = document.getElementById("game-container");
        const watermark = document.getElementById("spectator-watermark");
        const btnLabel = document.getElementById("spectator-btn-label");
        const battleBtn = document.getElementById("btn-battle-spectator");

        if (this.spectatorMode) {
            if (container) container.classList.add("spectator-mode");
            if (watermark) watermark.classList.remove("hidden");
            if (btnLabel) btnLabel.textContent = "SPECTATOR / BROADCAST MODE: ON";
            if (battleBtn) {
                battleBtn.style.background = "rgba(238, 21, 21, 0.9)";
                battleBtn.querySelector("span").textContent = "📺 SPECTATOR: ON";
            }
        } else {
            if (container) container.classList.remove("spectator-mode");
            if (watermark) watermark.classList.add("hidden");
            if (btnLabel) btnLabel.textContent = "SPECTATOR / BROADCAST MODE: OFF";
            if (battleBtn) {
                battleBtn.style.background = "rgba(13, 27, 42, 0.9)";
                battleBtn.querySelector("span").textContent = "📺 SPECTATOR VIEW";
            }
        }
    }

    bindHoverSounds() {
        document.querySelectorAll(".cyber-btn, .char-card, .trainer-avatar-card").forEach(el => {
            el.addEventListener("mouseenter", () => {
                if (window.soundEngine && window.soundEngine.ctx) {
                    window.soundEngine.playUiBeep(440);
                }
            });
        });
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
            if (window.gameEngine) {
                window.gameEngine.running = false;
                if (window.gameEngine.roundTimer) {
                    clearInterval(window.gameEngine.roundTimer);
                    window.gameEngine.roundTimer = null;
                }
            }
            this.showScreen("menu");
            if (window.soundEngine) {
                window.soundEngine.stopBGM();
            }
        });

        // Incident Response Trivia Button in HUD / Menu
        document.getElementById("btn-trigger-trivia").addEventListener("click", () => {
            this.triggerCyberTrivia();
        });

        // Spectator Mode Toggles
        const btnSpec = document.getElementById("btn-spectator-toggle");
        if (btnSpec) {
            btnSpec.addEventListener("click", () => this.toggleSpectatorMode());
        }

        const btnBattleSpec = document.getElementById("btn-battle-spectator");
        if (btnBattleSpec) {
            btnBattleSpec.addEventListener("click", () => this.toggleSpectatorMode());
        }

        window.addEventListener("keydown", (e) => {
            if (e.code === "F2") {
                e.preventDefault();
                this.toggleSpectatorMode();
            }
        });

        // Controls Modal Toggle
        document.getElementById("btn-view-controls").addEventListener("click", () => {
            document.getElementById("controls-modal").classList.remove("hidden");
        });

        document.getElementById("btn-close-controls").addEventListener("click", () => {
            document.getElementById("controls-modal").classList.add("hidden");
        });

        // Pause Modal Handlers
        const btnPauseResume = document.getElementById("btn-pause-resume");
        if (btnPauseResume) {
            btnPauseResume.addEventListener("click", () => this.togglePause());
        }

        const btnPauseControls = document.getElementById("btn-pause-controls");
        if (btnPauseControls) {
            btnPauseControls.addEventListener("click", () => {
                document.getElementById("controls-modal").classList.remove("hidden");
            });
        }

        const btnPauseRestart = document.getElementById("btn-pause-restart");
        if (btnPauseRestart) {
            btnPauseRestart.addEventListener("click", () => {
                this.togglePause();
                this.startFight();
            });
        }

        const btnPauseExit = document.getElementById("btn-pause-exit");
        if (btnPauseExit) {
            btnPauseExit.addEventListener("click", () => {
                this.togglePause();
                this.showScreen("menu");
            });
        }
    }

    showScreen(screenId) {
        document.querySelectorAll(".game-screen").forEach(el => el.classList.add("hidden"));
        const target = document.getElementById(`screen-${screenId}`);
        if (target) target.classList.remove("hidden");
        this.currentScreen = screenId;

        const pauseModal = document.getElementById("pause-modal");
        if (pauseModal) pauseModal.classList.add("hidden");
        if (window.gameEngine) window.gameEngine.isPaused = false;
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
        // Pick opponent character
        if (this.selectedMode === "pve_bot") {
            const rosterKeys = Object.keys(CHARACTERS).filter(k => k !== this.selectedP1Char);
            this.selectedP2Char = rosterKeys[Math.floor(Math.random() * rosterKeys.length)];
        } else if (this.selectedMode === "pvp_local") {
            // Player 2 default
            this.selectedP2Char = this.selectedP2Char || "gengar";
        }

        // Determine P1 & P2 Trainer details
        const p1Trainer = TRAINERS.find(t => t.id === this.selectedTrainer) || TRAINERS[0];
        let p2Trainer;
        if (this.selectedMode === "pvp_online") {
            p2Trainer = TRAINERS.find(t => t.id === this.onlineOpponentTrainer) || TRAINERS[1];
        } else {
            const availableTrainers = TRAINERS.filter(t => t.id !== this.selectedTrainer);
            p2Trainer = availableTrainers[Math.floor(Math.random() * availableTrainers.length)] || TRAINERS[1];
        }

        const char1 = CHARACTERS[this.selectedP1Char];
        const char2 = CHARACTERS[this.selectedP2Char];

        // Trigger VS Matchup Splash Screen
        const splash = document.getElementById("vs-splash");
        if (splash && char1 && char2) {
            const p1Handle = (this.trainerHandle || p1Trainer.name).toUpperCase();
            document.getElementById("vs-p1-trainer-name").textContent = p1Handle;
            const p1Dept = document.getElementById("vs-p1-dept");
            const p1Title = document.getElementById("vs-p1-title");
            if (p1Dept) p1Dept.textContent = (this.trainerDept || "SOC INCIDENT RESPONSE").toUpperCase();
            if (p1Title) p1Title.textContent = (this.trainerTitle || "ZERO-DAY HUNTER").toUpperCase();
            document.getElementById("vs-p1-pokemon-img").src = char1.spriteFront;
            document.getElementById("vs-p1-pokemon-name").textContent = char1.name;
            document.getElementById("vs-p1-pokemon-title").textContent = char1.title.toUpperCase();

            let p2Handle = p2Trainer.name.toUpperCase();
            let p2DeptText = "RED TEAM PENTEST";
            let p2TitleText = "THREAT ACTOR";
            if (this.selectedMode === "pvp_online") {
                p2Handle = (this.onlineOpponentHandle || p2Trainer.name).toUpperCase();
                p2DeptText = (this.onlineOpponentDept || "BLUE TEAM INCIDENT RESPONSE").toUpperCase();
                p2TitleText = (this.onlineOpponentTitle || "ZERO-DAY HUNTER").toUpperCase();
            } else if (this.selectedMode === "pve_bot") {
                p2Handle = `${p2Trainer.name} (AI)`.toUpperCase();
                p2DeptText = "THREAT SIMULATION LAB";
                p2TitleText = this.selectedDifficulty.replace(/_/g, ' ').toUpperCase();
            } else if (this.selectedMode === "pvp_local") {
                p2Handle = "PLAYER 2 (LOCAL)";
                p2DeptText = "INTERNAL CHALLENGER";
                p2TitleText = "RIVAL TRAINER";
            }

            document.getElementById("vs-p2-trainer-img").src = p2Trainer.sprite;
            document.getElementById("vs-p2-trainer-name").textContent = p2Handle;
            const p2Dept = document.getElementById("vs-p2-dept");
            const p2Title = document.getElementById("vs-p2-title");
            if (p2Dept) p2Dept.textContent = p2DeptText;
            if (p2Title) p2Title.textContent = p2TitleText;
            document.getElementById("vs-p2-pokemon-img").src = char2.spriteFront;
            document.getElementById("vs-p2-pokemon-name").textContent = char2.name;
            document.getElementById("vs-p2-pokemon-title").textContent = char2.title.toUpperCase();

            const p2RoleTag = document.getElementById("vs-p2-role-tag");
            if (p2RoleTag) {
                if (this.selectedMode === "pve_bot") {
                    p2RoleTag.textContent = `BOT (${this.selectedDifficulty.replace(/_/g, ' ').toUpperCase()})`;
                } else if (this.selectedMode === "pvp_local") {
                    p2RoleTag.textContent = "PLAYER 2 (LOCAL)";
                } else {
                    p2RoleTag.textContent = "ONLINE OPPONENT";
                }
            }

            splash.classList.remove("hidden");

            if (window.soundEngine) {
                window.soundEngine.init();
                window.soundEngine.playPokeballOpen();
                window.soundEngine.playCry(this.selectedP1Char);
                window.soundEngine.announce("BATTLE BEGIN! 3, 2, 1, FIGHT!", 0.85, 1.1);
            }

            setTimeout(() => {
                splash.classList.add("hidden");
                this.launchBattleEngine();
            }, 1250);
        } else {
            this.launchBattleEngine();
        }
    }

    launchBattleEngine() {
        this.showScreen("battle");
        const canvas = document.getElementById("game-canvas");
        window.gameEngine.init(canvas);
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

                // Broadcast trainer selection
                window.networkManager.send({
                    type: "trainer_select",
                    trainer: this.selectedTrainer,
                    char: this.selectedP1Char,
                    handle: this.trainerHandle,
                    dept: this.trainerDept,
                    title: this.trainerTitle
                });

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
                    if (msg.p2_trainer) this.onlineOpponentTrainer = msg.p2_trainer;
                    if (msg.p2_handle) this.onlineOpponentHandle = msg.p2_handle;
                    if (msg.p2_dept) this.onlineOpponentDept = msg.p2_dept;
                    if (msg.p2_title) this.onlineOpponentTitle = msg.p2_title;
                    this.startCombat();
                } else if (msg.type === "trainer_select") {
                    if (msg.trainer) this.onlineOpponentTrainer = msg.trainer;
                    if (msg.handle) this.onlineOpponentHandle = msg.handle;
                    if (msg.dept) this.onlineOpponentDept = msg.dept;
                    if (msg.title) this.onlineOpponentTitle = msg.title;
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
