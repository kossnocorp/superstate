# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning].

This change log follows the format documented in [Keep a CHANGELOG].

[semantic versioning]: http://semver.org/
[keep a changelog]: http://keepachangelog.com/

## v1.0.0-beta.3 - 2024-04-??

### Changed

- **BREAKING**: Changed the send API from string-based to proxy-based: `.send("event()")` -> `.send.event()`. Condition is now a separate argument: `.send.event("condition")`. To send substate events, use the substate name as a prefix: `.send.os.event()`.

- **BREAKING**: The final state to parent transition definition now requires including the substate name into the source state: `.sub("os", osState, "terminated -> shutdown() -> off")` -> `.sub("os", osState, "os.terminated -> shutdown() -> off"))`.

### Added

- Added contexts support. [See README](https://github.com/kossnocorp/superstate#contexts).

## v1.0.0-beta.2 - 2024-04-11

### Added

- Added `superstate/mermaid` submodule with `toMermaid` function to covert a statechart to Mermaid format. [See README](https://github.com/kossnocorp/superstate#mermaid).

### Fixed

- Fixed factory's `sub` property types.

- Fixed `exports` in `package.json`

## v1.0.0-beta.1 - 2024-04-10

Initial beta version
