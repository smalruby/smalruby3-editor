#! /bin/sh -e

if [ ! -e /app/built-monorepo ]; then
  (
    cd /app
    npm install
    cd packages/scratch-gui
    npm run setup:opal
    npx playwright install chromium --with-deps
    touch /app/built-monorepo
  )
fi

exec "$@"
