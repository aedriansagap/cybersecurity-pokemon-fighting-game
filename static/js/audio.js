/**
 * CyberMon: Pokémon Battle Audio & Sound Engine
 * Features:
 * - Official Pokémon cries for all fighters
 * - Pokémon Battle BGMs (B&W Trainer Battle, B&W2 Gym Leader, X&Y Trainer Battle)
 * - Retro Pokémon battle SFX (Super Effective, Critical Hit, Pokéball Deploy, Low-HP Alarm)
 * - Procedural WebAudio sound synthesizer fallback & Tournament Announcer
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.bgmGain = null;
        this.sfxGain = null;
        this.isMuted = false;
        this.bgmVolume = 0.45;
        this.sfxVolume = 0.8;

        // Current BGM Audio element
        this.bgmAudio = null;
        this.currentTrack = "bw-trainer";
        this.bgmTracks = {
            "bw-trainer": "/static/assets/audio/bw-trainer.mp3",
            "bw2-gym": "/static/assets/audio/bw2-kanto-gym-leader.mp3",
            "xy-trainer": "/static/assets/audio/xy-trainer.mp3"
        };

        // Cache for cries
        this.cryCache = {};

        // Low HP Warning alarm state
        this.lowHpTimer = null;
        this.isLowHpAlarmPlaying = false;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = this.sfxVolume;
            this.sfxGain.connect(this.ctx.destination);

            this.bgmGain = this.ctx.createGain();
            this.bgmGain.gain.value = this.bgmVolume;
            this.bgmGain.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        // Preload Pokémon cries
        const pokemonList = ["lucario", "gengar", "porygonz", "scizor", "blaziken", "mewtwo", "pikachu", "greninja"];
        pokemonList.forEach(p => {
            if (!this.cryCache[p]) {
                const audio = new Audio(`/static/assets/audio/${p}_cry.mp3`);
                audio.preload = "auto";
                this.cryCache[p] = audio;
            }
        });
    }

    // Play Pokémon Cry
    playCry(pokemonId, volume = 0.85) {
        if (this.isMuted) return;
        const key = (pokemonId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        let cry = this.cryCache[key];
        if (!cry) {
            cry = new Audio(`/static/assets/audio/${key}_cry.mp3`);
            this.cryCache[key] = cry;
        }
        try {
            cry.currentTime = 0;
            cry.volume = Math.min(1.0, volume);
            cry.play().catch(() => {});
        } catch (e) {
            console.log("Cry play prevented or not loaded:", e);
        }
    }

    // Play Pokémon Battle BGM
    startBGM(trackName = null) {
        if (this.isMuted) return;
        if (trackName && this.bgmTracks[trackName]) {
            this.currentTrack = trackName;
        }

        const src = this.bgmTracks[this.currentTrack] || this.bgmTracks["bw-trainer"];

        if (!this.bgmAudio) {
            this.bgmAudio = new Audio(src);
            this.bgmAudio.loop = true;
        } else if (this.bgmAudio.src !== window.location.origin + src && !this.bgmAudio.src.endsWith(src)) {
            this.bgmAudio.pause();
            this.bgmAudio = new Audio(src);
            this.bgmAudio.loop = true;
        }

        this.bgmAudio.volume = this.bgmVolume;
        this.bgmAudio.play().catch(err => {
            console.log("BGM autoplay waiting for user interaction:", err);
            // Fallback to procedural synth until user interacts
            this.startProceduralBGM();
        });
    }

    stopBGM() {
        if (this.bgmAudio) {
            this.bgmAudio.pause();
            this.bgmAudio.currentTime = 0;
        }
        this.stopProceduralBGM();
        this.stopLowHpAlarm();
    }

    switchTrack(trackName) {
        if (!this.bgmTracks[trackName]) return;
        this.currentTrack = trackName;
        if (this.bgmAudio && !this.bgmAudio.paused) {
            this.startBGM(trackName);
        }
    }

    // --- RETRO POKÉMON SFX SYNTHESIZER ---

    // Classic Pokémon Super Effective Hit (Heavy retro FM zap crunch)
    playSuperEffective() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Punch impact
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.28);

        gain.gain.setValueAtTime(0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.28);

        // Retro high crunch
        this.playNoiseCrack(0.18, 0.7);
        this.playSubBass(80, 0.3, 0.9);
    }

    // Classic Critical Hit / Electric Spark
    playCriticalHit() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1320, now + 0.05);
        osc.frequency.setValueAtTime(1760, now + 0.1);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);

        gain.gain.setValueAtTime(0.75, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.3);

        this.playNoiseCrack(0.08, 0.5);
    }

    // Pokéball Open / Release Swoosh
    playPokeballOpen() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.15);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.5, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.22);
    }

    // Classic Low HP Warning Alarm Beep (Gen 1 / Gen 5 rhythmic alert)
    startLowHpAlarm() {
        if (this.isLowHpAlarmPlaying || this.isMuted) return;
        this.isLowHpAlarmPlaying = true;

        const beep = () => {
            if (!this.isLowHpAlarmPlaying || !this.ctx || this.isMuted) return;
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            // Classic alternating frequency beep
            osc.frequency.setValueAtTime(780, now);
            osc.frequency.setValueAtTime(620, now + 0.1);

            gain.gain.setValueAtTime(0.25, now);
            gain.gain.setValueAtTime(0.25, now + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(now);
            osc.stop(now + 0.18);
        };

        beep();
        this.lowHpTimer = setInterval(beep, 450);
    }

    stopLowHpAlarm() {
        this.isLowHpAlarmPlaying = false;
        if (this.lowHpTimer) {
            clearInterval(this.lowHpTimer);
            this.lowHpTimer = null;
        }
    }

    // Normal Hit Impact
    playHit(type = 'mid', counterHit = false) {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        if (counterHit || type === 'super') {
            this.playSuperEffective();
            return;
        }

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        if (type === 'light') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);
            gain.gain.setValueAtTime(0.65, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'heavy' || type === 'launch') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.22);
            gain.gain.setValueAtTime(0.95, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.start(now);
            osc.stop(now + 0.22);
            this.playSubBass(75, 0.25, 0.8);
        } else {
            osc.type = 'square';
            osc.frequency.setValueAtTime(240, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
            gain.gain.setValueAtTime(0.75, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        }

        this.playNoiseCrack(0.05, 0.45);
    }

    // Guard Block (Pokémon Protect / Barrier shield chime)
    playBlock() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.12);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.12);

        this.playNoiseCrack(0.04, 0.3);
    }

    // Security Breach (Guard Break)
    playBreach() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.linearRampToValueAtTime(280, now + 0.35);

        gain.gain.setValueAtTime(0.85, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.35);

        this.playSubBass(50, 0.5, 1.0);
    }

    // Faint / K.O. Sound
    playFaint() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(360, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.45);

        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.45);

        this.playSubBass(45, 0.5, 0.9);
    }

    // Pokémon Victory Fanfare
    playVictoryFanfare() {
        if (!this.ctx || this.isMuted) return;
        const notes = [
            { f: 523.25, d: 0.15 }, // C5
            { f: 523.25, d: 0.15 }, // C5
            { f: 523.25, d: 0.15 }, // C5
            { f: 523.25, d: 0.35 }, // C5
            { f: 415.30, d: 0.35 }, // G#4
            { f: 466.16, d: 0.35 }, // A#4
            { f: 523.25, d: 0.25 }, // C5
            { f: 466.16, d: 0.15 }, // A#4
            { f: 523.25, d: 0.65 }  // C5
        ];

        let timeOffset = 0;
        notes.forEach(n => {
            setTimeout(() => {
                if (!this.ctx || this.isMuted) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(n.f, now);

                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + n.d);

                osc.connect(gain);
                gain.connect(this.sfxGain);
                osc.start(now);
                osc.stop(now + n.d);
            }, timeOffset * 1000);
            timeOffset += n.d + 0.02;
        });
    }

    // UI Menu Beep
    playUiBeep(freq = 587.33) {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.07);
    }

    playNoiseCrack(duration = 0.08, volume = 0.5) {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.value = volume;
        noise.connect(gain);
        gain.connect(this.sfxGain);
        noise.start();
    }

    playSubBass(freq = 60, duration = 0.3, volume = 0.8) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + duration);

        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + duration);
    }

    playWhoosh() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.15);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    // Tournament Announcer Voice using SpeechSynthesis
    announce(text, pitch = 0.85, rate = 1.05) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.pitch = pitch;
        utter.rate = rate;
        utter.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('David') || v.name.includes('Google UK English Male') || v.name.includes('Male')));
        if (preferred) utter.voice = preferred;

        window.speechSynthesis.speak(utter);
    }

    // Procedural Fallback BGM (if audio files fail or are loading)
    startProceduralBGM() {
        if (this.proceduralPlaying) return;
        this.proceduralPlaying = true;
        const tempo = 126;
        const interval = (60 / tempo) / 4;
        const bassline = [73.42, 73.42, 146.83, 73.42, 87.31, 87.31, 146.83, 87.31];
        let step = 0;

        this.proceduralTimer = setInterval(() => {
            if (!this.proceduralPlaying || this.isMuted || !this.ctx) return;
            const now = this.ctx.currentTime;
            const note = bassline[step % bassline.length];

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = (step % 4 === 0) ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(note, now);

            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(gain);
            gain.connect(this.bgmGain);
            osc.start(now);
            osc.stop(now + 0.12);

            step++;
        }, interval * 1000);
    }

    stopProceduralBGM() {
        this.proceduralPlaying = false;
        if (this.proceduralTimer) {
            clearInterval(this.proceduralTimer);
            this.proceduralTimer = null;
        }
    }
}

window.soundEngine = new SoundEngine();
