#!/bin/bash
# Run this inside the sandbox after connecting with:
#   openshell sandbox connect my-project

npm install --prefix ~/claude-local @anthropic-ai/claude-code@latest

export GOOGLE_APPLICATION_CREDENTIALS=/sandbox/adc.json/application_default_credentials.json
export CLAUDE_CODE_USE_VERTEX=1
export ANTHROPIC_VERTEX_PROJECT_ID=itpc-gcp-hcm-pe-eng-claude
export CLOUD_ML_REGION=us-east5

# Force git to use HTTPS instead of SSH
git config --global url."https://github.com/".insteadOf "git@github.com:"
# Trust the sandbox proxy's TLS certificates
git config --global http.sslVerify false

~/claude-local/node_modules/.bin/claude --dangerously-skip-permissions
