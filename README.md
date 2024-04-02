# Superstate

A JavaScript statecharts library that is:

- End-to-end type-safe
- Easy to read without visualization
- Highly composable
- Lightweight and fast

Take a look:

```ts
import { superstate } from "superstate";

type PlayerState = "stopped" | "playing" | "paused";

const playerState = superstate<PlayerState>("mediaPlayer")
  .state("stopped", "play() -> playing")
  .state("playing", ["pause() -> paused", "stop() -> stopped"], ($) =>
    $.sub("volume", volumeState)
  )
  .state("paused", ["play() -> playing", "stop() -> stopped"]);

type VolumeState = "low" | "medium" | "high";

const volumeState = superstate<VolumeState>("volume")
  .state("low", "up() -> medium")
  .state("medium", ["up() -> high", "down() -> low"])
  .state("high", "down() -> medium");
```

Even without rendering a chart, it is easy to see the logic.

## Installation

Start by installing the package:

```sh
npm i superstate
```

## Getting started

Superstate is an implementation of the statecharts formalism [introduced by David Harel in 1987](https://www.sciencedirect.com/science/article/pii/0167642387900359). It adds hierarchy to state machines, making it possible to express complex logic without losing readability.

To get started, you only need to understand a few concepts:

- **State**: The available system states. Only a single state can be active at a time (e.g. `low` or `playing`).
- **Event**: What triggers _transitions_ between the system _states_ (e.g. `up()` or `play()`).
- **Transition**: The process of moving from one _state_ to another. It's coupled with the triggering _event_ and the next _state_ (e.g. `up() -> medium`).
- **Action**: What happens during _transitions_, upon entering or exiting a _state_ (e.g. `playMusic!`).

Everything else is built on top of these concepts.

### Basics

The `superstate` function creates a new statechart. It accepts the name, available states as the generic type and returns the builder object:

```ts
const volumeState = superstate<VolumeState>("volume")
  .state("low", "up() -> medium")
  .state("medium", ["up() -> high", "down() -> low"])
  .state("high", "down() -> medium");
```

The first state, `low`, is the initial state that the statechart will enter when it starts. The `state` method accepts the name and list of state traits—in this case—transitions.

The events that trigger state transitions are `up()` and `down()`. Events always have `()` at the end, which makes them easy to spot.

---

To use the machine, run the `host` method:

```ts
const volume = volumeState.host();

// Subscribe to the state changes:
volume.on(["low", "medium", "high"], (target) =>
  sound.setVolume(target.state.name)
);

// Trigger the events:
volume.send("up()");

// Check the current state:
if (volume.in("high")) console.log("The volume is at maximum.");
```

Using the `on` method you can listen to everything `*`, a single state or an event, or a combination of them:

```ts
// Listen to everything:
volume.on("*", (target) => {
  if (target.type === "state")
    console.log("State changed to", target.state.name);
  else console.log("Event triggered", target.event.name);
});

// Will trigger when the state is `low` or when `down()` is sent:
volume.on(["low", "down()"], () => {});
```

### Guards

Transitions can be guarded, allowing to have conditional transitions:

```ts
type PCState = "on" | "sleep" | "off";

const pcState = superstate<PCState>("pc")
  .state("off", "press() -> on")
  .state("on", ($) =>
    $.if("press", ["(long) -> off", "() -> sleep"]).on("restart() -> on")
  )
  .state("sleep", ($) =>
    $.if("press", ["(long) -> off", "() -> on"]).on("restart() -> on")
  );
```

In this example, we used the `if` method to guard the transitions. The `press` event has two transitions: one for a long press and another for a short press (else).

There are several ways to define state traits, and passing a function as the last argument is one of them. It allows for defining more complex logic.

To send an event with a condition, use the `send` method:

```ts
const pc = pcState.host();

// Send the long press event:
const nextState = pc.send("press()", "long");

// The next state is "off":
if (nextState) nextState.name satisfies "off";
```

Unless it's not in the `off` state, the `press` event will transition the statechart to the `off` state.

If you send the `press()` event without the condition, it might transition to the `sleep` or the `on` state:

```ts
// Send the press event:
const nextState = pc.send("press()");

// The next state is "sleep":
if (nextState) nextState.name satisfies "sleep" | "on";
```

---

**🚧 Work in progress, [follow for updates](https://twitter.com/kossnocorp)**

---

## Changelog

See [the changelog](./CHANGELOG.md).

## License

[MIT © Sasha Koss](https://kossnocorp.mit-license.org/)
