FROM ruby:3.3-slim-bookworm

LABEL maintainer="Kouji Takao"

ENV LANG=C.UTF-8
ENV DEBIAN_FRONTEND=noninteractive

# SDL2 development libraries + Xvfb for headless rendering + build tools
RUN set -eux \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    less \
    vim \
    libsdl2-dev \
    libsdl2-image-dev \
    libsdl2-mixer-dev \
    libsdl2-ttf-dev \
    libclang-dev \
    xvfb \
    fonts-ipafont-gothic \
  && rm -rf /var/lib/apt/lists/*

# Install Rust toolchain (needed for smalruby3_imageutil native extension)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app/ruby/smalruby3

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["bash"]
