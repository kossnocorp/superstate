/**
 * The root Superstate namespace. It contains all the Superstate types.
 */
export namespace Superstate {
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

    /**
     * The binding function type.
     */
    export type BindingFn = () => void;

    /**
     * The type resolves arguments for the binding functions to actions. It's
     * used to create a host.
     */
    export type BindingArgs<State extends { name: string }> =
      true extends HasBindingArgs<State>
        ? Binding<State> extends infer Binding_ extends BindingConstraint
          ? BindingMap<
              Contexts.InitialContext<State>,
              Binding_
            > extends infer Map
            ?
                | [Map]
                | ("context" extends keyof Map
                    ? Utils.RequiredKeys<Map["context"]> extends never
                      ? [] | [{}]
                      : never
                    : never)
            : never
          : never
        : [];

    export type HasBindingArgs<State> = true extends IsActionable<State>
      ? true
      : true extends Contexts.HasInitialContext<State>
      ? true
      : false;

    export type BindingMap<
      InitialContext,
      Binding_ extends BindingConstraint
    > = Utils.OmitNever<
      { context: InitialContext } & {
        [StateName in Binding_["state"]]: {
          [Key in Binding_ extends { state: StateName }
            ? Binding_["key"]
            : never]: Binding_ extends {
            sub: infer SubstateBinding extends BindingConstraint;
          }
            ? BindingMap<never, SubstateBinding>
            : BindingFn;
        };
      }
    >;

    /**
     * The binding constrain type.
     */
    export type BindingConstraint =
      | BindingConstraintAction
      | BindingConstraintSubstate;

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
     * Resolves action bindings.
     */
    export type Binding<State extends { name: string }> = State extends {
      name: infer StateName;
      actions: Array<infer Action>;
      transitions: Array<infer Transition>;
      sub: Record<string, infer Substate>;
    }
      ? // Get all state actions

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
              ? true extends IsActionable<SubstateState>
                ? {
                    key: SubstateName;
                    state: StateName;
                    sub: Binding<SubstateState>;
                  }
                : never
              : never)
      : never;

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
    // [TODO] Move stuff from Transitions
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
    export type AnyTransition = Transition<any, any, any, any, any>;

    export interface Transition<
      EventName,
      FromStateName,
      ToStateName,
      Condition,
      Action
    > {
      event: EventName;
      condition: Condition;
      from: FromStateName;
      to: ToStateName;
      action: Action;
    }

    /**
     * Any transition def.
     */
    export type Def<MachineStateName extends string> =
      | EventDef<MachineStateName>
      | EventDefWithAction<MachineStateName>;

    /**
     * Event string definition. Describes the event that triggers
     * the transition, the condition and the next state.
     */
    export type EventDef<
      MachineStateName extends string,
      EventName extends string = string,
      Condition extends string | "" = string | ""
    > = `${EventName}(${Condition}) -> ${MachineStateName}`;

    /**
     * The transition def with action.
     */
    export type EventDefWithAction<
      MachineStateName extends string,
      EventName extends string = string,
      Condition extends string | "" = string | "",
      Action extends string = string
    > = `${EventName}(${Condition}) -> ${Action}! -> ${MachineStateName}`;

    /**
     * Ant transition case def.
     */
    export type CaseDef<MachineStateName extends string> =
      | EventCaseDef<MachineStateName>
      | EventCaseDefWithAction<MachineStateName>;

    /**
     * The transition case def.
     */
    export type EventCaseDef<
      MachineStateName extends string,
      Condition extends string | "" = string | ""
    > = `(${Condition}) -> ${MachineStateName}`;

    /**
     * The transition case def.
     */
    export type EventCaseDefWithAction<
      MachineStateName extends string,
      Condition extends string | "" = string | "",
      Action extends string = string
    > = `(${Condition}) -> ${Action}! -> ${MachineStateName}`;

    /**
     * Resolves the event case def to the event def.
     */
    export type CaseDefToDef<
      MachineStateName extends string,
      EventName extends string,
      Def_ extends CaseDef<MachineStateName>
    > = Def_ extends Def_
      ? // [TODO] Try to optimize it to `${EventName}${Def}`
        Def_ extends EventCaseDef<
          infer ToState extends MachineStateName,
          infer Condition
        >
        ? `${EventName}(${Condition}) -> ${ToState}`
        : Def_ extends EventCaseDefWithAction<
            infer ToState extends MachineStateName,
            infer Condition,
            infer Action
          >
        ? `${EventName}(${Condition}) -> ${Action}! -> ${ToState}`
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
      MachineStateName extends string,
      FromStateName extends MachineStateName,
      Def_ extends Def<MachineStateName>
    > = Def_ extends EventDef<
      infer ToStateName extends MachineStateName,
      infer EventName,
      infer Condition
    >
      ? Transition<
          EventName,
          FromStateName,
          ToStateName,
          Condition extends "" ? null : Condition,
          null
        >
      : Def_ extends Transitions.EventDefWithAction<
          infer ToStateName extends MachineStateName,
          infer EventName,
          infer Condition,
          infer Action
        >
      ? Transition<
          EventName,
          FromStateName,
          ToStateName,
          Condition extends "" ? null : Condition,
          { type: "transition"; name: Action }
        >
      : never;

    /**
     * Resolves the next state for the transition.
     */
    export type MatchNextState<
      MachineState extends States.AnyState, // [TODO] Cut it
      EventName,
      EventCondition extends string | null
    > = MachineState extends {
      transitions: Array<{
        event: EventName;
        condition: EventCondition;
        to: infer ToName;
      }>;
    }
      ? States.FilterState<MachineState, ToName>
      : never;

    /**
     * Resolves transition type from state.
     */
    export type FromState<State> = State extends {
      transitions: Array<infer Transition extends Transitions.AnyTransition>;
    }
      ? Transition
      : never;
  }
  //#endregion

  //#region States
  export namespace States {
    export interface State<StateName, Action, Transition, Substates_, Final> {
      name: StateName;
      actions: Action[];
      transitions: Transition[];
      sub: Substates_;
      final: Final;
    }

    /**
     * The state def.
     */
    export type Def<MachineStateName extends string> =
      | Transitions.Def<MachineStateName>
      | Actions.Def;

    /**
     * The state type placeholder. It's used where the shape of a state isn't
     * important or known.
     */
    export type AnyState = State<any, any, any, any, any>;

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
      <MachineStateName extends string>(name: string): Head<MachineStateName>;
    }

    export interface Head<
      MachineStateName extends string,
      ChainStateName extends MachineStateName = MachineStateName,
      MachineState extends States.AnyState = never
    > {
      state: StateFn<
        true,
        false,
        MachineStateName,
        ChainStateName,
        MachineState
      >;
    }

    export interface Tail<
      MachineStateName extends string,
      ChainStateName extends MachineStateName = MachineStateName,
      MachineState extends States.AnyState = never
    > {
      state: StateFn<
        false,
        false,
        MachineStateName,
        ChainStateName,
        MachineState
      >;

      final: StateFn<
        false,
        true,
        MachineStateName,
        ChainStateName,
        MachineState
      >;
    }

    export interface StateFnGeneratorBuilder<
      MachineStateName extends string,
      StateAction extends Actions.Action = never,
      StateTransitionDef extends Transitions.Def<MachineStateName> = never,
      Substate extends Substates.AnySubstate = never,
      Context = null
    > {
      context<AssignedContext>(): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction,
        StateTransitionDef,
        Substate,
        AssignedContext
      >;

      enter<ActionNameDef extends Actions.NameDef>(
        name: ActionNameDef
      ): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction | Actions.FromNameDef<"enter", ActionNameDef>,
        StateTransitionDef,
        Substate,
        Context
      >;

      exit<NameDef extends Actions.NameDef>(
        name: NameDef
      ): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction | Actions.FromNameDef<"exit", NameDef>,
        StateTransitionDef,
        Substate,
        Context
      >;

      on<Def extends Transitions.Def<MachineStateName>>(
        transitions: Def[] | Def
      ): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction,
        StateTransitionDef | Def,
        Substate,
        Context
      >;

      if<
        EventName extends string,
        Def extends Transitions.CaseDef<MachineStateName>
      >(
        name: EventName,
        cases: Def[] | Def
      ): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction,
        | StateTransitionDef
        | Transitions.CaseDefToDef<MachineStateName, EventName, Def>,
        Substate,
        Context
      >;

      sub<
        SubstateName extends string,
        SubstateFactory extends Factories.AnyFactory,
        TrasitionDef extends SubstateFactory extends Factories.MachineFactory<
          infer State
        >
          ? State extends { name: infer FinalName extends string; final: true }
            ? Substates.SubstateFinalTransitionDef<
                MachineStateName,
                FinalName,
                any
              >
            : never
          : never = never
      >(
        name: SubstateName,
        factory: SubstateFactory,
        defs?: TrasitionDef | TrasitionDef[]
      ): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction,
        StateTransitionDef,
        | Substate
        | Substates.Substate<
            SubstateName,
            SubstateFactory,
            Substates.SubstateFinalTransitionFromDef<TrasitionDef>
          >,
        Context
      >;
    }

    export interface StateFnGenerator<
      MachineStateName extends string,
      StateAction extends Actions.Action,
      StateTransitionDef extends Transitions.Def<MachineStateName> = never,
      Substate extends Substates.AnySubstate = never,
      Context = null
    > {
      ($: StateFnGeneratorBuilder<MachineStateName>): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction,
        StateTransitionDef,
        Substate,
        Context
      >;
    }

    export type BuilderChainResult<
      MachineStateName extends string,
      ChainStateName extends MachineStateName,
      MachineState extends States.AnyState,
      StateName extends ChainStateName,
      StateAction extends Actions.Action,
      StateDef_ extends States.Def<MachineStateName>,
      Substate extends Substates.AnySubstate,
      Initial extends boolean,
      Final extends boolean,
      Context
    > = Exclude<ChainStateName, StateName> extends never
      ? Factories.MachineFactory<
          States.BuilderStateToInstance<
            | MachineState
            | State<
                MachineStateName,
                StateName,
                StateAction,
                StateDef_,
                Substate,
                Initial,
                Final,
                Context
              >
          >
        >
      : Tail<
          MachineStateName,
          Exclude<ChainStateName, StateName>,
          | MachineState
          | State<
              MachineStateName,
              StateName,
              StateAction,
              StateDef_,
              Substate,
              Initial,
              Final,
              Context
            >
        >;

    /**
     * Builder state. It constructs the state object from the builder chain
     * types.
     */
    export type State<
      MachineStateName extends string,
      StateName extends MachineStateName,
      StateAction extends Superstate.Actions.Action,
      StateDef_ extends Superstate.States.Def<MachineStateName>,
      Substate extends Substates.AnySubstate,
      Initial extends boolean,
      Final extends boolean,
      Context
    > = {
      name: StateName;
      actions: Array<
        | (StateDef_ extends Superstate.Actions.Def
            ? Superstate.Actions.FromDef<StateDef_>
            : never)
        | StateAction
      >;
      transitions: Transitions.FromDef<
        MachineStateName,
        StateName,
        StateDef_ extends Transitions.EventDef<any, any, any>
          ? StateDef_
          : never
      >[];
      sub: Substates.BuilderSubstatesMap<Substate>;
      initial: Initial;
      final: Final;
      [Contexts.ContextBrand]: Context;
    };

    export interface StateFn<
      Initial extends boolean,
      Final extends boolean,
      MachineStateName extends string,
      ChainStateName extends MachineStateName = MachineStateName,
      MachineState extends States.AnyState = never
    > {
      <StateName extends ChainStateName>(name: StateName): BuilderChainResult<
        MachineStateName,
        ChainStateName,
        MachineState,
        StateName,
        never,
        never,
        never,
        Initial,
        Final,
        null
      >;

      <
        StateName extends ChainStateName,
        StateAction extends Actions.Action,
        StateTransitionDef extends Transitions.Def<MachineStateName>,
        Substate extends Substates.AnySubstate,
        Context
      >(
        name: StateName,
        generator: StateFnGenerator<
          MachineStateName,
          StateAction,
          StateTransitionDef,
          Substate,
          Context
        >
      ): BuilderChainResult<
        MachineStateName,
        ChainStateName,
        MachineState,
        StateName,
        StateAction,
        StateTransitionDef,
        Substate,
        Initial,
        Final,
        Context
      >;

      <
        StateName extends ChainStateName,
        StateDef_ extends States.Def<MachineStateName>
      >(
        name: StateName,
        transitions: StateDef_ | StateDef_[]
      ): BuilderChainResult<
        MachineStateName,
        ChainStateName,
        MachineState,
        StateName,
        never,
        StateDef_,
        never,
        Initial,
        Final,
        null
      >;

      <
        StateName extends ChainStateName,
        StateAction extends Actions.Action,
        StateDef extends States.Def<MachineStateName>,
        StateTransitionDef extends Transitions.Def<MachineStateName>,
        Substate extends Substates.AnySubstate,
        Context extends Contexts.Constraint | null = null
      >(
        name: StateName,
        transitions: StateDef | StateDef[],
        generator: StateFnGenerator<
          MachineStateName,
          StateAction,
          StateTransitionDef,
          Substate,
          Context
        >
      ): BuilderChainResult<
        MachineStateName,
        ChainStateName,
        MachineState,
        StateName,
        StateAction,
        StateDef | StateTransitionDef,
        Substate,
        Initial,
        Final,
        Context
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
    export type AnyFactory = MachineFactory<any>;

    export interface MachineFactory<State extends States.AnyState> {
      /** The statechart name. Used for visualization and debugging. */
      name: string;

      /** The available states. */
      states: State[];

      host(
        ...args: Superstate.Actions.BindingArgs<State>
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
      MachineState,
      Traits extends Traits.TraitsConstraint,
      AsSubstate
    > extends Listeners.API<Traits> {
      readonly sub: AsSubstate;

      readonly state: MachineState;

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
    export interface API<Traits extends Traits.TraitsConstraint> {
      on: Listeners.On<Traits>;

      send: Listeners.Send<SendSingature<Traits["event"]>>;

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
    export interface Send<Signature> {
      <
        S extends Signature extends {
          event: string;
          context: Contexts.Constraint;
        }
          ? Signature
          : never,
        Event extends S extends {
          event: infer Event;
          context: Contexts.Constraint;
        }
          ? Event
          : never,
        Context extends S extends {
          event: Event;
          context: infer Context;
        }
          ? Context
          : never
      >(
        event: Event,
        context: NoInfer<Context>
      ): S extends {
        event: Event;
        context: Context;
        return: infer Return;
      }
        ? Return
        : never;

      <
        S extends Signature extends {
          event: string;
          context: null;
        }
          ? Signature
          : never,
        Event extends S extends {
          event: infer Event;
        }
          ? Event
          : never
      >(
        event: Event
      ): S extends { event: Event; return: infer Return } ? Return : never;
    }

    export type SendSingature<Event extends Traits.EventConstraint> =
      Event extends Event
        ? Event["final"] extends false
          ? Event["context"] extends null
            ? Event["condition"] extends null
              ? SendSingaturePlain<Event>
              : SendSingatureWithCondition<Event>
            : Event["condition"] extends null
            ? SendSingatureWithContext<Event>
            : SendSingatureWithConditionAndContext<Event>
          : never
        : never;

    export interface SendSingaturePlain<Event extends Traits.EventConstraint> {
      event: `${Event["key"]}()`;
      context: null;
      return: Event["next"] | null;
    }

    export interface SendSingatureWithCondition<
      Event extends Traits.EventConstraint
    > {
      event: `${Event["key"]}(${Event["condition"]})`;
      context: null;
      return: Event["next"] | null;
    }

    export interface SendSingatureWithContext<
      Event extends Traits.EventConstraint
    > {
      event: `${Event["key"]}() -> ${Event["transition"]["to"]}`;
      context: Event["context"];
      return: Event["next"] | null;
    }

    export interface SendSingatureWithConditionAndContext<
      Event extends Traits.EventConstraint
    > {
      event: `${Event["key"]}(${Event["condition"]}) -> ${Event["transition"]["to"]}`;
      context: Event["context"];
      return: Event["next"] | null;
    }

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
        ? Factory extends Factories.MachineFactory<infer SubstateState>
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
      ParentMachineName extends string,
      ChildFinalStateName extends string,
      TransitionName extends string
    > = `${ChildFinalStateName} -> ${TransitionName}() -> ${ParentMachineName}`;

    /**
     * Constructs the final substate transition from the transition def.
     */
    export type SubstateFinalTransitionFromDef<
      Def extends SubstateFinalTransitionDef<any, any, any>
    > =
      Def extends `${infer ChildFromStateName} -> ${infer EventName}() -> ${infer MachineToStateName}`
        ? {
            event: EventName;
            from: ChildFromStateName;
            to: MachineToStateName;
            condition: null;
          }
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
      condition: string | null;
      final: boolean;
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
      next: States.AnyState;
      context: Contexts.Constraint | null;
    }

    export interface TraitsConstraint {
      state: StateConstraint;
      event: EventConstraint;
    }

    export interface Traits<AllState extends States.AnyState> {
      state: State<AllState>;
      event: Event<AllState>;
    }

    export type Event<
      MachineState extends States.AnyState,
      Prefix extends string | "" = ""
    > =
      // First we get the root level events
      | (Transition<MachineState> extends infer Transition extends TransitionConstraint
          ? Transition extends Transition
            ? {
                key: `${Prefix}${Transition["transition"]["event"]}`;
                wildcard: `${Prefix}*`;
                condition: Transition["transition"]["condition"];
                transition: Transition["transition"];
                next: Transition["next"];
                final: false;
                nested: Prefix extends "" ? false : true;
                context: Transition["context"];
              }
            : never
          : never)
      // Now we add the substate events
      | (MachineState extends {
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
                        ? {
                            key: `${Prefix}${EventName}`;
                            wildcard: `${Prefix}*`;
                            condition: null;
                            transition: FinalTransition;
                            // [TODO] Migrate to the approach used for the root level and get rid of MatchNextState
                            next: Transitions.MatchNextState<
                              MachineState,
                              EventName,
                              null
                            >;
                            final: true;
                            nested: true;
                            context: null; // [TODO] calculate the context
                          }
                        : never)
                : never
              : never
            : never
          : never);

    export type State<
      MachineState extends States.AnyState,
      Prefix extends string | "" = ""
    > =
      // First we get the root level states
      | (MachineState extends {
          name: infer Name extends string;
        }
          ? {
              key: `${Prefix}${Name}`;
              wildcard: `${Prefix}*`;
              state: MachineState;
              nested: Prefix extends "" ? false : true;
            }
          : never)
      // Now we add the substates
      | (MachineState extends {
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
          ? States.FilterState<State, Transition["to"]> extends infer NextState
            ? {
                transition: Transition;
                next: NextState;
                context: Contexts.EventContext<
                  State,
                  Transition["from"],
                  NextState
                >;
              }
            : never
          : never
        : never;
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
    export type HasInitialContext<State> = InitialContext<State> extends never
      ? false
      : true;

    /**
     * Resolves the initial state context.
     */
    export type InitialContext<State> = State extends {
      initial: true;
      [ContextBrand]: infer Context;
    }
      ? Context extends never
        ? never
        : keyof Context extends never
        ? never
        : Context
      : never;

    /**
     * The context brand symbol used to brand state with the context type.
     */
    export declare const ContextBrand: unique symbol;

    /**
     * Minimal context payload required to move from one state to another.
     */
    export type EventContext<
      AllState extends States.AnyState,
      FromName,
      NextState
    > = NextState extends {
      [Contexts.ContextBrand]: infer Context;
    }
      ? AllState extends {
          name: FromName;
          [Contexts.ContextBrand]: infer FromContext;
        }
        ? MinimalContext<Context, FromContext> extends infer EventContext
          ? keyof EventContext extends never
            ? null
            : EventContext
          : never
        : never
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
    export type RequiredKeys<Context, FromContext> = {
      [Key in keyof Context]: Key extends keyof FromContext
        ? FromContext[Key] extends Context[Key]
          ? never
          : Key
        : Key;
    }[keyof Context];
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
     * Makes given keys partial.
     */
    export type PartializeKeys<Type, Keys> = Keys extends keyof Type
      ? Omit<Type, Keys> & Partial<Pick<Type, Keys>>
      : never;

    /**
     * Turns never to null.
     */
    export type NullIfNever<Type> = Type extends never ? null : Type;

    /**
     * Resolves required keys.
     */
    export type RequiredKeys<Type> = Exclude<
      {
        [Key in keyof Type]: Type[Key] extends never
          ? never
          : RequiredKey<Type, Key> extends true
          ? Key
          : never;
      }[keyof Type],
      undefined
    >;

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
  }
  //#endregion
}
