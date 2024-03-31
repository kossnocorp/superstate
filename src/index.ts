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
  > =
    | ActionTransition<ActionName, MachineStateName, FromStateName, any>
    | ActionTransitionFork<
        ActionName,
        MachineStateName,
        FromStateName,
        any,
        string
      >;

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
      >;

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

  export interface MachineFactory<
    MachineState extends BuilderChainState<any, any, any, any, any, any>
  > {
    enter(): MachineInstance<
      MachineState,
      MachineAction<MachineState>,
      boolean
    >;
  }

  export interface Off {
    (): void;
  }

  export type OnTarget<
    MachineState extends { name: string },
    MachineAction extends AnyAction
  > = "*" | StateTarget<MachineState> | `${MachineAction["name"]}()`;

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
          ? Children[ChildName] extends MachineInstance<
              infer ChildState,
              any,
              any
            >
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
          ? Children[ChildName] extends MachineInstance<
              infer ChildState,
              any,
              any
            >
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
          ? Children[keyof Children] extends MachineInstance<
              infer ChildState,
              any,
              any
            >
            ? DeepAllState<ChildState>
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
        children: infer Children extends Record<string, any>;
      }
        ? keyof Children extends infer ChildName extends string
          ? Children[ChildName] extends MachineInstance<
              infer ChildState,
              any,
              any
            >
            ? EventTarger<ChildState, `${ParentStateName}.${ChildName}`>
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
          ? Children[ChildName] extends MachineInstance<
              infer ChildState,
              any,
              any
            >
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
          ? Children[keyof Children] extends MachineInstance<
              infer ChildState,
              any,
              any
            >
            ? DeepAllAction<ChildState>
            : never
          : never
        : never);

  export type Event<_State extends { name: string }, MachineAction> =
    | TargetState<DeepAllState<_State>>
    | TargetEvent<MachineAction>;

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
    MachineState extends { name: string },
    MachineAction extends AnyAction,
    Target extends OnTarget<MachineState, any>
  > {
    (
      // TODO: Add listening to events
      target: Target extends "*"
        ? Event<MachineState, MachineAction>
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

  export type ExtractConditionAction<MachineAction extends AnyAction> = Extract<
    MachineAction,
    ActionTransitionFork<any, any, any, any, any>
  >;

  export type ExcludeConditionAction<MachineAction extends AnyAction> = Exclude<
    MachineAction,
    ActionTransitionFork<any, any, any, any, any>
  >;

  export type MatchNextStateName<
    MachineState extends AnyState, // TODO: Cut it
    ActionName
  > = MachineState extends { actions: Array<infer Action> }
    ? Action extends {
        name: ActionName;
        to: infer ToStateName extends string;
      }
      ? ToStateName
      : never
    : never;

  export type MachineInstance<
    MachineState extends AnyState, // TODO: Cut it
    Action extends AnyAction,
    Finalized extends boolean
  > =
    // This is needed to make infer send return properly
    Finalized extends Finalized
      ? {
          finalized: Finalized;

          send<EventName extends Action["name"]>(
            action: EventName,
            // TODO: Optimize it, I can't have two send because it breaks
            // thanks to finalized. Before, I used generics that filtered events
            // and it worked.
            ...args: Action extends infer SendAction
              ? SendAction extends {
                  name: EventName;
                }
                ? SendAction extends ActionTransitionFork<
                    any,
                    any,
                    any,
                    any,
                    infer Condition
                  >
                  ? [Condition]
                  : []
                : []
              : never
          ): Finalized extends true
            ? null
            : MatchTargetState<
                MachineState,
                MatchNextStateName<MachineState, EventName>
              > | null;

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
    Children, // extends ChildrenInstancesMap<any> // optimization
    Final extends boolean
  > {
    name: StateName;
    actions: Action[];
    props: Props;
    children: Children;
    final: Final;
  }

  export type AnyState<
    MachineStateName extends string = string,
    StateName extends MachineStateName = MachineStateName,
    Action = any,
    Props = any,
    Children = any,
    Final extends boolean = boolean
  > = State<MachineStateName, StateName, Action, Props, Children, Final>;

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
    ? ActionTransition<ActionName, MachineStateName, FromStateName, ToState>
    : Def extends `${infer ActionName}(${infer Condition}) -> ${infer ToState extends MachineStateName}`
    ? ActionTransitionFork<
        ActionName,
        MachineStateName,
        FromStateName,
        ToState,
        Condition
      >
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
      ? `${FromStateName} -> ${ActionName}() -> ${ToStateName}`
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
  export type EntryStateName<State> = State extends {
    name: infer Name;
    props: { entry: true };
  }
    ? Name
    : never;

  export type BuilderChainResult<
    MachineStateName extends string,
    ChainStateName extends MachineStateName,
    MachineState extends AnyState<MachineStateName>,
    StateName extends ChainStateName,
    StateActionDef extends ActionDef<MachineStateName, any, any>,
    _StateProps extends StateProps<any>,
    Children extends ChildrenMap<MachineStateName, any>,
    Final extends boolean
  > = Exclude<ChainStateName, StateName> extends never
    ? MachineFactory<
        | MachineState
        | BuilderChainState<
            MachineStateName,
            StateName,
            StateActionDef,
            _StateProps,
            Children,
            Final
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
            Children,
            Final
          >
      >;

  export type BuilderChainState<
    MachineStateName extends string,
    StateName extends MachineStateName,
    StateActionDef extends ActionDef<MachineStateName, any, any>,
    _StateProps extends StateProps<any>,
    Children extends ChildrenMap<MachineStateName, any>,
    Final extends boolean
  > = {
    name: StateName;
    actions: ActionFromDef<MachineStateName, StateName, StateActionDef>[];
    props: _StateProps;
    children: ToChildrenInstancesMap<Children>;
    final: Final;
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
    Def extends `${infer FromState} -> ${infer ActionName}() -> ${infer ToState}`
      ? ChildExitActionTransition<ActionName, FromState, ToState>
      : Def extends `${infer FromState} -> ${infer ActionName}(${infer Condition}) -> ${infer ToState}`
      ? ChildExitActionForked<ActionName, FromState, ToState, Condition>
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
        ? MachineInstance<State, any>
        : never
      : never;
  };

  export type ToChildrenInstancesMap<Map extends ChildrenMap<any, any>> = {
    [ChildStateName in keyof Map]: Map[ChildStateName] extends ChildState<
      infer ChildFactory,
      any
    >
      ? ChildFactory extends MachineFactory<infer State>
        ? MachineInstance<State, any>
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
    MachineState extends AnyState<MachineStateName> = never
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
      never,
      false
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
      never,
      false
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
      Children,
      false
    >;

    // TODO: Limit to single entry
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
      never,
      false
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
      Children,
      false
    >;
  }
}

export namespace Superstate {
  // TODO: Utilize these types
  // export namespace Machine {
  //   export interface Action {
  //     type: "enter" | "exit";
  //   }

  //   export interface Transition {}

  //   export interface StateProps {
  //     initial: boolean;
  //     final: boolean;
  //     parallel: boolean;
  //   }

  //   export interface State extends StateProps {
  //     name: string;
  //     actions: Action;
  //     transitions: Transition;
  //   }
  // }

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

    export interface StateFnGeneratorBuilder<
      MachineStateName extends string,
      // ChainStateName extends MachineStateName,
      // StateName extends ChainStateName,
      StateActionDef extends QQ.ActionDef<MachineStateName, any, any> = never
    > {
      on<ActionDef extends QQ.ActionDef<MachineStateName, any, any>>(
        events: ActionDef[] | ActionDef
      ): StateFnGeneratorBuilder<
        MachineStateName,
        // ChainStateName,
        // StateName,
        StateActionDef | ActionDef
      >;
    }

    export interface StateFnGenerator<
      MachineStateName extends string,
      // ChainStateName extends MachineStateName,
      // StateName extends ChainStateName,
      StateActionDef extends QQ.ActionDef<MachineStateName, any, any>
    > {
      (
        $: StateFnGeneratorBuilder<MachineStateName /*ChainStateName, StateName*/>
      ): StateFnGeneratorBuilder<MachineStateName, StateActionDef>;
    }

    export type BuilderChainResult<
      MachineStateName extends string,
      ChainStateName extends MachineStateName,
      MachineState extends QQ.AnyState<MachineStateName>,
      StateName extends ChainStateName,
      StateActionDef extends QQ.ActionDef<MachineStateName, any, any>,
      _StateProps extends QQ.StateProps<any>,
      Children extends QQ.ChildrenMap<MachineStateName, any>,
      Final extends boolean
    > = Exclude<ChainStateName, StateName> extends never
      ? QQ.MachineFactory<
          | MachineState
          | QQ.BuilderChainState<
              MachineStateName,
              StateName,
              StateActionDef,
              _StateProps,
              Children,
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
              _StateProps,
              Children,
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
        { entry: false },
        never,
        Final
      >;

      <
        StateName extends ChainStateName,
        StateActionDef extends QQ.ActionDef<MachineStateName, any, any>
      >(
        name: StateName,
        generator: StateFnGenerator<
          MachineStateName,
          // ChainStateName,
          // StateName,
          StateActionDef
        >
      ): BuilderChainResult<
        MachineStateName,
        ChainStateName,
        MachineState,
        StateName,
        StateActionDef,
        { entry: false },
        never,
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
        { entry: false },
        never,
        Final
      >;

      <
        StateName extends ChainStateName,
        StateActionDef extends QQ.ActionDef<MachineStateName, any, any>
      >(
        name: StateName,
        actions: StateActionDef | StateActionDef[],
        generator: StateFnGenerator<
          MachineStateName,
          // ChainStateName,
          // StateName,
          StateActionDef
        >
      ): BuilderChainResult<
        MachineStateName,
        ChainStateName,
        MachineState,
        StateName,
        StateActionDef,
        { entry: false },
        never,
        Final
      >;
    }
  }
}

// @ts-expect-error: This is fine, it's just a placeholder
export const q2: QQ.Builder2 = (() => {}) as QQ.Builder2;

export const superstate: Superstate.Builder.Machine =
  // @ts-expect-error: This is fine, it's just a placeholder
  (() => {}) as Superstate.Builder.Machine;
