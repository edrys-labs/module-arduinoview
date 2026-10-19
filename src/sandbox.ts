import * as echarts from 'echarts'

import BaseBox from './basebox'

function throttle(func, limit) {
  let lastFunc
  let lastRan
  return function () {
    const context = this
    const args = arguments
    if (!lastRan) {
      func.apply(context, args)
      lastRan = Date.now()
    } else {
      clearTimeout(lastFunc)
      lastFunc = setTimeout(function () {
        if (Date.now() - lastRan >= limit) {
          func.apply(context, args)
          lastRan = Date.now()
        }
      }, limit - (Date.now() - lastRan))
    }
  }
}

export default class SandBox extends BaseBox {
  // elements created by `!S`, by their 2-character id; graphs carry their
  // chart, data and the functions `!d`/`!c` call
  protected IDs: Record<string, { id: string; element: HTMLElement | null; [key: string]: any }> = {}

  constructor() {
    super()

    const self = this
    this.runner.append({
      '!S': (x: string) => {
        self.createStandardElement(x)
      },
      '!d': (x: string) => {
        self.guiData(x)
      },
      '!c': (x: string) => {
        self.csnData(x)
      },
      // an action on another peer's GUI, mirrored here
      '!g': (x: string) => {
        const entry = self.IDs[x.substring(0, 2)]
        const sync = entry && (document.getElementById(entry.id) as HTMLInputElement | null)
        if (!sync) return

        const data = x.substring(2)
        // a button sends no data, its label must stay
        if (sync.type === 'button') return
        if (sync.type === 'checkbox') sync.checked = data === 't'
        else sync.value = data
      },
    })
  }

  parseData(x: string): { style: string; value: string } {
    var ret = { style: '', value: '' }

    if (x === '') return ret

    //initialize return object including empty style string
    x = x.replace(/!!/g, '&#33;') //double Exclamation mark escapes !
    var data = x.split('!')

    for (let i in data) {
      var value = data[i].substring(1)

      switch (data[i][0]) {
        case 'w': //width
          ret.style += ';width:' + value
          break
        case 'h': //height
          ret.style += ';height:' + value
          break
        case 's': //style
          ret.style += value
          break
        case 'v': //value
          ret['value'] = value
          break
        default:
          console.warn('cannot parse data: ', x)
      }
    }

    return ret
  }

  // `!S<element><ID><data>`, elements:
  // l line break, d inline-block div, b button, s slider, p colour picker,
  // c checkbox, t text input, k key events, G graph (M: deprecated moving graph)
  createStandardElement(x: string) {
    var element = x[0]
    var id = x.substring(1, 3)
    var elementID = '_SD_' + id

    var data = this.parseData(x.substring(3))
    switch (element) {
      //l line-break
      case 'l':
        this.HTMLappend(`<br id="${elementID}" style="${data.style}">`)

        this.IDs[id] = {
          element: document.getElementById(elementID),
          id: elementID,
        }

        break
      // inline-block div
      case 'd':
        this.HTMLappend(
          `<div id="${elementID}" style="display:inline-block;${data.style}"></div>`
        )

        this.IDs[id] = {
          element: document.getElementById(elementID),
          id: elementID,
        }
        break

      //b Button _name
      case 'b':
        this.HTMLappend(
          `<input
            type="button"
            id="${elementID}"
            value="${data?.value}"
            onclick="sendframe('!g${id}')"
            style="${data.style}"
          >`
        )
        this.IDs[id] = {
          element: document.getElementById(elementID),
          id: elementID,
        }
        break

      //s slider
      case 's':
        this.HTMLappend(
          `<input
            type="range"
            id="${elementID}"
            value="${data.value}"
            min="0" max="255"
            onchange="sendframe('!g${id}' + this.value)"
            style="${data.style}"
          >`
        )

        this.IDs[id] = {
          element: document.getElementById(elementID),
          id: elementID,
        }
        break

      // color Picker
      case 'p':
        this.HTMLappend(
          `<input
            type="color"
            id="${elementID}"
            value="${data.value}"
            oninput="sendframe('!g${id}' + this.value)"
            style="${data.style}"
          >`
        )

        const picker = document.getElementById(elementID) as HTMLInputElement

        this.IDs[id] = {
          element: picker,
          id: elementID,
        }

        picker.oninput = throttle(function () {
          window.sendframe('!g' + id + this.value)
        }, 200)
        break

      //c checkbox
      case 'c':
        this.HTMLappend(
          `<input
            type="checkbox"
            id="${elementID}"
            onchange="sendframe('!g${id}' + (this.checked ? 't' : 'f'))"
            style="${data.style}"
          >`
        )
        this.IDs[id] = {
          element: document.getElementById(elementID),
          id: elementID,
        }
        break

      //text input
      case 't':
        this.HTMLappend(
          `<input
            type="text"
            id="${elementID}"
            value="${data.value}"
            onchange="sendframe('!g${id}'+ this.value)"
            style="${data.style}"
          >`
        )

        this.IDs[id] = {
          element: document.getElementById(elementID),
          id: elementID,
        }
        break

      // key-event
      case 'k':
        // TODO filter repetition, select event to listen to
        var w = this.getElement()
        if ((w as HTMLInputElement).tabIndex < 0)
          (w as HTMLInputElement).tabIndex = 0
        // arrow function: `this` must stay the SandBox, not the element
        var onKey = (e) => {
          var msg = '!g' + id
          if (!e.repeat) {
            if (e.type == 'keydown') msg += 'd'
            if (e.type == 'keyup') msg += 'u'
            if (e.type == 'keypress') msg += 'p'
            this.sendFrame(msg + e.key)
          }
        }
        if (!data.value) data.value = 'p'
        if (data.value.includes('d')) w.addEventListener('keydown', onKey)
        if (data.value.includes('p')) w.addEventListener('keypress', onKey)
        if (data.value.includes('u')) w.addEventListener('keyup', onKey)
        break
      case 'M':
        // no alert(): it would block an unattended station
        console.warn('Moving graph M is deprecated, use Graph G')
        data.value = data.value ? data.value : '100'

      //G graph containing upto 1000 values by default
      //set number of values by giving value (v...)
      //if number of values is 0 it will be not moving
      case 'G':
        //!SGv100 Graph with 100 values
        //!SGv0 Graph with inf values -> not moving
        this.HTMLappend(
          '<div id="' + elementID + '" style="' + data.style + '">'
        )

        const elem = document.getElementById(elementID)

        if (!elem) {
          console.warn('element not found', elementID)
          return
        }

        //apply default width and height if not set
        if (!elem.style.width) elem.style.width = '100%'
        if (!elem.style.height) elem.style.height = '20em'

        const chart = echarts.init(elem)

        // every graph follows its own size (window.onresize kept only the last one)
        new ResizeObserver(() => chart.resize()).observe(elem)

        this.IDs[id] = {
          id: elementID,
          element: elem,
          chart,
          max: parseInt(data.value) || 100,
          add: function (d: string) {
            // `max,x,y`: x is not used, the time of arrival is the x axis
            const [max, , y] = d.split(',').map(Number)

            this.max = max

            const time = new Date().getTime()

            this.data.push([time, y])

            if (this.max > 0 && this.data.length > this.max) {
              this.data.shift()
            }

            this.chart.setOption({
              toolbox: {
                show: true,
                feature: {
                  dataView: { readOnly: true }, // Enable data view tool
                  saveAsImage: {}, // Enable save as image tool
                },
              },
              animation: false,
              tooltip: {
                trigger: 'axis',
              },
              xAxis: {
                type: 'time',
                min: function (value) {
                  return value.min
                },
                max: function (value) {
                  return value.max
                },
              },
              yAxis: {
                type: 'value',
                min: function (value) {
                  return value.min
                },
                max: function (value) {
                  return value.max
                },
              },
              series: [
                {
                  data: this.data,
                  type: 'line',
                  showSymbol: false, // Disables the display of symbols (dots) on the line
                  smooth: false, // Optional: Makes the line smooth
                },
              ],
            })
          },
          data: [],

          // `!c` hands over the numbers already split
          csndata: function (d: number[]) {
            this.add(d.join(','))
          },
        }
    }
  }

  // `!d<ID><data>`: hands the data to the element (graphs: `max,x,y`)
  guiData(x: string) {
    const element = this.IDs[x.substring(0, 2)]
    if (element?.add) element.add(x.substring(2))
    else console.warn('no graph for data:', x)
  }

  // `!c<ID><numbers>`: comma separated numbers for a graph (may be deprecated)
  csnData(x: string) {
    const element = this.IDs[x.substring(0, 2)]
    if (element?.csndata) element.csndata(x.substring(2).split(',').map(Number))
    else console.warn('no graph for data:', x)
  }
}
