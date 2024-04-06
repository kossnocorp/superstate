export function superstate(statechartName) {
  const states = [];

  function createBuilder() {
    return new Proxy(
      {},
      {
        get(_, key, proxy) {
          switch (key) {
            case "state":
              return state.bind(null, proxy, false);

            case "final":
              return state.bind(null, proxy, true);

            case "host":
              return host;

            default:
              return;
          }
        },
      }
    );

    function state(proxy, final, stateName, arg1, arg2) {
      const traitsStrs =
        typeof arg1 === "function" ? [] : [].concat(arg1 || []);
      const builderFn = typeof arg1 === "function" ? arg1 : arg2;
      const fromDef = transitionFromDef.bind(null, stateName);

      const transitions = traitsStrs.map(fromDef);
      const actions = [];
      const sub = {};

      const state = {
        name: stateName,
        transitions,
        actions,
        sub,
        final,
      };

      function createStateBuilder() {
        return new Proxy(
          {},
          {
            get(_, key, proxy) {
              switch (key) {
                case "on":
                  return on.bind(null, proxy);

                case "if":
                  return if_.bind(null, proxy);

                case "sub":
                  return sub_.bind(null, proxy);
              }
            },
          }
        );

        function on(proxy, defs) {
          const push = (def) => transitions.push(fromDef(def));
          if (Array.isArray(defs)) defs.forEach(push);
          else push(defs);
          return proxy;
        }

        function if_(proxy, eventName, conditions) {
          [].concat(conditions).forEach((condition) => {
            transitions.push(fromDef(eventName + condition));
          });
          return proxy;
        }

        function sub_(proxy, substateName, factory, transitionDefs) {
          sub[substateName] = {
            name: substateName,
            factory,
            transitions: [], // TODO
          };
          return proxy;
        }
      }

      if (builderFn) builderFn(createStateBuilder());

      states.push(state);

      return proxy;
    }

    function host() {
      const initialState = states[0];
      return createHost(initialState);
    }
  }

  function createHost(initialState) {
    let finalized = false;
    const subscriptions = [];

    let currentState;
    setCurrentState(initialState);

    return new Proxy(
      {},
      {
        get(_, key, proxy) {
          switch (key) {
            case "state":
              return currentState;

            case "on":
              return on.bind(null, proxy);

            case "send":
              return send.bind(null, proxy);

            case "in":
              return in_;

            case "finalized":
              return finalized;

            default:
              return undefined;
          }
        },
      }
    );

    function in_(stateName) {
      if (Array.isArray(stateName)) {
        if (!stateName.some((name) => currentState.name === name)) return null;
      } else if (currentState.name !== stateName) return null;
      return currentState;
    }

    function on(proxy, targetStr, listener) {
      const targets = [].concat(targetStr).map(subscriptionTargetFromStr);

      const subscription = {
        targets,
        listener,
      };

      subscriptions.push(subscription);

      return () => {
        const index = subscriptions.indexOf(subscription);
        const unsubscribed = subscriptions.splice(index, 1);
        unsubscribed.forEach((subscription) =>
          subscription.targets.forEach((target) => target.off?.())
        );
      };
    }

    function send(proxy, eventSignature, argCondition) {
      const [path, eventName, signatureCondition] =
        parseEventSignature(eventSignature);
      const condition = argCondition || signatureCondition;

      // It's a substate
      if (path.length) {
        const substate = findSubstate(proxy, path);
        // TODO: Skip parsing?
        substate?.send(eventName + "()", condition);
        return;
      }

      const transition = findTransition(eventName, condition);
      if (!transition) return null;

      const nextState = findTransitionTarget(transition);
      if (!nextState) return null;

      const eventListeners = subscriptions.reduce((acc, subscription) => {
        const matching = subscription.targets.some(
          (target) =>
            target.type === "*" ||
            (target.type === "event" &&
              target.event === eventName &&
              target.condition === condition)
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

      setCurrentState(nextState);

      const stateListeners = subscriptions.reduce((acc, subscription) => {
        const matching = subscription.targets.some(
          (target) =>
            target.type === "*" ||
            (target.type === "state" && target.state === currentState.name)
        );
        return matching ? acc.concat(subscription.listener) : acc;
      }, []);

      const stateChange = {
        type: "state",
        state: currentState,
      };

      stateListeners.forEach((listener) => {
        listener(stateChange);
      });

      return nextState;
    }

    function findSubstate(proxy, path) {
      let accState = proxy;
      for (let i = 0; i < path.length; i += 2) {
        const name = path[i];
        const subName = path[i + 1];
        if (accState.state.name !== name) return;
        accState = accState.state.sub[subName];
      }
      return accState;
    }

    function setCurrentState(state) {
      const sub = Object.fromEntries(
        Object.entries(state.sub).map(([name, substate]) => [
          name,
          substate.factory.host(),
        ])
      );

      currentState = { ...state, sub };
      if (currentState.final) finalized = true;

      subscriptions.forEach((subscription) => {
        subscription.targets.forEach((target) => {
          if (target.type !== "substate") return;

          const [expectedState, substateName, ...rest] = target.path;
          if (currentState.name !== expectedState) return;
          const substate = currentState.sub[substateName];
          target.off = substate.on(
            (rest.length ? `${rest.join(".")}.` : "") + target.signature,
            subscription.listener
          );
        });
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
  if (str === "*") return { type: "*" };

  const path = str.split(".");
  const signature = path.pop();

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
    state: str, // TODO: Validate?
  };
}

function parseEventSignature(str) {
  const path = str.split(".");
  const signature = path.pop();
  const [_, event, condition] = signature.match(eventSignatureRe);
  return [path, event, condition || null];
}
