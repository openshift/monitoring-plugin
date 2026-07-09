package server

import (
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

func patchManifest(baseManifestData []byte, cfg *Config) []byte {
	patchedManifest := baseManifestData

	if cfg.Features[Incidents] || cfg.Features[ClusterHealthAnalyzer] {
		patchedManifest = performPatch(patchedManifest, filepath.Join(cfg.ConfigPath, "cluster-health-analyzer.patch.json"))
	}

	if cfg.Features[Alerting] || cfg.Features[LegacyDashboards] || cfg.Features[Metrics] || cfg.Features[Targets] {
		patchedManifest = performPatch(patchedManifest, filepath.Join(cfg.ConfigPath, "monitoring-plugin.patch.json"))
	}

	if cfg.Features[Incidents] || cfg.Features[ClusterHealthAnalyzer] || cfg.Features[PersesDashboards] || cfg.Features[AcmAlerting] {
		patchedManifest = performPatch(patchedManifest, filepath.Join(cfg.ConfigPath, "monitoring-console-plugin.patch.json"))
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
