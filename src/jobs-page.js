// ─────────────────────────────────────────────────────────────────────────────
// Job Opportunities kiosk page
// ─────────────────────────────────────────────────────────────────────────────

import { loadJobs, sendJobListEmail } from './shared/jobs-loader.js';
import { formatJobDate } from './shared/jobs-parser.js';

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'expiring', label: 'Expiring soon' },
  { id: 'employer', label: 'Employer A-Z' },
  { id: 'title', label: 'Job title A-Z' },
];

const PAGE_SIZE = 12;

const state = {
  allJobs: [],
  meta: {},
  loaded: false,
  loading: false,
  searchQuery: '',
  activeSearch: '',
  sort: 'newest',
  activeFilters: { feed: 'all' },
  page: 1,
  selected: new Set(),
  cartOpen: false,
  emailModalOpen: false,
};

let els = {};
let onInteraction = () => {};

export function initJobsPage(elements, interactionCb) {
  els = elements;
  onInteraction = interactionCb || (() => {});
  bindJobsEvents();
}

export async function loadJobsPage({ force = false } = {}) {
  if (state.loading) return;
  if (state.loaded && !force) {
    renderJobsPage();
    return;
  }

  state.loading = true;
  showJobsSkeleton();
  try {
    const data = await loadJobs({ force });
    state.allJobs = data.jobs || [];
    state.meta = data.meta || {};
    state.loaded = true;
  } catch {
    state.allJobs = [];
    state.meta = {};
  } finally {
    state.loading = false;
    renderJobsPage();
  }
}

function bindJobsEvents() {
  els.jobsSearchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    state.activeSearch = state.searchQuery.trim();
    state.page = 1;
    renderJobsPage();
    onInteraction();
  });

  els.jobsSearchInput?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
  });

  els.jobsSortSelect?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    state.page = 1;
    renderJobsPage();
    onInteraction();
  });

  els.jobsCartToggle?.addEventListener('click', () => {
    state.cartOpen = !state.cartOpen;
    renderCart();
    onInteraction();
  });

  els.jobsCartClose?.addEventListener('click', () => {
    state.cartOpen = false;
    renderCart();
  });

  els.jobsCartClear?.addEventListener('click', () => {
    state.selected.clear();
    state.cartOpen = false;
    renderJobsPage();
    onInteraction();
  });

  els.jobsCartEmail?.addEventListener('click', () => openEmailModal());

  els.jobsEmailForm?.addEventListener('submit', handleEmailSubmit);

  els.jobsEmailClose?.addEventListener('click', closeEmailModal);
  els.jobsEmailCancel?.addEventListener('click', closeEmailModal);
  els.jobsEmailBackdrop?.addEventListener('click', (e) => {
    if (e.target === els.jobsEmailBackdrop) closeEmailModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.emailModalOpen) closeEmailModal();
  });
}

function getFilterGroups() {
  const groups = { feed: new Set() };
  const fields = ['industry', 'jobType', 'location', 'employer'];

  for (const job of state.allJobs) {
    if (job.feedTitle) groups.feed.add(job.feedTitle);
    for (const f of fields) {
      if (!groups[f]) groups[f] = new Set();
      if (job[f]?.trim()) groups[f].add(job[f].trim());
    }
    for (const tag of job.tags || []) {
      if (!groups.tags) groups.tags = new Set();
      if (tag?.trim()) groups.tags.add(tag.trim());
    }
  }

  const labels = {
    feed: 'Feed',
    industry: 'Industry',
    jobType: 'Job Type',
    location: 'Location',
    employer: 'Employer',
    tags: 'Tags',
  };

  return Object.entries(groups)
    .filter(([, set]) => set.size > 0)
    .map(([key, set]) => ({
      key,
      label: labels[key] || key,
      values: [...set].sort((a, b) => a.localeCompare(b)),
    }));
}

function matchesFilters(job) {
  const f = state.activeFilters;
  if (f.feed && f.feed !== 'all' && job.feedTitle !== f.feed) return false;
  if (f.industry && job.industry !== f.industry) return false;
  if (f.jobType && job.jobType !== f.jobType) return false;
  if (f.location && job.location !== f.location) return false;
  if (f.employer && job.employer !== f.employer) return false;
  if (f.tags && !(job.tags || []).includes(f.tags)) return false;
  return true;
}

function matchesSearch(job, q) {
  if (!q) return true;
  const hay = [
    job.title, job.displayTitle, job.employer, job.descriptionText,
    job.summary, job.industry, job.location, job.jobType, job.feedTitle,
    ...(job.tags || []),
  ].join(' ').toLowerCase();
  return hay.includes(q.toLowerCase());
}

function sortJobs(jobs) {
  const copy = [...jobs];
  switch (state.sort) {
    case 'oldest':
      return copy.sort((a, b) => new Date(a.pubDate || 0) - new Date(b.pubDate || 0));
    case 'expiring':
      return copy.sort((a, b) => {
        const ae = a.expiresAt ? new Date(a.expiresAt) : new Date('9999-12-31');
        const be = b.expiresAt ? new Date(b.expiresAt) : new Date('9999-12-31');
        return ae - be;
      });
    case 'employer':
      return copy.sort((a, b) => (a.employer || '').localeCompare(b.employer || ''));
    case 'title':
      return copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    default:
      return copy.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
  }
}

function getFilteredJobs() {
  return sortJobs(
    state.allJobs.filter((j) => matchesFilters(j) && matchesSearch(j, state.activeSearch)),
  );
}

function showJobsSkeleton() {
  if (!els.jobsGrid) return;
  els.jobsGrid.innerHTML = Array.from({ length: 8 }, () =>
    '<div class="job-card job-card--skeleton" aria-hidden="true"><div class="job-card__skel-bar"></div><div class="job-card__skel-line job-card__skel-line--lg"></div><div class="job-card__skel-line"></div><div class="job-card__skel-line job-card__skel-line--sm"></div><div class="job-card__skel-block"></div></div>',
  ).join('');
  if (els.jobsSummary) els.jobsSummary.textContent = 'Loading jobs…';
}

function renderFilterPills() {
  if (!els.jobsFilters) return;
  const groups = getFilterGroups();
  const pills = ['<button type="button" class="jobs-pill' + (state.activeFilters.feed === 'all' ? ' jobs-pill--active' : '') + '" data-filter="feed" data-value="all">All Feeds</button>'];

  for (const g of groups) {
    if (g.key === 'feed') {
      for (const val of g.values) {
        const active = state.activeFilters.feed === val;
        pills.push(`<button type="button" class="jobs-pill${active ? ' jobs-pill--active' : ''}" data-filter="feed" data-value="${esc(val)}">${esc(val)}</button>`);
      }
    } else {
      for (const val of g.values.slice(0, 12)) {
        const active = state.activeFilters[g.key] === val;
        pills.push(`<button type="button" class="jobs-pill${active ? ' jobs-pill--active' : ''}" data-filter="${g.key}" data-value="${esc(val)}">${esc(val)}</button>`);
      }
    }
  }

  els.jobsFilters.innerHTML = pills.join('');
  els.jobsFilters.querySelectorAll('.jobs-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { filter, value } = btn.dataset;
      if (filter === 'feed' && value === 'all') {
        state.activeFilters = { feed: 'all' };
      } else if (state.activeFilters[filter] === value) {
        delete state.activeFilters[filter];
        if (!state.activeFilters.feed) state.activeFilters.feed = 'all';
      } else {
        state.activeFilters[filter] = value;
        if (filter !== 'feed') state.activeFilters.feed = state.activeFilters.feed || 'all';
      }
      state.page = 1;
      renderJobsPage();
      onInteraction();
    });
  });
}

function renderJobCard(job) {
  const selected = state.selected.has(job.id);
  const title = esc(job.displayTitle || job.title);
  const employer = esc(job.employer);
  const posted = formatJobDate(job.pubDate);
  const expires = formatJobDate(job.expiresAt);
  const summary = esc(job.summary || '');
  const url = esc(job.applicationUrl);

  return `
    <article class="job-card${selected ? ' job-card--selected' : ''}" data-job-id="${esc(job.id)}">
      <div class="job-card__accent" aria-hidden="true"></div>
      ${selected ? '<div class="job-card__check" aria-hidden="true">✓</div>' : ''}
      <button type="button" class="job-card__select-area" aria-pressed="${selected}" aria-label="${selected ? 'Remove from my list' : 'Add to my list'}: ${title}">
        <h3 class="job-card__title">${title}</h3>
        ${employer ? `<p class="job-card__employer">${employer}</p>` : ''}
        <p class="job-card__date">Posted ${posted || '—'}</p>
        <p class="job-card__expires">Expires ${expires || '—'}</p>
        <p class="job-card__summary">${summary}</p>
      </button>
      <div class="job-card__actions">
        <button type="button" class="job-card__list-btn${selected ? ' job-card__list-btn--added' : ''}" data-action="toggle" data-id="${esc(job.id)}">
          ${selected ? 'Added to My List' : 'Add to My List'}
        </button>
        <a class="job-card__apply-btn" href="${url}" target="_blank" rel="noopener noreferrer" data-action="apply">
          View More and Apply
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>
        </a>
      </div>
    </article>`;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderJobsPage() {
  if (!els.jobsGrid) return;

  renderFilterPills();

  if (!state.allJobs.length) {
    els.jobsGrid.innerHTML = '';
    if (els.jobsEmpty) {
      els.jobsEmpty.classList.remove('is-hidden');
      els.jobsEmpty.textContent = 'No job opportunities have been added yet. Check back soon or ask a Career Center team member for help.';
    }
    if (els.jobsNoResults) els.jobsNoResults.classList.add('is-hidden');
    if (els.jobsSummary) els.jobsSummary.innerHTML = '<span class="jobs-count">0 jobs found</span>';
    renderCart();
    return;
  }

  if (els.jobsEmpty) els.jobsEmpty.classList.add('is-hidden');

  const filtered = getFilteredJobs();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;

  const start = (state.page - 1) * PAGE_SIZE;
  const pageJobs = filtered.slice(start, start + PAGE_SIZE);

  if (!pageJobs.length) {
    els.jobsGrid.innerHTML = '';
    if (els.jobsNoResults) {
      els.jobsNoResults.classList.remove('is-hidden');
      els.jobsNoResults.textContent = 'No jobs match your search. Try adjusting your filters or searching for another keyword.';
    }
  } else {
    if (els.jobsNoResults) els.jobsNoResults.classList.add('is-hidden');
    els.jobsGrid.innerHTML = pageJobs.map(renderJobCard).join('');

    els.jobsGrid.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleJob(btn.dataset.id);
      });
    });

    els.jobsGrid.querySelectorAll('.job-card__select-area').forEach((area) => {
      area.addEventListener('click', () => {
        const card = area.closest('.job-card');
        if (card) toggleJob(card.dataset.jobId);
      });
    });

    els.jobsGrid.querySelectorAll('[data-action="apply"]').forEach((link) => {
      link.addEventListener('click', (e) => e.stopPropagation());
    });
  }

  if (els.jobsSummary) {
    els.jobsSummary.innerHTML = `<span class="jobs-count">${filtered.length} job${filtered.length === 1 ? '' : 's'} found</span> · Page ${state.page} of ${totalPages}`;
  }

  renderCart();
}

function toggleJob(id) {
  if (!id) return;
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  renderJobsPage();
  onInteraction();
}

function renderCart() {
  const count = state.selected.size;
  if (els.jobsCartCount) els.jobsCartCount.textContent = count;
  if (els.jobsCartBar) els.jobsCartBar.classList.toggle('is-visible', count > 0);

  if (!els.jobsCartPanel) return;
  els.jobsCartPanel.classList.toggle('is-open', state.cartOpen && count > 0);

  const selectedJobs = state.allJobs.filter((j) => state.selected.has(j.id));
  if (els.jobsCartList) {
    els.jobsCartList.innerHTML = selectedJobs.length
      ? selectedJobs.map((j) => `
          <div class="jobs-cart-item">
            <div class="jobs-cart-item__info">
              <div class="jobs-cart-item__title">${esc(j.displayTitle || j.title)}</div>
              ${j.employer ? `<div class="jobs-cart-item__sub">${esc(j.employer)}</div>` : ''}
            </div>
            <button type="button" class="jobs-cart-item__remove" data-remove="${esc(j.id)}" aria-label="Remove">×</button>
          </div>`).join('')
      : '<p class="jobs-cart-empty">No jobs selected yet.</p>';

    els.jobsCartList.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selected.delete(btn.dataset.remove);
        if (!state.selected.size) state.cartOpen = false;
        renderJobsPage();
        onInteraction();
      });
    });
  }
}

function openEmailModal() {
  if (!state.selected.size) return;
  state.emailModalOpen = true;
  state.cartOpen = false;
  if (els.jobsEmailBackdrop) els.jobsEmailBackdrop.classList.remove('is-hidden');
  if (els.jobsEmailError) els.jobsEmailError.classList.add('is-hidden');
  if (els.jobsEmailSuccess) els.jobsEmailSuccess.classList.add('is-hidden');
  if (els.jobsEmailForm) els.jobsEmailForm.reset();
  els.jobsEmailEmail?.focus();
  onInteraction();
}

function closeEmailModal() {
  state.emailModalOpen = false;
  if (els.jobsEmailBackdrop) els.jobsEmailBackdrop.classList.add('is-hidden');
}

async function handleEmailSubmit(e) {
  e.preventDefault();
  const name = els.jobsEmailName?.value?.trim() || '';
  const email = els.jobsEmailEmail?.value?.trim() || '';
  const consent = els.jobsEmailConsent?.checked;

  if (!email) {
    showEmailError('Please enter your email address.');
    return;
  }
  if (!consent) {
    showEmailError('Please agree to receive your job list by email.');
    return;
  }

  const submit = els.jobsEmailSubmit;
  const prev = submit?.textContent;
  if (submit) { submit.disabled = true; submit.textContent = 'Sending…'; }
  if (els.jobsEmailError) els.jobsEmailError.classList.add('is-hidden');

  try {
    await sendJobListEmail({
      studentName: name,
      studentEmail: email,
      jobs: [...state.selected],
    });
    if (els.jobsEmailSuccess) {
      els.jobsEmailSuccess.classList.remove('is-hidden');
      els.jobsEmailSuccess.textContent = 'Your job list has been sent! Check your inbox.';
    }
    if (els.jobsEmailForm) els.jobsEmailForm.classList.add('is-hidden');
    state.selected.clear();
    setTimeout(() => {
      closeEmailModal();
      if (els.jobsEmailForm) els.jobsEmailForm.classList.remove('is-hidden');
      if (els.jobsEmailSuccess) els.jobsEmailSuccess.classList.add('is-hidden');
      renderJobsPage();
    }, 2200);
  } catch {
    showEmailError('We couldn\u2019t send your job list right now. Please try again or ask a Career Center team member for help.');
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = prev; }
  }
}

function showEmailError(msg) {
  if (!els.jobsEmailError) return;
  els.jobsEmailError.textContent = msg;
  els.jobsEmailError.classList.remove('is-hidden');
}

export function getJobsPageElements() {
  return {
    jobsSearchForm: document.getElementById('jobs-search-form'),
    jobsSearchInput: document.getElementById('jobs-search-input'),
    jobsSortSelect: document.getElementById('jobs-sort-select'),
    jobsSummary: document.getElementById('jobs-summary'),
    jobsFilters: document.getElementById('jobs-filters'),
    jobsGrid: document.getElementById('jobs-grid'),
    jobsEmpty: document.getElementById('jobs-empty'),
    jobsNoResults: document.getElementById('jobs-no-results'),
    jobsCartBar: document.getElementById('jobs-cart-bar'),
    jobsCartCount: document.getElementById('jobs-cart-count'),
    jobsCartToggle: document.getElementById('jobs-cart-review'),
    jobsCartPanel: document.getElementById('jobs-cart-panel'),
    jobsCartClose: document.getElementById('jobs-cart-close'),
    jobsCartList: document.getElementById('jobs-cart-list'),
    jobsCartClear: document.getElementById('jobs-cart-clear'),
    jobsCartEmail: document.getElementById('jobs-cart-email'),
    jobsEmailBackdrop: document.getElementById('jobs-email-modal'),
    jobsEmailForm: document.getElementById('jobs-email-form'),
    jobsEmailName: document.getElementById('jobs-email-name'),
    jobsEmailEmail: document.getElementById('jobs-email-email'),
    jobsEmailConsent: document.getElementById('jobs-email-consent'),
    jobsEmailSubmit: document.getElementById('jobs-email-submit'),
    jobsEmailCancel: document.getElementById('jobs-email-cancel'),
    jobsEmailClose: document.getElementById('jobs-email-close'),
    jobsEmailError: document.getElementById('jobs-email-error'),
    jobsEmailSuccess: document.getElementById('jobs-email-success'),
  };
}
