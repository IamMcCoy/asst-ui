# Makefile for Assistant UI Docker operations

# Variables - can be overridden via command line
IMAGE_NAME ?= saus-frontend
TAG ?= v0.9.0
CONTAINER_NAME ?= saus-frontend-container
PORT ?= 80
HOST_PORT ?= 8080

# Runtime environment variables (injected at container startup)
API_URL ?= http://10.1.35.73:39990
USER_ID ?= demo-user

# Docker registry (for push/pull)
REGISTRY ?=
REGISTRY_IMAGE = $(if $(REGISTRY),$(REGISTRY)/,)$(IMAGE_NAME):$(TAG)

# Full image name
IMAGE_TAG = $(IMAGE_NAME):$(TAG)
TAR_FILE = $(IMAGE_NAME)-$(TAG).tar

.PHONY: help build run run-bg stop clean logs restart ps deploy save load push pull

# Default target
help:
	@echo "Assistant UI Docker Management"
	@echo ""
	@echo "Available targets:"
	@echo ""
	@echo "Local Development:"
	@echo "  make build         - Build docker image"
	@echo "  make run           - Run container in foreground"
	@echo "  make run-bg        - Run container in background"
	@echo "  make stop          - Stop and remove container"
	@echo "  make clean         - Remove container and image"
	@echo "  make logs          - Show container logs"
	@echo "  make restart       - Restart container"
	@echo "  make ps            - Show running containers"
	@echo "  make deploy        - Build and run in background"
	@echo ""
	@echo "Image Distribution:"
	@echo "  make save          - Export image to tar file"
	@echo "  make load          - Import image from tar file"
	@echo "  make push          - Push image to registry"
	@echo "  make pull          - Pull image from registry"
	@echo ""
	@echo "Customization examples:"
	@echo "  make build TAG=v1.0.0"
	@echo "  make run-bg HOST_PORT=3000 API_URL=http://api.example.com:8000 USER_ID=prod-user"
	@echo "  make deploy TAG=prod API_URL=http://production-api:8000"
	@echo "  make save TAG=v1.0.0"
	@echo "  make push REGISTRY=your-username TAG=v1.0.0"

# Build docker image (no build args needed - env vars injected at runtime)
build:
	@echo "Building docker image: $(IMAGE_TAG) (linux/amd64)"
	docker build --platform linux/amd64 -t $(IMAGE_TAG) .
	@echo "Build complete: $(IMAGE_TAG)"
	@echo "Note: Environment variables will be injected at runtime"

# Run container in foreground (useful for debugging)
run: stop
	@echo "Running container: $(CONTAINER_NAME)"
	@echo "API_URL: $(API_URL)"
	@echo "USER_ID: $(USER_ID)"
	@echo "Access at: http://localhost:$(HOST_PORT)"
	docker run --rm \
		-p $(HOST_PORT):$(PORT) \
		-e REACT_APP_API_BASE_URL=$(API_URL) \
		-e REACT_APP_USER_ID=$(USER_ID) \
		--name $(CONTAINER_NAME) \
		$(IMAGE_TAG)

# Run container in background
run-bg: stop
	@echo "Running container in background: $(CONTAINER_NAME)"
	@echo "API_URL: $(API_URL)"
	@echo "USER_ID: $(USER_ID)"
	@echo "Access at: http://localhost:$(HOST_PORT)"
	docker run -d \
		-p $(HOST_PORT):$(PORT) \
		-e REACT_APP_API_BASE_URL=$(API_URL) \
		-e REACT_APP_USER_ID=$(USER_ID) \
		--name $(CONTAINER_NAME) \
		$(IMAGE_TAG)
	@echo "Container started. Use 'make logs' to view logs"

# Stop and remove container
stop:
	@if [ $$(docker ps -aq -f name=$(CONTAINER_NAME)) ]; then \
		echo "Stopping container: $(CONTAINER_NAME)"; \
		docker stop $(CONTAINER_NAME) 2>/dev/null || true; \
		docker rm $(CONTAINER_NAME) 2>/dev/null || true; \
	else \
		echo "Container $(CONTAINER_NAME) not found"; \
	fi

# Remove container and image
clean: stop
	@echo "Removing image: $(IMAGE_TAG)"
	@docker rmi $(IMAGE_TAG) 2>/dev/null || echo "Image not found"
	@echo "Clean complete"

# Show container logs
logs:
	@docker logs -f $(CONTAINER_NAME)

# Restart container
restart: stop run-bg

# Show running containers
ps:
	@docker ps -a -f name=$(CONTAINER_NAME)

# Quick deploy: build and run in background
deploy: build run-bg
	@echo "Deployment complete!"

# Save image to tar file for transfer
save:
	@echo "Saving image to: $(TAR_FILE)"
	docker save $(IMAGE_TAG) -o $(TAR_FILE)
	@ls -lh $(TAR_FILE)
	@echo "Image saved successfully!"
	@echo ""
	@echo "To transfer to remote server:"
	@echo "  scp $(TAR_FILE) user@server:/path/to/destination/"
	@echo ""
	@echo "On remote server, run:"
	@echo "  docker load -i $(TAR_FILE)"

# Load image from tar file
load:
	@if [ ! -f "$(TAR_FILE)" ]; then \
		echo "Error: $(TAR_FILE) not found"; \
		exit 1; \
	fi
	@echo "Loading image from: $(TAR_FILE)"
	docker load -i $(TAR_FILE)
	@echo "Image loaded successfully!"

# Push image to Docker registry
push:
	@if [ -z "$(REGISTRY)" ]; then \
		echo "Error: REGISTRY not set"; \
		echo "Usage: make push REGISTRY=your-username"; \
		exit 1; \
	fi
	@echo "Tagging image: $(REGISTRY_IMAGE)"
	docker tag $(IMAGE_TAG) $(REGISTRY_IMAGE)
	@echo "Pushing to registry: $(REGISTRY_IMAGE)"
	docker push $(REGISTRY_IMAGE)
	@echo "Push complete!"

# Pull image from Docker registry
pull:
	@if [ -z "$(REGISTRY)" ]; then \
		echo "Error: REGISTRY not set"; \
		echo "Usage: make pull REGISTRY=your-username"; \
		exit 1; \
	fi
	@echo "Pulling from registry: $(REGISTRY_IMAGE)"
	docker pull $(REGISTRY_IMAGE)
	docker tag $(REGISTRY_IMAGE) $(IMAGE_TAG)
	@echo "Pull complete!"
