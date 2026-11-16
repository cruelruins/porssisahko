'use strict';

const API_URL =
  'https://proxy.cors.dev/https://api.porssisahko.net/v2/latest-prices.json';
const CACHE_KEY = 'porssivirta.prices.v1';
const CACHE_MAX_AGE_MS = 60 * 1000;
const AUTO_REFRESH_MS = 5 * 60 * 1000;
const QUARTER_MS = 15 * 60 * 1000;
const TIME_ZONE = 'Europe/Helsinki';

const state = {
  prices: [],
  rangeHours: 24,
  lastUpdated: null,
  lastFetchAttempt: null,
  toastTimer: null,
};

const el = (id) => document.getElementById(id);

const dateTimeFormatter = new Intl.DateTimeFormat('fi-FI', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});
const dateFormatter = new Intl.DateTimeFormat('fi-FI', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
});
const fullDateTimeFormatter = new Intl.DateTimeFormat('fi-FI', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatPrice(value, digits = 2) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toLocaleString('fi-FI', {
    minimumFractionDigits: digits,
    maximumFractionDigits: Math.max(digits, 3),
  })} snt`;
}

function formatClock(date) {
  return dateTimeFormatter.format(date);
}

function formatDate(date) {
  return dateFormatter.format(date);
}

function getTimeRangeText(start, end) {
  return `${formatClock(start)}–${formatClock(end)}`;
}

function parsePrices(payload) {
  if (!payload || !Array.isArray(payload.prices)) {
    throw new Error('Rajapinnan vastaus ei sisältänyt hintalistaa.');
  }
  const parsed = payload.prices
    .map((item) => ({
      price: Number(item.price),
      start: new Date(item.startDate),
      end: new Date(item.endDate),
    }))
    .filter((item) => item.price !== null
      && item.price !== undefined
      && item.price !== ''
      && Number.isFinite(item.price)
      && !Number.isNaN(item.start.getTime())
      && !Number.isNaN(item.end.getTime()))
    .sort((a, b) => a.start - b.start);

  if (!parsed.length) throw new Error('Rajapinta ei palauttanut käyttökelpoisia hintoja.');
  return parsed;
}

function loadCachedPrices() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!cached || !Array.isArray(cached.prices)) return null;
    return {
      updatedAt: Number(cached.updatedAt) || 0,
      prices: parsePrices({ prices: cached.prices }),
    };
  } catch {
    return null;
  }
}

function saveCachedPrices(prices, updatedAt) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      updatedAt,
      prices: prices.map((item) => ({
        price: item.price,
        startDate: item.start.toISOString(),
        endDate: item.end.toISOString(),
      })),
    }));
  } catch {
    // Private browsing or a full storage quota should not prevent price display.
  }
}

async function fetchPrices(force = false) {
  const now = Date.now();
  if (state.lastFetchAttempt && now - state.lastFetchAttempt < CACHE_MAX_AGE_MS) {
    if (force) showToast('Hintatiedot voi hakea uudelleen minuutin kuluttua.');
    return;
  }
  if (!force && state.lastUpdated && now - state.lastUpdated < CACHE_MAX_AGE_MS) {
    return;
  }
  state.lastFetchAttempt = now;

  document.body.classList.add('is-loading');
  setConnectionStatus('Haetaan tuoreita hintoja…');

  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      if (response.status === 429) throw new Error('Hintapalvelun pyyntöraja täyttyi. Yritä hetken kuluttua uudelleen.');
      throw new Error(`Hintapalvelu vastasi virhekoodilla ${response.status}.`);
    }
    const payload = await response.json();
    const prices = parsePrices(payload);
    state.prices = prices;
    state.lastUpdated = Date.now();
    saveCachedPrices(prices, state.lastUpdated);
    render();
    setConnectionStatus('Hintatiedot ajan tasalla');
    el('updated-at').textContent = formatClock(new Date(state.lastUpdated));
  } catch (error) {
    console.error('Hintojen haku epäonnistui:', error);
    if (!state.prices.length) {
      const cached = loadCachedPrices();
      if (cached) {
        state.prices = cached.prices;
        state.lastUpdated = cached.updatedAt;
        render();
        el('updated-at').textContent = `${formatClock(new Date(cached.updatedAt))} · välimuisti`;
      }
    }
    setConnectionStatus(state.prices.length ? 'Näytetään viimeksi haetut hinnat' : 'Hintatietoja ei saatu haettua');
    showToast(error.message || 'Hintatietojen haku epäonnistui.');
    if (!state.prices.length) showEmptyState();
  } finally {
    document.body.classList.remove('is-loading');
  }
}

function setConnectionStatus(message) {
  el('connection-status').textContent = message;
}

function showToast(message) {
  const toast = el('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 4200);
}

function showEmptyState() {
  el('price-chart').innerHTML = '<div class="chart-placeholder">Hintatietoja ei juuri nyt ole saatavilla.</div>';
  el('current-price').textContent = '—';
  el('current-period').textContent = 'Tarkista verkkoyhteys ja yritä uudelleen.';
  el('min-price').textContent = '—';
  el('average-price').textContent = '—';
  el('max-price').textContent = '—';
  el('cheapest-list').textContent = 'Hintatietoja ei saatavilla.';
}

function getUpcomingPrices() {
  const now = new Date();
  return state.prices.filter((item) => item.end.getTime() > now.getTime());
}

function getCurrentPrice() {
  const now = new Date();
  return state.prices.find((item) => item.start <= now && item.end > now) || null;
}

function calculateBestWindow(prices, quarterCount = 16) {
  if (prices.length < quarterCount) return null;
  let best = null;
  for (let i = 0; i <= prices.length - quarterCount; i += 1) {
    const window = prices.slice(i, i + quarterCount);
    const isContinuous = window.every((item, index) => index === 0
      || Math.abs(item.start.getTime() - window[index - 1].end.getTime() - 1) < 1000
      || Math.abs(item.start.getTime() - window[index - 1].start.getTime() - QUARTER_MS) < 1000);
    if (!isContinuous) continue;
    const average = window.reduce((sum, item) => sum + item.price, 0) / window.length;
    if (!best || average < best.average) {
      best = { start: window[0].start, end: window[window.length - 1].end, average };
    }
  }
  return best;
}

function render() {
  const upcoming = getUpcomingPrices();
  const current = getCurrentPrice();
  const now = new Date();
  const next24 = upcoming.filter((item) => item.start.getTime() < now.getTime() + 24 * 60 * 60 * 1000);

  if (current) {
    el('current-price').textContent = formatPrice(current.price, 2).replace(/\s*snt$/, '');
    el('current-period').textContent = `Voimassa ${getTimeRangeText(current.start, current.end)}`;
    const next = state.prices.find((item) => item.start.getTime() === current.end.getTime() + 1);
    if (next) {
      const difference = next.price - current.price;
      const prefix = difference > 0 ? '+' : '';
      el('current-comparison').textContent = `Seuraava vartti: ${prefix}${difference.toLocaleString('fi-FI', { maximumFractionDigits: 2 })} snt/kWh`;
    } else {
      el('current-comparison').textContent = 'Hinta vaihtuu 15 minuutin välein';
    }
  } else if (upcoming.length) {
    el('current-price').textContent = '—';
    el('current-period').textContent = 'Tämän hetken hintaa ei löytynyt rajapinnan tiedoista.';
    el('current-comparison').textContent = 'Tulevat hintatiedot näkyvät alla.';
  }

  if (next24.length) {
    const cheapest = next24.reduce((a, b) => (a.price <= b.price ? a : b));
    const mostExpensive = next24.reduce((a, b) => (a.price >= b.price ? a : b));
    const average = next24.reduce((sum, item) => sum + item.price, 0) / next24.length;
    el('min-price').textContent = formatPrice(cheapest.price);
    el('min-time').textContent = `${formatDate(cheapest.start)} · ${getTimeRangeText(cheapest.start, cheapest.end)}`;
    el('average-price').textContent = formatPrice(average);
    el('max-price').textContent = formatPrice(mostExpensive.price);
    el('max-time').textContent = `${formatDate(mostExpensive.start)} · ${getTimeRangeText(mostExpensive.start, mostExpensive.end)}`;
  }

  const best = calculateBestWindow(upcoming);
  if (best) {
    el('best-window').textContent = getTimeRangeText(best.start, best.end);
    el('best-window-price').textContent = formatPrice(best.average);
  } else {
    el('best-window').textContent = 'Ei riittävästi tietoja';
    el('best-window-price').textContent = '—';
  }

  renderCheapestList(upcoming);
  renderChart(upcoming);
  el('footer-date').textContent = `Päivitetty ${fullDateTimeFormatter.format(new Date(state.lastUpdated || Date.now()))} · ajat Suomen aikaa`;
}

function renderCheapestList(upcoming) {
  const items = [...upcoming].sort((a, b) => a.price - b.price).slice(0, 5);
  const container = el('cheapest-list');
  container.replaceChildren();
  if (!items.length) {
    container.textContent = 'Tulevia hintoja ei saatavilla.';
    return;
  }
  items.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'cheap-row';
    const time = document.createElement('div');
    time.className = 'cheap-time';
    const date = document.createElement('span');
    date.className = 'cheap-date';
    date.textContent = formatDate(item.start);
    time.append(`${getTimeRangeText(item.start, item.end)} `, date);
    const value = document.createElement('strong');
    value.className = 'cheap-value';
    value.textContent = formatPrice(item.price);
    const rank = document.createElement('span');
    rank.className = 'cheap-rank';
    rank.textContent = String(index + 1);
    row.append(time, value, rank);
    container.append(row);
  });
}

function getBarClass(price, average, min, max) {
  if (price < 0) return 'negative';
  const span = Math.max(max - min, 0.001);
  const relative = (price - min) / span;
  if (relative < 0.34 || price < average * 0.8) return 'cheap';
  if (relative > 0.72 || price > average * 1.25) return 'expensive';
  return 'normal';
}

function renderChart(upcoming) {
  const hours = state.rangeHours;
  const now = Date.now();
  const endTime = now + hours * 60 * 60 * 1000;
  const data = upcoming.filter((item) => item.start.getTime() < endTime);
  const chart = el('price-chart');
  chart.replaceChildren();
  if (!data.length) {
    chart.textContent = 'Kaaviolle ei ole hintatietoja.';
    return;
  }

  const values = data.map((item) => item.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const scaleMin = Math.min(0, min);
  const scaleMax = max === scaleMin ? scaleMin + 1 : max;
  const range = scaleMax - scaleMin;
  const current = getCurrentPrice();

  data.forEach((item) => {
    const bar = document.createElement('div');
    const height = Math.max(2, ((item.price - scaleMin) / range) * 100);
    bar.className = `chart-bar ${getBarClass(item.price, average, min, max)}`;
    if (current && item.start.getTime() === current.start.getTime()) bar.classList.add('current');
    bar.style.height = `${height}%`;
    bar.title = `${formatDate(item.start)} ${getTimeRangeText(item.start, item.end)} · ${formatPrice(item.price)}/kWh`;
    bar.setAttribute('aria-hidden', 'true');
    chart.append(bar);
  });

  el('y-top').textContent = formatPrice(max, 1);
  el('y-mid').textContent = formatPrice((max + scaleMin) / 2, 1);
  el('y-bottom').textContent = formatPrice(scaleMin, 1);
  el('chart-start').textContent = formatClock(data[0].start);
  el('chart-mid').textContent = formatClock(new Date(data[0].start.getTime() + (hours / 2) * 60 * 60 * 1000));
  el('chart-end').textContent = formatClock(data[data.length - 1].end);
  el('chart-note').textContent = `${data.length} varttihintaa · min ${formatPrice(min)} · max ${formatPrice(max)} · hinnat sisältävät ALV:n.`;
}

function setupControls() {
  document.querySelectorAll('.range-button').forEach((button) => {
    button.addEventListener('click', () => {
      state.rangeHours = Number(button.dataset.range) === 48 ? 48 : 24;
      document.querySelectorAll('.range-button').forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      renderChart(getUpcomingPrices());
    });
  });

  el('refresh-button').addEventListener('click', () => fetchPrices(true));
}

async function init() {
  setupControls();
  const cached = loadCachedPrices();
  if (cached) {
    state.prices = cached.prices;
    state.lastUpdated = cached.updatedAt;
    render();
    el('updated-at').textContent = `${formatClock(new Date(cached.updatedAt))} · välimuisti`;
    setConnectionStatus('Näytetään tallennettuja hintatietoja');
  }
  await fetchPrices(!cached || Date.now() - cached.updatedAt >= CACHE_MAX_AGE_MS);
  window.setInterval(() => fetchPrices(false), AUTO_REFRESH_MS);
}

document.addEventListener('DOMContentLoaded', init);
