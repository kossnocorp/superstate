import { describe, expect, it, vi } from "vitest";
import { superstate } from "./index.js";

describe("Superstate", () => {
  type PlayerState = "stopped" | "playing" | "paused";

  function createPlayerState() {
    return superstate<PlayerState>("player")
      .state("stopped", "play() -> playing")
      .state("playing", ["pause() -> paused", "stop() -> stopped"])
      .state("paused", ["play() -> playing", "stop() -> stopped"]);
  }

  type LightState = "on" | "off";

  describe("superstate", () => {
    it("creates a statechart", () => {
      const playerState = createPlayerState();
      const player = playerState.host();
      expect(player).toBeDefined();
    });

    it("uses the first state as the initial", () => {
      const playerState = createPlayerState();
      const player = playerState.host();
      expect(player.state.name).toBe("stopped");
    });

    it("allows to send events", () => {
      const playerState = createPlayerState();
      const player = playerState.host();
      player.send("play()");
      expect(player.state.name).toBe("playing");
    });

    it("allows to subscribe to state updates", () => {
      const listener = vi.fn();
      const playerState = createPlayerState();
      const player = playerState.host();
      player.on("*", listener);
      player.send("play()");
      expect(listener).toHaveBeenCalledWith({
        type: "state",
        state: expect.objectContaining({ name: "playing" }),
      });
    });
  });

  describe("state", () => {
    it("accepts transition as single string", () => {
      const lightState = superstate<LightState>("light")
        .state("off", "toggle() -> on")
        .state("on");
      const light = lightState.host();
      light.send("toggle()");
      expect(light.state.name).toBe("on");
    });

    it("accepts transitions as single[]", () => {
      const playerState = superstate<PlayerState>("player")
        .state("stopped", "play() -> playing")
        .state("playing", ["pause() -> paused", "stop() -> stopped"])
        .state("paused", ["play() -> playing", "stop() -> stopped"]);
      const player = playerState.host();
      player.send("play()");
      player.send("pause()");
      expect(player.state.name).toBe("paused");
    });

    it("accepts state without transitions", () => {
      const lightState = superstate<LightState>("light")
        .state("off")
        .state("on", []);
      const light = lightState.host();
      expect(light.state.name).toBe("off");
    });

    describe("builder", () => {
      describe("on", () => {
        it("accepts a single transition", () => {
          const lightState = superstate<LightState>("light")
            .state("off", ($) => $.on("toggle() -> on"))
            .state("on");
          const light = lightState.host();
          light.send("toggle()");
          expect(light.state.name).toBe("on");
        });

        it("accepts string[] as transtions", () => {
          const playerState = superstate<PlayerState>("player")
            .state("stopped", "play() -> playing")
            .state("playing", ($) =>
              $.on(["pause() -> paused", "stop() -> stopped"])
            )
            .state("paused", ["play() -> playing", "stop() -> stopped"]);
          const player = playerState.host();
          player.send("play()");
          player.send("pause()");
          player.send("stop()");
          expect(player.state.name).toBe("stopped");
        });

        it("allows to chain transitions", () => {
          const playerState = superstate<PlayerState>("player")
            .state("stopped", "play() -> playing")
            .state("playing", ($) =>
              $.on("pause() -> paused").on("stop() -> stopped")
            )
            .state("paused", ["play() -> playing", "stop() -> stopped"]);
          const player = playerState.host();
          player.send("play()");
          player.send("pause()");
          player.send("stop()");
          expect(player.state.name).toBe("stopped");
        });

        it("combines builder with string defintions", () => {
          const playerState = superstate<PlayerState>("player")
            .state("stopped", "play() -> playing")
            .state("playing", "pause() -> paused", ($) =>
              $.on("stop() -> stopped")
            )
            .state("paused", ["play() -> playing", "stop() -> stopped"]);
          const player = playerState.host();
          player.send("play()");
          player.send("pause()");
          player.send("stop()");
          expect(player.state.name).toBe("stopped");
        });
      });
    });
  });

  describe("host", () => {
    it("returns statatechart instance", () => {
      const playerState = createPlayerState();
      const player = playerState.host();
      expect(player).toBeDefined();
    });
  });

  describe("send", () => {
    it("sends an event", () => {
      const playerState = createPlayerState();
      const player = playerState.host();
      player.send("play()");
      expect(player.state.name).toBe("playing");
    });

    it("allows to send non-matching events", () => {
      const playerState = createPlayerState();
      const player = playerState.host();
      player.send("pause()");
      expect(player.state.name).toBe("stopped");
    });

    it("returns the next state", () => {
      const playerState = createPlayerState();
      const player = playerState.host();
      const nextState = player.send("play()");
      expect(nextState?.name).toBe("playing");
    });

    it("returns null for non-matching events", () => {
      const playerState = createPlayerState();
      const player = playerState.host();
      const nextState = player.send("pause()");
      expect(nextState).toBe(null);
    });
  });

  describe("on", () => {
    describe("state updates", () => {
      it("allows to subscribe to state updates", () => {
        const listener = vi.fn();
        const playerState = createPlayerState();
        const player = playerState.host();
        player.on("*", listener);
        player.send("play()");
        expect(listener).toHaveBeenCalledWith({
          type: "state",
          state: expect.objectContaining({ name: "playing" }),
        });
      });

      it("allows to subscribe to specific state updates", () => {
        const listener = vi.fn();
        const playerState = createPlayerState();
        const player = playerState.host();
        player.on("paused", listener);
        player.send("play()");
        player.send("pause()");
        expect(listener).not.toHaveBeenCalledWith({
          type: "state",
          state: expect.objectContaining({ name: "playing" }),
        });
        expect(listener).not.toHaveBeenCalledWith({
          type: "event",
          transition: expect.objectContaining({ event: "play" }),
        });
        expect(listener).toHaveBeenCalledWith({
          type: "state",
          state: expect.objectContaining({ name: "paused" }),
        });
      });

      it("allows to subscribe to few state updates", () => {
        const listener = vi.fn();
        const playerState = createPlayerState();
        const player = playerState.host();
        player.on(["paused", "stopped"], listener);
        player.send("play()");
        player.send("pause()");
        player.send("stop()");
        expect(listener).not.toHaveBeenCalledWith({
          type: "state",
          state: expect.objectContaining({ name: "playing" }),
        });
        expect(listener).not.toHaveBeenCalledWith({
          type: "event",
          transition: expect.objectContaining({ event: "play" }),
        });
        expect(listener).toHaveBeenCalledWith({
          type: "state",
          state: expect.objectContaining({ name: "paused" }),
        });
        expect(listener).toHaveBeenCalledWith({
          type: "state",
          state: expect.objectContaining({ name: "stopped" }),
        });
      });

      it("subscribes to the right state updates on common event", () => {
        const listener = vi.fn();
        const lightState = superstate<LightState>("light")
          .state("off", "toggle() -> on")
          .state("on", "toggle() -> off");
        const light = lightState.host();
        light.on(["on", "off"], listener);
        light.send("toggle()");
        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith({
          type: "state",
          state: expect.objectContaining({ name: "on" }),
        });
        light.send("toggle()");
        expect(listener).toHaveBeenCalledTimes(2);
        expect(listener).toHaveBeenCalledWith({
          type: "state",
          state: expect.objectContaining({ name: "off" }),
        });
      });
    });

    describe("event updates", () => {
      it("allows to subscribe to event updates", () => {
        const listener = vi.fn();
        const playerState = createPlayerState();
        const player = playerState.host();
        player.on("*", listener);
        player.send("play()");
        expect(listener).toHaveBeenCalledWith({
          type: "event",
          transition: expect.objectContaining({ event: "play" }),
        });
      });

      it("sends event update before state update", () => {
        const listener = vi.fn();
        const playerState = createPlayerState();
        const player = playerState.host();
        player.on("*", listener);
        player.send("play()");
        expect(listener).toHaveBeenLastCalledWith({
          type: "state",
          state: expect.objectContaining({ name: "playing" }),
        });
      });

      it("allows to subscribe to specific event updates", () => {
        const listener = vi.fn();
        const playerState = createPlayerState();
        const player = playerState.host();
        player.on("pause()", listener);
        player.send("play()");
        player.send("pause()");
        expect(listener).not.toHaveBeenCalledWith({
          type: "event",
          transition: expect.objectContaining({ event: "play" }),
        });
        expect(listener).not.toHaveBeenCalledWith({
          type: "state",
          state: expect.objectContaining({ event: "paused" }),
        });
        expect(listener).toHaveBeenCalledWith({
          type: "event",
          transition: expect.objectContaining({ event: "pause" }),
        });
      });

      it("allows to subscribe to few event updates", () => {
        const listener = vi.fn();
        const playerState = createPlayerState();
        const player = playerState.host();
        player.on(["pause()", "stop()"], listener);
        player.send("play()");
        player.send("pause()");
        player.send("stop()");
        expect(listener).not.toHaveBeenCalledWith({
          type: "event",
          transition: expect.objectContaining({ event: "play" }),
        });
        expect(listener).not.toHaveBeenCalledWith({
          type: "state",
          state: expect.objectContaining({ event: "paused" }),
        });
        expect(listener).toHaveBeenCalledWith({
          type: "event",
          transition: expect.objectContaining({ event: "pause" }),
        });
        expect(listener).toHaveBeenCalledWith({
          type: "event",
          transition: expect.objectContaining({ event: "stop" }),
        });
      });

      it("allows to subscribe to mixed updates", () => {
        const listener = vi.fn();
        const playerState = createPlayerState();
        const player = playerState.host();
        player.on(["pause()", "stopped"], listener);
        player.send("play()");
        player.send("pause()");
        player.send("stop()");
        expect(listener).not.toHaveBeenCalledWith({
          type: "event",
          transition: expect.objectContaining({ event: "play" }),
        });
        expect(listener).not.toHaveBeenCalledWith({
          type: "state",
          state: expect.objectContaining({ event: "paused" }),
        });
        expect(listener).toHaveBeenCalledWith({
          type: "event",
          transition: expect.objectContaining({ event: "pause" }),
        });
        expect(listener).toHaveBeenCalledWith({
          type: "state",
          state: expect.objectContaining({ name: "stopped" }),
        });
      });

      it("subscribes to the right event updates on common event", () => {
        const listener = vi.fn();
        const lightState = superstate<LightState>("light")
          .state("off", "toggle() -> on")
          .state("on", "toggle() -> off");
        const light = lightState.host();
        light.on("toggle()", listener);
        light.send("toggle()");
        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith({
          type: "event",
          transition: expect.objectContaining({
            event: "toggle",
            from: "off",
            to: "on",
          }),
        });
        light.send("toggle()");
        expect(listener).toHaveBeenCalledTimes(2);
        expect(listener).toHaveBeenCalledWith({
          type: "event",
          transition: expect.objectContaining({
            event: "toggle",
            from: "on",
            to: "off",
          }),
        });
      });
    });

    describe("off", () => {
      it("allows to unsubscribe", () => {
        const listener = vi.fn();
        const playerState = createPlayerState();
        const player = playerState.host();
        const off = player.on("*", listener);
        off();
        player.send("play()");
        expect(listener).not.toHaveBeenCalled();
      });
    });
  });

  describe("in", () => {
    it("returns the state if the passed state name is current", () => {
      const lightState = superstate<LightState>("light")
        .state("off", "toggle() -> on")
        .state("on");
      const light = lightState.host();
      expect(light.in("on")).toBe(null);
      light.send("toggle()");
      expect(light.in("on")).toEqual(expect.objectContaining({ name: "on" }));
    });

    it("allows to check for multiple states", () => {
      const lightState = superstate<LightState>("light")
        .state("off", "toggle() -> on")
        .state("on");
      const light = lightState.host();
      expect(light.in(["on", "off"])).toEqual(
        expect.objectContaining({ name: "off" })
      );
      light.send("toggle()");
      expect(light.in(["on", "off"])).toEqual(
        expect.objectContaining({ name: "on" })
      );
    });
  });
});
