export function superstate(statechartName) {
  const states = [];
  let bindings;

  // MARK: builder
  function createBuilder() {
    const self = {
      // MARK: host
      host(bindings_) {
        bindings = bindings_;
        const initialState = states[0];
        return createInstance(initialState);
      },
    };

    Object.assign(self, {
      state: state.bind(null, self, false),
      final: state.bind(null, self, true),
    });

    return self;

    // MARK: state
    function state(self, final, stateName, arg1, arg2) {
      const traitsStrs =
        typeof arg1 === "function" ? [] : [].concat(arg1 || []);
      const builderFn = typeof arg1 === "function" ? arg1 : arg2;
      const fromDef = transitionFromDef.bind(null, stateName);

      const transitions = [];
      const actions = [];

      traitsStrs.forEach((def) => {
        const transition = transitionFromDef(stateName, def);
        if (transition) return transitions.push(transition);

        const action = actionFromDef(def);
        actions.push(action);
      });

      traitsStrs.map(fromDef);
      const sub = {};

      const state = {
        name: stateName,
        transitions,
        actions,
        sub,
        final,
      };

      function createStateBuilder() {
        return {
          // MARK: state->on
          on(defs) {
            const push = (def) => transitions.push(fromDef(def));
            if (Array.isArray(defs)) defs.forEach(push);
            else push(defs);
            return this;
          },

          // MARK: state->if
          if(eventName, conditions) {
            [].concat(conditions).forEach((condition) => {
              transitions.push(fromDef(eventName + condition));
            });
            return this;
          },

          // MARK: state->sub
          sub(substateName, factory, transitionDefs) {
            const transitions = []
              .concat(transitionDefs || [])
              .map(exitTransitionFromDef);
            sub[substateName] = {
              name: substateName,
              factory,
              transitions,
            };
            return this;
          },

          // MARK: state->enter
          enter(actionDef) {
            actions.push({ type: "enter", name: parseActionName(actionDef) });
            return this;
          },

          // MARK: state->enter
          exit(actionDef) {
            actions.push({ type: "exit", name: parseActionName(actionDef) });
            return this;
          },
        };
      }

      if (builderFn) builderFn(createStateBuilder());

      states.push(state);

      return self;
    }
  }

  // MARK: instance
  function createInstance(initialState) {
    let finalized = false;
    const subscriptions = [];
    const subscriptionOffs = new Map();

    let currentState;
    setCurrentState(initialState);

    // TODO: Rewrite with class
    return {
      get state() {
        return currentState;
      },

      get finalized() {
        return finalized;
      },

      // MARK: in
      in(deepSatateNameArg) {
        for (const deepStateName of [].concat(deepSatateNameArg)) {
          const [path, stateName] = parseDeepPath(deepStateName);
          if (path.length) {
            const substate = findSubstate(this, path);
            const substateResult = substate?.in(stateName);
            if (substateResult) return substateResult;
          } else if (currentState.name === stateName) return currentState;
        }
        return null;
      },

      // MARK: on
      on(targetStr, listener) {
        const targets = [].concat(targetStr).map(subscriptionTargetFromStr);

        const subscription = {
          targets,
          listener,
        };

        subcribeSubstates(subscription);

        subscriptions.push(subscription);

        return () => {
          const index = subscriptions.indexOf(subscription);
          const unsubscribed = subscriptions.splice(index, 1);
          unsubscribed.forEach((subscription) =>
            subscriptionOffs.get(subscription)?.forEach((off) => off())
          );
          subscriptionOffs.delete(subscription);
        };
      },

      // MARK: send
      send(eventSignature, argCondition) {
        const [path, eventName, signatureCondition] =
          parseEventSignature(eventSignature);
        const condition = argCondition || signatureCondition;

        // It's a substate
        if (path.length) {
          const substate = findSubstate(this, path);
          // TODO: Skip parsing?
          substate?.send(eventName + "()", condition);
          return;
        }

        const transition = findTransition(eventName, condition);
        if (!transition) return null;

        const nextState = findTransitionTarget(transition);
        if (!nextState) return null;

        triggerEventListeners(transition);

        setCurrentState(nextState);

        return nextState;
      },

      // MARK: off
      off() {
        offSubstates();
        subscriptions.length = 0;
      },
    };

    function registerSubscriptionListener(subscription, listener) {
      let set = subscriptionOffs.get(subscription);
      if (!set) {
        set = new Set();
        subscriptionOffs.set(subscription, set);
      }
      set.add(listener);
    }

    function subcribeSubstates(subscription, mint) {
      // TODO: Do not create double listeners for multiple targets
      const substateTargets = new Map();
      const push = (substate, target) => {
        let arr = substateTargets.get(substate);
        if (!arr) {
          arr = [];
          substateTargets.set(substate, arr);
        }
        arr.push(target);
      };

      subscription.targets.forEach((target) => {
        if (target.type == "substate") {
          const [expectedState, substateName, ...rest] = target.path;
          if (currentState.name !== expectedState) return;
          const substate = currentState.sub[substateName];
          push(
            substate,
            (rest.length ? `${rest.join(".")}.` : "") + target.signature
          );
        } else if (target.type === "**") {
          Object.values(currentState.sub).map((substate) =>
            push(substate, "**")
          );
        }
      });

      substateTargets.forEach((targets, substate) => {
        const off = substate.on(targets, subscription.listener);
        registerSubscriptionListener(subscription, off);
      });

      if (!mint) return;

      if (subscription.targets.some((target) => target.type === "**")) {
        const updates = [];
        function reduceSubstateUpdates(state) {
          Object.values(state.sub).forEach((substate) => {
            updates.push(substate.state);
            reduceSubstateUpdates(substate.state);
          });
        }
        reduceSubstateUpdates(currentState);
        updates.forEach((state) =>
          subscription.listener({ type: "state", state })
        );
      }
    }

    function findSubstate(self, path) {
      let accState = self;
      for (let i = 0; i < path.length; i += 2) {
        const name = path[i];
        const subName = path[i + 1];
        if (accState.state.name !== name) return;
        accState = accState.state.sub[subName];
      }
      return accState;
    }

    function setCurrentState(state) {
      const initial = !currentState;

      // Trigger exit actions
      !initial &&
        currentState.actions.forEach((action) => {
          if (action.type !== "exit") return;
          bindings[currentState.name]?.[`${action.name}! ->`]?.();
        });

      // Clean up the current state
      !initial && offSubstates();

      // Initialize substates
      const sub = Object.fromEntries(
        Object.entries(state.sub).map(([name, substate]) => {
          const instance = substate.factory.host();
          substate.transitions.forEach((transition) => {
            const landingState = findTransitionTarget(transition);
            instance.on(transition.from, () => {
              triggerEventListeners(transition);
              setCurrentState(landingState);
            });
          });
          return [name, instance];
        })
      );

      // Transition to the new state
      currentState = { ...state, sub };
      if (currentState.final) finalized = true;

      // Subscribe the substates
      subscriptions.forEach((subscription) =>
        subcribeSubstates(subscription, true)
      );

      // Trigger enter actions
      currentState.actions.forEach((action) => {
        if (action.type !== "enter") return;
        bindings[currentState.name]?.[`-> ${action.name}!`]?.();
      });

      !initial && triggerStateListeners(currentState);
    }

    function offSubstates() {
      Object.values(currentState.sub).forEach((substate) => substate.off());
    }

    function triggerStateListeners(state) {
      const stateListeners = subscriptions.reduce((acc, subscription) => {
        const matching = subscription.targets.some(
          (target) =>
            target.type === "**" ||
            target.type === "*" ||
            (target.type === "state" && target.state === state.name)
        );
        return matching ? acc.concat(subscription.listener) : acc;
      }, []);

      const stateChange = {
        type: "state",
        state,
      };

      stateListeners.forEach((listener) => {
        listener(stateChange);
      });
    }

    function triggerEventListeners(transition) {
      const eventListeners = subscriptions.reduce((acc, subscription) => {
        const matching = subscription.targets.some(
          (target) =>
            target.type === "**" ||
            target.type === "*" ||
            (target.type === "event" &&
              target.event === transition.event &&
              target.condition === transition.condition)
        );
        return matching ? acc.concat(subscription.listener) : acc;
      }, []);

      const eventChange = {
        type: "event",
        transition,
      };

      eventListeners.forEach((listener) => {
        listener(eventChange);
      });
    }

    function findTransition(eventName, condition) {
      for (const state of states) {
        for (const transition of state.transitions) {
          if (
            transition.event === eventName &&
            transition.condition === condition &&
            currentState.name === transition.from
          ) {
            return transition;
          }
        }
      }
    }

    function findTransitionTarget(transition) {
      return states.find((state) => state.name === transition.to);
    }
  }

  return createBuilder();
}

function transitionFromDef(from, def) {
  const captures = def.match(/^(\w+)\((\w*)\) -> (\w+)$/);
  if (!captures) return;
  const [_, event, condition, to] = captures;
  return {
    event,
    condition: condition || null,
    from,
    to,
    action: null,
  };
}

const eventSignatureRe = /^(\w+)\((\w*)\)$/;

function subscriptionTargetFromStr(str) {
  if (str === "**" || str === "*") return { type: str };

  const [path, signature] = parseDeepPath(str);

  if (path.length)
    return {
      type: "substate",
      path,
      signature,
    };

  const eventCaptures = str.match(eventSignatureRe);
  if (eventCaptures)
    return {
      type: "event",
      event: eventCaptures[1],
      condition: eventCaptures[2] || null,
    };

  return {
    type: "state",
    state: str,
  };
}

function parseEventSignature(str) {
  const [path, signature] = parseDeepPath(str);
  const [_, event, condition] = signature.match(eventSignatureRe);
  return [path, event, condition || null];
}

function parseDeepPath(str) {
  const path = str.split(".");
  const name = path.pop();
  return [path, name];
}

const exitTransitionDefRe = /^(\w+)+ -> (\w+)\(\) -> (\w+)+$/;

function exitTransitionFromDef(def) {
  const captures = def.match(exitTransitionDefRe);
  const [_, from, event, to] = captures;
  return { event, from, to, condition: null };
}

const actionRe = /^(\w+)\!$/;

function parseActionName(def) {
  return def.match(actionRe)[1];
}

const actionDefRe = /^(-> )?(\w+)\!( ->)?$/;

function actionFromDef(def) {
  const [_, enterProbe, name] = def.match(actionDefRe);
  return {
    type: enterProbe ? "enter" : "exit",
    name,
  };
}
