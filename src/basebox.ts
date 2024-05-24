declare global {
  interface Window {
    sendraw: (msg: string) => void
    sendframe: (msg: string) => void
    sendiandvalue: (obj: { id: string; value: string }) => void
    sendresize: (width: number, height: number) => void
    runner: any
  }
}

export default class BaseBox {
  protected host: null | Window = null
  protected IDs: {
    id: string
    element: HTMLElement | null
  }[] = []
  protected currentElement: null | Element = null
  protected hostinfo = null

  protected runner: any

  constructor() {
    this.runner = {
      // reload sandbox
      '!!': () => {
        // @ts-ignore
        window.location = 'sandbox.html'
      },
      '!j': (x) => {
        this.eval(x)
      },
      // set workelment
      '!w': (x) => {
        this.setElement(x)
      },
      '!h': (x) => {
        this.HTMLreplace(x)
      },
      '!H': (x) => {
        this.HTMLappend(x)
      },
      append: (d) => {
        for (let i in d) {
          this.runner[i] = d[i]
        }
      },
    }

    // use base methods as global functions
    const self = this
    window.sendraw = (x) => {
      self.sendRaw(x)
    }
    window.sendframe = (x) => {
      self.sendFrame(x)
    }
    window.sendiandvalue = (x) => {
      self.send_i_and_value(x)
    }
    window.sendresize = (width, height) => {
      self.sendResize(width, height)
    }

    window['runner'] = self.runner
  }

  eval(x: string) {
    try {
      const self = this
      let sendraw = (x) => {
        self.sendRaw(x)
      }
      let sendframe = (x) => {
        self.sendFrame(x)
      }
      let sendiandvalue = (x) => {
        self.send_i_and_value(x)
      }
      let sendresize = (width, height) => {
        self.sendResize(width, height)
      }
      const runner = this.runner

      eval(x)
    } catch (e) {
      console.warn('failed to eval', x)
      console.warn('-->', e.message)
    }
  }

  start() {
    const self = this
    window.addEventListener(
      'message',
      (data) => {
        self.receiveMessage(data)
      },
      false
    )
  }

  HTMLreplace(value) {
    if (!this.currentElement) {
      this.getElement()
    }

    // this.getElement will set an element
    // @ts-ignore
    this.currentElement.innerHTML = value
  }

  // creates an temporary div replaces its innerHTML and than transfers
  // appends every node inside that div to the current workelement
  HTMLappend(value) {
    var d = document.createElement('div')
    d.innerHTML = value
    var e = this.getElement()
    var next = d.firstChild
    while (next) {
      var curr = next
      next = curr.nextSibling
      e.appendChild(curr)
    }
  }

  setElement(x: string | Element) {
    var a

    if (!x) {
      this.currentElement = null
    } else if (typeof x === 'string') {
      if (this.IDs[x]) {
        this.currentElement = document.getElementById(this.IDs[x].id)
      } else if ((a = document.getElementById(x))) {
        this.currentElement = a
      }
    } else if (x instanceof Element) {
      this.currentElement = x
    } else {
      throw new Error('workelement: ' + x + ' not found')
    }
    return this.getElement()
  }

  getElement() {
    if (!this.currentElement) {
      this.currentElement = document.body
    }
    return this.currentElement
  }

  // interprets Messages that are send to the sandbox
  receiveMessage(event) {
    this.host = event.source

    //console.warn('receiveMessage', event.data.type, event.data.data)

    switch (event.data.type) {
      case 'frame': {
        try {
          const msg = event.data.data
          var rid = msg.substring(0, 2)
          var str = msg.substring(2)

          if (this.runner[rid]) {
            this.runner[rid](str)
          } else {
            console.warn('unknown Runner: ' + rid)
          }
        } catch (e) {
          console.warn(e.toString() + '\nFrame: ' + event.data)
        }
        break
      }
      case 'hostinfo': {
        try {
          this.hostinfo = JSON.parse(event.data.data)
        } catch (e) {
          console.warn('failed to decode hostinfo', e.message)
        }
        break
      }
      default: {
        console.warn('unknown message type', event.data)
      }
    }
  }

  send(type: string, data: any) {
    if (this.host) this.host.postMessage({ type, data }, '*')
  }

  // sends a message to the Arduino using the hosts connection sendraw
  // instructs the host to not pack a frame the message-string will be send byte by byte
  sendRaw(msg: string) {
    this.send('raw', msg)
  }

  // sends a message to the Arduino using the hosts connection `sendframe`
  // instructs the host to pack a frame
  sendFrame(msg: string) {
    this.send('frame', msg)
  }

  send_i_and_value(obj) {
    this.sendFrame(obj.id + ':' + obj.value)
  }

  sendResize(width: number, height: number) {
    this.send('resize', [width, height])
  }

  //loads javascript-files by adding a script elemet to the head
  //http://www.javascriptkit.com/javatutors/loadjavascriptcss.shtml
  loadJS(filename: string, onload: () => void) {
    const script = document.createElement('script')
    script.setAttribute('type', 'text/javascript')
    script.setAttribute('src', filename)
    script.onload = onload
    //script.setAttribute('onload', onload)
    document.getElementsByTagName('head')[0].appendChild(script)
  }

  // does the same as loadjsfile for css files
  loadCSS(filename: string) {
    const link = document.createElement('link')
    link.setAttribute('rel', 'stylesheet')
    link.setAttribute('type', 'text/css')
    link.setAttribute('href', filename)
    document.getElementsByTagName('head')[0].appendChild(link)
  }

  // sounds a beep
  beep() {
    //sound a simple short annoying beep to create attention
    let actx = new AudioContext()
    let osc = actx.createOscillator()
    osc.connect(actx.destination)
    // osc.frequency = 1000
    osc.detune.setValueAtTime(1000, actx.currentTime) // set the detune value instead of frequency
    osc.type = 'square'

    osc.start()
    setTimeout(() => {
      osc.stop()
      actx.close()
    }, 200) // wait
  }
}
