package management

import "fmt"

type NotFoundError struct {
	Resource string
	Id       string
}

func (r *NotFoundError) Error() string {
	return fmt.Sprintf("%s with id %s not found", r.Resource, r.Id)
}

type NotAllowedError struct {
	Message string
}

func (r *NotAllowedError) Error() string {
	return r.Message
}
