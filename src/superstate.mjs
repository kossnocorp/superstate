export function superstate(statechartName) {
  const states = [];

  function createBuilder() {
    return new Proxy(
      {},
      {
        get(_, key, proxy) {
          switch (key) {
            case "state":
              return (stateName, arg1) => {
                const fromDef = transitionFromDef.bind(null, stateName);
                const transitions = []
                  .concat(
                    Array.isArray(arg1) || typeof arg1 === "string" ? arg1 : []
                  )
                  .map(fromDef);

                function createStateBuilder() {
                  return new Proxy(
                    {},
                    {
                      get(_, key, proxy) {
                        switch (key) {
                          case "on":
                            return (defs) => {
                              const push = (def) =>
                                transitions.push(fromDef(def));
                              if (Array.isArray(defs)) defs.forEach(push);
                              else push(defs);
                              return proxy;
                            };
                        }
                      },
                    }
                  );
                }

                if (typeof arg1 === "function") arg1(createStateBuilder());

                states.push({
                  name: stateName,
                  transitions,
                  actions: [],
                  sub: {},
                  final: false,
                });
                return proxy;
              };

            case "host":
              return () => {
                const initialState = states[0];
                return createHost(initialState);
              };

            default:
              return;
          }
        },
      }
    );
  }

  function createHost(initialState) {
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

    function send(eventSignature, condition) {
      const eventName = eventNameFromSignature(eventSignature);

      const transition = findTransition(eventName);
      if (!transition) return null;

      const nextState = findTransitionTarget(transition);
      if (!nextState) return null;

      const eventListeners = subscriptions.reduce((acc, subscription) => {
        const matching = subscription.targets.some(
          (target) =>
            target.type === "*" ||
            (target.type === "event" && target.event === eventName)
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

    function findTransition(eventName) {
      for (const state of states) {
        for (const transition of state.transitions) {
          if (
            transition.event === eventName &&
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

const eventRe = /^(\w+)\(\)$/;

function subscriptionTargetFromStr(str) {
  if (str === "*") return { type: "*" };

  const eventCaptures = str.match(eventRe);
  if (eventCaptures)
    return {
      type: "event",
      event: eventCaptures[1],
      condition: null, // TODO:
    };

  return {
    type: "state",
    state: str, // TODO: Validate?
  };
}

function transitionFromDef(from, def) {
  const captures = def.match(/^(\w+)\(\) -> (\w+)$/);
  const [_, event, to] = captures;
  return {
    event,
    condition: null,
    from,
    to,
    action: null,
  };
}

function eventNameFromSignature(signature) {
  return signature.match(eventRe)[1];
}
