# Translation process

Translations for this project are managed using [Memsource](https://cloud.memsource.com/). The general process for handling translations is as follows:

## Pre-requisites

- Install the [unofficial Memsource CLI client](https://github.com/unofficial-memsource/memsource-cli-client#pip-install).
- [Configure it with your Memsource login info](https://github.com/unofficial-memsource/memsource-cli-client#configuration-red-hat-enterprise-linux-derivatives).

Once your login info is configured, you should be able to log in by running `source ~/.memsourcerc`.

## Translation workflow

1. **Navigate to the `web` folder**: `cd web`
1. **Generate english translations**: run `npm run i18n` to extract translatable strings from the codebase and generate/update the English translation files.
1. **Commit english translations**: commit and push the updated English translation files to the repository.
1. **Login to Memsource**: run `source ~/.memsourcerc` to authenticate the Memsource CLI client.
1. **Upload to Memsource**: run `./i18n-scripts/memsource-upload.sh -v <version> -s <sprint>`, in which `<version>` is the OCP version and `<sprint>` is the current sprint, for example `./memsource-upload.sh -v 4.21 -s 258`. This will generate `.po` files required by Memsource for every language listed in `i18n-scripts/languages.sh` and upload them to Memsource. Every time translations are required a new project should be created in Memsource, this is handled automatically by the script.
1. **Note the Memsource project link**: After the upload is complete, the script will output the Memsource project link. Make sure to copy it for the next step.
1. **Translate in Memsource**: Send an email to the globalization team `localization-requests@redhat.com` with CC to `team-observability-ui@redhat.com` with the Memsource project link and request translation for the required languages.
1. **Wait for translation completion**: Accessing memsource you can monitor the progress of the translations.
1. **Download translations**: once the translations are completed, run `./i18n-scripts/memsource-download.sh -p <project_id>` to download the translated `.po` files from Memsource and convert them back to the i18n JSON format used by the application.
