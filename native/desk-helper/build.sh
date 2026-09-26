#!/usr/bin/env bash
# Builds desk-helper as a universal (arm64 + x86_64) binary into resources/bin/.
# Skips the build when the binary is newer than every source file.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC_DIR="$ROOT/native/desk-helper"
BUILD_DIR="$SRC_DIR/.build"
OUT="$ROOT/resources/bin/desk-helper"
MIN_MACOS="13.0"

sources=("$SRC_DIR"/*.swift)

if [[ -x "$OUT" && "${FORCE:-0}" != "1" ]]; then
  stale=0
  for f in "${sources[@]}" "$0"; do
    [[ "$f" -nt "$OUT" ]] && stale=1
  done
  if [[ $stale == 0 ]]; then
    echo "desk-helper: up to date"
    exit 0
  fi
fi

if ! command -v swiftc >/dev/null 2>&1; then
  echo "desk-helper: swiftc not found. Install Xcode Command Line Tools: xcode-select --install" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR" "$(dirname "$OUT")"
for arch in arm64 x86_64; do
  swiftc -O -target "$arch-apple-macos$MIN_MACOS" -o "$BUILD_DIR/desk-helper-$arch" "${sources[@]}"
done
lipo -create -output "$OUT" "$BUILD_DIR/desk-helper-arm64" "$BUILD_DIR/desk-helper-x86_64"
echo "desk-helper: built $OUT"
