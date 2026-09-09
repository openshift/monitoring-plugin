#!/bin/bash

CHANGED_FILES=$(git diff --name-only origin/main...HEAD)

RUN_ALL=false
declare -A TAGS_TO_RUN

# Create frontend folder to tag map
declare -A FEATURE_MAP
FEATURE_MAP["incidents"]="@cluster-health-analyzer"
FEATURE_MAP["alerts"]="@alerting"
FEATURE_MAP["legacy-dashboards"]="@legacy-dashboards"
FEATURE_MAP["metrics"]="@metrics"
FEATURE_MAP["perses-dashboards"]="@perses-dashboards"
FEATURE_MAP["targets"]="@targets"

for FILE in $CHANGED_FILES; do

    # Check if any file is outside of web/src/features/
    if [[ ! "$FILE" =~ ^web/src/features/ ]]; then
        echo "Global or shared file changed: $FILE"
        RUN_ALL=true
        break
    fi

    # File is in features and looks like: web/src/features/incidents/components/App.tsx
    # awk splits by '/' and grabs the 4th segment
    FEATURE_DIR=$(echo "$FILE" | awk -F'/' '{print $4}')
    CYPRESS_TAG=${FEATURE_MAP[$FEATURE_DIR]}

    if [ -n "$CYPRESS_TAG" ]; then
        TAGS_TO_RUN["$CYPRESS_TAG"]=1
    else
        echo "Error: Unmapped feature directory changed: $FEATURE_DIR"
        exit 1
    fi
done

if [ "$RUN_ALL" = true ]; then
    echo "Changes affect global scope or unmapped features. Running ALL monitoring tests..."

    DEFAULT_TAGS="@alerting @legacy-dashboards @metrics @targets acm-alerting @cluster-health-analyzer @perses-dashboards --@flaky --@xfail"
    npm run test-cypress-monitoring:base -- --env grepTags="${DEFAULT_TAGS}"
else
    UNIQUE_TAGS=("${!TAGS_TO_RUN[@]}")

    if [ ${#UNIQUE_TAGS[@]} -eq 0 ]; then
        echo "No relevant source files changed. Skipping tests."
        exit 0
    fi

    FEATURE_TAGS=$(
        IFS=" "
        echo "${UNIQUE_TAGS[*]}"
    )

    GREP_TAGS="${FEATURE_TAGS} --@flaky --@xfail"

    echo "Running specific tests for tags: $GREP_TAGS"

    npm run test-cypress-monitoring:base -- --env grepTags="${GREP_TAGS}"
fi
