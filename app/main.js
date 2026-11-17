// A make.fun frontend: the board, a bounty page, its leaderboard and an
// account's public profile, on hash routes.
//
//   #/                            the board
//   #/bounty/<slug>               one bounty
//   #/bounty/<slug>/leaderboard   that bounty's leaderboard
//   #/u/<handle>                  one account's public profile
//
// window.__shotReady is false while a route loads and true once its data is on
// screen, so a screenshot script knows when to capture. Views update in place:
// sorting, filtering and paging re-render only #app, never the whole page.

import { getBounty, getCompetitions, getLeaderboard, getProfile } from './api.js';
import { boardView, bountyView, errorBox, leaderboardView, notFound, profileView, skeleton } from './views.js';

const app = document.getElementById('app');
const searchInput = document.getElementById('q');

/** Board state: sort order, category filter, search text. */
const boardState = { sort: 'pot', cat: 'All', q: '' };
/** Leaderboard page, reset whenever the route changes. */
let lbPage = 1;
const LB_PAGE_SIZE = 25;
/** The route rendered last, so a re-render (sort/filter/page) keeps its data. */
let lastRoute = null;

function parseRoute() {
  const hash = location.hash || '#/';
  const lb = hash.match(/^#\/bounty\/([^/]+)\/leaderboard$/);
  if (lb) return { kind: 'leaderboard', slug: decodeURIComponent(lb[1]) };
  const b = hash.match(/^#\/bounty\/([^/]+)$/);
  if (b) return { kind: 'bounty', slug: decodeURIComponent(b[1]) };
  const u = hash.match(/^#\/u\/([^/]+)$/);
  if (u) return { kind: 'profile', handle: decodeURIComponent(u[1]) };
  return { kind: 'board' };
}

function routeKey(route) {
  return `${route.kind}:${route.slug || route.handle || ''}`;
}

async function render() {
  const route = parseRoute();
  const changed = routeKey(route) !== routeKey(lastRoute || {});
  if (changed) lbPage = 1;
  lastRoute = route;
  window.__shotReady = false;
  app.innerHTML = skeleton();
  document.title = 'make.fun — live bounties, leaderboards & profiles';
  try {
    if (route.kind === 'board') {
      const data = await getCompetitions();
      document.title = 'Open bounties | make.fun';
      app.innerHTML = boardView(data, boardState);
    } else if (route.kind === 'bounty') {
      const b = await getBounty(route.slug);
      if (!b || !b.slug) {
        app.innerHTML = notFound('bounty');
      } else {
        let preview = null;
        try {
          preview = await getLeaderboard(route.slug);
        } catch {
          preview = null; // the page stands without its leaderboard preview
        }
        document.title = `${b.title} | make.fun`;
        app.innerHTML = bountyView(b, preview);
      }
    } else if (route.kind === 'leaderboard') {
      const [b, lb] = await Promise.all([getBounty(route.slug), getLeaderboard(route.slug)]);
      if (!b || !b.slug) {
        app.innerHTML = notFound('bounty');
      } else {
        document.title = `${b.title} — leaderboard | make.fun`;
        app.innerHTML = leaderboardView(b, lb, lbPage, LB_PAGE_SIZE);
      }
    } else {
      const p = await getProfile(route.handle);
      if (!p || !p.handle) {
        app.innerHTML = notFound('account');
      } else {
        document.title = `@${p.handle} | make.fun`;
        app.innerHTML = profileView(p);
      }
    }
  } catch (err) {
    app.innerHTML = errorBox(err);
  }
  if (changed) window.scrollTo(0, 0);
  window.__shotReady = true;
}

/** Controls inside #app, handled by delegation so re-renders keep working. */
app.addEventListener('click', (event) => {
  const retry = event.target.closest('[data-retry]');
  if (retry) {
    render();
    return;
  }
  const cat = event.target.closest('[data-cat]');
  if (cat) {
    boardState.cat = cat.dataset.cat;
    render();
    return;
  }
  const page = event.target.closest('[data-page]');
  if (page && !page.disabled) {
    lbPage = Number(page.dataset.page) || 1;
    render();
  }
});

app.addEventListener('change', (event) => {
  const sort = event.target.closest('[data-sort]');
  if (sort) {
    boardState.sort = sort.value;
    render();
  }
});

/** Header search filters the board; typing on another page goes to the board. */
searchInput.addEventListener('input', () => {
  boardState.q = searchInput.value;
  if (parseRoute().kind !== 'board') {
    location.hash = '#/';
    return;
  }
  render();
});

window.addEventListener('hashchange', render);
render();
