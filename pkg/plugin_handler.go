package server

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/sirupsen/logrus"
	"github.com/tidwall/sjson"
)

var mlog = logrus.WithField("module", "manifest")

func manifestHandler(cfg *Config) http.HandlerFunc {
	baseManifestData, err := os.ReadFile(filepath.Join(cfg.ConfigPath, "plugin-manifest.json"))
	if err != nil {
		mlog.WithError(err).Error("cannot read base manifest file")
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		})
	}

	patchedManifest := baseManifestData

	for feature := range cfg.Features {
		if cfg.Features[feature] {
			patchedManifest = patchManifest(feature, patchedManifest)
		}
	}

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
	baseEntryData, err := os.ReadFile(filepath.Join(cfg.ConfigPath, "plugin-entry.js"))
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

func patchManifest(feature Feature, originalData []byte) []byte {
	stringData := string(originalData)
	if feature == AcmAlerting {
		patchedData, err := sjson.Set(stringData, "name", "monitoring-console-plugin")
		if err != nil {
			return originalData
		}
		return []byte(patchedData)
	}
	return []byte(stringData)
}
