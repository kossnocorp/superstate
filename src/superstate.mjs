export function superstate(name) {
  const states = [];
  let bindings;

  // MARK: builder
  function createBuilder() {
    const self = {
      name,

      // MARK: host
      host(bindings_) {
        bindings = bindings_ || {};
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
      const state = {
        name: stateName,
        transitions: [],
        actions: [],
        sub: {},
        final,
      };

      (typeof arg1 === "function" ? [] : [].concat(arg1 || [])).forEach(
        (def) => {
          const transition = transitionFromDef(stateName, def);
          if (transition) return state.transitions.push(transition);
          state.actions.push(actionFromDef(def));
        }
      );

      const builderFn = typeof arg1 === "function" ? arg1 : arg2;
      if (builderFn)
        builderFn({
          // MARK: state->on
          on(defs) {
            []
              .concat(defs)
              .forEach((def) =>
                state.transitions.push(transitionFromDef(stateName, def))
              );
            return this;
          },

          // MARK: state->if
          if(eventName, conditions) {
            []
              .concat(conditions)
              .forEach((condition) =>
                state.transitions.push(
                  transitionFromDef(stateName, eventName + condition)
                )
              );
            return this;
          },

          // MARK: state->sub
          sub(name, factory, transitionDefs) {
            state.sub[name] = {
              name,
              factory,
              transitions: []
                .concat(transitionDefs || [])
                .map(exitTransitionFromDef),
            };
            return this;
          },

          // MARK: state->enter
          enter(actionDef) {
            state.actions.push({
              type: "enter",
              name: parseActionName(actionDef),
            });
            return this;
          },

          // MARK: state->enter
          exit(actionDef) {
            state.actions.push({
              type: "exit",
              name: parseActionName(actionDef),
            });
            return this;
          },
        });

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
            const substateResult = findSubstate(this, path)?.in(stateName);
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
          findSubstate(this, path)?.send(eventName + "()", condition);
          return;
        }

        const transition = findTransition(eventName, condition);
        if (!transition) return null;

        const nextState = findTransitionTarget(transition);
        if (!nextState) return null;

        transition.action &&
          bindings[currentState.name]?.[
            `${transition.event}(${transition.condition || ""}) -> ${
              transition.action.name
            }!`
          ]?.();

        triggerListeners("event", transition);

        setCurrentState(nextState);

        return nextState;
      },

      // MARK: off
      off() {
        offSubstates();
        subscriptions.length = 0;
      },
    };

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
        let set = subscriptionOffs.get(subscription);
        if (!set) {
          set = new Set();
          subscriptionOffs.set(subscription, set);
        }
        set.add(off);
      });

      if (!mint) return;

      if (subscription.targets.some((target) => target.type === "**")) {
        const updates = [];
        (function reduceSubstateUpdates(state) {
          Object.values(state.sub).forEach((substate) => {
            updates.push(substate.state);
            reduceSubstateUpdates(substate.state);
          });
        })(currentState);
        updates.forEach((state) =>
          subscription.listener({ type: "state", state })
        );
      }
    }

    function findSubstate(self, path) {
      let accState = self;
      for (let i = 0; i < path.length; i += 2) {
        if (accState.state.name !== path[i]) return;
        accState = accState.state.sub[path[i + 1]];
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
          const instance = substate.factory.host(bindings[state.name]?.[name]);
          substate.transitions.forEach((transition) => {
            const landingState = findTransitionTarget(transition);
            instance.on(transition.from, () => {
              triggerListeners("event", transition);
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

      !initial && triggerListeners("state", currentState);
    }

    function offSubstates() {
      Object.values(currentState.sub).forEach(({ off }) => off());
    }

    function triggerListeners(type, entity) {
      const listeners = [];
      subscriptions.forEach((subscription) => {
        subscription.targets.some(
          (target) =>
            target.type === "**" ||
            target.type === "*" ||
            (target.type === type &&
              (type === "event"
                ? target.event === entity.event &&
                  target.condition === entity.condition
                : target.state === entity.name))
        ) && listeners.push(subscription.listener);
      });

      const update = {
        type,
        [type === "event" ? "transition" : type]: entity,
      };

      listeners.forEach((listener) => listener(update));
    }

    function findTransition(eventName, condition) {
      for (const state of states) {
        for (const transition of state.transitions) {
          if (
            transition.event === eventName &&
            transition.condition === condition &&
            currentState.name === transition.from
          )
            return transition;
        }
      }
    }

    function findTransitionTarget(transition) {
      return states.find((state) => state.name === transition.to);
    }
  }

  return createBuilder();
}

const transitionDefRe = /^(\w+)\((\w*)\)(?: -> (\w+)\!)? -> (\w+)$/;

function transitionFromDef(from, def) {
  const captures = def.match(transitionDefRe);
  if (!captures) return;
  const [_, event, condition, action, to] = captures;
  return {
    event,
    condition: condition || null,
    from,
    to,
    action: action ? { name: action } : null,
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

  const captures = str.match(eventSignatureRe);
  if (captures)
    return {
      type: "event",
      event: captures[1],
      condition: captures[2] || null,
    };

  return {
    type: "state",
    state: str,
  };
}

function parseEventSignature(str) {
  const [path, signature] = parseDeepPath(str);
  const [, event, condition] = signature.match(eventSignatureRe);
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
