#!/bin/bash

# qamareth-git-watcher.sh
# Auto-commit every 30s or on file change in src/.

cd /home/timon/Documents/qamareth/code

while true; do
  # Stash any untracked, commit tracked delta
  git add .
  delta=$(git status --porcelain)

  if [[ ! -z "$delta" ]]; then
    git commit -m "[autonomy] $(date +"%Y-%m-%d %H:%M") — $(echo "$delta" | head -3 | cut -d' ' -f2-)"
    git push origin main
  fi

  sleep 30
