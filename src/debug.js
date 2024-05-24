logarray = Array(10)

function logdisplay(s) {
  for (i = 9; i >= 0; i--) {
    logarray[i + 1] = logarray[i]
  }
  logarray[0] = s
  showlogarray()
}

function showlogarray() {
  var s = ''
  for (i in logarray) {
    if (logarray[i]) s += logarray[i] + '\n'
  }
  document.getElementById('Loggout').value = s
}
