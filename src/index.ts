/**
 * The root Superstate namespace. It contains all the Superstate types
 * and functions.
 */
export namespace Q {
  /**
   * The machine entity.
   */
  export interface Entity<Type extends string> {
    /** The entity type. */
    type: Type;
  }

  /**
   * The machine state object.
   */
  export interface State<Kind extends string> extends Entity<"state"> {
    /** The state kind. */
    kind: Kind;
  }

  /**
   * Acceptable machine state type. Unions with string allowing to define states
   * using a shortcut.
   */
  export type StateType = State<string> | (string & {});

  /**
   * Resolves state object type from the shortcut definition.
   */
  export type NormalizedState<Type extends StateType> = Type extends string
    ? State<Type>
    : Type;

  /**
   * Resolves state kind from the state type.
   */
  export type StateKind<Type extends StateType> = Type extends State<infer Kind>
    ? Kind
    : Type;

  /**
   * The machine action object.
   */
  export interface Action<Kind extends string> extends Entity<"action"> {
    /** The action kind. */
    kind: Kind;
  }

  /**
   * Acceptable machine action type. Unions with string allowing to define
   * actions using a shortcut.
   */
  export type ActionType = Action<string> | (string & {});

  /**
   * Resolves action object type from the shortcut definition.
   */
  export type NormalizedAction<Type extends ActionType> = Type extends string
    ? Action<Type>
    : Type;

  /**
   * Resolves action kind from the action type.
   */
  export type ActionKind<Type extends ActionType> = Type extends Action<
    infer Kind
  >
    ? Kind
    : Type;

  /**
   * The machine transition definitions
   */
  export type TransitionDefs<
    MachineState extends StateType,
    MachineAction extends ActionType
  > = [
    InitialTransitionDef<MachineState>,
    ...TransitionDef<MachineState, MachineAction>[]
  ];

  /**
   * The machine transition definition.
   */
  export type TransitionDef<
    MachineState extends StateType,
    MachineAction extends ActionType
  > = `${StateKind<MachineState>} --> ${StateKind<MachineState>}: ${ActionKind<MachineAction>}`;

  /**
   * The machine transition definition.
   */
  export type InitialTransitionDef<MachineState extends StateType> =
    `[*] --> ${StateKind<MachineState>}`;

  /**
   * The transition type.
   */
  export interface Transition<
    MachineState extends StateType,
    MachineAction extends ActionType
  > {
    /** The transition action. */
    action: ActionKind<MachineAction>;
    /** The from state. */
    from: StateKind<MachineState>;
    /** The to state. */
    to: StateKind<MachineState>;
  }

  /**
   * The state machine.
   */
  export abstract class Machine<
    MachineState extends StateType,
    MachineAction extends ActionType
  > {
    /** The machine name. */
    name: string;

    /** Initial state. */
    initialState: StateKind<MachineState>;

    /** Current state. */
    state: NormalizedState<MachineState>;

    /** Avaliable transitions. */
    transitions: Transition<MachineState, MachineAction>[];

    /**
     * The state machine.
     *
     * @param name - The state name
     * @param transitions - The transition definitions.
     */
    constructor(
      name: string,
      transitions: TransitionDefs<MachineState, MachineAction>
    ) {
      this.name = name;

      const [initialDef, ...defs] = transitions;
      this.initialState = this.parseInitialTransition(initialDef);
      this.state = this.normalizeState(this.initialState);
      this.transitions = defs.map(this.parseTransition);
    }

    /**
     * Sends an action to the machine.
     */
    send(action: MachineAction) {
      const transition = this.transitions.find(
        (transition) =>
          transition.from === this.state.kind && transition.action === action
      );

      if (!transition) return null;
      return (this.state = this.normalizeState(transition.to));
    }

    /**
     * Normalizes the state to the state object.
     *
     * @param state - The state type, either an object or string.
     *
     * @returns Normalized state object.
     */
    private normalizeState(state: MachineState | StateKind<MachineState>) {
      return (
        typeof state === "string" ? { type: "state", kind: state } : state
      ) as NormalizedState<MachineState>;
    }

    /**
     * Normalizes the action to the action object.
     *
     * @param action - The action type, either an object or string.
     *
     * @returns Normalized action object.
     */
    private normalizeAction(action: MachineAction) {
      return (
        typeof action === "string" ? { type: "state", kind: action } : action
      ) as NormalizedAction<MachineAction>;
    }

    /**
     * Parses the initial transition definition.
     *
     * @param transition - The initial transition definition.
     *
     * @returns The initial state
     */
    private parseInitialTransition(
      transition: InitialTransitionDef<MachineState>
    ) {
      const [_, state] = transition.match(/^\[\*\] --> (.+)$/) || [];

      const valid = typeof state === "string";
      if (!valid)
        throw new Error(`Invalid initial transition definition: ${transition}`);

      return state as StateKind<MachineState>;
    }

    /**
     * Parses the transition definition.
     *
     * @param transition - The transition definition.
     *
     * @returns The transition object.
     */
    private parseTransition(
      transition: TransitionDef<MachineState, MachineAction>
    ) {
      const [_, from, to, action] =
        transition.match(/^(.+) --> (.+): (.+)$/) || [];

      const valid =
        typeof from === "string" &&
        typeof to === "string" &&
        typeof action === "string";
      if (!valid)
        throw new Error(`Invalid transition definition: ${transition}`);

      return { action, from, to } as Transition<MachineState, MachineAction>;
    }
  }
}

/**
 * The root Superstate namespace. It contains all the Superstate types.
 */
export namespace Superstate {
  export namespace QQ {
    export type AnyTransition<
      EventName extends string = string,
      MachineStateName extends string = string,
      FromStateName extends MachineStateName = MachineStateName
    > = Transitions.Transition<
      EventName,
      MachineStateName,
      FromStateName,
      any,
      string | null,
      Transitions.Action | null
    >;

    export type AnyMachineFactory<MachineState extends AnyState = any> =
      MachineFactory<MachineState>;

    export interface MachineFactory<State extends AnyState> {
      host(
        ...args: Superstate.Actions.BindingArgs<State>
      ): MachineInstance<
        State,
        DeepFlatState<State>,
        DeepFlatEvent<State, State>,
        never
      >;
    }

    export interface Off {
      (): void;
    }

    export type OnTarget<
      FlatState extends FlatStateConstraint,
      FlatEvent extends FlatEventConstraint
    > = "*" | StateTarget<FlatState> | EventTarget<FlatEvent>;

    export type StateTarget<FlatState extends FlatStateConstraint> =
      FlatState["key"];

    export type MatchTargetState<
      FlatState extends FlatStateConstraint,
      Target extends string
    > = FlatState extends { key: Target } ? FlatState["state"] : never;

    export type EventTarget<FlatEvent extends FlatEventConstraint> =
      `${FlatEvent["key"]}()`;

    export type MatchTargetEvent<
      FlatEvent extends FlatEventConstraint,
      Target extends string
    > = Target extends `${infer Key}()`
      ? FlatEvent extends { key: Key }
        ? FlatEvent["event"]
        : never
      : never;

    export type GlobEvent<
      FlatState extends FlatStateConstraint,
      FlatEvent extends FlatEventConstraint
    > = TargetState<FlatState["state"]> | TargetEvent<FlatEvent["event"]>;

    export interface TargetState<_State extends { name: string }> {
      type: "state";
      state: _State;
    }

    export interface TargetEvent<MachineEvent> {
      type: "event";
      event: MachineEvent;
      // TODO: from, to, condition
    }

    export interface OnListener<
      FlatState extends FlatStateConstraint,
      FlatEvent extends FlatEventConstraint,
      Target extends OnTarget<FlatState, FlatEvent> // TODO: Simplify it
    > {
      (
        // TODO: Add listening to events
        target: Target extends "*"
          ? GlobEvent<FlatState, FlatEvent>
          : Target extends
              | Array<infer TargetString extends string>
              | infer TargetString extends string
          ? MatchTargetState<FlatState, TargetString> extends infer MatchedState
            ? MatchTargetEvent<
                FlatEvent,
                TargetString
              > extends infer MatchedEvent
              ?
                  | (MatchedState extends { name: string }
                      ? TargetState<MatchedState>
                      : never)
                  | (MatchedEvent extends never
                      ? never
                      : TargetEvent<MatchedEvent>)
              : never
            : never
          : never
      ): void;
    }

    export type MatchNextState<
      MachineState extends AnyState, // TODO: Cut it
      AllState extends AnyState, // TODO: Cut it
      EventName,
      EventCondition extends string | null
    > = MachineState extends { transitions: Array<infer Event> }
      ? Event extends {
          name: EventName;
          condition: EventCondition;
          to: infer ToName;
        }
        ? AllState extends { name: ToName }
          ? AllState
          : never
        : never
      : never;

    export interface FlatEventConstraint {
      key: string;
      condition: string | null;
      final: boolean;
      next: AnyState;
      event: AnyTransition;
    }

    export interface FlatStateConstraint {
      key: string;
      state: AnyState;
    }

    export type DeepFlatEvent<
      MachineState extends AnyState,
      AllState extends AnyState,
      Prefix extends string | "" = ""
    > =
      // First we get the root level events
      | (MachineState extends {
          transitions: Array<infer Event>;
        }
          ? Event extends {
              name: infer EventName extends string;
              condition: infer Condition extends string | null;
            }
            ? {
                key: Prefix extends undefined
                  ? EventName
                  : `${Prefix}${EventName}`;
                condition: Condition;
                event: Event;
                next: MatchNextState<AllState, AllState, EventName, Condition>;
                final: false;
              }
            : never
          : never)
      // Now we add the substate events
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
                  sub: infer AsSubstate;
                  state: infer SubstateState extends AnyState;
                }
                  ? SubstateName extends string
                    ?
                        | DeepFlatEvent<
                            SubstateState,
                            SubstateState,
                            `${Prefix}${StateName}.${SubstateName}.`
                          >
                        // Add final transitions
                        | (AsSubstate extends Substate<
                            any,
                            any,
                            infer Transition
                          >
                            ? Transition extends SubstateFinalTransition<
                                infer EventName,
                                any,
                                any
                              >
                              ? {
                                  key: `${Prefix}${EventName}`;
                                  event: Transition;
                                  condition: null;
                                  next: MatchNextState<
                                    AllState,
                                    AllState,
                                    EventName,
                                    null
                                  >;
                                  final: true;
                                }
                              : never
                            : never)
                    : never
                  : never;
              }[keyof Substates]
            : never
          : never);

    export type DeepFlatState<
      MachineState extends AnyState,
      Prefix extends string | "" = ""
    > =
      // First we get the root level states
      | (MachineState extends {
          name: infer Name extends string;
        }
          ? {
              key: `${Prefix}${Name}`;
              state: MachineState;
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
                  state: infer SubstateState extends AnyState;
                }
                  ? SubstateName extends string
                    ? DeepFlatState<
                        SubstateState,
                        `${Prefix}${StateName}.${SubstateName}.`
                      >
                    : never
                  : never;
              }[keyof Substates]
            : never
          : never);

    export type AnyMachineInstance<
      MachineState extends AnyState = AnyState,
      FlatState extends FlatStateConstraint = any,
      FlatEvent extends FlatEventConstraint = any,
      AsSubstate extends Substate<any, any, any> = Substate<any, any, any>
    > = MachineInstance<MachineState, FlatState, FlatEvent, AsSubstate>;

    export interface MachineInstance<
      MachineState extends AnyState, // TODO: Cut it
      FlatState extends FlatStateConstraint,
      FlatEvent extends FlatEventConstraint,
      AsSubstate extends Substate<any, any, any>
    > {
      readonly sub: AsSubstate;

      readonly state: MachineState;

      readonly finalized: boolean;

      send<
        Key extends FlatEvent extends {
          key: infer Key extends string;
          final: false;
        }
          ? Key
          : never,
        Condition extends FlatEvent extends {
          key: Key;
          condition: infer Condition extends null | string;
        }
          ? Condition
          : null
      >(
        name: `${Key}()`,
        condition: Condition
      ): FlatEvent extends {
        key: Key;
        condition: Condition;
        next: infer Next;
      }
        ? Next | null
        : never;

      send<
        Key extends FlatEvent extends {
          key: infer Key extends string;
          final: false;
        }
          ? Key
          : never,
        Condition extends FlatEvent extends {
          key: Key;
          condition: infer Condition extends null | string;
        }
          ? Condition
          : null
      >(
        name: `${Key}(${Condition})`
      ): FlatEvent extends {
        key: Key;
        condition: Condition;
        next: infer Next;
      }
        ? Next | null
        : never;

      send<
        Key extends FlatEvent extends {
          key: infer Key extends string;
          condition: null;
          final: false;
        }
          ? Key
          : never
      >(
        name: `${Key}()`
      ): FlatEvent extends {
        key: Key;
        condition: null;
        next: infer Next;
      }
        ? Next | null
        : never;

      on<Target extends OnTarget<FlatState, FlatEvent>>(
        target: Target | Target[],
        listener: OnListener<FlatState, FlatEvent, Target>
      ): Off;

      in<Target extends StateTarget<FlatState>>(
        target: Target | Target[]
      ): MatchTargetState<FlatState, Target> | undefined;
    }

    export interface State<
      MachineStateName extends string,
      StateName extends MachineStateName,
      Action,
      Transition,
      Substates,
      Final extends boolean
    > {
      name: StateName;
      actions: Action[];
      transitions: Transition[];
      sub: Substates;
      final: Final;
    }

    export type AnyState<
      MachineStateName extends string = string,
      StateName extends MachineStateName = MachineStateName,
      Action = any,
      Event = any,
      Substates = any,
      Final extends boolean = boolean
    > = State<MachineStateName, StateName, Action, Event, Substates, Final>;

    export type EventDef<
      MachineStateName extends string,
      EventName extends string,
      Condition extends string
    > =
      | `${EventName}() -> ${MachineStateName}`
      | `${EventName}(${Condition}) -> ${MachineStateName}`;

    /**
     * Infers the entry state name from the machine state.
     */
    export type EntryStateName<State> = State extends {
      name: infer Name;
      props: { entry: true };
    }
      ? Name
      : never;

    export type BuilderChainState<
      MachineStateName extends string,
      StateName extends MachineStateName,
      StateAction extends Superstate.Actions.Action,
      StateDef_ extends Superstate.State.Def<MachineStateName>,
      Substate extends QQ.Substate<any, any, any>,
      Initial extends boolean,
      Final extends boolean
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
        StateDef_ extends EventDef<any, any, any> ? StateDef_ : never
      >[];
      sub: SubstateMap<Substate>;
      initial: Initial;
      final: Final;
    };

    export type SubstateMap<_Substate extends Substate<any, any, any>> = {
      [Name in _Substate["name"]]: _Substate extends {
        name: Name;
        factory: infer Factory;
      }
        ? Factory extends MachineFactory<infer SubstateState>
          ? MachineInstance<
              SubstateState,
              DeepFlatState<SubstateState>,
              DeepFlatEvent<SubstateState, SubstateState>,
              _Substate
            >
          : never
        : never;
    };

    export interface SubstateFinalTransition<
      EventName extends string,
      ChildFromStateName extends string,
      MachineToStateName extends string
    > {
      name: EventName;
      from: ChildFromStateName;
      to: MachineToStateName;
    }

    export interface Substate<
      Name extends string,
      Factory extends AnyMachineFactory,
      Transition extends SubstateFinalTransition<any, any, any>
    > {
      name: Name;
      factory: Factory;
      transitions: Transition[];
    }

    export type SubstateFinalTransitionDef<
      ParentMachineName extends string,
      ChildFinalStateName extends string,
      TransitionName extends string
    > = `${ChildFinalStateName} -> ${TransitionName}() -> ${ParentMachineName}`;

    export type SubstateFinalTransitionFromDef<
      Def extends SubstateFinalTransitionDef<any, any, any>
    > =
      Def extends `${infer ChildFromStateName} -> ${infer EventName}() -> ${infer MachineToStateName}`
        ? { name: EventName; from: ChildFromStateName; to: MachineToStateName }
        : never;
  }

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
      true extends IsActionable<State>
        ? [
            Binding<State> extends infer Binding_ extends BindingConstraint
              ? {
                  [StateName in Binding_["state"]]: {
                    [Key in Binding_ extends { state: StateName }
                      ? Binding_["key"]
                      : never]: BindingFn;
                  };
                }
              : never
          ]
        : [];

    /**
     * The binding constrain type.
     */
    export interface BindingConstraint {
      key: string;
      state: string;
    }

    /**
     * Resolves action bindings.
     */
    export type Binding<State extends { name: string }> = State extends {
      name: infer StateName;
      actions: Array<infer Action>;
      transitions: Array<infer Transition>;
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
              name: infer EventName extends string;
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
      : never;

    /**
     * The type resolves true if any state has at least one action.
     * It will resolve `boolean` when some states have no actions.
     */
    export type IsActionable<State> = State extends {
      transitions: Array<
        infer Transition extends Superstate.Transitions.Transition<
          any,
          any,
          any,
          any,
          any,
          any
        >
      >;
      actions: Array<infer Action extends Superstate.Actions.Action>;
    }
      ? Action["name"] extends never
        ? Transition["action"] extends null
          ? false
          : true
        : true
      : never;
  }

  /**
   * The events namespace. It contains all the types related to events,
   * the entity that trigger state transitions.
   */
  export namespace Events {}

  /**
   * The transitions namespace. It contains all the types related to
   * transitions, the entity that defines the state transition triggered
   * by events.
   */
  export namespace Transitions {
    export interface Transition<
      EventName extends string,
      MachineStateName extends string,
      FromStateName extends MachineStateName,
      ToStateName extends MachineStateName,
      Condition extends string | null,
      Action extends Superstate.Transitions.Action | null
    > {
      // TODO: Rename to event?
      name: EventName;
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
     * The transition def.
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
      ? // TODO: Try to optimize it to `${EventName}${Def}`
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
    > = Def_ extends Transitions.EventDef<
      infer ToStateName extends MachineStateName,
      infer EventName,
      infer Condition
    >
      ? Transition<
          EventName,
          MachineStateName,
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
          MachineStateName,
          FromStateName,
          ToStateName,
          Condition extends "" ? null : Condition,
          { type: "transition"; name: Action }
        >
      : never;
  }

  export namespace State {
    /**
     * The state def.
     */
    export type Def<MachineStateName extends string> =
      | Transitions.Def<MachineStateName>
      | Actions.Def;
  }

  export namespace Builder {
    export interface Machine {
      <MachineStateName extends string>(name: string): Head<MachineStateName>;
    }

    export interface Head<
      MachineStateName extends string,
      ChainStateName extends MachineStateName = MachineStateName,
      MachineState extends QQ.AnyState<MachineStateName> = never
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
      MachineState extends QQ.AnyState<MachineStateName> = never
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
      Substate extends QQ.Substate<any, any, any> = never
    > {
      enter<ActionNameDef extends Actions.NameDef>(
        name: ActionNameDef
      ): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction | Actions.FromNameDef<"enter", ActionNameDef>,
        StateTransitionDef,
        Substate
      >;

      exit<NameDef extends Actions.NameDef>(
        name: NameDef
      ): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction | Actions.FromNameDef<"exit", NameDef>,
        StateTransitionDef,
        Substate
      >;

      on<Def extends Transitions.Def<MachineStateName>>(
        transitions: Def[] | Def
      ): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction,
        StateTransitionDef | Def,
        Substate
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
        Substate
      >;

      sub<
        SubstateName extends string,
        SubstateFactory extends QQ.AnyMachineFactory,
        TrasitionDef extends SubstateFactory extends QQ.AnyMachineFactory<
          infer State
        >
          ? State extends { name: infer FinalName extends string; final: true }
            ? QQ.SubstateFinalTransitionDef<MachineStateName, FinalName, any>
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
        | QQ.Substate<
            SubstateName,
            SubstateFactory,
            QQ.SubstateFinalTransitionFromDef<TrasitionDef>
          >
      >;
    }

    export interface StateFnGenerator<
      MachineStateName extends string,
      StateAction extends Actions.Action,
      StateTransitionDef extends Transitions.Def<MachineStateName> = never,
      Substate extends QQ.Substate<any, any, any> = never
    > {
      ($: StateFnGeneratorBuilder<MachineStateName>): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction,
        StateTransitionDef,
        Substate
      >;
    }

    export type BuilderChainResult<
      MachineStateName extends string,
      ChainStateName extends MachineStateName,
      MachineState extends QQ.AnyState<MachineStateName>,
      StateName extends ChainStateName,
      StateAction extends Actions.Action,
      StateDef_ extends State.Def<MachineStateName>,
      Substate extends QQ.Substate<any, any, any>,
      Initial extends boolean,
      Final extends boolean
    > = Exclude<ChainStateName, StateName> extends never
      ? QQ.MachineFactory<
          | MachineState
          | QQ.BuilderChainState<
              MachineStateName,
              StateName,
              StateAction,
              StateDef_,
              Substate,
              Initial,
              Final
            >
        >
      : Tail<
          MachineStateName,
          Exclude<ChainStateName, StateName>,
          | MachineState
          | QQ.BuilderChainState<
              MachineStateName,
              StateName,
              StateAction,
              StateDef_,
              Substate,
              Initial,
              Final
            >
        >;

    export interface StateFn<
      Initial extends boolean,
      Final extends boolean,
      MachineStateName extends string,
      ChainStateName extends MachineStateName = MachineStateName,
      MachineState extends QQ.AnyState<MachineStateName> = never
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
        Final
      >;

      <
        StateName extends ChainStateName,
        StateAction extends Actions.Action,
        StateTransitionDef extends Transitions.Def<MachineStateName>,
        Substate extends QQ.Substate<any, any, any>
      >(
        name: StateName,
        generator: StateFnGenerator<
          MachineStateName,
          StateAction,
          StateTransitionDef,
          Substate
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
        Final
      >;

      <
        StateName extends ChainStateName,
        StateDef_ extends State.Def<MachineStateName>
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
        Final
      >;

      <
        StateName extends ChainStateName,
        StateAction extends Actions.Action,
        StateDef extends State.Def<MachineStateName>,
        StateTransitionDef extends Transitions.Def<MachineStateName>,
        Substate extends QQ.Substate<any, any, any>
      >(
        name: StateName,
        transitions: StateDef | StateDef[],
        generator: StateFnGenerator<
          MachineStateName,
          StateAction,
          StateTransitionDef,
          Substate
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
        Final
      >;
    }
  }
}

export const superstate: Superstate.Builder.Machine =
  // @ts-expect-error: This is fine, it's just a placeholder
  (() => {}) as Superstate.Builder.Machine;
