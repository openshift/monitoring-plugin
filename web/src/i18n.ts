import i18n from 'i18next';
import httpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

i18n
  .use(httpBackend)
  .use(initReactI18next)
  .init({
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    contextSeparator: '~',
    debug: false,
    defaultNS: 'public',
    fallbackLng: 'en',
    keySeparator: false,
    lng: 'en',
    load: 'languageOnly',
    missingKeyHandler: function (lng, ns, key) {
      // eslint-disable-next-line no-console
      console.error(
        // eslint-disable-next-line max-len
        `Missing i18n key "${key}" in namespace "${ns}" and language "${lng}" from the monitoring-plugin.`,
      );
    },
    ns: [process.env.I18N_NAMESPACE],
    nsSeparator: '~',
    react: {
      useSuspense: true,
      transSupportBasicHtmlNodes: true,
    },
    saveMissing: true,
  });

export default i18n;
