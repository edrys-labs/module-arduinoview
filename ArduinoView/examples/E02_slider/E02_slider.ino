// -----------------------------------------------------------------
// Examples of the ArduinoView Library
// 2. Slider
// -----------------------------------------------------------------
// This example illustrates the application of slider values on a
// PWM configuration. The slider controls the lightness of the LED
// connected to Pin 13.
// The slider values is recived within the callback method.

#include <FrameStream.h>
#include <Frameiterator.h>

#define OUTPUT__BAUD_RATE 57600
FrameStream frm(Serial);

declarerunnerlist(GUI);
// Hierarchical runner list
beginrunnerlist();
  fwdrunner(!g, GUIrunnerlist); //Reference to the second level (GUI)
  callrunner(!!, InitGUI);
endrunnerlist();
// Second level
beginrunnerlist(GUI);
  fwdrunner(VA, sliderCallback);
endrunnerlist();

int value = 0;
int ledPin = 13;      // LED connected to digital pin 9

void sliderCallback(char * str, size_t length){
  // "Transformation to the time domain (0-25 ms)"
  value = atoi(str);
  value = (float) value / 10;
}

void InitGUI(){
  frm.print("!h<h1>ArduinoView</h1> <h2>Demo 2 - Slider </h2>");
  frm.print("<p>Move the slider to control the fading level of LED 13!</p>");
  frm.end();
  // Generation of the button
  // !S<E><ID><DATA>
  // Start      Element     ID         v=Value
  // indicator  s=Slider    [2 char]   initial value
  // !S         s           VA         v255
  frm.print("!SsVA");
  frm.end();
}

void setup() {
  Serial.begin(OUTPUT__BAUD_RATE);
  pinMode(ledPin, OUTPUT);

  //request reset of gui
  frm.print("!!");
  frm.end();

  delay(500);
}

int cycleTime = 30;             // the total duration of a PWM cycle

void loop() {
  frm.run();
  // simulated PWM for fading the LED
  digitalWrite(ledPin, HIGH); // sets the LED on
  delay(value);               // wait for value milliseconds
  digitalWrite(ledPin, LOW);  // sets the LED off
  delay(cycleTime - value);   // waitfor the rest of the complete cycle
}
