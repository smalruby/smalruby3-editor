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
# The check is tied to Debian 12, so a base image on another release fails here
# until this line is updated for it.
RUN grep -q '^12\.' /etc/debian_version \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge 20250419~deb12u2 \
  || { echo "Debian $(cat /etc/debian_version) / ca-certificates $(dpkg-query -W -f='${Version}' ca-certificates): rebuild with --pull, or update this check for the new base" >&2; exit 1; }
# Ruby 3.3.13 / 3.4.12 / 4.0.9 fix the Regexp CVEs published on 2026-10-23.
# An unknown series fails so the check is revisited when the base moves.
RUN ruby -e 'min = { "3.3" => "3.3.13", "3.4" => "3.4.12", "4.0" => "4.0.9" }[RUBY_VERSION[/\A\d+\.\d+/]]; \
  abort "Ruby #{RUBY_VERSION} is not a patched release (rebuild with --pull)" unless min && Gem::Version.new(RUBY_VERSION) >= Gem::Version.new(min)'

# Install Rust toolchain (needed for smalruby3_imageutil native extension)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app/ruby/smalruby3

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["bash"]
