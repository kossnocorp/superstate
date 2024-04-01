import { QQ, superstate } from "./index.js";

//! Simple machine
{
  type PlayerState = "stopped" | "playing" | "paused";

  superstate<PlayerState>("player")
    .start("stopped", ["play() -> playing"])
    //! The nope state is not defined
    // @ts-expect-error
    .state("nope", []);

  superstate<PlayerState>("player")
    .start("stopped", ["play() -> playing"])
    //! The stopped state is already defined
    // @ts-expect-error
    .state("stopped", ["play() -> playing"]);

  const playerMachine = superstate<PlayerState>("player")
    .start("stopped", "play() -> playing")
    .state("playing", ($) => $.on(["pause() -> paused", "stop() -> stopped"]))
    .state("paused", ($) => $.on("play() -> playing").on("stop() -> stopped"));

  //! All the states are already defined
  // @ts-expect-error
  playerMachine.state;

  const player = playerMachine.enter();

  //! send

  //! The machine accepts the events

  player.send("play");
  player.send("pause");
  //! The event is not defined
  // @ts-expect-error
  player.send();
  //! The event is not defined
  // @ts-expect-error
  player.send("nope");

  //! It returns the next state or null
  {
    const nextState = player.send("play");

    //! The next state might be null
    assertExtends<typeof nextState>(null);

    if (nextState) {
      //! The next state is playing
      nextState.name satisfies "playing";
    }
  }

  //! on

  //! The machine allows to subscribe to all states
  const off = player.on("*", (target) => {
    if (target.type === "state") {
      switch (target.state.name) {
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
          target.state satisfies never;
      }
    } else if (target.type === "event") {
      switch (target.event.name) {
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
          target.event satisfies never;
      }
    } else {
      //! No other type is expected
      target satisfies never;
    }
  });

  //! on returns off that unsubscribes the listener
  off();

  //! The machine allows to subscribe to specific states
  player.on("stopped", (target) => {
    //! It can only be stopped state
    if (target.type === "state") {
      if (target.state.name === "stopped") {
        return;
      }

      //! Can't be anything but stopped
      target.state.name satisfies never;
      return;
    }

    //! Can only be state
    target.type satisfies never;
  });

  //! The machine allows to subscribe to few states
  player.on(["stopped", "playing"], (target) => {
    //! It can only be stopped or playing state
    if (target.type === "state") {
      switch (target.state.name) {
        //! Can't be invalid state
        // @ts-expect-error
        case "nope":
          break;

        case "stopped":
        case "playing":
          return;

        default:
          //! Can't be anything but stopped or playing
          target.state satisfies never;
      }
      return;
    }

    //! Can only be only state
    target.type satisfies never;
  });

  //! Can't subscribe to invalid states
  // @ts-expect-error
  player.on("nope", () => {});
  // @ts-expect-error
  player.on(["stopped", "nope"], () => {});

  //! The machine allows to subscribe to specific events
  player.on("stop()", (target) => {
    //! It can only be stop event
    if (target.type === "event") {
      if (target.event.name === "stop") {
        return;
      }

      //! Can't be anything but stop
      target.event.name satisfies never;
      return;
    }

    //! Can only be event
    target.type satisfies never;
  });

  //! The machine allows to subscribe to few events
  player.on(["stop()", "pause()"], (target) => {
    //! It can only be stop or pause events
    if (target.type === "event") {
      switch (target.event.name) {
        //! Can't be invalid state
        // @ts-expect-error
        case "nope":
          break;

        case "stop":
        case "pause":
          return;

        default:
          //! Can't be anything but stop or pause
          target.event satisfies never;
      }
      return;
    }

    //! Can only be event
    target.type satisfies never;
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
    actions: [],
    sub: {},
    final: false,
  };

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
    .start("off", "toggle() -> on")
    .state("on", "toggle() -> off");

  const light = lightMachine.enter();

  //! Can send events to multiple targets
  const nextState = light.send("toggle");
  if (nextState) {
    //! The next state is off
    nextState.name satisfies "off" | "on";
  }

  //! Subscribing to the events gives you multiple targets
  light.on("toggle()", (target) => {
    target.event.to satisfies "off" | "on";
  });
}

//! Final states
{
  type CassetteState = "stopped" | "playing" | "ejected";

  const casseteMachine = superstate<CassetteState>("cassette")
    .start("stopped", ($) => $.on(["play() -> playing", "eject() -> ejected"]))
    //! Mixed events definition
    .state("playing", "stop() -> stopped", ($) => $.on("eject() -> ejected"))
    .final("ejected");

  const cassete = casseteMachine.enter();

  //! Should be able to send exit events
  const nextState = cassete.send("eject");

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
    .start("off", "press() -> on")
    .state("sleep", ($) =>
      $.if("press", ["(long) -> off", "() -> on"]).on("restart() -> on")
    )
    .state("on", ($) =>
      $.on("press(long) -> off").on("press() -> sleep").on("restart() -> on")
    );

  const pc = pcMachine.enter();

  //! Allows to send an event without the condition
  {
    const nextState = pc.send("press");
    //! It properly infers the next state
    if (nextState) {
      nextState.name satisfies "on" | "sleep";
    }
  }

  //! Allows to send an event with the condition
  {
    const nextState = pc.send("press", "long");
    //! It properly infers the next state
    if (nextState) {
      nextState.name satisfies "off";
    }
  }

  //! The condition is undefined
  // @ts-expect-error
  pc.send("press", "nope");

  //! Can't send conditions to wrong events
  // @ts-expect-error
  pc.send("restart", "long");

  //! Can't send undefined events
  // @ts-expect-error
  pc.send();
  // @ts-expect-error
  pc.send("nope");
  // @ts-expect-error
  pc.send("nope", "nope");
  // @ts-expect-error
  pc.send("nope", "long");
}

//! Only-conditional events
{
  type CatState = "boxed" | "alive" | "dead";

  const catMachine = superstate<CatState>("cat")
    .start("boxed", ($) =>
      $.if("reveal", ["(lucky) -> alive", "(unlucky) -> dead"])
    )
    .state("alive", ($) => $.on("pet() -> alive"))
    .state("dead");

  const cat = catMachine.enter();

  //! Allows to send conditional exit events
  cat.send("reveal", "lucky");
  cat.send("reveal", "unlucky");

  //! The condition is undefined
  // @ts-expect-error
  cat.send("reveal", "nope");

  //! Should always pass the condition
  // @ts-expect-error
  cat.send("reveal");

  //! Can't send conditions to wrong events
  // @ts-expect-error
  cat.send("restart", "long");

  //! Can't send undefined events
  // @ts-expect-error
  cat.send();
  // @ts-expect-error
  cat.send("nope");
  // @ts-expect-error
  cat.send("nope", "nope");
  // @ts-expect-error
  cat.send("nope", "long");
}

//! Substates
{
  type TeaState = "water" | "steeping" | "ready" | "finished";

  const teaMachine = superstate<TeaState>("tea")
    .start("water", ["infuse() -> steeping", "drink() -> finished"])
    .state("steeping", ["done() -> ready", "drink() -> finished"])
    .state("ready", ["drink() -> finished"])
    .final("finished");

  type MugState = "clear" | "full" | "dirty";

  superstate<MugState>("mug")
    .start("clear", "pour() -> full")
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
    .start("clear", "pour() -> full")
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
    .start("clear", "pour() -> full")
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
    .start("clear", "pour() -> full")
    .state("full", ["drink() -> clear"], ($) =>
      $.sub("tea", teaMachine, "finished -> finish() -> dirty")
    )
    .state("dirty", ["clean() -> clear"]);

  const mug = mugMachine.enter();

  //! Event listeners

  mug.on("full", (target) => {
    //! Should be able to listen to substate states
    target.state.sub.tea.on("ready", (target) => {
      target.state.name satisfies "ready";
    });

    //! Should be able to listen to the substate events
    target.state.sub.tea.on("infuse()", (target) => {
      target.event.name satisfies "infuse";
    });
  });

  //! Should be able to listen to the substate states using dot notation
  mug.on("full.tea.ready", (target) => {
    target.state.name satisfies "ready";
  });

  //! Should be able to listen to the substate events
  mug.on("full.tea.infuse()", (target) => {
    target.event.name satisfies "infuse";
  });

  mug.on("*", (target) => {
    if (target.type === "state") {
      //! The nested events should be propogated
      if (target.state.name === "ready") return;
    }
  });

  mug.on("*", (target) => {
    if (target.type === "state") {
      //! The state is not defined
      // @ts-expect-error
      if (target.state.name === "rady") return;
    }
  });

  //! Should be able to listen to the exit transition
  mug.on("finish()", (target) => {
    target.event.name satisfies "finish";
    target.event.to satisfies "dirty";
  });

  //! Sending events

  //! Should be able to send events to substates
  {
    const nextState = mug.send("full.tea.infuse");
    if (nextState) {
      //! The next state is steeping
      nextState.name satisfies "steeping";
    }
  }

  //! Should not be able to send final transition events
  // @ts-expect-error
  mug.send("finish");

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

  const expireMachine = q2<ExpireState>("expire")
    .entry("expired", ["expire() -> expired"])
    .state("fresh");

  type HeatState = "frozen" | "thawed" | "hot";

  const heatMachine = q2<HeatState>("heat")
    .entry("frozen", "thaw() -> thawed")
    .state("thawed", "heat() -> hot")
    .state("hot");

  type MeatPieState = "unpacked" | "cooked";

  type EatState = "eating";

  const eatMachine = q2<EatState>("eat").entry("eating", "eat() -> eating");

  const meatPieMachine = q2<MeatPieState>("meatPie")
    .entry("unpacked", [], ($) => ({
      expire: $.sub(expireMachine),
      heat: $.sub(heatMachine),
      eat: $.sub(eatMachine, {
        "eating() ->": "cooked",
        //! The exit state is invalid
        // @ts-expect-error
        "nope() ->": "cooked",
      }),
    }))
    .state("cooked");
}

//! State actions
{
  type SwitchState = "off" | "on";

  superstate<SwitchState>("switch")
    .start("off", ($) => $.enter("turnOff").on("toggle() -> on"))
    .state("on", ($) => $.enter("turnOff").on("toggle() -> off"));

  superstate<SwitchState>("switch")
    .entry("off", "toggle() -> on")
    .state("on", ($) =>
      $.enter("turnOn")
        .on("toggle", "(hello) -> off", "() -> off")
        .on("whatever -> qwe")
        .exit("turnOff")
    );
}

export function assertExtends<Type>(_value: Type) {}
