/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  ChangeDetectionStrategy,
  Component,
  DebugElement,
  Service,
  Type,
  ViewChild,
  WritableSignal,
  signal,
} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {
  NavigationExtras,
  Router,
  RouterOutlet,
  ɵafterNextNavigation as afterNextNavigation,
} from '../../index';

@Service()
export class RootFixtureService {
  private fixture?: ComponentFixture<RootCmp>;
  private harness?: RouterTestingHarness;

  createHarness(): RouterTestingHarness {
    if (this.harness) {
      throw new Error('Only one harness should be created per test.');
    }
    this.harness = new RouterTestingHarness(this.getRootFixture());
    return this.harness;
  }

  private getRootFixture(): ComponentFixture<RootCmp> {
    if (this.fixture !== undefined) {
      return this.fixture;
    }
    this.fixture = TestBed.createComponent(RootCmp);
    this.fixture.detectChanges();
    return this.fixture;
  }
}

@Component({
  template: '<router-outlet [routerOutletData]="routerOutletData()"></router-outlet>',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class RootCmp {
  @ViewChild(RouterOutlet) outlet?: RouterOutlet;
  readonly routerOutletData = signal<unknown>(undefined);
}

/**
 * A testing harness for the `Router` to reduce the boilerplate needed to test routes and routed
 * components.
 *
 * @publicApi
 */
export class RouterTestingHarness {
  /**
   * Creates a `RouterTestingHarness` instance.
   *
   * The `RouterTestingHarness` also creates its own root component with a `RouterOutlet` for the
   * purposes of rendering route components.
   *
   * Throws an error if an instance has already been created.
   * Use of this harness also requires `destroyAfterEach: true` in the `ModuleTeardownOptions`
   *
   * @param initialUrl The target of navigation to trigger before returning the harness.
   */
  static async create(initialUrl?: string): Promise<RouterTestingHarness>;
  /**
   * Creates a `RouterTestingHarness` instance and performs an initial navigation based on the
   * provided commands and extras.
   *
   * The `RouterTestingHarness` also creates its own root component with a `RouterOutlet` for the
   * purposes of rendering route components.
   *
   * Throws an error if an instance has already been created.
   * Use of this harness also requires `destroyAfterEach: true` in the `ModuleTeardownOptions`
   *
   * {@example router/testing/test/router_testing_harness_examples.spec.ts region='CreateWithCommands'}
   *
   * @param commands An array of URL fragments with which to construct the target URL of the initial
   *     navigation. Passed to `Router.navigate`.
   * @param extras Options that control how the initial navigation URL is constructed and how the
   *     navigation is handled, such as `queryParams` and `fragment`. Passed to `Router.navigate`.
   */
  static async create(
    commands: readonly any[],
    extras?: NavigationExtras,
  ): Promise<RouterTestingHarness>;
  static async create(
    initialUrlOrCommands?: string | readonly any[],
    extras?: NavigationExtras,
  ): Promise<RouterTestingHarness> {
    const harness = TestBed.inject(RootFixtureService).createHarness();
    if (Array.isArray(initialUrlOrCommands)) {
      await harness.navigate(initialUrlOrCommands, extras);
    } else if (initialUrlOrCommands !== undefined) {
      await harness.navigateByUrl(initialUrlOrCommands as string);
    }
    return harness;
  }

  /**
   * Fixture of the root component of the RouterTestingHarness
   */
  public readonly fixture: ComponentFixture<{routerOutletData: WritableSignal<unknown>}>;

  /** @internal */
  constructor(fixture: ComponentFixture<{routerOutletData: WritableSignal<unknown>}>) {
    this.fixture = fixture;
  }

  /** Instructs the root fixture to run change detection. */
  detectChanges(): void {
    this.fixture.detectChanges();
  }
  /** The `DebugElement` of the `RouterOutlet` component. `null` if the outlet is not activated. */
  get routeDebugElement(): DebugElement | null {
    const outlet = (this.fixture.componentInstance as RootCmp).outlet;
    if (!outlet || !outlet.isActivated) {
      return null;
    }
    return this.fixture.debugElement.query((v) => v.componentInstance === outlet.component);
  }
  /** The native element of the `RouterOutlet` component. `null` if the outlet is not activated. */
  get routeNativeElement(): HTMLElement | null {
    return this.routeDebugElement?.nativeElement ?? null;
  }

  /**
   * Triggers a `Router` navigation and waits for it to complete.
   *
   * The root component with a `RouterOutlet` created for the harness is used to render `Route`
   * components. The root component is reused within the same test in subsequent calls to
   * `navigateForTest`.
   *
   * When testing `Routes` with a guards that reject the navigation, the `RouterOutlet` might not be
   * activated and the `activatedComponent` may be `null`.
   *
   * {@example router/testing/test/router_testing_harness_examples.spec.ts region='Guard'}
   *
   * @param url The target of the navigation. Passed to `Router.navigateByUrl`.
   * @returns The activated component instance of the `RouterOutlet` after navigation completes
   *     (`null` if the outlet does not get activated).
   */
  async navigateByUrl(url: string): Promise<null | {}>;
  /**
   * Triggers a router navigation and waits for it to complete.
   *
   * The root component with a `RouterOutlet` created for the harness is used to render `Route`
   * components.
   *
   * {@example router/testing/test/router_testing_harness_examples.spec.ts region='RoutedComponent'}
   *
   * The root component is reused within the same test in subsequent calls to `navigateByUrl`.
   *
   * This function also makes it easier to test components that depend on `ActivatedRoute` data.
   *
   * {@example router/testing/test/router_testing_harness_examples.spec.ts region='ActivatedRoute'}
   *
   * @param url The target of the navigation. Passed to `Router.navigateByUrl`.
   * @param requiredRoutedComponentType After navigation completes, the required type for the
   *     activated component of the `RouterOutlet`. If the outlet is not activated or a different
   *     component is activated, this function will throw an error.
   * @returns The activated component instance of the `RouterOutlet` after navigation completes.
   */
  async navigateByUrl<T>(url: string, requiredRoutedComponentType: Type<T>): Promise<T>;
  async navigateByUrl<T>(url: string, requiredRoutedComponentType?: Type<T>): Promise<T | null> {
    return this.navigateAndResolve(
      (router) => router.navigateByUrl(url),
      requiredRoutedComponentType,
    );
  }

  /**
   * Triggers a `Router` navigation based on the provided commands and waits for it to complete.
   *
   * This is the equivalent of `Router.navigate` for the harness. It makes it possible to navigate
   * with `NavigationExtras`, such as `queryParams`, `fragment` or `state`, without constructing a
   * URL string by hand.
   *
   * {@example router/testing/test/router_testing_harness_examples.spec.ts region='NavigateWithExtras'}
   *
   * The root component with a `RouterOutlet` created for the harness is used to render `Route`
   * components. The root component is reused within the same test in subsequent navigations.
   *
   * The harness has no current route of its own, so relative commands are resolved from the root
   * unless an `ActivatedRoute` is provided through `extras.relativeTo`.
   *
   * @param commands An array of URL fragments with which to construct the target URL. Passed to
   *     `Router.navigate`.
   * @param extras Options that control how the target URL is constructed and how the navigation is
   *     handled. Passed to `Router.navigate`.
   * @returns The activated component instance of the `RouterOutlet` after navigation completes
   *     (`null` if the outlet does not get activated).
   */
  async navigate(commands: readonly any[], extras?: NavigationExtras): Promise<null | {}>;
  /**
   * Triggers a `Router` navigation based on the provided commands and waits for it to complete.
   *
   * This is the equivalent of `Router.navigate` for the harness. It makes it possible to navigate
   * with `NavigationExtras`, such as `queryParams`, `fragment` or `state`, without constructing a
   * URL string by hand.
   *
   * {@example router/testing/test/router_testing_harness_examples.spec.ts region='NavigateWithExtras'}
   *
   * The root component with a `RouterOutlet` created for the harness is used to render `Route`
   * components. The root component is reused within the same test in subsequent navigations.
   *
   * The harness has no current route of its own, so relative commands are resolved from the root
   * unless an `ActivatedRoute` is provided through `extras.relativeTo`.
   *
   * @param commands An array of URL fragments with which to construct the target URL. Passed to
   *     `Router.navigate`.
   * @param extras Options that control how the target URL is constructed and how the navigation is
   *     handled. Passed to `Router.navigate`.
   * @param requiredRoutedComponentType After navigation completes, the required type for the
   *     activated component of the `RouterOutlet`. If the outlet is not activated or a different
   *     component is activated, this function will throw an error.
   * @returns The activated component instance of the `RouterOutlet` after navigation completes.
   */
  async navigate<T>(
    commands: readonly any[],
    extras: NavigationExtras | undefined,
    requiredRoutedComponentType: Type<T>,
  ): Promise<T>;
  async navigate<T>(
    commands: readonly any[],
    extras?: NavigationExtras,
    requiredRoutedComponentType?: Type<T>,
  ): Promise<T | null> {
    return this.navigateAndResolve(
      (router) => router.navigate(commands, extras),
      requiredRoutedComponentType,
    );
  }

  /**
   * Runs the provided navigation, waits for it (and any redirects) to complete, and returns the
   * component activated in the root `RouterOutlet`.
   */
  private async navigateAndResolve<T>(
    navigate: (router: Router) => Promise<boolean>,
    requiredRoutedComponentType?: Type<T>,
  ): Promise<T | null> {
    const router = TestBed.inject(Router);
    let resolveFn!: () => void;
    const redirectTrackingPromise = new Promise<void>((resolve) => {
      resolveFn = resolve;
    });
    afterNextNavigation(router, resolveFn);
    await navigate(router);
    await redirectTrackingPromise;
    this.fixture.detectChanges();
    const outlet = (this.fixture.componentInstance as RootCmp).outlet;
    // The outlet might not be activated if the user is testing a navigation for a guard that
    // rejects
    if (outlet && outlet.isActivated && outlet.activatedRoute.component) {
      const activatedComponent = outlet.component;
      if (
        requiredRoutedComponentType !== undefined &&
        !(activatedComponent instanceof requiredRoutedComponentType)
      ) {
        throw new Error(
          `Unexpected routed component type. Expected ${requiredRoutedComponentType.name} but got ${activatedComponent.constructor.name}`,
        );
      }
      return activatedComponent as T;
    } else {
      if (requiredRoutedComponentType !== undefined) {
        throw new Error(
          `Unexpected routed component type. Expected ${requiredRoutedComponentType.name} but the navigation did not activate any component.`,
        );
      }
      return null;
    }
  }
}
