IMAGE_NAME ?= openrouter-dashboard
CONTAINER_NAME ?= openrouter-dashboard
PORT ?= 8080
# Host directory mounted into the container; "Write on disk" writes
# opencode.jsonc and plugins/image-generation.js here. Point it at another
# project's .opencode/ to configure that project.
OPENCODE_DIR ?= $(CURDIR)/.opencode
# Host directory for the daily OpenRouter snapshots (one .json.gz per day)
# behind the 2D Matrix timeline.
HISTORY_DIR ?= $(CURDIR)/history
# The server refetches when today's snapshot is older than this (0 = only
# when a browser loads the page).
HISTORY_FETCH_HOURS ?= 12

# This project uses podman (rootless) for building and running the image.
ENGINE ?= podman

.PHONY: help container run stop clean logs build-app install fake-history hf-params

help:
	@echo "OpenRouter Dashboard Container Management"
	@echo "-----------------------------------------"
	@echo "  make container - Build static assets & container image"
	@echo "  make run       - Start container on http://localhost:$(PORT), mounting $(OPENCODE_DIR)"
	@echo "  make stop      - Stop the running container"
	@echo "  make logs      - View container logs"
	@echo "  make clean     - Stop container and remove image"
	@echo "  make fake-history - Write 30 days of synthetic snapshots into $(HISTORY_DIR)"
	@echo "  make hf-params - Refresh parameter counts of open-weight models from Hugging Face"
	@echo "  make install   - Merge $(OPENCODE_DIR) into the user-wide OpenCode config (~/.config/opencode)"

build-app:
	@echo "Building web application static assets..."
	npm run build

container: build-app
	@echo "Building container image '$(IMAGE_NAME)' using $(ENGINE)..."
	$(ENGINE) build -t $(IMAGE_NAME) .

# Written files must belong to the host user: rootless podman needs keep-id
# (a plain --user would map to a subordinate uid).
# :Z relabels the volume for SELinux hosts and is ignored elsewhere.
USER_FLAGS = --userns=keep-id

run:
	@mkdir -p $(OPENCODE_DIR) $(HISTORY_DIR)
	@echo "Starting container '$(CONTAINER_NAME)' using $(ENGINE) on http://localhost:$(PORT)..."
	$(ENGINE) run -d --rm --name $(CONTAINER_NAME) -p $(PORT):8080 $(USER_FLAGS) \
		-v $(OPENCODE_DIR):/app/.opencode:Z -v $(HISTORY_DIR):/app/history:Z -e HISTORY_FETCH_HOURS=$(HISTORY_FETCH_HOURS) -e OPENCODE_DIR_HOST=$(OPENCODE_DIR) $(IMAGE_NAME)
	@echo "Dashboard active at: http://localhost:$(PORT)"

stop:
	@echo "Stopping container '$(CONTAINER_NAME)'..."
	-$(ENGINE) stop $(CONTAINER_NAME)

logs:
	$(ENGINE) logs -f $(CONTAINER_NAME)

clean: stop
	@echo "Removing image '$(IMAGE_NAME)'..."
	-$(ENGINE) rmi $(IMAGE_NAME)

# Install the generated config user-wide: merges $(OPENCODE_DIR)/opencode.jsonc
# into ~/.config/opencode/opencode.jsonc and copies the plugin (see
# scripts/setup-user-config). Run "Write on disk" first to refresh $(OPENCODE_DIR).
install:
	scripts/setup-user-config $(OPENCODE_DIR)

# Synthetic snapshots for the last 30 days (before today), derived from the
# bundled src/data/snapshot.json. Never overwrites a real (non-synthetic) record.
fake-history:
	HISTORY_DIR=$(HISTORY_DIR) node scripts/generate-fake-history.ts

# Parameter counts / licences of open-weight models (the matrix's VRAM bubble
# size) from the Hugging Face Hub into src/data/hfModels.json.
hf-params:
	node scripts/fetch-hf-params.ts
