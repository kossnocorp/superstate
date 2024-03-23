import { QQ, q } from "./index.js";

// It allows composing state machines
{
  type ServerState =
    | "initializing"
    | "ghost"
    | "readingConfig"
    | "running"
    | "stopped";

  const server = q<ServerState>("server", ($) => ({
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

  type ProcessState = "starting" | "running";

  const process = q<ProcessState>("process", ($) => ({
    starting: $.entry($.on("started", "running"), $.exit("crashed")),
  }));

  type ProcessLogsState = "readingConfig" | "muted" | "printing";

  const processLogs: any = null;
}
