FROM node:24-bookworm-slim
LABEL maintainer="Kouji Takao"

ENV LANG=C.UTF-8
ENV DEBIAN_FRONTEND=noninteractive

RUN \
  set -eux \
  && apt update \
  && apt install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    git \
    curl \
    chromium \
    chromium-driver \
    libgl1-mesa-dri \
    libglapi-mesa \
    libosmesa6 \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1

# Refuse to build on a stale base image. The eMudhra intermediate CA keys leaked
# (2026-10); Debian 12 drops the affected roots in ca-certificates 20250419~deb12u2.
# The check is tied to Debian 12, so a base image on another release fails here
# until this line is updated for it.
RUN grep -q '^12\.' /etc/debian_version \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' ca-certificates)" ge 20250419~deb12u2 \
  || { echo "Debian $(cat /etc/debian_version) / ca-certificates $(dpkg-query -W -f='${Version}' ca-certificates): rebuild with --pull, or update this check for the new base" >&2; exit 1; }
# Node.js 24.22.1 is the security release that updates the bundled root store for the
# eMudhra compromise. Any other major fails so the check is revisited when the base moves.
RUN node -e "const [a, b, c] = process.versions.node.split('.').map(Number); \
  if (a !== 24 || b < 22 || (b === 22 && c < 1)) { console.error('Node.js ' + process.version + ' is not 24.22.1+ (rebuild with --pull)'); process.exit(1); }"

# Development convenience tools (separate layer to avoid busting app build cache)
#
# iptables / ipset / dnsutils (dig) are required by .devcontainer/init-firewall.sh,
# the egress allowlist firewall applied at devcontainer start. They are inert for the
# docker-compose workflow (only exercised when that script runs under NET_ADMIN).
RUN \
  set -eux \
  && apt install -y --no-install-recommends \
    dnsutils \
    iptables \
    ipset \
    iputils-ping \
    jq \
    less \
    lsof \
    lv \
    netcat-openbsd \
    openssh-client \
    procps \
    python3 \
    tmux \
    vim

# AWS CLI v2 — needed to deploy the CDK infra projects (infra/*) from inside
# the container. CDK itself comes from each project's npm devDependencies, but
# the aws CLI is not an npm package so it is installed here for reproducibility.
RUN \
  set -eux \
  && apt install -y --no-install-recommends unzip \
  && curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$(uname -m).zip" -o /tmp/awscliv2.zip \
  && unzip -q /tmp/awscliv2.zip -d /tmp \
  && /tmp/aws/install \
  && rm -rf /tmp/aws /tmp/awscliv2.zip \
  && aws --version

# herdr — the terminal the autopilot daemon and its workers run in (tools/autopilot).
# It shows whether a claude worker is working or stopped at a prompt, which tmux cannot.
# Pinned to a release with a checked sha256 per architecture (supply-chain rule: the
# release must be 3+ days old). To update, take the digests from the GitHub release.
ARG HERDR_VERSION=0.9.5
RUN \
  set -eux \
  && arch="$(uname -m)" \
  && case "$arch" in \
       x86_64) sha=14d9e8bc8b4a9e0118d77c32266f76d461f09b40342eb23752960bd89f59929d ;; \
       aarch64) sha=17d7536f2da50859523680ef279dffcac8e4a235f4e46fe8da6c2ec44141897c ;; \
       *) echo "herdr: unsupported architecture $arch" >&2; exit 1 ;; \
     esac \
  && curl -fsSL "https://github.com/herdrdev/herdr/releases/download/v${HERDR_VERSION}/herdr-linux-${arch}" -o /usr/local/bin/herdr \
  && echo "${sha}  /usr/local/bin/herdr" | sha256sum -c - \
  && chmod +x /usr/local/bin/herdr \
  && herdr --version

# Install Playwright and its dependencies
RUN npx playwright install chromium --with-deps

# Link chromium to google-chrome just in case
RUN ln -s /usr/bin/chromium /usr/bin/google-chrome

ENV NODE_OPTIONS="--max-old-space-size=4000"

EXPOSE 8601

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["npm", "start"]
