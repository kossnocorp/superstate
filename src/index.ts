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
  // TODO: Rename action -> event everywhere
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
    MachineState extends { name: string },
    MachineAction extends AnyAction
  > = "*" | StateTarget<MachineState> | MachineAction["name"];

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
        children: infer Children extends Record<string, any>;
      }
        ? keyof Children extends infer ChildName extends string
          ? Children[ChildName] extends MachineInstance<infer ChildState>
            ? StateTarget<ChildState, `${ParentStateName}.${ChildName}`>
            : never
          : never
        : never);

  export type MatchTargetState<
    MachineState extends { name: string },
    Target extends string
  > =
    // First we get the root level states
    | (MachineState extends { name: Target } ? MachineState : never)
    // Then we get the children states
    | (MachineState extends {
        name: infer ParentStateName extends string;
        children: infer Children extends Record<string, any>;
      }
        ? keyof Children extends infer ChildName extends string
          ? Children[ChildName] extends MachineInstance<infer ChildState>
            ? Target extends `${ParentStateName}.${ChildName}.${infer ChildTarget}`
              ? MatchTargetState<ChildState, ChildTarget>
              : never
            : never
          : never
        : never);

  export type DeepAllState<MachineState> =
    // First we get the root level states
    | MachineState
    // Then we add the children states
    | (MachineState extends { children: infer Children }
        ? Children extends Record<string, any>
          ? Children[keyof Children] extends MachineInstance<infer ChildState>
            ? DeepAllState<ChildState>
            : never
          : never
        : never);

  export type ActionTarger<
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
        children: infer Children extends Record<string, any>;
      }
        ? keyof Children extends infer ChildName extends string
          ? Children[ChildName] extends MachineInstance<infer ChildState>
            ? ActionTarger<ChildState, `${ParentStateName}.${ChildName}`>
            : never
          : never
        : never);

  export type MatchTargetAction<
    MachineState extends { name: string },
    Target extends string
  > =
    // First we get the children states, so we don't match qwe.asd.zxc() as zxc
    | (MachineState extends {
        name: infer ParentStateName extends string;
        children: infer Children extends Record<string, any>;
      }
        ? keyof Children extends infer ChildName extends string
          ? Children[ChildName] extends MachineInstance<infer ChildState>
            ? Target extends `${ParentStateName}.${ChildName}.${infer ChildTarget}`
              ? MatchTargetAction<ChildState, ChildTarget>
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

  export type DeepAllAction<MachineState> =
    // First we get the root level actions
    | (MachineState extends { actions: Array<infer Action> } ? Action : never)
    // Then we add the children actions
    | (MachineState extends { children: infer Children }
        ? Children extends Record<string, any>
          ? Children[keyof Children] extends MachineInstance<infer ChildState>
            ? DeepAllAction<ChildState>
            : never
          : never
        : never);

  export type Event<_State extends { name: string }, MachineAction> =
    | EventState<DeepAllState<_State>>
    | EventAction<MachineAction>;

  export interface EventState<_State extends { name: string }> {
    type: "state";
    state: _State;
  }

  export interface EventAction<MachineAction> {
    type: "event";
    event: MachineAction;
    // TODO: from, to, condition
  }

  export interface OnListener<
    MachineState extends { name: string },
    MachineAction extends AnyAction,
    Target extends OnTarget<MachineState, any>
  > {
    (
      event: Target extends "*"
        ? Event<MachineState, MachineAction>
        : Target extends
            | Array<infer TargetString extends string>
            | infer TargetString extends string
        ? EventState<MatchTargetState<MachineState, TargetString>> // EventState<_State extends { name: StateTarget } ? _State : never>
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
    MachineState extends State<any, any, any, any, any> // TODO: Cut it
  > = MachineAction<MachineState> extends infer Action extends AnyAction // TODO: Cut it
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

        on<Target extends OnTarget<MachineState, Action>>(
          target: Target | Target[],
          listener: OnListener<MachineState, Action, Target>
        ): Off;

        in<Target extends StateTarget<MachineState>>(
          target: Target | Target[]
        ): MatchTargetState<MachineState, Target> | undefined;
      }
    : never;

  export interface State<
    MachineStateName extends string,
    StateName extends MachineStateName,
    Action, // extends StateAction<MachineStateName, StateName>, // optimization
    Props, // extends StateProps<boolean>, // optimization
    Children // extends ChildrenInstancesMap<any> // optimization
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
    entry: Entry;
  }

  type MachineAction<MachineState> = MachineState extends {
    actions: Array<infer Action>;
  }
    ? Action
    : never;

  /**
   * Infers the entry state name from the machine state.
   */
  type EntryStateName<State> = State extends {
    name: infer Name;
    props: { entry: true };
  }
    ? Name
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

  // TODO: It seems like the name can't be infered, investigate and remove
  // this generic
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
    _ChildState extends NamedChildState<any, any, any>
  > = {
    [ChildStateName in _ChildState["name"]]: _ChildState extends {
      name: ChildStateName;
    }
      ? _ChildState["factory"] extends MachineFactory<infer State>
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
      { entry: false },
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
      { entry: false },
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
      { entry: false },
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
      { entry: true },
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
      { entry: true },
      Children
    >;
  }
}

// @ts-expect-error: This is fine, it's just a placeholder
export const q2: QQ.Builder2 = (() => {}) as QQ.Builder2;
