// creating a seperate .js -File may help you to write JavaScript
// utilising syntax highlighting

runner['vt']=function(x){
    var vals = x.split(";")
    document.getElementById("T1").innerText=vals[0]
    document.getElementById("T2").innerText=vals[1]
    document.getElementById("T3").innerText=vals[2]
}
