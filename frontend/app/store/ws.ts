// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { type WebSocket, newWebSocket } from "@/util/wsutil";
import debug from "debug";
import { sprintf } from "sprintf-js";

const AuthKeyHeader = "X-AuthKey";

const dlog = debug("wave:ws");

const WarnWebSocketSendSize = 1024 * 1024; // 1MB
const MaxWebSocketSendSize = 5 * 1024 * 1024; // 5MB
const reconnectHandlers: (() => void)[] = [];
const StableConnTime = 2000;
const MaxQueuedMessages = 256;
const MaxQueuedBytes = 5 * 1024 * 1024;
const MaxQueueAge = 30000;
const QueueBatchSize = 64;
const SendBufferHighWater = 1024 * 1024;

type QueuedMessage = {
    data: WSCommandType;
    serialized: string;
    byteSize: number;
    expiresAt: number;
};

function addWSReconnectHandler(handler: () => void) {
    reconnectHandlers.push(handler);
}

function removeWSReconnectHandler(handler: () => void) {
    const index = reconnectHandlers.indexOf(handler);
    if (index > -1) {
        reconnectHandlers.splice(index, 1);
    }
}

type WSEventCallback = (arg0: WSEventType) => void;

type ElectronOverrideOpts = {
    authKey: string;
};

class WSControl {
    wsConn: WebSocket;
    open: boolean;
    opening: boolean = false;
    reconnectTimes: number = 0;
    msgQueue: QueuedMessage[] = [];
    queuedBytes = 0;
    stableId: string;
    messageCallback: WSEventCallback;
    watchSessionId: string = null;
    watchScreenId: string = null;
    wsLog: string[] = [];
    baseHostPort: string;
    lastReconnectTime: number = 0;
    eoOpts: ElectronOverrideOpts;
    noReconnect: boolean = false;
    onOpenTimeoutId: NodeJS.Timeout = null;
    pingIntervalId: NodeJS.Timeout = null;
    reconnectTimeoutId: NodeJS.Timeout = null;
    queueTimeoutId: NodeJS.Timeout = null;
    flushTimeoutId: NodeJS.Timeout = null;

    constructor(
        baseHostPort: string,
        stableId: string,
        messageCallback: WSEventCallback,
        electronOverrideOpts?: ElectronOverrideOpts
    ) {
        this.baseHostPort = baseHostPort;
        this.messageCallback = messageCallback;
        this.stableId = stableId;
        this.open = false;
        this.eoOpts = electronOverrideOpts;
        this.pingIntervalId = setInterval(this.sendPing.bind(this), 5000);
    }

    shutdown() {
        this.noReconnect = true;
        if (this.pingIntervalId != null) {
            clearInterval(this.pingIntervalId);
            this.pingIntervalId = null;
        }
        clearTimeout(this.reconnectTimeoutId);
        clearTimeout(this.onOpenTimeoutId);
        clearTimeout(this.flushTimeoutId);
        clearTimeout(this.queueTimeoutId);
        this.reconnectTimeoutId = null;
        this.onOpenTimeoutId = null;
        this.flushTimeoutId = null;
        this.queueTimeoutId = null;
        this.open = false;
        this.opening = false;
        this.failQueue("WebSocket shut down");
        this.wsConn?.close();
    }

    connectNow(desc: string) {
        if (this.open || this.opening || this.noReconnect) {
            return;
        }
        this.lastReconnectTime = Date.now();
        dlog("try reconnect:", desc);
        this.opening = true;
        const socket = newWebSocket(
            this.baseHostPort + "/ws?stableid=" + encodeURIComponent(this.stableId),
            this.eoOpts
                ? {
                      [AuthKeyHeader]: this.eoOpts.authKey,
                  }
                : null
        );
        this.wsConn = socket;
        socket.onopen = (e: Event) => {
            if (this.wsConn === socket && !this.noReconnect) this.onopen(e);
        };
        socket.onmessage = (e: MessageEvent) => {
            if (this.wsConn === socket && !this.noReconnect) this.onmessage(e);
        };
        socket.onclose = (e: CloseEvent) => {
            if (this.wsConn === socket) this.onclose(e);
        };
        // turns out onerror is not necessary (onclose always follows onerror)
        // this.wsConn.onerror = this.onerror;
    }

    reconnect(forceClose?: boolean) {
        if (this.noReconnect) {
            return;
        }
        if (this.reconnectTimeoutId != null || this.opening) {
            return;
        }
        if (this.open) {
            if (forceClose) {
                this.wsConn.close(); // this will force a reconnect
            }
            return;
        }
        this.reconnectTimes++;
        if (this.reconnectTimes > 20) {
            dlog("cannot connect, giving up");
            this.failQueue("WebSocket reconnect limit reached");
            return;
        }
        const timeoutArr = [0, 0, 2, 5, 10, 10, 30, 60];
        let timeout = 60;
        if (this.reconnectTimes < timeoutArr.length) {
            timeout = timeoutArr[this.reconnectTimes];
        }
        if (Date.now() - this.lastReconnectTime < 500) {
            timeout = 1;
        }
        if (timeout > 0) {
            dlog(sprintf("sleeping %ds", timeout));
        }
        this.reconnectTimeoutId = setTimeout(() => {
            this.reconnectTimeoutId = null;
            this.connectNow(String(this.reconnectTimes));
        }, timeout * 1000);
    }

    onclose(event: CloseEvent) {
        // console.log("close", event);
        if (this.onOpenTimeoutId) {
            clearTimeout(this.onOpenTimeoutId);
            this.onOpenTimeoutId = null;
        }
        clearTimeout(this.flushTimeoutId);
        this.flushTimeoutId = null;
        if (event.wasClean) {
            dlog("connection closed");
        } else {
            dlog("connection error/disconnected");
        }
        if (this.open || this.opening) {
            this.open = false;
            this.opening = false;
            this.reconnect();
        }
    }

    onopen(e: Event) {
        dlog("connection open");
        this.open = true;
        this.opening = false;
        this.onOpenTimeoutId = setTimeout(() => {
            this.reconnectTimes = 0;
            dlog("clear reconnect times");
        }, StableConnTime);
        for (let handler of reconnectHandlers) {
            handler();
        }
        this.runMsgQueue();
    }

    runMsgQueue() {
        this.pruneQueue();
        if (!this.open || this.wsConn?.readyState !== 1 || this.flushTimeoutId != null) {
            return;
        }
        for (let sent = 0; sent < QueueBatchSize && this.msgQueue.length > 0; sent++) {
            if (this.wsConn.bufferedAmount >= SendBufferHighWater) break;
            const entry = this.msgQueue[0];
            try {
                this.wsConn.send(entry.serialized);
            } catch {
                this.wsConn.close();
                break;
            }
            this.msgQueue.shift();
            this.queuedBytes -= entry.byteSize;
        }
        this.scheduleQueueExpiry();
        if (this.msgQueue.length > 0) {
            this.flushTimeoutId = setTimeout(() => {
                this.flushTimeoutId = null;
                this.runMsgQueue();
            }, 10);
        }
    }

    rejectMessage(data: WSCommandType, error: string) {
        const msg = data.message;
        if (!msg?.command || !msg.reqid) return;
        // The caller registers its response handler after sending the request.
        queueMicrotask(() => {
            this.messageCallback?.({
                eventtype: "rpc",
                data: { resid: msg.reqid, error },
            });
        });
    }

    failQueue(error: string) {
        const queued = this.msgQueue;
        this.msgQueue = [];
        this.queuedBytes = 0;
        clearTimeout(this.queueTimeoutId);
        this.queueTimeoutId = null;
        for (const entry of queued) this.rejectMessage(entry.data, error);
    }

    pruneQueue() {
        const now = Date.now();
        this.msgQueue = this.msgQueue.filter((entry) => {
            if (entry.expiresAt > now) return true;
            this.queuedBytes -= entry.byteSize;
            this.rejectMessage(entry.data, "EC-TIME: queued request expired");
            return false;
        });
    }

    scheduleQueueExpiry() {
        clearTimeout(this.queueTimeoutId);
        this.queueTimeoutId = null;
        if (this.msgQueue.length === 0) return;
        const expiresAt = Math.min(...this.msgQueue.map((entry) => entry.expiresAt));
        this.queueTimeoutId = setTimeout(
            () => {
                this.queueTimeoutId = null;
                this.pruneQueue();
                this.scheduleQueueExpiry();
            },
            Math.max(1, expiresAt - Date.now())
        );
    }

    onmessage(event: MessageEvent) {
        let eventData = null;
        if (event.data != null) {
            eventData = JSON.parse(event.data);
        }
        if (eventData == null) {
            return;
        }
        if (eventData.type == "ping") {
            this.wsConn.send(JSON.stringify({ type: "pong", stime: Date.now() }));
            return;
        }
        if (eventData.type == "pong") {
            // nothing
            return;
        }
        if (this.messageCallback) {
            try {
                this.messageCallback(eventData);
            } catch (e) {
                console.log("[error] messageCallback", e);
            }
        }
    }

    sendPing() {
        if (!this.open || this.wsConn?.readyState !== 1 || this.wsConn.bufferedAmount >= SendBufferHighWater) {
            return;
        }
        this.wsConn.send(JSON.stringify({ type: "ping", stime: Date.now() }));
    }

    sendMessage(data: WSCommandType) {
        if (!this.open) {
            return;
        }
        const msg = JSON.stringify(data);
        const byteSize = new Blob([msg]).size;
        if (byteSize > MaxWebSocketSendSize) {
            console.log("ws message too large", byteSize, data.wscommand, msg.substring(0, 100));
            this.rejectMessage(data, "WebSocket message too large");
            return;
        }
        if (byteSize > WarnWebSocketSendSize) {
            console.log("ws message large", byteSize, data.wscommand, msg.substring(0, 100));
        }
        this.wsConn.send(msg);
    }

    pushMessage(data: WSCommandType) {
        if (this.noReconnect) {
            this.rejectMessage(data, "WebSocket shut down");
            return;
        }
        this.pruneQueue();
        const msg = data.message;
        if (msg?.cancel && msg.reqid) {
            let removed = false;
            this.msgQueue = this.msgQueue.filter((entry) => {
                if (!entry.data.message?.command || entry.data.message.reqid !== msg.reqid) return true;
                this.queuedBytes -= entry.byteSize;
                this.rejectMessage(entry.data, "RPC cancelled before sending");
                removed = true;
                return false;
            });
            if (removed) {
                this.scheduleQueueExpiry();
                return;
            }
        }
        const canSend = this.open && this.wsConn?.readyState === 1;
        if (msg?.command === "routeannounce" || msg?.command === "routeunannounce") {
            if (canSend) this.sendMessage(data);
            return;
        }
        if (canSend && this.msgQueue.length === 0 && this.wsConn.bufferedAmount < SendBufferHighWater) {
            this.sendMessage(data);
            return;
        }
        const serialized = JSON.stringify(data);
        const byteSize = new Blob([serialized]).size;
        if (this.msgQueue.length >= MaxQueuedMessages || this.queuedBytes + byteSize > MaxQueuedBytes) {
            this.rejectMessage(data, "WebSocket send queue is full");
            return;
        }
        const maxAge = msg?.timeout > 0 ? Math.min(msg.timeout, MaxQueueAge) : MaxQueueAge;
        this.msgQueue.push({ data, serialized, byteSize, expiresAt: Date.now() + maxAge });
        this.queuedBytes += byteSize;
        this.scheduleQueueExpiry();
        if (canSend) this.runMsgQueue();
    }
}

let globalWS: WSControl;
function initGlobalWS(
    baseHostPort: string,
    stableId: string,
    messageCallback: WSEventCallback,
    electronOverrideOpts?: ElectronOverrideOpts
) {
    globalWS = new WSControl(baseHostPort, stableId, messageCallback, electronOverrideOpts);
}

function sendRawRpcMessage(msg: RpcMessage) {
    const wsMsg: WSRpcCommand = { wscommand: "rpc", message: msg };
    sendWSCommand(wsMsg);
}

function sendWSCommand(cmd: WSCommandType) {
    globalWS?.pushMessage(cmd);
}

export {
    WSControl,
    addWSReconnectHandler,
    globalWS,
    initGlobalWS,
    removeWSReconnectHandler,
    sendRawRpcMessage,
    sendWSCommand,
    type ElectronOverrideOpts,
};
