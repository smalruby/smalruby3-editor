FROM node:24-bookworm-slim
LABEL maintainer="Kouji Takao"

ENV LANG=C.UTF-8
ENV DEBIAN_FRONTEND=noninteractive

RUN \
  set -eux \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    unzip \
    less \
    jq \
    git \
    build-essential \
    libssl-dev \
    libreadline-dev \
    zlib1g-dev \
    libyaml-dev \
    libffi-dev \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Refuse to build on a stale base image. The eMudhra intermediate CA keys leaked
# (2026-10); Debian 12 drops the affected roots in ca-certificates 20250419~deb12u2.
RUN dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge 20250419~deb12u2 \
  || { echo "ca-certificates $(dpkg-query -W -f='${Version}' ca-certificates) predates the eMudhra fix" >&2; exit 1; }
# Node.js 24.22.1 is the first 24.x with the eMudhra roots removed from its bundled store.
RUN node -e "const [a, b, c] = process.versions.node.split('.').map(Number); \
  if (a === 24 && (b < 22 || (b === 22 && c < 1))) { console.error('Node.js ' + process.version + ' predates 24.22.1'); process.exit(1); }"

# Install AWS CLI v2
RUN \
  set -eux \
  && ARCH=$(uname -m) \
  && curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${ARCH}.zip" -o /tmp/awscliv2.zip \
  && unzip /tmp/awscliv2.zip -d /tmp \
  && /tmp/aws/install \
  && rm -rf /tmp/aws /tmp/awscliv2.zip

# Install rbenv + ruby-build
ENV RBENV_ROOT=/usr/local/rbenv
RUN \
  git clone --depth=1 https://github.com/rbenv/rbenv.git ${RBENV_ROOT} \
  && git clone --depth=1 https://github.com/rbenv/ruby-build.git ${RBENV_ROOT}/plugins/ruby-build
ENV PATH="${RBENV_ROOT}/bin:${RBENV_ROOT}/shims:${PATH}"

# Install Ruby 3.4.12
ARG RUBY_VERSION=3.4.12
RUN rbenv install ${RUBY_VERSION} && rbenv global ${RUBY_VERSION}
RUN gem install bundler --no-document

WORKDIR /app
