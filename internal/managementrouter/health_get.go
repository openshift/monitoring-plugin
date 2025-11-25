package managementrouter

import (
	"encoding/json"
	"net/http"
)

type GetHealthResponse struct {
	Status string `json:"status"`
}

func (hr *httpRouter) GetHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(GetHealthResponse{Status: "ok"})
}
