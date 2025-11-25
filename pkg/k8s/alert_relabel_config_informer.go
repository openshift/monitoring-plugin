package k8s

import (
	"context"
	"log"

	osmv1 "github.com/openshift/api/monitoring/v1"
	osmv1client "github.com/openshift/client-go/monitoring/clientset/versioned"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
)

type alertRelabelConfigInformer struct {
	clientset *osmv1client.Clientset
}

func newAlertRelabelConfigInformer(clientset *osmv1client.Clientset) AlertRelabelConfigInformerInterface {
	return &alertRelabelConfigInformer{
		clientset: clientset,
	}
}

func (arci *alertRelabelConfigInformer) Run(ctx context.Context, callbacks AlertRelabelConfigInformerCallback) error {
	options := metav1.ListOptions{
		Watch: true,
	}

	watcher, err := arci.clientset.MonitoringV1().AlertRelabelConfigs("").Watch(ctx, options)
	if err != nil {
		return err
	}
	defer watcher.Stop()

	ch := watcher.ResultChan()
	for event := range ch {
		arc, ok := event.Object.(*osmv1.AlertRelabelConfig)
		if !ok {
			log.Printf("Unexpected type: %v", event.Object)
			continue
		}

		switch event.Type {
		case watch.Added:
			if callbacks.OnAdd != nil {
				callbacks.OnAdd(arc)
			}
		case watch.Modified:
			if callbacks.OnUpdate != nil {
				callbacks.OnUpdate(arc)
			}
		case watch.Deleted:
			if callbacks.OnDelete != nil {
				callbacks.OnDelete(arc)
			}
		case watch.Error:
			log.Printf("Error occurred while watching AlertRelabelConfig: %s\n", event.Object)
		}
	}

	log.Fatalf("AlertRelabelConfig watcher channel closed unexpectedly")
	return nil
}
