// Studuino ライブラリで、A0 につないだ LED を 0.5 秒ごとに点滅させる。
// hex を作る Lambda の動作確認用のサンプル（#2209）。include は Studuino ライブラリの
// リファレンスにある組み合わせ（本体が MMA8653 などを include するため、すべて並べる）。
#include <Arduino.h>
#include <Servo.h>
#include <Wire.h>
#include <MMA8653.h>
#include <MPU6050.h>
#include <IRremoteForStuduino.h>
#include <ColorSensor.h>
#include <Studuino.h>

Studuino board;

void setup() {
  board.InitSensorPort(PORT_A0, PIDLED);
}

void loop() {
  board.LED(PORT_A0, ON);
  board.Timer(0.5);
  board.LED(PORT_A0, OFF);
  board.Timer(0.5);
}
