#!/usr/bin/env bash
# sx-<hash> -> its CSS declarations. The only honest way to read a StyleX value.
CSS=/home/tjninja/linear-loops-decompile/pipeline/corpus/style/style-p6hK3mv7.css
for c in "$@"; do
  printf '%s => ' "$c"
  LC_ALL=C grep -oaE "\.$c(\.$c)*\{[^}]*\}" "$CSS" | head -1
  echo
done
