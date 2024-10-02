package server

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	jsonpatch "github.com/evanphx/json-patch"
	"github.com/sirupsen/logrus"
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

	patchedManifest := performPatch(baseManifestData, filepath.Join(cfg.ConfigPath, "clear-extensions.patch.json"))

	for feature := range cfg.Features {
		patchedManifest = performPatch(patchedManifest, filepath.Join(cfg.ConfigPath, fmt.Sprintf("%s.patch.json", feature)))
	}

	return []byte(patchedManifest)
}

func performPatch(originalData []byte, patchFilePath string) []byte {
	patchData, err := os.ReadFile(patchFilePath)
	if err != nil {
		mlog.WithField("reason", err).Warnf("cannot read patch file %s", patchFilePath)
		return originalData
	}

	patch, err := jsonpatch.DecodePatch(patchData)
	if err != nil {
		mlog.WithField("reason", err).Warnf("cannot decode patch data %s", patchData)
		return originalData
	}

	patchedManifest, err := patch.ApplyIndent(originalData, " ")
	if err != nil {
		mlog.WithError(err).Error("cannot patch base manifest file")
		return originalData
	}

	return patchedManifest
}
