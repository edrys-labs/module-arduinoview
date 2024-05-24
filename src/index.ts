const communication = navigator as Navigator & {
  serial?: any
}

var port: any = null
var writer: any = null
var reader: any = null

var sandbox = (document.getElementById('sandbox') as HTMLIFrameElement)
  ?.contentWindow

// an object containing objects that can be distinguished from each other (is used like an enumeration in onReceiveCallback
var frmstatus = {
  no: {},
  in: {},
  esc: {},
}

var receiverstatus = frmstatus.no
var stringReceived = ''

// teletype framing with escaping
const SOF = 0x01
const EOF = 0x04
const ESC = 0x10
const ESCMASK = 0x40

//logger is used to debug the sending and receiving of messages logging contains the log,level, which determines how many messages are logged to the debug console
var logging = 0

const buttonConnect = document.getElementById('connect') as HTMLInputElement
if (buttonConnect) {
  buttonConnect.onclick = onConnect
}

function sendHostInfo(connected: boolean) {
  if (sandbox) {
    sandbox.postMessage(
      { type: 'hostinfo', data: JSON.stringify({ connected }) },
      '*'
    )
  } else {
    console.warn('no sandbox')
  }
}

//interprets a message from the sandbox and calls a function depending on the type
function receiveFromSandbox(event: MessageEvent, publish = true) {
  if (sandbox !== event.source) return

  if (window.send && publish) {
    window.send('receivedFromSandbox', event.data)
  }

  //we got a letter from sandbox
  var msg = event.data
  logger(1, msg.toString())

  switch (msg.type) {
    case 'raw':
      writeSerial(msg.data)
      break
    case 'frame':
      sendArrayBuffer(prepareSerialFrame(msg.data))

      if (!publish) {
        sendToSandbox(msg.data)
      }
      break
    case 'resize':
      window.resizeTo(msg.data[0], msg.data[1])
      break
    default:
      console.warn('unknown message type')
  }
}

//sends a message to the Sandbox
function sendToSandbox(msg: string) {
  // send a letter to sandbox
  try {
    if (sandbox) {
      sandbox.postMessage({ type: 'frame', data: msg }, '*')
    }
  } catch (e) {
    console.warn('sendToSandbox failed:', e.message)
  }
}

function logger(lvl, msg) {
  if (logging >= lvl) console.log(msg)
}

//
function onReceiveCallback(info) {
  if (!info) return

  if (window.station === true && window.send) {
    // send the received data to the host
    window.send('receive-buffer', info)
  }

  var bytes = new Uint8Array(info)
  logger(3, String.fromCharCode.apply(null, bytes))

  for (var i in bytes) {
    var c = bytes[i]
    logger(5, String.fromCharCode(c))
    if (receiverstatus == frmstatus.in) {
      if (c == SOF) {
        //lost a frame but go on with a new one
        receiverstatus = frmstatus.in
        stringReceived = ''
      } else if (c == EOF) {
        //frame complete send its contet to the sandbox
        logger(1, 'rx Serial Frame: ' + stringReceived)
        sendToSandbox(stringReceived)
        stringReceived = ''
        receiverstatus = frmstatus.no
      } else if (c == ESC) {
        receiverstatus = frmstatus.esc
      } else {
        stringReceived += String.fromCharCode(c)
      }
    } else if (receiverstatus == frmstatus.esc) {
      stringReceived += String.fromCharCode(ESC ^ ESCMASK)
      receiverstatus = frmstatus.in
    } else if (receiverstatus == frmstatus.no) {
      if (c == SOF) {
        // start a new frame
        receiverstatus = frmstatus.in
        stringReceived = ''
      }
    }
  }
}

//send an ArrayBuffer to the serial connection
function sendArrayBuffer(buf: ArrayBuffer) {
  if (window.station === false) {
    return
  }

  if (port) {
    if (!writer) writer = port.writable.getWriter()
    try {
      // Write the data to the serial port.
      writer.write(buf)
    } catch (error) {
      console.warn('Failed to write data to the serial port:', error)
    }
  } else {
    logger(2, 'not sent')
  }
}

// create a buffer that contains a frame that will be send to the serial connection
function prepareSerialFrame(str: string) {
  logger(1, 'tx Serial Frame: ' + str)
  var buf = new ArrayBuffer(str.length * 2 + 2)
  var bufView = new Uint8Array(buf)
  var bufi = 0
  bufView[bufi] = SOF
  bufi++
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i)
    if (c == SOF || c == EOF || c == ESC) {
      bufView[bufi] = ESC
      bufView[bufi] = c ^ ESCMASK
      bufi += 2
    } else {
      bufView[bufi] = c
      bufi++
    }
  }
  bufView[bufi] = EOF
  return buf
}

// write a string to the serial connection
function writeSerial(str: string) {
  sendArrayBuffer(convertStringToArrayBuffer(str))
}

// Convert string to ArrayBuffer
function convertStringToArrayBuffer(str: string) {
  var buf = new ArrayBuffer(str.length)
  var bufView = new Uint8Array(buf)
  for (var i = 0; i < str.length; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return buf
}

async function readFromPort() {
  if (!port) return

  reader = port.readable.getReader()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }

      onReceiveCallback(value) // Reader has been released.
    }
  } catch (error) {
    console.warn('serial communication closed:', error.message)
  } finally {
    reader.releaseLock()
  }
}

function onConnect() {
  buttonConnect.disabled = true
  const baudrate = window.document.getElementById(
    'baudrate'
  ) as HTMLInputElement
  const autoconnect = document.getElementById('autoconnect') as HTMLInputElement

  if (window.station === false) {
    window.send('connect', null)
    return
  }

  if (buttonConnect.innerText === 'Connect') {
    connect().then((ok: boolean) => {
      buttonConnect.innerText = ok ? 'Disconnect' : 'Connect'
      buttonConnect.disabled = false

      baudrate.disabled = ok
      autoconnect.disabled = ok

      window?.update()
    })
  } else {
    disconnect().then(() => {
      buttonConnect.innerText = 'Connect'
      buttonConnect.disabled = false

      baudrate.disabled = false
      autoconnect.disabled = false

      window?.update()
      console.log('Disconnected', window.state)
    })
  }
}

async function connect() {
  try {
    const autoconnect = document.getElementById(
      'autoconnect'
    ) as HTMLInputElement
    console.log('port:', autoconnect)

    port = null
    if (autoconnect.checked) {
      const ports = await communication.serial.getPorts()
      if (ports.length > 0) {
        port = ports[0]
      }
    }

    if (!port) {
      port = await communication.serial.requestPort()
    }

    if (port) {
      const baudRate = parseInt(
        (document.getElementById('baudrate') as HTMLInputElement).value
      )
      await port.open({ baudRate })

      console.log('Connected to:', baudRate, port.getInfo())

      readFromPort()

      setTimeout(function () {
        //initSandbox()
        sendArrayBuffer(prepareSerialFrame('!!'))
        sendHostInfo(true)
      }, 2000)

      return true
    }
    // Continue with opening the port, etc.
  } catch (e) {
    // Handle errors or rejections here
    console.log('There was an error:', e.message)
    await disconnect()
  }
  return false
}

async function disconnect() {
  if (!port) return

  sendHostInfo(false)

  if (writer) {
    await writer.releaseLock()
    await port.writable.close()
    writer = null
  }

  if (reader) {
    await reader.releaseLock()
    await port.readable.cancel()
    reader = null
  }

  await port.close()
  port = null
}

function initSandbox() {
  let localSandbox = document.getElementById('sandbox') as HTMLIFrameElement

  if (localSandbox) {
    localSandbox.src = './sandbox.html'
    sandbox = (localSandbox as HTMLIFrameElement).contentWindow

    if (window.station === false) {
      window.send('reload', null)
      return
    }

    if (port) {
      sendArrayBuffer(prepareSerialFrame('!!'))
      sendHostInfo(true)
    }
  }
}

{
  const buttonReload = document.getElementById('reload') as HTMLInputElement
  if (buttonReload) {
    buttonReload.onclick = initSandbox
  }

  if (window.station === false) {
  } else {
    window.addEventListener('message', receiveFromSandbox, false)
  }

  window.receiveFromSandBox = function (event, publish) {
    receiveFromSandbox({ data: event, source: sandbox }, publish)
  }
  window.onReceiveCallback = onReceiveCallback
  window.sendArrayBuffer = sendArrayBuffer
}
