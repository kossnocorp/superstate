# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning].

This change log follows the format documented in [Keep a CHANGELOG].

[semantic versioning]: http://semver.org/
[keep a changelog]: http://keepachangelog.com/

## v1.0.0-beta.3 - 2024-04-??

### Changed

- **BREAKING**: Sending events with the condition as a separate argument is no longer supported. `.send("event()", "condition")` -> `.send("event(condition)")`

## v1.0.0-beta.2 - 2024-04-11

### Added

- Added `superstate/mermaid` submodule with `toMermaid` function to covert a statechart to Mermaid format. [See README](https://github.com/kossnocorp/superstate#mermaid).

### Fixed

- Fixed factory's `sub` property types.

- Fixed `exports` in `package.json`

## v1.0.0-beta.1 - 2024-04-10

Initial beta version
