// Download DHTlib from https://github.com/RobTillaart/Arduino/tree/master/libraries/DHTlib
// and instal to your Arduino libs ~/Arduino/libraries

// DHT 11
// 10 = GND
// 9 = VCC
// 8 =  signal


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

#define DHT11_PIN 8

void PowerInit() {
    // setup power GND VCC
    pinMode(10, OUTPUT);
    pinMode(9, OUTPUT);
    digitalWrite(10, 0);
    digitalWrite(9, 1);
}

void ReadDHT() {
    static StringtoFrame I;
    int chk = DHT.read11(DHT11_PIN);
    switch (chk)
    {
        case DHTLIB_OK:
            weather.temp=DHT.temperature;
            weather.hum=DHT.humidity;
            break;
        case DHTLIB_ERROR_CHECKSUM:
            I=StringtoFrame("!jalert('cksum error')");
            while(!I.end())Serial.write(I.next());
            break;
        case DHTLIB_ERROR_TIMEOUT:
            I=StringtoFrame("!jalert('time error')");
            while(!I.end())Serial.write(I.next());
            break;
        default:
            I=StringtoFrame("!jalert('error')");
            while(!I.end())Serial.write(I.next());
            break;
    }
}

void StartpageINIT(){
    StringtoFrame I;
    I = StringtoFrame(StrInt("!h"),2);//empty gui
    while(!I.end())Serial.write(I.next());
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
                //Test of different Strings
                I=StringtoFrame(StrInt("!H"),2);
                //I=StringtoFrame(F("!H"));
                // I=StringtoFrame("!H");
                while(!I.done())Serial.write(I.next());

                char buf[10];
                char * str;

                I.addString(F("<h1> Temperatur: "));
                while(!I.done())Serial.write(I.next());

                str = itoa(weather.temp,buf,10);
                I.addString(str);
                while(!I.done())Serial.write(I.next());

                I.addString(F(" Feuchte: "));
                while(!I.done())Serial.write(I.next());


                str = itoa(weather.hum,buf,10);
                I.addString(str);
                while(!I.done())Serial.write(I.next());

                I.addString(F("</h1>"));
                while(!I.end())Serial.write(I.next());
            }
        }
    }

}

