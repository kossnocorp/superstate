import { superstate, Superstate } from "./index.js";

//! Simple machine
{
  type PlayerState = "stopped" | "playing" | "paused";

  superstate<PlayerState>("player")
    .state("stopped", ["play() -> playing"])
    //! The nope state is not defined
    // @ts-expect-error
    .state("nope", []);

  superstate<PlayerState>("player")
    .state("stopped", ["play() -> playing"])
    //! The stopped state is already defined
    // @ts-expect-error
    .state("stopped", ["play() -> playing"]);

  const playerMachine = superstate<PlayerState>("player")
    .state("stopped", "play() -> playing")
    .state("playing", ($) => $.on(["pause() -> paused", "stop() -> stopped"]))
    .state("paused", ($) => $.on("play() -> playing").on("stop() -> stopped"));

  //! All the states are already defined
  // @ts-expect-error
  playerMachine.state;

  const player = playerMachine.host();

  //! send

  //! The machine accepts the events

  player.send("play()");
  player.send("pause()");
  //! The event is not defined
  // @ts-expect-error
  player.send();
  //! The event is not defined
  // @ts-expect-error
  player.send("nope()");

  //! It returns the next state or null
  {
    const nextState = player.send("play()");

    //! The next state might be null
    assertExtends<typeof nextState>(null);

    if (nextState) {
      //! The next state is playing
      nextState.name satisfies "playing";
    }
  }

  //! on

  //! The machine allows to subscribe to all states
  const off = player.on("*", (update) => {
    if (update.type === "state") {
      switch (update.state.name) {
        //! There's no such state
        // @ts-expect-error
        case "nope":
          break;

        //! We expect all states
        case "stopped":
        case "playing":
        case "paused":
          break;

        //! We don't expect other states
        default:
          update.state satisfies never;
      }
    } else if (update.type === "event") {
      switch (update.transition.event) {
        //! There's no such event
        // @ts-expect-error
        case "nope":
          break;

        //! We expect all events
        case "play":
        case "pause":
        case "stop":
          break;

        //! We don't expect other events
        default:
          update.transition satisfies never;
      }
    } else {
      //! No other type is expected
      update satisfies never;
    }
  });

  //! on returns off that unsubscribes the listener
  off();

  //! The machine allows to subscribe to specific states
  player.on("stopped", (update) => {
    //! It can only be stopped state
    if (update.type === "state") {
      if (update.state.name === "stopped") {
        return;
      }

      //! Can't be anything but stopped
      update.state.name satisfies never;
      return;
    }

    //! Can only be state
    update.type satisfies never;
  });

  //! The machine allows to subscribe to few states
  player.on(["stopped", "playing"], (update) => {
    //! It can only be stopped or playing state
    if (update.type === "state") {
      switch (update.state.name) {
        //! Can't be invalid state
        // @ts-expect-error
        case "nope":
          break;

        case "stopped":
        case "playing":
          return;

        default:
          //! Can't be anything but stopped or playing
          update.state satisfies never;
      }
      return;
    }

    //! Can only be only state
    update.type satisfies never;
  });

  //! Can't subscribe to invalid states
  // @ts-expect-error
  player.on("nope", () => {});
  // @ts-expect-error
  player.on(["stopped", "nope"], () => {});

  //! The machine allows to subscribe to specific events
  player.on("stop()", (update) => {
    //! It can only be stop event
    if (update.type === "event") {
      if (update.transition.event === "stop") {
        return;
      }

      //! Can't be anything but stop
      update.transition.event satisfies never;
      return;
    }

    //! Can only be event
    update.type satisfies never;
  });

  //! The machine allows to subscribe to few events
  player.on(["stop()", "pause()"], (update) => {
    //! It can only be stop or pause events
    if (update.type === "event") {
      switch (update.transition.event) {
        //! Can't be invalid state
        // @ts-expect-error
        case "nope":
          break;

        case "stop":
        case "pause":
          return;

        default:
          //! Can't be anything but stop or pause
          update.transition satisfies never;
      }
      return;
    }

    //! Can only be event
    update.type satisfies never;
  });

  //! Can't subscribe to invalid events
  // @ts-expect-error
  player.on("nope()", () => {});
  // @ts-expect-error
  player.on(["stopped()", "nope()"], () => {});

  //! Current state

  //! The machine allows to get the current state
  const state = player.state;
  state.name satisfies "stopped" | "playing" | "paused";

  //! The state is readonly
  // @ts-expect-error
  player.state = {
    name: "stopped",
    events: [],
    sub: {},
    final: false,
    initial: false,
  };

  //! The initial state is marked as initial
  {
    const initialState = player.in("stopped");
    if (initialState) initialState.initial satisfies true;

    const playingState = player.in("playing");
    if (playingState) playingState.initial satisfies false;
  }

  //! Matching states

  {
    const state = player.in("paused");

    //! The state might be undefined
    // @ts-expect-error
    state.name;

    //! The state is paused
    if (state) state.name satisfies "paused";
  }

  //! Multiple matches
  {
    const state = player.in(["paused", "playing"]);

    //! The state might be undefined
    // @ts-expect-error
    state.name;

    if (state)
      //! The state is paused or playing
      state.name satisfies "paused" | "playing";
  }
}

//! Multiple event targets
{
  type LightState = "off" | "on";

  const lightMachine = superstate<LightState>("light")
    .state("off", "toggle() -> on")
    .state("on", "toggle() -> off");

  const light = lightMachine.host();

  //! Can send events to multiple targets
  const nextState = light.send("toggle()");
  if (nextState) {
    //! The next state is off
    nextState.name satisfies "off" | "on";
  }

  //! Subscribing to the events gives you multiple targets
  light.on("toggle()", (update) => {
    update.transition.to satisfies "off" | "on";
  });
}

//! Final states
{
  type CassetteState = "stopped" | "playing" | "ejected";

  const casseteMachine = superstate<CassetteState>("cassette")
    .state("stopped", ($) => $.on(["play() -> playing", "eject() -> ejected"]))
    //! Mixed events definition
    .state("playing", "stop() -> stopped", ($) => $.on("eject() -> ejected"))
    .final("ejected");

  const cassete = casseteMachine.host();

  //! Should be able to send exit events
  const nextState = cassete.send("eject()");

  //! The next step is final
  if (nextState) {
    nextState.name satisfies "ejected";
    nextState.final satisfies true;
  }

  //! The machine finalized flag

  cassete.finalized satisfies boolean;

  //! The finalized is readonly
  // @ts-expect-error
  player.finalized = false;
}

//! Conditions
{
  type PCState = "on" | "sleep" | "off";

  const pcMachine = superstate<PCState>("pc")
    .state("off", "press() -> on")
    .state("sleep", ($) =>
      $.if("press", ["(long) -> off", "() -> on"]).on("restart() -> on")
    )
    .state("on", ($) =>
      $.on("press(long) -> off").on("press() -> sleep").on("restart() -> on")
    );

  const pc = pcMachine.host();

  //! Allows to send an event without the condition
  {
    const nextState = pc.send("press()");
    //! It properly infers the next state
    if (nextState) {
      nextState.name satisfies "on" | "sleep";
    }
  }

  //! Allows to send an event with the condition
  {
    const nextState = pc.send("press()", "long");
    //! It properly infers the next state
    if (nextState) {
      nextState.name satisfies "off";
    }
  }

  //! Allows to send short condition
  {
    const nextState = pc.send("press(long)");
    //! It properly infers the next state
    if (nextState) {
      nextState.name satisfies "off";
    }
  }

  //! null should not leak
  // @ts-expect-error
  pc.send("press(null)");

  //! The condition is undefined
  // @ts-expect-error
  pc.send("press()", "nope");

  //! Can't send conditions to wrong events
  // @ts-expect-error
  pc.send("restart()", "long");

  //! Can't send undefined events
  // @ts-expect-error
  pc.send();
  // @ts-expect-error
  pc.send("nope()");
  // @ts-expect-error
  pc.send("nope()", "nope");
  // @ts-expect-error
  pc.send("nope()", "long");
}

//! Only-conditional events
{
  type CatState = "boxed" | "alive" | "dead";

  const catMachine = superstate<CatState>("cat")
    .state("boxed", ($) =>
      $.if("reveal", ["(lucky) -> alive", "(unlucky) -> dead"])
    )
    .state("alive", ($) => $.on("pet() -> alive"))
    .state("dead");

  const cat = catMachine.host();

  //! Allows to send conditional exit events
  cat.send("reveal()", "lucky");
  cat.send("reveal()", "unlucky");

  //! The condition is undefined
  // @ts-expect-error
  cat.send("reveal()", "nope");

  //! Should always pass the condition
  // @ts-expect-error
  cat.send("reveal()");

  //! Can't send conditions to wrong events
  // @ts-expect-error
  cat.send("restart()", "long");

  //! Can't send undefined events
  // @ts-expect-error
  cat.send();
  // @ts-expect-error
  cat.send("nope()");
  // @ts-expect-error
  cat.send("nope()", "nope");
  // @ts-expect-error
  cat.send("nope()", "long");
}

//! Substates
{
  type TeaState = "water" | "steeping" | "ready" | "finished";

  const teaMachine = superstate<TeaState>("tea")
    .state("water", ["infuse() -> steeping", "drink() -> finished"])
    .state("steeping", ["done() -> ready", "drink() -> finished"])
    .state("ready", ["drink() -> finished"])
    .final("finished");

  type MugState = "clear" | "full" | "dirty";

  superstate<MugState>("mug")
    .state("clear", "pour() -> full")
    .state("full", ["drink() -> clear"], ($) =>
      $.sub(
        "tea",
        teaMachine,
        //! The exit must be a correct state
        // @ts-expect-error
        "finishe -> finish() -> dirty"
      )
    )
    .state("dirty", ["clean() -> clear"]);

  superstate<MugState>("mug")
    .state("clear", "pour() -> full")
    .state("full", ["drink() -> clear"], ($) =>
      $.sub(
        "tea",
        teaMachine,
        //! The exit must be a final strate
        // @ts-expect-error
        "water -> finish() -> dirty"
      )
    )
    .state("dirty", ["clean() -> clear"]);

  superstate<MugState>("mug")
    .state("clear", "pour() -> full")
    .state("full", ["drink() -> clear"], ($) =>
      $.sub(
        "tea",
        teaMachine,
        //! The exiting state must be correct
        // @ts-expect-error
        "finished -> finish() -> dity"
      )
    )
    .state("dirty", ["clean() -> clear"]);

  const mugMachine = superstate<MugState>("mug")
    .state("clear", "pour() -> full")
    .state("full", ["drink() -> clear"], ($) =>
      $.sub("tea", teaMachine, "finished -> finish() -> dirty")
    )
    .state("dirty", ["clean() -> clear"]);

  const mug = mugMachine.host();

  //! Event listeners

  mug.on("full", (update) => {
    //! Should be able to listen to substate states
    update.state.sub.tea.on("ready", (update) => {
      update.state.name satisfies "ready";
    });

    //! Should be able to listen to the substate events
    update.state.sub.tea.on("infuse()", (update) => {
      update.transition.event satisfies "infuse";
    });
  });

  //! Should be able to listen to the substate states using dot notation
  mug.on("full.tea.ready", (update) => {
    update.state.name satisfies "ready";
  });

  //! Should be able to listen to the substate transitions
  mug.on("full.tea.infuse()", (update) => {
    update.transition.event satisfies "infuse";
  });

  mug.on("*", (update) => {
    if (update.type === "state") {
      //! The nested events should be propogated
      if (update.state.name === "ready") return;
    }
  });

  mug.on("*", (update) => {
    if (update.type === "state") {
      //! The state is not defined
      // @ts-expect-error
      if (update.state.name === "rady") return;
    }
  });

  //! Should be able to listen to the exit transition
  mug.on("finish()", (update) => {
    update.transition.event satisfies "finish";
    update.transition.to satisfies "dirty";
  });

  //! Sending events

  //! Should be able to send events to substates
  {
    const nextState = mug.send("full.tea.infuse()");
    if (nextState) {
      //! The next state is steeping
      nextState.name satisfies "steeping";
    }
  }

  //! Should not be able to send final transition events
  // @ts-expect-error
  mug.send("finish()");

  //! Matching states
  {
    const state = mug.in("full.tea.steeping");
    //! The state might be undefined
    // @ts-expect-error
    state.name;
    //! The state is steeping
    if (state) state.name satisfies "steeping";
  }

  //! Multiple matches
  {
    const state = mug.in(["clear", "full.tea.ready"]);
    //! The state might be undefined
    // @ts-expect-error
    state.name;
    //! The state is clear or ready
    if (state) state.name satisfies "clear" | "ready";
  }
}

//! Parallel states
{
  type ExpireState = "fresh" | "expired";

  const expireMachine = superstate<ExpireState>("expire")
    .state("expired", "expire() -> expired")
    .state("fresh");

  type HeatState = "frozen" | "thawed" | "hot";

  const heatMachine = superstate<HeatState>("heat")
    .state("frozen", "thaw() -> thawed")
    .state("thawed", "heat() -> hot")
    .state("hot");

  type MeatPieState = "unpacked" | "cooked" | "finished";

  type EatState = "eating" | "finished";

  const eatMachine = superstate<EatState>("eat")
    .state("eating", "eat() -> finished")
    .final("finished");

  const meatPieMachine = superstate<MeatPieState>("meatPie")
    .state("unpacked", ($) =>
      $.sub("expire", expireMachine)
        .sub("heat", heatMachine)
        .sub("eat", eatMachine, "finished -> finish() -> finished")
    )
    .state("cooked")
    .final("finished");

  const meatPie = meatPieMachine.host();

  //! on

  //! Can subscribe to the parallel states
  meatPie.on(["unpacked.eat.eating", "unpacked.expire.fresh"], (update) => {
    update.state.name satisfies "eating" | "fresh";
  });

  //! Can't subscribe to invalid parallel states
  // @ts-expect-error
  meatPie.on("unpacked.heat.eating", () => {});

  //! send

  //! Can send events to the parallel states
  {
    const nextState = meatPie.send("unpacked.eat.eat()");
    //! The next state is finished
    if (nextState) nextState.name satisfies "finished";
  }

  //! Can't send invalid events
  // @ts-expect-error
  meatPie.send("unpacked.eat.heat()");

  //! in

  //! Can match the parallel states
  {
    const state = meatPie.in("unpacked.eat.eating");
    //! The state is eating
    if (state) state.name satisfies "eating";
  }

  //! Don't accept invalid parallel states
  // @ts-expect-error
  meatPie.in("unpacked.eat.thawed");
}

//! State actions
{
  type SwitchState = "off" | "on";

  //! Enter actions
  const switchMachineDouble = superstate<SwitchState>("switch")
    .state("off", ($) => $.enter("turnOff!").on("toggle() -> on"))
    .state("on", ($) => $.enter("turnOn!").on("toggle() -> off"));

  //! Exit actions
  const switchMachineSingle = superstate<SwitchState>("switch")
    .state("off", "toggle() -> on")
    .state("on", ($) =>
      $.enter("turnOn!").exit("turnOff!").on("toggle() -> off")
    );

  //! Shortcut definition
  const switchMachineShortcut = superstate<SwitchState>("switch")
    .state("off", "toggle() -> on")
    .state("on", ["-> turnOn!", "turnOff! ->", "toggle() -> off"]);

  //! Mixed shortcut definition
  const switchMachineMixedShortcut = superstate<SwitchState>("switch")
    .state("off", "toggle() -> on")
    .state("on", ["-> turnOn!", "toggle() -> off"], ($) => $.exit("turnOff!"));

  //! The actions must be correctly named
  superstate<SwitchState>("switch")
    .state("off", "toggle() -> on")
    .state(
      "on",
      // @ts-expect-error
      [`-> turnOn()`, "turnOff? ->", "toggle() -> off"],
      ($) =>
        // @ts-expect-error
        $.enter("turnOn?")
          // @ts-expect-error
          .exit("turnOff()")
          .on("toggle() -> off")
    );
  superstate<SwitchState>("switch")
    .state("off", "toggle() -> on")
    .state(
      "on",
      // @ts-expect-error
      ["-> turnOn", "toggle() -> off"],
      // @ts-expect-error
      ($) => $.exit("turnOff?")
    );

  //! Binding

  //! It allows to bind the actions
  const switch_ = switchMachineSingle.host({
    on: {
      "-> turnOn!": () => console.log("Turning on"),
      "turnOff! ->": () => console.log("Turning off"),
    },
  });

  //! It allows to bind multiple states
  switchMachineDouble.host({
    on: {
      "-> turnOn!": () => console.log("Turning on"),
    },
    off: {
      "-> turnOff!": () => console.log("Turning off"),
    },
  });

  //! Allows to bind shortcut actions
  switchMachineShortcut.host({
    on: {
      "-> turnOn!": () => console.log("Turning on"),
      "turnOff! ->": () => console.log("Turning off"),
    },
  });
  switchMachineMixedShortcut.host({
    on: {
      "-> turnOn!": () => console.log("Turning on"),
      "turnOff! ->": () => console.log("Turning off"),
    },
  });

  //! It forces to bind all actions
  switchMachineSingle.host({
    // @ts-expect-error
    on: {
      "-> turnOn!": () => console.log("Turning on"),
    },
  });

  //! The defitions must be correct
  switchMachineSingle.host({
    on: {
      // @ts-expect-error
      "-> turnOn?": () => console.log("Turning on"),
      "turnOff! ->": () => console.log("Turning off"),
    },
  });

  //! Can't bind unknown events
  switchMachineSingle.host({
    on: {
      "-> turnOn!": () => console.log("Turning on"),
      "turnOff! ->": () => console.log("Turning off"),
    },
    // @ts-expect-error
    nope: {
      "-> turnOn!": () => console.log("Turning on"),
    },
  });
}

//! Transition actions
{
  type ButtonState = "off" | "on";

  //! Allows to define the transition actions
  const buttonMachine = superstate<ButtonState>("button")
    .state("off", ($) => $.on("press() -> turnOn! -> on"))
    .state("on", ($) => $.on("press() -> turnOff! -> off"));

  type PushableButtonState = ButtonState | "pushed";

  //! Allows to define actions on conditional transitions
  const buttonMachineWithCondition = superstate<PushableButtonState>("button")
    .state("off", ($) => $.on("press() -> turnOn! -> on"))
    .state("on", ($) =>
      $.if("press", ["(long) -> blink! -> pushed", "() -> turnOff! -> off"])
    )
    .state("pushed", "press() -> turnOff! -> off");

  //! Allows to use shortcuts
  const buttonMachineMixed = superstate<PushableButtonState>("button")
    .state("off", "press() -> turnOn! -> on")
    .state("on", "press(long) -> blink! -> pushed", ($) =>
      $.on("press() -> turnOff! -> off")
    )
    .state("pushed", "press() -> turnOff! -> off");

  //! The actions must be correctly named
  superstate<PushableButtonState>("button")
    .state("off", "press() -> turnOn! -> on")
    .state(
      "on",
      // @ts-expect-error
      ["(long) -> blink -> pushed", "() -> turnOff! -> off"],
      ($) =>
        // @ts-expect-error
        $.on("press() -> turnOff -> off")
    )
    .state("pushed", "press() -> turnOff! -> off");

  //! Binding

  //! It allows to bind the actions
  buttonMachine.host({
    on: {
      "press() -> turnOff!": () => console.log("Turning on"),
    },
    off: {
      "press() -> turnOn!": () => console.log("Turning off"),
    },
  });

  //! It allows to bind conditional transitions
  buttonMachineWithCondition.host({
    off: {
      "press() -> turnOn!": () => console.log("Turning on"),
    },
    on: {
      "press() -> turnOff!": () => console.log("Turning off"),
      "press(long) -> blink!": () => console.log("Blinking"),
    },
    pushed: {
      "press() -> turnOff!": () => console.log("Turning off"),
    },
  });

  //! It allows to bind mixed actions
  buttonMachineMixed.host({
    off: {
      "press() -> turnOn!": () => console.log("Turning on"),
    },
    on: {
      "press() -> turnOff!": () => console.log("Turning off"),
      "press(long) -> blink!": () => console.log("Blinking"),
    },
    pushed: {
      "press() -> turnOff!": () => console.log("Turning off"),
    },
  });

  //! It forces to bind all actions
  buttonMachineWithCondition.host({
    off: {
      "press() -> turnOn!": () => console.log("Turning on"),
    },
    // @ts-expect-error
    on: {
      "press() -> turnOff!": () => console.log("Turning off"),
    },
    pushed: {
      "press() -> turnOff!": () => console.log("Turning off"),
    },
  });

  //! The defitions must be correct
  buttonMachine.host({
    on: {
      // @ts-expect-error
      "press() -> turnOff?": () => console.log("Turning on"),
    },
    off: {
      // @ts-expect-error
      "press() -> turnOn": () => console.log("Turning off"),
    },
  });

  //! Can't bind unknown events
  buttonMachine.host({
    on: {
      // @ts-expect-error
      "press() -> turnOff?": () => console.log("Turning on"),
    },
    off: {
      // @ts-expect-error
      "press() -> turnOn": () => console.log("Turning off"),
      "nope() -> turnOn": () => console.log("Turning off"),
    },
  });
}

//! Substate actions
{
  type OSState = "running" | "sleeping" | "terminated";

  const osState = superstate<OSState>("running")
    .state("running", [
      "terminate() -> terminated",
      "sleep() -> sleep! -> sleeping",
    ])
    .state("sleeping", [
      "wake() -> wake! -> running",
      "terminate() -> terminated",
    ])
    .final("terminated", "-> terminate!");

  type PCState = "on" | "off";

  const pcState = superstate<PCState>("pc")
    .state("off", "power() -> turnOn! -> on")
    .state("on", ($) =>
      $.on("power() -> turnOff! -> off").sub(
        "os",
        osState,
        "terminated -> shutdown() -> off"
      )
    );

  const pcStateNoActions = superstate<PCState>("pc")
    .state("off", "power() -> on")
    .state("on", ($) =>
      $.on("power() -> off").sub(
        "os",
        osState,
        "terminated -> shutdown() -> off"
      )
    );

  const os = osState.host({
    running: {
      "sleep() -> sleep!": () => {},
    },
    sleeping: {
      "wake() -> wake!": () => {},
    },
    terminated: {
      "-> terminate!": () => {},
    },
  });

  //! Forces to bind all substate actions
  const pc = pcState.host({
    on: {
      "power() -> turnOff!": () => {},
      os: {
        running: {
          "sleep() -> sleep!": () => {},
        },
        sleeping: {
          "wake() -> wake!": () => {},
        },
        terminated: {
          "-> terminate!": () => {},
        },
      },
    },
    off: {
      "power() -> turnOn!": () => {},
    },
  });

  //! It forces to bind even if the parent has no actions
  const pcNoActions = pcStateNoActions.host({
    on: {
      os: {
        running: {
          "sleep() -> sleep!": () => {},
        },
        sleeping: {
          "wake() -> wake!": () => {},
        },
        terminated: {
          "-> terminate!": () => {},
        },
      },
    },
  });

  //! It prevents binding invalid actions
  pcStateNoActions.host({
    on: {
      os: {
        running: {
          // @ts-expect-error
          "sleep() -> slep!": () => {},
        },
        sleeping: {
          "wake() -> wake!": () => {},
        },
        terminated: {
          "-> terminate!": () => {},
        },
      },
    },
  });
}

//! Documentation examples:
{
  //! README.md:

  const sound = {} as any;

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

  //! Basics:

  const volume = volumeState.host();

  // Subscribe to the state updates:
  volume.on(["low", "medium", "high"], (update) =>
    sound.setVolume(update.state.name)
  );

  // Trigger the events:
  volume.send("up()");

  // Check the current state:
  if (volume.in("high")) console.log("The volume is at maximum");

  // Listen to everything:
  volume.on("*", (update) => {
    if (update.type === "state") {
      console.log("State changed to", update.state.name);
    } else {
      console.log("Event triggered", update.transition.event);
    }
  });

  // Will trigger when the state is `low` or when `down()` is sent:
  volume.on(["low", "down()"], (update) => {
    if (update.type === "state") {
      console.log("The volume is low");
    } else {
      console.log("The volume is going down");
    }
  });

  //! Guards:

  type PCState = "on" | "sleep" | "off";

  const pcState = superstate<PCState>("pc")
    .state("off", "press() -> on")
    .state("on", ($) =>
      $.if("press", ["(long) -> off", "() -> sleep"]).on("restart() -> on")
    )
    .state("sleep", ($) =>
      $.if("press", ["(long) -> off", "() -> on"]).on("restart() -> on")
    );

  const pc = pcState.host();

  {
    // Send the long press event:
    const nextState = pc.send("press()", "long");

    // The next state is "off":
    if (nextState) nextState.name satisfies "off";
  }

  {
    // Send the press event:
    const nextState = pc.send("press()");

    // The next state is "sleep" or "on":
    if (nextState) nextState.name satisfies "sleep" | "on";
  }

  //! Actions

  type ButtonState = "off" | "on";

  {
    const buttonState = superstate<ButtonState>("button")
      .state("off", ["-> turnOff!", "press() -> on"])
      .state("on", ["-> turnOn!", "press() -> off"]);

    // Bind the actions to code:
    const button = buttonState.host({
      on: {
        "-> turnOn!": () => console.log("Turning on"),
      },
      off: {
        "-> turnOff!": () => console.log("Turning on"),
      },
    });
  }
  {
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
  }

  {
    // Use the builder function to define the states:
    const buttonState = superstate<ButtonState>("button")
      .state("on", ($) =>
        $.enter("turnOn!").on("press() -> off").exit("turnOff!")
      )
      .state("off", ($) => $.on("press() -> on"));
  }

  //! Substates

  {
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

    const player = playerState.host();

    // Send events to the substate:
    player.send("playing.volume.up()");

    // Subscribe to the substate updates:
    player.on("playing.volume.low", (update) =>
      console.log("The volume is low")
    );

    // The parent state will have the substate as a property on `sub`:
    const playingState = player.in("playing");
    if (playingState) {
      // Access the substate:
      playingState.sub.volume.in("high");
    }
  }

  type OSState = "running" | "sleeping" | "terminated";

  const osState = superstate<OSState>("running")
    .state("running", "terminate() -> terminated")
    .state("sleeping", ["wake() -> running", "terminate() -> terminated"])
    // Mark the terminated state as final
    .final("terminated");

  {
    type PCState = "on" | "off";

    const pcState = superstate<PCState>("pc")
      .state("off", "power() -> on")
      .state("on", ($) =>
        $.on("power() -> off")
          // Nest the OS state as `os` and connect the `terminated` state
          // through `shutdown()` event to `off` state of the parent.
          .sub("os", osState, "terminated -> shutdown() -> off")
      );
  }

  {
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
      // Note terminate! action
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
  }
}

export function assertExtends<Type>(_value: Type) {}
