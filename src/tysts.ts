import { QQ, q2, superstate } from "./index.js";

//! Simple machine
{
  type PlayerState = "stopped" | "playing" | "paused";

  q2<PlayerState>("player")
    .state("stopped", ["play() -> playing"])
    //! The nope state is not defined
    // @ts-expect-error
    .state("nope", []);

  q2<PlayerState>("player")
    .state("stopped", ["play() -> playing"])
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
    nextState.final satisfies true;
  }

  //! The machine is not finalized
  cassete.finalized satisfies boolean;

  type Test1 = typeof cassete;

  //! The machine is finalized
  if (cassete.finalized) {
    //! So the next state is always true
    const nextState = cassete.send("play");
    nextState satisfies null;
  }
}

interface Wut1<Thing extends string, Huh extends boolean> {
  wut: Huh;
  ok: (name: Thing) => Huh extends true ? true : null;
}

type Wut2<Thing extends string, Huh extends boolean> = Huh extends true
  ? {
      wut: Huh;
      ok: (name: Thing) => true;
    }
  : {
      wut: Huh;
      ok: (name: Thing) => null;
    };

type Wut3<Thing extends string, Huh extends boolean> = Huh extends Huh
  ? {
      wut: Huh;
      ok: (name: Thing) => Huh extends true ? true : null;
    }
  : never;

type Wut4<Thing extends string, Huh extends boolean> = Huh extends Huh
  ? {
      wut: Huh;
      ok: Huh extends true ? (name: Thing) => true : (name: Thing) => null;
    }
  : never;

const wut = {} as never as Wut1<"hello" | "world", boolean>;

wut.ok("hello");

if (wut.wut) {
  const result = wut.ok("world");
  result satisfies true;
}

//! Conditions
{
  type PCState = "on" | "sleep" | "off";

  const pcMachine = q2<PCState>("pc")
    .entry("off", "press() -> on")
    .state("sleep", ["press() -> on", "press(long) -> off", "restart() -> on"])
    .state("on", ["press() -> sleep", "press(long) -> off", "restart() -> on"]);

  const pcMachine2 = superstate<PCState>("pc")
    .entry("off", "press() -> on")
    .state("sleep", ($) =>
      $.if("press", ["(long) -> off", "() -> on"]).on("restart() -> on")
    )
    .state("on", ($) =>
      $.if("press(long) -> off").else("press() -> sleep").on("restart() -> on")
    );

  const pc = pcMachine.enter();

  //! Allows to send an event without the condition
  pc.send("press");

  //! Allows to send an event with the condition
  pc.send("press", "long");

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

  const catMachine = q2<CatState>("cat")
    .entry("boxed", ["reveal(lucky) -> alive", "reveal(unlucky) -> dead"])
    .state("alive", "pet() -> alive")
    .state("dead");

  const catMachine2 = superstate<CatState>("cat")
    .entry("boxed", ($) =>
      $.on("reveal(lucky) -> alive").on("reveal(unlucky) -> dead")
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

//! Conditional exits
{
  type ConfirmState = "showing" | "confirmed";

  const confirmMachine = q2<ConfirmState>("confirm")
    .entry("showing", ["confirm(confirm) -> confirmed", "confirm(cancel) ->"])
    .state("confirmed");

  const confirmMachine2 = superstate<ConfirmState>("confirm")
    .entry("showing", ($) =>
      $.if("confirm", ["(confirm) -> confirmed", "confirm(cancel) ->"])
    )
    .state("confirmed");

  const cat = confirmMachine.enter();

  //! Allows to send conditional exit events
  cat.send("confirm", "confirm");
  cat.send("confirm", "cancel");

  //! The condition is undefined
  // @ts-expect-error
  cat.send("confirm", "nope");

  //! Should always pass the condition
  // @ts-expect-error
  cat.send("confirm");
}

//! Children states
{
  type TeaState = "water" | "steeping" | "ready";

  const teaMachine = q2<TeaState>("tea")
    .entry("water", ["infuse() -> steeping", "drink() ->"])
    .state("steeping", ["done() -> ready", "drink() ->"])
    .entry("ready", ["drink() ->"]);

  type MugState = "clear" | "full" | "dirty";

  q2<MugState>("mug")
    .entry("clear", "pour() -> full")
    .state("full", ["drink() -> clear"], ($) =>
      //! The entry must be specified if there are multiple entries
      // @ts-expect-error
      $.child(teaMachine, {
        "water -> drink() ->": "clear",
        "steeping -> drink() ->": "dirty",
        "ready -> drink() ->": "dirty",
      })
    )
    .state("dirty", ["clean() -> clear"]);

  q2<MugState>("mug")
    .entry("clear", "pour() -> full")
    .state("full", ["drink() -> clear"], ($) =>
      //! The nested machine entry is invalid
      // @ts-expect-error
      $.child(teaMachine, "wter", {
        "water -> drink() ->": "clear",
        "steeping -> drink() ->": "dirty",
        "ready -> drink() ->": "dirty",
      })
    )
    .state("dirty", ["clean() -> clear"]);

  q2<MugState>("mug")
    .entry("clear", "pour() -> full")
    .state("full", ["drink() -> clear"], ($) =>
      $.child(teaMachine, "water", {
        //! The exit must be correct
        // @ts-expect-error
        "ater -> drink() ->": "clear",
        "steeping -> drink() ->": "dirty",
        "ready -> drink() ->": "dirty",
      })
    )
    .state("dirty", ["clean() -> clear"]);

  type Test = typeof teaMachine extends QQ.MachineFactory<infer State>
    ? State["actions"]
    : never;

  q2<MugState>("mug")
    .entry("clear", "pour() -> full")
    .state("full", ["drink() -> clear"], ($) =>
      $.child(teaMachine, "water", {
        "after -> drink() ->": "clear",
        "steeping -> drink() ->": "dirty",
        //! The exiting state must be correct
        // @ts-expect-error
        "ready -> drink() ->": "dity",
      })
    )
    .state("dirty", ["clean() -> clear"]);

  const mugMachine = q2<MugState>("mug")
    .entry("clear", "pour() -> full")
    .state("full", ["drink() -> clear"], ($) => ({
      tea: $.child(teaMachine, "water", {
        "water -> drink() ->": "clear",
        "steeping -> drink() ->": "dirty",
        "ready -> drink() ->": "dirty",
      }),
    }))
    .state("dirty", ["clean() -> clear"]);

  const mug = mugMachine.enter();

  //! Event listeners

  mug.on("full", (target) => {
    target.state.children.tea.on("ready", (target) => {
      if (target.state.name === "ready") return;

      //! The state can only be ready
      target.state.name satisfies never;
    });
  });

  mug.on("full.tea.ready", (target) => {
    if (target.state.name === "ready") return;

    //! The state can only be ready
    target.state.name satisfies never;
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

    if (state)
      //! The state is clear or ready
      state.name satisfies "clear" | "ready";
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
      expire: $.child(expireMachine),
      heat: $.child(heatMachine),
      eat: $.child(eatMachine, {
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
