import { q, q2 } from "./index.js";

//! Simple machine
{
  type PlayerState = "stopped" | "playing" | "paused";

  q2<PlayerState>("action")
    .state("stopped", ["play -> playing"])
    //! The nope state is not defined
    // @ts-expect-error
    .state("nope", []);

  q2<PlayerState>("action")
    .state("stopped", ["play -> playing"])
    //! The stopped state is already defined
    // @ts-expect-error
    .state("stopped", ["play -> playing"]);

  const playerMachine = q2<PlayerState>("action")
    .entry("stopped", ["play -> playing"])
    .state("playing", ["pause -> paused", "stop -> stopped"])
    .state("paused", ["play -> playing", "stop -> stopped"]);

  //! All the states are already defined
  // @ts-expect-error
  playerMachine.state;

  //! enter

  //! No need for the entry state as there's only one state
  const player = playerMachine.enter();
  //! It's ok to explicitly pass the entry state
  playerMachine.enter("stopped");
  //! The state is not defined as entry
  // @ts-expect-error
  playerMachine.enter("playing");
  //! The state is undefined
  // @ts-expect-error
  playerMachine.enter("nope");

  //! send

  //! The machine accepts the actions
  player.send("play");
  player.send("pause");
  //! The action is not defined
  // @ts-expect-error
  player.send();
  //! The action is not defined
  // @ts-expect-error
  player.send("nope");

  //! on

  //! The machine allows to subscribe to all states
  const off = player.on("*", (event) => {
    if (event.type === "state") {
      switch (event.state) {
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
          event.state satisfies never;
      }
    } else if (event.type === "action") {
      switch (event.action.name) {
        //! There's no such action
        // @ts-expect-error
        case "nope":
          break;

        //! We expect all actions
        case "play":
        case "pause":
        case "stop":
          break;

        //! We don't expect other actions
        default:
          event.action satisfies never;
      }
    } else {
      //! No other type is expected
      event satisfies never;
    }
  });

  //! on returns off that unsubscribes the listener
  off();

  //! The machine allows to subscribe to specific states
  player.on("stopped", (event) => {
    //! It can only be stopped state
    if (event.type === "state") {
      if (event.state === "stopped") {
        return;
      }

      //! Can't be anything but stopped
      event.state satisfies never;
      return;
    }

    //! Can only be only state event
    event.type satisfies never;
  });

  //! The machine allows to subscribe to few states
  player.on(["stopped", "playing"], (event) => {
    //! It can only be stopped or playing state
    if (event.type === "state") {
      switch (event.state) {
        //! Can't be invalid state
        // @ts-expect-error
        case "nope":
          break;

        case "stopped":
        case "playing":
          return;

        default:
          //! Can't be anything but stopped or playing
          event satisfies never;
      }
      return;
    }

    //! Can only be only state event
    event.type satisfies never;
  });

  //! Can't subscribe to invalid states
  // @ts-expect-error
  player.on("nope", () => {});
  // @ts-expect-error
  player.on(["stopped", "nope"], () => {});
}

//! Multiple entries
{
  type PendulumState = "left" | "right";

  const pendulumMachine = q2<PendulumState>("pendulum")
    .entry("left", ["swing -> right"])
    .entry("right", ["swing -> left"]);

  //! Entry should be defined as there're multiple entry states
  pendulumMachine.enter("left");
  pendulumMachine.enter("right");
  //! The state is missing
  // @ts-expect-error:
  pendulumMachine.enter();
}

//! Exit actions
{
  type CassetteState = "stopped" | "playing";

  // TODO: Temp, should be inferred?
  type CassetteAction =
    | {
        name: "play";
        from: "stopped";
        to: "playing";
      }
    | {
        name: "stop";
        from: "playing";
        to: "stopped";
      }
    // Exit actions
    | {
        name: "eject";
        from: "stopped";
      }
    | {
        name: "eject";
        from: "playing";
      };

  const casseteMachine = q2<CassetteState>("cassette")
    .entry("stopped", ["play -> playing", "eject ->"])
    .state("playing", ["stop -> stopped", "eject ->"]);

  const cassete = casseteMachine.enter();

  //! Should be able to send exit actions
  cassete.send("eject");
}

//! Conditions
{
  type PCState = "on" | "sleep" | "off";

  // TODO: Temp, should be inferred?
  type PCAction =
    | {
        name: "press";
        from: "off";
        to: "on";
      }
    | {
        name: "press";
        from: "sleep";
        to: "off";
        condition: "long";
      }
    | {
        name: "restart";
        from: "sleep";
        to: "on";
      }
    | {
        name: "press";
        from: "on";
        to: "off";
        condition: "long";
      }
    | {
        name: "press";
        from: "on";
        to: "sleep";
      }
    | {
        name: "restart";
        from: "on";
        to: "on";
      };

  const pcMachine = q<PCState, PCAction, "off">("pendulum", ($) => ({
    off: $.entry($.on("press", "on")),
    sleep: $($.on("press", "on").if("long", "off"), $.on("restart", "on")),
    on: $($.on("press").if("long", "off").else("sleep"), $.on("restart", "on")),
  }));

  const pc = pcMachine.enter();

  //! Allows to send an action without the condition
  pc.send("press");
  //! Allows to send an action with the condition
  pc.send("press", "long");
  //! The condition is undefined
  // @ts-expect-error
  pc.send("press", "nope");
}

//! Composite states
{
  type TeaState = "water" | "steeping" | "ready";

  // TODO: Temp, should be inferred?
  type TeaAction =
    | {
        name: "infuse";
        from: "water";
        to: "steeping";
      }
    | {
        name: "done";
        from: "steepeing";
        to: "ready";
      }
    // Exit actions
    | {
        name: "drink";
        from: "water";
      }
    | {
        name: "drink";
        from: "ready";
      }
    | {
        name: "drink";
        from: "steeping";
      };

  const teaMachine = q<TeaState, TeaAction, "water">("tea", ($) => ({
    water: $.entry($.on("infuse", "steeping"), $.exit("drink")),
    steeping: $($.on("done", "ready"), $.exit("drink")),
    ready: $.entry($.exit("drink")),
  }));

  type MugState = "clear" | "full" | "dirty";

  // TODO: Temp, should be inferred?
  type MugAction =
    | {
        name: "clean";
        from: "dirty";
        to: "clear";
      }
    | {
        name: "pour";
        from: "clear";
        to: "full";
      };

  const mugMachine = q<MugState, MugAction, "clear" | "dirty">("mug", ($) => ({
    clear: $.entry($.on("pour", "full")),
    full:
      //! When nesting you specify the entry state
      // TODO: Unless it's single entry
      $.nest(teaMachine, "water", [
        //! Nesting a machine makes to connect all the exits to states
        "water -> drink -> clear",
        "steeping -> drink -> dirty",
        "ready -> drink -> dirty",
      ]),
    dirty: $.entry($.on("clean", "clear")),
  }));
}

//! Parallel states
{
  type ExpireState = "fresh" | "expired";

  type ExpireAction = {
    name: "expire";
    from: "fresh";
    to: "expired";
  };

  // TODO: Temp, should be inferred?
  const expireMachine = q<ExpireState, ExpireAction, "fresh">(
    "expire",
    ($) => ({
      fresh: $($.on("expire", "expired")),
      expired: $(),
    })
  );

  type HeatState = "frozen" | "thawed" | "hot";

  // TODO: Temp, should be inferred?
  type HeatAction =
    | {
        name: "thaw";
        from: "frozen";
        to: "thawed";
      }
    | {
        name: "heat";
        from: "thawed";
        to: "hot";
      };

  const heatMachine = q<HeatState, HeatAction, "frozen">("heat", ($) => ({
    frozen: $.entry($.on("thaw", "thawed")),
    thawed: $($.on("heat", "hot")),
    hot: $(),
  }));

  type MeatPieState = "unpacked" | "cooked";

  // TODO: Temp, should be inferred?
  type MeatPieAction = {
    name: "cook";
    from: "unpacked";
    to: "cooked";
  };

  const meatPieMachine = q<MeatPieState, MeatPieAction, "unpacked">(
    "meatPie",
    ($) => ({
      unpacked: $.nest(expireMachine).nest(heatMachine),
      cooked: $(),
    })
  );
}
