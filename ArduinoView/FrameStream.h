#pragma once
#include <Stream.h>
#include <Frameiterator.h>

#define INNERCAT(x, y) x##y
#define CAT(x, y) INNERCAT(x, y)

#define declarerunnerlist(NAME) void NAME##runnerlist(char *frm, size_t len)

#define beginrunnerlist(NAME)                    \
    void NAME##runnerlist(char *frm, size_t len) \
    {                                            \
        if (len < 2)                             \
            return;                              \
        uint16_t head = (frm[0] << 8) | (frm[1]);
#define runner(ID, runner_function) idrunner(ID, runner_function)
#define idrunner(ID, runner_function)                        \
    uint16_t CAT(fnhead, __LINE__) = (#ID[0] << 8) + #ID[1]; \
    if (CAT(fnhead, __LINE__) == head)                       \
    runner_function(frm, len)
#define fwdrunner(ID, runner_function)                       \
    uint16_t CAT(fnhead, __LINE__) = (#ID[0] << 8) + #ID[1]; \
    if (CAT(fnhead, __LINE__) == head)                       \
    runner_function(&frm[2], (len - 2))
#define callrunner(ID, runner_function)                      \
    uint16_t CAT(fnhead, __LINE__) = (#ID[0] << 8) + #ID[1]; \
    if (CAT(fnhead, __LINE__) == head)                       \
    runner_function()
#define endrunnerlist() }

// A runnerlist is a function namen NAMErunnerlist that calls other functions depending on first two bytes of the input frame
//
// declarerunnerlist(GUI)       // declares a runner list tha will be defined later
//
// beginrunnerlist();
// begin a unamend runnerlist (default runnerlist) used by FrameRun::run()
// callrunner(!!,gui_init);
// call a function with signature void fn (char * str, size_t length) str will point to the begin of input, length is the length the input
// fwdrunner(!g,GUIrunnerlist);
// call a function with signature void fn (char * str, size_t length) str will point behind the runner-ID of input, is the rest length of input afer removing runner-ID
// use this to call runnerlists
// runner(BB,test);
// call a function with signature void fn (void);
// endrunnerlist();
// end the runnerlist
//
// beginrunnerlist(GUI);
// begin a runnerlist namend "GUIrunnerlist"
// endrunnerlist();

// declarerunnerlist(GUI)
//
// beginrunnerlist();
// callrunner(!!,gui_init);
// fwdrunner(!g,GUIrunnerlist);
// runner(BB,test);
// endrunnerlist();
//
// beginrunnerlist(GUI);
// endrunnerlist();

void runnerlist(char *frm, size_t len);

// provides the Print part of a Arduiono Stream
struct FramePrint : public Print
{
    StringtoFrame framer;
    Stream &ser; // expect Serial interface
    FramePrint(Stream &serial) : ser(serial)
    {
    }

    // this is part of the Arduiono Stream interface it puts one byte into the frame
    size_t write(uint8_t c)
    {
        if (framer.addString((char)c, 1))
        {
            while (!framer.done())
            {
                ser.write(framer.next());
            }
            return 1;
        }
        else
            return 0;
    }

    // this is part of the Arduiono Stream interface it puts size bytes into the frame
    size_t write(const uint8_t *buffer, size_t size)
    {
        if (framer.addString((const char *)buffer, size))
        {
            while (!framer.done())
            {
                ser.write(framer.next());
            }
            return size;
        }
        else
            return 0;
    }

    // end the current Frame (this is not part of Arduiono Stream and must be called to finish the rame
    void end()
    {
        while (!framer.end())
            ser.write(framer.next());
    }
};

// provides the Runner concept and Arduino Stream
struct FrameStream : public FramePrint
{
    Framereader deframer;
    FrameStream(Stream &serial) : FramePrint(serial)
    {
    }

    // run this to get chars and process finnished Frames using the runnerlist
    bool run()
    {
        if (ser.available())
        { // wait for SYNC package
            if (deframer.length() == 0)
                deframer.put(ser.read());
            if (deframer.length() != 0)
            { // frame might be complete after puting char in
                if (deframer.length() >= 2)
                    runnerlist(deframer.frame(), deframer.length());
                deframer.clearframe();
            }
        }
        return ser.available();
    }

    //  these would be need to complete the Stream interface
    //  int available();
    //  int read();
    //  int peek();
    //  void flush();
};

// provides the Runner concept
struct FrameRun
{
    Framereader deframer;
    Stream &ser;
    FrameRun(Stream &serial) : ser(serial)
    {
    }

    // run this to get chars and process finnished Frames using the runnerlist
    bool run()
    {
        if (ser.available())
        { // wait for SYNC package
            if (deframer.length() == 0)
                deframer.put(ser.read());
            if (deframer.length() != 0)
            { // frame might be complete after puting char in
                if (deframer.length() >= 2)
                    runnerlist(deframer.frame(), deframer.length());
                deframer.clearframe();
            }
        }
        return ser.available();
    }
};
