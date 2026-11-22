// 中くらいのサンプル（#2209 のコンパイル時間の計測用）: ロボットカーの自動運転。
// 2 つの赤外線フォトリフレクタで黒い線をたどり、光センサーで暗くなったら LED を点け、
// タッチセンサーが押されたら止まってブザーを鳴らし、サーボモーターで首をふって向きを変える。
// Studuino モードで、ブロックから作る C++ と同じくらいの量・同じ関数の使い方にしてある。
#include <Arduino.h>
#include <Servo.h>
#include <Wire.h>
#include <MMA8653.h>
#include <MPU6050.h>
#include <IRremoteForStuduino.h>
#include <ColorSensor.h>
#include <Studuino.h>

Studuino board;

const double LINE_THRESHOLD = 500;
const double DARK_THRESHOLD = 300;

double speed = 0;
double turns = 0;
double lastSwitch = 0;
unsigned long timerStart = 0;

double timer() { return (millis() - timerStart) / 1000.0; }

void forward(double pace) {
  board.DCMotorPower(PORT_M1, (byte)constrain(pace, 0, 255));
  board.DCMotorPower(PORT_M2, (byte)constrain(pace, 0, 255));
  board.DCMotorControl(PORT_M1, NORMAL);
  board.DCMotorControl(PORT_M2, NORMAL);
}

void turnLeft(double pace) {
  board.DCMotorPower(PORT_M1, (byte)constrain(pace / 2, 0, 255));
  board.DCMotorPower(PORT_M2, (byte)constrain(pace, 0, 255));
  board.DCMotorControl(PORT_M1, REVERSE);
  board.DCMotorControl(PORT_M2, NORMAL);
}

void turnRight(double pace) {
  board.DCMotorPower(PORT_M1, (byte)constrain(pace, 0, 255));
  board.DCMotorPower(PORT_M2, (byte)constrain(pace / 2, 0, 255));
  board.DCMotorControl(PORT_M1, NORMAL);
  board.DCMotorControl(PORT_M2, REVERSE);
}

void stopMotors() {
  board.DCMotorControl(PORT_M1, BRAKE);
  board.DCMotorControl(PORT_M2, BRAKE);
}

void lookAround() {
  for (int degree = 30; degree <= 150; degree += 30) {
    board.Servomotor(PORT_D9, degree);
    board.Timer(0.2);
  }
  board.Servomotor(PORT_D9, 90);
}

void setup() {
  board.InitDCMotorPort(PORT_M1);
  board.InitDCMotorPort(PORT_M2);
  board.InitServomotorPort(PORT_D9);
  board.InitSensorPort(PORT_A0, PIDTOUCHSENSOR);
  board.InitSensorPort(PORT_A1, PIDLED);
  board.InitSensorPort(PORT_A2, PIDIRPHOTOREFLECTOR);
  board.InitSensorPort(PORT_A3, PIDIRPHOTOREFLECTOR);
  board.InitSensorPort(PORT_A5, PIDBUZZER);
  board.InitSensorPort(PORT_A6, PIDLIGHTSENSOR);
  board.InitSensorPort(PORT_A7, PIDSOUNDSENSOR);
  byte rates[2] = {100, 100};
  board.SetDCMotorCalibration(rates);
  char offsets[8] = {0, 0, 0, 0, 0, 0, 0, 0};
  board.SetServomotorCalibration(offsets);
  board.Servomotor(PORT_D9, 90);
  timerStart = millis();
  speed = 120;
}

void loop() {
  double left = board.GetIRPhotoreflectorValue(PORT_A2);
  double right = board.GetIRPhotoreflectorValue(PORT_A3);
  bool onLeft = left > LINE_THRESHOLD;
  bool onRight = right > LINE_THRESHOLD;

  if (board.GetTouchSensorValue(PORT_A0) == 0) {
    stopMotors();
    board.Buzzer(PORT_A5, BZR_C4, 200);
    board.Buzzer(PORT_A5, BZR_E4, 200);
    board.Buzzer(PORT_A5, BZR_G4, 400);
    lookAround();
    turns = turns + 1;
    if (fmod(turns, 2) == 0) {
      turnLeft(speed);
    } else {
      turnRight(speed);
    }
    board.Timer(0.5);
  } else if (onLeft && onRight) {
    forward(speed);
  } else if (onLeft) {
    turnLeft(speed);
  } else if (onRight) {
    turnRight(speed);
  } else {
    forward(speed * 0.6);
  }

  board.LED(PORT_A1, board.GetLightSensorValue(PORT_A6) < DARK_THRESHOLD ? ON : OFF);

  if (board.GetSoundSensorValue(PORT_A7) > 700 && timer() - lastSwitch > 1) {
    speed = speed >= 200 ? 80 : speed + 40;
    lastSwitch = timer();
  }
  board.Timer(0.01);
}
