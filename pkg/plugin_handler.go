package server

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/sirupsen/logrus"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

var mlog = logrus.WithField("module", "manifest")

func manifestHandler(cfg *Config) http.HandlerFunc {
	baseManifestData, err := os.ReadFile(filepath.Join(cfg.StaticPath, "plugin-manifest.json"))
	if err != nil {
		mlog.WithError(err).Error("cannot read base manifest file")
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		})
	}

	patchedManifest := patchManifest(baseManifestData, cfg)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Expires", "0")

		w.Write(patchedManifest)
	})
}

// We can either update the plugin-entry at runtime (like this) or we can update the
// it at compile time, but that would require building a separate image, which I believe is
// undesired.
func entryHandler(cfg *Config) http.HandlerFunc {
	baseEntryData, err := os.ReadFile(filepath.Join(cfg.StaticPath, "plugin-entry.js"))
	if err != nil {
		mlog.WithError(err).Error("cannot read base entry file")
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		})
	}

	baseEntryString := string(baseEntryData)

	patchedEntryString := strings.ReplaceAll(baseEntryString, "monitoring-plugin", "monitoring-console-plugin")
	patchedEntryData := []byte(patchedEntryString)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Expires", "0")

		w.Write(patchedEntryData)
	})
}

func patchManifest(baseManifestData []byte, cfg *Config) []byte {
	if len(cfg.Features) == 0 {
		return baseManifestData
	}

	patchedManifest := string(baseManifestData)
	mcpManifest := patchedManifest
	mcpManifest, err := sjson.Set(mcpManifest, "name", "monitoring-console-plugin")
	if err != nil {
		log.Warn("Unable to modify extension name, defaulting to serving monitoring-plugin")
		return baseManifestData
	}

	// Go is pretty strict about defining structs for how data is formatted
	// when you read in json or other formats. However the extension structure
	// is very large, and I don't think it make sense to bring the entire
	// thing over into go, especially since it can be a moving target. This
	// does some very simple string formatting to get around needing to bring
	// over the entire structure
	featureExtensionJson := "["
	for feature := range cfg.Features {
		featureExtensions := addFeatureManifest(feature, cfg)
		featureExtensions.ForEach(func(_, value gjson.Result) bool {
			featureExtensionJson = featureExtensionJson + value.Raw + ","
			return true
		})
	}
	featureExtensionJson = strings.TrimSuffix(featureExtensionJson, ",") + "\n]"

	mcpManifest, err = sjson.SetRaw(mcpManifest, "extensions", featureExtensionJson)
	if err != nil {
		log.Warn("Unable to modify plugin extensions, defaulting to serting monitoring-plugin")
		return baseManifestData
	}

	return []byte(mcpManifest)
}

func addFeatureManifest(feature Feature, cfg *Config) gjson.Result {
	acmAlertingFeatures, err := os.ReadFile(filepath.Join(cfg.ConfigPath, fmt.Sprintf("%s.json", feature)))
	if err != nil {
		log.Warn(fmt.Sprintf("Unable to find feature file for feature %s. Features extensions won't be available", feature))
		return gjson.Result{}
	}

	return gjson.Get(string(acmAlertingFeatures), "extensions")
}
