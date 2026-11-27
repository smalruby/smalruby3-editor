// Studuino の A0 につないだ LED を 0.5 秒ごとに点滅させる（Arduino のコアだけを使う）。
// hex を作る Lambda の動作確認用のサンプル（#2209）。
void setup() {
  pinMode(A0, OUTPUT);
}

void loop() {
  digitalWrite(A0, HIGH);
  delay(500);
  digitalWrite(A0, LOW);
  delay(500);
}
