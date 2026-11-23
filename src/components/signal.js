// MIT License

// Copyright (c) 2016-2025 Ryan Carniato

// From https://github.com/solidjs/solid/blob/99714d4e2875d2d7ef8023e82f4ef6aa63ff0752/packages/solid/src/reactive/signal.ts

/* global queueMicrotask */

export const equalFn = (a, b) => a === b;
let signalOptions = { equals: equalFn };
let ERROR = null;
let STALE = 1;
let PENDING = 2;
let UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null,
};
let Owner = null;
let Listener = null;
let Updates = null;
let Effects = null;
let ExecCount = 1;

export const getOwner = () => Owner;
export const getListener = () => Listener;

export const send = (signal, value) => {
  return signal(value === undefined ? value : () => value);
};

export function createRoot(fn, owner = Owner) {
  let listener = Listener;
  let unowned = owner !== null;
  let root = unowned
    ? UNOWNED
    : {
        owned: null,
        cleanups: null,
        context: owner ? owner.context : null,
        owner,
      };
  let updateFn = unowned ? () => fn() : () => fn(createDisposer(root));

  Owner = root;
  Listener = null;

  try {
    return runUpdates(updateFn, false);
  } finally {
    Listener = listener;
    Owner = owner;
  }
}

export function* createComponentRoot(gen, owner = Owner) {
  let listener = Listener;
  let unowned = owner !== null;
  let root = unowned
    ? UNOWNED
    : {
        owned: null,
        cleanups: null,
        context: owner ? owner.context : null,
        owner,
      };
  let dispose = unowned ? null : createDisposer(root);

  let iter, step;

  try {
    Owner = root;
    Listener = null;
    iter = runComponentUpdates(gen, true)[Symbol.iterator]();

    for (;;) {
      Owner = root;
      Listener = null;
      step = iter.next();
      Listener = listener;
      Owner = owner;

      if (step.done) break;

      yield step.value;
    }

    let disposeComponent = step.value;

    return () => {
      disposeComponent?.();
      dispose?.();
    };
  } finally {
    Listener = listener;
    Owner = owner;
  }
}

export function* untrackComponent(fn) {
  if (Listener === null) return yield* fn();

  let Outer = Listener;

  Listener = null;

  let iter;
  let step;
  let returnValue;
  try {
    iter = fn()[Symbol.iterator]();

    for (;;) {
      Listener = null;

      step = iter.next(returnValue);

      Listener = Outer;

      if (step.done) break;

      returnValue = yield step.value;
    }

    return step.value;
  } finally {
    iter?.return();
    Listener = Outer;
  }
}

// Created outside createRoot so the dispose function does not share its scope,
// which holds `fn`: whoever keeps the dispose function would keep `fn` and
// everything it closes over (e.g. the list a mapArray row was created from).
function createDisposer(root) {
  return () => untrack(() => cleanNode(root));
}

export function signal(value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;

  let s = {
    value,
    observers: null,
    observerSlots: null,
    comparator: options.equals || undefined,
  };

  let set = (value) => {
    if (typeof value === 'function') {
      value = value(s.value);
    }
    return writeSignal(s, value);
  };

  let get = readSignal.bind(s);

  return function () {
    let { length } = arguments;
    if (length === 0) {
      return get();
    } else if (length === 1) {
      return set(arguments[0]);
    } else {
      throw new Error();
    }
  };
}

export function createComputed(fn, value, options) {
  let c = createComputation(fn, value, true, STALE);

  runComputation(c);
}

export function createComponentEffect(gen, value, options) {
  let c = createComputation(gen, value, false, STALE);

  return runComponentComputation(c);
}

export function createEffect(fn, value, options) {
  let user = !options || !options.render;
  let c = createComputation(fn, value, false, STALE, user);
  Effects ? Effects.push(c) : runComputation(c);
}

export function createRenderEffect(fn, value, options) {
  let c = createComputation(fn, value, false, STALE);

  runComputation(c);
}

export function createReaction(onInvalidate, options) {
  let fn;
  let c = createComputation(
    () => {
      fn ? fn() : untrack(onInvalidate);
      fn = undefined;
    },
    undefined,
    false,
    0,
    true,
  );

  return (tracking) => {
    fn = tracking;
    runComputation(c);
  };
}

export function createMemo(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;

  let c = createComputation(fn, value);
  // TODO fix monomorphism!
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || undefined;

  runComputation(c);

  return readSignal.bind(c);
}

export function createSelector(source, fn) {
  let subs = new Map();
  let node = createComputation(
    (p) => {
      let v = source();
      for (let [key, val] of subs.entries())
        if (fn(key, v) !== fn(key, p)) {
          for (let c of val.values()) {
            c.state = STALE;
            if (c.pure) Updates.push(c);
            else Effects.push(c);
          }
        }
      return v;
    },
    undefined,
    true,
    STALE,
  );
  runComputation(node);
  return (key) => {
    let listener = Listener;
    if (listener) {
      let l;
      if ((l = subs.get(key))) l.add(listener);
      else subs.set(key, (l = new Set([listener])));
      onCleanup(() => {
        l.delete(listener);
        !l.size && subs.delete(key);
      });
    }
    return fn(key, node.value);
  };
}

export function batch(fn) {
  return runUpdates(fn);
}

export function untrack(fn) {
  if (Listener === null) return fn();

  let listener = Listener;
  Listener = null;
  try {
    return fn();
  } finally {
    Listener = listener;
  }
}

export function on(deps, fn, options) {
  let isArray = Array.isArray(deps);
  let prevInput;
  let defer = options && options.defer;

  let first = true;
  return createEffect((prevValue) => {
    let input;
    if (isArray) {
      input = Array(deps.length);
      for (let i = 0; i < deps.length; i++) input[i] = deps[i]();
    } else input = deps();
    if (defer) {
      defer = false;
      first = false;
      return prevValue;
    }
    let result;
    if (!first) {
      untrack(() => fn(input, prevInput, prevValue));
    }
    prevInput = input;
    first = false;
    return result;
  });
}

export function onMount(fn) {
  createEffect(() => untrack(fn));
}

export function onCleanup(fn) {
  if (Owner === null);
  else if (Owner.cleanups === null) Owner.cleanups = [fn];
  else Owner.cleanups.push(fn);
  return fn;
}

export function catchError(fn, handler) {
  ERROR || (ERROR = Symbol('error'));
  Owner = createComputation();
  Owner.context = { ...Owner.context, [ERROR]: [handler] };
  try {
    return fn();
  } catch (err) {
    handleError(err);
  } finally {
    Owner = Owner.owner;
  }
}

// TODO runComponentWithOwner

export function runWithOwner(o, fn) {
  let prev = Owner;
  let prevListener = Listener;
  Owner = o;
  Listener = null;

  try {
    return runUpdates(fn, false);
  } catch (err) {
    handleError(err);
  } finally {
    Owner = prev;
    Listener = prevListener;
  }
}

export function registerGraph(value) {
  if (Owner) {
    if (Owner.sourceMap) Owner.sourceMap.push(value);
    else Owner.sourceMap = [value];
    value.graph = Owner;
  }
}

// Context API

export function createContext(defaultValue, options) {
  let id = Symbol('context');

  return { id, Provider: createProvider(id, options), defaultValue };
}

export function useContext(context) {
  let value;

  return Owner && Owner.context && (value = Owner.context[context.id]) !== undefined
    ? value
    : context.defaultValue;
}

export function children(fn) {
  let children = createMemo(fn);
  let memo = createMemo(() => resolveChildren(children()));
  memo.toArray = () => {
    let c = memo();
    return Array.isArray(c) ? c : c != null ? [c] : [];
  };
  return memo;
}

// Internal

export function readSignal() {
  if (this.sources && this.state) {
    if (this.state === STALE) runComputation(this);
    else {
      let updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(this));
      Updates = updates;
    }
  }

  if (Listener) {
    let observers = this.observers;

    if (!observers || observers[observers.length - 1] !== Listener) {
      let sSlot = observers ? observers.length : 0;

      if (!Listener.sources) {
        Listener.sources = [this];
        Listener.sourceSlots = [sSlot];
      } else {
        Listener.sources.push(this);
        Listener.sourceSlots.push(sSlot);
      }

      if (!observers) {
        this.observers = [Listener];
        this.observerSlots = [Listener.sources.length - 1];
      } else {
        observers.push(Listener);
        this.observerSlots.push(Listener.sources.length - 1);
      }
    }
  }

  return this.value;
}

export function writeSignal(node, value, isComp) {
  let current = node.value;

  if (!node.comparator || !node.comparator(current, value)) {
    node.value = value;

    if (node.observers && node.observers.length) {
      runUpdates(() => {
        for (let i = 0; i < node.observers.length; i += 1) {
          let o = node.observers[i];

          if (!o.state) {
            if (o.pure) Updates.push(o);
            else Effects.push(o);

            if (o.observers) markDownstream(o);
          }

          o.state = STALE;
        }

        if (Updates.length > 10e5) {
          Updates = [];

          throw new Error();
        }
      });
    }
  }
  return value;
}

function* runComponentComputation(node) {
  if (!node.fn) return;

  cleanNode(node, true);

  let time = ExecCount;
  let { value } = node;
  let nextValue;
  let owner = Owner;
  let listener = Listener;

  Listener = Owner = node;

  try {
    let iter = node.fn(value)[Symbol.iterator]();
    let step;

    for (;;) {
      step = iter.next();
      if (step.done) break;

      Listener = listener;
      Owner = owner;
      yield step.value;
      Listener = Owner = node;
    }

    nextValue = step.value;
  } catch (err) {
    if (node.pure) {
      node.state = STALE;
      node.owned && node.owned.forEach((n) => cleanNode(n));
      node.owned = null;
    }

    // won't be picked up until next update
    node.updatedAt = time + 1;

    return handleError(err);
  } finally {
    Listener = listener;
    Owner = owner;
  }

  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.updatedAt != null && 'observers' in node) {
      writeSignal(node, nextValue, true);
    } else {
      node.value = nextValue;
    }

    node.updatedAt = time;
  }
  return node;
}

function runComputation(node) {
  if (!node.fn) return;

  cleanNode(node, true);

  let time = ExecCount;
  let { value } = node;
  let nextValue;
  let owner = Owner;
  let listener = Listener;

  Listener = Owner = node;

  try {
    nextValue = node.fn(value);
  } catch (err) {
    if (node.pure) {
      node.state = STALE;
      node.owned && node.owned.forEach((n) => cleanNode(n));
      node.owned = null;
    }

    // won't be picked up until next update
    node.updatedAt = time + 1;

    return handleError(err);
  } finally {
    Listener = listener;
    Owner = owner;
  }

  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.updatedAt != null && 'observers' in node) {
      writeSignal(node, nextValue, true);
    } else {
      node.value = nextValue;
    }

    node.updatedAt = time;
  }
  return node;
}

function createComputation(fn, init, pure = true, state = 0, user = false) {
  let c = {
    fn,
    state,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: Owner ? Owner.context : null,
    pure,
    user,
  };

  if (Owner !== null && Owner !== UNOWNED) {
    if (!Owner.owned) Owner.owned = [c];
    else Owner.owned.push(c);
  }

  return c;
}

function runTop(node) {
  if (node.state === 0) return;
  if (node.state === PENDING) return lookUpstream(node);
  // if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
  let ancestors = [node];
  while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
    if (node.state) ancestors.push(node);
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    node = ancestors[i];

    if (node.state === STALE) {
      runComputation(node);
    } else if (node.state === PENDING) {
      let updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(node, ancestors[0]));
      Updates = updates;
    }
  }
}

function runQueue(queue) {
  let i;
  let userLength = 0;
  for (i = 0; i < queue.length; i++) {
    let e = queue[i];
    if (e.user) queue[userLength++] = e;
    else runTop(e);
  }
  queue.length = userLength;
  for (i = 0; i < userLength; i++) runTop(queue[i]);
}

function* runComponentUpdates(comp, init) {
  if (Updates) return yield* comp();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;
  else Effects = [];
  ExecCount++;
  try {
    let res = yield* comp();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!wait) Effects = null;
    Updates = null;
    handleError(err);
  }
}

function runUpdates(fn, root = true) {
  if (Updates) return fn();
  let wait = false;
  if (root) Updates = [];
  if (Effects) wait = true;
  else Effects = [];
  ExecCount++; // TODO only if root?
  try {
    let res = fn();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!wait) Effects = null;
    Updates = null;
    handleError(err);
  }
}

function completeUpdates(wait) {
  if (Updates) {
    runQueue(Updates);
    Updates = null;
  }
  if (wait) return;

  let e = Effects;
  Effects = null;
  if (e.length) {
    runUpdates(() => runQueue(e), false);
    // runQueue(e);
    // completeUpdates(false);
  }
}

function lookUpstream(node, ignore) {
  node.state = 0;
  for (let i = 0; i < node.sources.length; i += 1) {
    let source = node.sources[i];
    if (source.sources) {
      let state = source.state;
      if (state === STALE) {
        if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount))
          runTop(source);
      } else if (state === PENDING) lookUpstream(source, ignore);
    }
  }
}

function markDownstream(node) {
  for (let i = 0; i < node.observers.length; i += 1) {
    let o = node.observers[i];
    if (!o.state) {
      o.state = PENDING;
      if (o.pure) Updates.push(o);
      else Effects.push(o);
      o.observers && markDownstream(o);
    }
  }
}

function cleanNode(node, recompute) {
  let i;
  if (node.sources) {
    while (node.sources.length) {
      let source = node.sources.pop(),
        index = node.sourceSlots.pop(),
        obs = source.observers;
      if (obs && obs.length) {
        let n = obs.pop(),
          s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }

  if (node.owned) {
    for (i = node.owned.length - 1; i >= 0; i--) cleanNode(node.owned[i]);
    node.owned = null;
  }

  if (node.cleanups) {
    for (i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]();
    node.cleanups = null;
  }
  node.state = 0;
}

function castError(err) {
  if (err instanceof Error) return err;
  return new Error(typeof err === 'string' ? err : 'Unknown error', {
    cause: err,
  });
}

function runErrors(err, fns, owner) {
  try {
    for (let f of fns) f(err);
  } catch (e) {
    handleError(e, (owner && owner.owner) || null);
  }
}

function handleError(err, owner = Owner) {
  let fns = ERROR && owner && owner.context && owner.context[ERROR];
  let error = castError(err);
  if (!fns) throw error;

  if (Effects)
    Effects.push({
      fn() {
        runErrors(error, fns, owner);
      },
      state: STALE,
    });
  else runErrors(error, fns, owner);
}

function resolveChildren(children) {
  if (typeof children === 'function' && !children.length) return resolveChildren(children());
  if (Array.isArray(children)) {
    let results = [];
    for (let i = 0; i < children.length; i++) {
      let result = resolveChildren(children[i]);
      if (Array.isArray(result)) {
        if (result.length < 32768) results.push.apply(results, result);
        else for (let j = 0; j < result.length; j++) results.push(result[j]);
      } else {
        results.push(result);
      }
    }
    return results;
  }
  return children;
}

function createProvider(id, options) {
  return function provider(props) {
    let res;
    createRenderEffect(
      () =>
        (res = untrack(() => {
          Owner.context = { ...Owner.context, [id]: props.value };
          return children(() => props.children);
        })),
      undefined,
      options,
    );
    return res;
  };
}

export function onError(fn) {
  ERROR || (ERROR = Symbol('error'));
  if (Owner === null) {
  } else if (Owner.context === null || !Owner.context[ERROR]) {
    // terrible de-opt
    Owner.context = { ...Owner.context, [ERROR]: [fn] };
    mutateContext(Owner, ERROR, [fn]);
  } else Owner.context[ERROR].push(fn);
}

function mutateContext(o, key, value) {
  if (o.owned) {
    for (let i = 0; i < o.owned.length; i++) {
      if (o.owned[i].context === o.context) mutateContext(o.owned[i], key, value);
      if (!o.owned[i].context) {
        o.owned[i].context = o.context;
        mutateContext(o.owned[i], key, value);
      } else if (!o.owned[i].context[key]) {
        o.owned[i].context[key] = value;
        mutateContext(o.owned[i], key, value);
      }
    }
  }
}
