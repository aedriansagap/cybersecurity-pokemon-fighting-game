/**
 * CyberMon: Tekken Protocol - Procedural WebAudio Sound & BGM Engine
 * Zero external audio dependencies: fully synthesized hits, sparks, shield clangs,
 * sub-bass impacts, cyber synthwave music, and Web Speech tournament announcer.
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.musicPlaying = false;
        this.bgmGain = null;
        this.sfxGain = null;
        this.isMuted = false;
        this.tempo = 124;
        this.step = 0;
        this.bgmTimer = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.75;
            this.sfxGain.connect(this.ctx.destination);

            this.bgmGain = this.ctx.createGain();
            this.bgmGain.gain.value = 0.4;
            this.bgmGain.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playHit(type = 'mid', counterHit = false) {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Punch/Kick Impact
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        if (type === 'light') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);
            gain.gain.setValueAtTime(0.7, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (type === 'heavy' || type === 'launch') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.22);
            gain.gain.setValueAtTime(1.0, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.start(now);
            osc.stop(now + 0.22);

            // Bass sub-thud
            this.playSubBass(70, 0.25, 0.8);
        } else { // mid
            osc.type = 'square';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
            gain.gain.setValueAtTime(0.8, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        }

        // Add noise transient for punch impact
        this.playNoiseCrack(0.06, 0.5);

        // Electric Counter-hit spark effect
        if (counterHit) {
            this.playCounterSpark();
        }
    }

    playBlock() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Metallic firewall deflector clang
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.1);

        this.playNoiseCrack(0.04, 0.3);
    }

    playBreach() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Security Breach siren + glass break
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.35);

        gain.gain.setValueAtTime(0.9, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.35);

        this.playNoiseCrack(0.3, 0.8);
        this.playSubBass(55, 0.4, 1.0);
    }

    playRageArt() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        // Cinematic riser + sub detonation
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.5);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.9, now + 0.48);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.55);

        setTimeout(() => {
            this.playSubBass(45, 0.8, 1.2);
            this.playNoiseCrack(0.5, 0.9);
        }, 500);
    }

    playCounterSpark() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.linearRampToValueAtTime(450, now + 0.18);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.18);
    }

    playNoiseCrack(duration = 0.05, volume = 0.5) {
        if (!this.ctx) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * (i / bufferSize));
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
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    playUiBeep(freq = 440) {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    // Tournament Announcer Voice using SpeechSynthesis
    announce(text, pitch = 0.85, rate = 1.05) {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.pitch = pitch;
        utter.rate = rate;
        utter.volume = 1.0;

        // Try to pick an authoritative/arcade voice
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.lang.startsWith('en') && (v.name.includes('David') || v.name.includes('Google UK English Male') || v.name.includes('Male')));
        if (preferred) utter.voice = preferred;

        window.speechSynthesis.speak(utter);
    }

    // Procedural Cyber Synthwave BGM Loop
    startBGM(rageMode = false) {
        if (this.musicPlaying) return;
        this.musicPlaying = true;
        this.tempo = rageMode ? 140 : 124;
        const interval = (60 / this.tempo) / 4; // 16th notes

        // Cyber bassline notes (D minor: D2, F2, G2, A2, C3)
        const bassline = [
            73.42, 73.42, 146.83, 73.42, 87.31, 87.31, 146.83, 87.31,
            98.00, 98.00, 146.83, 98.00, 110.00, 110.00, 130.81, 110.00
        ];

        this.step = 0;
        this.bgmTimer = setInterval(() => {
            if (!this.musicPlaying || this.isMuted || !this.ctx) return;
            const now = this.ctx.currentTime;
            const note = bassline[this.step % bassline.length];

            // Synth bass synth
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();

            osc.type = (this.step % 4 === 0) ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(note, now);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(rageMode ? 1400 : 700, now);
            filter.frequency.exponentialRampToValueAtTime(150, now + 0.12);

            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.bgmGain);

            osc.start(now);
            osc.stop(now + 0.12);

            // Kick drum on 1, 5, 9, 13
            if (this.step % 4 === 0) {
                const kick = this.ctx.createOscillator();
                const kickGain = this.ctx.createGain();
                kick.frequency.setValueAtTime(130, now);
                kick.frequency.exponentialRampToValueAtTime(35, now + 0.1);
                kickGain.gain.setValueAtTime(0.4, now);
                kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                kick.connect(kickGain);
                kickGain.connect(this.bgmGain);
                kick.start(now);
                kick.stop(now + 0.1);
            }

            // Cyber Hi-hat on every off-beat
            if (this.step % 2 === 1) {
                this.playHiHat(now);
            }

            this.step++;
        }, interval * 1000);
    }

    playHiHat(now) {
        if (!this.ctx) return;
        const dur = 0.03;
        const bufferSize = this.ctx.sampleRate * dur;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-10 * (i / bufferSize));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(7000, now);
        const gain = this.ctx.createGain();
        gain.gain.value = 0.1;
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.bgmGain);
        noise.start(now);
    }

    stopBGM() {
        this.musicPlaying = false;
        if (this.bgmTimer) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
    }
}

window.soundEngine = new SoundEngine();
