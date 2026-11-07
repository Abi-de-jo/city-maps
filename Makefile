REGION ?= trichy
export REGION

.DEFAULT_GOAL := help

.PHONY: help fetch dem tiles basemap up down logs clean

help: ## Show available targets
	@echo "Usage: make <target> [REGION=<slug>]   (current REGION=$(REGION))"
	@echo ""
	@echo "  fetch     Download + clip the OSM extract for the region"
	@echo "  dem       Fetch Copernicus DEM tiles (optional, for routing)"
	@echo "  tiles     Build the PMTiles basemap"
	@echo "  basemap   fetch + tiles (the fast path to a visible map)"
	@echo "  up        Start the local stack (web + tiles via Caddy)"
	@echo "  down      Stop the local stack"
	@echo "  logs      Tail stack logs"
	@echo "  clean     Delete the region's build output"

fetch: ## Download + clip OSM
	@scripts/fetch-osm.sh

dem: ## Fetch DEM tiles
	@scripts/fetch-dem.sh

tiles: ## Build PMTiles basemap
	@scripts/build-tiles.sh

basemap: fetch tiles ## Convenience: fetch + tiles

up: ## Start local stack
	@docker compose up -d

down: ## Stop local stack
	@docker compose down

logs: ## Tail logs
	@docker compose logs -f

clean: ## Remove region build output
	@rm -rf data/$(REGION) && echo "removed data/$(REGION)"
