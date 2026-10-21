#!/usr/bin/env bash
# Builds a Region's Cache Pack from regions/<name>/region.json: scripts/build-cache-pack.sh nepal
# Needs the internet for the sources the Region file names; arguments go to build_cache_pack.py
# (--output, --work-dir). Notes: scripts/cache-pack/README.md.
set -euo pipefail

cd "$(dirname "$0")/../node"
# The scripts are not part of the Node's package, so they go on the path; pyrosm (Road graph) is
# a build-only dependency.
PYTHONPATH=../scripts exec uv run --with pyrosm python ../scripts/build_cache_pack.py "$@"
