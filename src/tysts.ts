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

  const playerMachine = q<PlayerState, PlayerAction, "stopped">(
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

  const pendulumMachine = q<PendulumState, PendulumAction, "left" | "right">(
    "pendulum",
    ($) => ({
      left: $.entry($.on("swing", "right")),
      right: $.entry($.on("swing", "left")),
    })
  );

  //! Entry should be defined as there're multiple entry states
  pendulumMachine.enter("left");
  pendulumMachine.enter("right");
  //! The state is missing
  // @ts-expect-error:
  pendulumMachine.enter();
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

// It allows composing state machines
{
  type ServerState =
    | "initializing"
    | "ghost"
    | "readingConfig"
    | "running"
    | "stopped";

  // Temp, should be inferred?
  type ServerAction =
    | {
        name: "initialized";
        condition: "defined" | null;
      }
    | {
        name: "serverUpdated";
      }
    | {
        name: "configRead";
      }
    | {
        name: "start";
      };

  const server = q<ServerState, ServerAction>("server", ($) => ({
    initializing: $.entry(
      $.on("initialized").if("defined", "readingConfig").else("ghost")
    ),
    ghost: $($.on("serverUpdated", "initializing")),
    readingConfig: $(
      $.on("configRead").if("enabled", "running").else("stopped")
    ),
    running: $.parallel(
      process.child("starting", {
        crashed: $.break("stopped"),
        stop: $.break("stopped"),
        crashed: $.break.else("crashed"),
      }),
      processLogs.child("readingConfig")
    ),
    stopped: $($.on("start", "running")),
  }));

  server.send("initialized", null);

  server.send("initialized", null);

  server.send("");

  type ProcessState = "starting" | "running";

  const process = q<ProcessState>("process", ($) => ({
    starting: $.entry($.on("started", "running"), $.exit("crashed")),
  }));

  type ProcessLogsState = "readingConfig" | "muted" | "printing";

  const processLogs: any = null;
}
