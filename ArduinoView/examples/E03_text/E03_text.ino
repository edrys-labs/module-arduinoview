// -----------------------------------------------------------------
// Examples of the ArduinoView Library
// 3. Slider and Text
// -----------------------------------------------------------------
// This example illustrates the combined use of slider and text
// inputs. User inputs are maped on a small display.

#include <LiquidCrystal.h>
#include <FrameStream.h>
#include <Frameiterator.h>

#define OUTPUT__BAUD_RATE 57600
FrameStream frm(Serial);

declarerunnerlist(GUI);
// Hiracical runner list, that connects the gui elements with
beginrunnerlist();
  fwdrunner(!g, GUIrunnerlist); //Reference to the second level (GUI)
  callrunner(!!,InitGUI);
endrunnerlist();
// Second level
beginrunnerlist(GUI);
  fwdrunner(VA, sliderCallback);
  fwdrunner(TE, textCallback);
endrunnerlist();

int ledPin = 13;      // LED connected to digital pin 9

// Power Pins
// VSS      GND
// VDD      5V
// V0       potentiometer or PWM Pin
// A        3.3V or with resitor to 5V or to PWM Pin
// K        GND

// Data Pins
// RW       GND
// RS       Pin 8
// EN       9
// D4 - D7  4-7

//LiquidCrystal(rs, enable, d4, d5, d6, d7)
LiquidCrystal lcd(8, 9, 4, 5, 6, 7);

void textCallback(char * str, size_t length){
  lcd.setCursor(0, 0);
  lcd.print("                ");
  lcd.setCursor(0, 0);
  lcd.print(str);
}

void sliderCallback(char * str, size_t length){
  //PWMPin 11 for V0 (contrast pin)
  //analogWrite(11,atoi(str));
  lcd.setCursor(0, 1);
  lcd.print("                ");
  lcd.setCursor(0, 1);
  lcd.print(str);
}

void InitGUI(){
  frm.print("!h<h1>ArduinoView</h1> <h2>Demo 3 - Text input </h2>");
  frm.print("<p>Now you have to HMIs to control the uc! ");
  frm.print("The content of the text field and the slider are mapped on ");
  frm.print("the LCD.</p>");
  frm.end();
  // Generation of the button
  // !S<E><ID><DATA>
  // Start      Element     ID         v=Value
  // indicator  s=Slider    [2 char]   initial value
  // !S         s           VA         v255
  frm.print("!SsVAw19%");
  frm.end();
  frm.print("!StTEw49%");
  frm.end();
}

void setup() {
  lcd.begin(16, 2);
  lcd.clear();
  lcd.setCursor(0, 0);

  Serial.begin(OUTPUT__BAUD_RATE);
  pinMode(ledPin, OUTPUT);

  //request reset of gui
  frm.print("!!");
  frm.end();

  delay(500);
}

void loop() {
  frm.run();
}
