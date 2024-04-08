import { describe, expect, it, vi } from "vitest";
import { superstate } from "./index.js";

describe("Superstate", () => {
  // MARK: superstate
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
      expect(listener).toBeCalledWith({
        type: "state",
        state: expect.objectContaining({ name: "playing" }),
      });
    });

    it("assigns the statechart name", () => {
      const playerState = createPlayerState();
      expect(playerState.name).toBe("player");
    });
  });

  describe("builder", () => {
    // MARK: state
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

      describe("conditions", () => {
        it("allows to define conditions", () => {
          const pcState = superstate<PCState>("pc")
            .state("off", "press() -> on")
            .state("sleep", [
              "press(long) -> off",
              "press() -> on",
              "restart() -> on",
            ])
            .state("on", [
              "press(long) -> off",
              "press() -> sleep",
              "restart() -> on",
            ]);
          const pc = pcState.host();
          pc.send("press()");
          pc.send("press()");
          expect(pc.state.name).toBe("sleep");
          pc.send("press()", "long");
          expect(pc.state.name).toBe("off");
          pc.send("press()");
          expect(pc.state.name).toBe("on");
          pc.send("press()", "long");
          expect(pc.state.name).toBe("off");
        });

        describe("actions", () => {
          it("defines transtions actions", () => {
            const onListener = vi.fn();
            const offListener = vi.fn();
            const sleepListener = vi.fn();

            const pcState = superstate<PCState>("pc")
              .state("off", "press() -> on! -> on")
              .state("sleep", [
                "press(long) -> off! -> off",
                "press() -> on! -> on",
              ])
              .state("on", [
                "press(long) -> off! -> off",
                "press() -> sleep! -> sleep",
              ]);

            const pc = pcState.host({
              off: { "press() -> on!": onListener },
              sleep: {
                "press() -> on!": onListener,
                "press(long) -> off!": offListener,
              },
              on: {
                "press() -> sleep!": sleepListener,
                "press(long) -> off!": offListener,
              },
            });

            expect(onListener).not.toBeCalled();
            pc.send("press()");
            expect(pc.in("on")).not.toBe(null);
            expect(onListener).toBeCalled();
            expect(offListener).not.toBeCalled();
            expect(sleepListener).not.toBeCalled();

            pc.send("press(long)");
            expect(pc.in("off")).not.toBe(null);
            expect(offListener).toBeCalled();
            expect(sleepListener).not.toBeCalled();

            pc.send("press()");
            pc.send("press()");
            expect(pc.in("sleep")).not.toBe(null);
            expect(sleepListener).toBeCalled();
          });
        });
      });

      describe("actions", () => {
        it("defines enter action", () => {
          const offListener = vi.fn();
          const onListener = vi.fn();
          const lightState = superstate<LightState>("light")
            .state("off", ["-> off!", "toggle() -> on"])
            .state("on", ["-> on!", "toggle() -> off"]);
          const light = lightState.host({
            off: { "-> off!": offListener },
            on: { "-> on!": onListener },
          });
          expect(offListener).toBeCalled();
          expect(onListener).not.toBeCalled();
          light.send("toggle()");
          expect(onListener).toBeCalled();
          expect(offListener).toBeCalledTimes(1);
        });

        it("defines exit action", () => {
          const offListener = vi.fn();
          const onListener = vi.fn();
          const lightState = superstate<LightState>("light")
            .state("off", ["on! ->", "toggle() -> on"])
            .state("on", ["off! ->", "toggle() -> off"]);
          const light = lightState.host({
            off: { "on! ->": onListener },
            on: { "off! ->": offListener },
          });
          expect(offListener).not.toBeCalled();
          expect(onListener).not.toBeCalled();
          light.send("toggle()");
          expect(onListener).toBeCalled();
          expect(offListener).not.toBeCalled();
          light.send("toggle()");
          expect(offListener).toBeCalled();
        });

        it("defines transiton action", () => {
          const offListener = vi.fn();
          const onListener = vi.fn();
          const lightState = superstate<LightState>("light")
            .state("off", "toggle() -> on! -> on")
            .state("on", "toggle() -> off! -> off");
          const light = lightState.host({
            off: { "toggle() -> on!": onListener },
            on: { "toggle() -> off!": offListener },
          });
          expect(offListener).not.toBeCalled();
          expect(onListener).not.toBeCalled();
          light.send("toggle()");
          expect(onListener).toBeCalled();
          expect(offListener).not.toBeCalled();
          light.send("toggle()");
          expect(offListener).toBeCalled();
        });

        it("triggers transition aciton before event update", () => {
          const eventListener = vi.fn();
          const actionListener = vi.fn(() => {
            expect(eventListener).not.toBeCalled();
          });
          const lightState = superstate<LightState>("light")
            .state("off", "toggle() -> on! -> on")
            .state("on", "toggle() -> off! -> off");
          const light = lightState.host({
            off: { "toggle() -> on!": actionListener },
            on: { "toggle() -> off!": () => {} },
          });
          light.on("toggle()", eventListener);
          light.send("toggle()");
          expect(eventListener).toBeCalled();
          expect(actionListener).toBeCalled();
        });
      });

      describe("builder", () => {
        // MARK: state->on
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

          describe("conditions", () => {
            it("allows to define conditions", () => {
              const pcState = superstate<PCState>("pc")
                .state("off", "press() -> on")
                .state("sleep", ($) =>
                  $.on("press(long) -> off")
                    .on("press() -> on")
                    .on("restart() -> on")
                )
                .state("on", ($) =>
                  $.on("press(long) -> off")
                    .on("press() -> sleep")
                    .on("restart() -> on")
                );
              const pc = pcState.host();
              pc.send("press()");
              pc.send("press()");
              expect(pc.state.name).toBe("sleep");
              pc.send("press()", "long");
              expect(pc.state.name).toBe("off");
              pc.send("press()");
              expect(pc.state.name).toBe("on");
              pc.send("press()", "long");
              expect(pc.state.name).toBe("off");
            });
          });

          describe("actions", () => {
            it("defines transiton action", () => {
              const offListener = vi.fn();
              const onListener = vi.fn();
              const lightState = superstate<LightState>("light")
                .state("off", ($) => $.on("toggle() -> on! -> on"))
                .state("on", ($) => $.on("toggle() -> off! -> off"));
              const light = lightState.host({
                off: { "toggle() -> on!": onListener },
                on: { "toggle() -> off!": offListener },
              });
              expect(offListener).not.toBeCalled();
              expect(onListener).not.toBeCalled();
              light.send("toggle()");
              expect(onListener).toBeCalled();
              expect(offListener).not.toBeCalled();
              light.send("toggle()");
              expect(offListener).toBeCalled();
            });
          });
        });

        // MARK: state->if
        describe("if", () => {
          it("allows to define conditions", () => {
            const pcState = superstate<PCState>("pc")
              .state("off", "press() -> on")
              .state("sleep", ($) =>
                $.if("press", ["(long) -> off", "() -> on"]).on(
                  "restart() -> on"
                )
              )
              .state("on", ($) =>
                $.if("press", ["(long) -> off", "() -> sleep"]).on(
                  "restart() -> on"
                )
              );
            const pc = pcState.host();
            pc.send("press()");
            pc.send("press()");
            expect(pc.state.name).toBe("sleep");
            pc.send("press()", "long");
            expect(pc.state.name).toBe("off");
            pc.send("press()");
            expect(pc.state.name).toBe("on");
            pc.send("press()", "long");
            expect(pc.state.name).toBe("off");
          });

          it("allows to mix conditions", () => {
            const pcState = superstate<PCState>("pc")
              .state("off", "press() -> on")
              .state("sleep", "press() -> on", ($) =>
                $.if("press", ["(long) -> off"]).on("restart() -> on")
              )
              .state("on", ($) =>
                $.on("press(long) -> off")
                  .if("press", "() -> sleep")
                  .on("restart() -> on")
              );
            const pc = pcState.host();
            pc.send("press()");
            pc.send("press()");
            expect(pc.state.name).toBe("sleep");
            pc.send("press()", "long");
            expect(pc.state.name).toBe("off");
            pc.send("press()");
            expect(pc.state.name).toBe("on");
            pc.send("press()", "long");
            expect(pc.state.name).toBe("off");
          });

          describe("actions", () => {
            it("defines transtions actions", () => {
              const onListener = vi.fn();
              const offListener = vi.fn();
              const sleepListener = vi.fn();

              const pcState = superstate<PCState>("pc")
                .state("off", "press() -> on! -> on")
                .state("sleep", ($) =>
                  $.if("press", ["(long) -> off! -> off", "() -> on! -> on"])
                )
                .state("on", ($) =>
                  $.if("press", [
                    "(long) -> off! -> off",
                    "() -> sleep! -> sleep",
                  ])
                );

              const pc = pcState.host({
                off: { "press() -> on!": onListener },
                sleep: {
                  "press() -> on!": onListener,
                  "press(long) -> off!": offListener,
                },
                on: {
                  "press() -> sleep!": sleepListener,
                  "press(long) -> off!": offListener,
                },
              });

              expect(onListener).not.toBeCalled();
              pc.send("press()");
              expect(pc.in("on")).not.toBe(null);
              expect(onListener).toBeCalled();
              expect(offListener).not.toBeCalled();
              expect(sleepListener).not.toBeCalled();

              pc.send("press(long)");
              expect(pc.in("off")).not.toBe(null);
              expect(offListener).toBeCalled();
              expect(sleepListener).not.toBeCalled();

              pc.send("press()");
              pc.send("press()");
              expect(pc.in("sleep")).not.toBe(null);
              expect(sleepListener).toBeCalled();
            });
          });
        });

        // MARK: state->sub
        describe("sub", () => {
          it("defines substates", () => {
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            expect(mug.state.sub).toEqual({});

            mug.send("pour()");

            const fullState = mug.in("full");
            if (fullState) {
              expect(fullState.sub.tea).toBeDefined();
              expect(fullState.sub.tea.state.name).toBe("water");
            } else {
              throw new Error("Must be full");
            }
          });

          it("defines substate final transitions", () => {
            const listener = vi.fn();
            const mug = createMugWithTeaState().host();
            mug.on(["dirty", "finish()"], listener);

            mug.send("pour()");
            mug.send("full.tea.infuse()");
            mug.send("full.tea.done()");
            mug.send("full.tea.drink()");

            expect(mug.in("dirty")).not.toBe(null);
            expect(listener).toBeCalledWith({
              type: "state",
              state: expect.objectContaining({ name: "dirty" }),
            });
            expect(listener).toBeCalledWith({
              type: "event",
              transition: expect.objectContaining({ event: "finish" }),
            });
          });

          it("allows to define several substate final transitions", () => {
            const teaState = superstate<TeaState | "oversteeped">("tea")
              .state("water", ["infuse() -> steeping", "drink() -> finished"])
              .state("steeping", ["done() -> ready", "drink() -> finished"])
              .state("ready", [
                "drink() -> finished",
                "infuse() -> oversteeped",
              ])
              .final("finished")
              .final("oversteeped");

            const mug = superstate<MugState | "undrinkable">("mug")
              .state("clear", "pour() -> full")
              .state("full", ["drink() -> clear"], ($) =>
                $.sub("tea", teaState, [
                  "finished -> finish() -> dirty",
                  "oversteeped -> oversteep() -> undrinkable",
                ])
              )
              .state("undrinkable", "drain() -> dirty")
              .state("dirty", ["clean() -> clear"]);

            const mugA = mug.host();
            mugA.send("pour()");
            mugA.send("full.tea.infuse()");
            mugA.send("full.tea.done()");
            mugA.send("full.tea.drink()");

            expect(mugA.in("dirty")).not.toBe(null);

            const mugB = mug.host();
            mugB.send("pour()");
            mugB.send("full.tea.infuse()");
            mugB.send("full.tea.done()");
            mugB.send("full.tea.infuse()");

            expect(mugB.in("undrinkable")).not.toBe(null);
          });
        });

        // MARK: state->enter
        describe("enter", () => {
          it("defines enter action", () => {
            const offListener = vi.fn();
            const onListener = vi.fn();
            const lightState = superstate<LightState>("light")
              .state("off", ($) => $.enter("off!").on("toggle() -> on"))
              .state("on", ($) => $.enter("on!").on("toggle() -> off"));
            const light = lightState.host({
              off: { "-> off!": offListener },
              on: { "-> on!": onListener },
            });
            expect(offListener).toBeCalled();
            expect(onListener).not.toBeCalled();
            light.send("toggle()");
            expect(onListener).toBeCalled();
            expect(offListener).toBeCalledTimes(1);
          });

          it("calls action before state update", () => {
            const updateListener = vi.fn();
            const actionListener = vi.fn(() => {
              expect(updateListener).not.toBeCalled();
            });
            const lightState = superstate<LightState>("light")
              .state("off", ($) => $.enter("off!").on("toggle() -> on"))
              .state("on", ($) => $.enter("on!").on("toggle() -> off"));
            const light = lightState.host({
              off: { "-> off!": () => {} },
              on: { "-> on!": actionListener },
            });
            light.on("on", updateListener);
            light.send("toggle()");
            expect(actionListener).toBeCalled();
            expect(updateListener).toBeCalled();
          });

          it("calls action after event update", () => {
            const updateListener = vi.fn();
            const actionListener = vi.fn(() => {
              expect(updateListener).toBeCalled();
            });
            const lightState = superstate<LightState>("light")
              .state("off", ($) => $.enter("off!").on("toggle() -> on"))
              .state("on", ($) => $.enter("on!").on("toggle() -> off"));
            const light = lightState.host({
              off: { "-> off!": () => {} },
              on: { "-> on!": actionListener },
            });
            light.on("toggle()", updateListener);
            light.send("toggle()");
            expect(actionListener).toBeCalled();
          });
        });

        // MARK: state->exit
        describe("exit", () => {
          it("defines exit action", () => {
            const offListener = vi.fn();
            const onListener = vi.fn();
            const lightState = superstate<LightState>("light")
              .state("off", ($) => $.exit("on!").on("toggle() -> on"))
              .state("on", ($) => $.exit("off!").on("toggle() -> off"));
            const light = lightState.host({
              off: { "on! ->": onListener },
              on: { "off! ->": offListener },
            });
            expect(offListener).not.toBeCalled();
            expect(onListener).not.toBeCalled();
            light.send("toggle()");
            expect(onListener).toBeCalled();
            expect(offListener).not.toBeCalled();
            light.send("toggle()");
            expect(offListener).toBeCalled();
          });

          it("calls exit before enter action", () => {
            const offEnterListener = vi.fn(() => {
              expect(offExitListener).not.toBeCalled();
              expect(onEnterListener).not.toBeCalled();
              expect(onExitListener).not.toBeCalled();
            });
            const offExitListener = vi.fn(() => {
              expect(offEnterListener).toBeCalled();
              expect(onEnterListener).not.toBeCalled();
              expect(onExitListener).not.toBeCalled();
            });
            const onEnterListener = vi.fn(() => {
              expect(offExitListener).toBeCalled();
              expect(onExitListener).not.toBeCalled();
            });
            const onExitListener = vi.fn(() => {
              expect(onEnterListener).toBeCalled();
            });
            const lightState = superstate<LightState>("light")
              .state("off", ($) =>
                $.enter("offEnter!").exit("offExit!").on("toggle() -> on")
              )
              .state("on", ($) =>
                $.enter("onEnter!").exit("onExit!").on("toggle() -> off")
              );
            const light = lightState.host({
              off: {
                "-> offEnter!": offEnterListener,
                "offExit! ->": offExitListener,
              },
              on: {
                "-> onEnter!": onEnterListener,
                "onExit! ->": onExitListener,
              },
            });
            light.send("toggle()");
            expect(offEnterListener).toBeCalled();
            expect(offExitListener).toBeCalled();
            expect(onEnterListener).toBeCalled();
            expect(onExitListener).not.toBeCalled();
          });

          it("calls action after event update", () => {
            const updateListener = vi.fn();
            const actionListener = vi.fn(() => {
              expect(updateListener).toBeCalled();
            });
            const lightState = superstate<LightState>("light")
              .state("off", ($) => $.exit("on!").on("toggle() -> on"))
              .state("on", ($) => $.exit("off!").on("toggle() -> off"));
            const light = lightState.host({
              off: { "on! ->": actionListener },
              on: { "off! ->": () => {} },
            });
            light.on("toggle()", updateListener);
            light.send("toggle()");
            expect(actionListener).toBeCalled();
          });
        });
      });
    });

    // MARK: final
    describe("final", () => {
      it("creates a final state that finalizes the statechart", () => {
        const casseteState = superstate<CassetteState>("cassette")
          .state("stopped", ["play() -> playing", "eject() -> ejected"])
          .state("playing", ["stop() -> stopped", "eject() -> ejected"])
          .final("ejected");

        const cassete = casseteState.host();
        expect(cassete.finalized).toBe(false);

        const state = cassete.send("eject()");

        expect(state?.name).toBe("ejected");
        expect(state?.final).toBe(true);
        expect(cassete.finalized).toBe(true);
      });
    });
  });

  describe("factory", () => {
    // MARK: host
    describe("host", () => {
      it("returns statatechart instance", () => {
        const playerState = createPlayerState();
        const player = playerState.host();
        expect(player).toBeDefined();
      });

      describe("actions", () => {
        it("allows to bind substate actions", () => {
          const smallDollCloseListener = vi.fn();
          const smallDollOpenListener = vi.fn();
          const mediumDollCloseListener = vi.fn();
          const mediumDollOpenListener = vi.fn();

          const smallDollState = superstate<DollState>("smallDoll")
            .state("closed", ["-> close!", "open! ->", "open() -> open"])
            .state("open", "close() -> closed");

          const mediumDollState = superstate<DollState>("mediumDoll")
            .state("closed", ($) => $.on("open() -> open! -> open"))
            .state("open", ["close() -> closed", "close! ->"], ($) =>
              $.sub("doll", smallDollState)
            );

          const bigDollState = superstate<DollState>("bigDoll")
            .state("closed", "open() -> open")
            .state("open", "close() -> closed", ($) =>
              $.sub("doll", mediumDollState)
            );

          const bigDoll = bigDollState.host({
            open: {
              doll: {
                open: {
                  "close! ->": mediumDollCloseListener,
                  doll: {
                    closed: {
                      "open! ->": smallDollOpenListener,
                      "-> close!": smallDollCloseListener,
                    },
                  },
                },
                closed: {
                  "open() -> open!": mediumDollOpenListener,
                },
              },
            },
          });

          expect(mediumDollCloseListener).not.toBeCalled();
          expect(mediumDollOpenListener).not.toBeCalled();
          expect(smallDollCloseListener).not.toBeCalled();
          expect(smallDollOpenListener).not.toBeCalled();

          bigDoll.send("open()");

          expect(mediumDollCloseListener).not.toBeCalled();
          expect(mediumDollOpenListener).not.toBeCalled();
          expect(smallDollCloseListener).not.toBeCalled();
          expect(smallDollOpenListener).not.toBeCalled();

          bigDoll.send("open.doll.open()");

          expect(mediumDollCloseListener).not.toBeCalled();
          expect(mediumDollOpenListener).toBeCalled();
          expect(smallDollCloseListener).toBeCalled();
          expect(smallDollOpenListener).not.toBeCalled();

          bigDoll.send("open.doll.open.doll.open()");

          expect(mediumDollCloseListener).not.toBeCalled();
          expect(mediumDollOpenListener).toBeCalled();
          expect(smallDollCloseListener).toBeCalled();
          expect(smallDollOpenListener).toBeCalled();

          bigDoll.send("open.doll.close()");

          expect(mediumDollCloseListener).toBeCalled();
          expect(mediumDollOpenListener).toBeCalled();
          expect(smallDollCloseListener).toBeCalled();
          expect(smallDollOpenListener).toBeCalled();
        });
      });
    });
  });

  describe("instance", () => {
    // MARK: send
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

      describe("conditions", () => {
        it("allows to send conditions", () => {
          const pcState = superstate<PCState>("pc")
            .state("off", "press() -> on")
            .state("sleep", ($) =>
              $.if("press", ["(long) -> off", "() -> on"]).on("restart() -> on")
            )
            .state("on", ($) =>
              $.if("press", ["(long) -> off", "() -> sleep"]).on(
                "restart() -> on"
              )
            );
          const pc = pcState.host();
          pc.send("press()");
          pc.send("press()");
          expect(pc.state.name).toBe("sleep");
          pc.send("press()", "long");
          expect(pc.state.name).toBe("off");
          pc.send("press()");
          expect(pc.state.name).toBe("on");
          pc.send("press()", "long");
          expect(pc.state.name).toBe("off");
        });

        it("picks the right condition", () => {
          const pcState = superstate<PCState | "restarting">("pc")
            .state("off", ["press() -> on"])
            .state("sleep", ($) =>
              $.if("press", [
                "(long) -> off",
                "(double) -> restarting",
                "() -> on",
              ]).on("restart() -> on")
            )
            .state("on", ($) =>
              $.if("press", [
                "(long) -> off",
                "(double) -> restarting",
                "() -> sleep",
              ]).on("restart() -> on")
            )
            .state("restarting", "restarted() -> on");
          const pc = pcState.host();
          pc.send("press()");
          pc.send("press()");
          expect(pc.state.name).toBe("sleep");
          pc.send("press()", "double");
          expect(pc.state.name).toBe("restarting");
          pc.send("restarted()");
          expect(pc.state.name).toBe("on");
          pc.send("press()", "long");
          expect(pc.state.name).toBe("off");
        });

        it("works with only-conditional events", () => {
          const catState = superstate<CatState>("cat")
            .state("boxed", ($) =>
              $.if("reveal", ["(lucky) -> alive", "(unlucky) -> dead"])
            )
            .state("alive", ($) => $.on("pet() -> alive"))
            .state("dead");

          const cat = catState.host();
          cat.send("reveal()", "lucky");
          expect(cat.state.name).toBe("alive");
        });

        it("allows to use event shortcut", () => {
          const pcState = superstate<PCState>("pc")
            .state("off", "press() -> on")
            .state("sleep", ($) =>
              $.if("press", ["(long) -> off", "() -> on"]).on("restart() -> on")
            )
            .state("on", ($) =>
              $.if("press", ["(long) -> off", "() -> sleep"]).on(
                "restart() -> on"
              )
            );
          const pc = pcState.host();
          pc.send("press()");
          pc.send("press()");
          expect(pc.state.name).toBe("sleep");
          pc.send("press(long)");
          expect(pc.state.name).toBe("off");
          pc.send("press()");
          expect(pc.state.name).toBe("on");
          pc.send("press(long)");
          expect(pc.state.name).toBe("off");
        });
      });

      describe("substates", () => {
        it("allows to send events to substates", () => {
          const mugState = createMugWithTeaState();

          const mug = mugState.host();
          mug.send("pour()");
          mug.send("full.tea.infuse()");

          expect(
            mug.state.name === "full" &&
              mug.state.sub.tea.state.name === "steeping"
          ).toBe(true);
        });

        it("does not trigger parent events with the same name", () => {
          const bigDollListener = vi.fn();

          const dollState = createRussianDollState();

          const doll = dollState.host();
          doll.send("open()");
          doll.on("close()", bigDollListener);
          doll.send("open.doll.open()");
          doll.send("open.doll.close()");

          expect(bigDollListener).not.toHaveBeenCalled();
        });

        it("allows to send events to deeply nested substates", () => {
          const smallDollListener = vi.fn();
          const wildcardListener = vi.fn();
          const dollState = createRussianDollState();

          const doll = dollState.host();
          doll.on("*", wildcardListener);
          doll.on("open.doll.open.doll.open()", smallDollListener);
          doll.send("open.doll.open.doll.open()");

          expect(smallDollListener).not.toBeCalled();
          expect(wildcardListener).not.toBeCalled();

          doll.send("open()");
          expect(doll.state.name).toBe("open");

          doll.send("open.doll.open()");
          expect(
            doll.state.name === "open" && doll.state.sub.doll.state.name
          ).toBe("open");

          doll.send("open.doll.open.doll.open()");
          expect(
            doll.state.name === "open" &&
              doll.state.sub.doll.state.name === "open" &&
              doll.state.sub.doll.state.sub.doll.state.name
          ).toBe("open");

          expect(smallDollListener).toHaveBeenCalledOnce();
        });
      });
    });

    // MARK: on
    describe("on", () => {
      describe("state updates", () => {
        it("allows to subscribe to state updates", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.on("*", listener);
          player.send("play()");
          expect(listener).toBeCalledWith({
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
          expect(listener).not.toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ name: "playing" }),
          });
          expect(listener).not.toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({ event: "play" }),
          });
          expect(listener).toBeCalledWith({
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
          expect(listener).not.toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ name: "playing" }),
          });
          expect(listener).not.toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({ event: "play" }),
          });
          expect(listener).toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ name: "paused" }),
          });
          expect(listener).toBeCalledWith({
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
          expect(listener).toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ name: "on" }),
          });
          light.send("toggle()");
          expect(listener).toHaveBeenCalledTimes(2);
          expect(listener).toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ name: "off" }),
          });
        });

        describe("substates", () => {
          it("subscribes to state updates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();

            mug.on("full.tea.steeping", listener);

            mug.send("pour()");
            mug.send("full.tea.infuse()");

            expect(listener).toBeCalledWith({
              type: "state",
              state: expect.objectContaining({ name: "steeping" }),
            });
          });

          it("subscribes after hosting the substate", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            mug.send("pour()");

            mug.on("full.tea.steeping", listener);

            mug.send("full.tea.infuse()");

            expect(listener).toBeCalledWith({
              type: "state",
              state: expect.objectContaining({ name: "steeping" }),
            });
          });

          it("unsubscribes when leaving the state", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            mug.on("full.tea.steeping", listener);

            mug.send("pour()");
            const teaSubstate = mug.in("full")?.sub.tea;
            if (!teaSubstate) throw new Error("Invalid state");

            mug.send("drink()");

            teaSubstate?.send("infuse()");
            mug.send("full.tea.infuse()");

            expect(listener).not.toBeCalled();
          });

          it("deeply unsubscribes when leaving the state", () => {
            const listener = vi.fn();
            const dollState = createRussianDollState();

            const doll = dollState.host();
            doll.on("open.doll.open.doll.open", listener);

            doll.send("open()");
            doll.send("open.doll.open()");

            const smallDollSubstate = doll.in("open")?.sub.doll?.in("open")
              ?.sub.doll;
            if (!smallDollSubstate) throw new Error("Invalid state");

            doll.send("close()");

            smallDollSubstate.send("open()");
            expect(listener).not.toBeCalled();
          });

          it("preserves subscription groups", () => {
            const aListener = vi.fn();
            const bListener = vi.fn();

            const mug = createMugWithTeaState().host();

            mug.send("pour()");

            mug.on(["**", "full.tea.*", "full.tea.infuse()"], aListener);
            mug.on("**", bListener);
            mug.on("full.tea.*", bListener);
            mug.on("full.tea.infuse()", bListener);

            mug.send("full.tea.infuse()");

            expect(bListener).toHaveBeenCalledTimes(5);
            expect(aListener).toHaveBeenCalledTimes(2);
          });

          describe("wildcard", () => {
            it("subscribes to all updates", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();

              mug.on("full.tea.*", listener);

              mug.send("pour()");
              mug.send("full.tea.infuse()");
              mug.send("full.tea.done()");

              expect(listener).toBeCalledWith({
                type: "state",
                state: expect.objectContaining({ name: "steeping" }),
              });
              expect(listener).toBeCalledWith({
                type: "state",
                state: expect.objectContaining({ name: "ready" }),
              });
            });

            it("subscribes after hosting the substate", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.send("pour()");

              mug.on("full.tea.*", listener);

              mug.send("full.tea.infuse()");
              mug.send("full.tea.done()");

              expect(listener).toBeCalledWith({
                type: "state",
                state: expect.objectContaining({ name: "steeping" }),
              });
              expect(listener).toBeCalledWith({
                type: "state",
                state: expect.objectContaining({ name: "ready" }),
              });
            });
          });

          describe("deep wildcard", () => {
            it("subscribes to all updates in the hierarchy", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();

              mug.on("**", listener);

              mug.send("pour()");
              mug.send("full.tea.infuse()");
              mug.send("full.tea.done()");

              expect(listener).toBeCalledWith({
                type: "state",
                state: expect.objectContaining({ name: "full" }),
              });
              expect(listener).toBeCalledWith({
                type: "state",
                state: expect.objectContaining({ name: "water" }),
              });
              expect(listener).toBeCalledWith({
                type: "state",
                state: expect.objectContaining({ name: "steeping" }),
              });
              expect(listener).toBeCalledWith({
                type: "state",
                state: expect.objectContaining({ name: "ready" }),
              });
            });

            it("subscribes after hosting the substate", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.send("pour()");

              mug.on("**", listener);

              mug.send("full.tea.infuse()");
              mug.send("full.tea.done()");

              expect(listener).toBeCalledWith({
                type: "state",
                state: expect.objectContaining({ name: "steeping" }),
              });
              expect(listener).toBeCalledWith({
                type: "state",
                state: expect.objectContaining({ name: "ready" }),
              });
            });
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
          expect(listener).toBeCalledWith({
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
          expect(listener).not.toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({ event: "play" }),
          });
          expect(listener).not.toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ event: "paused" }),
          });
          expect(listener).toBeCalledWith({
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
          expect(listener).not.toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({ event: "play" }),
          });
          expect(listener).not.toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ event: "paused" }),
          });
          expect(listener).toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({ event: "pause" }),
          });
          expect(listener).toBeCalledWith({
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
          expect(listener).not.toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({ event: "play" }),
          });
          expect(listener).not.toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ event: "paused" }),
          });
          expect(listener).toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({ event: "pause" }),
          });
          expect(listener).toBeCalledWith({
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
          expect(listener).toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({
              event: "toggle",
              from: "off",
              to: "on",
            }),
          });
          light.send("toggle()");
          expect(listener).toHaveBeenCalledTimes(2);
          expect(listener).toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({
              event: "toggle",
              from: "on",
              to: "off",
            }),
          });
        });

        describe("conditions", () => {
          it("allows to subscribe to conditions", () => {
            const conditionListener = vi.fn();
            const elseListener = vi.fn();
            const pcState = superstate<PCState>("pc")
              .state("off", "press() -> on")
              .state("on", ($) =>
                $.if("press", ["(long) -> off", "() -> sleep"]).on(
                  "restart() -> on"
                )
              )
              .state("sleep", ($) =>
                $.if("press", ["(long) -> off", "() -> on"]).on(
                  "restart() -> on"
                )
              );
            const pc = pcState.host();
            pc.send("press()");
            pc.on("press(long)", conditionListener);
            pc.on("press()", elseListener);
            pc.send("press(long)");
            expect(elseListener).not.toHaveBeenCalled();
            expect(conditionListener).toBeCalledWith({
              type: "event",
              transition: expect.objectContaining({
                event: "press",
                condition: "long",
              }),
            });
          });
        });

        describe("substates", () => {
          it("subscribes to event updates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();

            mug.on("full.tea.infuse()", listener);

            mug.send("pour()");
            mug.send("full.tea.infuse()");

            expect(listener).toBeCalledWith({
              type: "event",
              transition: expect.objectContaining({ event: "infuse" }),
            });
          });

          it("subscribes after hosting the substate", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            mug.send("pour()");

            mug.on("full.tea.infuse()", listener);

            mug.send("full.tea.infuse()");

            expect(listener).toBeCalledWith({
              type: "event",
              transition: expect.objectContaining({ event: "infuse" }),
            });
          });

          it("unsubscribes when leaving the state", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            mug.on("full.tea.infuse()", listener);

            mug.send("pour()");
            const teaSubstate = mug.in("full")?.sub.tea;
            if (!teaSubstate) throw new Error("Invalid state");

            mug.send("drink()");

            teaSubstate?.send("infuse()");
            mug.send("full.tea.infuse()");

            expect(listener).not.toBeCalled();
          });

          it("deeply unsubscribes when leaving the state", () => {
            const listener = vi.fn();
            const dollState = createRussianDollState();

            const doll = dollState.host();
            doll.on("open.doll.open.doll.open()", listener);

            doll.send("open()");
            doll.send("open.doll.open()");

            const smallDollSubstate = doll.in("open")?.sub.doll?.in("open")
              ?.sub.doll;
            if (!smallDollSubstate) throw new Error("Invalid state");

            doll.send("close()");

            smallDollSubstate.send("open()");
            expect(listener).not.toBeCalled();
          });

          describe("wildcard", () => {
            it("subscribes to all updates", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.on("full.tea.*", listener);

              mug.send("pour()");
              mug.send("full.tea.infuse()");
              mug.send("full.tea.done()");

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "infuse" }),
              });
              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "done" }),
              });
            });

            it("subscribes after hosting the substate", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.send("pour()");

              mug.on("full.tea.*", listener);

              mug.send("full.tea.infuse()");
              mug.send("full.tea.done()");

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "infuse" }),
              });
              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "done" }),
              });
            });
          });

          describe("deep wildcard", () => {
            it("subscribes to all updates in the hierarchy", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();

              mug.on("**", listener);

              mug.send("pour()");
              mug.send("full.tea.infuse()");
              mug.send("full.tea.done()");

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "pour" }),
              });
              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "infuse" }),
              });
              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "done" }),
              });
            });

            it("subscribes after hosting the substate", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.send("pour()");

              mug.on("**", listener);

              mug.send("full.tea.infuse()");
              mug.send("full.tea.done()");

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "infuse" }),
              });
              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "done" }),
              });
            });
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

        describe("substates", () => {
          it("unsubscribes from substates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            const off = mug.on("full.tea.infuse()", listener);

            mug.send("pour()");
            mug.send("full.tea.infuse()");

            expect(listener).toHaveBeenCalledOnce();

            off();

            mug.send("full.tea.infuse()");

            expect(listener).toHaveBeenCalledOnce();
          });

          it("unsubscribes from deeply nested substates", () => {
            const listener = vi.fn();
            const dollState = createRussianDollState();

            const doll = dollState.host();
            const off = doll.on("open.doll.open.doll.open()", listener);
            doll.send("open.doll.open.doll.open()");

            expect(listener).not.toBeCalled();

            doll.send("open()");
            expect(doll.state.name).toBe("open");

            doll.send("open.doll.open()");
            expect(
              doll.state.name === "open" && doll.state.sub.doll.state.name
            ).toBe("open");

            off();

            doll.send("open.doll.open.doll.open()");
            expect(
              doll.state.name === "open" &&
                doll.state.sub.doll.state.name === "open" &&
                doll.state.sub.doll.state.sub.doll.state.name
            ).toBe("open");

            expect(listener).not.toBeCalled();
          });

          it("unsubscribes from wildcard updates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            const off = mug.on("full.tea.*", listener);

            mug.send("pour()");
            mug.send("full.tea.infuse()");

            expect(listener).toHaveBeenCalledTimes(2);

            off();

            mug.send("full.tea.done()");

            expect(listener).toHaveBeenCalledTimes(2);
          });

          it("unsubscribes from deep wildcard updates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            const off = mug.on("**", listener);

            mug.send("pour()");
            mug.send("full.tea.infuse()");

            expect(listener).toHaveBeenCalledTimes(5);

            off();

            mug.send("full.tea.done()");

            expect(listener).toHaveBeenCalledTimes(5);
          });
        });
      });
    });

    // MARK: in
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

      describe("substates", () => {
        it("allows to check for substates", () => {
          const mugState = createMugWithTeaState();
          const mug = mugState.host();
          mug.send("pour()");
          expect(mug.in("full")).toEqual(
            expect.objectContaining({ name: "full" })
          );
          expect(mug.in("full.tea.water")).toEqual(
            expect.objectContaining({ name: "water" })
          );
        });

        it("allows to check for multiple substates", () => {
          const mugState = createMugWithTeaState();
          const mug = mugState.host();
          mug.send("pour()");
          expect(mug.in(["full.tea.steeping", "full.tea.water"])).toEqual(
            expect.objectContaining({ name: "water" })
          );
        });

        it("does't break when checking for non-active substates", () => {
          const mugState = createMugWithTeaState();
          const mug = mugState.host();
          expect(mug.in("full.tea.water")).toBe(null);
        });
      });
    });

    // MARK: off
    describe("off", () => {
      it("unsubscribes from all events", () => {
        const listener = vi.fn();
        const playerState = createPlayerState();
        const player = playerState.host();
        player.on("*", listener);
        player.on("playing", listener);
        player.off();
        player.send("play()");
        player.send("pause()");
        expect(listener).not.toBeCalled();
      });

      describe("substates", () => {
        it("unsubscribes from all events", () => {
          const listener = vi.fn();
          const mugState = createMugWithTeaState();
          const mug = mugState.host();
          mug.on("full.tea.*", listener);
          mug.on("dirty", listener);
          mug.on("**", listener);
          mug.off();
          mug.send("pour()");
          mug.send("full.tea.infuse()");
          mug.send("full.tea.done()");
          mug.send("drink()");
          expect(listener).not.toBeCalled();
        });

        it("unsubscribes from all deep events", () => {
          const listener = vi.fn();
          const dollState = createRussianDollState();
          const doll = dollState.host();
          doll.on("open.doll.open.doll.open()", listener);
          doll.on("closed", listener);
          doll.on("**", listener);
          doll.off();
          doll.send("open()");
          doll.send("open.doll.open()");
          doll.send("open.doll.open.doll.open()");
          expect(listener).not.toBeCalled();
        });
      });
    });
  });
});

type PlayerState = "stopped" | "playing" | "paused";

function createPlayerState() {
  return superstate<PlayerState>("player")
    .state("stopped", "play() -> playing")
    .state("playing", ["pause() -> paused", "stop() -> stopped"])
    .state("paused", ["play() -> playing", "stop() -> stopped"]);
}

type LightState = "on" | "off";

type CassetteState = "stopped" | "playing" | "ejected";

type PCState = "on" | "sleep" | "off";

type CatState = "boxed" | "alive" | "dead";

type TeaState = "water" | "steeping" | "ready" | "finished";

type MugState = "clear" | "full" | "dirty";

function createMugWithTeaState() {
  const teaState = superstate<TeaState>("tea")
    .state("water", ["infuse() -> steeping", "drink() -> finished"])
    .state("steeping", ["done() -> ready", "drink() -> finished"])
    .state("ready", ["drink() -> finished"])
    .final("finished");

  return superstate<MugState>("mug")
    .state("clear", "pour() -> full")
    .state("full", ["drink() -> clear"], ($) =>
      $.sub("tea", teaState, "finished -> finish() -> dirty")
    )
    .state("dirty", ["clean() -> clear"]);
}

type DollState = "open" | "closed";

function createRussianDollState() {
  const smallDollState = superstate<DollState>("smallDoll")
    .state("closed", "open() -> open")
    .state("open", "close() -> closed");

  const mediumDollState = superstate<DollState>("mediumDoll")
    .state("closed", "open() -> open")
    .state("open", "close() -> closed", ($) => $.sub("doll", smallDollState));

  const bigDollState = superstate<DollState>("bigDoll")
    .state("closed", "open() -> open")
    .state("open", "close() -> closed", ($) => $.sub("doll", mediumDollState));

  return bigDollState;
}
