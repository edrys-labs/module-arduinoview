function fwd() {
  var text = document.getElementById('text')
  var tmp = text.value
  tmp = tmp.replace(/\\/gm, '\\\\')
  tmp = tmp.replace(/"/gm, '\\"')
  tmp = tmp.replace(/^\s*/gm, '"')
  tmp = tmp.replace(/\s*$/gm, '\\n"')
  text.value = tmp
}
function rwd() {
  var text = document.getElementById('text')
  var tmp = text.value
  tmp = tmp.replace(/\\\\/gm, '\\')
  tmp = tmp.replace(/\\"/gm, '"')
  tmp = tmp.replace(/^\s*\"/gm, '')
  tmp = tmp.replace(/(\\n\"$|\"$)/gm, '')
  text.value = tmp
}
document.getElementById('fwdbtn').onclick = fwd
document.getElementById('rwdbtn').onclick = rwd
