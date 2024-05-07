import { State, Superstate, superstate } from ".";

//#region Simple machine
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

  const playerState = superstate<PlayerState>("player")
    .state("stopped", "play() -> playing")
    .state("playing", ($) => $.on(["pause() -> paused", "stop() -> stopped"]))
    .state("paused", ($) => $.on("play() -> playing").on("stop() -> stopped"));

  //! All the states are already defined
  // @ts-expect-error
  playerState.state;

  const player = playerState.host();

  //! send

  //! The machine accepts the events

  player.send.play();
  player.send.pause();
  //! The event is not defined
  // @ts-expect-error
  player.send.nope();

  //! It returns the next state or null
  {
    const nextState = player.send.play();

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

  //! off

  //! Can unsubscribe from all events
  player.off();

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
//#endregion

//#region Multiple event targets
{
  type LightState = "off" | "on";

  const lightState = superstate<LightState>("light")
    .state("off", "toggle() -> on")
    .state("on", "toggle() -> off");

  const light = lightState.host();

  //! Can send events to multiple targets
  const nextState = light.send.toggle();
  if (nextState) {
    //! The next state is off
    nextState.name satisfies "off" | "on";
  }

  //! Subscribing to the events gives you multiple targets
  light.on("toggle()", (update) => {
    update.transition.to satisfies "off" | "on";
  });
}
//#endregion

//#region Final states
{
  type CassetteState = "stopped" | "playing" | "ejected";

  const casseteState = superstate<CassetteState>("cassette")
    .state("stopped", ($) => $.on(["play() -> playing", "eject() -> ejected"]))
    //! Mixed events definition
    .state("playing", "stop() -> stopped", ($) => $.on("eject() -> ejected"))
    .final("ejected");

  const cassete = casseteState.host();

  //! Should be able to send exit events
  const nextState = cassete.send.eject();

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
//#endregion

//#region Conditions
{
  type PCState = "on" | "sleep" | "off";

  const pcState = superstate<PCState>("pc")
    .state("off", "press() -> on")
    .state("sleep", ($) =>
      $.if("press", ["(long) -> off", "() -> on"]).on("restart() -> on")
    )
    .state("on", ($) =>
      $.on("press(long) -> off").on("press() -> sleep").on("restart() -> on")
    );

  const pc = pcState.host();

  //! Allows to send an event without the condition
  {
    const nextState = pc.send.press();
    //! It properly infers the next state
    if (nextState) {
      nextState.name satisfies "on" | "sleep";
    }
  }

  //! Allows to send an event with the condition
  {
    const nextState = pc.send.press("long");
    //! It properly infers the next state
    if (nextState) {
      nextState.name satisfies "off";
    }
  }

  //! Allows to send short condition
  {
    const nextState = pc.send.press("long");
    //! It properly infers the next state
    if (nextState) {
      nextState.name satisfies "off";
    }
  }

  //! null should not leak
  // @ts-expect-error
  pc.send.press("null");

  //! The condition is undefined
  // @ts-expect-error
  pc.send.press("nope");

  //! Can't send conditions to wrong events
  // @ts-expect-error
  pc.send.restart("long");

  //! Can't send undefined events
  // @ts-expect-error
  pc.send();
  // @ts-expect-error
  pc.send.nope();
  // @ts-expect-error
  pc.send.nope("nope");
  // @ts-expect-error
  pc.send.nope("long");

  //! on

  //! Allows to subscribe to events with conditions
  pc.on("press(long)", () => {});

  //! Allows to subscribe to events without conditions
  pc.on("press()", () => {});
}
//#endregion

//#region Only-conditional events
{
  type CatState = "boxed" | "alive" | "dead";

  const catState = superstate<CatState>("cat")
    .state("boxed", ($) =>
      $.if("reveal", ["(lucky) -> alive", "(unlucky) -> dead"])
    )
    .state("alive", ($) => $.on("pet() -> alive"))
    .state("dead");

  const cat = catState.host();

  //! Allows to send conditional exit events
  cat.send.reveal("lucky");
  cat.send.reveal("unlucky");

  //! The condition is undefined
  // @ts-expect-error
  cat.send.reveal("nope");

  //! Should always pass the condition
  // @ts-expect-error
  cat.send.reveal();

  //! Can't send conditions to wrong events
  // @ts-expect-error
  cat.send.restart("long");

  //! Can't send undefined events
  // @ts-expect-error
  cat.send();
  // @ts-expect-error
  cat.send.nope();
  // @ts-expect-error
  cat.send.nope("nope");
  // @ts-expect-error
  cat.send.nope("long");

  //! on

  //! Allows to subscribe to events with conditions
  cat.on("reveal(lucky)", () => {});

  //! Can't subscribe without a condition
  // @ts-expect-error
  cat.on("reveal()", () => {});
}
//#endregion

//#region Substates
{
  type TeaState = "water" | "steeping" | "ready" | "finished";

  const teaState = superstate<TeaState>("tea")
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
        teaState,
        //! The exit must be a correct state
        // @ts-expect-error
        "tea.finishe -> finish() -> dirty"
      )
    )
    .state("dirty", ["clean() -> clear"]);

  superstate<MugState>("mug")
    .state("clear", "pour() -> full")
    .state("full", ["drink() -> clear"], ($) =>
      $.sub(
        "tea",
        teaState,
        //! The exit must be a final strate
        // @ts-expect-error
        "tea.water -> finish() -> dirty"
      )
    )
    .state("dirty", ["clean() -> clear"]);

  superstate<MugState>("mug")
    .state("clear", "pour() -> full")
    .state("full", ["drink() -> clear"], ($) =>
      $.sub(
        "tea",
        teaState,
        //! The exiting state must be correct
        // @ts-expect-error
        "tea.finished -> finish() -> dity"
      )
    )
    .state("dirty", ["clean() -> clear"]);

  const mugState = superstate<MugState>("mug")
    .state("clear", "pour() -> full")
    .state("full", ["drink() -> clear"], ($) =>
      $.sub("tea", teaState, "tea.finished -> finish() -> dirty")
    )
    .state("dirty", ["clean() -> clear"]);

  const tea = teaState.host();
  const mug = mugState.host();

  //! on

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

  //! The star should not catch nested events
  mug.on("*", (update) => {
    if (update.type === "state") {
      //! The nested events should not propogate
      // @ts-expect-error
      if (update.state.name === "ready") return;
    }
  });

  //! Double star should catch nested events
  mug.on("**", (update) => {
    if (update.type === "state") {
      //! The nested events should propogate
      if (update.state.name === "ready") return;
    }
  });

  mug.on("**", (update) => {
    if (update.type === "state") {
      //! The state is not defined
      // @ts-expect-error
      if (update.state.name === "rady") return;
    }
  });

  //! The double start should not present when there are no substates
  // @ts-expect-error
  tea.on("**", () => {});

  //! Should be able to listen to the final transition
  mug.on("finish()", (update) => {
    update.transition.event satisfies "finish";
    update.transition.to satisfies "dirty";
    //! The final transitions conditions must be null
    update.transition.condition satisfies null;
  });

  //! It allows to subscribe to substate wildcard updates
  mug.on("full.tea.*", (target) => {
    if (target.type === "state") {
      target.state.name satisfies "water" | "steeping" | "ready" | "finished";
    } else {
      target.transition.event satisfies "infuse" | "done" | "drink";
    }
  });

  //! The wildcard must be correct
  // @ts-expect-error
  mug.on("full.tae.*", () => {});

  //! Sending events

  //! Should be able to send events to substates
  {
    const nextState = mug.send.full.tea.infuse();
    if (nextState) {
      //! The next state is steeping
      nextState.name satisfies "steeping";
    }
  }

  //! Should not be able to send final transition events
  // @ts-expect-error
  mug.send.finish();

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
//#endregion

//#region Parallel states
{
  type ExpireState = "fresh" | "expired";

  const expireState = superstate<ExpireState>("expire")
    .state("expired", "expire() -> expired")
    .state("fresh");

  type HeatState = "frozen" | "thawed" | "hot";

  const heatState = superstate<HeatState>("heat")
    .state("frozen", "thaw() -> thawed")
    .state("thawed", "heat() -> hot")
    .state("hot");

  type MeatPieState = "unpacked" | "cooked" | "finished";

  type EatState = "eating" | "finished";

  const eatState = superstate<EatState>("eat")
    .state("eating", "eat() -> finished")
    .final("finished");

  const meatPieState = superstate<MeatPieState>("meatPie")
    .state("unpacked", ($) =>
      $.sub("expire", expireState)
        .sub("heat", heatState)
        .sub("eat", eatState, "eat.finished -> finish() -> finished")
    )
    .state("cooked")
    .final("finished");

  const meatPie = meatPieState.host();

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
    const nextState = meatPie.send.unpacked.eat.eat();
    //! The next state is finished
    if (nextState) nextState.name satisfies "finished";
  }

  //! Can't send invalid events
  // @ts-expect-error
  meatPie.send.unpacked.eat.heat();

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
//#endregion

//#region State actions
{
  type SwitchState = "off" | "on";

  //! Enter actions
  const switchStateDouble = superstate<SwitchState>("switch")
    .state("off", ($) => $.enter("turnOff!").on("toggle() -> on"))
    .state("on", ($) => $.enter("turnOn!").on("toggle() -> off"));

  //! Exit actions
  const switchStateSingle = superstate<SwitchState>("switch")
    .state("off", "toggle() -> on")
    .state("on", ($) =>
      $.enter("turnOn!").exit("turnOff!").on("toggle() -> off")
    );

  //! Shortcut definition
  const switchStateShortcut = superstate<SwitchState>("switch")
    .state("off", "toggle() -> on")
    .state("on", ["-> turnOn!", "turnOff! ->", "toggle() -> off"]);

  //! Mixed shortcut definition
  const switchStateMixedShortcut = superstate<SwitchState>("switch")
    .state("off", "toggle() -> on")
    .state("on", ["-> turnOn!", "toggle() -> off"], ($) => $.exit("turnOff!"));

  //! The actions must be correctly named
  superstate<SwitchState>("switch")
    .state("off", "toggle() -> on")
    .state(
      "on",
      // @ts-expect-error
      ["-> turnOn()", "turnOff? ->", "toggle() -> off"],
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
  const switch_ = switchStateSingle.host({
    on: {
      "-> turnOn!": () => console.log("Turning on"),
      "turnOff! ->": () => console.log("Turning off"),
    },
  });

  //! It allows to bind multiple states
  switchStateDouble.host({
    on: {
      "-> turnOn!": () => console.log("Turning on"),
    },
    off: {
      "-> turnOff!": () => console.log("Turning off"),
    },
  });

  //! Allows to bind shortcut actions
  switchStateShortcut.host({
    on: {
      "-> turnOn!": () => console.log("Turning on"),
      "turnOff! ->": () => console.log("Turning off"),
    },
  });
  switchStateMixedShortcut.host({
    on: {
      "-> turnOn!": () => console.log("Turning on"),
      "turnOff! ->": () => console.log("Turning off"),
    },
  });

  //! It forces to bind all actions
  switchStateSingle.host({
    // @ts-expect-error
    on: {
      "-> turnOn!": () => console.log("Turning on"),
    },
  });

  //! The defitions must be correct
  switchStateSingle.host({
    on: {
      // @ts-expect-error
      "-> turnOn?": () => console.log("Turning on"),
      "turnOff! ->": () => console.log("Turning off"),
    },
  });

  //! Can't bind unknown events
  switchStateSingle.host({
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
//#endregion

//#region Transition actions
{
  type ButtonState = "off" | "on";

  //! Allows to define the transition actions
  const buttonState = superstate<ButtonState>("button")
    .state("off", ($) => $.on("press() -> turnOn! -> on"))
    .state("on", ($) => $.on("press() -> turnOff! -> off"));

  type PushableButtonState = ButtonState | "pushed";

  //! Allows to define actions on conditional transitions
  const buttonStateWithCondition = superstate<PushableButtonState>("button")
    .state("off", ($) => $.on("press() -> turnOn! -> on"))
    .state("on", ($) =>
      $.if("press", ["(long) -> blink! -> pushed", "() -> turnOff! -> off"])
    )
    .state("pushed", "press() -> turnOff! -> off");

  //! Allows to use shortcuts
  const buttonStateMixed = superstate<PushableButtonState>("button")
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
  buttonState.host({
    on: {
      "press() -> turnOff!": () => console.log("Turning on"),
    },
    off: {
      "press() -> turnOn!": () => console.log("Turning off"),
    },
  });

  //! It allows to bind conditional transitions
  buttonStateWithCondition.host({
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
  buttonStateMixed.host({
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
  buttonStateWithCondition.host({
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
  buttonState.host({
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
  buttonState.host({
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
//#endregion

//#region Substate actions
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
        "os.terminated -> shutdown() -> off"
      )
    );

  const pcStateNoActions = superstate<PCState>("pc")
    .state("off", "power() -> on")
    .state("on", ($) =>
      $.on("power() -> off").sub(
        "os",
        osState,
        "os.terminated -> shutdown() -> off"
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
//#endregion

//#region Context
{
  //! Simple context
  {
    type SignUpFormState =
      | State<"credentials", SignUpInitial>
      | State<"profile", SignUpCredentials>
      | State<"done", SignUpComplete>;

    interface SignUpInitial {
      ref: string;
    }

    interface SignUpCredentials extends SignUpInitial {
      email: string;
      password: string;
    }

    interface SignUpComplete extends SignUpCredentials {
      fullName: string;
      company: string;
    }

    const formState = superstate<SignUpFormState>("signUp")
      .state("credentials", "submit() -> profile")
      .state("profile", "submit() -> done")
      .final("done");

    //! It requires to include the initial context when hosting
    const form = formState.host({
      context: {
        ref: "topbar",
      },
    });

    //! The context must be included
    // @ts-expect-error
    formState.host();
    // @ts-expect-error
    formState.host({});

    //! The context must be correct
    formState.host({
      context: {
        // @ts-expect-error
        nope: "nah",
      },
    });

    //! It requires to include the context assignment when sending an event
    form.send.submit("-> profile", {
      ref: "topbar",
      email: "koss@nocorp.me",
      password: "123456",
    });

    //! It doesn't allow passing extra fields
    // @ts-expect-error
    form.send.submit("-> profile", {
      ref: "topbar",
      email: "koss@nocorp.me",
      password: "123456",
      error: "nope",
    });
    const payload = {
      ref: "topbar",
      email: "koss@nocorp.me",
      password: "123456",
      error: "nope",
    };
    // @ts-expect-error
    form.send.submit("-> profile", payload);

    //! It doesn't allow to omit the context fields from the previous state
    // @ts-expect-error
    form.send.submit("-> profile", {
      email: "koss@nocorp.me",
      password: "123456",
    });
    // @ts-expect-error
    form.send.submit("-> done", {
      fullName: "Sasha Koss",
      company: "No Corp",
    });

    //! It allows to pass function that accepts the previous context
    form.send.submit("-> profile", ($, context) =>
      $({
        ref: context.ref,
        email: "koss@nocorp.me",
        password: "123456",
      })
    );
    form.send.submit("-> done", ($, context) =>
      $({
        ref: context.ref,
        email: context.email,
        password: context.password,
        fullName: "Sasha Koss",
        company: "No Corp",
      })
    );

    //! It disallows passing extra fields
    form.send.submit("-> profile", ($, context) =>
      $({
        ref: context.ref,
        email: "koss@nocorp.me",
        password: "123456",
        // @ts-expect-error
        error: "nope",
      })
    );
    form.send.submit("-> done", ($, context) =>
      $({
        ref: context.ref,
        email: context.email,
        password: context.password,
        fullName: "Sasha Koss",
        company: "No Corp",
        // @ts-expect-error
        error: "nope",
      })
    );

    //! It disallows returning context from the updater
    // @ts-expect-error
    form.send.submit("-> profile", () => ({
      ref: "topbar",
      email: "koss@nocorp.me",
      password: "123456",
      error: "nope",
    }));
    // @ts-expect-error
    form.send.submit("-> done", () => ({
      ref: "topbar",
      email: "koss@nocorp.me",
      password: "123456",
      fullName: "Sasha Koss",
      company: "No Corp",
      error: "nope",
    }));

    //! It should not allow to send invalid context
    // @ts-expect-error
    form.send.submit("-> profile", {
      nope: "nah",
    });

    //! null can't be a valid payload
    // @ts-expect-error
    form.send.submit("-> profile", null);

    //! Empty object can't be a valid payload
    // @ts-expect-error
    form.send.submit("-> profile", {});

    //! Should not accept wrong context
    // @ts-expect-error
    form.send.submit("-> profile", {
      fullName: "Sasha Koss",
      company: "No Corp",
    });

    //! It should not allow omitting incomaptible context fields
    {
      type SignUpFormState =
        | State<"credentials", SignUpInitial>
        | State<"profile", SignUpCredentials>;

      interface SignUpInitial {
        ref: string | null;
      }

      interface SignUpCredentials {
        ref: string;
        email: string;
        password: string;
      }

      const formState = superstate<SignUpFormState>("signUp")
        .state("credentials", "submit() -> profile")
        .state("profile");

      const form = formState.host({
        context: {
          ref: null,
        },
      });

      form.send.submit("-> profile", {
        ref: "hello",
        email: "koss@nocorp.me",
        password: "123456",
      });

      //! ref is required while it's optional on SignUpInitial
      // @ts-expect-error
      form.send.submit("-> profile", {
        email: "koss@nocorp.me",
        password: "123456",
      });

      //! null can't be a valid payload
      // @ts-expect-error
      form.send.submit("-> profile", null);

      //! Empty object can't be a valid payload
      // @ts-expect-error
      form.send.submit("-> profile", {});
    }

    //! It prevents assigning incompatible union types
    {
      interface Fields {
        email: string;
        password: string;
      }

      interface ErrorFields {
        error: string;
      }

      type FieldsWithErrors = Fields & ErrorFields;

      type FormState =
        | State<"pending", Fields>
        | State<"errored", Fields & ErrorFields>
        | State<"complete", Fields>
        | "canceled";

      const formState = superstate<FormState>("form")
        .state("pending", [
          "submit(error) -> errored",
          "submit() -> complete",
          "cancel() -> canceled",
        ])
        .state("errored", [
          "submit(error) -> errored",
          "submit() -> complete",
          "cancel() -> canceled",
        ])
        .final("complete")
        .final("canceled");

      const form = formState.host({
        context: {
          email: "",
          password: "",
        },
      });

      //! Ok as we assign email and password only
      form.send.submit("-> complete", ($, { email, password }) =>
        $({
          email,
          password,
        })
      );

      //! Should fail as we leak error field
      // @ts-expect-error
      form.send.submit("-> complete", (context) => context);
    }

    //! It should prevent adding extra context fields
    {
      function createFormState<FormFields>() {
        type Context = FormFields & ErrorFields;

        type FormState =
          | State<"pending", Partial<Context>>
          | State<"errored", Context>
          //! Context here includes ErrorFields
          | State<"complete", Context>
          | "canceled";

        return superstate<FormState>("form")
          .state("pending", [
            "submit(error) -> errored",
            "submit() -> complete",
            "cancel() -> canceled",
          ])
          .state("errored", [
            "submit(error) -> errored",
            "submit() -> complete",
            "cancel() -> canceled",
          ])
          .final("complete")
          .final("canceled");
      }

      const credentialsState = createFormState<CredentialsFields>();

      const profileState = createFormState<ProfileFields>();

      const signUpState = superstate<SignUpState>("signUp")
        .state("credentials", ($) =>
          $.sub("form", credentialsState, [
            //! Can't connect as the context is incompatible
            // @ts-expect-error
            "form.complete -> submit() -> profile",
          ])
        )
        .state("profile", ($) =>
          //! Can't connect as the context is incompatible
          // @ts-expect-error
          $.sub("form", profileState, ["form.complete -> submit() -> done"])
        )
        .final("done");
    }
    //! It properly resolves state on send
    // [NOTE] This is an edge case caught in tests
    {
      const credentialsState = createFormState<CredentialsFields>();

      const credentials = credentialsState.host({
        context: { email: "", password: "" },
      });

      const erroredState = credentials.send.submit("error", "-> errored", {
        email: "",
        password: "123456",
        error: "Email not found",
      });

      //! The state should resolve
      erroredState?.context;
    }

    //! Prevents extra fields in the updater function
    {
      interface Fields {
        email: string;
        password: string;
      }

      interface ErrorFields {
        error: string;
      }

      type FieldsWithErrors = Fields & ErrorFields;

      type FormState =
        | State<"pending", Fields>
        | State<"errored", Fields & ErrorFields>
        | State<"complete", Fields>
        | "canceled";

      const formState = superstate<FormState>("form")
        .state("pending", [
          "submit(error) -> errored",
          "submit() -> complete",
          "cancel() -> canceled",
        ])
        .state("errored", [
          "submit(error) -> errored",
          "submit() -> complete",
          "cancel() -> canceled",
        ])
        .final("complete")
        .final("canceled");

      const form = formState.host({
        context: { email: "", password: "" },
      });

      //! It prevent passing extra fields (errored can have error field):
      form.send.submit("-> complete", ($, context) => {
        context satisfies (Fields & ErrorFields) | Fields;
        // @ts-expect-error
        return $(context);
      });
    }
  }

  //#region Context/conditions
  {
    type SignUpFormState =
      | State<"credentials", SignUpInitial>
      | State<"profile", SignUpCredentials>
      | State<"done", SignUpComplete>;

    interface ErrorFields {
      error?: string;
    }

    interface SignUpInitial extends ErrorFields {
      email?: string;
      password?: string;
    }

    interface SignUpCredentials extends ErrorFields {
      email: string;
      password: string;
      fullName?: string;
      company?: string;
    }

    interface SignUpComplete extends ErrorFields {
      email: string;
      password: string;
      fullName: string;
      company: string;
    }

    const formState = superstate<SignUpFormState>("signUp")
      .state("credentials", [
        "submit(error) -> credentials",
        "submit() -> profile",
      ])
      .state("profile", ["submit(error) -> profile", "submit() -> done"])
      .final("done");

    //! It allows to omit passing optional context
    const form = formState.host();

    //! Allows passing empty context
    formState.host({});
    formState.host({ context: {} });

    //! It allows to send context with guarded events
    form.send.submit("error", "-> credentials", {
      email: "",
      password: "123456",
      error: "The email is missing",
    });

    //! It allows to send context with unguarded events
    form.send.submit("-> done", ($, context) =>
      $({
        ...context,
        fullName: "Sasha Koss",
        company: "No Corp",
      })
    );

    //! It should not allow incorrect context
    // @ts-expect-error
    form.send.submit("error", "-> credentials", {
      nope: "nah",
    });

    //! It should not allow null
    // @ts-expect-error
    form.send.submit("error", "-> credentials", null);

    //! It should not context from another state
    // @ts-expect-error
    form.send.submit("error", "-> credentials", {
      fullName: "Sasha Koss",
      company: "No Corp",
    });
  }
  //#endregion

  //#region Context/substates

  interface ErrorFields {
    error?: string;
  }

  function createFormState<FormFields>() {
    type Context = FormFields & ErrorFields;

    type FormState =
      | State<"pending", Partial<Context>>
      | State<"errored", Context>
      | State<"complete", FormFields & {}>
      | "canceled";

    return superstate<FormState>("form")
      .state("pending", [
        "submit(error) -> errored",
        "submit() -> complete",
        "cancel() -> canceled",
      ])
      .state("errored", [
        "submit(error) -> errored",
        "submit() -> complete",
        "cancel() -> canceled",
      ])
      .final("complete")
      .final("canceled");
  }

  type DoneContext = CredentialsFields & ProfileFields;

  type SignUpState =
    | State<"credentials">
    | State<"profile", CredentialsFields>
    | State<"done", DoneContext>;

  interface CredentialsFields {
    email: string;
    password: string;
  }

  interface ProfileFields {
    fullName: string;
    company: string;
  }

  const credentialsState = createFormState<CredentialsFields>();

  const profileState = createFormState<ProfileFields>();

  const signUpState = superstate<SignUpState>("signUp")
    .state("credentials", ($) =>
      $.sub("form", credentialsState, ["form.complete -> submit() -> profile"])
    )
    .state("profile", ($) =>
      $.sub("form", profileState, ["form.complete -> submit() -> done"])
    )
    .final("done");

  {
    //! It should not allow to connect incompatible final states
    {
      const signUpState = superstate<SignUpState>("signUp")
        .state("credentials", ($) =>
          $.sub("form", credentialsState, [
            // @ts-expect-error
            "form.canceled -> submit() -> profile",
          ])
        )
        .state("profile", ($) =>
          $.sub("form", profileState, [
            // @ts-expect-error
            "form.canceled -> submit() -> done",
          ])
        )
        .final("done");
    }

    {
      const form = signUpState.host();

      form.send.profile.form.submit("-> complete", {
        fullName: "Sasha Koss",
        company: "No Corp",
      });

      //! It assigns the correct context
      form.send.credentials.form.submit(
        "-> complete",
        ($, { email, password }) =>
          $({
            email: email!,
            password: password!,
          })
      );
      form.send.credentials.form.submit("-> complete", ($, context) =>
        $({
          email: "koss@nocorp.me",
          password: "123456",
        })
      );
      form.send.profile.form.submit("-> complete", ($, { fullName, company }) =>
        $({ fullName: fullName!, company: company! })
      );

      //! It should not allow wrong context
      form.send.profile.form.submit("-> complete", {
        // @ts-expect-error
        email: "koss@nocorp.me",
        // @ts-expect-error
        password: "123456",
      });
      // @ts-expect-error
      form.send.profile.form.submit("-> complete", ($, { email, password }) =>
        // @ts-expect-error
        $({ email, password })
      );

      //! It won't accept incomplete context
      // @ts-expect-error
      form.send.profile.form.submit("-> complete", {
        company: "No Corp",
      });

      //! Context must be defined
      // @ts-expect-error
      form.send.profile.form.submit("-> complete");

      //! Context can't be empty
      // @ts-expect-error
      form.send.profile.form.submit("-> complete", {});

      //! Context can't be null
      // @ts-expect-error
      form.send.profile.form.submit("-> complete", null);
    }

    //! It requires to include initial context for substates
    {
      interface RefFields {
        ref: string;
      }

      type SignUpState =
        | State<"credentials", RefFields>
        | State<"profile", RefFields & CredentialsFields>
        | State<"done", RefFields & DoneContext>;

      function createFormState<FormFields>() {
        type Context = FormFields & ErrorFields;

        type FormState =
          | State<"pending", Context>
          | State<"errored", Context>
          | State<"complete", FormFields & {}>
          | "canceled";

        return superstate<FormState>("form")
          .state("pending", [
            "submit(error) -> errored",
            "submit() -> complete",
            "cancel() -> canceled",
          ])
          .state("errored", [
            "submit(error) -> errored",
            "submit() -> complete",
            "cancel() -> canceled",
          ])
          .final("complete")
          .final("canceled");
      }

      const credentialsState = createFormState<CredentialsFields>();

      const profileState = createFormState<ProfileFields>();

      const signUpState = superstate<SignUpState>("signUp")
        .state("credentials", ($) =>
          $.sub("form", credentialsState, [
            "form.complete -> submit() -> profile",
          ])
        )
        .state("profile", ($) =>
          $.sub("form", profileState, ["form.complete -> submit() -> done"])
        )
        .final("done");

      //! It requires to bind all the substate contexts
      signUpState.host({
        context: {
          ref: "topbar",
        },

        credentials: {
          form: {
            context: {
              email: "",
              password: "",
            },
          },
        },

        profile: {
          form: {
            context: {
              fullName: "",
              company: "",
            },
          },
        },
      });

      //! It allows to pass the function that accepts the parent context
      signUpState.host({
        context: {
          ref: "topbar",
        },

        credentials: {
          form: {
            context: ($, context) =>
              $({
                email: "",
                password: "",
              }),
          },
        },

        profile: {
          form: {
            context: ($, context) =>
              $({
                fullName: "",
                company: "",
              }),
          },
        },
      });

      //! Can't subtitude the substate contexts
      signUpState.host({
        context: {
          ref: "topbar",
        },

        credentials: {
          form: {
            context: {
              // @ts-expect-error
              fullName: "",
              company: "",
            },
          },
        },

        profile: {
          form: {
            context: {
              // @ts-expect-error
              email: "",
              password: "",
            },
          },
        },
      });

      //! Contexts must be correct
      signUpState.host({
        context: {
          ref: "topbar",
        },

        credentials: {
          form: {
            context: {
              // @ts-expect-error
              nope: true,
            },
          },
        },

        profile: {
          form: {
            context: {
              // @ts-expect-error
              nah: false,
            },
          },
        },
      });

      //! Contexts can't be partial
      signUpState.host({
        context: {
          ref: "topbar",
        },

        credentials: {
          form: {
            // @ts-expect-error
            context: {
              email: "",
            },
          },
        },

        profile: {
          form: {
            // @ts-expect-error
            context: {
              company: "",
            },
          },
        },
      });

      //! Contexts can't be ommited
      signUpState.host({
        context: {
          ref: "topbar",
        },

        credentials: {
          // @ts-expect-error
          form: {},
        },
      });

      //! Contexts can't be empty objects
      signUpState.host({
        context: {
          ref: "topbar",
        },

        credentials: {
          form: {
            // @ts-expect-error
            context: {},
          },
        },

        profile: {
          form: {
            // @ts-expect-error
            context: {},
          },
        },
      });

      //! Contexts can't be null
      signUpState.host({
        context: {
          ref: "topbar",
        },

        credentials: {
          form: {
            // @ts-expect-error
            context: null,
          },
        },

        profile: {
          form: {
            // @ts-expect-error
            context: null,
          },
        },
      });

      //! The bindings argument can't be omitted
      // @ts-expect-error
      signUpState.host();
    }
  }

  //#region Contexts/listeners
  {
    const form = signUpState.host();

    //! It exposes context on the state
    {
      const state = form.in("credentials");
      if (state) {
        state.context satisfies null;

        //! The context should not be any
        // @ts-expect-error
        state.context.nope;
      }
    }
    {
      const state = form.in("profile");
      if (state) {
        state.context satisfies CredentialsFields;

        //! The context should not be any
        // @ts-expect-error
        state.context.nope;
      }
    }

    //! It exposes context in the updates
    {
      form.on("*", (update) => {
        switch (update.type) {
          case "event": {
            if (update.transition.to === "done") {
              update.transition.context satisfies DoneContext;

              //! The context should not be any
              // @ts-expect-error
              update.transition.context.nope;
            }

            if (update.transition.to === "profile") {
              update.transition.context satisfies CredentialsFields;

              //! The context should not be any
              // @ts-expect-error
              update.transition.context.nope;
            }
            break;
          }

          case "state": {
            if (update.state.name === "profile") {
              update.state.context satisfies CredentialsFields;

              //! The context should not be any
              // @ts-expect-error
              update.state.context.nope;
            }
            break;
          }
        }
      });

      form.on("credentials.form.submit()", (update) => {
        update.transition.context satisfies CredentialsFields;

        //! The context should not be any
        // @ts-expect-error
        update.transition.context.nope;
      });
    }
  }

  //#endregion
}
//#endregion

//#region Factory
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
      $.enter("blip!")
        .on("power() -> turnOff! -> off")
        .sub("os", osState, "os.terminated -> shutdown() -> off")
    );

  //! The name must be a string
  pcState.name satisfies string;

  //! The properties must be correct
  pcState.states.forEach((state) => {
    state.name satisfies PCState;
    state.final satisfies false;
    state.initial satisfies boolean;

    //! The actions must be of the correct type
    state.actions.forEach((action) => {
      action.name satisfies "blip";
    });

    if (state.name === "on") {
      //! The substate must be a substate
      state.sub.os.name satisfies "os";
      const os = state.sub.os.factory.host({
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
      os.state.name satisfies OSState;
    }

    //! The transitions must be of the correct type
    state.transitions.forEach((transition) => {
      transition.event satisfies "power";
    });
  });
}
//#endregion

//#region Utils
{
  //! NoExtra
  {
    function create<Reference>() {
      return <A, B, C>(
        value: Superstate.Utils.Exact<Reference, A | B | C>
      ) => {};
    }

    //! It resolves the same type for primitives
    {
      const exact = create<number>();

      exact(123);

      const value = 123;
      exact(value);
    }
    {
      const exact = create<string>();

      exact("qwe");

      const value = "qwe";
      exact(value);
    }

    //! It resolves the reference type otherwise casting an error
    {
      const exact = create<number>();

      // @ts-expect-error
      exact("123");

      const value = "123";
      // @ts-expect-error
      exact(value);

      // @ts-expect-error
      exact(value as number | string);
    }
    {
      const exact = create<boolean>();

      // @ts-expect-error
      exact("true");

      const value = "true";
      // @ts-expect-error
      exact(value);

      // @ts-expect-error
      exact(value as boolean | string);
    }

    //! It allows exact types
    {
      const exact = create<{ hello: string }>();

      exact({ hello: "world" });

      const value = { hello: "world" };
      exact(value);
    }

    //! It prevents wrong types
    {
      const exact = create<{ hello: string }>();

      // @ts-expect-error
      exact({ nope: "nah" });

      const value = { nope: "nah" };
      // @ts-expect-error
      exact(value);

      // @ts-expect-error
      exact(value as { hello: string } | { nope: "nah" });
    }

    //! It prevents empty objects
    {
      const exact = create<{ hello: string }>();

      // @ts-expect-error
      exact({});

      const value = {};
      // @ts-expect-error
      exact(value);

      // @ts-expect-error
      exact(value as { hello: string } | {});
    }

    //! It allows ommitting optional properties
    {
      const exact = create<{ hello: string; hey?: string }>();

      exact({ hello: "world" });

      const value = { hello: "world" };
      exact(value);
    }

    //! It prevents extra properties
    {
      const exact = create<{ hello: string }>();

      // @ts-expect-error
      exact({ hello: "world", nope: "nah" });

      const value = { hello: "world", nope: "nah" };
      // @ts-expect-error
      exact(value);

      // @ts-expect-error
      exact(value as { hello: string } | { hello: string; nope: string });
    }
  }
}
//#endregion

//#region Documentation
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
  volume.send.up();

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

  {
    type PCState = "on" | "off" | "sleep";

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
      const nextState = pc.send.press("long");

      // The next state is "off":
      if (nextState) nextState.name satisfies "off";
    }

    {
      // Send the press event:
      const nextState = pc.send.press();

      // The next state is "sleep" or "on":
      if (nextState) nextState.name satisfies "sleep" | "on";
    }
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
    player.send.playing.volume.up();

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

  type PCState = "on" | "off";

  type OSState = "running" | "sleeping" | "terminated";

  const osState = superstate<OSState>("running")
    .state("running", "terminate() -> terminated")
    .state("sleeping", ["wake() -> running", "terminate() -> terminated"])
    // Mark the terminated state as final
    .final("terminated");

  {
    const pcState = superstate<PCState>("pc")
      .state("off", "power() -> on")
      .state("on", ($) =>
        $.on("power() -> off")
          // Nest the OS state as `os` and connect the `terminated` state
          // through `shutdown()` event to `off` state of the parent.
          .sub("os", osState, "os.terminated -> shutdown() -> off")
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
          "os.terminated -> shutdown() -> off"
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

  //! API

  type SwitchState = "off" | "on";

  //! superstate

  {
    // import { superstate } from "superstate";

    // Define available states:
    type SwitchState = "off" | "on";

    // Initiate the "name" statechart creation:
    const builder = superstate<SwitchState>("name");
  }

  //! Builder

  //! builder.state

  {
    const state = superstate<SwitchState>("name")
      .state("off", "turnOn() -> on")
      .state("on", "turnOff() -> off");
  }

  //! builder.state(_, defs)

  {
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
  }

  //! builder.state(_, [defs], builder)

  {
    // Define the state properties using the state builder object:
    const state = superstate<SwitchState>("switch")
      .state("off", ($) =>
        $.enter("turnOffLights!").exit("turnOnLights!").on("turnOn() -> on")
      )
      .state("on", ($) => $.on("turnOff() -> onOff! -> off"));
  }

  {
    // Use both string and builder function definitions:
    const state = superstate<SwitchState>("switch")
      .state("off", "-> turnOffLights!", ($) =>
        $.exit("turnOnLights!").on("turnOn() -> on")
      )
      .state("on", ($) => $.on("turnOff() -> onOff! -> off"));
  }

  {
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
  }

  //! $.on

  {
    const state = superstate<SwitchState>("name")
      .state("off", ($) => $.on("turnOn() -> on"))
      .state("on", ($) => $.on("turnOff() -> off"));
  }

  {
    type PCState = "on" | "off" | "sleep";

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
  }

  //! $.if

  {
    type PCState = "on" | "off" | "sleep";

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
  }

  {
    type PCState = "on" | "off" | "sleep";

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
  }

  //! $.enter

  {
    const state = superstate<SwitchState>("name")
      .state("off", ($) => $.enter("turnOffLights!").on("turnOn() -> on"))
      .state("on", ($) => $.enter("turnOnLights!").on("turnOff() -> off"));
  }

  //! $.exit

  {
    const state = superstate<SwitchState>("name")
      .state("off", ($) => $.exit("turnOnLights!").on("turnOn() -> on"))
      .state("on", ($) => $.exit("turnOffLights!").on("turnOff() -> off"));
  }

  //! $.sub

  {
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

    const player = playerState.host();

    const playing = player.in("playing");
    // Access the volume substate:
    if (playing) console.log("Is volume high? ", playing.sub.volume.in("high"));

    // Or using the dot notation from the parent:
    const high = player.in("playing.volume.high");
    console.log("Is volume high? ", high);
  }

  {
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
          .sub("os", osState, "os.terminated -> shutdown() -> off")
      );
  }

  //! Factory

  //! factory.host

  {
    const buttonState = superstate<ButtonState>("button")
      .state("off", "press() -> on")
      .state("on", "press() -> off");
  }

  {
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
  }

  {
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
      .state("on", ($) =>
        $.on("power() -> powerOff! -> off").sub("os", osState)
      );

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
  }

  //! factory.name

  {
    const buttonState = superstate<ButtonState>("button")
      .state("off", "press() -> on")
      .state("on", "press() -> off");

    buttonState.name;
    //=> "button"
  }

  //! Instance

  {
    const playerState = superstate<PlayerState>("player")
      .state("stopped", "play() -> playing")
      .state("playing", ["pause() -> paused", "stop() -> stopped"], ($) =>
        // Define the substate using the builder function:
        $.sub("volume", volumeState)
      )
      .state("paused", ["play() -> playing", "stop() -> stopped"]);

    const volumeState = superstate<VolumeState>("volume")
      .state("low", "up() -> medium")
      .state("medium", ["up() -> high", "down() -> low"])
      .state("high", "down() -> medium");

    const osState = superstate<OSState>("running")
      .state("running", "terminate() -> terminated")
      .state("sleeping", ["wake() -> running", "terminate() -> terminated"])
      .final("terminated");

    const pcState = superstate<PCState>("pc")
      .state("off", "power() -> on")
      .state("on", ($) =>
        $.on("power() -> off").sub(
          "os",
          osState,
          "os.terminated -> shutdown() -> off"
        )
      );

    //! instance.state

    {
      const instance = playerState.host();

      instance.send.play();

      // Check the current state:
      instance.state.name;
      //=> "playing"
    }

    //! instance.finalized

    {
      const instance = osState.host();

      instance.send.terminate();

      // Check if the statechart is finalized:
      instance.finalized;
      //=> true
    }

    //! instance.finalized

    {
      const instance = playerState.host();

      {
        // Check if the statechart is playing:
        const playingState = instance.in("playing");

        if (playingState) {
          playingState.name;
          //=> "playing"
        }
      }

      {
        // Check if the statechart is playing or paused:
        const state = instance.in(["playing", "paused"]);

        if (state) {
          state.name;
          //=> "playing" | "paused"
        }
      }

      {
        const instance = pcState.host();

        // Check if the statechart is in the `on` state and the `os` substate
        // is in the `sleeping` state:
        const state = instance.in("on.os.sleeping");

        if (state) {
          state.name;
          //=> "sleeping"
        }
      }
    }

    //! instance.on

    {
      const instance = playerState.host();

      // Trigger when the instances tranisitions into the "paused" state:
      instance.on("paused", (update) => {
        console.log("The player is now paused");

        update.type satisfies "state";
        update.state.name satisfies "paused";
      });

      // Trigger when the "pause()" event is sent:
      instance.on("pause()", (update) => {
        console.log("The player is paused");

        update.type satisfies "event";
        update.transition.event satisfies "pause";
      });

      const off = instance.on("paused", () => {});

      off();

      // Won't trigger the listener:
      instance.send.pause();

      // Trigger on "pause()" event and "paused" state:
      instance.on(["paused", "pause()"], (update) => {
        if (update.type === "state") {
          update.state.name satisfies "paused";
        } else {
          update.transition.event satisfies "pause";
        }
      });

      // Subscribe to all updates:
      instance.on("*", (update) => {
        if (update.type === "state") {
          update.state.name satisfies "stopped" | "playing" | "paused";
        } else {
          update.transition.event satisfies "play" | "pause" | "stop";
        }
      });

      // Subscribe to substate updates:
      instance.on(["playing.volume.down()", "playing.volume.low"], (update) => {
        if (update.type === "state") {
          update.state.name satisfies "low";
        } else {
          update.transition.event satisfies "down";
        }
      });

      // Subscribe to all substate updates:
      instance.on("playing.volume.*", (update) => {
        if (update.type === "state") {
          update.state.name satisfies "low" | "medium" | "high";
        } else {
          update.transition.event satisfies "up" | "down";
        }
      });

      // Subscribe to all updates:
      instance.on("**", (update) => {
        if (update.type === "state") {
          update.state.name satisfies
            | "stopped"
            | "playing"
            | "paused"
            | "low"
            | "medium"
            | "high";
        } else {
          update.transition.event satisfies
            | "play"
            | "pause"
            | "stop"
            | "up"
            | "down";
        }
      });
    }

    //! instance.send
    {
      const instance = playerState.host();

      instance.on("playing", () => console.log("Playing!"));

      // Send "play()", trigger the listener and print "Playing!":
      instance.send.play();
    }

    //! instance.off
    {
      const instance = playerState.host();

      instance.on("playing", () => console.log("Playing!"));

      // Unsubscribe from all the updates:
      instance.off();

      // Won't trigger the listener:
      instance.send.play();

      {
        type PCState = "on" | "sleep" | "off";

        const pcState = superstate<PCState>("pc")
          .state("off", "press() -> on")
          .state("sleep", ($) =>
            $.if("press", ["(long) -> off", "() -> on"]).on("restart() -> on")
          )
          .state("on", ($) =>
            $.on("press(long) -> off")
              .on("press() -> sleep")
              .on("restart() -> on")
          );

        const instance = pcState.host();

        instance.on("press(long)", () => console.log("Pressed long"));

        // Won't trigger the listener:
        instance.send.press();

        // Will trigger the listener and print "Pressed long":
        instance.send.press("long");
      }

      {
        const nextState = instance.send.play();

        // If the event triggered a transition, send will return the playing state:
        if (nextState) {
          nextState.name satisfies "playing";
        }
      }

      {
        instance.on("playing.volume.up()", () => console.log("Volume up!"));

        // Will trigger the listener and print "Volume up!":
        instance.send.playing.volume.up();
      }
    }
  }

  //! Contexts
  {
    // Import the `State` type:
    // import { State, superstate } from "superstate";

    // Specify the context types:

    interface Fields {
      email: string;
      password: string;
    }

    interface ErrorFields {
      error: string;
    }

    // Define the states

    type FormState =
      | State<"pending", Fields>
      | State<"errored", Fields & ErrorFields>
      | State<"complete", Fields>
      | "canceled";

    // Define the form statechart:

    const formState = superstate<FormState>("form")
      .state("pending", [
        "submit(error) -> errored",
        "submit() -> complete",
        "cancel() -> canceled",
      ])
      .state("errored", [
        "submit(error) -> errored",
        "submit() -> complete",
        "cancel() -> canceled",
      ])
      .final("complete")
      .final("canceled");

    // Pass the initial context:
    const form = formState.host({
      context: {
        email: "",
        password: "",
      },
    });

    // Send submit event:
    form.send.submit("-> complete", {
      email: "koss@nocorp.me",
      password: "123456",
    });

    // Send submit with the error condition:
    form.send.submit("error", "-> errored", {
      email: "",
      password: "123456",
      error: "Email is missing",
    });

    // Access context via the state:
    if (form.state.name === "errored")
      form.state.context.error satisfies string;

    // Receive the context with updates:
    form.on("*", (update) => {
      if (update.type === "event") {
        // Access the context in the transition:
        if (update.transition.to === "errored")
          update.transition.context satisfies Fields & ErrorFields;
      } else {
        // Access the context in the state:
        if (update.state.name === "errored")
          update.state.context satisfies Fields & ErrorFields;
      }
    });

    // Build new context using the previous state context:
    form.send.submit("error", "-> errored", ($, context) =>
      $({ ...context, error: "Email is missing" })
    );

    // @ts-expect-error
    form.send.submit("-> complete", ($, context) => $(context));
    //                                                ~~~~~~~
    //> Property 'error' is missing in type 'Fields' but required in type '{ error: never; }'

    // Cherry-pick email and password:
    form.send.submit("-> complete", ($, { email, password }) =>
      $({ email, password })
    );

    {
      interface ErrorFields {
        error: string;
      }

      // Accept form fields generic:
      function createFormState<FormFields>() {
        type FormState =
          | State<"pending", FormFields & {}>
          | State<"errored", FormFields & ErrorFields>
          | State<"complete", FormFields & {}>;

        return (
          superstate<FormState>("form")
            .state("pending", [
              // update()
              "update() -> pending",
              "submit(error) -> errored",
              "submit() -> complete",
            ])
            .state("errored", [
              "update() -> pending",
              "submit(error) -> errored",
              "submit() -> complete",
            ])
            // Mark the complete state as final:
            .final("complete")
        );
      }

      interface CredentialsFields {
        email: string;
        password: string;
      }

      interface ProfileFields {
        fullName: string;
        company: string;
      }

      // Define the states with the context types:
      type SignUpState =
        | "credentials"
        | State<"profile", CredentialsFields>
        | State<"done", CredentialsFields & ProfileFields>;

      // Create the credentials form statechart:
      const credentialsState = createFormState<CredentialsFields>();

      // Create the profile form statechart:
      const profileState = createFormState<ProfileFields>();

      // Define the signup statechart:
      const signUpState = superstate<SignUpState>("signUp")
        .state("credentials", ($) =>
          $.sub("form", credentialsState, [
            // When the form is complete, transition to profile:
            "form.complete -> submit() -> profile",
          ])
        )
        .state("profile", ($) =>
          $.sub("form", profileState, [
            // When the form is complete, transition to done:
            "form.complete -> submit() -> done",
          ])
        )
        .final("done");

      // Since we require the full context in each form initial state, we have
      // to specify the initial context for each form:
      const signUp = signUpState.host({
        credentials: {
          form: {
            // Initial context for the credentials form:
            context: {
              email: "",
              password: "",
            },
          },
        },

        profile: {
          form: {
            // Initial context for the profile form:
            context: {
              company: "",
              fullName: "",
            },
          },
        },
      });

      // Fill in the email field:
      signUp.send.credentials.form.update("-> pending", ($, { password }) =>
        $({ email: "koss@nocorp.me", password })
      );

      // Fill in the password field:
      signUp.send.credentials.form.update("-> pending", ($, { email }) =>
        $({ email, password: "123456" })
      );

      // Submit the form:
      signUp.send.credentials.form.submit(
        "-> complete",
        ($, { email, password }) => $({ email, password })
      );

      const profile = signUp.in("profile");
      if (profile) {
        // You can access email and password from the profile state:
        const { email, password } = profile.context;
        console.log({ email, password });
      }

      // Submit the profile form:
      signUp.send.profile.form.submit(
        "-> complete",
        ($, { fullName, company }) => $({ fullName, company })
      );

      const done = signUp.in("done");
      if (done) {
        // You can access all the context fields:
        const { email, password, fullName, company } = done.context;
        console.log({ email, password, fullName, company });
      }
    }
  }
}
//#endregion

export function assertExtends<Type>(_value: Type) {}
