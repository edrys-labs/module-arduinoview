// -----------------------------------------------------------------
// Examples of the ArduinoView Library
// 04. JSTable
// -----------------------------------------------------------------
// This file demonstrates the basic use of the library by generating
// a Table based on HTML
// filling it using JavaScript
// creating a specific runner.

#include <FrameStream.h>
#include <Frameiterator.h>

#define OUTPUT__BAUD_RATE 57600
FrameStream frm(Serial);

// Hiracical runner list, that connects the gui elements with
// callback methods
// First level
beginrunnerlist();
callrunner(!!, InitGUI);
endrunnerlist();


int  val_A1 = 0;
int  val_A2 = 0;
long val_A3 = 0;

void update_vals(){
    // Update Values
    val_A1++;
    val_A2+=2;
    val_A3=millis();
}

void InitGUI(){
    //initilize Page HTML
    frm.print(F("!h<h1>ArduinoView</h1> <h2>Demo 10 - JSTable </h2>"));
    frm.print(F("<table><tr><th>Pin</th><th>Value</th></tr>"
    "<tr><td>A1</td><td id='T1'></td></tr>"
    "<tr><td>A2</td><td id='T2'></td></tr>"
    "<tr><td>A3</td><td id='T3'></td></tr>"
    "</table>"));
    frm.end();

    //initilize Page Javascript
    //add runner "vt" that seperates string x by ";" and
    //puts its values into the Table
    frm.print(F("!j"));
    frm.print(F("runner['vt']=function(x){\n"
    "var vals = x.split(\";\")\n"
    "document.getElementById(\"T1\").innerText=vals[0]\n"
    "document.getElementById(\"T2\").innerText=vals[1]\n"
    "document.getElementById(\"T3\").innerText=vals[2]\n"
    "}\n"));
    frm.end();
}


void setup() {
    Serial.begin(OUTPUT__BAUD_RATE);

    //reload sandbox and give some time to the browser
    frm.print(F("!!"));
    frm.end();
    delay(500);

}

void loop() {
    while(frm.run());
    {
        static uint32_t before=0;
        unsigned long now = millis();
        if (now - before >= 100){
            before = now;

            update_vals();
            //create a frame that contains ; seperated values
            //adressing the vt runner
            frm.print(F("vt"));
            frm.print(val_A1);
            frm.print(";");
            frm.print(val_A2);
            frm.print(";");
            frm.print(val_A3);
            frm.print(";");
            frm.end();
        }
    }
}
