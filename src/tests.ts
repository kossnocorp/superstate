import { describe, expect, it } from "vitest";
import { Q } from "./index.js";

describe("Q", () => {
  describe("Machine", () => {
    type SoundState = "playing" | "paused" | "stopped";

    type SoundAction = "play" | "pause" | "stop";

    class Sound extends Q.Machine<SoundState, SoundAction> {
      constructor() {
        super("stopped", [
          "playing --> paused: pause",
          "playing --> stopped: stop",
          "paused --> playing: play",
          "paused --> stopped: stop",
          "stopped --> playing: play",
        ]);
      }
    }

    describe("constructor", () => {
      it("accepts the initial state", () => {
        const sound = new Sound();

        assertType<Q.NormalizedState<SoundState>>(sound.state);
        expect(sound.state).toEqual({ type: "state", kind: "stopped" });
      });

      it("throws an error on invalid transition definition", () => {
        class BadSound extends Q.Machine<SoundState, SoundAction> {
          constructor(badTransitions: any[]) {
            super("stopped", badTransitions);
          }
        }
        expect(() => new BadSound(["playing + paused = pause"])).toThrow(
          "Invalid transition definition: playing + paused = pause"
        );
      });
    });

    describe("send", () => {
      it("allows to send actions", () => {
        const sound = new Sound();

        sound.send("play");
        expect(sound.state).toEqual({ type: "state", kind: "playing" });

        sound.send("pause");
        expect(sound.state).toEqual({ type: "state", kind: "paused" });
      });

      it("returns the state on successed transition", () => {
        const sound = new Sound();

        expect(sound.send("play")).toEqual({ type: "state", kind: "playing" });
      });

      it("returns null if the transition is not found", () => {
        const sound = new Sound();

        expect(sound.send("pause")).toEqual(null);
      });
    });
  });
});

export function assertType<Type>(_value: Type) {}
