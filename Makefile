VERSION ?=

.PHONY: publish

publish:
	@if [ -z "$(VERSION)" ]; then \
		echo "Usage: make publish VERSION=v1.0.0"; \
		exit 64; \
	fi
	@./scripts/publish-images.sh "$(VERSION)"
