#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

build() {
  local pkg="$1"
  local compile_cmd="${2:-compile}"
  echo ""
  echo "==> $pkg"
  cd "$ROOT/$pkg"
  rm -rf build/
  npm install --silent
  npm run "$compile_cmd" --silent
}

# Foundation — no local dependencies
build dssim-core
build dsc-lib
build edc-lib
build ids-broker-lib

# Layer 2 — depend on foundation
build dssim-scenario-controller
build dssim-ids-controller
build dssim-edc-controller
build dssim-kubernetes-controller

# Entry point — depends on all above (file: links)
build dssim-scenarios

# Standalone service
build dummyservice build

echo ""
echo "==> Done"
