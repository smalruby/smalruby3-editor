#!/usr/bin/env bash
# コンテナのビルド中に 1 回だけ実行する（Dockerfile から）。
#   1. arduino-cli（sha256 を確かめる）
#   2. AVR のコアと Arduino のライブラリ（版を固定）
#   3. アーテック社のボード定義（公式の配布元から。sha256 を確かめる）
#   4. Studuino ライブラリ（公式の配布元から。sha256 を確かめる。URL が空なら入れない）
#   5. サンプルを 1 回ずつコンパイルして、コアのキャッシュを作り、かかった時間を記録する
#   6. 版とハッシュを toolchain.json に書く（Lambda が応答の toolchain に載せる）
set -euo pipefail

: "${ARDUINO_CLI_URL:?}" "${ARDUINO_CLI_SHA256:?}" "${ARDUINO_CLI_VERSION:?}"
: "${AVR_CORE_ID:?}" "${AVR_CORE_VERSION:?}" "${ARDUINO_LIBRARIES:?}"
: "${STUDUINO_BOARD_URL:?}" "${STUDUINO_BOARD_SHA256:?}" "${STUDUINO_BOARD_PATH:?}"
: "${STUDUINO_FQBN:?}" "${STUDUINO_MAX_FLASH_BYTES:?}"

work="$(mktemp -d)"
mkdir -p /opt/arduino/bin "${ARDUINO_DIRECTORIES_DATA}" "${ARDUINO_DIRECTORIES_USER}/libraries" \
  "${ARDUINO_DIRECTORIES_USER}/hardware" "${ARDUINO_DIRECTORIES_DOWNLOADS}" "${STUDUINO_PREBUILT_CACHE}"

# 1. arduino-cli
curl -fsSL "${ARDUINO_CLI_URL}" -o "${work}/arduino-cli.tar.gz"
echo "${ARDUINO_CLI_SHA256}  ${work}/arduino-cli.tar.gz" | sha256sum -c -
tar -xzf "${work}/arduino-cli.tar.gz" -C /opt/arduino/bin arduino-cli
"${ARDUINO_CLI}" version

# 2. コアとライブラリ（arduino-cli が index の checksum で中身を確かめる）
"${ARDUINO_CLI}" core update-index
"${ARDUINO_CLI}" core install "${AVR_CORE_ID}@${AVR_CORE_VERSION}"
"${ARDUINO_CLI}" lib update-index
IFS='|' read -r -a libs <<< "${ARDUINO_LIBRARIES}"
for lib in "${libs[@]}"; do
  "${ARDUINO_CLI}" lib install "${lib}"
done

# 3. ボード定義（boards.txt・platform.txt だけを入れる）
#    取れない・sha256 が合わないときは、同じ MCU・クロックの arduino:avr の pro（168・8MHz）で代わりに作り、
#    その理由を toolchain.json に残す（イメージのビルドを止めない。Lambda の応答で分かる）。
fqbn="${STUDUINO_FQBN}"
max_flash="${STUDUINO_MAX_FLASH_BYTES}"
board_sha256="null"
board_error="null"
fetch_verified() { # url sha256 out
  curl -fsSL --retry 2 "$1" -o "$3" || { echo "download failed"; return 1; }
  echo "$2  $3" | sha256sum -c - >/dev/null 2>&1 || { echo "sha256 mismatch: $(sha256sum "$3" | cut -d' ' -f1)"; return 1; }
}
if err="$(fetch_verified "${STUDUINO_BOARD_URL}" "${STUDUINO_BOARD_SHA256}" "${work}/board.zip")"; then
  mkdir -p "${work}/board"
  unzip -q "${work}/board.zip" -d "${work}/board"
  cp -R "${work}/board/${STUDUINO_BOARD_PATH}" "${ARDUINO_DIRECTORIES_USER}/hardware/studuino"
  board_sha256="\"sha256:${STUDUINO_BOARD_SHA256}\""
else
  echo "ボード定義を入れられませんでした（${err}）。arduino:avr:pro:cpu=8MHzatmega168 で作ります" >&2
  fqbn="arduino:avr:pro:cpu=8MHzatmega168"
  max_flash=14336
  board_error="\"${err}\""
fi
"${ARDUINO_CLI}" board details --fqbn "${fqbn}" | head -n 5

# 4. Studuino ライブラリ（取れない・sha256 が合わないときは入れずに作り、理由を残す）
studuino_lib_sha256=""
studuino_lib_error="null"
if [ -n "${STUDUINO_LIB_URL}" ]; then
  if [ -z "${STUDUINO_LIB_SHA256}" ]; then
    echo "STUDUINO_LIB_URL があるのに STUDUINO_LIB_SHA256 が空です（third-party.json）" >&2
    exit 1
  fi
  if err="$(fetch_verified "${STUDUINO_LIB_URL}" "${STUDUINO_LIB_SHA256}" "${work}/studuino-lib.zip")"; then
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
    echo "Studuino ライブラリを入れられませんでした（${err}）" >&2
    studuino_lib_error="\"${err}\""
  fi
else
  echo "STUDUINO_LIB_URL が空なので、Studuino ライブラリを入れずに作ります"
fi

# 5. コアのキャッシュを作る（Lambda は起動時に /tmp へ写して使う）。blink は必ず通す。
#    ほかのサンプルの失敗ではイメージを止めない（Lambda が compile_failed を返す）。
compile_one() {
  local name="$1"
  local start
  start=$(date +%s%N)
  "${ARDUINO_CLI}" compile --fqbn "${fqbn}" \
    --build-path "${work}/build-${name}" --output-dir "${work}/out-${name}" \
    --build-cache-path "${STUDUINO_PREBUILT_CACHE}" "${STUDUINO_SAMPLES_DIR}/${name}" || return 1
  echo "prebuilt ${name}: $(( ($(date +%s%N) - start) / 1000000 )) ms"
}
compile_one blink
for dir in "${STUDUINO_SAMPLES_DIR}"/*/; do
  name="$(basename "${dir}")"
  [ "${name}" = "blink" ] && continue
  [ -z "${studuino_lib_sha256}" ] && continue
  compile_one "${name}" || echo "prebuilt ${name}: failed"
done

# 6. 版とハッシュ
cat > /opt/arduino/toolchain.json <<JSON
{
  "arduinoCli": "${ARDUINO_CLI_VERSION}",
  "avrCore": "${AVR_CORE_ID}@${AVR_CORE_VERSION}",
  "libraries": "${ARDUINO_LIBRARIES}",
  "board": ${board_sha256},
  "boardError": ${board_error},
  "fqbn": "${fqbn}",
  "maxFlashBytes": ${max_flash},
  "studuinoLib": $( [ -n "${studuino_lib_sha256}" ] && echo "\"sha256:${studuino_lib_sha256}\"" || echo null ),
  "studuinoLibError": ${studuino_lib_error}
}
JSON
cat /opt/arduino/toolchain.json

rm -rf "${work}" "${ARDUINO_DIRECTORIES_DOWNLOADS:?}"/*
# Lambda は root でない利用者で動くので、読めるようにする
chmod -R a+rX /opt/arduino
