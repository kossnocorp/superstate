<div align="center">
  <img alt="Superstate logo" height="256" src="./logo.svg" />

  <h1>Superstate</h1>

  <h3>Type-safe JavaScript statecharts library</h3>

  <div>
    🔒 End-to-end type-safe
    🎯 Easy to read without visualization
    <br/>
    🧩 Highly composable
    ⚡ Lightweight (1.5kB) and fast
  </div>

  <br/>
  <hr />
</div>

Take a look:

```ts
import { superstate } from "superstate";

type PlayerState = "stopped" | "playing" | "paused";

const playerState = superstate<PlayerState>("player")
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

## Why?

There are many state machine and statechart libraries, including the industry leader [XState](https://stately.ai/docs/xstate). Why bother?

Superstate was [born out of my frustration with TypeScript](https://twitter.com/kossnocorp/status/1771855573304390085). It turned out that typing a graph-based API was an extremely tough challenge, which I bravely accepted.

As statecharts play a central role in any system, set to untangle what is tangled, having complete type-safety is crucial for the task. A typo or unintended usage might ultimately break the app, so the type system must always warn you about the problem.

One reason typing such an API is problematic is the inherent composability of statecharts. This contributes to another problem — readability. That was another reason why I wanted to try my hand at it.

So, when I managed to design an API that is completely type-safe, easy to grasp without visualization, and composable, I thought it would be a crime not to give it a chance and ship it as a library.

So here we go.

## Getting started

### Installation

Start by installing the package:

```sh
npm i superstate
```

### Core concepts

Superstate is an implementation of the statecharts formalism [introduced by David Harel in 1987](https://www.sciencedirect.com/science/article/pii/0167642387900359). It adds hierarchy to state machines, making it possible to express complex logic without losing readability.

To get started, you only need to understand a few concepts:

- **State**: The available system states. Only a single state can be active at a time (e.g. `stopped` or `playing`). A state might have _substates_.
- **Event**: What triggers _transitions_ between the system _states_ (e.g. `up()` or `play()`). You send _events_ to control the system.
- **Transition**: The process of moving from one _state_ to another. It's coupled with the triggering _event_ and the next _state_ (e.g. `up() -> medium`).
- **Action**: What happens during _transitions_, upon entering or exiting a _state_ (e.g. `playMusic!`). _Actions_ call your code.

Everything else is built on top of these concepts.

All the concepts have consistent naming, enabling you to quickly distinguish them. For instance, _events_ have `()` at the end, and _actions_ have `!`. Flow of the system are defined with `->`.

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

// Subscribe to the state updates:
volume.on(["low", "medium", "high"], (target) =>
  sound.setVolume(target.state.name)
);

// Trigger the events:
volume.send("up()");

// Check the current state:
if (volume.in("high")) console.log("The volume is at maximum");
```

The method creates an instance of statechart. It's the object that you will interact with, which holds the actual state.

Using the `on` method you can listen to everything (`*`), a single state or an event, or a combination of them:

```ts
// Listen to everything:
volume.on("*", (target) => {
  if (target.type === "state") {
    console.log("State changed to", target.state.name);
  } else {
    console.log("Event triggered", target.transition.event);
  }
});

// Will trigger when the state is `low` or when `down()` is sent:
volume.on(["low", "down()"], (target) => {
  if (target.type === "state") {
    console.log("The volume is low");
  } else {
    console.log("The volume is going down");
  }
});
```

The `on` method returns `off` function that unsubscribes the listener:

```ts
const off = volume.on("low", () => {});

setTimeout(() => {
  // Unsubscribe the listener:
  off();
}, 1000);
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

In this example, we used the `if` method to guard the transitions. The `press` event might trigger one of the two transitions: a long press and another for a short press (else).

There are several ways to define state traits, and passing a function as the last argument is one of them. It allows for defining more complex logic.

---

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

// The next state is "sleep" or "on":
if (nextState) nextState.name satisfies "sleep" | "on";
```

### Actions

Actions allow you define side effects that happen when entering or exiting a state or during a transition.

While you trigger the events, the actions trigger your code:

```ts
type ButtonState = "off" | "on";

const buttonState = superstate<ButtonState>("button")
  .state("off", ["-> turnOff!", "press() -> on"])
  .state("on", ["-> turnOn!", "press() -> off"]);
```

You can notice that the state definitions include strings with `!` at the end, i.e., `turnOn!` and `turnOff!`. These are the actions.

They define what happens when the state is entered and force you to handle the side effects in your code when calling the `host` method:

```ts
// Bind the actions to code:
const button = buttonState.host({
  on: {
    "-> turnOn!": () => console.log("Turning on"),
  },
  off: {
    "-> turnOff!": () => console.log("Turning on"),
  },
});
```

In addition to enter actions (`-> turnOff!`), states can have exit actions (`turnOff! ->`), which are invoked right before the state is left:

```ts
// The on state invokes the enter and exit actions:
const buttonState = superstate<ButtonState>("button")
  .state("off", "press() -> on")
  .state("on", ["-> turnOn!", "press() -> off", "turnOff! ->"]);

const button = buttonState.host({
  on: {
    "-> turnOn!": () => console.log("Turning on"),
    "turnOff! ->": () => console.log("Turning off"),
  },
});
```

The transition actions (`press() -> turnOff! -> off`) are invoked during transitions, before calling the state's exit action (if any):

```ts
// Actions are invoked on transitions:
const buttonState = superstate<ButtonState>("button")
  .state("off", "press() -> turnOn! -> on")
  .state("on", "press() -> turnOff! -> off");

const button = buttonState.host({
  on: {
    "press() -> turnOff!": () => console.log("Turning on"),
  },
  off: {
    "press() -> turnOn!": () => console.log("Turning off"),
  },
});
```

Like with most Superstate API, there are several ways to define actions, allowing you to choose the right one for the situation.

The events and actions can be defined in the builder function or even mixed with the string-based definitions:

```ts
// Use the builder function to define the states:
const buttonState = superstate<ButtonState>("button")
  .state("on", ($) => $.enter("turnOn!").on("press() -> off").exit("turnOff!"))
  .state("off", ($) => $.on("press() -> on"));
```

### Substates

Substates are states that are nested within a parent state. A state might have multiple substates, making it a parallel state, representing concurrent logic:

```ts
type PlayerState = "stopped" | "playing" | "paused";

const playerState = superstate<PlayerState>("player")
  .state("stopped", "play() -> playing")
  .state("playing", ["pause() -> paused", "stop() -> stopped"], ($) =>
    // Nest the volume state as `volume`
    $.sub("volume", volumeState)
  )
  .state("paused", ["play() -> playing", "stop() -> stopped"]);

type VolumeState = "low" | "medium" | "high";

const volumeState = superstate<VolumeState>("volume")
  .state("low", "up() -> medium")
  .state("medium", ["up() -> high", "down() -> low"])
  .state("high", "down() -> medium");
```

In this example, we nest the `volumeState` inside the `playing` state. The `volumeState` will be initialized when the `playing` state is entered and will be destroyed when the `playing` state is exited.

You can send events, subscribe to updates, and access the substate from the parent state:

```ts
const player = playerState.host();

// Send events to the substate:
player.send("playing.volume.up()");

// Subscribe to the substate state updates:
player.on("playing.volume.low", (target) => console.log("The volume is low"));

// The parent state will have the substate as a property on `sub`:
const playingState = player.in("playing");
if (playingState) {
  // Access the substate:
  playingState.sub.volume.in("high");
}
```

A state can be final, representing the end of a statechart:

```ts
type OSState = "running" | "sleeping" | "terminated";

const osState = superstate<OSState>("running")
  .state("running", "terminate() -> terminated")
  .state("sleeping", ["wake() -> running", "terminate() -> terminated"])
  // Mark the terminated state as final
  .final("terminated");
```

When nesting such a state, the parent might connect the substate's final states through an event to a parent state, allowing for a more complex logic:

```ts
type PCState = "on" | "off";

const pcState = superstate<PCState>("pc")
  .state("off", "power() -> on")
  .state("on", ($) =>
    $.on("power() -> off")
      // Nest the OS state as `os` and connect the `terminated` state
      // through `shutdown()` event to `off` state of the parent.
      .sub("os", osState, "terminated -> shutdown() -> off")
  );
```

When the OS is terminated, the PC will automatically power off.

---

If a substate has actions, they must be binded when hosting the root statechart.

Look at this fairly complex statechart:

```ts
type OSState = "running" | "sleeping" | "terminated";

const osState = superstate<OSState>("running")
  .state("running", [
    "terminate() -> terminated",
    // Note sleep! action
    "sleep() -> sleep! -> sleeping",
  ])
  .state("sleeping", [
    // Note wake! action
    "wake() -> wake! -> running",
    "terminate() -> terminated",
  ])
  .final("terminated", "-> terminate!");

type PCState = "on" | "off";

const pcState = superstate<PCState>("pc")
  .state("off", "power() -> turnOn! -> on")
  .state("on", ($) =>
    // Here we add OS state as a substate
    $.on("power() -> turnOff! -> off").sub(
      "os",
      osState,
      "terminated -> shutdown() -> off"
    )
  );
```

The PC (personal computer) statechart nests OS (operating system). The OS has `sleep!` and `wake!` actions, so when we host the PC statechart, we must bind the `OS` actions as well:

```ts
const pc = pcState.host({
  on: {
    // Here we bind the substate's actions
    os: {
      running: {
        "sleep() -> sleep!": () => console.log("Sleeping"),
      },
      sleeping: {
        "wake() -> wake!": () => console.log("Waking up"),
      },
      terminated: {
        "-> terminate!": () => console.log("Terminating"),
      },
    },
    "power() -> turnOff!": () => console.log("Turning off"),
  },
  off: {
    "power() -> turnOn!": () => console.log("Turning on"),
  },
});
```

## API

The main entry point of the Superstate API is the [`superstate`](#superstate) function that initiates a statechart creation. It returns [the builder object](#builder).

Once initiated, the API has three modes of operation:

- [Builder](#builder) - the object that allows defining state properties. Once all the states are defined, the builder turns into [the factory object](#factory).

- [Factory](#factory) - the object that creates [statechart instances](#instance) and holds the statechart information. It can be used as a substate.

- [Instance](#intance) - the statechart instance created by [the factory](#factory) allows interacting with the statechart.

### `superstate`

The function that initiated a new statechart creation.

```ts
import { superstate } from "superstate";

// Define available states:
type SwitchState = "off" | "on";

// Initiate the "name" statechart creation:
const builder = superstate<SwitchState>("name");
```

It accepts the `name` string as an argument and the generic state type. The `name` is used for visualization and debugging purposes, i.e., to render Mermaid diagrams. The generic type defines the available states.

It returns [the builder](#builder) object that allows you to define each state.

### Builder

The `superstate` method returns a builder object that allows you to define each state one-by-one. The builder object has the following methods:

- [`state`](#builderstate) - defines the state properties.
- [`final`](#buildefinal) - same as the `state` method but marks the state as final.

All methods return the builder object, allowing you to chain the state definitions.

#### `builder.state`

The method defines the state properties, such as transitions, actions, and substates.

```ts
const state = superstate<SwitchState>("name")
  .state("off", "turnOn() -> on")
  .state("on", "turnOff() -> off");
```

It accepts 1-3 arguments. The first argument is the state name (`name`), followed by optional property string definitions (`defs`) and the optional state builder function (`builder`).

##### `builder.state(_, defs)`

Pass string definitions as the second argument to define the state transitions and actions. The argument can be a `string` or `string[]`.

```ts
const state = superstate<SwitchState>("name")
  .state("off", [
    // Enter action: call `turnOffLights!` action upon entering the state
    "-> turnOffLights!",
    // Exit action: call `turnOnLights!` action upon exiting the state
    "turnOnLights! ->",
    // Transition: when `turnOn()` event is sent, transition to the on state
    "turnOn() -> on",
  ])
  // Transitions with action: call `onOff!` action when `turnOff()` event
  // is sent before transitioning to the `off` state.
  .state("on", "turnOff() -> onOff! -> off");
```

There are six types of available definitions:

| Name                           | Definition                                         | Description                                                                                       |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Enter action                   | `-> actionName!`                                   | The action that is called when the state is entered.                                              |
| Exit action                    | `actionName! ->`                                   | The action that is called when the state is exited.                                               |
| Transition                     | `eventName() -> nextState`                         | The event that triggers the transition to the next state.                                         |
| Guarded transition             | `eventName(condition) -> nextState`                | The transition is triggered when the event is sent with the given condition.                      |
| Transition with action         | `eventName() -> actionName! -> nextState`          | The event that triggers the transition to the next state and calls the action.                    |
| Guarded transition with action | `eventName(condition) -> actionName! -> nextState` | The transition is triggered when the event is sent with the given condition and calls the action. |

There're no limit on the number of transitions and actions you can define.

→ [Read more about guards](#guards)

→ [Read more about actions](#actions)

##### `builder.state(_, [defs], builder)`

After `name` or `defs`, you can pass a function that accepts the state builder object (`$`).

```ts
// Define the state properties using the state builder object:
const state = superstate<SwitchState>("switch")
  .state("off", ($) =>
    $.enter("turnOffLights!").exit("turnOnLights!").on("turnOn() -> on")
  )
  .state("on", ($) => $.on("turnOff() -> onOff! -> off"));
```

You can combine the string definitions with the builder function:

```ts
// Use both string and builder function definitions:
const state = superstate<SwitchState>("switch")
  .state("off", "-> turnOffLights!", ($) =>
    $.exit("turnOnLights!").on("turnOn() -> on")
  )
  .state("on", ($) => $.on("turnOff() -> onOff! -> off"));
```

You can use `def` and `builder` interchangeably expect when defining the substates. In that case, you must use the builder function:

```ts
type PlayerState = "stopped" | "playing" | "paused";

const playerState = superstate<PlayerState>("player")
  .state("stopped", "play() -> playing")
  .state("playing", ["pause() -> paused", "stop() -> stopped"], ($) =>
    // Define the substate using the builder function:
    $.sub("volume", volumeState)
  )
  .state("paused", ["play() -> playing", "stop() -> stopped"]);

type VolumeState = "low" | "medium" | "high";

const volumeState = superstate<VolumeState>("volume")
  .state("low", "up() -> medium")
  .state("medium", ["up() -> high", "down() -> low"])
  .state("high", "down() -> medium");
```

The state builder also defines the enter and exit actions more explicitly, which some will find easier to read.

---

The state builder has the following methods:

- [`$.on`](#on) - defines the state transitions.
- [`$.if`](#if) - defines the guarded transitions.
- [`$.enter`](#enter) - defines the enter action.
- [`$.exit`](#exit) - defines the exit action.
- [`$.sub`](#sub) - defines the substate.

##### `$.on`

The method defines the state transitions.

```ts
const state = superstate<SwitchState>("name")
  .state("off", ($) => $.on("turnOn() -> on"))
  .state("on", ($) => $.on("turnOff() -> off"));
```

It accepts a `string` or `string[]` as the argument:

```ts
const pcState = superstate<PCState>("pc")
  .state("off", "press() -> on")
  .state("on", ($) =>
    // Chain the transitions:
    $.on("press(long) -> off").on("press() -> sleep").on("restart() -> on")
  )
  .state("sleep", ($) =>
    // Pass all at once:
    $.on(["press(long) -> off", "press() -> on", "restart() -> on"])
  );
```

There are four types of available definitions:

| Name                           | Definition                                         | Description                                                                                       |
| ------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Transition                     | `eventName() -> nextState`                         | The event that triggers the transition to the next state.                                         |
| Guarded transition             | `eventName(condition) -> nextState`                | The transition is triggered when the event is sent with the given condition.                      |
| Transition with action         | `eventName() -> actionName! -> nextState`          | The event that triggers the transition to the next state and calls the action.                    |
| Guarded transition with action | `eventName(condition) -> actionName! -> nextState` | The transition is triggered when the event is sent with the given condition and calls the action. |

##### `$.if`

The method defines a guarded transition. It accepts the event name as the first argument and transition definitions as the second argument.

```ts
const pcState = superstate<PCState>("pc")
  .state("off", "press() -> on")
  .state("on", ($) =>
    // When `press` event with `long` condition is sent, transition to the `off` state.
    // Otherwise, transition to the `sleep` state.
    $.if("press", ["(long) -> off", "() -> sleep"]).on("restart() -> on")
  )
  .state("sleep", ($) =>
    // When `press` event with `long` condition is sent, transition to the `off` state.
    // Otherwise, transition to the `on` state.
    $.if("press", ["(long) -> off", "() -> on"]).on("restart() -> on")
  );
```

The transitions definition is the same as with the `on` method, except that the event name is omitted (`(long) -> off` instead of the complete `press(long) -> off`).

There can be a single transition as well as they can be mixed with the `on` method and even the `state` `defs` argument:

```ts
const pcState = superstate<PCState>("pc")
  .state("off", "press() -> on")
  // Mix with the `defs` argument:
  .state("on", "press() -> sleep", ($) =>
    // Single guarded transition:
    $.if("press", "(long) -> off").on("restart() -> on")
  )
  .state("sleep", ($) =>
    $.if("press", ["(long) -> off", "() -> on"]).on("restart() -> on")
  );
```

There are four types of available guarded definitions:

| Name                           | Definition                                | Description                                                                                       |
| ------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Guarded transition             | `(condition) -> nextState`                | The transition is triggered when the event is sent with the given condition.                      |
| Guarded transition with action | `(condition) -> actionName! -> nextState` | The transition is triggered when the event is sent with the given condition and calls the action. |
| Else transition                | `() -> nextState`                         | The transition is triggered when the event is sent without the condition.                         |
| Else transition with action    | `() -> actionName! -> nextState`          | The transition is triggered when the event is sent without the condition and calls the action.    |

→ [Read more about guards](#guards)

##### `$.enter`

The method defines an enter state action. The action is called when the state is entered.

```ts
const state = superstate<SwitchState>("name")
  .state("off", ($) => $.enter("turnOffLights!").on("turnOn() -> on"))
  .state("on", ($) => $.enter("turnOnLights!").on("turnOff() -> off"));
```

You can define any number of enter actions.

→ [Read more about actions](#actions)

##### `$.exit`

The method defines an exit state action. The action is called when the state is exited.

```ts
const state = superstate<SwitchState>("name")
  .state("off", ($) => $.exit("turnOnLights!").on("turnOn() -> on"))
  .state("on", ($) => $.exit("turnOffLights!").on("turnOff() -> off"));
```

##### `$.sub`

The methods defines a substate.

```ts
type PlayerState = "stopped" | "playing" | "paused";

const playerState = superstate<PlayerState>("player")
  .state("stopped", "play() -> playing")
  .state("playing", ["pause() -> paused", "stop() -> stopped"], ($) =>
    // Nest the volume statechart as `volume`
    $.sub("volume", volumeState)
  )
  .state("paused", ["play() -> playing", "stop() -> stopped"]);

type VolumeState = "low" | "medium" | "high";

const volumeState = superstate<VolumeState>("volume")
  .state("low", "up() -> medium")
  .state("medium", ["up() -> high", "down() -> low"])
  .state("high", "down() -> medium");
```

The first argument is the alias of the substate, that will allow you access the substate from the parent state:

```ts
const playing = player.in("playing");
// Access the volume substate:
if (playing) console.log("Is volume high? ", playing.sub.volume.in("high"));

// Or using the dot notation from the parent:
const high = player.in("playing.volume.high");
console.log("Is volume high? ", high);
```

The second argument is the substate factory.

If the substate has final states, you can connect them to the parent state through an event:

```ts
type OSState = "running" | "sleeping" | "terminated";

const osState = superstate<OSState>("running")
  .state("running", "terminate() -> terminated")
  .state("sleeping", ["wake() -> running", "terminate() -> terminated"])
  // Mark the terminated state as final
  .final("terminated");

type PCState = "on" | "off";

const pcState = superstate<PCState>("pc")
  .state("off", "power() -> on")
  .state("on", ($) =>
    $.on("power() -> off")
      // Nest the OS state as `os` and connect the `terminated` state
      // through `shutdown()` event to `off` state of the parent.
      .sub("os", osState, "terminated -> shutdown() -> off")
  );
```

The transitions consists of the final substate `terminated`, the event `shutdown()`, and the parent state `off`.

So that after the substate OS enters the final `terminated` state, the parent PC will receive `shutdown()` and event and automatically transition to the `off` state.

The final transitions can be a `string` or `string[]`, allowing you to connect multiple final states to the parent state.

There are no limits on the number of substates you can define.

→ [Read more about substates](#substates)

#### `builder.final`

The method works the same as the `state` method but marks the state as final.

[See `state` docs](#builderstate) for more info.

### Factory

Once all the states are defined, the type system will transition [the builder object](#builder) into the statechart factory.

A factory is a statechart definition that allows creating instances using [the `host` method](#host). It can be passed to [the `sub` method](#sub) as a substate.

The factory also makes the statechart information available for debugging and visualization tools.

#### `factory.host`

The method creates a statechart instance that holds the current state and allows you to interact with it, by subscribing to state and event updates, sending events, and checking the current state, etc.

```ts
const player = playerState.host();
```

Once all the states are defined, the type system will make the `host` method available. It creates an instance of the statechart.

```ts
type ButtonState = "off" | "on";

const buttonState = superstate<ButtonState>("button")
  .state("off", "press() -> on")
  .state("on", "press() -> off");
```

If the statechart or its substates have actions, the method argument will allow to bind those actions to the code:

```ts
type ButtonState = "off" | "on";

const buttonState = superstate<ButtonState>("button")
  .state("off", ["-> turnOff!", "press() -> on"])
  .state("on", ["-> turnOn!", "press() -> off"]);

const button = buttonState.host({
  on: {
    "-> turnOn!": () => console.log("Turning on"),
  },
  off: {
    "-> turnOff!": () => console.log("Turning off"),
  },
});
```

The action bindings, allows binding the enter, exit, and transition actions, including all the nested substate actions.

```ts
type OSState = "running" | "sleeping" | "terminated";

const osState = superstate<OSState>("running")
  .state("running", "terminate() -> terminateOS! -> terminated")
  .state("sleeping", [
    "wake() -> wakeOS! -> running",
    "terminate() -> terminateOS! -> terminated",
  ])
  .final("terminated");

type PCState = "on" | "off";

const pcState = superstate<PCState>("pc")
  .state("off", "power() -> powerOn! -> on")
  .state("on", ($) => $.on("power() -> powerOff! -> off").sub("os", osState));

const pc = pcState.host({
  on: {
    // Bind the root's transition action:
    "power() -> powerOff!": () => console.log("Turning off PC"),
    os: {
      // Bind the substate's transition actions:
      running: {
        "terminate() -> terminateOS!": () => console.log("Terminating OS"),
      },
      sleeping: {
        "terminate() -> terminateOS!": () => console.log("Terminating OS"),
        "wake() -> wakeOS!": () => console.log("Waking OS"),
      },
    },
  },
  off: {
    "power() -> powerOn!": () => console.log("Turning on PC"),
  },
});
```

The hierarchy of the statecharts is preserved, so you bind each state and substate actions individually.

There are three types of available bindings:

| Name              | Definition                   | Description                                                 |
| ----------------- | ---------------------------- | ----------------------------------------------------------- |
| Enter action      | `-> actionName!`             | The action that is called when the state is entered.        |
| Exit action       | `actionName! ->`             | The action that is called when the state is exited.         |
| Transition action | `eventName() -> actionName!` | The action that is called when the transition is triggered. |

#### `factory.name`

The property holds the statechart name.

```ts
type ButtonState = "off" | "on";

const buttonState = superstate<ButtonState>("button")
  .state("off", "press() -> on")
  .state("on", "press() -> off");

buttonState.name;
//=> "button"
```

### Instance

TODO:

#### `instance.state`

TODO:

#### `instance.finalized`

TODO:

#### `instance.in`

TODO:

#### `instance.on`

TODO:

#### `instance.send`

TODO:

#### `instance.off`

TODO:

## Acknowledgments

Special thanks to [Eric Vicenti](https://github.com/ericvicenti) for donatime the npm package name `superstate` to this project.

The project wouldn't exist without the [XState](https://stately.ai/docs/xstate) library, a great source of inspiration and knowledge.

## Changelog

See [the changelog](./CHANGELOG.md).

## License

[MIT © Sasha Koss](https://kossnocorp.mit-license.org/)
