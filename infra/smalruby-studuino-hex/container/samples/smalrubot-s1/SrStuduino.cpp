#include "SrStuduino.h"

typedef Smalrubot base;

SrStuduino::SrStuduino(int neo_pixel_num, int neo_pixel_pin) :
  Smalrubot(neo_pixel_num, neo_pixel_pin),
  dcMotorCalibrations{ 100, 100 },
  servomotorCalibrations{ 0, 0, 0, 0, 0, 0, 0, 0 }
{
  boardName[0] = 'S';
  boardName[1] = '1';
  boardName[2] = '\0';
}

void SrStuduino::setupWrite(void (*writeCallback)(char *str)) {
  // Must not call pixels.begin(), if use servo motor.
  _writeCallback = writeCallback;
}

/*
 * 20-39: Initialize
 * 40-59: Actuatuator
 * 60-79: Sensor
 **/
void SrStuduino::processCommand() {
  switch(cmd) {
  case 20:
    setDcMotorCalibration();
    break;
  case 21:
    setServomotorCalibration();
    break;
  case 22:
    initDcMotorPort();
    break;
  case 23:
    initServoMotorPort();
    break;
  case 25:
    initSensorPort();
    break;

  case 42:
    dcMotorPower();
    break;
  case 43:
    dcMotorControl();
    break;
  case 44:
    servoMotor();
    break;

  case 51:
    led();
    break;

  case 61:
    getTouchSensorValue();
    break;
  case 62:
    getLightSensorValue();
    break;
  case 63:
    getSoundSensorValue();
    break;
  case 64:
    getIrPhotoreflectorValue();
    break;

  default:
    base::processCommand();
    break;
  }
}

byte motorPorts[] = {
  PORT_M1,
  PORT_M2
};
byte digitalPorts[] = {
  PORT_D2,
  PORT_D4,
  PORT_D7,
  PORT_D8,
  PORT_D9,
  PORT_D10,
  PORT_D11,
  PORT_D12
};
byte analogPorts[] = {
  PORT_A0,
  PORT_A1,
  PORT_A2,
  PORT_A3,
  PORT_A4,
  PORT_A5,
  PORT_A6,
  PORT_A7
};
byte pids[] = {
  PIDOPEN,
  PIDLED,
  PIDBUZZER,
  PIDLIGHTSENSOR,
  PIDSOUNDSENSOR,
  PIDIRPHOTOREFLECTOR,
  PIDACCELEROMETER,
  PIDTOUCHSENSOR,
  PIDPUSHSWITCH
};

/**
 * !20<motor_index><rate>.
 *
 *   motor_index(2): 0-1 => PORT_M1-PORT_M2
 *   rate(3): 0-100
 **/
void SrStuduino::setDcMotorCalibration() {
  dcMotorCalibrations[pin] = val;
  studuino.SetDCMotorCalibration(dcMotorCalibrations);
}

/**
 * !21<motor_index><rate>.
 *
 *   motor_index(2): 0-7 => PORT_D2-PORT_D12
 *   degree(3): -15 - 15
 **/
void SrStuduino::setServomotorCalibration() {
  servomotorCalibrations[pin] = val;
  studuino.SetServomotorCalibration(servomotorCalibrations);
}

/**
 * !22<motor_index>.
 *
 *   motor_index(2): 0-1 => PORT_M1-PORT_M2
 **/
void SrStuduino::initDcMotorPort() {
  studuino.InitDCMotorPort(motorPorts[pin]);
}

/**
 * !23<servo_motor_index>.
 *
 *   servo_motor_index(2):
 *       0 => PORT_D2
 *       1 => PORT_D4
 *       2 => PORT_D7
 *       3 => PORT_D8
 *       4 => PORT_D9
 *       5 => PORT_D10
 *       6 => PORT_D11
 *       7 => PORT_D12
 **/
void SrStuduino::initServoMotorPort() {
  studuino.InitServomotorPort(digitalPorts[pin]);
}

/**
 * !25<sensor_index><pid_index>.
 *
 *   sensor_index(2): 0-7 => PORT_A0-PORT_A7
 *   pid_index(3): 0 => PIDOPEN or
 *                 1 => PIDLED or
 *                 2 => PIDBUZZER or
 *                 3 => PIDLIGHTSENSOR or
 *                 4 => PIDSOUNDSENSOR or
 *                 5 => PIDRPHOTOREFLECTOR or
 *                 6 => PIDACCELEROMETER or
 *                 7 => PIDTOUCHSENSOR or
 *                 8 => PIDPUSHSWITCH
 **/
void SrStuduino::initSensorPort() {
  studuino.InitSensorPort(analogPorts[pin], pids[val]);
}

/**
 * !42<motor_index><pace>.
 *
 *   motor_index(2): 0-1 => PORT_M1-PORT_M2
 *   pace(3): 0-255
 **/
void SrStuduino::dcMotorPower() {
  studuino.DCMotorPower(motorPorts[pin], val);
}

/**
 * !43<motor_index><rotation>.
 *
 *   motor_index(2): 0-1 => PORT_M1-PORT_M2
 *   rotation_index(3): 0 => NORMAL or
 *                      1 => REVERSE or
 *                      2 => BRAKE or
 *                      3 => COAST
 **/
void SrStuduino::dcMotorControl() {
  byte rotations[] = { NORMAL, REVERSE, BRAKE, COAST };

  studuino.DCMotorControl(motorPorts[pin], rotations[val]);
}

/**
 * !44<servo_motor_index><degree>.
 *
 *   servo_motor_index(2):
 *       0 => PORT_D2
 *       1 => PORT_D4
 *       2 => PORT_D7
 *       3 => PORT_D8
 *       4 => PORT_D9
 *       5 => PORT_D10
 *       6 => PORT_D11
 *       7 => PORT_D12
 *   degree(3): 0-180
 **/
void SrStuduino::servoMotor() {
  byte degree = (byte)val;
  studuino.Servomotor(digitalPorts[pin], degree);
}

/**
 * !51<sensor_index><onoff>.
 *
 *   sensor_index(2): 0-7 => PORT_A0-PORT_A7
 *   onoff(3): 0 => OFF or
 *             1 => ON
 **/
void SrStuduino::led() {
  boolean onoff[] = { OFF, ON };

  studuino.LED(analogPorts[pin], onoff[val]);
}

/**
 * !61<sensor_index>.
 *
 *   sensor_index(2): 0-7 => PORT_A0-PORT_A7
 *
 *   return: <sensor_index><res>
 *
 *     res: 0 => pressed or
 *          1 => released
 **/
void SrStuduino::getTouchSensorValue() {
  byte res = studuino.GetTouchSensorValue(analogPorts[pin]);

  sprintf(response, "%02d:%01d", pin, res);
}

/**
 * !62<sensor_index>.
 *
 *   sensor_index(2): 0-7 => PORT_A0-PORT_A7
 *
 *   return: <sensor_index><res>
 *
 *     res: 0-1023
 **/
void SrStuduino::getLightSensorValue() {
  int res = studuino.GetLightSensorValue(analogPorts[pin]);

  sprintf(response, "%02d:%04d", pin, res);
}

/**
 * !63<sensor_index>.
 *
 *   sensor_index(2): 0-7 => PORT_A0-PORT_A7
 *
 *   return: <sensor_index><res>
 *
 *     res: 0-1023
 **/
void SrStuduino::getSoundSensorValue() {
  int res = studuino.GetSoundSensorValue(analogPorts[pin]);

  sprintf(response, "%02d:%04d", pin, res);
}

/**
 * !64<sensor_index>.
 *
 *   sensor_index(2): 0-7 => PORT_A0-PORT_A7
 *
 *   return: <sensor_index><res>
 *
 *     res: 0-1023
 **/
void SrStuduino::getIrPhotoreflectorValue() {
  int res = studuino.GetIRPhotoreflectorValue(analogPorts[pin]);

  sprintf(response, "%02d:%04d", pin, res);
}
