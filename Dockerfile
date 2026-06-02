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
    less \
    lv \
    vim \
    jq \
    tmux \
    chromium \
    chromium-driver \
    libgl1-mesa-dri \
    libglapi-mesa \
    libosmesa6 \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1

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
