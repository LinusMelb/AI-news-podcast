#!/bin/bash

# Run both services concurrently
trap 'kill 0' EXIT

echo "Starting backend (text_to_audio)..."
(cd text_to_audio && npm run dev) &

echo "Starting frontend (ui)..."
(cd ui && npm run dev) &

wait
