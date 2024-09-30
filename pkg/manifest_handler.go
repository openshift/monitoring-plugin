package server

import (
	"net/http"
	"os"
	"path/filepath"

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

func patchManifest(feature string, originalData []byte) []byte {
	stringData := string(originalData)
	if feature == "acm" {
		patchedData, err := sjson.Set(stringData, "name", "monitoring-console-plugin")
		if err != nil {
			return originalData
		}
		return []byte(patchedData)
	}
	return []byte(stringData)
}
