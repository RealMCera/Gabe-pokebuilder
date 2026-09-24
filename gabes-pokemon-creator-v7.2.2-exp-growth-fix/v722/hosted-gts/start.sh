#!/bin/sh
set -eu
: "${CREATOR_API_URL:?Set CREATOR_API_URL, e.g. https://gabe-pokebuilder.onrender.com}"
: "${GTS_BRIDGE_TOKEN:?Set GTS_BRIDGE_TOKEN to the same secret configured on Render}"
FIFO=/data/gts-input
rm -f "$FIFO"
mkfifo "$FIFO"
# Keep one writer open so gts-rs does not see EOF between deliveries.
exec 3>"$FIFO" &
gts-rs < "$FIFO" &
GTS_PID=$!
python3 /app/supervisor.py "$FIFO" &
SUP_PID=$!
trap 'kill $GTS_PID $SUP_PID 2>/dev/null || true' INT TERM EXIT
wait $GTS_PID
