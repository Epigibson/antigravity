package main

import (
	"fmt"
	"os"
	"github.com/nexus-dev/nexus/internal/adapter/repository"
	"github.com/nexus-dev/nexus/internal/domain"
)

func main() {
	client := repository.NewAPIClient("https://compassionate-youth-production-e13c.up.railway.app")
	if !client.IsAuthenticated() {
		fmt.Println("Not authenticated")
		return
	}

	err := client.Log(domain.AuditEntry{
		Action:      domain.AuditActionSwitch,
		ProjectName: "Project Switcher",
		Environment: "dev",
		Message:     "Testing manual push from agent",
		Success:     true,
		DurationMs:  123,
	})
	
	if err != nil {
		fmt.Printf("ERROR: %v\n", err)
	} else {
		fmt.Println("SUCCESS")
	}
}
