#!/bin/bash
# Clean Cypress test artifacts (screenshots, videos, reports)
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

rm -f "$SCRIPT_DIR/screenshots/cypress_report_"*.json
rm -f "$SCRIPT_DIR/screenshots/merged-report.json"
rm -rf "$SCRIPT_DIR/cypress/screenshots/"*
rm -rf "$SCRIPT_DIR/cypress/videos/"*
