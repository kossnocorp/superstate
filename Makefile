test:
	@npx vitest run

test-watch:
	@npx vitest

types:
	@npx tsc --noEmit

types-watch:
	@npx tsc --noEmit --watch

size:
	@npx size-limit

size-watch:
	@npx nodemon --exec "size-limit"

benchmark:
	@bun ./benchmark.ts

build: prepare-build
	@npx tsc -p tsconfig.json 
	@node copy.mjs
	
build-watch: prepare-build
	@npx tsc -p tsconfig.json --watch &
	@node copy.mjs --watch

prepare-build:
	@rm -rf lib/*
	@mkdir -p lib

publish: build
	@cd lib && npm publish --access public

link:
	@cd lib && npm link