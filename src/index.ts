// The station connects the Arduino via Web Serial and relays its output to
// every peer in the room; each peer renders the Arduino's GUI in its own
// sandbox, and actions in any sandbox are written to the Arduino by the
// station.

declare const Edrys: any

// message subjects (all peers run this module, so they only need to agree
// with themselves)
const SUBJECT = {
  init: 'init', // a peer is ready and wants the station's state
  update: 'update', // station -> all: state; others -> station: settings
  connect: 'connect', // ask the station to connect or disconnect
  reload: 'reload', // ask the station to reload the GUI
  receiveBuffer: 'receive-buffer', // station -> all: bytes from the Arduino
  fromSandbox: 'receivedFromSandbox', // an action in a peer's sandbox
}

const BAUD_RATES = ['110', '300', '1200', '2400', '4800', '9600', '19200', '38400', '57600', '115200']
const DEFAULTS = { baudrate: '9600', autoconnect: false }

// most Arduinos reset when the port opens; give the bootloader time before
// asking the sketch for its GUI
const ARDUINO_RESET_DELAY = 2000
// a student's Connect/Reload waits this long for the station to react
const STATION_TIMEOUT = 10_000

// teletype framing with escaping (ArduinoView/Frameiterator.h)
const SOF = 0x01
const EOF = 0x04
const ESC = 0x10
const ESCMASK = 0x40

type Status = 'idle' | 'connecting' | 'connected' | 'lost' | 'error'

// the station's state, mirrored on every peer
let state = {
  baudrate: DEFAULTS.baudrate,
  autoconnect: DEFAULTS.autoconnect,
  connected: false,
  status: 'idle' as Status,
  error: '',
}

let ready = false
let guiReceived = false
// a student asked the station for something and waits for its answer
let pending: ReturnType<typeof setTimeout> | null = null

const serial = (navigator as Navigator & { serial?: any }).serial
let port: any = null
let reader: any = null
let writer: any = null
let readLoop: Promise<void> | null = null
let closing = false

// logging level: how much of the traffic is logged to the console (0 = none)
const logging = 0
function logger(lvl: number, msg: string) {
  if (logging >= lvl) console.log(msg)
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const ui = {
  badge: $('badge'),
  message: $('message'),
  autoconnect: $<HTMLInputElement>('autoconnect'),
  baudrate: $<HTMLSelectElement>('baudrate'),
  connect: $<HTMLButtonElement>('connect'),
  connectLabel: $('connect-label'),
  reload: $<HTMLButtonElement>('reload'),
  sandbox: $<HTMLIFrameElement>('sandbox'),
  placeholder: $('placeholder'),
}

const isStation = () => Edrys.role === 'station'

// the id of the station in our room, if there is one
function stationInRoom(): string | undefined {
  const room = Edrys.liveUser?.room
  const users = Object.entries(Edrys.liveClass?.users || {})
  return users.find(([, user]: [string, any]) => user?.role === 'station' && user?.room === room)?.[0]
}
// the station we asked for its state
let askedStation: string | undefined

// student: ask the station in the room for its state, once per station
function requestState() {
  const station = stationInRoom()
  if (!station || station === askedStation) return
  askedStation = station
  send(SUBJECT.init, null, station)
}

function send(subject: string, body: any = null, user?: string) {
  if (ready) Edrys.sendMessage(subject, body, user)
}

// ---------------------------------------------------------------------------
// State and rendering

function render() {
  const station = isStation()
  const present = station || stationInRoom()
  const busy = state.status === 'connecting' || pending !== null

  let badge: [string, string]
  if (!ready) badge = ['loading…', 'wait']
  else if (!present) badge = ['no station', 'off']
  else if (state.connected) badge = [`connected · ${state.baudrate} baud`, 'on']
  else if (state.status === 'connecting') badge = ['connecting…', 'wait']
  else if (state.status === 'lost') badge = ['device lost', 'off']
  else badge = ['not connected', 'off']
  ui.badge.textContent = badge[0]
  ui.badge.className = 'badge ' + badge[1]

  ui.message.textContent =
    ready && !present
      ? 'Open this room as a station to connect an Arduino.'
      : pending
        ? 'Asking the station…'
        : state.error

  ui.baudrate.value = state.baudrate
  ui.autoconnect.checked = state.autoconnect
  ui.connectLabel.textContent = state.connected ? 'Disconnect' : 'Connect'
  ui.connect.disabled = !ready || !present || busy
  ui.reload.disabled = !ready || !present
  ui.baudrate.disabled = ui.autoconnect.disabled = !ready || !present || busy || state.connected

  ui.placeholder.hidden = guiReceived
  ui.placeholder.textContent = !ready
    ? ''
    : state.connected
      ? 'Waiting for the GUI of the Arduino…'
      : station
        ? 'Connect an Arduino to show its GUI.'
        : 'Waiting for the station to connect an Arduino…'
}

// station: change the state and tell everyone
function setState(patch: Partial<typeof state>) {
  state = { ...state, ...patch }
  render()
  if (isStation()) send(SUBJECT.update, state)
}

function stopPending() {
  if (pending) clearTimeout(pending)
  pending = null
}

// student: ask the station, and say so if it does not react
function askStation(subject: string) {
  send(subject)
  stopPending()
  pending = setTimeout(() => {
    pending = null
    state = { ...state, error: 'The station did not answer.' }
    render()
  }, STATION_TIMEOUT)
  render()
}

// station: baud rate and auto-connect from the teacher's config, else the
// station's last choice, else the defaults
function loadSettings() {
  const config = Edrys.module?.stationConfig
  const cfg = config && typeof config === 'object' ? config : {}

  let saved: string | null = null
  try {
    saved = Edrys.getItem('baudrate')
  } catch (e) {}

  const baudrate = [String(cfg.baudrate ?? ''), saved].find((b) => b && BAUD_RATES.includes(b))
  let autoconnect = cfg.autoconnect === true
  try {
    autoconnect ||= Edrys.getItem('autoconnect') === 'true'
  } catch (e) {}

  state = { ...state, baudrate: baudrate || DEFAULTS.baudrate, autoconnect }
}

function saveSettings() {
  try {
    Edrys.setItem('baudrate', state.baudrate)
    Edrys.setItem('autoconnect', String(state.autoconnect))
  } catch (e) {
    console.warn('could not save the settings:', e)
  }
}

function onSettingsChanged() {
  const settings = { baudrate: ui.baudrate.value, autoconnect: ui.autoconnect.checked }
  if (isStation()) {
    setState(settings)
    saveSettings()
  } else {
    // the station applies them and answers with its state
    send(SUBJECT.update, settings)
  }
}

// ---------------------------------------------------------------------------
// Sandbox

const sandboxWindow = () => ui.sandbox.contentWindow

function sendHostInfo(connected: boolean) {
  sandboxWindow()?.postMessage({ type: 'hostinfo', data: JSON.stringify({ connected }) }, '*')
}

function sendToSandbox(msg: string) {
  if (!guiReceived) {
    guiReceived = true
    render()
  }
  sandboxWindow()?.postMessage({ type: 'frame', data: msg }, '*')
}

// an action in a sandbox: our own (publish to the others) or another peer's
function receiveFromSandbox(msg: { type: string; data: any }, publish: boolean) {
  if (publish) send(SUBJECT.fromSandbox, msg)

  logger(1, JSON.stringify(msg))

  switch (msg?.type) {
    case 'raw':
      writeSerial(msg.data)
      break
    case 'frame':
      sendArrayBuffer(prepareSerialFrame(msg.data))
      // mirror the action (slider position, …) in this sandbox
      if (!publish) sendToSandbox(msg.data)
      break
    case 'resize':
      window.resizeTo(msg.data[0], msg.data[1])
      break
    default:
      console.warn('unknown message type from the sandbox:', msg)
  }
}

function reloadSandbox() {
  guiReceived = false
  render()
  // keep the src as built (Parcel makes it absolute)
  ui.sandbox.src = ui.sandbox.src

  if (port) {
    // ask the Arduino for its GUI only once the reloaded sandbox can receive it
    ui.sandbox.addEventListener(
      'load',
      () => {
        sendArrayBuffer(prepareSerialFrame('!!'))
        sendHostInfo(true)
      },
      { once: true }
    )
  }
}

// ---------------------------------------------------------------------------
// Framing

let receiverstatus: 'no' | 'in' | 'esc' = 'no'
let stringReceived = ''

// bytes from the Arduino: on the station from the port, elsewhere relayed
function onReceiveCallback(bytes: Uint8Array) {
  if (!bytes) return

  if (isStation()) send(SUBJECT.receiveBuffer, bytes)

  if (logging >= 3) logger(3, new TextDecoder('latin1').decode(bytes))

  for (const c of bytes) {
    if (receiverstatus == 'in') {
      if (c == SOF) {
        // lost a frame but go on with a new one
        stringReceived = ''
      } else if (c == EOF) {
        logger(1, 'rx Serial Frame: ' + stringReceived)
        sendToSandbox(stringReceived)
        stringReceived = ''
        receiverstatus = 'no'
      } else if (c == ESC) {
        receiverstatus = 'esc'
      } else {
        stringReceived += String.fromCharCode(c)
      }
    } else if (receiverstatus == 'esc') {
      stringReceived += String.fromCharCode(c ^ ESCMASK)
      receiverstatus = 'in'
    } else if (c == SOF) {
      receiverstatus = 'in'
      stringReceived = ''
    }
  }
}

// a frame for the Arduino
function prepareSerialFrame(str: string) {
  logger(1, 'tx Serial Frame: ' + str)
  const bytes = [SOF]
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i) & 0xff
    if (c == SOF || c == EOF || c == ESC) {
      bytes.push(ESC, c ^ ESCMASK)
    } else {
      bytes.push(c)
    }
  }
  bytes.push(EOF)
  return new Uint8Array(bytes)
}

// a string sent byte by byte, without framing
function writeSerial(str: string) {
  sendArrayBuffer(Uint8Array.from(str, (c) => c.charCodeAt(0) & 0xff))
}

// ---------------------------------------------------------------------------
// Serial port (station only)

async function sendArrayBuffer(bytes: Uint8Array) {
  if (!isStation()) return
  if (!port?.writable) {
    logger(2, 'not sent')
    return
  }
  try {
    writer ??= port.writable.getWriter()
    await writer.write(bytes)
  } catch (e) {
    console.warn('writing to the serial port failed:', e)
  }
}

async function readFromPort(p: any) {
  // after a recoverable error (framing, break) the port gets a new readable
  while (p.readable) {
    reader = p.readable.getReader()
    let done = false
    try {
      for (;;) {
        const result = await reader.read()
        if (result.done) {
          done = true
          break
        }
        onReceiveCallback(result.value)
      }
    } catch (e) {
      console.warn('reading from the serial port failed:', e)
    } finally {
      reader.releaseLock()
      reader = null
    }
    if (closing || port !== p) return
    if (done) break
  }
  onDeviceLost(p)
}

async function connect(interactive: boolean) {
  if (!serial) {
    setState({
      status: 'error',
      error: 'Web Serial is not available in this browser. Open the station in Chrome, Edge or Firefox 151+.',
    })
    return
  }
  if (port || state.status === 'connecting') return

  setState({ status: 'connecting', error: '' })
  try {
    // a port chosen before needs no picker (and the picker needs a click at the station)
    let p = state.autoconnect || !interactive ? (await serial.getPorts())[0] : null
    if (!p) {
      if (!interactive) {
        throw new Error('no port chosen yet. Click Connect at the station once and choose the Arduino')
      }
      p = await serial.requestPort()
    }

    await p.open({ baudRate: parseInt(state.baudrate) })
    port = p
    p.addEventListener('disconnect', () => onDeviceLost(p))
    readLoop = readFromPort(p)
    setState({ connected: true, status: 'connected', error: '' })

    setTimeout(() => {
      if (port !== p) return
      sendArrayBuffer(prepareSerialFrame('!!'))
      sendHostInfo(true)
    }, ARDUINO_RESET_DELAY)
  } catch (e) {
    console.warn('could not connect:', e)
    setState({ connected: false, status: 'error', error: `Could not connect: ${e.message}` })
  }
}

async function closePort() {
  const p = port
  if (!p) return
  closing = true
  port = null
  sendHostInfo(false)
  try {
    await reader?.cancel()
  } catch (e) {}
  await readLoop?.catch(() => {})
  try {
    writer?.releaseLock()
  } catch (e) {}
  writer = null
  try {
    await p.close()
  } catch (e) {
    console.warn('closing the serial port failed:', e)
  }
  closing = false
}

async function disconnect() {
  await closePort()
  setState({ connected: false, status: 'idle', error: '' })
}

async function onDeviceLost(p: any) {
  if (port !== p) return
  await closePort()
  setState({
    connected: false,
    status: 'lost',
    error: state.autoconnect
      ? 'The Arduino was disconnected. It reconnects when it is plugged in again.'
      : 'The Arduino was disconnected.',
  })
}

function onConnectClicked() {
  if (!isStation()) return askStation(SUBJECT.connect)
  if (state.connected) disconnect()
  else connect(true)
}

function onReloadClicked() {
  if (isStation()) reloadSandbox()
  else {
    reloadSandbox()
    send(SUBJECT.reload)
  }
}

// ---------------------------------------------------------------------------
// Edrys

Edrys.onReady(() => {
  ready = true

  if (isStation()) {
    loadSettings()
    setState({})
    if (!serial) {
      connect(true) // reports that Web Serial is missing
    } else {
      if (state.autoconnect) connect(false)
      // auto-connect when the Arduino is plugged in again
      serial.addEventListener('connect', () => {
        if (state.autoconnect && !port) connect(false)
      })
    }
  } else {
    render()
    requestState()
  }
})

// the station may join or leave the room; when we see it (again), ask it for
// its state: it may not have been visible yet when we were ready
Edrys.onUpdate(() => {
  if (!isStation()) {
    if (!stationInRoom()) askedStation = undefined
    requestState()
  }
  render()
})

Edrys.onMessage(({ from, subject, body }) => {
  // edrys delivers our own messages back to us, we have handled them already
  if (from === Edrys.username) return

  // messages are signed, so the sender's role holds
  const fromStation = Edrys.liveClass?.users?.[from]?.role === 'station'

  if (isStation()) {
    switch (subject) {
      case SUBJECT.init:
        send(SUBJECT.update, state, from)
        break
      case SUBJECT.connect:
        if (state.connected) disconnect()
        else connect(false)
        break
      case SUBJECT.reload:
        reloadSandbox()
        break
      case SUBJECT.update:
        if (!state.connected && state.status !== 'connecting' && body) {
          const baudrate = BAUD_RATES.includes(String(body.baudrate)) ? String(body.baudrate) : state.baudrate
          setState({ baudrate, autoconnect: body.autoconnect === true })
          saveSettings()
        } else {
          // tell the sender its change was not applied
          send(SUBJECT.update, state, from)
        }
        break
      case SUBJECT.fromSandbox:
        receiveFromSandbox(body, false)
        break
    }
    return
  }

  switch (subject) {
    case SUBJECT.update:
      if (fromStation && body) {
        stopPending()
        state = { ...state, ...body }
        render()
      }
      break
    case SUBJECT.receiveBuffer:
      // device output runs as HTML/JS in the sandbox: accept it only from the station
      if (fromStation && body instanceof Uint8Array) onReceiveCallback(body)
      break
    case SUBJECT.fromSandbox:
      receiveFromSandbox(body, false)
      break
  }
})

// ---------------------------------------------------------------------------

ui.connect.addEventListener('click', onConnectClicked)
ui.reload.addEventListener('click', onReloadClicked)
ui.baudrate.addEventListener('change', onSettingsChanged)
ui.autoconnect.addEventListener('change', onSettingsChanged)

window.addEventListener('message', (event) => {
  if (event.source === sandboxWindow()) receiveFromSandbox(event.data, true)
})

render()
