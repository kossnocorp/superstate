import { QUtils } from "./utils.js";

/**
 * The root QCraft namespace. It contains all the QCraft types and functions.
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
 * The root QCraft namespace. It contains all the QCraft types and functions.
 * It's a WIP API revamp.
 */
export namespace QQ {
  export type AnyAction<
    ActionName extends string = string,
    MachineStateName extends string = string,
    FromStateName extends MachineStateName = MachineStateName
  > =
    | ActionTransition<ActionName, MachineStateName, FromStateName, any>
    | ActionTransitionFork<
        ActionName,
        MachineStateName,
        FromStateName,
        any,
        string
      >
    | AnyExitAction<ActionName, MachineStateName, FromStateName>;

  export type AnyExitAction<
    ActionName extends string = string,
    MachineStateName extends string = string,
    FromStateName extends MachineStateName = MachineStateName
  > =
    | ActionExit<ActionName, MachineStateName, FromStateName>
    | ActionExitFork<ActionName, MachineStateName, FromStateName, string>;

  export type StateAction<
    MachineStateName extends string,
    FromStateName extends MachineStateName
  > =
    | ActionTransition<
        string,
        MachineStateName,
        FromStateName,
        MachineStateName
      >
    | ActionTransitionFork<
        string,
        MachineStateName,
        FromStateName,
        MachineStateName,
        string
      >
    | ActionExit<string, MachineStateName, FromStateName>
    | ActionExitFork<string, MachineStateName, FromStateName, string>;

  export interface ActionTransition<
    ActionName extends string,
    MachineStateName extends string,
    FromStateName extends MachineStateName,
    ToStateName extends MachineStateName
  > {
    name: ActionName;
    from: FromStateName;
    to: ToStateName;
  }

  // TODO: I don't like fork name
  export interface ActionTransitionFork<
    ActionName extends string,
    MachineStateName extends string,
    FromStateName extends MachineStateName,
    ToStateName extends MachineStateName,
    ActionCondition extends string
  > {
    name: ActionName;
    condition: ActionCondition;
    from: FromStateName;
    to: ToStateName;
  }

  export interface ActionExit<
    ActionName extends string,
    MachineStateName extends string,
    FromStateName extends MachineStateName
  > {
    name: ActionName;
    from: FromStateName;
  }

  // TODO: Add tysts
  export interface ActionExitFork<
    ActionName extends string,
    MachineStateName extends string,
    FromStateName extends MachineStateName,
    ActionCondition extends string
  > {
    name: ActionName;
    condition: ActionCondition;
    from: FromStateName;
  }

  export interface ExitState<
    StateName extends string,
    MachineAction extends AnyAction,
    ActionCondition extends string | null | never
  > {}

  export interface MachineFactory<
    MachineState extends BuilderChainState<any, any, any, any, any>
  > {
    enter(
      ...args: EntryStateName<MachineState> extends infer EntryState
        ? QUtils.IsUnion<EntryState> extends true
          ? [EntryState]
          : [] | [EntryState]
        : never
    ): MachineInstance<MachineState>;
  }

  export interface Off {
    (): void;
  }

  export type OnTarget<
    StateName extends string,
    MachineAction extends AnyAction
  > = "*" | StateName | MachineAction["name"];

  export type Event<
    _State extends State<any, any, any, any, any>,
    MachineAction extends AnyAction
  > = EventState<_State> | EventAction<MachineAction>;

  export interface EventState<_State extends State<any, any, any, any, any>> {
    type: "state";
    state: _State;
  }

  export interface EventAction<MachineAction extends AnyAction> {
    type: "action";
    action: MachineAction;
    // TODO: from, to, condition
  }

  export interface OnListener<
    _State extends State<any, any, any, any, any>,
    MachineAction extends AnyAction,
    Target extends OnTarget<_State["name"], any>
  > {
    (
      event: Target extends "*"
        ? Event<_State, MachineAction>
        : Target extends Array<infer StateTarget> | infer StateTarget
        ? EventState<_State extends { name: StateTarget } ? _State : never>
        : never
    ): void;
  }

  export type ExtractConditionAction<MachineAction extends AnyAction> = Extract<
    MachineAction,
    | ActionTransitionFork<any, any, any, any, any>
    | ActionExitFork<any, any, any, any>
  >;

  export type ExcludeConditionAction<MachineAction extends AnyAction> = Exclude<
    MachineAction,
    | ActionTransitionFork<any, any, any, any, any>
    | ActionExitFork<any, any, any, any>
  >;

  export type ExtractExitAction<MachineAction extends AnyAction> = Exclude<
    MachineAction,
    | ActionTransition<any, any, any, any>
    | ActionTransitionFork<any, any, any, any, any>
  >;

  export type MachineInstance<
    MachineState extends State<any, any, any, any, any>
  > = MachineAction<MachineState> extends infer Action extends AnyAction
    ? {
        send<ActionName extends ExtractConditionAction<Action>["name"]>(
          action: ActionName,
          condition: Action extends {
            name: ActionName;
            condition: infer Condition;
          }
            ? Condition
            : never
        ): void;

        send<ActionName extends ExcludeConditionAction<Action>["name"]>(
          action: ActionName
        ): void;

        on<Target extends OnTarget<MachineState["name"], Action>>(
          target: Target | Target[],
          listener: OnListener<MachineState, Action, Target>
        ): Off;
      }
    : never;

  export interface State<
    MachineStateName extends string,
    StateName extends MachineStateName,
    Action extends StateAction<MachineStateName, StateName>,
    Props extends StateProps<boolean>,
    Children extends ChildrenInstancesMap<any>
  > {
    name: StateName;
    actions: Action[];
    props: Props;
    children: Children;
  }

  export type ActionDef<
    MachineStateName extends string,
    ActionName extends string,
    Condition extends string
  > =
    | `${ActionName}(${Condition}) -> ${MachineStateName}`
    | `${ActionName} -> ${MachineStateName}`
    | `${ActionName}(${Condition}) ->`
    | `${ActionName} ->`;

  export type ActionFromDef<
    MachineStateName extends string,
    FromStateName extends MachineStateName,
    Def extends ActionDef<any, any, any>
  > = Def extends `${infer ActionName}(${infer Condition}) -> ${infer ToState extends MachineStateName}`
    ? ActionTransitionFork<
        ActionName,
        MachineStateName,
        FromStateName,
        ToState,
        Condition
      >
    : Def extends `${infer ActionName} -> ${infer ToState extends MachineStateName}`
    ? ActionTransition<ActionName, MachineStateName, FromStateName, ToState>
    : Def extends `${infer ActionName}(${infer Condition}) ->`
    ? ActionExitFork<ActionName, MachineStateName, FromStateName, Condition>
    : Def extends `${infer ActionName} ->`
    ? ActionExit<ActionName, MachineStateName, FromStateName>
    : never;

  export type DefFromAction<Action extends AnyAction> =
    Action extends ActionTransitionFork<
      infer ActionName,
      any,
      infer FromStateName,
      infer ToStateName,
      infer Condition
    >
      ? `${FromStateName} -> ${ActionName}(${Condition}) -> ${ToStateName}`
      : Action extends ActionTransition<
          infer ActionName,
          any,
          infer FromStateName,
          infer ToStateName
        >
      ? `${FromStateName} -> ${ActionName} -> ${ToStateName}`
      : Action extends ActionExitFork<
          infer ActionName,
          any,
          infer FromStateName,
          infer Condition
        >
      ? `${FromStateName} -> ${ActionName}(${Condition}) ->`
      : Action extends ActionExit<infer ActionName, any, infer FromStateName>
      ? `${FromStateName} -> ${ActionName} ->`
      : never;

  export interface Builder2 {
    <State extends string>(name: string): BuilderChain<State, State>;
  }

  export interface StateProps<Entry extends boolean> {
    Entry: Entry;
  }

  type MachineAction<MachineState extends State<any, any, any, any, any>> =
    MachineState extends State<any, any, infer Action, any, any>
      ? Action
      : never;

  type EntryStateName<MachineState extends State<any, any, any, any, any>> =
    MachineState extends State<any, any, any, infer Props, any>
      ? Props["Entry"] extends true
        ? MachineState["name"]
        : never
      : never;

  type BuilderChainResult<
    MachineStateName extends string,
    ChainStateName extends MachineStateName,
    MachineState extends State<MachineStateName, any, any, any, any>,
    StateName extends ChainStateName,
    StateActionDef extends ActionDef<MachineStateName, any, any>,
    _StateProps extends StateProps<any>,
    Children extends ChildrenMap<MachineStateName, any>
  > = Exclude<ChainStateName, StateName> extends never
    ? MachineFactory<
        | MachineState
        | BuilderChainState<
            MachineStateName,
            StateName,
            StateActionDef,
            _StateProps,
            Children
          >
      >
    : BuilderChain<
        MachineStateName,
        Exclude<ChainStateName, StateName>,
        | MachineState
        | BuilderChainState<
            MachineStateName,
            StateName,
            StateActionDef,
            _StateProps,
            Children
          >
      >;

  export type BuilderChainState<
    MachineStateName extends string,
    StateName extends MachineStateName,
    StateActionDef extends ActionDef<MachineStateName, any, any>,
    _StateProps extends StateProps<any>,
    Children extends ChildrenMap<MachineStateName, any>
  > = {
    name: StateName;
    actions: ActionFromDef<MachineStateName, StateName, StateActionDef>[];
    props: _StateProps;
    children: ToChildrenInstancesMap<Children>;
  };

  export type ChildExitsDef<
    ChildStateName extends string,
    ChildAction extends AnyAction<any, ChildStateName>,
    PartentStateName extends string
  > = {
    [Def in DefFromAction<ExtractExitAction<ChildAction>>]: PartentStateName;
  };

  export type AnyChildExitAction =
    | ChildExitActionForked<any, any, any, any>
    | ChildExitActionTransition<any, any, any>;

  export interface ChildExitActionForked<
    ChildActionName extends string,
    ChildFromStateName extends string,
    MachineToStateName extends string,
    ChildActionCondition extends string
  > {
    name: ChildActionName;
    condition: ChildActionCondition;
    from: ChildFromStateName;
    to: MachineToStateName;
  }

  export interface ChildExitActionTransition<
    ChildActionName extends string,
    ChildFromStateName extends string,
    MachineToStateName extends string
  > {
    name: ChildActionName;
    from: ChildFromStateName;
    to: MachineToStateName;
  }

  export interface ChildState<
    ChildFactory extends MachineFactory<any>,
    ExitAction extends AnyChildExitAction
  > {
    factory: ChildFactory;
    exits: ExitAction[];
  }

  export interface NamedChildState<
    ChildName extends string,
    ChildFactory extends MachineFactory<any>,
    ChildExitAction extends AnyChildExitAction
  > extends ChildState<ChildFactory, ChildExitAction> {
    name: ChildName;
  }

  export type ChildExitDefToAction<Def extends ChildExitsDef<any, any, any>> =
    Def extends `${infer FromState} -> ${infer ActionName}(${infer Condition}) -> ${infer ToState}`
      ? ChildExitActionForked<ActionName, FromState, ToState, Condition>
      : Def extends `${infer FromState} -> ${infer ActionName} -> ${infer ToState}`
      ? ChildExitActionTransition<ActionName, FromState, ToState>
      : never;

  export interface ChildrenBuilderChain<MachineStateName extends string> {
    child<
      ChildMachine extends MachineFactory<any>,
      ChildExitDef extends ChildMachine extends MachineFactory<infer State>
        ? ChildExitsDef<State["name"], MachineAction<State>, MachineStateName>
        : never
    >(
      factory: ChildMachine,
      ...args: ChildMachine extends MachineFactory<infer ChildState>
        ? EntryStateName<ChildState> extends infer ChildEntryStateName
          ? QUtils.IsUnion<ChildEntryStateName> extends true
            ? keyof ChildExitDef extends never
              ? [ChildEntryStateName]
              : [ChildEntryStateName, ChildExitDef]
            : keyof ChildExitDef extends never
            ? [ChildEntryStateName] | []
            : [ChildEntryStateName, ChildExitDef] | [ChildExitDef]
          : never
        : never
    ): ChildState<ChildMachine, ChildExitDefToAction<ChildExitDef>>;
  }

  export type ChildrenInstancesMap<
    ChildState extends NamedChildState<any, any, any>
  > = {
    [ChildStateName in ChildState["name"]]: ChildState extends {
      name: ChildStateName;
    }
      ? ChildState["factory"] extends MachineFactory<infer State>
        ? MachineInstance<State>
        : never
      : never;
  };

  export type ToChildrenInstancesMap<Map extends ChildrenMap<any, any>> = {
    [ChildStateName in keyof Map]: Map[ChildStateName] extends ChildState<
      infer ChildFactory,
      any
    >
      ? ChildFactory extends MachineFactory<infer State>
        ? MachineInstance<State>
        : never
      : never;
  };

  export type ChildrenMap<
    MachineStateName extends string,
    ChildState extends NamedChildState<any, any, any>
  > = {
    [ChildStateName in ChildState["name"]]: ChildState extends {
      name: ChildStateName;
    }
      ? ChildState
      : never;
  };

  export type ChildrenGenerator<
    MachineStateName extends string,
    Children extends ChildrenMap<MachineStateName, any>
  > = (builder: ChildrenBuilderChain<MachineStateName>) => Children;

  export interface BuilderChain<
    MachineStateName extends string,
    ChainStateName extends MachineStateName,
    MachineState extends State<MachineStateName, any, any, any, any> = never
  > {
    state<StateName extends ChainStateName>(
      name: StateName
    ): BuilderChainResult<
      MachineStateName,
      ChainStateName,
      MachineState,
      StateName,
      never,
      { Entry: false },
      never
    >;

    state<
      StateName extends ChainStateName,
      StateActionDef extends ActionDef<MachineStateName, any, any>
    >(
      name: StateName,
      actions: StateActionDef | StateActionDef[]
    ): BuilderChainResult<
      MachineStateName,
      ChainStateName,
      MachineState,
      StateName,
      StateActionDef,
      { Entry: false },
      never
    >;

    state<
      StateName extends ChainStateName,
      StateActionDef extends ActionDef<MachineStateName, any, any>,
      Children extends ChildrenMap<MachineStateName, any>
    >(
      name: StateName,
      actions: StateActionDef | StateActionDef[],
      children: ChildrenGenerator<MachineStateName, Children>
    ): BuilderChainResult<
      MachineStateName,
      ChainStateName,
      MachineState,
      StateName,
      StateActionDef,
      { Entry: false },
      Children
    >;

    entry<
      StateName extends ChainStateName,
      StateActionDef extends ActionDef<MachineStateName, any, any> = never
    >(
      name: StateName,
      actions?: StateActionDef | StateActionDef[]
    ): BuilderChainResult<
      MachineStateName,
      ChainStateName,
      MachineState,
      StateName,
      StateActionDef,
      { Entry: true },
      never
    >;

    entry<
      StateName extends ChainStateName,
      StateActionDef extends ActionDef<MachineStateName, any, any>,
      Children extends ChildrenMap<MachineStateName, any>
    >(
      name: StateName,
      actions: StateActionDef | StateActionDef[],
      children: ChildrenGenerator<MachineStateName, Children>
    ): BuilderChainResult<
      MachineStateName,
      ChainStateName,
      MachineState,
      StateName,
      StateActionDef,
      { Entry: true },
      Children
    >;
  }
}

// @ts-expect-error: This is fine, it's just a placeholder
export const q2: QQ.Builder2 = (() => {}) as QQ.Builder2;
