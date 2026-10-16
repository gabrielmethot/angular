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
import {ActivatedRoute, CanActivateFn, provideRouter, Router} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';

describe('navigate for test examples', () => {
  // #docregion RoutedComponent
  it('navigates to routed component', async () => {
    @Component({template: 'hello {{name}}'})
    class TestCmp {
      name = 'world';
    }

    TestBed.configureTestingModule({
      providers: [provideRouter([{path: '', component: TestCmp}])],
    });

    const harness = await RouterTestingHarness.create();
    const activatedComponent = await harness.navigateByUrl('/', TestCmp);
    expect(activatedComponent).toBeInstanceOf(TestCmp);
    expect(harness.routeNativeElement?.innerHTML).toContain('hello world');
  });
  // #enddocregion

  it('testing a guard', async () => {
    @Component({template: ''})
    class AdminComponent {}
    @Component({template: ''})
    class LoginComponent {}

    // #docregion Guard
    let isLoggedIn = false;
    const isLoggedInGuard: CanActivateFn = () => {
      return isLoggedIn ? true : inject(Router).parseUrl('/login');
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {path: 'admin', canActivate: [isLoggedInGuard], component: AdminComponent},
          {path: 'login', component: LoginComponent},
        ]),
      ],
    });

    const harness = await RouterTestingHarness.create('/admin');
    expect(TestBed.inject(Router).url).toEqual('/login');
    isLoggedIn = true;
    await harness.navigateByUrl('/admin');
    expect(TestBed.inject(Router).url).toEqual('/admin');
    // #enddocregion
  });

  it('test a ActivatedRoute', async () => {
    // #docregion ActivatedRoute
    @Component({
      imports: [AsyncPipe],
      template: `search: {{ (route.queryParams | async)?.query }}`,
    })
    class SearchCmp {
      constructor(
        readonly route: ActivatedRoute,
        readonly router: Router,
      ) {}

      async searchFor(thing: string) {
        await this.router.navigate([], {queryParams: {query: thing}});
      }
    }

    TestBed.configureTestingModule({
      providers: [provideRouter([{path: 'search', component: SearchCmp}])],
    });

    const harness = await RouterTestingHarness.create();
    const activatedComponent = await harness.navigateByUrl('/search', SearchCmp);
    await activatedComponent.searchFor('books');
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toEqual('/search?query=books');
    expect(harness.routeNativeElement?.innerHTML).toContain('books');
    // #enddocregion
  });

  it('navigates with extras', async () => {
    // #docregion NavigateWithExtras
    @Component({template: 'search: {{ route.snapshot.queryParamMap.get("query") }}'})
    class SearchCmp {
      readonly route = inject(ActivatedRoute);
    }

    TestBed.configureTestingModule({
      providers: [provideRouter([{path: 'search', component: SearchCmp}])],
    });

    const harness = await RouterTestingHarness.create();
    const activatedComponent = await harness.navigate(
      ['/search'],
      {queryParams: {query: 'books'}, fragment: 'results'},
      SearchCmp,
    );
    expect(TestBed.inject(Router).url).toEqual('/search?query=books#results');
    expect(activatedComponent.route.snapshot.fragment).toEqual('results');
    expect(harness.routeNativeElement?.innerHTML).toContain('books');
    // #enddocregion
  });

  it('creates the harness with an initial navigation from commands', async () => {
    @Component({template: ''})
    class SearchCmp {}

    // #docregion CreateWithCommands
    TestBed.configureTestingModule({
      providers: [provideRouter([{path: 'search', component: SearchCmp}])],
    });

    const harness = await RouterTestingHarness.create(['/search'], {
      queryParams: {query: 'books'},
      fragment: 'results',
    });
    expect(TestBed.inject(Router).url).toEqual('/search?query=books#results');
    expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(SearchCmp);
    // #enddocregion
  });
});
