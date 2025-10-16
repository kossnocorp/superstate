import { type Superstate } from "./types.js";
export type { Superstate };

export const superstate: Superstate.Builder.Machine;

export namespace superstate {
  export type Def<
    Name extends string,
    Context extends Superstate.Contexts.Constraint | null = null,
  > = Superstate.States.Init<Name, Context>;

  export type State<
    Factory extends Factories.AnyFactory,
    StateName extends Factory extends Factories.Factory<infer State>
      ? State["name"]
      : never,
  > = Superstate.StateDerive<Factory, StateName>;

  export type Instance<Factory extends Superstate.Factories.Factory<any>> =
    Superstate.InstanceDerive<Factory>;
}
