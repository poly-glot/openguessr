# Dev container for OpenGuessr – Node.js 22
FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Verify installations
RUN node --version && npm --version

# Pre-create cache directories
RUN mkdir -p /home/vscode/.npm \
    && chown -R vscode:vscode /home/vscode/.npm

USER vscode
WORKDIR /workspace
