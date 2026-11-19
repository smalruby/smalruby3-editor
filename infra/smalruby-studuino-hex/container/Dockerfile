# Studuino の hex を作る Lambda のコンテナ（#2209）。
#
# 版とハッシュは third-party.json で固定し、CDK（lib/studuino-hex-stack.ts）が build args で渡す。
# ここに直接書かない（版を変えるのは third-party.json だけにする）。
# x86_64 で作る（avr-gcc のツールチェーンと GitHub Actions のランナーに合わせる。arm64 にすると
# ランナーでエミュレーションになりビルドが遅い）。
FROM public.ecr.aws/lambda/nodejs:22

ARG ARDUINO_CLI_URL
ARG ARDUINO_CLI_SHA256
ARG ARDUINO_CLI_VERSION
ARG AVR_CORE_ID
ARG AVR_CORE_VERSION
ARG SERVO_NAME
ARG SERVO_VERSION
ARG STUDUINO_FQBN
ARG STUDUINO_MAX_FLASH_BYTES
ARG STUDUINO_LIB_URL=""
ARG STUDUINO_LIB_SHA256=""
ARG STUDUINO_LIBRARIES=""

# 読み取りだけの場所（/opt/arduino）にツールチェーンとライブラリを置く。Lambda で書けるのは /tmp だけ。
ENV ARDUINO_DIRECTORIES_DATA=/opt/arduino/data \
    ARDUINO_DIRECTORIES_USER=/opt/arduino/user \
    ARDUINO_DIRECTORIES_DOWNLOADS=/tmp/arduino-downloads \
    ARDUINO_UPDATER_ENABLE_NOTIFICATION=false \
    ARDUINO_CLI=/opt/arduino/bin/arduino-cli \
    STUDUINO_TOOLCHAIN_FILE=/opt/arduino/toolchain.json \
    STUDUINO_SAMPLES_DIR=/opt/arduino/samples \
    STUDUINO_PREBUILT_CACHE=/opt/arduino/build-cache

RUN dnf install -y tar gzip unzip findutils && dnf clean all

COPY install-toolchain.sh /opt/arduino/install-toolchain.sh
COPY samples/ /opt/arduino/samples/
RUN bash /opt/arduino/install-toolchain.sh

COPY build/handler.js ${LAMBDA_TASK_ROOT}/handler.js

CMD ["handler.handler"]
