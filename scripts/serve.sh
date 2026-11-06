#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
mkdir -p out
while true; do
  HOST=0.0.0.0 PORT=8098 node server.mjs >> out/server.log 2>&1
  code=$?
  echo "[supervisor] server exited code=$code at $(date -Is)" >> out/server.log
  sleep 2
done
