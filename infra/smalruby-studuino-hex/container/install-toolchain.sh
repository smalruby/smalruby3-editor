#!/usr/bin/env bash
# コンテナのビルド中に 1 回だけ実行する（Dockerfile から）。
#   1. arduino-cli（sha256 を確かめる）
#   2. AVR のコアと Servo（版を固定）
#   3. Studuino ライブラリ（公式の配布元から。sha256 を確かめる。URL が空なら入れない）
#   4. サンプルを 1 回コンパイルして、コアのキャッシュを作っておく（コールドスタートを短くする）
#   5. 版とハッシュを toolchain.json に書く（Lambda が応答の toolchain に載せる）
set -euo pipefail

: "${ARDUINO_CLI_URL:?}" "${ARDUINO_CLI_SHA256:?}" "${ARDUINO_CLI_VERSION:?}"
: "${AVR_CORE_ID:?}" "${AVR_CORE_VERSION:?}" "${SERVO_NAME:?}" "${SERVO_VERSION:?}"
: "${STUDUINO_FQBN:?}" "${STUDUINO_MAX_FLASH_BYTES:?}"

work="$(mktemp -d)"
mkdir -p /opt/arduino/bin "${ARDUINO_DIRECTORIES_DATA}" "${ARDUINO_DIRECTORIES_USER}/libraries" \
  "${ARDUINO_DIRECTORIES_DOWNLOADS}" "${STUDUINO_PREBUILT_CACHE}"

# 1. arduino-cli
curl -fsSL "${ARDUINO_CLI_URL}" -o "${work}/arduino-cli.tar.gz"
echo "${ARDUINO_CLI_SHA256}  ${work}/arduino-cli.tar.gz" | sha256sum -c -
tar -xzf "${work}/arduino-cli.tar.gz" -C /opt/arduino/bin arduino-cli
"${ARDUINO_CLI}" version

# 2. コアと Servo（arduino-cli が index の checksum で中身を確かめる）
"${ARDUINO_CLI}" core update-index
"${ARDUINO_CLI}" core install "${AVR_CORE_ID}@${AVR_CORE_VERSION}"
"${ARDUINO_CLI}" lib update-index
"${ARDUINO_CLI}" lib install "${SERVO_NAME}@${SERVO_VERSION}"

# 3. Studuino ライブラリ
studuino_lib_sha256=""
if [ -n "${STUDUINO_LIB_URL}" ]; then
  if [ -z "${STUDUINO_LIB_SHA256}" ]; then
    echo "STUDUINO_LIB_URL があるのに STUDUINO_LIB_SHA256 が空です（third-party.json）" >&2
    exit 1
  fi
  curl -fsSL "${STUDUINO_LIB_URL}" -o "${work}/studuino-lib.zip"
  echo "${STUDUINO_LIB_SHA256}  ${work}/studuino-lib.zip" | sha256sum -c -
  mkdir -p "${work}/studuino-lib"
  unzip -q "${work}/studuino-lib.zip" -d "${work}/studuino-lib"
  # 使う 5 つだけを入れる（ほかは入れない）。LICENSE・著作権表示はフォルダごとそのまま残す。
  for name in ${STUDUINO_LIBRARIES//,/ }; do
    src="$(find "${work}/studuino-lib" -maxdepth 4 -type d -name "${name}" | head -n 1)"
    if [ -z "${src}" ]; then
      echo "zip の中に ${name} が見つかりません" >&2
      exit 1
    fi
    cp -R "${src}" "${ARDUINO_DIRECTORIES_USER}/libraries/${name}"
  done
  studuino_lib_sha256="${STUDUINO_LIB_SHA256}"
else
  echo "STUDUINO_LIB_URL が空なので、Studuino ライブラリを入れずに作ります"
fi

# 4. コアのキャッシュを作る（Lambda は起動時に /tmp へ写して使う）
for dir in "${STUDUINO_SAMPLES_DIR}"/*/; do
  name="$(basename "${dir}")"
  if [ "${name}" != "blink" ] && [ -z "${studuino_lib_sha256}" ]; then
    continue
  fi
  start=$(date +%s%N)
  "${ARDUINO_CLI}" compile --fqbn "${STUDUINO_FQBN}" \
    --build-path "${work}/build-${name}" --output-dir "${work}/out-${name}" \
    --build-cache-path "${STUDUINO_PREBUILT_CACHE}" "${dir}"
  echo "prebuilt ${name}: $(( ($(date +%s%N) - start) / 1000000 )) ms"
done

# 5. 版とハッシュ
cat > /opt/arduino/toolchain.json <<JSON
{
  "arduinoCli": "${ARDUINO_CLI_VERSION}",
  "avrCore": "${AVR_CORE_ID}@${AVR_CORE_VERSION}",
  "servo": "${SERVO_NAME}@${SERVO_VERSION}",
  "fqbn": "${STUDUINO_FQBN}",
  "maxFlashBytes": ${STUDUINO_MAX_FLASH_BYTES},
  "studuinoLib": $( [ -n "${studuino_lib_sha256}" ] && echo "\"sha256:${studuino_lib_sha256}\"" || echo null )
}
JSON
cat /opt/arduino/toolchain.json

rm -rf "${work}" "${ARDUINO_DIRECTORIES_DOWNLOADS:?}"/*
# Lambda は root でない利用者で動くので、読めるようにする
chmod -R a+rX /opt/arduino
