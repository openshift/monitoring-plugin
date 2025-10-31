#!/bin/bash
set -e

SUBMODULE_PATH="web/cypress/fixtures/incidents/test-docs"
SUBMODULE_URL="git@gitlab.cee.redhat.com:drajnoha/cat-test-docs.git"

echo "Setting up optional test-docs submodule..."

# Check if it's a valid git repository
if [ -d "$SUBMODULE_PATH/.git" ] || [ -f "$SUBMODULE_PATH/.git" ]; then
    echo "✓ Repository already exists at $SUBMODULE_PATH"
    cd "$SUBMODULE_PATH"

    # Handle case where .git is a file (submodule gitdir reference)
    if [ -f ".git" ]; then
        echo "Converting old submodule format to regular repository..."
        # Read the gitdir path from .git file
        GITDIR=$(cat .git | sed 's/gitdir: //')
        # Move the git directory here
        if [ -d "../../../../../../$GITDIR" ]; then
            mv "../../../../../../$GITDIR" .git
        fi
    fi

    git pull
    echo "✓ Updated to latest version"
else
    # Directory might exist but not be a git repo
    if [ -d "$SUBMODULE_PATH" ]; then
        echo "Removing non-git directory at $SUBMODULE_PATH..."
        rm -rf "$SUBMODULE_PATH"
    fi

    # Clone the repository
    echo "Cloning test documentation..."
    git clone "$SUBMODULE_URL" "$SUBMODULE_PATH"

    # Configure it as a submodule in local .git/config (optional, for git submodule commands to work)
    git config -f .git/config submodule.$SUBMODULE_PATH.url "$SUBMODULE_URL"
    git config -f .git/config submodule.$SUBMODULE_PATH.path "$SUBMODULE_PATH"
    git config -f .git/config submodule.$SUBMODULE_PATH.active true

    echo "✓ Test documentation submodule setup complete!"
fi

echo "  Location: $SUBMODULE_PATH/"
echo "  (This directory is in .gitignore and won't be committed)"
