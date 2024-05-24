# module-arduinoview

This module allows to run "websites" on an Arduino that communicate via WebSerial and can be used to control the Arduino, display measurements, etc.




## Arduino

This module is based on the implementation of Karl Fessel from:

https://github.com/kfessel/Arduinoview

It was modified to be used with the WebSerial API and in combination with Edrys, and for the graph plotting we had used the more modern eCharts library. His introduction and goals are as follows:

> Arduino is a micro-controller platform for education, prototyping and one of a kind projects like they often happen in arts, science and development, it is well known, taught to and learned by beginners, students, designers, scientists and professionals. Arduino has a huge community of amateurs and professionals that develop hard- and software around the platform which has already many sensors, actors, shields and other hardware and driver libraries available to it. Arduinoview will provide a way to provide a graphical user interface with an Arduino project by using the USB-serial interface of the Arduino and an interpreter running inside a web browser.
>
> __Goals__
>
> The goal of the project is to develop an simple framework to combine Arduino and a graphical user interface that will be displayed on a PC.

### Installation

To compile Arduino code, you need to install the [Arduino IDE](https://www.arduino.cc/en/software).
Then you need to copy the ArduinoView folder to the Arduino libraries folder. On Windows, this is usually `C:\Users\<username>\Documents\Arduino\libraries`.
This folder contains the ArduinoView library and the example sketches.

### Documentation

For more information, see the original [documentation](documentation/Dodumentation.md).