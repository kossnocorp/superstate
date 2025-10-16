import { describe, expect, it } from "vitest";
import { superstate } from "..";
import { toMermaid } from "./index.js";

describe("Mermaid", () => {
  describe("toMermaid", () => {
    it("generates a simple mermaid diagram from a statechart", () => {
      type SoundState = "playing" | "paused" | "stopped";

      const soundState = superstate<SoundState>("sound")
        .state("stopped", "play() -> playing")
        .state("playing", ["pause() -> paused", "stop() -> stopped"])
        .state("paused", ["play() -> playing", "stop() -> stopped"]);

      const mermaid = toMermaid(soundState);
      expect(mermaid).toMatchSnapshot();
    });

    it("includes the transition actions and conditions on the diagram", () => {
      type PCState = "on" | "sleep" | "off";

      const pcState = superstate<PCState>("pc")
        .state("off", "press() -> on! -> on")
        .state("sleep", ($) =>
          $.if("press", ["(long) -> off! -> off", "() -> on! -> on"]).on(
            "restart() -> restart! -> on",
          ),
        )
        .state("on", ($) =>
          $.on("press(long) -> off! -> off")
            .on("press() -> sleep! -> sleep")
            .on("restart() -> restart! -> on"),
        );

      const mermaid = toMermaid(pcState);
      expect(mermaid).toMatchSnapshot();
    });

    it("includes the state actions on the diagram", () => {
      type SwitchState = "off" | "on";

      const switchState = superstate<SwitchState>("switch")
        .state("off", ["-> turnOff!", "toggle() -> on", "turnOn! ->"])
        .state("on", "toggle() -> off");

      const mermaid = toMermaid(switchState);
      expect(mermaid).toMatchSnapshot();
    });

    it("renders substates", () => {
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
        .state("off", "pushPower() -> turnOn! -> on")
        .state("on", ($) =>
          $.enter("boot!")
            .on("pushPower() -> turnOff! -> off")
            .sub("os", osState, "os.terminated -> shutdown() -> off"),
        );

      const mermaid = toMermaid(pcState);
      expect(mermaid).toMatchSnapshot();
    });

    it("renders parallel states", () => {
      type ExpireState = "fresh" | "expired";

      const expireMachine = superstate<ExpireState>("expire")
        .state("fresh", "expire() -> expired")
        .final("expired");

      type HeatState = "frozen" | "thawed";

      const heatMachine = superstate<HeatState>("heat")
        .state("frozen", "thaw() -> thawed")
        .final("thawed");

      type MeatPieState =
        | "packed"
        | "unpacked"
        | "cooked"
        | "finished"
        | "wasted";

      type EatState = "siting" | "finished";

      const eatMachine = superstate<EatState>("eat")
        .state("siting", "eat() -> finished")
        .final("finished");

      const meatPieMachine = superstate<MeatPieState>("meatPie")
        .state("packed", "unpack() -> unpacked")
        .state("unpacked", ($) =>
          $.sub(
            "expire",
            expireMachine,
            "expire.expired -> throwAway() -> wasted",
          ).sub("heat", heatMachine, "heat.thawed -> cook() -> cooked"),
        )
        .state("cooked", ($) =>
          $.sub("eat", eatMachine, "eat.finished -> finish() -> finished"),
        )
        .final("finished")
        .final("wasted");

      const mermaid = toMermaid(meatPieMachine);
      expect(mermaid).toMatchSnapshot();
    });
  });
});
