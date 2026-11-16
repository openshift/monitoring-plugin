package api

import (
	"encoding/json"
	"fmt"
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
	if r.Status != StatusSuccess {
		log.Error(fmt.Sprintf("type=%s, error=%s", r.ErrorType, r.Error))
	}

	bytes, err := json.Marshal(r)
	if err != nil {
		log.Error(err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(bytes)
}
