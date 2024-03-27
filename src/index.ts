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
  export interface Generator<StateName extends string> {
    (q: GeneratorHelpers<StateName> & any): StateMap<StateName>;
  }

  export interface GeneratorHelpers<StateName extends string> {
    (): State<StateName>;

    entry(): State<StateName, true>;
  }

  export type StateMap<StateName extends string> = {
    [Name in StateName]: State<StateName, boolean>;
  };

  export interface State<
    StateName extends string,
    Entry extends boolean = false
  > {
    entry: Entry;
  }

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
    MachineStateName extends string,
    MachineAction extends AnyAction<any, MachineStateName>,
    EntryState extends MachineStateName
  > {
    enter(
      ...args: QUtils.IsUnion<EntryState> extends true
        ? [EntryState]
        : [] | [EntryState]
    ): MachineInstance<MachineStateName, MachineAction>;
  }

  export interface Off {
    (): void;
  }

  export type OnTarget<
    StateName extends string,
    MachineAction extends AnyAction
  > = "*" | StateName | MachineAction["name"];

  export type Event<
    StateName extends string,
    MachineAction extends AnyAction
  > = EventState<StateName> | EventAction<MachineAction>;

  export interface EventState<StateName extends string> {
    type: "state";
    state: StateName;
  }

  export interface EventAction<MachineAction extends AnyAction> {
    type: "action";
    action: MachineAction;
    // TODO: from, to, condition
  }

  export interface OnListener<
    StateName extends string,
    MachineAction extends AnyAction,
    Target extends OnTarget<string, any>
  > {
    (
      event: Target extends "*"
        ? Event<StateName, MachineAction>
        : Target extends
            | Array<infer StateTarget extends StateName>
            | infer StateTarget extends StateName
        ? EventState<StateTarget>
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

  export interface MachineInstance<
    MachineStateName extends string,
    MachineAction extends AnyAction<MachineStateName>
  > {
    send<ActionName extends ExtractConditionAction<MachineAction>["name"]>(
      action: ActionName,
      condition: MachineAction extends {
        name: ActionName;
        condition: infer Condition;
      }
        ? Condition
        : never
    ): void;

    send<ActionName extends ExcludeConditionAction<MachineAction>["name"]>(
      action: ActionName
    ): void;

    on<Target extends OnTarget<MachineStateName, MachineAction>>(
      target: Target | Target[],
      listener: OnListener<MachineStateName, MachineAction, Target>
    ): Off;
  }

  export interface Builder {
    <
      StateName extends string,
      MachineAction extends AnyAction<any, StateName>,
      EntryState extends StateName
    >(
      name: string,
      generator: Generator<StateName>
    ): MachineFactory<StateName, MachineAction, EntryState>;
  }

  export interface State2<
    MachineStateName extends string,
    StateName extends MachineStateName,
    Action extends StateAction<MachineStateName, StateName>,
    Props extends StateProps<boolean>
  > {
    name: StateName;
    actions: Action[];
    props: Props;
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

  type MachineAction<MachineState extends State2<any, any, any, any>> =
    MachineState extends State2<any, any, infer Action, any> ? Action : never;

  type EntryStateName<MachineState extends State2<any, any, any, any>> =
    MachineState extends State2<any, any, any, infer Props>
      ? Props["Entry"] extends true
        ? MachineState["name"]
        : never
      : never;

  type BuilderChainResult<
    MachineStateName extends string,
    ChainStateName extends MachineStateName,
    MachineState extends State2<MachineStateName, any, any, any>,
    StateName extends ChainStateName,
    StateActionDef extends ActionDef<MachineStateName, any, any>,
    _StateProps extends StateProps<any>
  > = Exclude<ChainStateName, StateName> extends never
    ? BuilderChainResultFactory<
        | MachineState
        | BuilderChainState<
            MachineStateName,
            StateName,
            StateActionDef,
            _StateProps
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
            _StateProps
          >
      >;

  export type BuilderChainResultFactory<
    MachineState extends State2<any, any, any, any>
  > = MachineFactory<
    MachineState["name"],
    MachineAction<MachineState>,
    EntryStateName<MachineState>
  >;

  export type BuilderChainState<
    MachineStateName extends string,
    StateName extends MachineStateName,
    StateActionDef extends ActionDef<MachineStateName, any, any>,
    _StateProps extends StateProps<any>
  > = {
    name: StateName;
    actions: ActionFromDef<MachineStateName, StateName, StateActionDef>[];
    props: _StateProps;
  };

  interface StateChild {}

  export type ChildExitsDef<
    ChildStateName extends string,
    ChildAction extends AnyAction<any, ChildStateName>,
    PartentStateName extends string
  > = {
    [Def in DefFromAction<ExtractExitAction<ChildAction>>]: PartentStateName;
  };

  export type ChildExit = {};

  export interface ChildState<
    MachineStateName extends string,
    ChildStateName extends string
  > {
    name: ChildStateName;
    factory: MachineFactory<any, any, any>;
    exits: ChildExit[];
  }

  export interface ChildrenBuilderChain<
    MachineStateName extends string,
    Child extends StateChild = never
  > {
    child<ChildMachine extends MachineFactory<any, any, any>>(
      factory: ChildMachine,
      ...args: ChildMachine extends MachineFactory<
        infer ChildStateName,
        infer ChildAction,
        infer ChildEntryStateName
      >
        ? QUtils.IsUnion<ChildEntryStateName> extends true
          ? [
              ChildEntryStateName,
              ChildExitsDef<ChildStateName, ChildAction, MachineStateName>
            ]
          : // TODO:
            [never]
        : never
    ): any; // TODO:
  }

  export type ChildrenMap<
    MachineStateName extends string,
    ChildrenStateNam extends string
  > = {
    [ChildStateName in ChildrenStateNam]: ChildState<
      MachineStateName,
      ChildStateName
    >;
  };

  export type ChildrenGenerator<
    MachineStateName extends string,
    ChildrenStateName extends string
  > = (
    builder: ChildrenBuilderChain<MachineStateName>
  ) => ChildrenMap<MachineStateName, ChildrenStateName>;

  export interface BuilderChain<
    MachineStateName extends string,
    ChainStateName extends MachineStateName,
    MachineState extends State2<MachineStateName, any, any, any> = never
  > {
    state<StateName extends ChainStateName>(
      name: StateName
    ): BuilderChainResult<
      MachineStateName,
      ChainStateName,
      MachineState,
      StateName,
      never,
      { Entry: false }
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
      { Entry: false }
    >;

    state<
      StateName extends ChainStateName,
      StateActionDef extends ActionDef<MachineStateName, any, any>
    >(
      name: StateName,
      actions: StateActionDef | StateActionDef[],
      children: ChildrenGenerator<MachineStateName, any>
      // TODO: Result
    ): BuilderChainResult<
      MachineStateName,
      ChainStateName,
      MachineState,
      StateName,
      StateActionDef,
      { Entry: false }
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
      { Entry: true }
    >;
  }
}

// @ts-expect-error: This is fine, it's just a placeholder
export const q: QQ.Builder = (() => {}) as QQ.Builder;

// @ts-expect-error: This is fine, it's just a placeholder
export const q2: QQ.Builder2 = (() => {}) as QQ.Builder2;
