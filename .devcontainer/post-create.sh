#!/bin/bash
set -e

echo "Setting up OpenGuessr dev environment..."

# Claude Code config
if [ -f ~/.claude/.claude.json ] && [ ! -e ~/.claude.json ]; then
    ln -s ~/.claude/.claude.json ~/.claude.json
fi

# NPM config
npm config set cache ~/.npm
npm config set update-notifier false
npm config set fund false
npm config set audit false

# Git config
git config --global --add safe.directory /workspace
git config --global init.defaultBranch main

# Shell aliases
cat >> ~/.zshrc <<'EOF'
alias claude="claude --dangerously-skip-permissions"
alias dev='npm start'
alias test='npm test'
alias fb-emulators='firebase emulators:start'
EOF

[ -f ~/.bashrc ] && ! grep -q 'exec zsh' ~/.bashrc && echo '[ -t 1 ] && exec zsh' >> ~/.bashrc

# Install dependencies in parallel
echo "Installing dependencies..."
cd /workspace

if [ -f "package.json" ]; then
    npm install --no-audit --no-fund --prefer-offline > /tmp/root-install.log 2>&1 &
    ROOT_PID=$!
fi

if [ -f "functions/package.json" ]; then
    (cd functions && npm install --no-audit --no-fund --prefer-offline > /tmp/functions-install.log 2>&1) &
    FUNCTIONS_PID=$!
fi

FAILED=0

if [ -n "$ROOT_PID" ]; then
    if ! wait $ROOT_PID; then
        echo "root install failed:"; cat /tmp/root-install.log; FAILED=1
    fi
fi

if [ -n "$FUNCTIONS_PID" ]; then
    if ! wait $FUNCTIONS_PID; then
        echo "functions install failed:"; cat /tmp/functions-install.log; FAILED=1
    fi
fi

[ $FAILED -ne 0 ] && exit 1

echo ""
echo "Setup complete! (Node $(node --version), NPM $(npm --version))"
echo ""
echo "Quick start:"
echo "  dev             -> Start Vite + Firebase emulators"
echo "  test            -> Run all tests"
echo "  fb-emulators    -> Start Firebase emulators only"
echo ""
