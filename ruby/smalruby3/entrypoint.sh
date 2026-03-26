#!/bin/sh
set -e

# Install gems and compile native extension on first run
if [ ! -e /app/ruby/smalruby3/.built ]; then
  (
    cd /app/ruby/smalruby3
    bundle install
    bundle exec rake compile
    touch /app/ruby/smalruby3/.built
  )
fi

# Start Xvfb for headless SDL2 rendering
if [ -z "$DISPLAY" ]; then
  export DISPLAY=:99
  Xvfb :99 -screen 0 640x480x24 -nolisten tcp &
  sleep 1
fi

exec "$@"
