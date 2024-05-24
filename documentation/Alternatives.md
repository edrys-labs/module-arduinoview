## Alternatives

There are already many ways to provide a user interface for an Arduino project this chapter will name some of them.

### Processing

    https://processing.org/
    https://github.com/processing

Processing is a programming language and framework based on JAVA to create visual Applications. Its the base for the Arduino IDE and due this there are
tutorials, examples and libraries available that help combining Processing and Arduino. When using processing the User writes basically two Programms and has
to maintain their compatibility. One possibility to achieve this is by using a Firmata-firmware on the Arduino and using a matching Firmata library in
processing.

### Firmata

    http://www.firmata.org/
    https://github.com/firmata

Firmata is a protocol based on the midi message format. It has a huge set of predefined functions to control various I/O of a micro-controller like digital
and analog pins, I2C- and OneWire-bus, servos and other motors  which are implemented in firmata Arduino firmware. The protocol is designed to be
expandable by the user. The PC controls the Arduino, which is supported by libraries for various programming languages and frameworks like processing,
python, perl, ruby, JavaScript, Java ... .

    http://www.acraigie.com/programming/firmatavb/sample_applications.html

### Instrumentino

    http://www.chemie.unibas.ch/~hauser/open-source-lab/instrumentino/index.html
    https://github.com/yoelk/instrumentino
    https://github.com/yoelk/controlino

Graphical User Interface for Arduino based experimental instruments based on Python. The user of Instrumentino describes the experiment components in
description files in python. These components utilize the Arduino witch runs a firmware to interface to sensors and actors. The controlino firmware (part of
Instrumentino) provides access to various interfaces of the Arduino like analog and digital inputs digital and PWM outputs, i2c and it contains an
PID-regulator. The PC controls the Arduino and runs the experiment.

### Guino

    https://github.com/madshobye/guino
    http://www.instructables.com/id/Guino-Dashboard-for-your-Arduino/

A Dashboard for Arduino based on openframeworks (c++ framework with similar targets as Processing has for Java). A Guino GUI will be programmed into the
Arduino sketch and it will be transferred to the Guino running PC where the Guino software will interpret it into a GUI. This concept is the most similar
one to Arduinoview. Guino provides a subset of openframeworks GUI elements.

### Viewduino

    http://teachduino.ufsc.br/

Viewer and graphical plotter for semicolon separated values transferred via serial interface from the Arduino.

### Arduviz and Appbuilder

    https://github.com/hharzer/appbuilder2-pkes
    https://github.com/hharzer/arduviz1.2-pkes

The "Arduviz and Appbuilder" project was developed at the same place as Arduinoview with similar goals. It is similar to Guino and Arduinoview in that
the Arduino carry's its GUI which runs inside a parser on the PC. Arduviz uses Python and Kivy and provides the user with a subset of its widgets.

### Arduinoview

with this Project Arduinoview is available. Like Guino and Arduviz the GUI is stored inside the Arduino Program. Unlike both it tries to avoid to develop its
own description language, instead it makes the most know markup language HTML and it companion JavaScript available to the Programmer of the UI.

