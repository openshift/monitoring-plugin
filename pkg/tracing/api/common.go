package api

import (
	"encoding/json"
	"net/http"
)

type Response struct {
	Status    StatusType `json:"status"`
	ErrorType string     `json:"errorType,omitempty"`
	Error     string     `json:"error,omitempty"`
	Data      any        `json:"data,omitempty"`
}

type StatusType string

const (
	StatusSuccess StatusType = "success"
	StatusError   StatusType = "error"
)

func writeResponse(w http.ResponseWriter, code int, r Response) {
	bytes, err := json.Marshal(r)
	if err != nil {
		log.WithError(err).Error("cannot marshal response")
		http.Error(w, "cannot marshal response", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(bytes)
}
