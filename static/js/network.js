/**
 * CyberMon: Tekken Protocol - Network Manager (WebSockets)
 * Provides real-time LAN & Online 1v1 PvP synchronization with room codes,
 * latency measurement, and event broadcasting.
 */

class NetworkManager {
    constructor() {
        this.ws = null;
        this.roomId = null;
        this.role = null; // 'p1', 'p2', 'spectator'
        this.ping = 0;
        this.pingTimer = null;
        this.connected = false;
        this.onMessageCallback = null;
        this.onConnectCallback = null;
        this.onDisconnectCallback = null;
    }

    connect(roomId, onConnect, onMessage, onDisconnect) {
        this.roomId = roomId;
        this.onConnectCallback = onConnect;
        this.onMessageCallback = onMessage;
        this.onDisconnectCallback = onDisconnect;

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws/fight/${roomId}`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.connected = true;
                this.startPing();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "pong") {
                        const now = performance.now();
                        this.ping = Math.round(now - data.time);
                        return;
                    }
                    if (data.type === "welcome") {
                        this.role = data.role;
                        if (this.onConnectCallback) {
                            this.onConnectCallback(data);
                        }
                    }
                    if (this.onMessageCallback) {
                        this.onMessageCallback(data);
                    }
                } catch (e) {
                    console.error("Failed to parse ws message", e);
                }
            };

            this.ws.onclose = () => {
                this.connected = false;
                this.stopPing();
                if (this.onDisconnectCallback) this.onDisconnectCallback();
            };

            this.ws.onerror = (err) => {
                console.error("WebSocket error:", err);
            };
        } catch (err) {
            console.error("Could not initialize WebSocket", err);
        }
    }

    startPing() {
        this.stopPing();
        this.pingTimer = setInterval(() => {
            if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({ type: "ping", time: performance.now() });
            }
        }, 2000);
    }

    stopPing() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    send(data) {
        if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    sendInput(inputState) {
        this.send({
            type: "input",
            inputs: inputState,
            frame: window.gameEngine ? window.gameEngine.frame : 0
        });
    }

    sendCombatEvent(eventData) {
        this.send({
            type: "combat_event",
            event: eventData
        });
    }

    sendStateUpdate(state) {
        this.send({
            type: "state_update",
            state: state
        });
    }

    disconnect() {
        this.stopPing();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.role = null;
    }
}

window.networkManager = new NetworkManager();
