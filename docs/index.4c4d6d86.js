// The station connects the Arduino via Web Serial and relays its output to
// every peer in the room; each peer renders the Arduino's GUI in its own
// sandbox, and actions in any sandbox are written to the Arduino by the
// station. The station and teachers control the connection (a teacher's
// clicks are carried out by the station); students see its state.
// message subjects (all peers run this module, so they only need to agree
// with themselves)
const SUBJECT = {
    init: "init",
    update: "update",
    // teacher -> station; the station checks the sender's role
    connect: "connect",
    reload: "reload",
    settings: "settings",
    receiveBuffer: "receive-buffer",
    fromSandbox: "receivedFromSandbox",
    replay: "replay"
};
const BAUD_RATES = [
    "110",
    "300",
    "1200",
    "2400",
    "4800",
    "9600",
    "19200",
    "38400",
    "57600",
    "115200"
];
const DEFAULTS = {
    baudrate: "9600",
    autoconnect: false
};
// most Arduinos reset when the port opens; give the bootloader time before
// asking the sketch for its GUI
const ARDUINO_RESET_DELAY = 2000;
// what the station keeps to replay the GUI to a joining peer: page-building
// frames up to this many characters (more: the station has to Reload),
// the last value of each control, and the last data frames (graphs, and the
// sketch's own runners)
const REPLAY_LIMIT = 262144;
const REPLAY_DATA_FRAMES = 1000;
// teletype framing with escaping (ArduinoView/Frameiterator.h)
const SOF = 0x01;
const EOF = 0x04;
const ESC = 0x10;
const ESCMASK = 0x40;
// the station's state, mirrored on every peer
let state = {
    baudrate: DEFAULTS.baudrate,
    autoconnect: DEFAULTS.autoconnect,
    connected: false,
    status: "idle",
    error: ""
};
let ready = false;
let guiReceived = false;
// the station's GUI was too large to replay to us
let replayMissing = false;
const serial = navigator.serial;
let port = null;
let reader = null;
let writer = null;
let readLoop = null;
let closing = false;
// counts connections: the same port object comes back on every connect, so
// it cannot tell a timer from an earlier connection apart
let connection = 0;
// logging level: how much of the traffic is logged to the console (0 = none)
const logging = 0;
function logger(lvl, msg) {
    if (logging >= lvl) console.log(msg);
}
const $ = (id)=>document.getElementById(id);
const ui = {
    badge: $("badge"),
    message: $("message"),
    stationControls: $("station-controls"),
    autoconnect: $("autoconnect"),
    baudrate: $("baudrate"),
    connect: $("connect"),
    connectLabel: $("connect-label"),
    reload: $("reload"),
    sandbox: $("sandbox"),
    placeholder: $("placeholder")
};
const isStation = ()=>Edrys.role === "station";
const isTeacher = ()=>Edrys.role === "teacher";
// messages are signed, so the sender's role holds
const roleOf = (from)=>Edrys.liveClass?.users?.[from]?.role;
// the id of the station in our room, if there is one
function stationInRoom() {
    const room = Edrys.liveUser?.room;
    const users = Object.entries(Edrys.liveClass?.users || {});
    return users.find(([, user])=>user?.role === "station" && user?.room === room)?.[0];
}
// the station we asked for its state
let askedStation;
// student: ask the station in the room for its state, once per station
function requestState() {
    const station = stationInRoom();
    if (!station || station === askedStation) return;
    askedStation = station;
    send(SUBJECT.init, null, station);
}
function send(subject, body = null, user) {
    if (ready) Edrys.sendMessage(subject, body, user);
}
// ---------------------------------------------------------------------------
// State and rendering
function render() {
    const station = isStation();
    const present = station || stationInRoom();
    const busy = state.status === "connecting";
    let badge;
    if (!ready) badge = [
        "loading\u2026",
        "wait"
    ];
    else if (!present) badge = [
        "no station",
        "off"
    ];
    else if (state.connected) badge = [
        `connected \xb7 ${state.baudrate} baud`,
        "on"
    ];
    else if (state.status === "connecting") badge = [
        "connecting\u2026",
        "wait"
    ];
    else if (state.status === "lost") badge = [
        "device lost",
        "off"
    ];
    else badge = [
        "not connected",
        "off"
    ];
    ui.badge.textContent = badge[0];
    ui.badge.className = "badge " + badge[1];
    ui.message.textContent = ready && !present ? "Open this room as a station to connect an Arduino." : state.error;
    // students see the state, the station and teachers control it
    const controls = station || isTeacher();
    ui.stationControls.hidden = !(ready && controls);
    ui.baudrate.value = state.baudrate;
    ui.autoconnect.checked = state.autoconnect;
    ui.connectLabel.textContent = state.connected ? "Disconnect" : "Connect";
    ui.connect.disabled = !present || busy;
    ui.baudrate.disabled = ui.autoconnect.disabled = !present || busy || state.connected;
    ui.reload.disabled = !ready || !present;
    ui.reload.title = controls ? "Ask the Arduino for its GUI again" : "Load the GUI again from the station";
    ui.placeholder.hidden = guiReceived;
    ui.placeholder.textContent = !ready ? "" : replayMissing ? "The GUI of the Arduino is too large to be sent to you. It shows up when the station reloads it." : state.connected ? "Waiting for the GUI of the Arduino\u2026" : station ? "Connect an Arduino to show its GUI." : "Waiting for the station to connect an Arduino\u2026";
}
// station: change the state and tell everyone
function setState(patch) {
    state = {
        ...state,
        ...patch
    };
    render();
    if (isStation()) send(SUBJECT.update, state);
}
// station: baud rate and auto-connect from the teacher's config, else the
// station's last choice, else the defaults
function loadSettings() {
    const config = Edrys.module?.stationConfig;
    const cfg = config && typeof config === "object" ? config : {};
    let saved = null;
    try {
        saved = Edrys.getItem("baudrate");
    } catch (e) {}
    const baudrate = [
        String(cfg.baudrate ?? ""),
        saved
    ].find((b)=>b && BAUD_RATES.includes(b));
    let autoconnect = cfg.autoconnect === true;
    try {
        autoconnect ||= Edrys.getItem("autoconnect") === "true";
    } catch (e) {}
    state = {
        ...state,
        baudrate: baudrate || DEFAULTS.baudrate,
        autoconnect
    };
}
function saveSettings() {
    try {
        Edrys.setItem("baudrate", state.baudrate);
        Edrys.setItem("autoconnect", String(state.autoconnect));
    } catch (e) {
        console.warn("could not save the settings:", e);
    }
}
// station: settings from its own controls or from a teacher
function applySettings(body) {
    if (state.connected || state.status === "connecting" || !body) return;
    const baudrate = BAUD_RATES.includes(String(body.baudrate)) ? String(body.baudrate) : state.baudrate;
    setState({
        baudrate,
        autoconnect: body.autoconnect === true
    });
    saveSettings();
}
function onSettingsChanged() {
    const settings = {
        baudrate: ui.baudrate.value,
        autoconnect: ui.autoconnect.checked
    };
    if (isStation()) applySettings(settings);
    else if (isTeacher()) send(SUBJECT.settings, settings, stationInRoom());
}
// ---------------------------------------------------------------------------
// Sandbox
const sandboxWindow = ()=>ui.sandbox.contentWindow;
// While the sandbox loads, messages wait here; it answers our `hello` with
// `ready` when it can take them.
let sandboxReady = false;
let sandboxQueue = [];
function postToSandbox(msg) {
    if (sandboxReady) sandboxWindow()?.postMessage(msg, "*");
    else sandboxQueue.push(msg);
}
// Only after onReady: edrys.js trusts the origin of the first message this
// window gets, so the sandbox's answer must not come before edrys-Lite's.
function helloSandbox() {
    if (ready) sandboxWindow()?.postMessage({
        type: "hello"
    }, "*");
}
function onSandboxReady() {
    sandboxReady = true;
    const queue = sandboxQueue;
    sandboxQueue = [];
    queue.forEach(postToSandbox);
}
function sendHostInfo(connected) {
    postToSandbox({
        type: "hostinfo",
        data: JSON.stringify({
            connected
        })
    });
}
function sendToSandbox(msg) {
    if (!guiReceived) {
        guiReceived = true;
        replayMissing = false;
        render();
    }
    postToSandbox({
        type: "frame",
        data: msg
    });
    // `!!` reloads the sandbox: hold back what follows until it is ready again
    if (msg.startsWith("!!")) sandboxReady = false;
}
// load the sandbox again, empty
function resetSandbox() {
    guiReceived = false;
    sandboxReady = false;
    sandboxQueue = [];
    // keep the src as built (Parcel makes it absolute)
    ui.sandbox.src = ui.sandbox.src;
    render();
}
// ---------------------------------------------------------------------------
// Replay for joining peers (station)
let recording = {
    frames: [],
    size: 0,
    complete: true,
    values: new Map(),
    data: []
};
function clearRecording() {
    recording = {
        frames: [],
        size: 0,
        complete: true,
        values: new Map(),
        data: []
    };
}
function record(frame) {
    if (!isStation()) return;
    const head = frame.substring(0, 2);
    if (head === "!!") // the Arduino starts its GUI from scratch
    clearRecording();
    else if (head === "!g") recording.values.set(frame.substring(0, 4), frame);
    else if (head === "!d" || head === "!c" || !head.startsWith("!")) {
        // graph data, and frames for the sketch's own runners (`runner['vt']`):
        // usually a stream of values, so only the last ones are kept
        recording.data.push(frame);
        if (recording.data.length > REPLAY_DATA_FRAMES) recording.data.shift();
    } else if (recording.complete) {
        if (recording.size + frame.length > REPLAY_LIMIT) {
            recording.complete = false;
            recording.frames = [];
            recording.size = 0;
        } else {
            recording.frames.push(frame);
            recording.size += frame.length;
        }
    }
}
function replay() {
    const { complete, frames, values, data } = recording;
    return {
        complete,
        frames: complete ? [
            ...frames,
            ...values.values(),
            ...data
        ] : []
    };
}
// joining peer: show the station's GUI so far
function applyReplay(body) {
    resetSandbox();
    if (!body.complete) {
        replayMissing = true;
        render();
    } else body.frames.forEach(sendToSandbox);
}
// an action in a sandbox: our own (publish to the others) or another peer's
function receiveFromSandbox(msg, publish) {
    if (publish) send(SUBJECT.fromSandbox, msg);
    logger(1, JSON.stringify(msg));
    switch(msg?.type){
        case "raw":
            writeSerial(msg.data);
            break;
        case "frame":
            if (typeof msg.data !== "string") break;
            // the sketch may define its own frames, so anything goes to the Arduino …
            sendArrayBuffer(prepareSerialFrame(msg.data));
            // … but only control values (slider position, …) are mirrored to the
            // other sandboxes and kept for the replay: a peer must not be able to
            // put HTML or `!j` code into everyone's GUI
            if (msg.data.startsWith("!g")) {
                record(msg.data);
                if (!publish) sendToSandbox(msg.data);
            }
            break;
        case "resize":
            break;
        default:
            console.warn("unknown message type from the sandbox:", msg);
    }
}
function reloadSandbox() {
    resetSandbox();
    if (isStation()) clearRecording();
    if (port) {
        // the answer waits in the queue until the sandbox is ready
        sendArrayBuffer(prepareSerialFrame("!!"));
        sendHostInfo(true);
    }
}
// ---------------------------------------------------------------------------
// Framing
let receiverstatus = "no";
let stringReceived = "";
// bytes from the Arduino: on the station from the port, elsewhere relayed
function onReceiveCallback(bytes) {
    if (!bytes) return;
    if (isStation()) send(SUBJECT.receiveBuffer, bytes);
    if (logging >= 3) logger(3, new TextDecoder("latin1").decode(bytes));
    for (const c of bytes){
        if (receiverstatus == "in") {
            if (c == SOF) // lost a frame but go on with a new one
            stringReceived = "";
            else if (c == EOF) {
                logger(1, "rx Serial Frame: " + stringReceived);
                record(stringReceived);
                sendToSandbox(stringReceived);
                stringReceived = "";
                receiverstatus = "no";
            } else if (c == ESC) receiverstatus = "esc";
            else stringReceived += String.fromCharCode(c);
        } else if (receiverstatus == "esc") {
            stringReceived += String.fromCharCode(c ^ ESCMASK);
            receiverstatus = "in";
        } else if (c == SOF) {
            receiverstatus = "in";
            stringReceived = "";
        }
    }
}
// a frame for the Arduino
function prepareSerialFrame(str) {
    logger(1, "tx Serial Frame: " + str);
    const bytes = [
        SOF
    ];
    for(let i = 0; i < str.length; i++){
        const c = str.charCodeAt(i) & 0xff;
        if (c == SOF || c == EOF || c == ESC) bytes.push(ESC, c ^ ESCMASK);
        else bytes.push(c);
    }
    bytes.push(EOF);
    return new Uint8Array(bytes);
}
// a string sent byte by byte, without framing
function writeSerial(str) {
    sendArrayBuffer(Uint8Array.from(str, (c)=>c.charCodeAt(0) & 0xff));
}
// ---------------------------------------------------------------------------
// Serial port (station only)
async function sendArrayBuffer(bytes) {
    if (!isStation()) return;
    if (!port?.writable) {
        logger(2, "not sent");
        return;
    }
    try {
        writer ??= port.writable.getWriter();
        await writer.write(bytes);
    } catch (e) {
        console.warn("writing to the serial port failed:", e);
    }
}
async function readFromPort(p) {
    // after a recoverable error (framing, break) the port gets a new readable
    while(p.readable){
        reader = p.readable.getReader();
        let done = false;
        try {
            for(;;){
                const result = await reader.read();
                if (result.done) {
                    done = true;
                    break;
                }
                onReceiveCallback(result.value);
            }
        } catch (e) {
            console.warn("reading from the serial port failed:", e);
        } finally{
            reader.releaseLock();
            reader = null;
        }
        if (closing || port !== p) return;
        if (done) break;
    }
    onDeviceLost(p);
}
async function connect(interactive) {
    if (!serial) {
        setState({
            status: "error",
            error: "Web Serial is not available in this browser. Open the station in Chrome, Edge or Firefox 151+."
        });
        return;
    }
    if (port || state.status === "connecting") return;
    setState({
        status: "connecting",
        error: ""
    });
    try {
        // a port chosen before needs no picker (and the picker needs a click at the station)
        let p = state.autoconnect || !interactive ? (await serial.getPorts())[0] : null;
        if (!p) {
            if (!interactive) // auto-connect: a browser shows the port dialog only after a click
            throw new Error("no port chosen at the station yet. Click Connect at the station once and choose the Arduino");
            p = await serial.requestPort();
        }
        await p.open({
            baudRate: parseInt(state.baudrate)
        });
        port = p;
        const current = ++connection;
        p.addEventListener("disconnect", ()=>onDeviceLost(p));
        readLoop = readFromPort(p);
        setState({
            connected: true,
            status: "connected",
            error: ""
        });
        setTimeout(()=>{
            if (port !== p || connection !== current) return;
            clearRecording();
            sendArrayBuffer(prepareSerialFrame("!!"));
            sendHostInfo(true);
        }, ARDUINO_RESET_DELAY);
    } catch (e) {
        console.warn("could not connect:", e);
        setState({
            connected: false,
            status: "error",
            error: `Could not connect: ${e.message}`
        });
    }
}
async function closePort() {
    const p = port;
    if (!p) return;
    closing = true;
    port = null;
    sendHostInfo(false);
    try {
        await reader?.cancel();
    } catch (e) {}
    await readLoop?.catch(()=>{});
    try {
        writer?.releaseLock();
    } catch (e) {}
    writer = null;
    try {
        await p.close();
    } catch (e) {
        console.warn("closing the serial port failed:", e);
    }
    closing = false;
}
async function disconnect() {
    await closePort();
    setState({
        connected: false,
        status: "idle",
        error: ""
    });
}
async function onDeviceLost(p) {
    if (port !== p) return;
    await closePort();
    setState({
        connected: false,
        status: "lost",
        error: state.autoconnect ? "The Arduino was disconnected. It reconnects when it is plugged in again." : "The Arduino was disconnected."
    });
}
function onConnectClicked() {
    if (isTeacher()) send(SUBJECT.connect, null, stationInRoom());
    else if (!isStation()) return;
    else if (state.connected) disconnect();
    else connect(true);
}
// station (and teachers through it): ask the Arduino for its GUI again, for
// everyone; students: load the station's GUI again, only for themselves
function onReloadClicked() {
    if (isStation()) reloadSandbox();
    else if (isTeacher()) send(SUBJECT.reload, null, stationInRoom());
    else {
        askedStation = undefined;
        requestState();
    }
}
// ---------------------------------------------------------------------------
// Edrys
Edrys.onReady(()=>{
    ready = true;
    // the sandbox has most likely loaded by now
    helloSandbox();
    if (isStation()) {
        loadSettings();
        setState({});
        if (!serial) connect(true) // reports that Web Serial is missing
        ;
        else {
            if (state.autoconnect) connect(false);
            // auto-connect when the Arduino is plugged in again
            serial.addEventListener("connect", ()=>{
                if (state.autoconnect && !port) connect(false);
            });
        }
    } else {
        render();
        requestState();
    }
});
// the station may join or leave the room; when we see it (again), ask it for
// its state: it may not have been visible yet when we were ready
Edrys.onUpdate(()=>{
    if (!isStation()) {
        if (!stationInRoom()) askedStation = undefined;
        requestState();
    }
    render();
});
Edrys.onMessage(({ from, subject, body })=>{
    // edrys delivers our own messages back to us, we have handled them already
    if (from === Edrys.username) return;
    const fromStation = roleOf(from) === "station";
    if (isStation()) {
        switch(subject){
            case SUBJECT.init:
                send(SUBJECT.update, state, from);
                send(SUBJECT.replay, replay(), from);
                break;
            case SUBJECT.fromSandbox:
                receiveFromSandbox(body, false);
                break;
        }
        // a teacher's clicks, carried out here; anyone else's are ignored
        if (roleOf(from) !== "teacher") return;
        switch(subject){
            case SUBJECT.connect:
                if (state.connected) disconnect();
                else connect(false) // no port dialog: it needs a click at the station
                ;
                break;
            case SUBJECT.reload:
                reloadSandbox();
                break;
            case SUBJECT.settings:
                applySettings(body);
                break;
        }
        return;
    }
    switch(subject){
        case SUBJECT.update:
            if (fromStation && body) {
                state = {
                    ...state,
                    ...body
                };
                render();
            }
            break;
        case SUBJECT.replay:
            if (fromStation && body && Array.isArray(body.frames)) applyReplay(body);
            break;
        case SUBJECT.receiveBuffer:
            // device output runs as HTML/JS in the sandbox: accept it only from the station
            if (fromStation && body instanceof Uint8Array) onReceiveCallback(body);
            break;
        case SUBJECT.fromSandbox:
            receiveFromSandbox(body, false);
            break;
    }
});
// ---------------------------------------------------------------------------
ui.connect.addEventListener("click", onConnectClicked);
ui.reload.addEventListener("click", onReloadClicked);
ui.baudrate.addEventListener("change", onSettingsChanged);
ui.autoconnect.addEventListener("change", onSettingsChanged);
window.addEventListener("message", (event)=>{
    if (event.source !== sandboxWindow()) return;
    if (event.data?.type === "ready") onSandboxReady();
    else receiveFromSandbox(event.data, true);
});
// every (re)load of the sandbox, also its own on `!!`
ui.sandbox.addEventListener("load", helloSandbox);
render();

//# sourceMappingURL=index.4c4d6d86.js.map
