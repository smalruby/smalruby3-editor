FROM ruby:3.3-slim-bookworm

LABEL maintainer="Kouji Takao"

ENV LANG=C.UTF-8
ENV DEBIAN_FRONTEND=noninteractive

# SDL2 development libraries + Xvfb for headless rendering + build tools
RUN set -eux \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
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
    libgl1-mesa-dri \
    libgl1-mesa-glx \
    libegl-mesa0 \
    x11vnc \
    fonts-ipafont-gothic \
  && rm -rf /var/lib/apt/lists/*

# Refuse to build on a stale base image. The eMudhra intermediate CA keys leaked
# (2026-10); Debian 12 drops the affected roots in ca-certificates 20250419~deb12u2.
RUN dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge 20250419~deb12u2 \
  || { echo "ca-certificates $(dpkg-query -W -f='${Version}' ca-certificates) predates the eMudhra fix" >&2; exit 1; }
# Ruby 3.3.13 fixes the Regexp CVEs (CVE-2026-89078 and others) published on 2026-10-23.
RUN ruby -e 'abort "Ruby #{RUBY_VERSION} predates 3.3.13" if Gem::Version.new(RUBY_VERSION) < Gem::Version.new("3.3.13")'

# Install Rust toolchain (needed for smalruby3_imageutil native extension)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app/ruby/smalruby3

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["bash"]
