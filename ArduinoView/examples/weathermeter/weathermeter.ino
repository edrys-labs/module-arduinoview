// Download DHTlib from https://github.com/RobTillaart/Arduino/tree/master/libraries/DHTlib
// and instal to your Arduino libs ~/Arduino/libraries

// DHT 11
// 10 = GND
// 9 = VCC
// 8 =  signal

// This example uses the low-level StringtoFrame and Framereader of
// Frameiterator.h. The page is sent once; every second a frame for the runner
// "wm" (defined with !j) updates the values in place, so the page does not grow.


#include <avr/pgmspace.h>
#include <Frameiterator.h>
#include "Duty.h"
#include <dht.h>
#define OUTPUT__BAUD_RATE 57600

dht DHT;

struct{
    int16_t temp;
    int16_t hum;
}weather;

// the last sensor error, shown in the page (empty: none)
const char * sensorError = "";

#define DHT11_PIN 8

void PowerInit() {
    // setup power GND VCC
    pinMode(10, OUTPUT);
    pinMode(9, OUTPUT);
    digitalWrite(10, 0);
    digitalWrite(9, 1);
}

void ReadDHT() {
    int chk = DHT.read11(DHT11_PIN);
    switch (chk)
    {
        case DHTLIB_OK:
            weather.temp=DHT.temperature;
            weather.hum=DHT.humidity;
            sensorError = "";
            break;
        // shown in the page, not alert(): in Edrys an alert blocks every participant's GUI
        case DHTLIB_ERROR_CHECKSUM:
            sensorError = "checksum error";
            break;
        case DHTLIB_ERROR_TIMEOUT:
            sensorError = "timeout";
            break;
        default:
            sensorError = "error";
            break;
    }
}

void sendFrame(const __FlashStringHelper * str){
    StringtoFrame I = StringtoFrame(str);
    while(!I.end())Serial.write(I.next());
}

void StartpageINIT(){
    sendFrame(F("!h<h1>Temperature: <span id='temp'>-</span> &deg;C, humidity: <span id='hum'>-</span> %</h1>"
                "<p id='err' style='color:#b8384a'></p>"));
    // the runner "wm" takes "<temperature>;<humidity>;<error>"
    sendFrame(F("!jrunner['wm']=function(x){"
                "var v=x.split(';');"
                "document.getElementById('temp').innerText=v[0];"
                "document.getElementById('hum').innerText=v[1];"
                "document.getElementById('err').innerText=v[2]?'Sensor: '+v[2]:'';"
                "};"));
}

void setup() {
    Serial.begin(OUTPUT__BAUD_RATE);
    PowerInit();
    StartpageINIT();
}

void interpreteFrame(char * str, uint16_t length){
    if( length >=2 ){
        uint16_t head= StrInt(str);
        if( head == StrInt("!!")){//reinitialise
            StartpageINIT();
        }
    }
}

Framereader frm_in;
void checkserial(){
    if (Serial.available())                              // wait for SYNC package
    {
        if(frm_in.length()==0)
            frm_in.put(Serial.read());
        if(frm_in.length() != 0){ // frame might be complete after puting char in
            if(frm_in.length() >= 2)
                interpreteFrame(frm_in.frame(),frm_in.length());
            frm_in.clearframe();
        }
    }
}
void loop() {
    static StringtoFrame I;
    checkserial();

    {
        static uint32_t before=0;
        unsigned long now = millis();
        if (now - before > 1000){
            before = now;
            Duty d= Duty(13);
            ReadDHT();
            {
                // one frame "wm<temp>;<hum>;<error>", built from several strings
                I=StringtoFrame(StrInt("wm"),2);
                while(!I.done())Serial.write(I.next());

                char buf[10];
                char * str;

                str = itoa(weather.temp,buf,10);
                I.addString(str);
                while(!I.done())Serial.write(I.next());

                I.addString(F(";"));
                while(!I.done())Serial.write(I.next());

                str = itoa(weather.hum,buf,10);
                I.addString(str);
                while(!I.done())Serial.write(I.next());

                I.addString(F(";"));
                while(!I.done())Serial.write(I.next());

                I.addString(sensorError);
                while(!I.end())Serial.write(I.next());
            }
        }
    }

}
