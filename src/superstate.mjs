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
      }

      if (builderFn) builderFn(createStateBuilder());

      states.push({
        name: stateName,
        transitions,
        actions: [],
        sub: {},
        final,
      });
      return proxy;
    }

    function host() {
      const initialState = states[0];
      return createHost(initialState);
    }
  }

  function createHost(initialState) {
    let finalized = false;
    let currentState = initialState;
    const subscriptions = [];

    return new Proxy(
      {},
      {
        get(_, key, proxy) {
          switch (key) {
            case "state":
              return currentState;

            case "on":
              return on;

            case "send":
              return send;

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

    function on(targetStr, listener) {
      const targets = [].concat(targetStr).map(subscriptionTargetFromStr);

      const subscription = {
        targets,
        listener,
      };

      subscriptions.push(subscription);

      return () => {
        const index = subscriptions.indexOf(subscription);
        subscriptions.splice(index, 1);
      };
    }

    function send(eventSignature, argCondition) {
      const [eventName, signatureCondition] =
        eventFromSignature(eventSignature);
      const condition = argCondition || signatureCondition;

      const transition = findTransition(eventName, condition || null);
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

      currentState = nextState;
      if (currentState.final) finalized = true;

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

const eventRe = /^(\w+)\((\w*)\)$/;

function subscriptionTargetFromStr(str) {
  if (str === "*") return { type: "*" };

  const eventCaptures = str.match(eventRe);
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

function eventFromSignature(signature) {
  const [_, event, condition] = signature.match(eventRe);
  return [event, condition || null];
}
