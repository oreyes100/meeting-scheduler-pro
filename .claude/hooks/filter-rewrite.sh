#!/bin/bash
# filter-rewrite.sh — RTK filter hook
# Excluye node_modules, .next, .git de búsquedas grep/find
# Activado por RTK filter en .claude/rtk-filter.json

# This hook is auto-applied by the RTK pipeline.
# No modification needed unless paths change.
echo "RTK filter active: node_modules, .next, .git excluded"
