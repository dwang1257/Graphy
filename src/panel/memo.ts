import { createElement, type Component, type FunctionComponent, type VNode } from "preact";

export function shallowEqual<P extends object>(a: P, b: P): boolean {
  const aKeys = Object.keys(a) as Array<keyof P>;
  const bKeys = Object.keys(b) as Array<keyof P>;
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}

export function memo<P extends object>(
  component: FunctionComponent<P>,
  equal: (prev: P, next: P) => boolean = shallowEqual,
): FunctionComponent<P> {
  function shouldComponentUpdate(this: Component<P>, nextProps: P): boolean {
    return !equal(this.props, nextProps);
  }
  function Memoized(this: Component<P>, props: P): VNode<P> {
    this.shouldComponentUpdate = shouldComponentUpdate;
    return createElement(component as FunctionComponent<P>, props);
  }
  Memoized.displayName = `Memo(${component.displayName ?? component.name})`;
  return Memoized as FunctionComponent<P>;
}
