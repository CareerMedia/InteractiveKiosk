// ─────────────────────────────────────────────────────────────────────────────
// Job Opportunities kiosk page
// ─────────────────────────────────────────────────────────────────────────────

import { loadJobs, sendJobListEmail } from './shared/jobs-loader.js';
import { formatJobDate, getEmployerInitials, jobCardExcerpt, truncateWords } from './shared/jobs-parser.js';

const PAGE_SIZE = 40;

const state = {
  allJobs: [],
  meta: {},
  loaded: false,
  loading: false,
  searchQuery: '',
  activeSearch: '',
  sort: 'newest',
  page: 1,
  selected: new Set(),
  cartOpen: false,
  emailModalOpen: false,
  detailJobId: null,
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

  els.jobsDetailClose?.addEventListener('click', closeJobDetail);
  els.jobsDetailBackdrop?.addEventListener('click', (e) => {
    if (e.target === els.jobsDetailBackdrop) closeJobDetail();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (state.emailModalOpen) closeEmailModal();
    else if (state.detailJobId) closeJobDetail();
  });
}

function matchesSearch(job, q) {
  if (!q) return true;
  const hay = [
    job.title, job.displayTitle, job.employer, job.descriptionText, job.summary,
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
  return sortJobs(state.allJobs.filter((j) => matchesSearch(j, state.activeSearch)));
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
  els.jobsGrid.innerHTML = Array.from({ length: 8 }, () =>
    '<div class="job-card job-card--skeleton" aria-hidden="true"><div class="job-card__skel-bar"></div><div class="job-card__skel-line job-card__skel-line--lg"></div><div class="job-card__skel-line"></div><div class="job-card__skel-line job-card__skel-line--sm"></div><div class="job-card__skel-block"></div></div>',
  ).join('');
  if (els.jobsSummary) els.jobsSummary.textContent = 'Loading jobs…';
}

function cardMetaHtml(job) {
  const fields = [
    ['Pay range', job.payRange],
    ['Schedule', job.schedule],
    ['Job type', job.jobType],
    ['Location', job.location],
  ].filter(([, value]) => String(value || '').trim());

  if (!fields.length) return '';

  return `<div class="job-card__meta">${fields.map(([label, value]) => `
    <div class="job-card__meta-item">
      <span class="job-card__meta-label">${esc(label)}</span>
      <span class="job-card__meta-value">${esc(truncateWords(value, 20))}</span>
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
  return `<div class="jobs-detail__meta-row"><span class="jobs-detail__meta-label">${esc(label)}</span><span class="jobs-detail__meta-value">${esc(value)}</span></div>`;
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

  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) {
    const near = Math.abs(i - state.page) <= 1;
    const edge = i === 1 || i === totalPages;
    if (near || edge || totalPages <= 7) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  const pageButtons = pages.map((p) => {
    if (p === '…') return '<span class="jobs-page-ellipsis" aria-hidden="true">…</span>';
    const active = p === state.page;
    return `<button type="button" class="jobs-page-btn${active ? ' jobs-page-btn--active' : ''}" data-page="${p}"${active ? ' aria-current="page"' : ''}>${p}</button>`;
  }).join('');

  els.jobsPagination.innerHTML = `
    <button type="button" class="jobs-page-nav" data-nav="prev"${prevDisabled ? ' disabled' : ''}>Previous</button>
    <div class="jobs-page-numbers" role="navigation" aria-label="Job pages">${pageButtons}</div>
    <button type="button" class="jobs-page-nav" data-nav="next"${nextDisabled ? ' disabled' : ''}>Next</button>`;

  els.jobsPagination.querySelector('[data-nav="prev"]')?.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      renderJobsPage();
      els.jobsGrid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onInteraction();
    }
  });

  els.jobsPagination.querySelector('[data-nav="next"]')?.addEventListener('click', () => {
    if (state.page < totalPages) {
      state.page += 1;
      renderJobsPage();
      els.jobsGrid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onInteraction();
    }
  });

  els.jobsPagination.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.page = Number(btn.dataset.page);
      renderJobsPage();
      els.jobsGrid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onInteraction();
    });
  });
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
          ${metaRow('Schedule', job.schedule)}
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

  if (state.detailJobId && !getJobById(state.detailJobId)) {
    closeJobDetail();
  }

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
      els.jobsNoResults.textContent = 'No jobs match your search. Try another keyword.';
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

    els.jobsGrid.querySelectorAll('[data-action="detail"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openJobDetail(btn.dataset.id);
      });
    });
  }

  if (els.jobsSummary) {
    els.jobsSummary.innerHTML = `<span class="jobs-count">${filtered.length} job${filtered.length === 1 ? '' : 's'} found</span> · Page ${state.page} of ${totalPages}`;
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
      els.jobsEmailSuccess.textContent = 'Your job list has been sent. Check your email for the Handshake links.';
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
