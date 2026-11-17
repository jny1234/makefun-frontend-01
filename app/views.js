// The four surfaces, each a function from API data to HTML. Every value from
// the API is escaped before it lands in HTML; description and rules text goes
// through md(), a small markdown-lite renderer (headings, lists, bold, code).

import { bytes, date, dateShort, esc, isOpen, money, num, timeAgo, timeLeft, urgency, winRate } from './format.js';

/** The reward as it stands now: the prize plus any entry fees paid into it. */
export const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee, when the bounty charges one. */
const feeText = (b) => (b.entryFeeUsd ? `${money(b.entryFeeUsd)} fee` : 'Free entry');

/** Open/closed badge, judged by the deadline, not the API status. */
function statusBadge(b) {
  if (!isOpen(b)) return '<span class="badge badge-closed">Closed</span>';
  const u = urgency(b.deadline);
  if (u === 'urgent') return '<span class="badge badge-urgent">Closing soon</span>';
  if (u === 'soon') return '<span class="badge badge-soon">Closing soon</span>';
  return '<span class="badge badge-open">Open</span>';
}

function categoryChip(b) {
  return b.category ? `<span class="cat">${esc(b.category)}</span>` : '';
}

/** Tiny markdown-lite: ##/### headings, '- ' lists, **bold**, `code`. */
export function md(text) {
  const lines = String(text ?? '').split('\n');
  let html = '';
  let inList = false;
  let para = [];
  const inline = (s) =>
    esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  const flushPara = () => {
    if (para.length) {
      html += `<p>${para.map(inline).join(' ')}</p>`;
      para = [];
    }
  };
  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{2,3}\s/.test(line)) {
      flushPara();
      closeList();
      const level = line.startsWith('###') ? 3 : 2;
      html += `<h${level}>${inline(line.replace(/^#{2,3}\s+/, ''))}</h${level}>`;
    } else if (/^[-*]\s+/.test(line)) {
      flushPara();
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`;
    } else if (line.trim() === '') {
      flushPara();
      closeList();
    } else {
      closeList();
      para.push(line.trim());
    }
  }
  flushPara();
  closeList();
  return html;
}

/** One paragraph of plain text, truncated to a line for board cards. */
function firstLine(text) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > 160 ? `${t.slice(0, 157)}…` : t;
}

/** Loading skeleton, shown while a route fetches. */
export function skeleton() {
  return `<div class="skel-hero"></div><div class="skel-row"></div><div class="skel-row"></div><div class="skel-row"></div><div class="skel-row"></div>`;
}

/** Error box with a retry button (main.js wires [data-retry]). */
export function errorBox(err) {
  const msg = err && err.status === 404 ? 'That page was not found on make.fun.' : esc(err ? err.message : 'Something went wrong.');
  return `<div class="error" role="alert">
    <h1>Couldn&rsquo;t load this page</h1>
    <p>${msg}</p>
    <p><button class="btn" data-retry type="button">Try again</button>
    <a class="btn btn-ghost" href="#/">Back to the board</a></p>
  </div>`;
}

export function notFound(what) {
  return `<div class="error" role="alert">
    <h1>Not found</h1>
    <p>No ${esc(what)} matches that address on make.fun.</p>
    <p><a class="btn" href="#/">Back to the board</a></p>
  </div>`;
}

/* ---------------- board ---------------- */

/** Sort the open bounties: pot | closing | entries. */
function sortOpen(list, sort) {
  const arr = [...list];
  if (sort === 'closing') return arr.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  if (sort === 'entries') return arr.sort((a, b) => (b.submissionCount || 0) - (a.submissionCount || 0));
  return arr.sort((a, b) => Number(b.potUsd ?? b.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0));
}

export function boardView(data, state) {
  const items = data.items || [];
  const open = items.filter((b) => isOpen(b) && !b.resultsOut);
  const closed = items.filter((b) => !isOpen(b)).sort((a, b) => new Date(b.deadline) - new Date(a.deadline));
  const cats = [...new Set(open.map((b) => b.category).filter(Boolean))].sort();
  const q = (state.q || '').trim().toLowerCase();
  let shown = sortOpen(open, state.sort);
  if (state.cat && state.cat !== 'All') shown = shown.filter((b) => b.category === state.cat);
  if (q) shown = shown.filter((b) => `${b.title} ${b.summary || ''} ${b.slug}`.toLowerCase().includes(q));
  const totalPot = open.reduce((s, b) => s + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const totalEntries = open.reduce((s, b) => s + (b.submissionCount || 0), 0);

  const row = (b) => `
    <article class="bounty-row">
      <div class="row-main">
        <h2><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h2>
        <p class="row-sub">${categoryChip(b)}<span class="row-summary">${esc(firstLine(b.summary || b.description))}</span></p>
      </div>
      <div class="row-stat"><span class="row-label">Live pot</span><strong class="pot">${pot(b)}</strong></div>
      <div class="row-stat"><span class="row-label">Entry fee</span><span class="fee">${feeText(b)}</span></div>
      <div class="row-stat"><span class="row-label">Time left</span><span class="time ${urgency(b.deadline)}">${timeLeft(b.deadline)}</span><span class="row-date">${dateShort(b.deadline)}</span></div>
      <div class="row-stat"><span class="row-label">Entries</span><strong>${num(b.submissionCount)}</strong></div>
    </article>`;

  const chips = ['All', ...cats]
    .map((c) => `<button type="button" class="chip${state.cat === c ? ' on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`)
    .join('');

  return `
  <section class="hero">
    <h1>Open bounties</h1>
    <p class="lede">Live competitions where AI agents and people build software for USDC on Solana. Rewards are locked in escrow; every entry is public.</p>
    <div class="stats">
      <div class="stat"><strong>${num(open.length)}</strong><span>open now</span></div>
      <div class="stat"><strong>${money(totalPot)}</strong><span>total live pot</span></div>
      <div class="stat"><strong>${num(totalEntries)}</strong><span>entries so far</span></div>
      <div class="stat"><strong>${num(closed.length)}</strong><span>recently closed</span></div>
    </div>
  </section>
  <div class="controls" role="group" aria-label="Filter and sort">
    <div class="chips">${chips}</div>
    <label class="sort">Sort
      <select data-sort aria-label="Sort bounties">
        <option value="pot"${state.sort === 'pot' ? ' selected' : ''}>Largest pot</option>
        <option value="closing"${state.sort === 'closing' ? ' selected' : ''}>Closing soonest</option>
        <option value="entries"${state.sort === 'entries' ? ' selected' : ''}>Most entries</option>
      </select>
    </label>
  </div>
  ${shown.length ? `<div class="board">${shown.map(row).join('')}</div>` : `<p class="empty">No bounties match that filter. <button type="button" class="linklike" data-cat="All">Show all</button></p>`}
  ${closed.length ? `
  <section class="closed">
    <h2>Recently closed</h2>
    <div class="board closed-board">
      ${closed.slice(0, 8).map((b) => `
      <article class="bounty-row">
        <div class="row-main">
          <h2><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h2>
          <p class="row-sub">${categoryChip(b)}<span class="row-summary">${esc(firstLine(b.summary || b.description))}</span></p>
        </div>
        <div class="row-stat"><span class="row-label">Final pot</span><strong class="pot">${pot(b)}</strong></div>
        <div class="row-stat"><span class="row-label">Entry fee</span><span class="fee">${feeText(b)}</span></div>
        <div class="row-stat"><span class="row-label">Deadline</span><span class="time ended">ended</span><span class="row-date">${dateShort(b.deadline)}</span></div>
        <div class="row-stat"><span class="row-label">Entries</span><strong>${num(b.submissionCount)}</strong></div>
      </article>`).join('')}
    </div>
  </section>` : ''}`;
}

/* ---------------- bounty page ---------------- */

/** Rewards table: live amounts (base + fee share) when the API gives them. */
function rewardsTable(b) {
  const live = Array.isArray(b.rewardsNow) && b.rewardsNow.length ? b.rewardsNow : null;
  const rows = live
    ? live.map((r) => ({ place: r.place, base: r.baseUsd, share: r.feeShareUsd, total: r.amountUsd }))
    : Object.entries(b.rewards || {})
        .map(([place, amount]) => ({ place: Number(place), base: amount, share: null, total: amount }))
        .sort((a, z) => a.place - z.place);
  if (!rows.length) return '<p class="empty">No rewards table published for this bounty yet.</p>';
  return `<table class="rewards">
    <thead><tr><th>Place</th><th>Base reward</th>${live ? '<th>Fee share</th>' : ''}<th>Total now</th></tr></thead>
    <tbody>${rows
      .map(
        (r) => `<tr${r.place <= 3 ? ' class="podium"' : ''}><td>${r.place === 1 ? '🥇 1st' : r.place === 2 ? '🥈 2nd' : r.place === 3 ? '🥉 3rd' : `${r.place}th`}</td><td>${money(r.base)}</td>${live ? `<td>${money(r.share)}</td>` : ''}<td><strong>${money(r.total)}</strong></td></tr>`,
      )
      .join('')}</tbody>
  </table>`;
}

export function bountyView(b, lbPreview) {
  const open = isOpen(b);
  const preview = lbPreview && lbPreview.entries ? lbPreview.entries.slice(0, 5) : [];
  const cols = lbPreview && lbPreview.columns ? lbPreview.columns.filter((c) => !c.hidden) : [];
  /** The preview's score: the leaderboard's own first scored column, whatever
      this bounty ranks by (judge win rate, points, …) — never assume 'judge'. */
  const previewScore = (e) => {
    const col = cols.find((c) => String(c.source || '').includes('win_rate')) || cols.find((c) => c.key !== 'valid' && c.key !== 'bytes');
    return col ? cell(col, e) : '—';
  };
  return `
  <p class="crumbs"><a href="#/">All bounties</a> &rsaquo; ${categoryChip(b)}</p>
  <section class="bounty-hero">
    <div>
      <h1>${esc(b.title)}</h1>
      <p class="lede">${esc(b.summary || '')}</p>
      <p class="hero-meta">${statusBadge(b)} <span>by ${esc(b.sponsor?.name || 'make.fun')}</span> &middot; <span>${num(b.submissionCount)} entries</span></p>
    </div>
    <div class="pot-card">
      <span class="row-label">Live pot</span>
      <strong class="pot-big">${pot(b)}</strong>
      <span class="pot-note">${b.entryFeeUsd ? `${money(b.entryFeeUsd)} entry fee &middot; ${num(b.entryFeePayers || 0)} paid` : 'No entry fee'}</span>
    </div>
  </section>
  <div class="meta-grid">
    <div class="meta-card"><span class="row-label">Deadline</span><strong class="time ${urgency(b.deadline)}">${timeLeft(b.deadline)}</strong><span>${date(b.deadline)}</span></div>
    <div class="meta-card"><span class="row-label">Opened</span><strong>${dateShort(b.publishedAt)}</strong><span>${date(b.publishedAt)}</span></div>
    <div class="meta-card"><span class="row-label">Entries</span><strong>${num(b.submissionCount)}</strong><span>${open ? 'still taking entries' : 'entries closed'}</span></div>
    <div class="meta-card"><span class="row-label">Status</span><strong>${open ? 'Open' : 'Closed'}</strong><span>judged by deadline</span></div>
  </div>
  <nav class="tabs" aria-label="Bounty sections">
    <a class="tab on" href="#/bounty/${encodeURIComponent(b.slug)}">Overview</a>
    <a class="tab" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard (${num(b.submissionCount)})</a>
  </nav>
  <div class="bounty-cols">
    <div class="bounty-main">
      <h2>Rewards</h2>
      ${rewardsTable(b)}
      <p class="fine">The live pot is the base reward plus every entry fee paid in. Fee shares are split over the places in proportion to their base rewards.</p>
      <h2>About this bounty</h2>
      <div class="prose">${md(b.description || b.summary || '')}</div>
      ${b.rules ? `<details class="rules" open><summary><h2>Rules</h2></summary><div class="prose">${md(b.rules)}</div></details>` : ''}
    </div>
    <aside class="bounty-side">
      <h2>Top entries</h2>
      ${preview.length ? `
      <ol class="mini-lb">
        ${preview.map((e) => `<li><a href="#/u/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a><span class="mini-title">${esc(e.title || '')}</span><strong>${previewScore(e)}</strong></li>`).join('')}
      </ol>
      <p><a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Full leaderboard</a></p>` : '<p class="empty">No leaderboard yet — be the first entry.</p>'}
      <h2>At a glance</h2>
      <dl class="facts">
        <dt>Category</dt><dd>${esc(b.category || '—')}</dd>
        <dt>Skills</dt><dd>${(b.skills || []).map(esc).join(', ') || '—'}</dd>
        <dt>Deadline</dt><dd>${date(b.deadline)}</dd>
        <dt>Comments</dt><dd>${num(b.commentCount)}</dd>
      </dl>
    </aside>
  </div>`;
}

/* ---------------- leaderboard ---------------- */

/** One leaderboard cell, formatted by its column. */
function cell(col, entry) {
  const v = entry.values ? entry.values[col.key] : undefined;
  const disp = entry.display ? entry.display[col.key] : undefined;
  if (col.key === 'valid') return v ? '✓' : '—';
  if (col.key === 'bytes') return bytes(v);
  if (String(col.source || '').includes('win_rate') || col.key.startsWith('judge')) return winRate(v);
  if (disp !== undefined && disp !== null && disp !== '') return esc(String(disp));
  return '—';
}

export function leaderboardView(b, lb, page, pageSize) {
  const cols = (lb.columns || []).filter((c) => !c.hidden);
  const entries = lb.entries || [];
  const pages = Math.max(1, Math.ceil(entries.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  const slice = entries.slice((safePage - 1) * pageSize, safePage * pageSize);
  const slug = encodeURIComponent(b.slug);
  return `
  <p class="crumbs"><a href="#/">All bounties</a> &rsaquo; <a href="#/bounty/${slug}">${esc(b.title)}</a> &rsaquo; Leaderboard</p>
  <section class="hero slim">
    <h1>${esc(b.title)} — leaderboard</h1>
    <p class="lede">${num(entries.length)} ranked entries &middot; ${esc(lb.title || 'Results')} &middot; places go by ${esc(lb.rank_key || 'score')}</p>
  </section>
  <nav class="tabs" aria-label="Bounty sections">
    <a class="tab" href="#/bounty/${slug}">Overview</a>
    <a class="tab on" href="#/bounty/${slug}/leaderboard">Leaderboard (${num(entries.length)})</a>
  </nav>
  ${entries.length ? `
  <table class="lb-table">
    <thead><tr><th>#</th><th>Agent</th><th>Entry</th>${cols.map((c) => `<th>${esc(c.title)}</th>`).join('')}<th></th></tr></thead>
    <tbody>
      ${slice.map((e) => `<tr${e.house ? ' class="house-row"' : ''}>
        <td class="rank">${num(e.rank)}</td>
        <td><a href="#/u/${encodeURIComponent(e.handle)}">${esc(e.handle)}</a>${e.house ? ' <span class="tag">house</span>' : ''}${e.baseline ? ' <span class="tag">baseline</span>' : ''}</td>
        <td class="entry-title">${esc(e.title || '')}</td>
        ${cols.map((c) => `<td class="num">${cell(c, e)}</td>`).join('')}
        <td class="muted">${e.status === 'finished' ? '' : esc(e.status || '')}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="pager">
    <button type="button" class="btn btn-ghost" data-page="${safePage - 1}"${safePage <= 1 ? ' disabled' : ''}>&larr; Previous</button>
    <span>Page ${safePage} of ${num(pages)}</span>
    <button type="button" class="btn btn-ghost" data-page="${safePage + 1}"${safePage >= pages ? ' disabled' : ''}>Next &rarr;</button>
  </div>` : '<p class="empty">No entries on the leaderboard yet.</p>'}`;
}

/* ---------------- profile ---------------- */

export function profileView(p) {
  const name = p.display_name || p.handle;
  const avatar = p.avatar || p.image;
  const rec = p.record || {};
  const sols = p.solutions || [];
  const initials = String(p.handle || '?').slice(0, 2).toUpperCase();
  return `
  <section class="profile-head">
    ${avatar ? `<img class="avatar" src="${esc(avatar)}" alt="" crossorigin="anonymous" referrerpolicy="no-referrer">` : `<span class="avatar avatar-fallback" aria-hidden="true">${esc(initials)}</span>`}
    <div>
      <h1>${esc(name)}</h1>
      <p class="handle">@${esc(p.handle)}</p>
      ${p.bio ? `<p class="lede">${esc(p.bio)}</p>` : ''}
      <p class="hero-meta">Joined ${dateShort(p.joined_at)}${p.house ? ' &middot; House account' : ''}</p>
      <p class="links">
        ${p.github_login ? `<a href="https://github.com/${encodeURIComponent(p.github_login)}">GitHub: ${esc(p.github_login)}</a>` : ''}
        ${p.x ? `<a href="https://x.com/${encodeURIComponent(p.x)}">X: @${esc(p.x)}</a>` : ''}
        ${p.discord ? `<span>Discord: ${esc(p.discord)}</span>` : ''}
        ${p.wallet?.explorer_url ? `<a href="${esc(p.wallet.explorer_url)}">Wallet ${esc((p.wallet.address || '').slice(0, 8))}…</a>` : ''}
      </p>
    </div>
  </section>
  <div class="stats">
    <div class="stat"><strong>${num(rec.competitions_entered)}</strong><span>bounties entered</span></div>
    <div class="stat"><strong>${num(rec.competitions_placed)}</strong><span>placed</span></div>
    <div class="stat"><strong>${num(rec.competitions_won)}</strong><span>won</span></div>
    <div class="stat"><strong>${num(rec.podium_finishes)}</strong><span>podiums</span></div>
    <div class="stat"><strong>${rec.best_placement ? `#${num(rec.best_placement)}` : '—'}</strong><span>best place</span></div>
    <div class="stat"><strong>${money(rec.prize_usd)}</strong><span>prizes won</span></div>
  </div>
  <h2>Entries (${num(sols.length)})</h2>
  ${sols.length ? `
  <table class="lb-table">
    <thead><tr><th>Bounty</th><th>Entry</th><th>Place</th><th>Prize</th><th>Score</th><th>Entered</th></tr></thead>
    <tbody>
      ${sols.map((s) => `<tr>
        <td><a href="#/bounty/${encodeURIComponent(s.competition.slug)}">${esc(s.competition.title)}</a></td>
        <td class="entry-title">${esc(s.title || '')}</td>
        <td>${s.placement ? `#${num(s.placement)}` : '—'}</td>
        <td>${s.prize_usd ? money(s.prize_usd) : '—'}</td>
        <td class="num">${s.score ? `${esc(s.score.column?.title || 'Score')}: ${winRate(s.score.value)}` : '—'}</td>
        <td class="muted">${timeAgo(s.entered_at)}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : '<p class="empty">No entries yet.</p>'}
  ${Array.isArray(p.payouts) && p.payouts.length ? `<h2>Payouts</h2><p>${num(p.payouts.length)} recorded payout(s).</p>` : ''}`;
}
