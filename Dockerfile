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
