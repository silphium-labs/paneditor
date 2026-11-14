// MIT License

// Copyright (c) 2016-2025 Ryan Carniato

// From https://github.com/solidjs/solid/blob/99714d4e2875d2d7ef8023e82f4ef6aa63ff0752/packages/solid/src/reactive/signal.ts

/* global queueMicrotask */

export const equalFn = (a, b) => a === b;
let signalOptions = { equals: equalFn };
let ERROR = null;
let runEffects = runQueue;
let STALE = 1;
let PENDING = 2;
let UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null,
};
let NO_INIT = {};
let Owner = null;
let Listener = null;
let Updates = null;
let Effects = null;
let ExecCount = 0;

export const getOwner = () => Owner;
export const getListener = () => Listener;

export const send = (signal, value) => {
  return signal(value);
};

export function createRoot(fn, detachedOwner) {
  let listener = Listener,
    owner = Owner,
    unowned = fn.length === 0,
    current = detachedOwner === undefined ? owner : detachedOwner,
    root = unowned
      ? UNOWNED
      : {
          owned: null,
          cleanups: null,
          context: current ? current.context : null,
          owner: current,
        },
    updateFn = unowned ? fn : () => fn(createDisposer(root));

  Owner = root;
  Listener = null;

  try {
    return runUpdates(updateFn, true);
  } finally {
    Listener = listener;
    Owner = owner;
  }
}

export function* createComponentRoot(gen, detachedOwner) {
  let listener = Listener,
    owner = Owner,
    unowned = gen.length === 0,
    current = detachedOwner === undefined ? owner : detachedOwner,
    root = unowned
      ? UNOWNED
      : {
          owned: null,
          cleanups: null,
          context: current ? current.context : null,
          owner: current,
        },
    updateGen = unowned ? gen : () => gen(createDisposer(root));

  let iter, step;

  try {
    Owner = root;
    Listener = null;
    iter = runComponentUpdates(updateGen, true)[Symbol.iterator]();

    for (;;) {
      Owner = root;
      Listener = null;
      step = iter.next();
      Listener = listener;
      Owner = owner;

      if (step.done) break;

      yield step.value;
    }

    return step.value;
  } finally {
    Listener = listener;
    Owner = owner;
  }
}

function* runComponentUpdates(fn, init) {
  if (Updates) return yield* fn();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;
  else Effects = [];
  ExecCount++;
  try {
    let res = yield* fn();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!wait) Effects = null;
    Updates = null;
    handleError(err);
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

  updateComputation(c);
}

export function createRenderEffect(fn, value, options) {
  let c = createComputation(fn, value, false, STALE);

  updateComputation(c);
}

export function createEffect(fn, value, options) {
  runEffects = runUserEffects;
  let c = createComputation(fn, value, false, STALE);
  if (!options || !options.render) c.user = true;
  Effects ? Effects.push(c) : updateComputation(c);
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
  );
  c.user = true;
  return (tracking) => {
    fn = tracking;
    updateComputation(c);
  };
}

export function createMemo(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;

  let c = createComputation(fn, value, true, 0);

  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || undefined;
  updateComputation(c);
  return readSignal.bind(c);
}

function isPromise(v) {
  return v && typeof v === 'object' && 'then' in v;
}

export function createSelector(source, fn, options) {
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
  updateComputation(node);
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
  return runUpdates(fn, false);
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
  return (prevValue) => {
    let input;
    if (isArray) {
      input = Array(deps.length);
      for (let i = 0; i < deps.length; i++) input[i] = deps[i]();
    } else input = deps();
    if (defer) {
      defer = false;
      return prevValue;
    }
    let result = untrack(() => fn(input, prevInput, prevValue));
    prevInput = input;
    return result;
  };
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
  Owner = createComputation(undefined, undefined, true);
  Owner.context = { ...Owner.context, [ERROR]: [handler] };
  try {
    return fn();
  } catch (err) {
    handleError(err);
  } finally {
    Owner = Owner.owner;
  }
}

export function runWithOwner(o, fn) {
  let prev = Owner;
  let prevListener = Listener;
  Owner = o;
  Listener = null;
  try {
    return runUpdates(fn, true);
  } catch (err) {
    handleError(err);
  } finally {
    Owner = prev;
    Listener = prevListener;
  }
}

export function resumeEffects(e) {
  Effects.push.apply(Effects, e);
  e.length = 0;
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

// Rebuild a source's `observerSlots` from its observers' back-pointers.
// A source can end up with observers but no (or out-of-sync) slots when an
// array allocation fails midway through `readSignal` (see #4680); without
// this, `cleanNode` and a later `readSignal` throw on the missing array.
// Each observer subscribes to a source at most once, so the slot for
// `observers[i]` is the index of the source in that observer's `sources`.
function repairObserverSlots(source) {
  source.observerSlots = source.observers.map((observer, slot) => {
    let sources = observer.sources;
    if (!sources) return -1;
    for (let i = sources.length - 1; i >= 0; i--) {
      if (sources[i] === source && observer.sourceSlots && observer.sourceSlots[i] === slot)
        return i;
    }
    return sources.lastIndexOf(source);
  });
}

export function readSignal() {
  if (this.sources && this.state) {
    if (this.state === STALE) updateComputation(this);
    else {
      let updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(this), false);
      Updates = updates;
    }
  }
  if (Listener) {
    let observers = this.observers;
    if (!observers || observers[observers.length - 1] !== Listener) {
      let sSlot = observers ? observers.length : 0;
      if (!Listener.sources) {
        // Build both arrays before assigning either, so an allocation
        // failure cannot leave `sources` set while `sourceSlots` is null.
        let sources = [this];
        let sourceSlots = [sSlot];
        Listener.sources = sources;
        Listener.sourceSlots = sourceSlots;
      } else {
        Listener.sources.push(this);
        Listener.sourceSlots.push(sSlot);
      }
      if (!observers) {
        // Build both arrays before assigning either, so an allocation
        // failure cannot leave `observers` set while `observerSlots` is null.
        let newObservers = [Listener];
        let newObserverSlots = [Listener.sources.length - 1];
        this.observers = newObservers;
        this.observerSlots = newObserverSlots;
      } else {
        // The slot array may be missing or out of sync if an earlier
        // allocation failed; rebuild it from the back-pointers first.
        if (!this.observerSlots || this.observerSlots.length !== observers.length)
          repairObserverSlots(this);
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
      }, false);
    }
  }
  return value;
}

function updateComputation(node) {
  if (!node.fn) return;
  cleanNode(node, true);
  let time = ExecCount;
  runComputation(node, node.value, time);
}

function runComputation(node, value, time) {
  let nextValue;
  let owner = Owner,
    listener = Listener;
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
    } else node.value = nextValue;
    node.updatedAt = time;
  }
}

function createComputation(fn, init, pure, state) {
  let c = {
    fn,
    state: state,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: Owner ? Owner.context : null,
    pure,
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
      updateComputation(node);
    } else if (node.state === PENDING) {
      let updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(node, ancestors[0]), false);
      Updates = updates;
    }
  }
}

function runUpdates(fn, init) {
  if (Updates) return fn();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;
  else Effects = [];
  ExecCount++;
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
  let res;
  let e = Effects;
  Effects = null;
  if (e.length) runUpdates(() => runEffects(e), false);
  if (res) res();
}

function runQueue(queue) {
  for (let i = 0; i < queue.length; i++) runTop(queue[i]);
}

function runUserEffects(queue) {
  let i,
    userLength = 0;
  for (i = 0; i < queue.length; i++) {
    let e = queue[i];
    if (!e.user) runTop(e);
    else queue[userLength++] = e;
  }
  for (i = 0; i < userLength; i++) runTop(queue[i]);
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
        if (!source.observerSlots || source.observerSlots.length !== obs.length)
          repairObserverSlots(source);
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

  if (node.tOwned) {
    for (i = node.tOwned.length - 1; i >= 0; i--) cleanNode(node.tOwned[i]);
    delete node.tOwned;
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
