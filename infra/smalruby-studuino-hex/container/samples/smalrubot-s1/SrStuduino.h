/*
  Library for smalrubot ruby gem.
*/

#ifndef SrStuduino_h
#define SrStuduino_h

#include "Smalrubot.h"
#include "Studuino.h"

class SrStuduino : public Smalrubot {
  public:
    SrStuduino(int neo_pixel_num, int neo_pixel_pin);
    void setupWrite(void (*writeCallback)(char *str));

  protected:
    Studuino studuino;
    byte dcMotorCalibrations[2];
    char servomotorCalibrations[8];

    virtual void processCommand();

    void setDcMotorCalibration();
    void setServomotorCalibration();
    void initDcMotorPort();
    void initServoMotorPort();
    void initSensorPort();

    void dcMotorPower();
    void dcMotorControl();
    void servoMotor();
    void led();

    void getTouchSensorValue();
    void getLightSensorValue();
    void getSoundSensorValue();
    void getIrPhotoreflectorValue();
};


#endif
