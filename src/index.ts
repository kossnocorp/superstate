import { QUtils } from "./utils.js";

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
 * The root Superstate namespace. It contains all the Superstate types and
 * functions. It's a WIP API revamp.
 */
export namespace QQ {
  // TODO: Rename action -> event everywhere
  export type AnyEvent<
    ActionName extends string = string,
    MachineStateName extends string = string,
    FromStateName extends MachineStateName = MachineStateName
  > = ActionTransition<
    ActionName,
    MachineStateName,
    FromStateName,
    any,
    string | null
  >;

  export interface ActionTransition<
    ActionName extends string,
    MachineStateName extends string,
    FromStateName extends MachineStateName,
    ToStateName extends MachineStateName,
    ActionCondition extends string | null
  > {
    name: ActionName;
    condition: ActionCondition;
    from: FromStateName;
    to: ToStateName;
  }

  export type AnyMachineFactory<MachineState extends AnyState = any> =
    MachineFactory<MachineState>;

  export interface MachineFactory<MachineState extends AnyState> {
    enter(): MachineInstance<
      MachineState,
      DeepFlatState<MachineState>,
      DeepFlatEvent<MachineState, MachineState>,
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

  export interface TargetEvent<MachineAction> {
    type: "event";
    event: MachineAction;
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
          ? MatchTargetEvent<FlatEvent, TargetString> extends infer MatchedEvent
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
  > = MachineState extends { events: Array<infer Event> }
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
    event: AnyEvent;
  }

  export interface FlatStateConstraint {
    key: string;
    state: AnyState;
  }

  export type DeepFlatEvent<
    MachineState extends AnyState,
    AllState extends AnyState,
    Prefix extends string | undefined = undefined
  > =
    // First we get the root level events
    | (MachineState extends {
        events: Array<infer Event>;
      }
        ? Event extends {
            name: infer EventName extends string;
            condition: infer Condition extends string | null;
          }
          ? {
              key: Prefix extends undefined
                ? EventName
                : `${Prefix}.${EventName}`;
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
        ? {
            [SubstateName in keyof Substates]: Substates[SubstateName] extends AnyMachineInstance<
              infer SubstateState,
              any,
              any,
              infer AsSubstate
            >
              ? SubstateName extends string
                ?
                    | DeepFlatEvent<
                        SubstateState,
                        SubstateState,
                        Prefix extends undefined
                          ? `${StateName}.${SubstateName}`
                          : `${Prefix}.${StateName}.${SubstateName}`
                      >
                    // Add final transitions
                    | (AsSubstate extends Substate<any, any, infer Transition>
                        ? Transition extends SubstateFinalTransition<
                            infer EventName,
                            any,
                            any
                          >
                          ? {
                              key: Prefix extends undefined
                                ? EventName
                                : `${Prefix}.${EventName}`;
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
        : never);

  export type DeepFlatState<
    MachineState extends AnyState,
    Prefix extends string | undefined = undefined
  > =
    // First we get the root level states
    | (MachineState extends {
        name: infer Name extends string;
      }
        ? {
            key: Prefix extends undefined ? Name : `${Prefix}.${Name}`;
            state: MachineState;
          }
        : never)
    // Now we add the substates
    | (MachineState extends {
        name: infer StateName extends string;
        sub: infer Substates extends Record<string, any>;
      }
        ? {
            [SubstateName in keyof Substates]: Substates[SubstateName] extends AnyMachineInstance<
              infer SubstateState
            >
              ? SubstateName extends string
                ? DeepFlatState<
                    SubstateState,
                    Prefix extends undefined
                      ? `${StateName}.${SubstateName}`
                      : `${Prefix}.${StateName}.${SubstateName}`
                  >
                : never
              : never;
          }[keyof Substates]
        : never);

  export type AnyMachineInstance<
    MachineState extends AnyState = AnyState,
    FlatState extends FlatStateConstraint = any,
    FlatEvent extends FlatEventConstraint = any,
    AsSubstate extends Substate<any, any, any> = Substate<any, any, any>
  > = MachineInstance<MachineState, FlatState, FlatEvent, AsSubstate>;

  export type MachineInstance<
    MachineState extends AnyState, // TODO: Cut it
    FlatState extends FlatStateConstraint,
    FlatEvent extends FlatEventConstraint,
    AsSubstate extends Substate<any, any, any>
  > = {
    // TODO: Find a better name. This property is needed to infer the substate
    // transitions for on method. It tells if the instance is a substate
    readonly substate: AsSubstate;

    readonly state: MachineState;

    readonly finalized: boolean;

    send<
      Key extends FlatEvent extends { key: infer Key; final: false }
        ? Key
        : never,
      Condition extends FlatEvent extends {
        key: Key;
        condition: infer Condition extends null | string;
      }
        ? Condition
        : null
    >(
      name: Key,
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
        key: infer Key;
        condition: null;
        final: false;
      }
        ? Key
        : never
    >(
      name: Key
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
  };

  export interface State<
    MachineStateName extends string,
    StateName extends MachineStateName,
    Action, // extends StateAction<MachineStateName, StateName>, // optimization
    Substates, // extends ChildrenInstancesMap<any> // optimization
    Final extends boolean
  > {
    name: StateName;
    events: Action[];
    sub: Substates;
    final: Final;
  }

  export type AnyState<
    MachineStateName extends string = string,
    StateName extends MachineStateName = MachineStateName,
    Action = any,
    Substates = any,
    Final extends boolean = boolean
  > = State<MachineStateName, StateName, Action, Substates, Final>;

  export type ActionDef<
    MachineStateName extends string,
    EventName extends string,
    Condition extends string
  > =
    | `${EventName}() -> ${MachineStateName}`
    | `${EventName}(${Condition}) -> ${MachineStateName}`;

  export type ActionFromDef<
    MachineStateName extends string,
    FromStateName extends MachineStateName,
    Def extends ActionDef<any, any, any>
  > = Def extends `${infer ActionName}() -> ${infer ToState extends MachineStateName}`
    ? ActionTransition<
        ActionName,
        MachineStateName,
        FromStateName,
        ToState,
        null
      >
    : Def extends `${infer ActionName}(${infer Condition}) -> ${infer ToState extends MachineStateName}`
    ? ActionTransition<
        ActionName,
        MachineStateName,
        FromStateName,
        ToState,
        Condition
      >
    : never;

  export type DefFromAction<Action extends AnyEvent> =
    Action extends ActionTransition<
      infer ActionName,
      any,
      infer FromStateName,
      infer ToStateName,
      infer Condition
    >
      ? Condition extends string
        ? `${FromStateName} -> ${ActionName}(${Condition}) -> ${ToStateName}`
        : `${FromStateName} -> ${ActionName}() -> ${ToStateName}`
      : never;

  type MachineAction<MachineState> = MachineState extends {
    events: Array<infer Action>;
  }
    ? Action
    : never;

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
    StateActionDef extends ActionDef<MachineStateName, any, any>,
    Substate extends QQ.Substate<any, any, any>,
    Final extends boolean
  > = {
    name: StateName;
    events: ActionFromDef<MachineStateName, StateName, StateActionDef>[];
    sub: SubstateMap<Substate>;
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

export namespace Superstate {
  export namespace Builder {
    export interface Machine {
      <MachineStateName extends string>(name: string): Head<MachineStateName>;
    }

    export interface Head<
      MachineStateName extends string,
      ChainStateName extends MachineStateName = MachineStateName,
      MachineState extends QQ.AnyState<MachineStateName> = never
    > {
      start: StateFn<false, MachineStateName, ChainStateName, MachineState>;
    }

    export interface Tail<
      MachineStateName extends string,
      ChainStateName extends MachineStateName = MachineStateName,
      MachineState extends QQ.AnyState<MachineStateName> = never
    > {
      state: StateFn<false, MachineStateName, ChainStateName, MachineState>;

      final: StateFn<true, MachineStateName, ChainStateName, MachineState>;
    }

    export type EventCaseDef<
      MachineStateName extends string,
      Condition extends string = never
    > = `() -> ${MachineStateName}` | `(${Condition}) -> ${MachineStateName}`;

    export type EventCaseDefToEventDef<
      MachineStateName extends string,
      EventName extends string,
      Def extends EventCaseDef<any, any>
    > = Def extends Def
      ? // TODO: Try to optimize it to `${EventName}${Def}`
        Def extends `() -> ${infer ToState extends MachineStateName}`
        ? `${EventName}() -> ${ToState}`
        : Def extends `(${infer Condition}) -> ${infer ToState extends MachineStateName}`
        ? `${EventName}(${Condition}) -> ${ToState}`
        : never
      : never;

    export interface StateFnGeneratorBuilder<
      MachineStateName extends string,
      // ChainStateName extends MachineStateName,
      // StateName extends ChainStateName,
      StateActionDef extends QQ.ActionDef<MachineStateName, any, any> = never,
      Substate extends QQ.Substate<any, any, any> = never
    > {
      on<ActionDef extends QQ.ActionDef<MachineStateName, any, any>>(
        events: ActionDef[] | ActionDef
      ): StateFnGeneratorBuilder<
        MachineStateName,
        StateActionDef | ActionDef,
        Substate
      >;

      if<
        EventName extends string,
        CaseDef extends EventCaseDef<MachineStateName, any>
      >(
        name: EventName,
        cases: CaseDef[] | CaseDef
      ): StateFnGeneratorBuilder<
        MachineStateName,
        | StateActionDef
        | EventCaseDefToEventDef<MachineStateName, EventName, CaseDef>,
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
        StateActionDef,
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
      StateActionDef extends QQ.ActionDef<MachineStateName, any, any>,
      Substate extends QQ.Substate<any, any, any> = never
    > {
      ($: StateFnGeneratorBuilder<MachineStateName>): StateFnGeneratorBuilder<
        MachineStateName,
        StateActionDef,
        Substate
      >;
    }

    export type BuilderChainResult<
      MachineStateName extends string,
      ChainStateName extends MachineStateName,
      MachineState extends QQ.AnyState<MachineStateName>,
      StateName extends ChainStateName,
      StateActionDef extends QQ.ActionDef<MachineStateName, any, any>,
      Substate extends QQ.Substate<any, any, any>,
      Final extends boolean
    > = Exclude<ChainStateName, StateName> extends never
      ? QQ.MachineFactory<
          | MachineState
          | QQ.BuilderChainState<
              MachineStateName,
              StateName,
              StateActionDef,
              Substate,
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
              StateActionDef,
              Substate,
              Final
            >
        >;

    export interface StateFn<
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
        Final
      >;

      <
        StateName extends ChainStateName,
        StateActionDef extends QQ.ActionDef<MachineStateName, any, any>,
        Substate extends QQ.Substate<any, any, any>
      >(
        name: StateName,
        generator: StateFnGenerator<MachineStateName, StateActionDef, Substate>
      ): BuilderChainResult<
        MachineStateName,
        ChainStateName,
        MachineState,
        StateName,
        StateActionDef,
        Substate,
        Final
      >;

      <
        StateName extends ChainStateName,
        StateActionDef extends QQ.ActionDef<MachineStateName, any, any>
      >(
        name: StateName,
        events: StateActionDef | StateActionDef[]
      ): BuilderChainResult<
        MachineStateName,
        ChainStateName,
        MachineState,
        StateName,
        StateActionDef,
        never,
        Final
      >;

      <
        StateName extends ChainStateName,
        StateActionDef extends QQ.ActionDef<MachineStateName, any, any>,
        Substate extends QQ.Substate<any, any, any>
      >(
        name: StateName,
        events: StateActionDef | StateActionDef[],
        generator: StateFnGenerator<MachineStateName, StateActionDef, Substate>
      ): BuilderChainResult<
        MachineStateName,
        ChainStateName,
        MachineState,
        StateName,
        StateActionDef,
        Substate,
        Final
      >;
    }
  }
}

export const superstate: Superstate.Builder.Machine =
  // @ts-expect-error: This is fine, it's just a placeholder
  (() => {}) as Superstate.Builder.Machine;
