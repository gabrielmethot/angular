/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {AsyncPipe} from '@angular/common';
import {Component, inject} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ActivatedRoute, provideRouter, Router, RouterOutlet} from '../../index';
import {RouterTestingHarness} from '../../testing';
import {of} from 'rxjs';
import {delay} from 'rxjs/operators';

import {withRouterConfig} from '../../src/provide_router';

describe('navigateForTest', () => {
  it('gives null for the activatedComponent when no routes are configured', async () => {
    TestBed.configureTestingModule({providers: [provideRouter([])]});
    const harness = await RouterTestingHarness.create('/');
    expect(harness.routeDebugElement).toBeNull();
  });
  it('navigates to routed component', async () => {
    @Component({template: 'hello {{name}}'})
    class TestCmp {
      name = 'world';
    }

    TestBed.configureTestingModule({providers: [provideRouter([{path: '', component: TestCmp}])]});
    const harness = await RouterTestingHarness.create();
    const activatedComponent = await harness.navigateByUrl('/', TestCmp);

    expect(activatedComponent).toBeInstanceOf(TestCmp);
    expect(harness.routeNativeElement?.innerHTML).toContain('hello world');
  });

  it('executes guards on the path', async () => {
    let guardCalled = false;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            canActivate: [
              () => {
                guardCalled = true;
                return true;
              },
            ],
            children: [],
          },
        ]),
      ],
    });
    await RouterTestingHarness.create('/');
    expect(guardCalled).toBeTrue();
  });

  it('throws error if routing throws', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            {
              path: 'e',
              canActivate: [
                () => {
                  throw new Error('oh no');
                },
              ],
              children: [],
            },
          ],
          withRouterConfig({resolveNavigationPromiseOnError: true}),
        ),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await expectAsync(harness.navigateByUrl('e')).toBeResolvedTo(null);
  });

  it('can observe param changes on routed component with second navigation', async () => {
    @Component({template: '{{(route.params | async)?.id}}', imports: [AsyncPipe]})
    class TestCmp {
      constructor(readonly route: ActivatedRoute) {}
    }

    TestBed.configureTestingModule({
      providers: [provideRouter([{path: ':id', component: TestCmp}])],
    });
    const harness = await RouterTestingHarness.create();
    const activatedComponent = await harness.navigateByUrl('/123', TestCmp);
    expect(activatedComponent.route).toBeInstanceOf(ActivatedRoute);
    expect(harness.routeNativeElement?.innerHTML).toContain('123');
    await harness.navigateByUrl('/456');
    expect(harness.routeNativeElement?.innerHTML).toContain('456');
  });

  it('throws an error if the routed component instance does not match the one required', async () => {
    @Component({template: ''})
    class TestCmp {}
    @Component({template: ''})
    class OtherCmp {}

    TestBed.configureTestingModule({
      providers: [provideRouter([{path: '**', component: TestCmp}])],
    });
    const harness = await RouterTestingHarness.create();
    await expectAsync(harness.navigateByUrl('/123', OtherCmp)).toBeRejected();
  });

  it('throws an error if navigation fails but expected a component instance', async () => {
    @Component({template: ''})
    class TestCmp {}

    TestBed.configureTestingModule({
      providers: [provideRouter([{path: '**', canActivate: [() => false], component: TestCmp}])],
    });
    const harness = await RouterTestingHarness.create();
    await expectAsync(harness.navigateByUrl('/123', TestCmp)).toBeRejected();
  });

  it('waits for redirects using router.navigate', async () => {
    @Component({template: 'test'})
    class TestCmp {}
    @Component({template: 'redirect'})
    class OtherCmp {}

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'test',
            canActivate: [() => inject(Router).navigateByUrl('/redirect')],
            component: TestCmp,
          },
          {path: 'redirect', canActivate: [() => of(true).pipe(delay(100))], component: OtherCmp},
        ]),
      ],
    });
    await RouterTestingHarness.create('test');
    expect(TestBed.inject(Router).url).toEqual('/redirect');
  });
});

describe('RouterTestingHarness.navigate', () => {
  it('navigates to routed component', async () => {
    @Component({template: 'hello {{name}}'})
    class TestCmp {
      name = 'world';
    }

    TestBed.configureTestingModule({
      providers: [provideRouter([{path: 'test', component: TestCmp}])],
    });
    const harness = await RouterTestingHarness.create();
    const activatedComponent = await harness.navigate(['/test'], undefined, TestCmp);

    expect(activatedComponent).toBeInstanceOf(TestCmp);
    expect(harness.routeNativeElement?.innerHTML).toContain('hello world');
  });

  it('applies query params and fragment', async () => {
    @Component({template: ''})
    class SearchCmp {
      readonly route = inject(ActivatedRoute);
    }

    TestBed.configureTestingModule({
      providers: [provideRouter([{path: 'search', component: SearchCmp}])],
    });
    const harness = await RouterTestingHarness.create();
    const activatedComponent = await harness.navigate(
      ['/search'],
      {queryParams: {q: 'angular'}, fragment: 'results'},
      SearchCmp,
    );

    expect(TestBed.inject(Router).url).toEqual('/search?q=angular#results');
    expect(activatedComponent.route.snapshot.queryParamMap.get('q')).toEqual('angular');
    expect(activatedComponent.route.snapshot.fragment).toEqual('results');
  });

  it('resolves commands relative to the provided route', async () => {
    @Component({template: '<router-outlet />', imports: [RouterOutlet]})
    class ParentCmp {
      readonly route = inject(ActivatedRoute);
    }
    @Component({template: 'child'})
    class ChildCmp {}

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {path: 'parent', component: ParentCmp, children: [{path: 'child', component: ChildCmp}]},
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    const parent = await harness.navigate(['/parent'], undefined, ParentCmp);
    await harness.navigate(['child'], {relativeTo: parent.route});

    expect(TestBed.inject(Router).url).toEqual('/parent/child');
    expect(harness.routeNativeElement?.innerHTML).toContain('child');
  });

  it('merges query params with queryParamsHandling', async () => {
    @Component({template: ''})
    class TestCmp {}

    TestBed.configureTestingModule({
      providers: [provideRouter([{path: 'test', component: TestCmp}])],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigate(['/test'], {queryParams: {a: '1'}});
    await harness.navigate(['/test'], {queryParams: {b: '2'}, queryParamsHandling: 'merge'});

    expect(TestBed.inject(Router).url).toEqual('/test?a=1&b=2');
  });

  it('passes navigation behavior options to the router', async () => {
    @Component({template: ''})
    class TestCmp {}

    TestBed.configureTestingModule({
      providers: [provideRouter([{path: 'test', component: TestCmp}])],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigate(['/test'], {state: {from: 'harness'}});

    const router = TestBed.inject(Router);
    expect(router.lastSuccessfulNavigation()?.extras.state).toEqual({from: 'harness'});
  });

  it('gives null when no component is activated', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{path: 'test', canActivate: [() => false], children: []}])],
    });
    const harness = await RouterTestingHarness.create();

    await expectAsync(harness.navigate(['/test'])).toBeResolvedTo(null);
  });

  it('throws an error if the routed component instance does not match the one required', async () => {
    @Component({template: ''})
    class TestCmp {}
    @Component({template: ''})
    class OtherCmp {}

    TestBed.configureTestingModule({
      providers: [provideRouter([{path: '**', component: TestCmp}])],
    });
    const harness = await RouterTestingHarness.create();

    await expectAsync(harness.navigate(['/123'], undefined, OtherCmp)).toBeRejected();
  });

  it('throws an error if navigation fails but expected a component instance', async () => {
    @Component({template: ''})
    class TestCmp {}

    TestBed.configureTestingModule({
      providers: [provideRouter([{path: '**', canActivate: [() => false], component: TestCmp}])],
    });
    const harness = await RouterTestingHarness.create();

    await expectAsync(harness.navigate(['/123'], undefined, TestCmp)).toBeRejected();
  });

  it('waits for redirects', async () => {
    @Component({template: 'test'})
    class TestCmp {}
    @Component({template: 'redirect'})
    class OtherCmp {}

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'test',
            canActivate: [() => inject(Router).navigateByUrl('/redirect')],
            component: TestCmp,
          },
          {path: 'redirect', canActivate: [() => of(true).pipe(delay(100))], component: OtherCmp},
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigate(['/test'], undefined, OtherCmp);

    expect(TestBed.inject(Router).url).toEqual('/redirect');
  });
});

describe('RouterTestingHarness.create with commands', () => {
  it('performs the initial navigation with the provided extras', async () => {
    @Component({template: 'search'})
    class SearchCmp {}

    TestBed.configureTestingModule({
      providers: [provideRouter([{path: 'search', component: SearchCmp}])],
    });
    const harness = await RouterTestingHarness.create(['/search'], {
      queryParams: {q: 'angular'},
      fragment: 'results',
    });

    expect(TestBed.inject(Router).url).toEqual('/search?q=angular#results');
    expect(harness.routeNativeElement?.innerHTML).toContain('search');
  });
});
