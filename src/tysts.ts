import { QQ, q } from "./index.js";

//! Simple machine
{
  type PlayerState = "stopped" | "playing" | "paused";

  // TODO: Temp, should be inferred?
  type PlayerAction =
    | {
        name: "play";
      }
    | {
        name: "pause";
      }
    | {
        name: "stop";
      };

  const playerMachine = q<PlayerState, PlayerAction, "stopped", {}>(
    "action",
    ($) => ({
      stopped: $.entry($.on("play", "playing")),

      playing: $($.on("pause", "paused"), $.on("stop", "stopped")),

      paused: $($.on("play", "playing"), $.on("stop", "stopped")),
    })
  );

  //! No need for the entry state as there's only one state
  const player = playerMachine.enter();
  //! It's ok to explicitly pass the entry state
  playerMachine.enter("stopped");
  //! The state is not defined as entry
  // @ts-expect-error
  playerMachine.enter("playing");

  //! The machine accepts the actions
  player.send("play");
  player.send("pause");
  //! The action is not defined
  // @ts-expect-error
  player.send();
  //! The action is not defined
  // @ts-expect-error
  player.send("nope");
}

//! Multiple entries
{
  type PendulumState = "left" | "right";

  // TODO: Temp, should be inferred?
  type PendulumAction = {
    name: "swing";
  };

  const pendulumMachine = q<
    PendulumState,
    PendulumAction,
    "left" | "right",
    {}
  >("pendulum", ($) => ({
    left: $.entry($.on("swing", "right")),
    right: $.entry($.on("swing", "left")),
  }));

  //! Entry should be defined as there're multiple entry states
  pendulumMachine.enter("left");
  pendulumMachine.enter("right");
  //! The state is missing
  // @ts-expect-error:
  pendulumMachine.enter();
}

//! Exit state
{
  type CassetteState = "stopped" | "playing";

  // TODO: Temp, should be inferred?
  type CassetteAction =
    | {
        name: "play";
      }
    | {
        name: "stop";
      }
    | {
        name: "eject";
      };

  // TODO: Temp, should be inferred?
  type CassetteExitState =
    | {
        state: "stopped";
        action: "eject";
      }
    | {
        state: "playing";
        action: "eject";
      };

  const casseteMachine = q<
    CassetteState,
    CassetteAction,
    "stopped",
    CassetteExitState
  >("cassette", ($) => ({
    stopped: $.entry($.on("play", "playing"), $.exit("eject")),
    playing: $($.on("stop", "stopped"), $.exit("eject")),
  }));
}

//! Conditions
{
  type PCState = "on" | "sleep" | "off";

  // TODO: Temp, should be inferred?
  type PCAction =
    | {
        name: "press";
        condition: "long" | null;
      }
    | {
        name: "restart";
      };

  const pcMachine = q<PCState, PCAction, "off", {}>("pendulum", ($) => ({
    off: $.entry($.on("press", "on")),
    sleep: $($.on("press", "on").if("long", "off"), $.on("restart", "on")),
    on: $($.on("press").if("long", "off").else("sleep"), $.on("restart", "on")),
  }));

  const pc = pcMachine.enter();

  //! Allows to send an action without the condition
  pc.send("press");
  //! Allows to send an action with the condition
  pc.send("press", "long");
  //! Allows to send null condition
  pc.send("press", null);
  //! The condition is undefined
  // @ts-expect-error
  pc.send("press", "nope");
  //! The condition is not expected
  pc.send("restart");
  // @ts-expect-error
  pc.send("restart", null);
}

//! It allows composing state machines
{
  type TeaState = "water" | "steeping" | "ready";

  // TODO: Temp, should be inferred?
  type TeaAction =
    | {
        name: "infuse";
      }
    | {
        name: "done";
      }
    | {
        name: "drink";
      };

  const teaMachine = q<TeaState, TeaAction, "water", {}>("tea", ($) => ({
    water: $.entry($.on("infuse", "steeping")),
    steeping: $($.on("done", "ready")),
    ready: $.entry($.exit("drink")),
  }));

  type MugState = "clear" | "full" | "dirty";

  // TODO: Temp, should be inferred?
  type MugAction =
    | {
        name: "clean";
      }
    | {
        name: "pour";
      }
    | {
        name: "empty";
      };

  const mugMachine = q<MugState, MugAction, "clear" | "dirty", {}>(
    "mug",
    ($) => ({
      clear: $.entry($.on("pour", "full")),
      full: $($.on("empty", "dirty")),
      dirty: $.entry($.on("clean", "clear")),
    })
  );
}
