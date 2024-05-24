#include "Arduino.h"

class Duty{
  uint8_t signal;
  public:
  Duty(uint8_t signal){
    this->signal=signal;
    digitalWrite(signal, 1);
  }
  ~Duty(){
    digitalWrite(signal, 0);
  }
  
};
