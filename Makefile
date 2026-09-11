IMAGE_NAME ?= openrouter-dashboard
CONTAINER_NAME ?= openrouter-dashboard
PORT ?= 8080

# Detect container tool (defaults to docker if available, else podman)
DOCKER_ENGINE ?= $(shell which docker 2>/dev/null || which podman 2>/dev/null || echo docker)
PODMAN_ENGINE ?= $(shell which podman 2>/dev/null || which docker 2>/dev/null || echo podman)

.PHONY: help container run stop clean logs build-app

help:
	@echo "OpenRouter Dashboard Container Management"
	@echo "-----------------------------------------"
	@echo "  make container - Build static assets & container image"
	@echo "  make run       - Start container with podman on http://localhost:$(PORT)"
	@echo "  make stop      - Stop the running container"
	@echo "  make logs      - View container logs"
	@echo "  make clean     - Stop container and remove image"

build-app:
	@echo "Building web application static assets..."
	npm run build

container: build-app
	@echo "Building container image '$(IMAGE_NAME)' using $(DOCKER_ENGINE)..."
	$(DOCKER_ENGINE) build -t $(IMAGE_NAME) .

run:
	@echo "Starting container '$(CONTAINER_NAME)' using $(PODMAN_ENGINE) on http://localhost:$(PORT)..."
	$(PODMAN_ENGINE) run -d --rm --name $(CONTAINER_NAME) -p $(PORT):80 $(IMAGE_NAME)
	@echo "Dashboard active at: http://localhost:$(PORT)"

stop:
	@echo "Stopping container '$(CONTAINER_NAME)'..."
	-$(PODMAN_ENGINE) stop $(CONTAINER_NAME)

logs:
	$(PODMAN_ENGINE) logs -f $(CONTAINER_NAME)

clean: stop
	@echo "Removing image '$(IMAGE_NAME)'..."
	-$(PODMAN_ENGINE) rmi $(IMAGE_NAME)
