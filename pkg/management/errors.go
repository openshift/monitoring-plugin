package management

import "fmt"

type NotFoundError struct {
	Resource string
	Id       string

	AdditionalInfo string
}

func (r *NotFoundError) Error() string {
	s := fmt.Sprintf("%s with id %s not found", r.Resource, r.Id)

	if r.AdditionalInfo != "" {
		s += fmt.Sprintf(": %s", r.AdditionalInfo)
	}

	return s
}

type NotAllowedError struct {
	Message string
}

func (r *NotAllowedError) Error() string {
	return r.Message
}
