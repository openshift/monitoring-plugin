package server

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	jsonpatch "github.com/evanphx/json-patch"
	"github.com/sirupsen/logrus"
)

var mlog = logrus.WithField("module", "manifest")

func manifestHandler(cfg *Config) http.HandlerFunc {
	baseManifestData, err := os.ReadFile(filepath.Join(cfg.StaticPath, "plugin-manifest.json"))
	if err != nil {
		mlog.WithError(errors.Unwrap(err)).Error("cannot read base manifest file")
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "cannot read base manifest file", http.StatusInternalServerError)
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

func patchManifest(baseManifestData []byte, cfg *Config) []byte {
	if len(cfg.Features) == 0 {
		return baseManifestData
	}

	patchedManifest := baseManifestData
	if !cfg.Features[DevConfig] {
		// Don't clear the extensions when running in dev mode, so only 1 instance of the monitoring-plugin
		// can be run as a development environment
		patchedManifest = performPatch(baseManifestData, filepath.Join(cfg.ConfigPath, "clear-extensions.patch.json"))
	}

	if cfg.Features[Incidents] || cfg.Features[ClusterHealthAnalyzer] {
		patchedManifest = performPatch(patchedManifest, filepath.Join(cfg.ConfigPath, "cluster-health-analyzer.patch.json"))
	}

	for feature := range cfg.Features {
		if feature == ClusterHealthAnalyzer || feature == Incidents {
			continue
		}
		patchedManifest = performPatch(patchedManifest, filepath.Join(cfg.ConfigPath, fmt.Sprintf("%s.patch.json", feature)))
	}

	return []byte(patchedManifest)
}

func performPatch(originalData []byte, patchFilePath string) []byte {
	patchData, err := os.ReadFile(patchFilePath)
	if err != nil {
		mlog.WithError(errors.Unwrap(err)).Warnf("cannot read patch file %q", filepath.Base(patchFilePath))
		return originalData
	}

	patch, err := jsonpatch.DecodePatch(patchData)
	if err != nil {
		mlog.WithError(err).Warnf("cannot decode patch file %q", filepath.Base(patchFilePath))
		return originalData
	}

	patchedManifest, err := patch.ApplyIndent(originalData, " ")
	if err != nil {
		mlog.WithError(err).Error("cannot patch base manifest file")
		return originalData
	}

	return patchedManifest
}
