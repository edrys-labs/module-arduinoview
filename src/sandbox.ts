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
  protected IDs: {
    id: string
    element: HTMLElement | null
    data?: any
    csndata?: any
    chart?: any
  }[] = []

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
      '!g': (x: string) => {
        var elementID = x.substr(0, 2)
        var data = x.substr(2)

        try {
          const sync = document.getElementById(self.IDs[elementID].id)

          if (sync) sync.value = data
        } catch (e) {
          console.warn('sync failed', e.message)
        }
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
      // ToDo: what is this used for?
      // var aid = data[i][0]
      var value = data[i].substr(1)

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

  //L Label _name
  //c checkbox
  //G FixedGraph
  //M MovingGraph  _name _size
  //s Slider _min _max
  //S SVG

  createStandardElement(x: string) {
    //<element><ID><data>
    var element = x[0]
    var id = x.substr(1, 2)
    var elementID = '_SD_' + id

    var data = this.parseData(x.substr(3))
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

        const slider = document.getElementById(elementID) as HTMLInputElement
        this.IDs[id] = {
          element: slider,
          id: elementID,
        }

        /*slider.oninput = throttle(function () {
          sendframe('!g' + id + this.value)
        }, 500)
        */
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
          sendframe('!g' + id + this.value)
        }, 200)
        break

      //c checkbox
      case 'c':
        this.HTMLappend(
          '<input id="' +
            elementID +
            '" type="checkbox"' +
            ' onchange=\'sendframe("!g' +
            id +
            '"+this.value?"t":"f")\'' +
            ' style="' +
            data.style +
            '">'
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
            value="${data.value}
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
        var onKey = function (e) {
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
        alert('Moving graph M is deprecated use Graph G')
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

        window.onresize = function () {
          chart.resize()
        }

        this.IDs[id] = {
          element: elem,
          chart,
          max: parseInt(data.value) || 100,
          add: function (d: string) {
            const [max, x, y] = d.split(',').map(Number)

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

          csndata: function (d) {
            this.add(d)
          },
        }
    }
  }
  /*

        //TODO inidizierte Daten?
        c.onupdate = c.plote
        c.maxsize = data.value ? data.value : 1000
        c.plote()

        IDs[id] = (function () {
          return {
            element: elem,
            c: c,
            data: function (d) {
              this.c.attach_data(this.uncsn(d))
            },
            csndata: function (d) {
              this.c.attach_data(d)
            },
          }
        })()


        break
    }
  }
*/

  guiData(x: string) {
    //calls data function of element
    //<element ID><data>
    const elementID = x.substr(0, 2)
    var data = x.substr(2)
    this.IDs[elementID].add(data)
  }

  //may be deprecated
  //transforms comma separated list of Numbers to an array
  //calls csndata function of element (plots)
  //<element ID><CSNdata>
  csnData(x: string) {
    var elementID = x.substr(0, 2)
    var data = x.substr(2)

    this.IDs[elementID].csndata(data.split(',').map(Number))
  }
}
