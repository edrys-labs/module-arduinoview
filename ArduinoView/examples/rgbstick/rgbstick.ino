//
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

#include <avr/pgmspace.h>
#include <Frameiterator.h>
#include "Duty.h"
#include "Bitreverse.h"
#define OUTPUT__BAUD_RATE 57600


boolean start = false;                                      //wait
//boolean start = true; //why wait ?

const uint8_t SOFk = 0x01;
const uint8_t EOFk = 0x04;
const uint8_t ESCk = 0x1b;

const char startpage[] PROGMEM = "!h"
"<h1 onclick=sendframe('!bc')>Click Me</h1>";


const char initpage[] PROGMEM = "!h"
"<input type='button' value='click' onclick=sendframe('!bc')><input type='range' min=0 max=255 onchange=sendframe('!r'+this.value)> <br>\n"
"<textarea id='msg' style='width:100%'> </textarea><br>\n"
"<svg width='100%' height='90%' viewBox='-600 -600 1200 1200'>\n"
"<line id='pxy' x1='0' y1='0' x2='10' y2='10' style='stroke:rgb(255,0,0);stroke-width:2' />\n"
"</svg>\n";

const char initfun_p[] PROGMEM = "!j"
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
"runner[17]=messagedecode;\n";


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
    const int interval =300; //3kHz
    const int max =127;

    unsigned long currentMillis =micros();
    if(currentMillis - previousMillis > interval) {
        Duty d = Duty(13);
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

uint8_t clip8 (uint16_t v){ return  0xff<v?0xff:v;}


//http://stackoverflow.com/questions/3018313/algorithm-to-convert-rgb-to-hsv-and-hsv-to-rgb-in-range-0-255-for-both
//hsv conversion color by color
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


void StartpageINIT(){
    start = false;
    StringtoFrame I;
    I = StringtoFrame(startpage, "");
    while(!I.end())Serial.write(I.next());

    I = StringtoFrame("!jalert(\"click on the Heading\")");
    while(!I.end())Serial.write(I.next());
}

void PageINIT(){
    StringtoFrame I;
    if(0){
    Serial.write(SOFk);
    {
        int len = strlen_P(initpage);
        for (int k = 0; k < len; k++)
        {
            uint8_t myChar =  pgm_read_byte_near(initpage + k);
            Serial.write(myChar);
        }
    }
    Serial.write(EOFk);
    }

    I = StringtoFrame(initpage, "");
    while(!I.end())Serial.write(I.next());

    I = StringtoFrame(initfun_p, "");
    while(!I.end())Serial.write(I.next());

}

void setup() {
    // put your setup code here, to run once:
    Serial.begin(OUTPUT__BAUD_RATE);
    JoystickInit();
    RGBInit();
    StartpageINIT();
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

Framereader frm_in=Framereader();

#define charint( MSb, LSb ) (uint16_t) ((MSb << 8) + LSb)

void interpreteFrame(char * str, uint16_t length){
    if( length >=2 ){
        uint16_t head= charint(str[0],str[1]);
        if( head == charint('!','!')) //reinitialise
            StartpageINIT();
        if( head == charint('!','b') && str[2] == 'c'){
            PageINIT();
            start = true;
        }
        if( head == charint('!','r') )
            hsv_v=(uint8_t)strtol(&str[2],0,10);
    }
}

void checkSerial(){
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
    runRGB();

    checkSerial();

    if (start == true){
        {
            //Duty d= Duty(13);
//             runRGB();
        }
        static uint32_t before=0;
        unsigned long now = millis();
        if (now - before > 100){
            //             Duty d= Duty(13);
            before = now;
            ReadJoystick();

            int x = (((long) (joy.x - (joymax.x + joymin.x ) / 2)) << 9) / (joymax.x - joymin.x );
            int y = (((long) (joy.y - (joymax.y + joymin.y ) / 2)) << 9) / (joymax.y - joymin.y );

            if(0){
                Serial.write(SOFk);
           Serial.write("17");
            write16HEX(x);
            write16HEX(y);
            write16HEX(red);
            write16HEX(green);
            write16HEX(blue);
            Serial.write(EOFk);
            }

            {
              I=StringtoFrame("17");
                while(!I.done())Serial.write(I.next());

                char * str = "    ";

                int16HEX(str,x);
                I.addString(str ,4);
                while(!I.done())Serial.write(I.next());

                int16HEX(str,y);
                I.addString(str ,4);
                while(!I.done())Serial.write(I.next());

                int16HEX(str,red);
                I.addString(str ,4);
                while(!I.done())Serial.write(I.next());

                int16HEX(str,green);
                I.addString(str ,4);
                while(!I.done())Serial.write(I.next());

                int16HEX(str,blue);
                I.addString(str ,4);
              while(!I.end())Serial.write(I.next());
            }
            //setRGB((x + 256) / 8 , (y + 256) / 8, 0);
            //color ^= green:0  blue0xff/3  red = 2*0xff/3
            x = (x + 256) >> 1;
            y = 255 - clip8((((y + 256) >> 2)*((y + 256) >> 1))>>7);// make y (saturation somewhat quadratic)
            setRGB(
                color(x,y,hsv_v, 2*(0xff/3) )>>1,
                color(x,y,hsv_v, 0          )>>2,
                color(x,y,hsv_v, 0xff / 3   )>>2 );
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
    if(0) {
        static uint32_t before = 0;
        unsigned long now = millis();
        if (now - before > 1000){
            before = now;
            static uint8_t i = 0;
            i = 0;
            digitalWrite(4,i==1);
            digitalWrite(3,i==2);
            digitalWrite(5,i==3);
            i++;
            if (i > 4) i = 0;


        }
    }
}

