IMAGE_NAME = "website"
PWD = $(shell pwd)
VENV_BIN = $(PWD)/venv/bin
PYTHON = $(VENV_BIN)/python3

.PHONY: help
help:
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	| sed -n 's/^\(.*\): \(.*\)## \(.*\)/\1;\3/p' \
	| column -t  -s ';'

.PHONY: extractmessages
extractmessages: ## generate locale files
	$(VENV_BIN)/pybabel extract -F babel.cfg -o messages.pot .
	$(VENV_BIN)/pybabel update -i messages.pot -d locale
	rm messages.pot

.PHONY: compilemessages
compilemessages:  ## compile locale files
	$(VENV_BIN)/pybabel compile -d locale

.PHONY: run
run:  ## run debug server
	FLASK_DEBUG=1 $(PYTHON) app.py

.PHONY: build
build:  ## build static website
	SITE_LANG=en $(PYTHON) freeze.py
