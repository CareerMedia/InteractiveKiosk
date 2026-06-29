// ─────────────────────────────────────────────────────────────────────────────
// Job Opportunities kiosk page
// ─────────────────────────────────────────────────────────────────────────────

import { loadJobs, sendJobListEmail, MAX_EMAIL_JOBS } from './shared/jobs-loader.js';
import { formatJobDate, getEmployerInitials, jobCardExcerpt, truncateWords } from './shared/jobs-parser.js';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const EXPIRING_SOON_DAYS = 14;

const CHIP_DEFS = [
  { id: 'internship', label: 'Internship' },
  { id: 'part-time', label: 'Part-time' },
  { id: 'full-time', label: 'Full-time' },
  { id: 'paid', label: 'Paid' },
  { id: 'expiring', label: 'Expiring soon' },
];

const JOB_TYPE_CHIPS = new Set(['internship', 'part-time', 'full-time']);

const state = {
  allJobs: [],
  meta: {},
  loaded: false,
  loading: false,
  searchQuery: '',
  sort: 'newest',
  page: 1,
  viewMode: 'grid',
  activeChips: new Set(),
  employerFilters: new Set(),
  employerDropdownOpen: false,
  employerSearchQuery: '',
  selected: new Set(),
  cartOpen: false,
  emailModalOpen: false,
  detailJobId: null,
};

let els = {};
let onInteraction = () => {};
let searchDebounce = null;

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
    state.page = 1;
    renderJobsPage();
    onInteraction();
  });

  els.jobsSearchInput?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.page = 1;
      renderJobsPage();
      onInteraction();
    }, SEARCH_DEBOUNCE_MS);
  });

  els.jobsSortSelect?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    state.page = 1;
    renderJobsPage();
    onInteraction();
  });

  els.jobsViewList?.addEventListener('click', () => setViewMode('list'));
  els.jobsViewGrid?.addEventListener('click', () => setViewMode('grid'));

  els.jobsClearFilters?.addEventListener('click', () => {
    state.activeChips.clear();
    state.employerFilters.clear();
    state.employerSearchQuery = '';
    if (els.jobsEmployerSearch) els.jobsEmployerSearch.value = '';
    closeEmployerDropdown();
    state.searchQuery = '';
    if (els.jobsSearchInput) els.jobsSearchInput.value = '';
    state.page = 1;
    renderJobsPage();
    onInteraction();
  });

  bindEmployerFilterEvents();

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

  els.jobsDetailClose?.addEventListener('click', closeJobDetail);
  els.jobsDetailBackdrop?.addEventListener('click', (e) => {
    if (e.target === els.jobsDetailBackdrop) closeJobDetail();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (state.employerDropdownOpen) closeEmployerDropdown();
    else if (state.emailModalOpen) closeEmailModal();
    else if (state.detailJobId) closeJobDetail();
  });
}

function setViewMode(mode) {
  if (state.viewMode === mode) return;
  state.viewMode = mode;
  els.jobsViewList?.classList.toggle('jobs-view-btn--active', mode === 'list');
  els.jobsViewGrid?.classList.toggle('jobs-view-btn--active', mode === 'grid');
  els.jobsViewList?.setAttribute('aria-pressed', mode === 'list' ? 'true' : 'false');
  els.jobsViewGrid?.setAttribute('aria-pressed', mode === 'grid' ? 'true' : 'false');
  renderJobsPage();
  onInteraction();
}

function matchesJobTypeChip(job, chipId) {
  const hay = [
    job.jobType, job.title, job.displayTitle, job.descriptionText,
  ].join(' ').toLowerCase();
  if (chipId === 'internship') return /\bintern/.test(hay);
  if (chipId === 'part-time') return /part[-\s]?time/.test(hay);
  if (chipId === 'full-time') return /full[-\s]?time/.test(hay);
  return false;
}

function isPaidJob(job) {
  return Boolean(String(job.payRange || '').trim());
}

function isExpiringSoon(job) {
  if (!job.expiresAt) return false;
  const exp = new Date(job.expiresAt);
  if (Number.isNaN(exp.getTime())) return false;
  const days = (exp - Date.now()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= EXPIRING_SOON_DAYS;
}

function matchesChip(job, chipId) {
  if (chipId === 'paid') return isPaidJob(job);
  if (chipId === 'expiring') return isExpiringSoon(job);
  return matchesJobTypeChip(job, chipId);
}

function matchesChips(job) {
  if (!state.activeChips.size) return true;

  const activeTypes = [...state.activeChips].filter((id) => JOB_TYPE_CHIPS.has(id));
  if (activeTypes.length && !activeTypes.some((id) => matchesChip(job, id))) return false;
  if (state.activeChips.has('paid') && !matchesChip(job, 'paid')) return false;
  if (state.activeChips.has('expiring') && !matchesChip(job, 'expiring')) return false;
  return true;
}

function matchesSearch(job, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  const hay = [
    job.title, job.displayTitle, job.employer, job.jobType,
    job.location, job.payRange, job.descriptionText, job.summary,
  ].join(' ').toLowerCase();
  return hay.includes(needle);
}

function matchesEmployer(job) {
  if (!state.employerFilters.size) return true;
  return state.employerFilters.has((job.employer || '').trim());
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
  const q = state.searchQuery.trim();
  return sortJobs(state.allJobs.filter((j) =>
    matchesSearch(j, q) && matchesChips(j) && matchesEmployer(j),
  ));
}

function getDistinctEmployers() {
  const map = new Map();
  for (const job of state.allJobs) {
    const name = (job.employer || '').trim();
    if (!name) continue;
    map.set(name, (map.get(name) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

function hasActiveFilters() {
  return state.activeChips.size > 0
    || state.employerFilters.size > 0
    || Boolean(state.searchQuery.trim());
}

function getJobById(id) {
  return state.allJobs.find((j) => String(j.id) === String(id));
}

function avatarHtml(employer, size = 'md') {
  const initials = getEmployerInitials(employer);
  return `<div class="job-avatar job-avatar--${size}" aria-hidden="true">${esc(initials)}</div>`;
}

function showJobsSkeleton() {
  if (!els.jobsGrid) return;
  els.jobsGrid.className = `jobs-grid jobs-grid--${state.viewMode}`;
  const skeleton = state.viewMode === 'list'
    ? '<div class="job-list-row job-list-row--skeleton" aria-hidden="true"></div>'
    : '<div class="job-card job-card--skeleton" aria-hidden="true"><div class="job-card__skel-bar"></div><div class="job-card__skel-line job-card__skel-line--lg"></div><div class="job-card__skel-line"></div><div class="job-card__skel-line job-card__skel-line--sm"></div><div class="job-card__skel-block"></div></div>';
  els.jobsGrid.innerHTML = Array.from({ length: 6 }, () => skeleton).join('');
  if (els.jobsSummary) els.jobsSummary.textContent = 'Loading jobs…';
}

function cardMetaHtml(job) {
  const fields = [
    ['Pay range', job.payRange],
    ['Job type', job.jobType],
  ].filter(([, value]) => String(value || '').trim());

  if (!fields.length) return '';

  return `<div class="job-card__meta">${fields.map(([label, value]) => `
    <div class="job-card__meta-item">
      <span class="job-card__meta-label">${esc(label)}</span>
      <span class="job-card__meta-value">${esc(truncateWords(value, 12))}</span>
    </div>`).join('')}</div>`;
}

function renderJobCard(job) {
  const selected = state.selected.has(job.id);
  const title = esc(job.title || job.displayTitle);
  const employer = esc(job.employer);
  const posted = formatJobDate(job.pubDate);
  const expires = formatJobDate(job.expiresAt);
  const excerpt = esc(jobCardExcerpt(job));

  return `
    <article class="job-card${selected ? ' job-card--selected' : ''}" data-job-id="${esc(job.id)}">
      <div class="job-card__accent" aria-hidden="true"></div>
      ${selected ? '<div class="job-card__check" aria-hidden="true">✓</div>' : ''}
      <div class="job-card__body">
        <div class="job-card__header">
          ${avatarHtml(job.employer)}
          <div class="job-card__headings">
            <h3 class="job-card__title">${title}</h3>
            ${employer ? `<p class="job-card__employer">${employer}</p>` : ''}
          </div>
        </div>
        <p class="job-card__date">Posted ${posted || '—'}</p>
        <p class="job-card__expires">Expires ${expires || '—'}</p>
        ${excerpt ? `<p class="job-card__excerpt">${excerpt}</p>` : ''}
        ${cardMetaHtml(job)}
      </div>
      <div class="job-card__actions">
        <button type="button" class="job-card__list-btn${selected ? ' job-card__list-btn--added' : ''}" data-action="toggle" data-id="${esc(job.id)}">
          ${selected ? 'Added to My List' : 'Add to My List'}
        </button>
        <button type="button" class="job-card__more-btn" data-action="detail" data-id="${esc(job.id)}">View More</button>
      </div>
    </article>`;
}

function renderJobListRow(job) {
  const selected = state.selected.has(job.id);
  const title = esc(job.title || job.displayTitle);
  const employer = esc(job.employer);
  const jobType = esc(truncateWords(job.jobType, 8));
  const pay = esc(truncateWords(job.payRange, 8));
  const meta = [jobType, pay].filter((s) => s && s !== '—').join(' · ');

  return `
    <article class="job-list-row${selected ? ' job-list-row--selected' : ''}" data-job-id="${esc(job.id)}">
      ${avatarHtml(job.employer, 'sm')}
      <div class="job-list-row__main">
        <h3 class="job-list-row__title">${title}</h3>
        <p class="job-list-row__sub">${employer || '—'}${meta ? ` · ${meta}` : ''}</p>
      </div>
      <div class="job-list-row__actions">
        <button type="button" class="job-list-row__btn${selected ? ' job-list-row__btn--added' : ''}" data-action="toggle" data-id="${esc(job.id)}">
          ${selected ? 'Added' : '+ List'}
        </button>
        <button type="button" class="job-list-row__btn job-list-row__btn--primary" data-action="detail" data-id="${esc(job.id)}">Details</button>
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

function formatDescriptionText(text) {
  return esc(text).replace(/\n/g, '<br>');
}

function metaRow(label, value) {
  if (!value) return '';
  return `<div class="jobs-detail__meta-row"><span class="jobs-detail__meta-label">${esc(label)}</span><span class="jobs-detail__meta-value">${esc(truncateWords(value, 12))}</span></div>`;
}

function renderFilterChips() {
  if (!els.jobsFilterChips) return;
  els.jobsFilterChips.innerHTML = CHIP_DEFS.map(({ id, label }) => {
    const active = state.activeChips.has(id);
    return `<button type="button" class="jobs-chip${active ? ' jobs-chip--active' : ''}" data-chip="${id}" aria-pressed="${active}">${label}</button>`;
  }).join('');

  els.jobsFilterChips.querySelectorAll('[data-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.chip;
      if (state.activeChips.has(id)) state.activeChips.delete(id);
      else state.activeChips.add(id);
      state.page = 1;
      renderJobsPage();
      onInteraction();
    });
  });
}

function getEmployerFilterLabel() {
  const count = state.employerFilters.size;
  if (!count) return 'All employers';
  if (count === 1) return [...state.employerFilters][0];
  return `${count} employers selected`;
}

function getFilteredEmployerOptions() {
  const q = state.employerSearchQuery.trim().toLowerCase();
  const all = getDistinctEmployers();
  if (!q) return all;
  return all.filter(({ name }) => name.toLowerCase().includes(q));
}

let employerFilterEventsBound = false;

function bindEmployerFilterEvents() {
  if (employerFilterEventsBound) return;
  employerFilterEventsBound = true;

  els.jobsEmployerTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.employerDropdownOpen) closeEmployerDropdown();
    else openEmployerDropdown();
    onInteraction();
  });

  els.jobsEmployerSearch?.addEventListener('input', (e) => {
    state.employerSearchQuery = e.target.value;
    renderEmployerList();
    onInteraction();
  });

  els.jobsEmployerSearch?.addEventListener('keydown', (e) => {
    e.stopPropagation();
  });

  els.jobsEmployerSelectAll?.addEventListener('click', (e) => {
    e.preventDefault();
    for (const { name } of getFilteredEmployerOptions()) {
      state.employerFilters.add(name);
    }
    state.page = 1;
    renderJobsPage();
    onInteraction();
  });

  els.jobsEmployerClearSel?.addEventListener('click', (e) => {
    e.preventDefault();
    state.employerFilters.clear();
    state.page = 1;
    renderJobsPage();
    onInteraction();
  });

  document.addEventListener('pointerdown', (e) => {
    if (!state.employerDropdownOpen) return;
    if (els.jobsEmployerMs?.contains(e.target)) return;
    closeEmployerDropdown();
  });
}

function openEmployerDropdown() {
  state.employerDropdownOpen = true;
  state.employerSearchQuery = '';
  if (els.jobsEmployerSearch) els.jobsEmployerSearch.value = '';
  els.jobsEmployerPanel?.classList.remove('is-hidden');
  els.jobsEmployerTrigger?.setAttribute('aria-expanded', 'true');
  renderEmployerList();
  window.setTimeout(() => els.jobsEmployerSearch?.focus(), 0);
}

function closeEmployerDropdown() {
  if (!state.employerDropdownOpen) return;
  state.employerDropdownOpen = false;
  state.employerSearchQuery = '';
  if (els.jobsEmployerSearch) els.jobsEmployerSearch.value = '';
  els.jobsEmployerPanel?.classList.add('is-hidden');
  els.jobsEmployerTrigger?.setAttribute('aria-expanded', 'false');
}

function renderEmployerList() {
  if (!els.jobsEmployerList) return;
  const employers = getFilteredEmployerOptions();

  els.jobsEmployerEmpty?.classList.toggle('is-hidden', employers.length > 0);

  els.jobsEmployerList.innerHTML = employers.map(({ name, count }) => {
    const checked = state.employerFilters.has(name);
    return `
      <label class="jobs-employer-ms__option${checked ? ' jobs-employer-ms__option--checked' : ''}">
        <input type="checkbox" class="jobs-employer-ms__checkbox" data-employer="${esc(name)}" ${checked ? 'checked' : ''} />
        <span class="jobs-employer-ms__name">${esc(name)}</span>
        <span class="jobs-employer-ms__count">${count}</span>
      </label>`;
  }).join('');

  els.jobsEmployerList.querySelectorAll('[data-employer]').forEach((input) => {
    input.addEventListener('change', () => {
      const name = input.dataset.employer;
      if (input.checked) state.employerFilters.add(name);
      else state.employerFilters.delete(name);
      state.page = 1;
      renderJobsPage();
      onInteraction();
    });
  });
}

function renderEmployerFilter() {
  if (!els.jobsEmployerWrap) return;
  const employers = getDistinctEmployers();
  els.jobsEmployerWrap.classList.toggle('is-hidden', employers.length < 2);

  if (els.jobsEmployerValue) {
    els.jobsEmployerValue.textContent = getEmployerFilterLabel();
  }
  els.jobsEmployerTrigger?.classList.toggle(
    'jobs-employer-ms__trigger--active',
    state.employerFilters.size > 0,
  );

  if (state.employerDropdownOpen) renderEmployerList();
}

function renderActiveFilters() {
  if (!els.jobsActiveFilters || !els.jobsActiveFiltersText) return;
  const parts = [];
  if (state.searchQuery.trim()) parts.push(`“${state.searchQuery.trim()}”`);
  for (const id of state.activeChips) {
    const def = CHIP_DEFS.find((c) => c.id === id);
    if (def) parts.push(def.label);
  }
  if (state.employerFilters.size) {
    const names = [...state.employerFilters].sort((a, b) => a.localeCompare(b));
    if (names.length <= 2) parts.push(names.join(', '));
    else parts.push(`${names.length} employers`);
  }

  const active = parts.length > 0;
  els.jobsActiveFilters.classList.toggle('is-hidden', !active);
  if (active) {
    els.jobsActiveFiltersText.textContent = `Showing: ${parts.join(' · ')}`;
  }
}

function bindJobActions(container) {
  container?.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleJob(btn.dataset.id);
    });
  });

  container?.querySelectorAll('[data-action="detail"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openJobDetail(btn.dataset.id);
    });
  });
}

function renderPagination(totalPages) {
  if (!els.jobsPagination) return;
  if (totalPages <= 1) {
    els.jobsPagination.innerHTML = '';
    els.jobsPagination.classList.add('is-hidden');
    return;
  }
  els.jobsPagination.classList.remove('is-hidden');

  const prevDisabled = state.page <= 1;
  const nextDisabled = state.page >= totalPages;

  els.jobsPagination.innerHTML = `
    <button type="button" class="jobs-page-nav" data-nav="prev"${prevDisabled ? ' disabled' : ''}>Previous</button>
    <span class="jobs-page-status">Page ${state.page} of ${totalPages}</span>
    <button type="button" class="jobs-page-nav" data-nav="next"${nextDisabled ? ' disabled' : ''}>Next</button>`;

  els.jobsPagination.querySelector('[data-nav="prev"]')?.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      renderJobsPage();
      scrollToResults();
      onInteraction();
    }
  });

  els.jobsPagination.querySelector('[data-nav="next"]')?.addEventListener('click', () => {
    if (state.page < totalPages) {
      state.page += 1;
      renderJobsPage();
      scrollToResults();
      onInteraction();
    }
  });
}

function scrollToResults() {
  els.jobsGrid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openJobDetail(jobId) {
  const job = getJobById(jobId);
  if (!job || !els.jobsDetailOverlay) return;
  state.detailJobId = jobId;
  const selected = state.selected.has(job.id);
  const description = formatDescriptionText(job.descriptionText || job.summary || '');

  els.jobsDetailOverlay.classList.remove('is-hidden');
  els.jobsDetailOverlay.setAttribute('aria-hidden', 'false');

  if (els.jobsDetailPanel) {
    els.jobsDetailPanel.innerHTML = `
      <div class="jobs-detail__accent" aria-hidden="true"></div>
      <div class="jobs-detail__scroll">
        <div class="jobs-detail__header">
          ${avatarHtml(job.employer, 'lg')}
          <div class="jobs-detail__headings">
            <h2 class="jobs-detail__title" id="jobs-detail-title">${esc(job.title || job.displayTitle)}</h2>
            ${job.employer ? `<p class="jobs-detail__employer">${esc(job.employer)}</p>` : ''}
          </div>
        </div>
        <div class="jobs-detail__dates">
          <p class="jobs-detail__posted">Posted ${formatJobDate(job.pubDate) || '—'}</p>
          <p class="jobs-detail__expires">Expires ${formatJobDate(job.expiresAt) || '—'}</p>
        </div>
        <div class="jobs-detail__meta">
          ${metaRow('Pay range', job.payRange)}
          ${metaRow('Job type', job.jobType)}
          ${metaRow('Location', job.location)}
        </div>
        <div class="jobs-detail__description">${description || '<p class="jobs-detail__empty-desc">No description available.</p>'}</div>
      </div>
      <div class="jobs-detail__footer">
        <button type="button" class="job-card__list-btn${selected ? ' job-card__list-btn--added' : ''}" data-detail-toggle="${esc(job.id)}">
          ${selected ? 'Added to My List' : 'Add to My List'}
        </button>
        <button type="button" class="jobs-detail__back-btn" id="jobs-detail-back">Back to Jobs</button>
      </div>`;

    els.jobsDetailPanel.querySelector('[data-detail-toggle]')?.addEventListener('click', () => {
      toggleJob(job.id);
      openJobDetail(job.id);
    });
    els.jobsDetailPanel.querySelector('#jobs-detail-back')?.addEventListener('click', closeJobDetail);
  }

  els.jobsDetailClose?.focus();
  onInteraction();
}

function closeJobDetail() {
  state.detailJobId = null;
  if (els.jobsDetailOverlay) {
    els.jobsDetailOverlay.classList.add('is-hidden');
    els.jobsDetailOverlay.setAttribute('aria-hidden', 'true');
  }
}

function renderJobsPage() {
  if (!els.jobsGrid) return;

  renderFilterChips();
  renderEmployerFilter();
  renderActiveFilters();

  if (state.detailJobId && !getJobById(state.detailJobId)) {
    closeJobDetail();
  }

  els.jobsGrid.className = `jobs-grid jobs-grid--${state.viewMode}`;

  if (!state.allJobs.length) {
    els.jobsGrid.innerHTML = '';
    if (els.jobsEmpty) {
      els.jobsEmpty.classList.remove('is-hidden');
      els.jobsEmpty.textContent = 'No job opportunities have been added yet. Check back soon or ask a Career Center team member for help.';
    }
    if (els.jobsNoResults) els.jobsNoResults.classList.add('is-hidden');
    if (els.jobsSummary) els.jobsSummary.innerHTML = '<span class="jobs-count">0 jobs found</span>';
    renderPagination(1);
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
      els.jobsNoResults.textContent = hasActiveFilters()
        ? 'No jobs match your filters. Try removing a filter or searching for something else.'
        : 'No jobs match your search. Try another keyword.';
    }
  } else {
    if (els.jobsNoResults) els.jobsNoResults.classList.add('is-hidden');
    const render = state.viewMode === 'list' ? renderJobListRow : renderJobCard;
    els.jobsGrid.innerHTML = pageJobs.map(render).join('');
    bindJobActions(els.jobsGrid);
  }

  if (els.jobsSummary) {
    const filterNote = hasActiveFilters() ? ' (filtered)' : '';
    els.jobsSummary.innerHTML = `<span class="jobs-count">${filtered.length} job${filtered.length === 1 ? '' : 's'} found</span>${filterNote} · Page ${state.page} of ${totalPages}`;
  }

  renderPagination(totalPages);

  if (state.detailJobId) {
    openJobDetail(state.detailJobId);
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
  const app = document.getElementById('app');
  if (els.jobsCartCount) els.jobsCartCount.textContent = count;
  if (els.jobsCartBar) els.jobsCartBar.classList.toggle('is-visible', count > 0);
  app?.classList.toggle('has-jobs-cart', count > 0);

  const plural = document.querySelector('.jobs-cart-plural-s');
  if (plural) plural.textContent = count === 1 ? '' : 's';

  if (!els.jobsCartPanel) return;
  els.jobsCartPanel.classList.toggle('is-open', state.cartOpen && count > 0);

  const selectedJobs = state.allJobs.filter((j) => state.selected.has(j.id));
  if (els.jobsCartList) {
    els.jobsCartList.innerHTML = selectedJobs.length
      ? selectedJobs.map((j) => `
          <div class="jobs-cart-item">
            <div class="jobs-cart-item__info">
              <div class="jobs-cart-item__title">${esc(j.title || j.displayTitle)}</div>
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
  hideEmailMessages();
  if (els.jobsEmailForm) els.jobsEmailForm.reset();
  if (state.selected.size > MAX_EMAIL_JOBS) {
    showEmailError(`You can email up to ${MAX_EMAIL_JOBS} jobs at a time. Remove a few from your list and try again.`);
    if (els.jobsEmailSubmit) els.jobsEmailSubmit.disabled = true;
  } else if (els.jobsEmailSubmit) {
    els.jobsEmailSubmit.disabled = false;
  }
  els.jobsEmailEmail?.focus();
  onInteraction();
}

function closeEmailModal() {
  state.emailModalOpen = false;
  if (els.jobsEmailBackdrop) els.jobsEmailBackdrop.classList.add('is-hidden');
}

/** Clear a student's job list when the kiosk returns home (timeout or manual). */
export function resetJobsSession() {
  state.selected.clear();
  state.cartOpen = false;

  if (state.emailModalOpen) closeEmailModal();
  if (els.jobsEmailForm) {
    els.jobsEmailForm.classList.remove('is-hidden');
    els.jobsEmailForm.reset();
  }
  hideEmailMessages();
  if (els.jobsEmailSubmit) els.jobsEmailSubmit.disabled = false;

  if (state.detailJobId) closeJobDetail();

  document.getElementById('app')?.classList.remove('has-jobs-cart');
  if (els.jobsCartBar) els.jobsCartBar.classList.remove('is-visible');

  if (state.loaded) renderJobsPage();
  else renderCart();
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
  if (state.selected.size > MAX_EMAIL_JOBS) {
    showEmailError(`You can email up to ${MAX_EMAIL_JOBS} jobs at a time. Remove a few from your list and try again.`);
    return;
  }

  const submit = els.jobsEmailSubmit;
  const prev = submit?.textContent;
  if (submit) { submit.disabled = true; submit.textContent = 'Sending…'; }
  hideEmailMessages();

  try {
    await sendJobListEmail({
      studentName: name,
      studentEmail: email,
      jobs: [...state.selected],
    });
    showEmailSuccess('Your job list has been sent. Check your email for the Handshake links.');
    if (els.jobsEmailForm) els.jobsEmailForm.classList.add('is-hidden');
    state.selected.clear();
    setTimeout(() => {
      closeEmailModal();
      if (els.jobsEmailForm) els.jobsEmailForm.classList.remove('is-hidden');
      hideEmailMessages();
      renderJobsPage();
    }, 2200);
  } catch (err) {
    const code = err?.code || err?.message || '';
    if (code === 'EMAIL_API_UNAVAILABLE') {
      showEmailError('Email is not available on this kiosk right now. Please ask a Career Center team member for help.');
    } else if (code && code !== 'EMAIL_SEND_FAILED') {
      showEmailError(err.message);
    } else {
      showEmailError('We couldn\u2019t send your job list right now. Please try again or ask a Career Center team member for help.');
    }
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = prev; }
  }
}

function hideEmailMessages() {
  if (els.jobsEmailError) {
    els.jobsEmailError.textContent = '';
    els.jobsEmailError.classList.add('is-hidden');
  }
  if (els.jobsEmailSuccess) {
    els.jobsEmailSuccess.textContent = '';
    els.jobsEmailSuccess.classList.add('is-hidden');
  }
}

function showEmailError(msg) {
  if (!els.jobsEmailError) return;
  if (els.jobsEmailSuccess) {
    els.jobsEmailSuccess.textContent = '';
    els.jobsEmailSuccess.classList.add('is-hidden');
  }
  els.jobsEmailError.textContent = msg;
  els.jobsEmailError.classList.remove('is-hidden');
}

function showEmailSuccess(msg) {
  if (!els.jobsEmailSuccess) return;
  if (els.jobsEmailError) {
    els.jobsEmailError.textContent = '';
    els.jobsEmailError.classList.add('is-hidden');
  }
  els.jobsEmailSuccess.textContent = msg;
  els.jobsEmailSuccess.classList.remove('is-hidden');
}

export function getJobsPageElements() {
  return {
    jobsSearchForm: document.getElementById('jobs-search-form'),
    jobsSearchInput: document.getElementById('jobs-search-input'),
    jobsFilterChips: document.getElementById('jobs-filter-chips'),
    jobsEmployerWrap: document.getElementById('jobs-employer-wrap'),
    jobsEmployerMs: document.getElementById('jobs-employer-ms'),
    jobsEmployerTrigger: document.getElementById('jobs-employer-trigger'),
    jobsEmployerValue: document.getElementById('jobs-employer-value'),
    jobsEmployerPanel: document.getElementById('jobs-employer-panel'),
    jobsEmployerSearch: document.getElementById('jobs-employer-search'),
    jobsEmployerSelectAll: document.getElementById('jobs-employer-select-all'),
    jobsEmployerClearSel: document.getElementById('jobs-employer-clear-sel'),
    jobsEmployerList: document.getElementById('jobs-employer-list'),
    jobsEmployerEmpty: document.getElementById('jobs-employer-empty'),
    jobsActiveFilters: document.getElementById('jobs-active-filters'),
    jobsActiveFiltersText: document.getElementById('jobs-active-filters-text'),
    jobsClearFilters: document.getElementById('jobs-clear-filters'),
    jobsViewList: document.getElementById('jobs-view-list'),
    jobsViewGrid: document.getElementById('jobs-view-grid'),
    jobsSortSelect: document.getElementById('jobs-sort-select'),
    jobsSummary: document.getElementById('jobs-summary'),
    jobsGrid: document.getElementById('jobs-grid'),
    jobsEmpty: document.getElementById('jobs-empty'),
    jobsNoResults: document.getElementById('jobs-no-results'),
    jobsPagination: document.getElementById('jobs-pagination'),
    jobsDetailOverlay: document.getElementById('jobs-detail-overlay'),
    jobsDetailPanel: document.getElementById('jobs-detail-panel'),
    jobsDetailClose: document.getElementById('jobs-detail-close'),
    jobsDetailBackdrop: document.getElementById('jobs-detail-overlay'),
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
