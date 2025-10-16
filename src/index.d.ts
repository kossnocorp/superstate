import { type Superstate } from "./types.js";
export type { Superstate };

export const superstate: Superstate.Builder.Machine;

export namespace superstate {
  export type State<
    Name extends string,
    Context extends Superstate.Contexts.Constraint | null = null,
  > = Superstate.States.Init<Name, Context>;

  export type Instance<Factory extends Superstate.Factories.Factory<any>> =
    Superstate.InstanceDerive<Factory>;

  export type Factory<Factory extends Superstate.Factories.Factory<any>> =
    Superstate.FactoryDerive<Factory>;
}
