import { describe, expect, it, vi } from "vitest";
import { superstate } from ".";

describe("Superstate", () => {
  //#region superstate
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
      player.send.play();
      expect(player.state.name).toBe("playing");
    });

    it("allows to subscribe to state updates", () => {
      const listener = vi.fn();
      const playerState = createPlayerState();
      const player = playerState.host();
      player.on("*", listener);
      player.send.play();
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
  //#endregion

  describe("builder", () => {
    //#region state
    describe("state", () => {
      it("accepts transition as single string", () => {
        const lightState = superstate<LightState>("light")
          .state("off", "toggle() -> on")
          .state("on");
        const light = lightState.host();
        light.send.toggle();
        expect(light.state.name).toBe("on");
      });

      it("accepts transitions as single[]", () => {
        const playerState = superstate<PlayerState>("player")
          .state("stopped", "play() -> playing")
          .state("playing", ["pause() -> paused", "stop() -> stopped"])
          .state("paused", ["play() -> playing", "stop() -> stopped"]);
        const player = playerState.host();
        player.send.play();
        player.send.pause();
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
          pc.send.press();
          pc.send.press();
          expect(pc.state.name).toBe("sleep");
          pc.send.press("long");
          expect(pc.state.name).toBe("off");
          pc.send.press();
          expect(pc.state.name).toBe("on");
          pc.send.press("long");
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
            pc.send.press();
            expect(pc.in("on")).not.toBe(null);
            expect(onListener).toBeCalled();
            expect(offListener).not.toBeCalled();
            expect(sleepListener).not.toBeCalled();

            pc.send.press("long");
            expect(pc.in("off")).not.toBe(null);
            expect(offListener).toBeCalled();
            expect(sleepListener).not.toBeCalled();

            pc.send.press();
            pc.send.press();
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
          light.send.toggle();
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
          light.send.toggle();
          expect(onListener).toBeCalled();
          expect(offListener).not.toBeCalled();
          light.send.toggle();
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
          light.send.toggle();
          expect(onListener).toBeCalled();
          expect(offListener).not.toBeCalled();
          light.send.toggle();
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
          light.send.toggle();
          expect(eventListener).toBeCalled();
          expect(actionListener).toBeCalled();
        });
      });

      describe("builder", () => {
        //#region state->on
        describe("on", () => {
          it("accepts a single transition", () => {
            const lightState = superstate<LightState>("light")
              .state("off", ($) => $.on("toggle() -> on"))
              .state("on");
            const light = lightState.host();
            light.send.toggle();
            expect(light.state.name).toBe("on");
          });

          it("accepts string[] as transtions", () => {
            const playerState = superstate<PlayerState>("player")
              .state("stopped", "play() -> playing")
              .state("playing", ($) =>
                $.on(["pause() -> paused", "stop() -> stopped"]),
              )
              .state("paused", ["play() -> playing", "stop() -> stopped"]);
            const player = playerState.host();
            player.send.play();
            player.send.pause();
            player.send.stop();
            expect(player.state.name).toBe("stopped");
          });

          it("allows to chain transitions", () => {
            const playerState = superstate<PlayerState>("player")
              .state("stopped", "play() -> playing")
              .state("playing", ($) =>
                $.on("pause() -> paused").on("stop() -> stopped"),
              )
              .state("paused", ["play() -> playing", "stop() -> stopped"]);
            const player = playerState.host();
            player.send.play();
            player.send.pause();
            player.send.stop();
            expect(player.state.name).toBe("stopped");
          });

          it("combines builder with string defintions", () => {
            const playerState = superstate<PlayerState>("player")
              .state("stopped", "play() -> playing")
              .state("playing", "pause() -> paused", ($) =>
                $.on("stop() -> stopped"),
              )
              .state("paused", ["play() -> playing", "stop() -> stopped"]);
            const player = playerState.host();
            player.send.play();
            player.send.pause();
            player.send.stop();
            expect(player.state.name).toBe("stopped");
          });

          describe("conditions", () => {
            it("allows to define conditions", () => {
              const pcState = superstate<PCState>("pc")
                .state("off", "press() -> on")
                .state("sleep", ($) =>
                  $.on("press(long) -> off")
                    .on("press() -> on")
                    .on("restart() -> on"),
                )
                .state("on", ($) =>
                  $.on("press(long) -> off")
                    .on("press() -> sleep")
                    .on("restart() -> on"),
                );
              const pc = pcState.host();
              pc.send.press();
              pc.send.press();
              expect(pc.state.name).toBe("sleep");
              pc.send.press("long");
              expect(pc.state.name).toBe("off");
              pc.send.press();
              expect(pc.state.name).toBe("on");
              pc.send.press("long");
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
              light.send.toggle();
              expect(onListener).toBeCalled();
              expect(offListener).not.toBeCalled();
              light.send.toggle();
              expect(offListener).toBeCalled();
            });
          });
        });
        //#endregion

        //#region state->if
        describe("if", () => {
          it("allows to define conditions", () => {
            const pcState = superstate<PCState>("pc")
              .state("off", "press() -> on")
              .state("sleep", ($) =>
                $.if("press", ["(long) -> off", "() -> on"]).on(
                  "restart() -> on",
                ),
              )
              .state("on", ($) =>
                $.if("press", ["(long) -> off", "() -> sleep"]).on(
                  "restart() -> on",
                ),
              );
            const pc = pcState.host();
            pc.send.press();
            pc.send.press();
            expect(pc.state.name).toBe("sleep");
            pc.send.press("long");
            expect(pc.state.name).toBe("off");
            pc.send.press();
            expect(pc.state.name).toBe("on");
            pc.send.press("long");
            expect(pc.state.name).toBe("off");
          });

          it("allows to mix conditions", () => {
            const pcState = superstate<PCState>("pc")
              .state("off", "press() -> on")
              .state("sleep", "press() -> on", ($) =>
                $.if("press", ["(long) -> off"]).on("restart() -> on"),
              )
              .state("on", ($) =>
                $.on("press(long) -> off")
                  .if("press", "() -> sleep")
                  .on("restart() -> on"),
              );
            const pc = pcState.host();
            pc.send.press();
            pc.send.press();
            expect(pc.state.name).toBe("sleep");
            pc.send.press("long");
            expect(pc.state.name).toBe("off");
            pc.send.press();
            expect(pc.state.name).toBe("on");
            pc.send.press("long");
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
                  $.if("press", ["(long) -> off! -> off", "() -> on! -> on"]),
                )
                .state("on", ($) =>
                  $.if("press", [
                    "(long) -> off! -> off",
                    "() -> sleep! -> sleep",
                  ]),
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
              pc.send.press();
              expect(pc.in("on")).not.toBe(null);
              expect(onListener).toBeCalled();
              expect(offListener).not.toBeCalled();
              expect(sleepListener).not.toBeCalled();

              pc.send.press("long");
              expect(pc.in("off")).not.toBe(null);
              expect(offListener).toBeCalled();
              expect(sleepListener).not.toBeCalled();

              pc.send.press();
              pc.send.press();
              expect(pc.in("sleep")).not.toBe(null);
              expect(sleepListener).toBeCalled();
            });
          });
        });
        //#endregion

        //#region state->sub
        describe("sub", () => {
          it("defines substates", () => {
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            expect(mug.state.sub).toEqual({});

            mug.send.pour();

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

            mug.send.pour();
            mug.send.full.tea.infuse();
            mug.send.full.tea.done();
            mug.send.full.tea.drink();

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
                  "tea.finished -> finish() -> dirty",
                  "tea.oversteeped -> oversteep() -> undrinkable",
                ]),
              )
              .state("undrinkable", "drain() -> dirty")
              .state("dirty", ["clean() -> clear"]);

            const mugA = mug.host();
            mugA.send.pour();
            mugA.send.full.tea.infuse();
            mugA.send.full.tea.done();
            mugA.send.full.tea.drink();

            expect(mugA.in("dirty")).not.toBe(null);

            const mugB = mug.host();
            mugB.send.pour();
            mugB.send.full.tea.infuse();
            mugB.send.full.tea.done();
            mugB.send.full.tea.infuse();

            expect(mugB.in("undrinkable")).not.toBe(null);
          });
        });
        //#endregion

        //#region state->enter
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
            light.send.toggle();
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
            light.send.toggle();
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
            light.send.toggle();
            expect(actionListener).toBeCalled();
          });
        });
        //#endregion

        //#region state->exit
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
            light.send.toggle();
            expect(onListener).toBeCalled();
            expect(offListener).not.toBeCalled();
            light.send.toggle();
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
                $.enter("offEnter!").exit("offExit!").on("toggle() -> on"),
              )
              .state("on", ($) =>
                $.enter("onEnter!").exit("onExit!").on("toggle() -> off"),
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
            light.send.toggle();
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
            light.send.toggle();
            expect(actionListener).toBeCalled();
          });
        });
        //#endregion
      });
    });
    //#endregion

    //#region final
    describe("final", () => {
      it("creates a final state that finalizes the statechart", () => {
        const casseteState = superstate<CassetteState>("cassette")
          .state("stopped", ["play() -> playing", "eject() -> ejected"])
          .state("playing", ["stop() -> stopped", "eject() -> ejected"])
          .final("ejected");

        const cassete = casseteState.host();
        expect(cassete.finalized).toBe(false);

        const state = cassete.send.eject();

        expect(state?.name).toBe("ejected");
        expect(state?.final).toBe(true);
        expect(cassete.finalized).toBe(true);
      });
    });
    //#endregion
  });

  describe("factory", () => {
    //#region name
    describe("name", () => {
      it("holds the statechart name", () => {
        const playerState = createPlayerState();
        expect(playerState.name).toBe("player");
      });
    });
    //#endregion

    //#region name
    describe("states", () => {
      it("holds the availble states", () => {
        const playerState = createPlayerState();
        expect(playerState.states).toEqual([
          expect.objectContaining({
            name: "stopped",
          }),
          expect.objectContaining({
            name: "playing",
          }),
          expect.objectContaining({
            name: "paused",
          }),
        ]);
      });
    });
    //#endregion

    //#region host
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
              $.sub("doll", smallDollState),
            );

          const bigDollState = superstate<DollState>("bigDoll")
            .state("closed", "open() -> open")
            .state("open", "close() -> closed", ($) =>
              $.sub("doll", mediumDollState),
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

          bigDoll.send.open();

          expect(mediumDollCloseListener).not.toBeCalled();
          expect(mediumDollOpenListener).not.toBeCalled();
          expect(smallDollCloseListener).not.toBeCalled();
          expect(smallDollOpenListener).not.toBeCalled();

          bigDoll.send.open.doll.open();

          expect(mediumDollCloseListener).not.toBeCalled();
          expect(mediumDollOpenListener).toBeCalled();
          expect(smallDollCloseListener).toBeCalled();
          expect(smallDollOpenListener).not.toBeCalled();

          bigDoll.send.open.doll.open.doll.open();

          expect(mediumDollCloseListener).not.toBeCalled();
          expect(mediumDollOpenListener).toBeCalled();
          expect(smallDollCloseListener).toBeCalled();
          expect(smallDollOpenListener).toBeCalled();

          bigDoll.send.open.doll.close();

          expect(mediumDollCloseListener).toBeCalled();
          expect(mediumDollOpenListener).toBeCalled();
          expect(smallDollCloseListener).toBeCalled();
          expect(smallDollOpenListener).toBeCalled();
        });
      });

      describe("contexts", () => {
        it("allows to pass initial context", () => {
          const signUpState = createSignUpState();
          const signUp = signUpState.host({
            context: {
              ref: "topbar",
            },
          });
          expect(signUp.state.context.ref).toBe("topbar");
        });
      });
    });
    //#endregion
  });

  describe("instance", () => {
    //#region send
    describe("send", () => {
      it("sends an event", () => {
        const playerState = createPlayerState();
        const player = playerState.host();
        player.send.play();
        expect(player.state.name).toBe("playing");
      });

      it("allows to send non-matching events", () => {
        const playerState = createPlayerState();
        const player = playerState.host();
        player.send.pause();
        expect(player.state.name).toBe("stopped");
      });

      it("returns the next state", () => {
        const playerState = createPlayerState();
        const player = playerState.host();
        const nextState = player.send.play();
        expect(nextState?.name).toBe("playing");
      });

      it("returns null for non-matching events", () => {
        const playerState = createPlayerState();
        const player = playerState.host();
        const nextState = player.send.pause();
        expect(nextState).toBe(null);
      });

      describe("conditions", () => {
        it("allows to send conditions", () => {
          const pcState = superstate<PCState>("pc")
            .state("off", "press() -> on")
            .state("sleep", ($) =>
              $.if("press", ["(long) -> off", "() -> on"]).on(
                "restart() -> on",
              ),
            )
            .state("on", ($) =>
              $.if("press", ["(long) -> off", "() -> sleep"]).on(
                "restart() -> on",
              ),
            );
          const pc = pcState.host();
          pc.send.press();
          pc.send.press();
          expect(pc.state.name).toBe("sleep");
          pc.send.press("long");
          expect(pc.state.name).toBe("off");
          pc.send.press();
          expect(pc.state.name).toBe("on");
          pc.send.press("long");
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
              ]).on("restart() -> on"),
            )
            .state("on", ($) =>
              $.if("press", [
                "(long) -> off",
                "(double) -> restarting",
                "() -> sleep",
              ]).on("restart() -> on"),
            )
            .state("restarting", "restarted() -> on");
          const pc = pcState.host();
          pc.send.press();
          pc.send.press();
          expect(pc.state.name).toBe("sleep");
          pc.send.press("double");
          expect(pc.state.name).toBe("restarting");
          pc.send.restarted();
          expect(pc.state.name).toBe("on");
          pc.send.press("long");
          expect(pc.state.name).toBe("off");
        });

        it("works with only-conditional events", () => {
          const catState = superstate<CatState>("cat")
            .state("boxed", ($) =>
              $.if("reveal", ["(lucky) -> alive", "(unlucky) -> dead"]),
            )
            .state("alive", ($) => $.on("pet() -> alive"))
            .state("dead");

          const cat = catState.host();
          cat.send.reveal("lucky");
          expect(cat.state.name).toBe("alive");
        });

        it("allows to use event shortcut", () => {
          const pcState = superstate<PCState>("pc")
            .state("off", "press() -> on")
            .state("sleep", ($) =>
              $.if("press", ["(long) -> off", "() -> on"]).on(
                "restart() -> on",
              ),
            )
            .state("on", ($) =>
              $.if("press", ["(long) -> off", "() -> sleep"]).on(
                "restart() -> on",
              ),
            );
          const pc = pcState.host();
          pc.send.press();
          pc.send.press();
          expect(pc.state.name).toBe("sleep");
          pc.send.press("long");
          expect(pc.state.name).toBe("off");
          pc.send.press();
          expect(pc.state.name).toBe("on");
          pc.send.press("long");
          expect(pc.state.name).toBe("off");
        });
      });

      describe("substates", () => {
        it("allows to send events to substates", () => {
          const mugState = createMugWithTeaState();

          const mug = mugState.host();
          mug.send.pour();
          mug.send.full.tea.infuse();

          expect(
            mug.state.name === "full" &&
              mug.state.sub.tea.state.name === "steeping",
          ).toBe(true);
        });

        it("does not trigger parent events with the same name", () => {
          const bigDollListener = vi.fn();

          const dollState = createRussianDollState();

          const doll = dollState.host();
          doll.send.open();
          doll.on("close()", bigDollListener);
          doll.send.open.doll.open();
          doll.send.open.doll.close();

          expect(bigDollListener).not.toBeCalled();
        });

        it("allows to send events to deeply nested substates", () => {
          const smallDollListener = vi.fn();
          const wildcardListener = vi.fn();
          const dollState = createRussianDollState();

          const doll = dollState.host();
          doll.on("*", wildcardListener);
          doll.on("open.doll.open.doll.open()", smallDollListener);
          doll.send.open.doll.open.doll.open();

          expect(smallDollListener).not.toBeCalled();
          expect(wildcardListener).not.toBeCalled();

          doll.send.open();
          expect(doll.state.name).toBe("open");

          doll.send.open.doll.open();
          expect(
            doll.state.name === "open" && doll.state.sub.doll.state.name,
          ).toBe("open");

          doll.send.open.doll.open.doll.open();
          expect(
            doll.state.name === "open" &&
              doll.state.sub.doll.state.name === "open" &&
              doll.state.sub.doll.state.sub.doll.state.name,
          ).toBe("open");

          expect(smallDollListener).toBeCalledTimes(1);
        });
      });

      describe("contexts", () => {
        it("allows to pass context to an event", () => {
          const signUpState = createSignUpState();
          const signUp = signUpState.host();

          const receivedState = signUp.send.credentials.form.submit(
            "-> complete",
            {
              email: "koss@nocorp.me",
              password: "123456",
            },
          );

          expect(receivedState?.context).toEqual({
            email: "koss@nocorp.me",
            password: "123456",
          });
        });

        it("merges substate's final state context into the parent context", () => {
          const signUpState = createSignUpState();
          const signUp = signUpState.host({
            context: { ref: "toolbar" },
          });

          const receivedState = signUp.send.credentials.form.submit(
            "-> complete",
            {
              email: "koss@nocorp.me",
              password: "123456",
            },
          );

          expect(receivedState?.context).toEqual({
            email: "koss@nocorp.me",
            password: "123456",
          });

          expect(signUp.state.name).toBe("profile");

          expect(signUp.state.context).toEqual({
            ref: "toolbar",
            email: "koss@nocorp.me",
            password: "123456",
          });
        });

        it("allows to use assign function", () => {
          const credentialsState = createFormState<CredentialsFields>();

          const credentials = credentialsState.host({
            context: { email: "", password: "" },
          });

          const erroredState = credentials.send.submit("error", "-> errored", {
            email: "",
            password: "123456",
            error: "Email not found",
          });

          expect(erroredState?.context).toEqual({
            email: "",
            password: "123456",
            error: "Email not found",
          });

          const submittedState = credentials.send.submit(
            "-> complete",
            ($, context) =>
              $({
                password: context.password,
                email: "koss@nocorp.me",
              }),
          );

          expect(submittedState?.context).toEqual({
            email: "koss@nocorp.me",
            password: "123456",
          });
        });

        it("allows to pass context with a condition", () => {
          const signUpState = createSignUpState();
          const signUp = signUpState.host();

          const receivedState = signUp.send.credentials.form.submit(
            "error",
            "-> errored",
            {
              email: "",
              password: "123456",
              error: "Email is missing",
            },
          );

          expect(receivedState?.context).toEqual({
            email: "",
            password: "123456",
            error: "Email is missing",
          });
        });

        it("prevents passing context to wrong event", () => {
          const wizardState = createWizardState();
          const wizard = wizardState.host();

          wizard.send.submit("-> done", {
            email: "koss@nocorp.me",
            password: "123456",
            fullName: "Sasha Koss",
            company: "No Corp",
          });

          expect(wizard.state.name).toBe("credentials");
          expect(wizard.state.context).toEqual(null);

          wizard.send.submit("-> profile", {
            email: "koss@nocorp.me",
            password: "123456",
          });

          expect(wizard.state.name).toBe("profile");
          expect(wizard.state.context).toEqual({
            email: "koss@nocorp.me",
            password: "123456",
          });

          wizard.send.submit("-> done", {
            email: "koss@nocorp.me",
            password: "123456",
            fullName: "Sasha Koss",
            company: "No Corp",
          });

          expect(wizard.state.name).toBe("done");
          expect(wizard.state.context).toEqual({
            email: "koss@nocorp.me",
            password: "123456",
            fullName: "Sasha Koss",
            company: "No Corp",
          });
        });

        it("allows to set initial substate context", () => {
          const signUpState = createSignUpState();
          const signUp = signUpState.host({
            context: { ref: "toolbar" },
            credentials: {
              form: {
                context: {
                  email: "koss@nocorp.me",
                  password: "123456",
                },
              },
            },
          });

          const receivedState = signUp.send.credentials.form.submit(
            "-> complete",
            ($, { email, password }) => $({ email, password }),
          );

          expect(receivedState?.context).toEqual({
            email: "koss@nocorp.me",
            password: "123456",
          });
        });

        it("allows to set initial substate context with a function", () => {
          const signUpState = createSignUpState();
          const signUp = signUpState.host({
            context: { ref: "toolbar" },
            credentials: {
              form: {
                context: ($, context) =>
                  $({
                    email: "koss@nocorp.me",
                    password: context.ref || "",
                  }),
              },
            },
          });

          const receivedState = signUp.send.credentials.form.submit(
            "-> complete",
            ($, { email, password }) => $({ email, password }),
          );

          expect(receivedState?.context).toEqual({
            email: "koss@nocorp.me",
            password: "toolbar",
          });
        });
      });
    });
    //#endregion

    //#region on
    describe("on", () => {
      describe("state updates", () => {
        it("allows to subscribe to state updates", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.on("*", listener);
          player.send.play();
          player.send.pause();
          player.send.play();
          expect(listener).toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({ to: "playing" }),
          });
          expect(listener).toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({ to: "paused" }),
          });
          expect(listener).toBeCalledTimes(6);
        });

        it("allows to subscribe to specific state updates", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.on("paused", listener);
          player.send.play();
          player.send.pause();
          player.send.play();
          player.send.pause();
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
          expect(listener).toBeCalledTimes(2);
        });

        it("allows to subscribe to few state updates", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.on(["paused", "stopped"], listener);
          player.send.play();
          player.send.pause();
          player.send.stop();
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
          expect(listener).toBeCalledTimes(2);
        });

        it("subscribes to the right state updates on common event", () => {
          const listener = vi.fn();
          const lightState = superstate<LightState>("light")
            .state("off", "toggle() -> on")
            .state("on", "toggle() -> off");
          const light = lightState.host();
          light.on(["on", "off"], listener);
          light.send.toggle();
          expect(listener).toBeCalledTimes(1);
          expect(listener).toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ name: "on" }),
          });
          light.send.toggle();
          expect(listener).toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ name: "off" }),
          });
          expect(listener).toBeCalledTimes(2);
        });

        describe("substates", () => {
          it("subscribes to state updates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();

            mug.on("full.tea.steeping", listener);

            mug.send.pour();
            mug.send.full.tea.infuse();

            expect(listener).toBeCalledWith({
              type: "state",
              state: expect.objectContaining({ name: "steeping" }),
            });
            expect(listener).toBeCalledTimes(1);
          });

          it("subscribes after hosting the substate", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            mug.send.pour();

            mug.on("full.tea.steeping", listener);

            mug.send.full.tea.infuse();

            expect(listener).toBeCalledWith({
              type: "state",
              state: expect.objectContaining({ name: "steeping" }),
            });
            expect(listener).toBeCalledTimes(1);
          });

          it("unsubscribes when leaving the state", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            mug.on("full.tea.steeping", listener);

            mug.send.pour();
            const teaSubstate = mug.in("full")?.sub.tea;
            if (!teaSubstate) throw new Error("Invalid state");

            mug.send.drink();

            teaSubstate?.send.infuse();
            mug.send.full.tea.infuse();

            expect(listener).not.toBeCalled();
          });

          it("deeply unsubscribes when leaving the state", () => {
            const listener = vi.fn();
            const dollState = createRussianDollState();

            const doll = dollState.host();
            doll.on("open.doll.open.doll.open", listener);

            doll.send.open();
            doll.send.open.doll.open();

            const smallDollSubstate = doll.in("open")?.sub.doll?.in("open")
              ?.sub.doll;
            if (!smallDollSubstate) throw new Error("Invalid state");

            doll.send.close();

            smallDollSubstate.send.open();
            expect(listener).not.toBeCalled();
          });

          it("preserves subscription groups", () => {
            const aListener = vi.fn();
            const bListener = vi.fn();

            const mug = createMugWithTeaState().host();

            mug.send.pour();

            mug.on(["**", "full.tea.*", "full.tea.infuse()"], aListener);
            mug.on("**", bListener);
            mug.on("full.tea.*", bListener);
            mug.on("full.tea.infuse()", bListener);

            mug.send.full.tea.infuse();

            expect(bListener).toBeCalledTimes(5);
            expect(aListener).toBeCalledTimes(2);
          });

          describe("wildcard", () => {
            it("subscribes to all updates", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();

              mug.on("full.tea.*", listener);

              mug.send.pour();
              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "steeping" }),
              });
              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "ready" }),
              });
              expect(listener).toBeCalledTimes(4);
            });

            it("subscribes after hosting the substate", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.send.pour();

              mug.on("full.tea.*", listener);

              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "steeping" }),
              });
              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "ready" }),
              });
              expect(listener).toBeCalledTimes(4);
            });
          });

          describe("deep wildcard", () => {
            it("subscribes to all updates in the hierarchy", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();

              mug.on("**", listener);

              mug.send.pour();
              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "full" }),
              });
              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "steeping" }),
              });
              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "ready" }),
              });
              expect(listener).toBeCalledTimes(7);
            });

            it("subscribes after hosting the substate", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.send.pour();

              mug.on("**", listener);

              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "steeping" }),
              });
              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "ready" }),
              });
              expect(listener).toBeCalledTimes(4);
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
          player.send.play();
          expect(listener).toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({ event: "play" }),
          });
          expect(listener).toBeCalledTimes(2);
        });

        it("sends event update before state update", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.on("*", listener);
          player.send.play();
          expect(listener).toHaveBeenLastCalledWith({
            type: "state",
            state: expect.objectContaining({ name: "playing" }),
          });
          expect(listener).toBeCalledTimes(2);
        });

        it("allows to subscribe to specific event updates", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.on("pause()", listener);
          player.send.play();
          player.send.pause();
          player.send.play();
          player.send.pause();
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
          expect(listener).toBeCalledTimes(2);
        });

        it("allows to subscribe to few event updates", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.on(["pause()", "stop()"], listener);
          player.send.play();
          player.send.pause();
          player.send.stop();
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
          expect(listener).toBeCalledTimes(2);
        });

        it("allows to subscribe to mixed updates", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.on(["pause()", "stopped"], listener);
          player.send.play();
          player.send.pause();
          player.send.stop();
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
          expect(listener).toBeCalledTimes(2);
        });

        it("subscribes to the right event updates on common event", () => {
          const listener = vi.fn();
          const lightState = superstate<LightState>("light")
            .state("off", "toggle() -> on")
            .state("on", "toggle() -> off");
          const light = lightState.host();
          light.on("toggle()", listener);
          light.send.toggle();
          expect(listener).toBeCalledTimes(1);
          expect(listener).toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({
              event: "toggle",
              from: "off",
              to: "on",
            }),
          });
          light.send.toggle();
          expect(listener).toBeCalledTimes(2);
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
                  "restart() -> on",
                ),
              )
              .state("sleep", ($) =>
                $.if("press", ["(long) -> off", "() -> on"]).on(
                  "restart() -> on",
                ),
              );
            const pc = pcState.host();
            pc.send.press();
            pc.on("press(long)", conditionListener);
            pc.on("press()", elseListener);
            pc.send.press("long");
            expect(conditionListener).toBeCalledWith({
              type: "event",
              transition: expect.objectContaining({
                event: "press",
                condition: "long",
              }),
            });
            expect(elseListener).not.toBeCalled();
            expect(conditionListener).toBeCalledTimes(1);
          });
        });

        describe("substates", () => {
          it("subscribes to event updates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();

            mug.on("full.tea.infuse()", listener);

            mug.send.pour();
            mug.send.full.tea.infuse();

            expect(listener).toBeCalledWith({
              type: "event",
              transition: expect.objectContaining({ event: "infuse" }),
            });
            expect(listener).toBeCalledTimes(1);
          });

          it("subscribes after hosting the substate", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            mug.send.pour();

            mug.on("full.tea.infuse()", listener);

            mug.send.full.tea.infuse();

            expect(listener).toBeCalledWith({
              type: "event",
              transition: expect.objectContaining({ event: "infuse" }),
            });
            expect(listener).toBeCalledTimes(1);
          });

          it("unsubscribes when leaving the state", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            mug.on("full.tea.infuse()", listener);

            mug.send.pour();
            const teaSubstate = mug.in("full")?.sub.tea;
            if (!teaSubstate) throw new Error("Invalid state");

            mug.send.drink();

            teaSubstate?.send.infuse();
            mug.send.full.tea.infuse();

            expect(listener).not.toBeCalled();
          });

          it("deeply unsubscribes when leaving the state", () => {
            const listener = vi.fn();
            const dollState = createRussianDollState();

            const doll = dollState.host();
            doll.on("open.doll.open.doll.open()", listener);

            doll.send.open();
            doll.send.open.doll.open();

            const smallDollSubstate = doll.in("open")?.sub.doll?.in("open")
              ?.sub.doll;
            if (!smallDollSubstate) throw new Error("Invalid state");

            doll.send.close();

            smallDollSubstate.send.open();
            expect(listener).not.toBeCalled();
          });

          describe("wildcard", () => {
            it("subscribes to all updates", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.on("full.tea.*", listener);

              mug.send.pour();
              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "infuse" }),
              });
              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "done" }),
              });
              expect(listener).toBeCalledTimes(4);
            });

            it("subscribes after hosting the substate", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.send.pour();

              mug.on("full.tea.*", listener);

              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "infuse" }),
              });
              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "done" }),
              });
              expect(listener).toBeCalledTimes(4);
            });
          });

          describe("deep wildcard", () => {
            it("subscribes to all updates in the hierarchy", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();

              mug.on("**", listener);

              mug.send.pour();
              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

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
              expect(listener).toBeCalledTimes(7);
            });

            it("subscribes after hosting the substate", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.send.pour();

              mug.on("**", listener);

              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "infuse" }),
              });
              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "done" }),
              });
              expect(listener).toBeCalledTimes(4);
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
          player.send.play();
          expect(listener).not.toBeCalled();
        });

        it("allows to call off multiple times", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          const off = player.on("*", listener);
          off();
          off();
        });

        describe("substates", () => {
          it("unsubscribes from substates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            const off = mug.on("full.tea.infuse()", listener);

            mug.send.pour();
            mug.send.full.tea.infuse();

            expect(listener).toBeCalledTimes(1);

            off();

            mug.send.full.tea.infuse();

            expect(listener).toBeCalledTimes(1);
          });

          it("unsubscribes from deeply nested substates", () => {
            const listener = vi.fn();
            const dollState = createRussianDollState();

            const doll = dollState.host();
            const off = doll.on("open.doll.open.doll.open()", listener);
            doll.send.open.doll.open.doll.open();

            expect(listener).not.toBeCalled();

            doll.send.open();
            expect(doll.state.name).toBe("open");

            doll.send.open.doll.open();
            expect(
              doll.state.name === "open" && doll.state.sub.doll.state.name,
            ).toBe("open");

            off();

            doll.send.open.doll.open.doll.open();
            expect(
              doll.state.name === "open" &&
                doll.state.sub.doll.state.name === "open" &&
                doll.state.sub.doll.state.sub.doll.state.name,
            ).toBe("open");

            expect(listener).not.toBeCalled();
          });

          it("unsubscribes from wildcard updates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            const off = mug.on("full.tea.*", listener);

            mug.send.pour();
            mug.send.full.tea.infuse();

            expect(listener).toBeCalledTimes(2);

            off();

            mug.send.full.tea.done();

            expect(listener).toBeCalledTimes(2);
          });

          it("unsubscribes from deep wildcard updates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            const off = mug.on("**", listener);

            mug.send.pour();
            mug.send.full.tea.infuse();

            expect(listener).toBeCalledTimes(5);

            off();

            mug.send.full.tea.done();

            expect(listener).toBeCalledTimes(5);
          });
        });
      });

      describe("contexts", () => {
        it("allows to access context in event updates", () => {
          const listener = vi.fn();
          const credentialsState = createFormState<CredentialsFields>();

          const credentials = credentialsState.host({
            context: { email: "", password: "" },
          });
          credentials.on("*", listener);

          const erroredState = credentials.send.submit("error", "-> errored", {
            email: "",
            password: "123456",
            error: "Email not found",
          });

          expect(listener).toBeCalledWith(
            expect.objectContaining({
              transition: expect.objectContaining({
                context: {
                  email: "",
                  password: "123456",
                  error: "Email not found",
                },
              }),
            }),
          );
        });

        it("allows to access context from substate event updates", () => {
          const listener = vi.fn();
          const signUpState = createSignUpState();
          const signUp = signUpState.host();

          signUp.on("*", listener);

          const receivedState = signUp.send.credentials.form.submit(
            "-> complete",
            {
              email: "koss@nocorp.me",
              password: "123456",
            },
          );

          expect(listener).toBeCalledWith(
            expect.objectContaining({
              transition: expect.objectContaining({
                context: {
                  email: "koss@nocorp.me",
                  password: "123456",
                },
              }),
            }),
          );
        });
      });
    });
    //#endregion

    //#region once
    describe("once", () => {
      describe("state updates", () => {
        it("allows to subscribe once to state updates", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.once("*", listener);
          player.send.play();
          player.send.pause();
          expect(listener).toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({ to: "playing" }),
          });
          expect(listener).not.toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({ to: "paused" }),
          });
          expect(listener).toBeCalledTimes(1);
        });

        it("allows to subscribe once to specific state updates", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.once("paused", listener);
          player.send.play();
          player.send.pause();
          player.send.play();
          player.send.pause();
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
          expect(listener).toBeCalledTimes(1);
        });

        it("allows to subscribe once to few state updates", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.once(["paused", "stopped"], listener);
          player.send.play();
          player.send.pause();
          player.send.stop();
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
          expect(listener).not.toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ name: "stopped" }),
          });
          expect(listener).toBeCalledTimes(1);
        });

        it("subscribes once to the right state updates on common event", () => {
          const listener = vi.fn();
          const lightState = superstate<LightState>("light")
            .state("off", "toggle() -> on")
            .state("on", "toggle() -> off");
          const light = lightState.host();
          light.once(["on", "off"], listener);
          light.send.toggle();
          expect(listener).toBeCalledTimes(1);
          expect(listener).toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ name: "on" }),
          });
          light.send.toggle();
          expect(listener).not.toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ name: "off" }),
          });
          expect(listener).toBeCalledTimes(1);
        });

        describe("substates", () => {
          it("subscribes once to state updates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();

            mug.once("full.tea.steeping", listener);

            mug.send.pour();
            mug.send.full.tea.infuse();

            expect(listener).toBeCalledWith({
              type: "state",
              state: expect.objectContaining({ name: "steeping" }),
            });
            expect(listener).toBeCalledTimes(1);
          });

          it("subscribes once after hosting the substate", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            mug.send.pour();

            mug.once("full.tea.steeping", listener);

            mug.send.full.tea.infuse();

            expect(listener).toBeCalledWith({
              type: "state",
              state: expect.objectContaining({ name: "steeping" }),
            });
            expect(listener).toBeCalledTimes(1);
          });

          it("unsubscribes when leaving the state", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            mug.once("full.tea.steeping", listener);

            mug.send.pour();
            const teaSubstate = mug.in("full")?.sub.tea;
            if (!teaSubstate) throw new Error("Invalid state");

            mug.send.drink();

            teaSubstate?.send.infuse();
            mug.send.full.tea.infuse();

            expect(listener).not.toBeCalled();
          });

          it("deeply unsubscribes when leaving the state", () => {
            const listener = vi.fn();
            const dollState = createRussianDollState();

            const doll = dollState.host();
            doll.once("open.doll.open.doll.open", listener);

            doll.send.open();
            doll.send.open.doll.open();

            const smallDollSubstate = doll.in("open")?.sub.doll?.in("open")
              ?.sub.doll;
            if (!smallDollSubstate) throw new Error("Invalid state");

            doll.send.close();

            smallDollSubstate.send.open();
            expect(listener).not.toBeCalled();
          });

          it("preserves subscription groups", () => {
            const aListener = vi.fn();
            const bListener = vi.fn();

            const mug = createMugWithTeaState().host();

            mug.send.pour();

            mug.once(["**", "full.tea.*", "full.tea.infuse()"], aListener);
            mug.once("**", bListener);
            mug.once("full.tea.*", bListener);
            mug.once("full.tea.infuse()", bListener);

            mug.send.full.tea.infuse();

            expect(bListener).toBeCalledTimes(3);
            expect(aListener).toBeCalledTimes(1);
          });

          describe("wildcard", () => {
            it("subscribes once to all updates", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();

              mug.once("full.tea.*", listener);

              mug.send.pour();
              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "steeping" }),
              });
              expect(listener).not.toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "ready" }),
              });
              expect(listener).toBeCalledTimes(1);
            });

            it("subscribes once after hosting the substate", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.send.pour();

              mug.once("full.tea.*", listener);

              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "steeping" }),
              });
              expect(listener).not.toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "ready" }),
              });
              expect(listener).toBeCalledTimes(1);
            });
          });

          describe("deep wildcard", () => {
            it("subscribes once to all updates in the hierarchy", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();

              mug.once("**", listener);

              mug.send.pour();
              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "full" }),
              });
              expect(listener).not.toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "steeping" }),
              });
              expect(listener).not.toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "ready" }),
              });
              expect(listener).toBeCalledTimes(1);
            });

            it("subscribes once after hosting the substate", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.send.pour();

              mug.once("**", listener);

              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "steeping" }),
              });
              expect(listener).not.toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ to: "ready" }),
              });
              expect(listener).toBeCalledTimes(1);
            });
          });
        });
      });

      describe("event updates", () => {
        it("allows to subscribe once to event updates", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.once("*", listener);
          player.send.play();
          expect(listener).toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({ event: "play" }),
          });
          expect(listener).toBeCalledTimes(1);
        });

        it("sends event once update before state update", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.once("*", listener);
          player.send.play();
          expect(listener).not.toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ name: "playing" }),
          });
          expect(listener).toBeCalledTimes(1);
        });

        it("allows to subscribe once to specific event updates", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.once("pause()", listener);
          player.send.play();
          player.send.pause();
          player.send.play();
          player.send.pause();
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
          expect(listener).toBeCalledTimes(1);
        });

        it("allows to subscribe once to few event updates", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.once(["pause()", "stop()"], listener);
          player.send.play();
          player.send.pause();
          player.send.stop();
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
          expect(listener).not.toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({ event: "stop" }),
          });
          expect(listener).toBeCalledTimes(1);
        });

        it("allows to subscribe once to mixed updates", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          player.once(["pause()", "stopped"], listener);
          player.send.play();
          player.send.pause();
          player.send.stop();
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
          expect(listener).not.toBeCalledWith({
            type: "state",
            state: expect.objectContaining({ name: "stopped" }),
          });
          expect(listener).toBeCalledTimes(1);
        });

        it("subscribes once to the right event updates on common event", () => {
          const listener = vi.fn();
          const lightState = superstate<LightState>("light")
            .state("off", "toggle() -> on")
            .state("on", "toggle() -> off");
          const light = lightState.host();
          light.once("toggle()", listener);
          light.send.toggle();
          expect(listener).toBeCalledTimes(1);
          expect(listener).toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({
              event: "toggle",
              from: "off",
              to: "on",
            }),
          });
          light.send.toggle();
          expect(listener).toBeCalledTimes(1);
          expect(listener).not.toBeCalledWith({
            type: "event",
            transition: expect.objectContaining({
              event: "toggle",
              from: "on",
              to: "off",
            }),
          });
        });

        describe("conditions", () => {
          it("allows to subscribe once to conditions", () => {
            const conditionListener = vi.fn();
            const elseListener = vi.fn();
            const pcState = superstate<PCState>("pc")
              .state("off", "press() -> on")
              .state("on", ($) =>
                $.if("press", ["(long) -> off", "() -> sleep"]).on(
                  "restart() -> on",
                ),
              )
              .state("sleep", ($) =>
                $.if("press", ["(long) -> off", "() -> on"]).on(
                  "restart() -> on",
                ),
              );
            const pc = pcState.host();
            pc.send.press();
            pc.once("press(long)", conditionListener);
            pc.once("press()", elseListener);
            pc.send.press("long");
            pc.send.press("long");
            expect(conditionListener).toBeCalledWith({
              type: "event",
              transition: expect.objectContaining({
                event: "press",
                condition: "long",
              }),
            });
            expect(elseListener).not.toBeCalled();
            expect(conditionListener).toBeCalledTimes(1);
          });
        });

        describe("substates", () => {
          it("subscribes to event updates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();

            mug.once("full.tea.infuse()", listener);

            mug.send.pour();
            mug.send.full.tea.infuse();

            expect(listener).toBeCalledWith({
              type: "event",
              transition: expect.objectContaining({ event: "infuse" }),
            });
            expect(listener).toBeCalledTimes(1);
          });

          it("subscribes once after hosting the substate", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            mug.send.pour();

            mug.once("full.tea.infuse()", listener);

            mug.send.full.tea.infuse();

            expect(listener).toBeCalledWith({
              type: "event",
              transition: expect.objectContaining({ event: "infuse" }),
            });
            expect(listener).toBeCalledTimes(1);
          });

          it("unsubscribes when leaving the state", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            mug.once("full.tea.infuse()", listener);

            mug.send.pour();
            const teaSubstate = mug.in("full")?.sub.tea;
            if (!teaSubstate) throw new Error("Invalid state");

            mug.send.drink();

            teaSubstate?.send.infuse();
            mug.send.full.tea.infuse();

            expect(listener).not.toBeCalled();
          });

          it("deeply unsubscribes when leaving the state", () => {
            const listener = vi.fn();
            const dollState = createRussianDollState();

            const doll = dollState.host();
            doll.once("open.doll.open.doll.open()", listener);

            doll.send.open();
            doll.send.open.doll.open();

            const smallDollSubstate = doll.in("open")?.sub.doll?.in("open")
              ?.sub.doll;
            if (!smallDollSubstate) throw new Error("Invalid state");

            doll.send.close();

            smallDollSubstate.send.open();
            expect(listener).not.toBeCalled();
          });

          describe("wildcard", () => {
            it("subscribes once to all updates", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.once("full.tea.*", listener);

              mug.send.pour();
              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "infuse" }),
              });
              expect(listener).not.toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "done" }),
              });
              expect(listener).toBeCalledTimes(1);
            });

            it("subscribes once after hosting the substate", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.send.pour();

              mug.once("full.tea.*", listener);

              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "infuse" }),
              });
              expect(listener).not.toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "done" }),
              });
              expect(listener).toBeCalledTimes(1);
            });
          });

          describe("deep wildcard", () => {
            it("subscribes once to all updates in the hierarchy", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();

              mug.once("**", listener);

              mug.send.pour();
              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "pour" }),
              });
              expect(listener).not.toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "infuse" }),
              });
              expect(listener).not.toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "done" }),
              });
              expect(listener).toBeCalledTimes(1);
            });

            it("subscribes once after hosting the substate", () => {
              const listener = vi.fn();
              const mugState = createMugWithTeaState();

              const mug = mugState.host();
              mug.send.pour();

              mug.once("**", listener);

              mug.send.full.tea.infuse();
              mug.send.full.tea.done();

              expect(listener).toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "infuse" }),
              });
              expect(listener).not.toBeCalledWith({
                type: "event",
                transition: expect.objectContaining({ event: "done" }),
              });
              expect(listener).toBeCalledTimes(1);
            });
          });
        });
      });

      describe("off", () => {
        it("allows to unsubscribe", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          const off = player.once("*", listener);
          off();
          player.send.play();
          expect(listener).not.toBeCalled();
        });

        it("allows to call off multiple times", () => {
          const listener = vi.fn();
          const playerState = createPlayerState();
          const player = playerState.host();
          const off = player.once("*", listener);
          off();
          off();
        });

        describe("substates", () => {
          it("unsubscribes from substates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            const off = mug.once("full.tea.infuse()", listener);

            mug.send.pour();
            mug.send.full.tea.infuse();

            expect(listener).toBeCalledTimes(1);

            off();

            mug.send.full.tea.infuse();

            expect(listener).toBeCalledTimes(1);
          });

          it("unsubscribes from deeply nested substates", () => {
            const listener = vi.fn();
            const dollState = createRussianDollState();

            const doll = dollState.host();
            const off = doll.once("open.doll.open.doll.open()", listener);
            doll.send.open.doll.open.doll.open();

            expect(listener).not.toBeCalled();

            doll.send.open();
            expect(doll.state.name).toBe("open");

            doll.send.open.doll.open();
            expect(
              doll.state.name === "open" && doll.state.sub.doll.state.name,
            ).toBe("open");

            off();

            doll.send.open.doll.open.doll.open();
            expect(
              doll.state.name === "open" &&
                doll.state.sub.doll.state.name === "open" &&
                doll.state.sub.doll.state.sub.doll.state.name,
            ).toBe("open");

            expect(listener).not.toBeCalled();
          });

          it("unsubscribes from wildcard updates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            const off = mug.once("full.tea.*", listener);

            mug.send.pour();
            mug.send.full.tea.infuse();

            expect(listener).toBeCalledTimes(1);

            off();

            mug.send.full.tea.done();

            expect(listener).toBeCalledTimes(1);
          });

          it("unsubscribes from deep wildcard updates", () => {
            const listener = vi.fn();
            const mugState = createMugWithTeaState();

            const mug = mugState.host();
            const off = mug.once("**", listener);

            mug.send.pour();
            mug.send.full.tea.infuse();

            expect(listener).toBeCalledTimes(1);

            off();

            mug.send.full.tea.done();

            expect(listener).toBeCalledTimes(1);
          });
        });
      });

      describe("contexts", () => {
        it("allows to access context in event updates", () => {
          const listener = vi.fn();
          const credentialsState = createFormState<CredentialsFields>();

          const credentials = credentialsState.host({
            context: { email: "", password: "" },
          });
          credentials.once("*", listener);

          const erroredState = credentials.send.submit("error", "-> errored", {
            email: "",
            password: "123456",
            error: "Email not found",
          });

          expect(listener).toBeCalledWith(
            expect.objectContaining({
              transition: expect.objectContaining({
                context: {
                  email: "",
                  password: "123456",
                  error: "Email not found",
                },
              }),
            }),
          );
        });

        it("allows to access context from substate event updates", () => {
          const listener = vi.fn();
          const signUpState = createSignUpState();
          const signUp = signUpState.host();

          signUp.once("*", listener);

          const receivedState = signUp.send.credentials.form.submit(
            "-> complete",
            {
              email: "koss@nocorp.me",
              password: "123456",
            },
          );

          expect(listener).toBeCalledWith(
            expect.objectContaining({
              transition: expect.objectContaining({
                context: {
                  email: "koss@nocorp.me",
                  password: "123456",
                },
              }),
            }),
          );
        });
      });
    });
    //#endregion

    //#region in
    describe("in", () => {
      it("returns the state if the passed state name is current", () => {
        const lightState = superstate<LightState>("light")
          .state("off", "toggle() -> on")
          .state("on");
        const light = lightState.host();
        expect(light.in("on")).toBe(null);
        light.send.toggle();
        expect(light.in("on")).toEqual(expect.objectContaining({ name: "on" }));
      });

      it("allows to check for multiple states", () => {
        const lightState = superstate<LightState>("light")
          .state("off", "toggle() -> on")
          .state("on");
        const light = lightState.host();
        expect(light.in(["on", "off"])).toEqual(
          expect.objectContaining({ name: "off" }),
        );
        light.send.toggle();
        expect(light.in(["on", "off"])).toEqual(
          expect.objectContaining({ name: "on" }),
        );
      });

      describe("substates", () => {
        it("allows to check for substates", () => {
          const mugState = createMugWithTeaState();
          const mug = mugState.host();
          mug.send.pour();
          expect(mug.in("full")).toEqual(
            expect.objectContaining({ name: "full" }),
          );
          expect(mug.in("full.tea.water")).toEqual(
            expect.objectContaining({ name: "water" }),
          );
        });

        it("allows to check for multiple substates", () => {
          const mugState = createMugWithTeaState();
          const mug = mugState.host();
          mug.send.pour();
          expect(mug.in(["full.tea.steeping", "full.tea.water"])).toEqual(
            expect.objectContaining({ name: "water" }),
          );
        });

        it("does't break when checking for non-state substates", () => {
          const mugState = createMugWithTeaState();
          const mug = mugState.host();
          expect(mug.in("full.tea.water")).toBe(null);
        });

        it("returns the first state if the states are overlapping", () => {
          const mug = createMugWithTeaState().host();
          mug.send.pour();
          expect(mug.in("full")).not.toBeNull();
          expect(mug.in("full.tea.water")).not.toBeNull();

          expect(mug.in(["full", "full.tea.water"])?.name).toBe("full");
          expect(mug.in(["full.tea.water", "full"])?.name).toBe("water");
        });
      });
    });
    //#endregion

    //#region off
    describe("off", () => {
      it("unsubscribes from all events", () => {
        const listener = vi.fn();
        const playerState = createPlayerState();
        const player = playerState.host();
        player.on("*", listener);
        player.on("playing", listener);
        player.off();
        player.send.play();
        player.send.pause();
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
          mug.send.pour();
          mug.send.full.tea.infuse();
          mug.send.full.tea.done();
          mug.send.drink();
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
          doll.send.open();
          doll.send.open.doll.open();
          doll.send.open.doll.open.doll.open();
          expect(listener).not.toBeCalled();
        });
      });
    });
    //#endregion
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
      $.sub("tea", teaState, "tea.finished -> finish() -> dirty"),
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

interface ErrorFields {
  error?: string;
}

function createFormState<FormFields>() {
  type Context = FormFields & ErrorFields;

  type FormState =
    | superstate.Def<"pending", Context>
    | superstate.Def<"errored", Context>
    | superstate.Def<"complete", FormFields & {}>
    | "canceled";

  return superstate<FormState>("form")
    .state("pending", [
      "submit(error) -> errored",
      "submit() -> complete",
      "cancel() -> canceled",
    ])
    .state("errored", [
      "submit(error) -> errored",
      "submit() -> complete",
      "cancel() -> canceled",
    ])
    .final("complete")
    .final("canceled");
}

interface RefFields {
  ref?: string;
}

type ProfileContext = RefFields & CredentialsFields;

type DoneContext = RefFields & CredentialsFields & ProfileFields;

type SignUpState =
  | superstate.Def<"credentials", RefFields>
  | superstate.Def<"profile", ProfileContext>
  | superstate.Def<"done", DoneContext>;

interface CredentialsFields {
  email: string;
  password: string;
}

interface ProfileFields {
  fullName: string;
  company: string;
}

function createSignUpState() {
  const credentialsState = createFormState<CredentialsFields>();

  const profileState = createFormState<ProfileFields>();

  return superstate<SignUpState>("signUp")
    .state("credentials", ($) =>
      $.sub("form", credentialsState, ["form.complete -> submit() -> profile"]),
    )
    .state("profile", ($) =>
      $.sub("form", profileState, ["form.complete -> submit() -> done"]),
    )
    .final("done");
}

type WizardState =
  | "credentials"
  | superstate.Def<"profile", ProfileContext>
  | superstate.Def<"done", ProfileFields & CredentialsFields>;

function createWizardState() {
  return superstate<WizardState>("wizard")
    .state("credentials", "submit() -> profile")
    .state("profile", "submit() -> done")
    .final("done");
}
