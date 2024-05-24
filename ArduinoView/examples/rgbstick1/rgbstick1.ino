// This rgbstick example uses FrameStream


// Joystick
//A1 = gnd
//A2 = vcc
//A3 = X
//A4 = Y
//A5 = sw

// RGB
// 2 = GND
// 3 = G
// 4 = R
// 5 = B

// RGB
// 2 = GND
// 3 = B
// 4 = G
// 5 = R

#define   RED_LED 5
#define GREEN_LED 4
#define  BLUE_LED 3

#include "Duty.h"
#include <avr/pgmspace.h>
#include <FrameStream.h>
#include "Bitreverse.h"
#define OUTPUT__BAUD_RATE 57600


boolean start = false;   //wait
//boolean start = true;  //why wait ?

struct Sensor {
    int x, y;
};

Sensor joy, joymin, joymax;

void JoystickInit() {
    // setup power GND VCC
    pinMode(A1, OUTPUT);
    pinMode(A2, OUTPUT);
    digitalWrite(A1, 0);
    digitalWrite(A2, 1);
    // Analog in
    pinMode(A3, INPUT);
    pinMode(A4, INPUT);
    pinMode(A5, INPUT);

    joymin.x = joymin.y = 0x7fff;
    joymax.x = joymax.y = 0;
}

void RGBInit() {
    // RGB
    pinMode(2, OUTPUT);
    digitalWrite(2,0);//GND
    pinMode(RED_LED, OUTPUT);
    pinMode(GREEN_LED, OUTPUT);
    pinMode(BLUE_LED, OUTPUT);
    pinMode(13, OUTPUT);
}

void ReadJoystick() {
    joy.x = analogRead(A3);
    joy.y = analogRead(A4);
    if (joy.x < joymin.x) {
        joymin.x = joy.x;
    }
    if (joy.y < joymin.y) {
        joymin.y = joy.y;
    }
    if (joy.x > joymax.x) {
        joymax.x = joy.x;
    }
    if (joy.y > joymax.y) {
        joymax.y = joy.y;
    }
}

uint8_t red;
uint8_t green;
uint8_t blue;

uint8_t hsv_v=0xff;

void setRGB(uint8_t r, uint8_t g, uint8_t b) {
    red = r;
    green = g;
    blue = b;
}


void runRGB() {
    static uint32_t previousMillis = 0;
    static uint8_t i = 0;
    const int interval =150; //6kHz
    const int max =127;

    unsigned long currentMillis =micros();
    if(currentMillis - previousMillis > interval) {
        previousMillis = currentMillis;
        if (1) {
            // dither all 7 bits
            // WTF Why ?  less runs
            uint8_t rnd = brev8(i << 1);
            // R
            digitalWrite(RED_LED, red > rnd);
            // G
            digitalWrite(GREEN_LED, green > rnd);
            // B
            digitalWrite(BLUE_LED, blue > rnd);

        }
        i++;
        if( i > max) i = 0;
    }
}


//http://stackoverflow.com/questions/3018313/algorithm-to-convert-rgb-to-hsv-and-hsv-to-rgb-in-range-0-255-for-both
//hsv conversion color by color

uint8_t clip8 (uint16_t v){ return  0xff<v?0xff:v;}
uint8_t color(uint8_t H,uint8_t S,uint8_t V, uint8_t C){
    //color ^= green:0  blue:0xff/3  red = 2*0xff/3
    H = H - C; //this must not be clipping
    if( H >= 0xff/6*1 && H < 0xff/6*3+1 ) return V;
    if( H >= 0xff/6*4 && H < 0xff/6*6+1 ) return clip8((((uint16_t) V << 8) - (((uint16_t) V) * S) ) >> 8) ;
    if( H >= 0xff/6*0 && H < 0xff/6*1+1 )
    {
        //return clip8((((uint16_t) V << 8) - (((uint16_t) V)*(((uint16_t)S << 8) - (uint16_t)S*H) >>8 ))>>8);
        uint16_t v = V;
        uint16_t s = S;
        uint16_t h = H;
        const uint8_t region = 0;
        return ((v<<8) - v * (((s << 8) - s * (h - region) * 6 ) >> 8)) >> 8;
    }
    if( H >= 0xff/6*3 && H < 0xff/6*4+1 ){
        //return clip8((((uint16_t) V << 8) - ((uint16_t) V)*((uint16_t)S*(H - 0xff/2 )))>>8);
        uint16_t v = V;
        uint16_t s = S;
        uint16_t h = H;
        const uint8_t region = 0xff/2;
        return ((v<<8) - v * ((s * (h - region)* 6) >> 8)) >> 8;
    }
    //failback
    return clip8((((uint16_t) V << 8) - (((uint16_t) V) * S) ) >> 8) ;
}

FrameStream frm(Serial);

void StartpageINIT(char* str,size_t length){
    start = false;
    const __FlashStringHelper * startpage = F("!h<h1 onclick=sendframe('!bc')>Click Me</h1>");
    frm.print(startpage);
    frm.end();

    frm.print(F("!jalert(\"click on the Heading\")"));
    frm.end();
}

void PageINIT(char* str,size_t length){
    const __FlashStringHelper * initpage = F("!h"
    "<input type='button' value='click' onclick=sendframe('!bc')><input type='range' min=0 max=255 onchange=sendframe('!r'+this.value)> <br>\n"
    "<textarea id='msg' style='width:100%'> </textarea><br>\n"
    "<svg width='100%' height='90%' viewBox='-600 -600 1200 1200'>\n"
    "<line id='pxy' x1='0' y1='0' x2='10' y2='10' style='stroke:rgb(255,0,0);stroke-width:2' />\n"
    "</svg>\n");

    const __FlashStringHelper * initfun_p = F("!j"
    "function messagedecode(msg){\n"
    "var intfromhex = function(hex){\n"
    "var ret = parseInt('0x'+hex);\n"
    "if (ret > 0x7fff) ret -= 0xffff;\n"
    "return ret;};\n"
    "var getEl=function(x){return document.getElementById(x)};\n"
    "var setEl=function(el,attr,val){(el).setAttributeNS(null,attr,val)};\n"
    "var x=intfromhex(msg.substring(0,4));\n"
    "var y=intfromhex(msg.substring(4,8));\n"
    "var r=intfromhex(msg.substring(8,12));\n"
    "var g=intfromhex(msg.substring(12,16));\n"
    "var b=intfromhex(msg.substring(16,24));\n"
    "pxy=getEl('pxy');\n"
    "setEl(pxy,'x2',x);\n"
    "setEl(pxy,'y2',y);\n"
    "getEl('msg').value=(''+x+','+y+','+ Math.round(Math.sqrt(x*x+y*y))+'('+ r +','+ g +','+ b +')');\n"
    "}\n"
    "runner[17]=messagedecode;\n");

    //if( length >= 3 && str[2]=='c'){
        frm.print(initpage);
        frm.end();

        frm.print(initfun_p);
        frm.end();
    //}
        start = true;
}

void setup() {
    // put your setup code here, to run once:
    Serial.begin(OUTPUT__BAUD_RATE);
    JoystickInit();
    RGBInit();
    StartpageINIT("",0);
    //PageINIT();
}

const char toHEX[]="0123456789ABCDEF";

void write16HEX(int16_t val){
    Serial.write(toHEX[0x000f & val >> 12]);
    Serial.write(toHEX[0x000f & val >> 8]);
    Serial.write(toHEX[0x000f & val >> 4]);
    Serial.write(toHEX[0x000f & val >> 0]);
}


void int16HEX(char*str, int16_t val){

    str[0] = toHEX[0x000f & val >> 12];
    str[1] = toHEX[0x000f & val >> 8];
    str[2] = toHEX[0x000f & val >> 4];
    str[3] = toHEX[0x000f & val >> 0];

}

void setv(char* str,size_t length){
    if(length > 2)
        hsv_v=(uint8_t)strtol(&str[2],0,10);
}

beginrunnerlist();
runner(!!,StartpageINIT);
runner(!b,PageINIT);
runner(!r,setv);
endrunnerlist();

void loop() {
    {
        Duty d= Duty(13);
        runRGB();
    }
    frm.run();
    if (start == true){
        {
            //Duty d= Duty(13);
//             runRGB();
        }
        unsigned long now = millis();
        {
            static uint32_t before=0;
            if (now - before > 100){
                //             Duty d= Duty(13);
                before = now;
                ReadJoystick();

                int x = (((long) (joy.x - (joymax.x + joymin.x ) / 2)) << 9) / (joymax.x - joymin.x );
                int y = (((long) (joy.y - (joymax.y + joymin.y ) / 2)) << 9) / (joymax.y - joymin.y );

                frm.print("17");
                char * str = "    ";
                int16HEX(str,x);
                frm.print(str);
                //             frm.print(x,HEX);
                int16HEX(str,y);
                frm.print(str);
                //             frm.print(y,HEX);
                int16HEX(str,red);
                frm.print(str);
                //             frm.print(red,HEX);
                int16HEX(str,green);
                frm.print(str);
                //             frm.print(green,HEX);
                int16HEX(str,blue);
                frm.print(str);
                //             frm.print(blue,HEX);
                frm.end();

                //setRGB((x + 256) / 8 , (y + 256) / 8, 0);
                //color ^= green:0  blue0xff/3  red = 2*0xff/3
                x = (x + 256) >> 1;
                y = 255 - clip8((((y + 256) >> 2)*((y + 256) >> 1))>>7);// make y (saturation somewhat quadratic)
                setRGB(color(x,y,hsv_v, 2*(0xff/3) )>>1,
                       color(x,y,hsv_v, 0          )>>2,
                       color(x,y,hsv_v, 0xff / 3   )>>2 );
            }
        }
        {
            static uint32_t before=50;
            if (now - before > 3000){
                before = now;
                frm.print(F("!jalert(\" i counted to "));
                frm.print(now);
                frm.print(F("\");"));
                frm.end();
            }
        }
    }else{
        static uint32_t before = 0;
        unsigned long now = millis();
        if (now - before > 20){
            before = now;
            //static uint8_t h=0;
            //h++;
            uint8_t h = 0xff & (now >> 6);

            uint8_t s = 0xf0;
            setRGB(
                color(h,s,0xff, 2*(0xff/3) )>>1,
                color(h,s,0xff, 0          )>>2,
                color(h,s,0xff, 0xff / 3   )>>2 );
        }


    }
}

