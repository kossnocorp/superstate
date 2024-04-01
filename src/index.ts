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
  export type AnyAction<
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

  export type AnyMachineFactory<
    MachineState extends BuilderChainState<
      any,
      any,
      any,
      any,
      any
    > = BuilderChainState<any, any, any, any, any>
  > = MachineFactory<MachineState>;

  export interface MachineFactory<
    MachineState extends BuilderChainState<any, any, any, any, any>
  > {
    enter(): MachineInstance<MachineState, MachineAction<MachineState>>;
  }

  export interface Off {
    (): void;
  }

  export type OnTarget<MachineState extends { name: string; actions: any[] }> =
    | "*"
    | StateTarget<MachineState>
    | EventTarger<MachineState>;

  export type StateTarget<
    MachineState extends { name: string },
    Prefix extends string | undefined = undefined
  > =
    // First we get the root level state names
    | (Prefix extends undefined
        ? MachineState["name"]
        : `${Prefix}.${MachineState["name"]}`)
    // Then we add the children state names
    | (MachineState extends {
        name: infer ParentStateName extends string;
        sub: infer Substates extends Record<string, any>;
      }
        ? keyof Substates extends infer SubstateName extends string
          ? Substates[SubstateName] extends AnyMachineInstance<
              infer SubstateState
            >
            ? StateTarget<SubstateState, `${ParentStateName}.${SubstateName}`>
            : never
          : never
        : never);

  export type MatchTargetState<
    MachineState extends { name: string },
    Target extends string
  > =
    // First we get the root level states
    | (MachineState extends { name: Target } ? MachineState : never)
    // Then we get the substates
    | (MachineState extends {
        name: infer ParentStateName extends string;
        sub: infer Substates extends Record<string, any>;
      }
        ? keyof Substates extends infer SubstateName extends string
          ? Substates[SubstateName] extends AnyMachineInstance<infer ChildState>
            ? Target extends `${ParentStateName}.${SubstateName}.${infer SubstateTarget}`
              ? MatchTargetState<ChildState, SubstateTarget>
              : never
            : never
          : never
        : never);

  export type DeepAllState<MachineState> =
    // First we get the root level states
    | MachineState
    // Then we add the substates
    | (MachineState extends { sub: infer Substates }
        ? Substates extends Record<string, any>
          ? keyof Substates extends never // Prevent going deep if there are no substates
            ? never
            : Substates[keyof Substates] extends AnyMachineInstance<
                infer SubstateState
              >
            ? DeepAllState<SubstateState>
            : never
          : never
        : never);

  export type EventTarger<
    MachineState extends { name: string; actions: any[] },
    Prefix extends string | undefined = undefined
  > =
    // First we get the root level action names
    | (MachineState extends {
        actions: Array<{ name: infer ActionName extends string }>;
      }
        ? Prefix extends undefined
          ? `${ActionName}()`
          : `${Prefix}.${ActionName}()`
        : never)
    // Then we add the children action names
    | (MachineState extends {
        name: infer ParentStateName extends string;
        sub: infer Substates extends Record<string, any>;
      }
        ? keyof Substates extends infer SubstateName extends string
          ? Substates[SubstateName] extends AnyMachineInstance<
              infer SubstateState
            >
            ? EventTarger<SubstateState, `${ParentStateName}.${SubstateName}`>
            : never
          : never
        : never);

  export type MatchTargetAction<
    MachineState extends { name: string },
    Target extends string
  > =
    // First we get the substates, so we don't match qwe.asd.zxc() as zxc
    | (MachineState extends {
        name: infer ParentStateName extends string;
        sub: infer Substates extends Record<string, any>;
      }
        ? keyof Substates extends infer SubstateName extends string
          ? Substates[SubstateName] extends AnyMachineInstance<
              infer SubstateState
            >
            ? Target extends `${ParentStateName}.${SubstateName}.${infer SubstateTarget}`
              ? MatchTargetAction<SubstateState, SubstateTarget>
              : never
            : never
          : never
        : never)
    // Now we cam infer the root level actions
    | (MachineState extends { actions: Array<infer Action> }
        ? Action extends { name: infer ActionName extends string }
          ? `${ActionName}()` extends Target
            ? Action
            : never
          : never
        : never);

  export type DeepAllEvent<MachineState> =
    // First we get the root level actions
    | (MachineState extends { actions: Array<infer Action> } ? Action : never)
    // Then we add the children actions
    | (MachineState extends { sub: infer Substates }
        ? keyof Substates extends never // Prevent going deep if there are no substates
          ? never
          : Substates extends Record<string, any>
          ? Substates[keyof Substates] extends AnyMachineInstance<
              infer SubstateState
            >
            ? DeepAllEvent<SubstateState>
            : never
          : never
        : never);

  export type Event<_State extends { name: string }> =
    | TargetState<DeepAllState<_State>>
    | TargetEvent<DeepAllEvent<_State>>;

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
    MachineState extends { name: string; actions: any[] },
    Target extends OnTarget<MachineState>
  > {
    (
      // TODO: Add listening to events
      target: Target extends "*"
        ? Event<MachineState>
        : Target extends
            | Array<infer TargetString extends string>
            | infer TargetString extends string
        ? MatchTargetState<
            MachineState,
            TargetString
          > extends infer MatchedState
          ? MatchTargetAction<
              MachineState,
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

  export type MatchNextStateName<
    MachineState extends AnyState, // TODO: Cut it
    EventName,
    EventCondition extends string | null
  > = MachineState extends { actions: Array<infer Action> }
    ? Action extends {
        name: EventName;
        condition: EventCondition;
        to: infer ToStateName extends string;
      }
      ? ToStateName
      : never
    : never;

  export type AnyMachineInstance<
    MachineState extends AnyState = AnyState,
    Action extends AnyAction = AnyAction
  > = MachineInstance<MachineState, Action>;

  export type MachineInstance<
    MachineState extends AnyState, // TODO: Cut it
    Action extends AnyAction
  > = {
    readonly state: MachineState;

    readonly finalized: boolean;

    send<
      Name extends Action["name"],
      Condition extends Action extends { name: Name }
        ? Action["condition"]
        : null
    >(
      name: Name,
      condition: Condition
    ): MatchTargetState<
      MachineState,
      MatchNextStateName<MachineState, Name, Condition>
    > | null;

    send<
      Name extends Action extends { condition: null } ? Action["name"] : never
    >(
      name: Name
    ): MatchTargetState<
      MachineState,
      MatchNextStateName<MachineState, Name, null>
    > | null;

    on<Target extends OnTarget<MachineState>>(
      target: Target | Target[],
      listener: OnListener<MachineState, Target>
    ): Off;

    in<Target extends StateTarget<MachineState>>(
      target: Target | Target[]
    ): MatchTargetState<MachineState, Target> | undefined;
  };

  export interface State<
    MachineStateName extends string,
    StateName extends MachineStateName,
    Action, // extends StateAction<MachineStateName, StateName>, // optimization
    Substates, // extends ChildrenInstancesMap<any> // optimization
    Final extends boolean
  > {
    name: StateName;
    actions: Action[];
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

  export type DefFromAction<Action extends AnyAction> =
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
    actions: Array<infer Action>;
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
    actions: ActionFromDef<MachineStateName, StateName, StateActionDef>[];
    sub: SubstateMap<Substate>;
    final: Final;
  };

  export type SubstateMap<State extends Substate<any, any, any>> = {
    [Name in State["name"]]: State extends {
      name: Name;
      factory: infer Factory;
    }
      ? Factory extends MachineFactory<infer SubstateState>
        ? MachineInstance<SubstateState, MachineAction<SubstateState>>
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
          : never
      >(
        name: SubstateName,
        factory: SubstateFactory,
        defs: TrasitionDef | TrasitionDef[]
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
        actions: StateActionDef | StateActionDef[]
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
        actions: StateActionDef | StateActionDef[],
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
