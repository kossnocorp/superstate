/**
 * The root Superstate namespace. It contains all the Superstate types.
 */
export namespace Superstate {
  // Reaccuring generics and their meaning:
  //
  // - `Init`: Initial statechart definition, object with name and context.
  //   - `StatechartInit`: Statechart state inits union
  //   - `StateInit`: Current state init
  //
  // - `Statechart` - Union of all statechart states. Unlike init it contains
  //  the full state object with actions, transitions, and substates.

  //#region Actions
  /**
   * The actions namespace. It contains all the types related to actions,
   * the entity that defines invoked function when entering or exiting a state
   * or transitioning between states.
   */
  export namespace Actions {
    /**
     * The action name definition.
     */
    export type NameDef = `${string}!`;

    /**
     * The action definition.
     */
    export type Def = EnterDef | ExitDef;

    /**
     * The enter action definition.
     */
    export type EnterDef = `-> ${string}!`;

    /**
     * The exit action definition.
     */
    export type ExitDef = `${string}! ->`;

    /**
     * The action type.
     */
    export type Type = "enter" | "exit";

    /**
     * Resolves action struct from an action name def.
     */
    export type FromNameDef<Type, Def> = Def extends `${infer Name}!`
      ? { type: Type; name: Name }
      : never;

    /**
     * Resolves action struct from an action def.
     */
    export type FromDef<Def> = Def extends `-> ${infer Name}!`
      ? { type: "enter"; name: Name }
      : Def extends `${infer Name}! ->`
      ? { type: "exit"; name: Name }
      : never;

    /**
     * The action struct.
     */
    export interface Action {
      /** The action type. */
      type: Type;
      /** The action name. */
      name: string;
    }

    // [TODO] It doesn't belong to actions, move into separate namespace vvvvv

    /**
     * The binding function type.
     */
    export type BindingFn = () => void;

    /**
     * The type resolves arguments for the binding functions to actions. It's
     * used to create a host.
     */
    export type BindingsArgs<State extends States.AnyState> =
      true extends HasBindings<State>
        ? Bindings<State> extends infer Binding_ extends BindingConstraint
          ? BindingsArg<Binding_> extends infer Arg
            ?
                | [Arg]
                // [TODO] Replace it with deep type check
                | (true extends DeepAllOptionalContextsArg<Arg>
                    ? [] | [{}]
                    : never)
            : never
          : never
        : [];

    export type DeepAllOptionalContextsArg<Arg> = // If there's only context in the bindings argument structure...
      "context" extends keyof Arg
        ? // ...and it's all optional, resolve true
          Utils.RequiredKeys<Arg["context"]> extends never
          ? true
          : false
        : // Else if the context is not present, or all optional...
        Utils.RequiredKeys<
            Arg extends { context: infer Context } ? Context : never
          > extends never
        ? // ...and all the rest are resolve to optional too:
          Exclude<keyof Arg, "context"> extends infer Keys extends keyof Arg
          ? // Prevent infinite recursion:
            Keys extends never
            ? never
            : true extends DeepAllOptionalContextsArg<Arg[Keys]>
            ? true
            : false
          : never
        : never;

    export type HasBindings<State> = true extends IsActionable<State>
      ? true
      : true extends Contexts.HasInitialContext<State>
      ? true
      : false;

    /**
     * Converts action and context bindings to the argument structure.
     */
    export type BindingsArg<Bindings extends BindingConstraint> =
      Utils.OmitNever<
        // Defines the initial context:
        //   {
        //     // vvvvv
        //     context: { ... }
        //   }
        // [TODO] Allow passing updater function
        {
          context: Bindings extends {
            context: infer Context extends Contexts.Constraint;
            parent: infer ParentContext;
          }
            ? Contexts.ContextArg<Context, ParentContext>
            : never;
        } & {
          // Defines the state structure:
          //   {
          //     context: { ... },
          //
          //     // vvvvv
          //     on: { ... }
          //   }
          [StateName in Bindings extends { state: string }
            ? Bindings["state"]
            : never]: {
            // Defines each binding
            [Key in Bindings extends { state: StateName; key: string }
              ? Bindings["key"]
              : never]: Bindings extends { state: StateName; key: Key }
              ? Bindings extends {
                  sub: infer SubstateBinding extends BindingConstraint;
                }
                ? // Defines the substate bindings:
                  //   {
                  //     context: { ... },
                  //
                  //     on: {
                  //       // vvvvv
                  //       "running": { ... }
                  //     }
                  //   }
                  BindingsArg<SubstateBinding>
                : // Defines the binding function:
                  //   {
                  //     context: { ... },
                  //
                  //     on: {
                  //       "running": { ... },
                  //
                  //       // vvvvv
                  //       "wake() -> wake!": () => { ... },
                  //     }
                  //   }
                  BindingFn
              : never;
          };
        }
      >;

    /**
     * The binding constrain type.
     */
    export type BindingConstraint =
      | BindingConstraintContext
      | BindingConstraintAction
      | BindingConstraintSubstate;

    /**
     * The binding constrain context type.
     */
    export interface BindingConstraintContext {
      context: Contexts.Constraint;
      parent: Contexts.Constraint | null;
    }

    /**
     * The binding constrain action type.
     */
    export interface BindingConstraintAction {
      key: string;
      state: string;
    }

    /**
     * The binding constrain substate type.
     */
    export interface BindingConstraintSubstate {
      key: string;
      state: string;
      sub: BindingConstraint[];
    }

    /**
     * Resolves action and context bindings. It's defines the host function
     * argument structure.
     */
    export type Bindings<
      State extends States.AnyState,
      ParentContext = null
    > = State extends {
      name: infer StateName;
      actions: Array<infer Action>;
      transitions: Array<infer Transition>;
      sub: Record<string, infer Substate>;
      context: infer Context;
    }
      ? // Get the initial context
        | (State extends {
              name: StateName;
              initial: true;
              context: infer Context extends Contexts.Constraint;
            }
              ? {
                  context: Context;
                  parent: ParentContext;
                }
              : never)
          // Get all state actions
          | (Action extends {
              name: infer ActionName extends string;
              type: infer Type;
            }
              ? {
                  state: StateName;
                  key: Type extends "enter"
                    ? `-> ${ActionName}!`
                    : `${ActionName}! ->`;
                }
              : never)
          // Get all state transitions actions
          | (Transition extends {
              event: infer EventName extends string;
              action: { name: infer ActionName extends string };
              condition: infer Condition;
            }
              ? {
                  state: StateName;
                  key: `${EventName}(${Condition extends string
                    ? Condition
                    : ""}) -> ${ActionName}!`;
                }
              : never)
          // Get all substates
          | (Substate extends {
              sub: { name: infer SubstateName };
              state: infer SubstateState extends States.AnyState;
            }
              ? true extends HasBindings<SubstateState>
                ? {
                    key: SubstateName;
                    state: StateName;
                    sub: Bindings<SubstateState, Context>;
                  }
                : never
              : never)
      : never;

    // [TODO] It doesn't belong to actions, move into separate namespace ^^^^^

    /**
     * The type resolves true if any state has at least one action.
     * It will resolve `boolean` when some states have no actions.
     */
    export type IsActionable<State> = State extends {
      transitions: Array<
        infer Transition extends {
          action: Superstate.Transitions.Action | null;
        }
      >;
      actions: Array<infer Action extends { name: string }>;
      sub: infer Substates;
    }
      ? // Are there any state or transition actions?
        | (Action["name"] extends never
              ? Transition["action"] extends null
                ? false
                : true
              : true)
          // Any there substate actions?
          | (keyof Substates extends never
              ? false
              : Substates[keyof Substates] extends {
                  state: infer SubstateState;
                }
              ? IsActionable<SubstateState>
              : never)
      : never;
  }
  //#endregion

  //#region Events
  /**
   * The events namespace. It contains all the types related to events,
   * the entity that trigger state transitions.
   */
  export namespace Events {
    export type Name<State extends States.AnyState> = State extends {
      transitions: Array<infer Transition extends Transitions.AnyTransition>;
    }
      ? Transition["event"]
      : never;
  }
  //#endregion

  //#region Transitions
  /**
   * The transitions namespace. It contains all the types related to
   * transitions, the entity that defines the state transition triggered
   * by events.
   */
  export namespace Transitions {
    /**
     * The transition type placeholder. It's used where the shape of
     * a transition isn't important or known.
     */
    export type AnyTransition = Transition<any, any, any, any, any, any>;

    export interface Transition<
      EventName extends string,
      FromStateName extends string,
      ToStateName extends string,
      Condition,
      Action,
      Context
    > {
      event: EventName;
      condition: Condition;
      from: FromStateName;
      to: ToStateName;
      action: Action;
      context: Context;
    }

    /**
     * Any transition def.
     */
    export type Def<ToStateName extends string> =
      | EventDef<ToStateName>
      | EventDefWithAction<ToStateName>;

    /**
     * Event string definition. Describes the event that triggers
     * the transition, the condition and the next state.
     */
    export type EventDef<
      ToStateName extends string,
      EventName extends string = string,
      Condition extends string | "" = string | ""
    > = `${EventName}(${Condition}) -> ${ToStateName}`;

    /**
     * The transition def with action.
     */
    export type EventDefWithAction<
      ToStateName extends string,
      EventName extends string = string,
      Condition extends string | "" = string | "",
      Action extends string = string
    > = `${EventName}(${Condition}) -> ${Action}! -> ${ToStateName}`;

    /**
     * Ant transition case def.
     */
    export type CaseDef<ToStateName extends string> =
      | EventCaseDef<ToStateName>
      | EventCaseDefWithAction<ToStateName>;

    /**
     * The transition case def.
     */
    export type EventCaseDef<
      ToStateName extends string,
      Condition extends string | "" = string | ""
    > = `(${Condition}) -> ${ToStateName}`;

    /**
     * The transition case def.
     */
    export type EventCaseDefWithAction<
      ToStateName extends string,
      Condition extends string | "" = string | "",
      Action extends string = string
    > = `(${Condition}) -> ${Action}! -> ${ToStateName}`;

    /**
     * Resolves the event case def to the event def.
     */
    export type CaseDefToDef<
      StatechartInit extends States.AnyInit,
      EventName extends string,
      Def_ extends CaseDef<StatechartInit["name"]>
    > = Def_ extends Def_
      ? // [TODO] Try to optimize it to `${EventName}${Def}`
        Def_ extends EventCaseDef<infer ToStateName, infer Condition>
        ? `${EventName}(${Condition}) -> ${ToStateName}`
        : Def_ extends EventCaseDefWithAction<
            infer ToStateName,
            infer Condition,
            infer Action
          >
        ? `${EventName}(${Condition}) -> ${Action}! -> ${ToStateName}`
        : never
      : never;

    /**
     * The transition action.
     */
    export interface Action {
      /** The action type. */
      type: "transition";
      /** The action name. */
      name: string;
    }

    export type FromDef<
      StatechartInit extends States.AnyInit,
      FromStateInit extends StatechartInit,
      Def_ extends Def<StatechartInit["name"]>
    > = Def_ extends Transitions.EventDefWithAction<
      infer ToStateName,
      infer EventName,
      infer Condition,
      infer Action
    >
      ? Transition<
          EventName,
          FromStateInit["name"],
          ToStateName,
          Condition extends "" ? null : Condition,
          { type: "transition"; name: Action },
          States.FilterInit<StatechartInit, ToStateName>["context"]
        >
      : Def_ extends EventDef<
          infer ToStateName,
          infer EventName,
          infer Condition
        >
      ? Transition<
          EventName,
          FromStateInit["name"],
          ToStateName,
          Condition extends "" ? null : Condition,
          null,
          States.FilterInit<StatechartInit, ToStateName>["context"]
        >
      : never;

    /**
     * Resolves the next state for the transition.
     */
    export type MatchNextState<
      Statechart extends States.AnyState, // [TODO] Cut it
      EventName,
      EventCondition extends string | null
    > = Statechart extends {
      transitions: Array<{
        event: EventName;
        condition: EventCondition;
        to: infer ToName;
      }>;
    }
      ? States.FilterState<Statechart, ToName>
      : never;

    /**
     * Resolves transition type from state.
     */
    export type FromState<State> = State extends {
      transitions: Array<infer Transition extends Transitions.AnyTransition>;
    }
      ? Transition
      : never;

    /**
     * Resolves transition def.
     */
    export type SubstateTransitionDef<
      StatechartInit extends States.AnyInit,
      StateInit extends StatechartInit,
      SubstateName extends string,
      SubstateFactory
    > = SubstateFactory extends Factories.Factory<infer State>
      ? State extends State
        ? State extends {
            name: infer FinalName extends string;
            final: true;
            context: infer FinalContext extends Contexts.Constraint | null;
          }
          ? CompatibleInitWithSubstateFinalTransition<
              StatechartInit,
              StateInit,
              FinalContext
            > extends infer StateInit extends States.AnyInit
            ? Substates.SubstateFinalTransitionDef<
                SubstateName,
                StateInit["name"],
                FinalName,
                string
              >
            : never
          : never
        : never
      : never;

    /**
     * Resolves state inits compatible for a substate final transition binding.
     */
    export type CompatibleInitWithSubstateFinalTransition<
      StatechartInit extends States.AnyInit,
      StateInit extends StatechartInit,
      FinalContext extends Contexts.Constraint | null
    > = StatechartInit extends StatechartInit
      ? StatechartInit["context"] extends null
        ? StatechartInit
        : true extends Utils.Compare<
            Contexts.Intersect<StateInit["context"], FinalContext>,
            StatechartInit["context"]
          >
        ? StatechartInit
        : never
      : never;

    /**
     * Resolves the state transitions with the given event name.
     */
    export type ByEventName<State, EventName> = State extends {
      transitions: Array<infer Transition>;
    }
      ? Transition extends { event: EventName }
        ? Transition
        : never
      : never;
  }
  //#endregion

  //#region States
  export namespace States {
    export type AnyInit = Init<string, Contexts.Constraint | null>;

    export interface Init<
      Name extends string,
      Context extends Contexts.Constraint | null
    > {
      name: Name;
      context: Context;
    }

    /**
     * Filters out the state init by the state name.
     */
    export type FilterInit<Init, Name> = Init extends { name: Name }
      ? Init
      : never;

    export type NormalizeInit<StateInit extends AnyInit | string> =
      | Extract<StateInit, AnyInit>
      | (Extract<StateInit, string> extends infer Name extends string
          ? Name extends Name
            ? { name: Name; context: null }
            : never
          : never);

    export interface State<
      StateName,
      Action,
      Transition,
      Substates,
      Final,
      Context
    > {
      name: StateName;
      actions: Action[];
      transitions: Transition[];
      sub: Substates;
      final: Final;
      context: Context;
    }

    /**
     * The state def. Unions transition and action defs
     */
    export type Def<StateName extends string> =
      | Transitions.Def<StateName>
      | Actions.Def;

    /**
     * The state type placeholder. It's used where the shape of a state isn't
     * important or known.
     */
    export type AnyState = State<any, any, any, any, any, any>;

    export type BuilderStateToInstance<State extends AnyState> = State extends {
      sub: Substates.BuilderSubstatesMap<infer Substate>;
    }
      ? State & { sub: Substates.InstanceSubstatesMap<Substate> }
      : never;

    export type BuilderState = State<
      any,
      any,
      any,
      Substates.BuilderSubstatesMap<any>,
      any,
      any
    >;

    /**
     * Filters out the state by the state name.
     */
    export type FilterState<State, Name> = State extends { name: Name }
      ? State
      : never;
  }
  //#endregion

  //#region Builder
  /**
   * Builder namespace. Contains all the types related to the statechart builder
   * that creates the statechart instance.
   */
  export namespace Builder {
    export interface Machine {
      <StateInit extends States.AnyInit | string>(name: string): Head<
        States.NormalizeInit<StateInit>
      >;
    }

    export interface Head<StateInit extends States.AnyInit> {
      state: StateFn<true, false, StateInit>;
    }

    /**
     * @typedef StatechartInit - Union of all statechart state inits
     * @typedef ChainStateInit - Union of remaining state inits to be processed
     * @typedef Statechart - Union of all statechart states accumulated by the chain
     */
    export interface Tail<
      StatechartInit extends States.AnyInit,
      ChainStateInit extends StatechartInit = StatechartInit,
      Statechart extends States.AnyState = never
    > {
      state: StateFn<false, false, StatechartInit, ChainStateInit, Statechart>;

      final: StateFn<false, true, StatechartInit, ChainStateInit, Statechart>;
    }

    export interface StateFnGeneratorBuilder<
      StatechartInit extends States.AnyInit,
      StateInit extends StatechartInit,
      Action extends Actions.Action = never,
      TransitionDef extends Transitions.Def<StatechartInit["name"]> = never,
      Substate extends Substates.AnySubstate = never
    > {
      enter<ActionNameDef extends Actions.NameDef>(
        name: ActionNameDef
      ): StateFnGeneratorBuilder<
        StatechartInit,
        StateInit,
        Action | Actions.FromNameDef<"enter", ActionNameDef>,
        TransitionDef,
        Substate
      >;

      exit<NameDef extends Actions.NameDef>(
        name: NameDef
      ): StateFnGeneratorBuilder<
        StatechartInit,
        StateInit,
        Action | Actions.FromNameDef<"exit", NameDef>,
        TransitionDef,
        Substate
      >;

      on<Def extends Transitions.Def<StatechartInit["name"]>>(
        transitions: Def[] | Def
      ): StateFnGeneratorBuilder<
        StatechartInit,
        StateInit,
        Action,
        TransitionDef | Def,
        Substate
      >;

      if<
        EventName extends string,
        Def extends Transitions.CaseDef<StatechartInit["name"]>
      >(
        name: EventName,
        cases: Def[] | Def
      ): StateFnGeneratorBuilder<
        StatechartInit,
        StateInit,
        Action,
        | TransitionDef
        | Transitions.CaseDefToDef<StatechartInit, EventName, Def>,
        Substate
      >;

      sub<
        SubstateName extends string,
        SubstateFactory extends Factories.AnyFactory,
        TrasitionDef extends Transitions.SubstateTransitionDef<
          StatechartInit,
          StateInit,
          SubstateName,
          SubstateFactory
        > = never
      >(
        name: SubstateName,
        factory: SubstateFactory,
        defs?: TrasitionDef | TrasitionDef[]
      ): StateFnGeneratorBuilder<
        StatechartInit,
        StateInit,
        Action,
        TransitionDef,
        | Substate
        | Substates.Substate<
            SubstateName,
            SubstateFactory,
            Substates.SubstateFinalTransitionFromDef<
              StatechartInit,
              TrasitionDef
            >
          >
      >;
    }

    type ArayOrItem<Type> = Type | Type[];

    export interface StateGenerator<
      StatechartInit extends States.AnyInit,
      StateInit extends StatechartInit,
      Action extends Actions.Action,
      TransitionDef extends Transitions.Def<StatechartInit["name"]> = never,
      Substate extends Substates.AnySubstate = never
    > {
      (
        $: StateFnGeneratorBuilder<StatechartInit, StateInit>
      ): StateFnGeneratorBuilder<
        StatechartInit,
        StateInit,
        Action,
        TransitionDef,
        Substate
      >;
    }

    export type StateFnResult<
      StatechartInit extends States.AnyInit,
      ChainStateInit extends StatechartInit,
      Statechart extends States.AnyState,
      StateName extends ChainStateInit["name"],
      StateAction extends Actions.Action,
      StateDef extends States.Def<StatechartInit["name"]>,
      Substate extends Substates.AnySubstate,
      Initial extends boolean,
      Final extends boolean
    > = States.FilterInit<
      ChainStateInit,
      StateName
    > extends infer StateInit extends ChainStateInit
      ? Exclude<ChainStateInit, StateInit> extends never
        ? Factories.Factory<
            States.BuilderStateToInstance<
              | Statechart
              | State<
                  StatechartInit,
                  StateInit,
                  StateAction,
                  StateDef,
                  Substate,
                  Initial,
                  Final
                >
            >
          >
        : Tail<
            StatechartInit,
            Exclude<ChainStateInit, StateInit>,
            | Statechart
            | State<
                StatechartInit,
                StateInit,
                StateAction,
                StateDef,
                Substate,
                Initial,
                Final
              >
          >
      : never;

    /**
     * Builder state. It constructs the state object from the builder chain
     * types.
     */
    export type State<
      StatechartInit extends States.AnyInit,
      StateInit extends StatechartInit,
      StateAction extends Superstate.Actions.Action,
      StateDef_ extends Superstate.States.Def<StatechartInit["name"]>,
      Substate extends Substates.AnySubstate,
      Initial extends boolean,
      Final extends boolean
    > = {
      name: StateInit["name"];
      actions: Array<
        | (StateDef_ extends Superstate.Actions.Def
            ? Superstate.Actions.FromDef<StateDef_>
            : never)
        | StateAction
      >;
      transitions: Transitions.FromDef<
        StatechartInit,
        StateInit,
        StateDef_ extends Transitions.EventDef<any, any, any>
          ? StateDef_
          : never
      >[];
      sub: Substates.BuilderSubstatesMap<Substate>;
      initial: Initial;
      final: Final;
      context: StateInit["context"];
    };

    export interface StateFn<
      Initial extends boolean,
      Final extends boolean,
      StatechartInit extends States.AnyInit,
      ChainStateInit extends StatechartInit = StatechartInit,
      Statechart extends States.AnyState = never
    > {
      <StateName extends ChainStateInit["name"]>(
        name: StateName
      ): StateFnResult<
        StatechartInit,
        ChainStateInit,
        Statechart,
        StateName,
        never,
        never,
        never,
        Initial,
        Final
      >;

      <
        StateName extends ChainStateInit["name"],
        StateAction extends Actions.Action,
        TransitionDef extends Transitions.Def<StatechartInit["name"]>,
        Substate extends Substates.AnySubstate,
        Context
      >(
        name: StateName,
        generator: StateGenerator<
          StatechartInit,
          States.FilterInit<StatechartInit, StateName>,
          StateAction,
          TransitionDef,
          Substate
        >
      ): StateFnResult<
        StatechartInit,
        ChainStateInit,
        Statechart,
        StateName,
        StateAction,
        TransitionDef,
        Substate,
        Initial,
        Final
      >;

      <
        Name extends ChainStateInit["name"],
        Def extends States.Def<StatechartInit["name"]>
      >(
        name: Name,
        transitions: Def | Def[]
      ): StateFnResult<
        StatechartInit,
        ChainStateInit,
        Statechart,
        Name,
        never,
        Def,
        never,
        Initial,
        Final
      >;

      <
        StateName extends ChainStateInit["name"],
        StateAction extends Actions.Action,
        StateDef extends States.Def<StatechartInit["name"]>,
        TransitionDef extends Transitions.Def<StatechartInit["name"]>,
        Substate extends Substates.AnySubstate
      >(
        name: StateName,
        transitions: StateDef | StateDef[],
        generator: StateGenerator<
          StatechartInit,
          States.FilterInit<StatechartInit, StateName>,
          StateAction,
          TransitionDef,
          Substate
        >
      ): StateFnResult<
        StatechartInit,
        ChainStateInit,
        Statechart,
        StateName,
        StateAction,
        StateDef | TransitionDef,
        Substate,
        Initial,
        Final
      >;
    }
  }
  //#endregion

  //#region Factories
  /**
   * The factories namespace. It contains all the types related to factories,
   * the entity that creates statechart instances.
   */
  export namespace Factories {
    /**
     * The factory type placeholder. It's used where the shape of
     * a factory isn't important or known.
     */
    export type AnyFactory = Factory<any>;

    export interface Factory<State extends States.AnyState> {
      /** The statechart name. Used for visualization and debugging. */
      name: string;

      /** The available states. */
      states: State[];

      host(
        ...args: Superstate.Actions.BindingsArgs<State>
      ): Instances.Instance<State, Traits.Traits<State>, never>;
    }
  }
  //#endregion

  //#region Instances
  /**
   * Instances namespace. Contains all the types related to hosted statechart
   * instances. Such as functions, return types, the instance itself, etc.
   */
  export namespace Instances {
    export interface Instance<
      Statechart extends States.AnyState,
      Traits extends Traits.TraitsConstraint,
      AsSubstate
    > extends Listeners.API<Statechart, Traits> {
      readonly sub: AsSubstate;

      readonly state: Statechart;

      readonly finalized: boolean;

      in<Target extends Targets.State<Traits["state"]>>(
        target: Target | Target[]
      ): Targets.MatchState<Traits["state"], Target> | undefined;
    }
  }
  //#endregion

  //#region Listeners
  /**
   * Listeners namespace. It contains all the types related to listeners,
   * the {@link Instances} event system.
   */
  export namespace Listeners {
    /**
     * Instances API. Provides functions to subscribe, send, and unsubscribe
     * from events and state updates.
     */
    export interface API<
      Statechart extends States.AnyState,
      Traits extends Traits.TraitsConstraint
    > {
      on: Listeners.On<Traits>;

      send: Listeners.SendProxy<Traits>;

      off(): void;
    }

    /**
     * Function returned from the subscription function.
     */
    export interface Off {
      (): void;
    }

    //#region Listeners/on

    /**
     * Function that subscribes to event and state updates.
     */
    export interface On<Traits extends Traits.TraitsConstraint> {
      <Target extends Targets.On<Traits>>(
        target: Target | Target[],
        listener: OnListener<Traits, Target>
      ): Off;
    }

    /**
     * Listener function that is triggered on the event or state update.
     */
    export interface OnListener<
      Traits extends Traits.TraitsConstraint,
      Target extends Targets.On<Traits> // [TODO] Simplify it
    > {
      (
        target: Target extends "**"
          ? Updates.DeepWildcardUpdate<Traits>
          : Target extends Targets.WildcardConstraint
          ? Updates.WildcardUpdate<Traits["state"], Traits["event"], Target>
          : Target extends
              | Array<infer TargetString extends string>
              | infer TargetString extends string
          ? Targets.MatchState<
              Traits["state"],
              TargetString
            > extends infer MatchedState
            ? Targets.MatchEvent<
                Traits["event"],
                TargetString
              > extends infer MatchedEvent
              ?
                  | (MatchedState extends { name: string }
                      ? Updates.StateUpdate<MatchedState>
                      : never)
                  | (MatchedEvent extends never
                      ? never
                      : Updates.EventUpdate<MatchedEvent>)
              : never
            : never
          : never
      ): void;
    }

    //#endregion

    //#region Listeners/send

    /**
     * Function that sends events.
     */
    export type SendProxy<Traits extends Traits.TraitsConstraint> = {
      [Namespace in keyof Traits["send"]]: Traits["send"][Namespace] extends infer SendTrait
        ? SendTrait extends Traits.SendConstraintEvent
          ? () => SendTrait["next"] | null
          : never
        : never;

      // <
      //   Send extends Event extends {
      //     send: infer Send extends string;
      //     context: Contexts.Constraint;
      //   }
      //     ? Send
      //     : never,
      //   FromState extends Event extends {
      //     send: Send;
      //     from: infer FromState;
      //   }
      //     ? FromState
      //     : never,
      //   Context extends Event extends {
      //     send: Send;
      //     context: infer Context;
      //   }
      //     ? Context
      //     : never
      // >(
      //   event: Send,
      //   context: {
      //     [Key in any]: Key extends keyof Context ? Context[Key] : never;
      //   }
      // ): Event extends {
      //   send: Send;
      //   context: Context;
      //   next: infer Next;
      // }
      //   ? Next | null
      //   : never;

      // //   <
      // //   Send extends Event extends {
      // //     send: infer Send extends string;
      // //     context: Contexts.Constraint;
      // //   }
      // //     ? Send
      // //     : never,
      // //   FromState extends Event extends {
      // //     send: Send;
      // //     from: infer FromState;
      // //   }
      // //     ? FromState
      // //     : never,
      // //   Context extends Event extends {
      // //     send: Send;
      // //     context: infer Context;
      // //   }
      // //     ? Context
      // //     : never,
      // //   ContextArg extends Contexts.ContextArg<
      // //     ReceivedContext,
      // //     FromState["context"]
      // //   >
      // // >(
      // //   event: Send,
      // //   context: NoInfer<Context>
      // // ): Event extends {
      // //   send: Send;
      // //   context: Context;
      // //   next: infer Next;
      // // }
      // //   ? Next | null
      // //   : never;

      // <
      //   Send extends Event extends {
      //     send: infer Send extends string;
      //     context: null;
      //   }
      //     ? Send
      //     : never
      // >(
      //   event: Send
      // ): Event extends { send: Send; next: infer Next } ? Next | null : never;
    };

    //#endregion
  }
  //#endregion

  //#region Targets
  /**
   * Targets namespace. It contains all the types related to targets, the string
   * representation of the state or events.
   */
  export namespace Targets {
    /**
     * String representing listener target.
     */
    export type On<Traits extends Traits.TraitsConstraint> =
      | "*"
      | (true extends Traits["state"]["nested"] ? "**" : never)
      | State<Traits["state"]>
      | Traits["state"]["wildcard"]
      | Event<Traits["event"]>;

    /**
     * String representing state.
     */
    export type State<FlatState extends Traits.StateConstraint> =
      FlatState["key"];

    /**
     * String representing event.
     */
    export type Event<FlatEvent extends Traits.EventConstraint> =
      FlatEvent extends {
        key: infer Key extends string;
        condition: infer Condition extends string | null;
      }
        ? `${Key}(${Condition extends null ? "" : Condition})`
        : never;

    /**
     * Matches the target state.
     */
    export type MatchState<
      FlatState extends Traits.StateConstraint,
      Target extends string
    > = FlatState extends { key: Target } ? FlatState["state"] : never;

    /**
     * Matches the target event.
     */
    export type MatchEvent<
      FlatEvent extends Traits.EventConstraint,
      Target
    > = Target extends `${infer Key}()`
      ? FlatEvent extends { key: Key }
        ? FlatEvent["transition"]
        : never
      : never;

    /**
     * String constraint for wildcard targets.
     */
    export type WildcardConstraint = `${string}*`;
  }
  //#endregion

  //#region Updates
  /**
   * Updates namespaces. It contains all the types related to updates,
   * the entity representing the listener payload that is sent during
   * transitions.
   */
  export namespace Updates {
    export type DeepWildcardUpdate<Traits extends Traits.TraitsConstraint> =
      | StateUpdate<Traits["state"]["state"]>
      | EventUpdate<Traits["event"]["transition"]>;

    export type WildcardUpdate<
      State extends Traits.StateConstraint,
      Event extends Traits.EventConstraint,
      Target extends Targets.WildcardConstraint
    > =
      | (State extends { wildcard: Target }
          ? StateUpdate<State["state"]>
          : never)
      | (Event extends { wildcard: Target }
          ? EventUpdate<Event["transition"]>
          : never);

    export interface StateUpdate<_State extends { name: string }> {
      type: "state";
      state: _State;
    }

    export interface EventUpdate<Transition> {
      type: "event";
      transition: Transition;
    }
  }
  //#endregion

  //#region Substates
  /**
   * The substates namespace. It contains all the types related to substates,
   * the entity that represents a nested statechart relation to the parent.
   */
  export namespace Substates {
    export type AnySubstate = Substate<any, any, any>;

    /**
     * Substate type.
     */
    export interface Substate<Name, Factory, Transition> {
      name: Name;
      factory: Factory;
      transitions: Transition[];
    }

    export type BuilderSubstatesMap<Substate extends AnySubstate> = Record<
      Substate["name"],
      Substate
    >;

    export type InstanceSubstatesMap<Substate extends AnySubstate> = {
      [Name in Substate["name"]]: Substate extends {
        name: Name;
        factory: infer Factory;
      }
        ? Factory extends Factories.Factory<infer SubstateState>
          ? Instances.Instance<
              SubstateState,
              Traits.Traits<SubstateState>,
              Substate
            >
          : never
        : never;
    };

    /**
     * Final transition type placeholder. It's used where the shape of
     * a final transition isn't important or known.
     */
    export type AnyFinalTransition = FinalTransition<any, any, any>;

    /**
     * Transition from a final substate state to the parent statechart state.
     */
    export interface FinalTransition<
      EventName extends string,
      ChildFromStateName extends string,
      MachineToStateName extends string
    > {
      event: EventName;
      from: ChildFromStateName;
      to: MachineToStateName;
      condition: null;
    }

    /**
     * String representation of the final substate transition.
     */
    export type SubstateFinalTransitionDef<
      SubstateName extends string,
      ParentToStateName extends string,
      ChildFinalStateName extends string,
      TransitionName extends string
    > = `${SubstateName}.${ChildFinalStateName} -> ${TransitionName}() -> ${ParentToStateName}`;

    /**
     * Constructs the final substate transition from the transition def.
     */
    export type SubstateFinalTransitionFromDef<
      StatechartInit extends States.AnyInit,
      Def extends SubstateFinalTransitionDef<any, any, any, any>
    > = Def extends `${string}.${infer ChildFromStateName} -> ${infer EventName}() -> ${infer ParentToStateName}`
      ? {
          event: EventName;
          from: ChildFromStateName;
          to: ParentToStateName;
          condition: null;
          context: States.FilterInit<
            StatechartInit,
            ParentToStateName
          >["context"];
        }
      : never;

    export type Parents<State extends States.AnyState> = State extends {
      sub: infer Substates;
    }
      ? keyof Substates extends never
        ? never
        : State
      : never;
  }
  //#endregion

  //#region Traits
  /**
   * Trains namespaces. It contains all the types related to traits, statechart
   * traits that define the behavior of the statechart: available states,
   * events, their properties. They simplify types by flattening the source
   * statechart definition.
   */
  export namespace Traits {
    export interface EventConstraint {
      key: string;
      wildcard: Targets.WildcardConstraint;
      send: string | null;
      condition: string | null;
      final: boolean;
      from: States.AnyState;
      next: States.AnyState;
      transition: Transitions.AnyTransition | Substates.AnyFinalTransition;
      nested: boolean;
      context: Contexts.Constraint | null;
    }

    export interface StateConstraint {
      key: string;
      wildcard: Targets.WildcardConstraint;
      state: States.AnyState;
      nested: boolean;
    }

    export interface TransitionConstraint {
      transition: Transitions.AnyTransition;
      from: States.AnyState;
      next: States.AnyState;
      context: Contexts.Constraint | null;
    }

    export type SendConstraint = Record<
      string,
      SendConstraintEvent | SendConstraintState
    >;

    export interface SendConstraintBase<Type extends string> {
      type: Type;
      namespace: string;
    }

    export interface SendConstraintEvent extends SendConstraintBase<"event"> {
      condition: string | null;
      next: States.AnyState;
    }

    export interface SendConstraintState extends SendConstraintBase<"state"> {}

    export interface TraitsConstraint {
      state: StateConstraint;
      event: EventConstraint;
      send: SendConstraint;
    }

    export interface Traits<Statechart extends States.AnyState> {
      state: State<Statechart>;
      event: Event<Statechart>;
      send: Send<Statechart>;
    }

    export type Event<
      Statechart extends States.AnyState,
      Prefix extends string | "" = ""
    > =
      // First we get the root level events
      | (Transition<Statechart> extends infer Transition extends TransitionConstraint
          ? Transition extends Transition
            ? {
                key: `${Prefix}${Transition["transition"]["event"]}`;
                wildcard: `${Prefix}*`;
                send: `${Prefix}${Transition["transition"]["event"]}(${Transition["transition"]["condition"] extends string
                  ? Transition["transition"]["condition"]
                  : ""})${Transition["context"] extends null
                  ? ""
                  : ` -> ${Prefix extends ""
                      ? ""
                      : "."}${Transition["next"]["name"]}`}`;
                condition: Transition["transition"]["condition"];
                transition: Transition["transition"];
                from: Transition["from"];
                next: Transition["next"];
                final: false;
                nested: Prefix extends "" ? false : true;
                context: Transition["context"];
              }
            : never
          : never)
      // Now we add the substate events
      | (Statechart extends {
          name: infer StateName extends string;
          sub: infer Substates extends Record<string, any>;
        }
          ? // [NOTE] Here we prevent the infinite recursion when Substates is
            // unknown and keyof Substates resolves to `string | number | symbol`:
            // > Type instantiation is excessively deep and possibly infinite.
            keyof Substates extends infer SubstateName extends string
            ? SubstateName extends SubstateName
              ? Substates[SubstateName] extends {
                  sub: {
                    transitions: Array<
                      infer FinalTransition extends Substates.AnyFinalTransition
                    >;
                  };
                  state: infer SubstateState extends States.AnyState;
                }
                ?
                    | Event<
                        SubstateState,
                        `${Prefix}${StateName}.${SubstateName}.`
                      >
                    // Add final transitions
                    | (FinalTransition extends {
                        event: infer EventName extends string;
                      }
                        ? Transitions.MatchNextState<
                            Statechart,
                            EventName,
                            null
                          > extends infer NextState
                          ? {
                              key: `${Prefix}${EventName}`;
                              wildcard: `${Prefix}*`;
                              send: null;
                              condition: null;
                              transition: FinalTransition;
                              from: States.FilterState<Statechart, StateName>;
                              next: NextState;
                              final: true;
                              nested: true;
                              context: null;
                            }
                          : never
                        : never)
                : never
              : never
            : never
          : never);

    export type State<
      Statechart extends States.AnyState,
      Prefix extends string | "" = ""
    > =
      // First we get the root level states
      | (Statechart extends {
          name: infer Name extends string;
        }
          ? {
              key: `${Prefix}${Name}`;
              wildcard: `${Prefix}*`;
              state: Statechart;
              nested: Prefix extends "" ? false : true;
            }
          : never)
      // Now we add the substates
      | (Statechart extends {
          name: infer StateName extends string;
          sub: infer Substates extends Record<string, any>;
        }
          ? // Here we prevent the infinite recursion when Substates is uknown and
            // keyof Substates resolves to `string | number | symbol`:
            // > Type instantiation is excessively deep and possibly infinite.
            keyof Substates extends string
            ? {
                [SubstateName in keyof Substates]: Substates[SubstateName] extends {
                  state: infer SubstateState extends States.AnyState;
                }
                  ? SubstateName extends string
                    ? State<
                        SubstateState,
                        `${Prefix}${StateName}.${SubstateName}.`
                      >
                    : never
                  : never;
              }[keyof Substates]
            : never
          : never);

    export type Transition<State extends States.AnyState> =
      Transitions.FromState<State> extends infer Transition extends Transitions.AnyTransition
        ? Transition extends Transition
          ? States.FilterState<
              State,
              Transition["to"]
            > extends infer NextState extends States.AnyState
            ? {
                transition: Transition;
                from: States.FilterState<State, Transition["from"]>;
                next: NextState;
                context: NextState["context"];
              }
            : never
          : never
        : never;

    export type Send<State extends States.AnyState> = {
      [Namespace in Events.Name<State> | Substates.Parents<State>["name"]]:
        | (Transitions.ByEventName<
            // Assign event function
            State,
            Namespace
          > extends {
            condition: infer Condition extends string | null;
            to: infer To;
          }
            ? State extends { name: To }
              ? {
                  type: "event";
                  namespace: Namespace;
                  condition: Condition;
                  next: State;
                }
              : never
            : never)
        // Assign substates
        | (Substates.Parents<State> extends { name: Namespace }
            ? // [TODO] Add substates and their events
              { type: "state"; namespace: Namespace }
            : never);
    };
  }

  //#endregion

  //#region Contexts
  /**
   * The contexts namespace. It contains all the types related to contexts,
   * the entity that represents the freeform data passing from state to state.
   */
  export namespace Contexts {
    /**
     * Context constraint.
     */
    export type Constraint = Record<string, any>;

    /**
     * Resolves true if the state has initial context.
     */
    export type HasInitialContext<State> = State extends {
      sub: infer Substates;
    }
      ? // Is there an initial context?
        | (InitialContext<State> extends never ? false : true)
          // Are there any substates with initial context?
          | (keyof Substates extends never
              ? false
              : Substates[keyof Substates] extends {
                  state: infer SubstateState;
                }
              ? HasInitialContext<SubstateState>
              : never)
      : never;

    /**
     * Resolves the initial state context.
     */
    export type InitialContext<State> = State extends {
      initial: true;
      context: infer Context;
    }
      ? Context extends never
        ? never
        : keyof Context extends never
        ? never
        : Context
      : never;

    /**
     * Minimal context required when transitioning from one state to another.
     */
    export type MinimalContext<Context, FromContext> = Context extends never
      ? never
      : Pick<Context, RequiredKeys<Context, FromContext>> &
          Partial<Omit<Context, RequiredKeys<Context, FromContext>>>;

    /**
     * Context keys required when transitioning from one state to another.
     */
    export type RequiredKeys<Context, FromContext> = Exclude<
      {
        [Key in keyof Context]: Key extends keyof FromContext
          ? FromContext[Key] extends Context[Key]
            ? never
            : Key
          : Key;
      }[keyof Context],
      undefined
    >;

    /**
     * Intersects two context types.
     */
    export type Intersect<ContextA, ContextB> = EnsureObject<ContextA> &
      EnsureObject<ContextB>;

    /**
     * Resolves context object.
     */
    export type EnsureObject<Context> = Context extends null ? {} : Context;

    export type ContextArg<Context, PrevContext> =
      | Context
      | ContextArgFn<Context, PrevContext>;

    export type ContextArgFn<Context, PrevContext> = (
      updater: ContextUpdater<Context>,
      context: PrevContext
    ) => ExactContext<Context>;

    export type ContextUpdater<Context> = (
      context: Context
    ) => ExactContext<Context>;

    export type ExactContext<Context> = Context & {
      [exactContextBrand]: Context;
    };

    export declare const exactContextBrand: unique symbol;
  }
  //#endregion

  //#region Utils
  /**
   * Utils namespace. Contains everything that is not directly related to
   * the core types.
   */
  export namespace Utils {
    /**
     * Omits never fields.
     */
    export type OmitNever<Type> = Pick<
      Type,
      { [Key in keyof Type]: Type[Key] extends never ? never : Key }[keyof Type]
    >;

    /**
     * Resolves required keys.
     */
    export type RequiredKeys<Type> = Type extends Type
      ? Exclude<
          {
            [Key in keyof Type]: Type[Key] extends never
              ? never
              : RequiredKey<Type, Key> extends true
              ? Key
              : never;
          }[keyof Type],
          undefined
        >
      : never;

    /**
     * Resolves true if the passed key is a required field of the passed model.
     */
    export type RequiredKey<Model, Key extends keyof Model> = StaticKey<
      Model,
      Key
    > extends true
      ? Partial<Pick<Model, Key>> extends Pick<Model, Key>
        ? false
        : true
      : false;

    /**
     * Resolves true if the given key is statically defined in the given type.
     */
    export type StaticKey<
      Model,
      Key extends keyof Model
    > = Key extends keyof WithoutIndexed<Model> ? true : false;

    /**
     * Removes indexed fields leaving only statically defined.
     */
    export type WithoutIndexed<Model> = {
      [Key in keyof Model as string extends Key
        ? never
        : number extends Key
        ? never
        : symbol extends Key
        ? never
        : Key]: Model[Key];
    };

    /**
     * Resolves union keys.
     */
    export type UnionKeys<Type> = Exclude<
      Type extends Type ? keyof Type : never,
      undefined
    >;

    /**
     * Resolves union value.
     */
    export type UnionValue<
      Type,
      UnionKey extends UnionKeys<Type>
    > = Type extends {
      [Key in UnionKey]: unknown;
    }
      ? Type[UnionKey]
      : never;

    /**
     * Version of {@link Pick} that works with union types.
     */
    export type UnionPick<Type, Keys extends string | number | symbol> = {
      [Key in Extract<UnionKeys<Type>, Keys>]: UnionValue<Type, Key>;
    };

    /**
     * Resolves true if both types are equal.
     * Source: https://github.com/microsoft/TypeScript/issues/48100#issuecomment-1193266100
     */
    export type Compare<TypeA, TypeB> = (<T>() => T extends Simplify<TypeA>
      ? 1
      : 2) extends <T>() => T extends Simplify<TypeB> ? 1 : 2
      ? true
      : false;

    /**
     * Simplifies the type. Required for {@link Compare}.
     * See: https://github.com/microsoft/TypeScript/issues/48100#issuecomment-1193266100
     */
    export type Simplify<Type> = Type extends Record<any, unknown>
      ? { [Key in keyof Type]: Simplify<Type[Key]> }
      : Type;
  }
  //#endregion
}
