// -----------------------------------------------------------------
// Examples of the ArduinoView Library
// 5. graph
// -----------------------------------------------------------------
// This Example demostrates the creation of a graph and pushes Data into it


#include <LiquidCrystal.h>
#include <FrameStream.h>
#include <Frameiterator.h>

#define OUTPUT__BAUD_RATE 57600
FrameStream frm(Serial);

// runner list just for the Initialisation
beginrunnerlist();
  callrunner(!!,InitGUI);
endrunnerlist();


void InitGUI(){
  frm.print("!h<h1>ArduinoView</h1> <h2>Demo 4 - Graph </h2>");
  frm.print("<p>");
  frm.print("</p>");
  frm.end();
  // Generation of the Graph
  // !S<E><ID><DATA>
  // Start      Element     ID         v=Value
  // indicator  G=Graph   [2 char]   max number of elements
  // !S         G           gr         v50
  frm.print("!SGgrv50");
  frm.end();
}

void setup() {
  Serial.begin(OUTPUT__BAUD_RATE);

  //request reset of gui
  frm.print("!!");
  frm.end();

  delay(500);
}

void loop() {
  while(frm.run());
  // prepare a upcounting value i
  static int i = 0;
  ++i;
  if (i >= 200) i=0;
  // send data to Graph gr first value 100
  // second value upcounting i
  // third  value demostartes the useability of float
  frm.print("!dgr100,");
  frm.print(i);
  frm.print(",");
  frm.print(100.0/(float(i+5)/10));
  frm.end();
  // wait 200ms
  delay(200);
}
