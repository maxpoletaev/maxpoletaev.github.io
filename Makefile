IMAGE_NAME = "website"
PWD = $(shell pwd)

.PHONY: extractmessages
extractmessages:
	pybabel extract -F babel.cfg -o messages.pot .
	pybabel update -i messages.pot -d locale
	rm messages.pot

.PHONY: compilemessages
compilemessages:
	pybabel compile -d locale

.PHONY: run
run:
	FLASK_DEBUG=1 python3 app.py

.PHONY: build
build:
	SITE_LANG=en python3 freeze.py
