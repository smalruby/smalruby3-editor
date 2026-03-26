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

# Start Xvfb for headless SDL2 rendering (skipped if DISPLAY is already set)
if [ -z "$DISPLAY" ]; then
  export DISPLAY=:99
  Xvfb :99 -screen 0 640x480x24 -nolisten tcp &
  sleep 1

  # Start x11vnc if VNC_ENABLED is set (for GUI viewing via VNC client)
  if [ "$VNC_ENABLED" = "1" ]; then
    VNC_PASSWORD="${VNC_PASSWORD:-smalruby}"
    mkdir -p /tmp/.vnc
    x11vnc -storepasswd "$VNC_PASSWORD" /tmp/.vnc/passwd
    x11vnc -display :99 -forever -shared -rfbport 5900 -rfbauth /tmp/.vnc/passwd &
    echo "[smalruby3] VNC server started on port 5900 (password: $VNC_PASSWORD)"
    echo "[smalruby3] Connect with: open vnc://localhost:15900"
  fi
fi

exec "$@"
