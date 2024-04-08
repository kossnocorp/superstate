import b from "benny";
import { superstate } from "./src/index.js";
import { createMachine, createActor } from "xstate";

b.suite(
  "Creating factory",

  b.add("Superstate", () => {
    superstate("toggle")
      .state("inactive", "toggle() -> active")
      .state("active", "toggle() -> inactive");
  }),

  b.add("XState", () => {
    createMachine({
      id: "toggle",
      initial: "Inactive",
      states: {
        Inactive: {
          on: { toggle: "Active" },
        },
        Active: {
          on: { toggle: "Inactive" },
        },
      },
    });
  }),

  b.cycle(),
  b.complete()
);

const superstateToggle = superstate<"inactive" | "active">("toggle")
  .state("inactive", "toggle() -> active")
  .state("active", "toggle() -> inactive");

const xstateToggle = createMachine({
  id: "toggle",
  initial: "Inactive",
  states: {
    Inactive: {
      on: { toggle: "Active" },
    },
    Active: {
      on: { toggle: "Inactive" },
    },
  },
});

b.suite(
  "Creating instance",

  b.add("Superstate", () => {
    superstateToggle.host();
  }),

  b.add("XState", () => {
    const actor = createActor(xstateToggle);
    actor.start();
  }),

  b.cycle(),
  b.complete()
);

const superstateInstance = superstateToggle.host();
const xstateInstance = createActor(xstateToggle).start();

b.suite(
  "Sending events",

  b.add("Superstate", () => {
    superstateInstance.send("toggle()");
  }),

  b.add("XState", () => {
    xstateInstance.send({ type: "toggle" });
  }),

  b.cycle(),
  b.complete()
);
