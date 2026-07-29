package server

import (
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
	features := cfg.Features
	patches := []struct {
		file    string
		enabled bool
	}{
		{"monitoring-plugin.patch.json", features[Alerting] || features[LegacyDashboards] || features[Metrics] || features[Targets]},
		{"alerting.patch.json", features[Alerting]},
		{"metrics.patch.json", features[Metrics]},
		{"legacy-dashboards.patch.json", features[LegacyDashboards]},
		{"targets.patch.json", features[Targets]},
		{"monitoring-console-plugin.patch.json", features[Incidents] || features[ClusterHealthAnalyzer] || features[PersesDashboards] || features[AcmAlerting]},
		{"acm-alerting.patch.json", features[AcmAlerting]},
		{"cluster-health-analyzer.patch.json", features[Incidents] || features[ClusterHealthAnalyzer]},
		{"perses-dashboards.patch.json", features[PersesDashboards]},
	}

	patchedManifest := baseManifestData
	for _, p := range patches {
		if p.enabled {
			patchedManifest = performPatch(patchedManifest, filepath.Join(cfg.ConfigPath, p.file))
		}
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
