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
    type SwitchState = "on" | "off";

    type PlayerState = "stopped" | "playing" | "paused";

    it("accepts transition as single string", () => {
      const switchState = superstate<SwitchState>("switch")
        .state("off", "toggle() -> on")
        .state("on");
      const switch_ = switchState.host();
      switch_.send("toggle()");
      expect(switch_.state.name).toBe("on");
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
      const switchState = superstate<SwitchState>("switch")
        .state("off")
        .state("on", []);
      const switch_ = switchState.host();
      expect(switch_.state.name).toBe("off");
    });

    describe("builder", () => {
      describe("on", () => {
        it("accepts a single transition", () => {
          const switchState = superstate<SwitchState>("switch")
            .state("off", ($) => $.on("toggle() -> on"))
            .state("on");
          const switch_ = switchState.host();
          switch_.send("toggle()");
          expect(switch_.state.name).toBe("on");
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
    it("allows to subscribe to states", () => {
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

    it("allows to subscribe to events", () => {
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

    it("returns function to unsubscribe", () => {
      const listener = vi.fn();
      const playerState = createPlayerState();
      const player = playerState.host();
      const off = player.on("*", listener);
      off();
      player.send("play()");
      expect(listener).not.toHaveBeenCalled();
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
  });
});
