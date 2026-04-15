FROM node:22-bookworm

# Install system dependencies + Cypress requirements
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    jq \
    xvfb \
    libgtk2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libnotify-dev \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    xauth \
    && rm -rf /var/lib/apt/lists/*

# Install gh CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Install oc CLI
RUN curl -fsSL https://mirror.openshift.com/pub/openshift-v4/clients/ocp/stable/openshift-client-linux.tar.gz \
    | tar xz -C /usr/local/bin oc kubectl

# Install Claude Code via npm (uses Node.js, not Bun)
RUN npm install -g @anthropic-ai/claude-code@latest

# Create sandbox user with same UID as host user for file permissions
ARG HOST_UID=1000
RUN useradd -m -s /bin/bash -u ${HOST_UID} sandbox
USER sandbox
WORKDIR /sandbox

# Vertex AI configuration
ENV CLAUDE_CODE_USE_VERTEX=1
ENV ANTHROPIC_VERTEX_PROJECT_ID=itpc-gcp-hcm-pe-eng-claude
ENV CLOUD_ML_REGION=us-east5
ENV GOOGLE_APPLICATION_CREDENTIALS=/tmp/adc.json
ENV KUBECONFIG=/tmp/kubeconfig

# Git config for the container
RUN git config --global user.name "Claude Agent" \
    && git config --global user.email "claude-agent@sandbox.local" \
    && git config --global --add safe.directory /sandbox

# Claude settings - Sonnet 4.6 with 1M context
RUN mkdir -p /home/sandbox/.claude && \
    echo '{"model": "claude-sonnet-4-6", "maxTokens": 1000000}' > /home/sandbox/.claude/settings.json

CMD ["claude", "--dangerously-skip-permissions"]
