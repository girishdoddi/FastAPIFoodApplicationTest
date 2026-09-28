const authForm = document.querySelector('#auth-form');
const message = document.querySelector('#auth-message');
const roleButtons = [...document.querySelectorAll('[data-role]')];
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const state = {
  role: 'user',
  mode: 'login',
  token: sessionStorage.getItem('food-token') || '',
  userId: sessionStorage.getItem('food-user-id') || '',
  roleName: sessionStorage.getItem('food-role') || '',
  restaurantName: sessionStorage.getItem('food-restaurant-name') || '',
};

const byId = (id) => document.getElementById(id);

function setMessage(element, text, kind = '') {
  element.textContent = text;
  element.className = `message ${kind}`.trim();
}

async function request(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(url, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.detail;
    const text = typeof detail === 'string'
      ? detail
      : detail?.status || detail?.[0]?.msg || payload.status || payload.message || `Request failed (${response.status})`;
    throw new Error(text);
  }
  return payload;
}

function setVisible(id, visible) {
  byId(id).hidden = !visible;
}

function updateAuthForm() {
  const signup = state.mode === 'signup';
  const restaurant = state.role === 'restaurant';
  byId('auth-heading').textContent = signup ? 'Join the table' : 'Welcome back';
  byId('identity-label').textContent = restaurant ? 'Restaurant mobile number' : 'User ID';
  byId('identity').placeholder = restaurant ? '10-digit mobile number' : 'Your user ID';
  byId('identity').autocomplete = restaurant ? 'tel' : 'username';
  byId('identity').inputMode = restaurant ? 'numeric' : 'text';
  if (restaurant) {
    byId('identity').pattern = '[6-9][0-9]{9}';
  } else {
    byId('identity').removeAttribute('pattern');
  }
  byId('identity').maxLength = restaurant ? 10 : 30;
  byId('identity-hint').textContent = restaurant ? 'Use the mobile number registered to your restaurant' : 'The ID you used when signing up';
  byId('name').previousElementSibling.textContent = restaurant ? 'Restaurant name' : 'Your name';
  byId('name').placeholder = restaurant ? 'e.g. Green Leaf Kitchen' : 'e.g. Asha Rao';
  byId('name').minLength = restaurant ? 1 : 3;
  byId('name').maxLength = restaurant ? 30 : 20;
  byId('password').autocomplete = signup ? 'new-password' : 'current-password';
  byId('submit-label').textContent = signup ? 'Create account' : 'Log in';
  setVisible('name-field', signup);
  setVisible('phone-field', signup && !restaurant);
  setVisible('dob-field', signup && !restaurant);
  setVisible('gender-field', signup && !restaurant);
  setVisible('pincode-field', signup);
  setVisible('city-field', signup && restaurant);
  setVisible('address-field', signup && restaurant);
  byId('name').required = signup;
  byId('phone').required = signup && !restaurant;
  byId('dob').required = signup && !restaurant;
  byId('gender').required = signup && !restaurant;
  byId('pincode').required = signup;
  byId('city').required = signup && restaurant;
  byId('address').required = signup && restaurant;
  byId('password-note').textContent = signup ? 'At least 8 characters recommended' : 'Keep it private';
  byId('password').minLength = signup ? 8 : 1;
  setMessage(message, '');
}

function updateSessionView() {
  const signedIn = Boolean(state.token);
  byId('auth-panel').hidden = signedIn;
  document.querySelector('.workspace').classList.toggle('is-authenticated', signedIn);
  setVisible('signed-out-view', !signedIn);
  setVisible('user-view', signedIn && state.roleName === 'user');
  setVisible('restaurant-view', signedIn && state.roleName === 'restaurant');
  setVisible('signed-in-bar', signedIn);
  byId('session-label').textContent = state.roleName === 'restaurant'
    ? `${state.restaurantName || 'Restaurant'} · ${state.userId}`
    : `User · ${state.userId}`;
  byId('results-eyebrow').textContent = signedIn ? (state.roleName === 'restaurant' ? 'RESTAURANT DASHBOARD' : 'YOUR LOCAL PICKS') : 'A GOOD PLACE TO BEGIN';
  byId('results-title').textContent = signedIn
    ? (state.roleName === 'restaurant' ? state.restaurantName || 'Your place, your menu.' : 'Find your next favorite.')
    : "What's on the menu?";
  byId('results-index').innerHTML = signedIn ? 'YOUR SPACE <b>·</b> 02' : 'DISCOVER <b>·</b> 01';
  roleButtons.forEach((button) => button.disabled = signedIn);
  modeButtons.forEach((button) => button.disabled = signedIn);
}

function enterSession(data) {
  state.token = data.access_token;
  state.userId = data.user_id;
  state.roleName = state.role;
  state.restaurantName = state.roleName === 'restaurant' ? data.restaurent_name || '' : '';
  sessionStorage.setItem('food-token', state.token);
  sessionStorage.setItem('food-user-id', state.userId);
  sessionStorage.setItem('food-role', state.roleName);
  if (state.restaurantName) sessionStorage.setItem('food-restaurant-name', state.restaurantName);
  else sessionStorage.removeItem('food-restaurant-name');
  updateSessionView();
  if (state.roleName === 'restaurant') loadOwnerMenu();
}

function renderRestaurants(restaurants) {
  const list = byId('restaurant-list');
  byId('menu-area').hidden = true;
  list.replaceChildren();
  if (!restaurants.length) {
    setMessage(byId('search-message'), 'No restaurants found for that pincode.');
    return;
  }
  setMessage(byId('search-message'), `${restaurants.length} restaurant${restaurants.length === 1 ? '' : 's'} found. Select one to view its menu.`, 'success');
  restaurants.forEach((restaurant) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'restaurant-card';
    const details = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = restaurant.restaurent_name;
    const phone = document.createElement('small');
    phone.textContent = restaurant.restaurent_phone;
    details.append(name, phone);
    const arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    button.append(details, arrow);
    button.addEventListener('click', () => loadMenu(restaurant));
    list.append(button);
  });
}

async function loadMenu(restaurant) {
  const area = byId('menu-area');
  area.hidden = false;
  area.replaceChildren();
  const title = document.createElement('div');
  title.className = 'menu-heading';
  const heading = document.createElement('h3');
  heading.textContent = restaurant.restaurent_name;
  const phone = document.createElement('span');
  phone.textContent = restaurant.restaurent_phone;
  title.append(heading, phone);
  area.append(title);
  const list = document.createElement('div');
  list.className = 'menu-list';
  list.textContent = 'Loading menu…';
  area.append(list);
  try {
    const menu = await request(`/restaurent/menu/${encodeURIComponent(restaurant.restaurent_phone)}`);
    list.replaceChildren();
    if (!menu.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-menu';
      empty.textContent = 'This restaurant has not added menu items yet.';
      list.append(empty);
      return;
    }
    menu.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'menu-item';
      const itemName = document.createElement('span');
      itemName.textContent = item.item_name;
      const price = document.createElement('span');
      price.textContent = `₹${item.item_price}`;
      row.append(itemName, price);
      list.append(row);
    });
  } catch (error) {
    list.textContent = error.message;
    list.className = 'menu-list message error';
  }
}

roleButtons.forEach((button) => button.addEventListener('click', () => {
  state.role = button.dataset.role;
  roleButtons.forEach((entry) => entry.classList.toggle('active', entry === button));
  updateAuthForm();
}));

modeButtons.forEach((button) => button.addEventListener('click', () => {
  state.mode = button.dataset.mode;
  modeButtons.forEach((entry) => {
    const active = entry === button;
    entry.classList.toggle('active', active);
    entry.setAttribute('aria-selected', String(active));
  });
  updateAuthForm();
}));

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = authForm.querySelector('.submit-button');
  submit.disabled = true;
  setMessage(message, state.mode === 'login' ? 'Signing in…' : 'Creating your account…');
  const restaurant = state.role === 'restaurant';
  const loginPayload = { user_id: byId('identity').value.trim(), user_password: byId('password').value };
  try {
    if (state.mode === 'signup') {
      const body = restaurant ? {
        restaurent_name: byId('name').value.trim(),
        restaurent_phone: byId('identity').value.trim(),
        password: byId('password').value,
        pincode: byId('pincode').value.trim(),
        city: byId('city').value.trim(),
        address: byId('address').value.trim(),
      } : {
        user_id: byId('identity').value.trim(),
        phone_num: byId('phone').value.trim(),
        password: byId('password').value,
        user_name: byId('name').value.trim(),
        dob: byId('dob').value,
        gender: byId('gender').value,
        pincode: byId('pincode').value.trim(),
      };
      await request(restaurant ? '/restaurent/signup' : '/user/register', { method: 'POST', body: JSON.stringify(body) });
      state.mode = 'login';
      modeButtons.forEach((entry) => {
        const active = entry.dataset.mode === 'login';
        entry.classList.toggle('active', active);
        entry.setAttribute('aria-selected', String(active));
      });
      updateAuthForm();
      setMessage(message, 'Account created. You can log in now.', 'success');
    } else {
      const data = await request(restaurant ? '/restaurent/login' : '/user/login', { method: 'POST', body: JSON.stringify(loginPayload) });
      enterSession(data);
      setMessage(message, 'Signed in successfully.', 'success');
    }
  } catch (error) {
    setMessage(message, error.message, 'error');
  } finally {
    submit.disabled = false;
  }
});

async function loadRestaurants(pincode) {
  setMessage(byId('search-message'), 'Looking around your area…');
  try {
    const result = await request('/user/restaurents_by_pincode', {
      method: 'POST',
      body: JSON.stringify({ pincode }),
    });
    renderRestaurants(Array.isArray(result) ? result : result.restaurents || []);
  } catch (error) {
    setMessage(byId('search-message'), error.message, 'error');
  }
}

function renderOwnerMenu(items) {
  const list = byId('owner-menu-list');
  list.replaceChildren();
  byId('owner-menu-count').textContent = `${items.length} ITEM${items.length === 1 ? '' : 'S'}`;
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-menu';
    empty.textContent = 'Your menu is empty. Add an item above to get started.';
    list.append(empty);
    setMessage(byId('owner-menu-message'), '');
    return;
  }
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'menu-item';
    const name = document.createElement('span');
    name.textContent = item.item_name;
    const price = document.createElement('span');
    price.textContent = `₹${item.item_price}`;
    row.append(name, price);
    list.append(row);
  });
  setMessage(byId('owner-menu-message'), '');
}

async function loadOwnerMenu() {
  setMessage(byId('owner-menu-message'), 'Loading your menu…');
  try {
    const items = await request('/restaurent/me/');
    renderOwnerMenu(Array.isArray(items) ? items : []);
  } catch (error) {
    setMessage(byId('owner-menu-message'), error.message, 'error');
  }
}

byId('reload-owner-menu').addEventListener('click', loadOwnerMenu);

byId('restaurant-search').addEventListener('submit', (event) => {
  event.preventDefault();
  loadRestaurants(byId('search-pincode').value.trim());
});

byId('item-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const itemButton = byId('item-form').querySelector('.submit-button');
  itemButton.disabled = true;
  setMessage(byId('item-message'), 'Adding item…');
  try {
    await request('/restaurent/add_item', { method: 'POST', body: JSON.stringify({ item_name: byId('item-name').value.trim(), price: Number(byId('item-price').value) }) });
    setMessage(byId('item-message'), 'Menu item added.', 'success');
    byId('item-form').reset();
    await loadOwnerMenu();
  } catch (error) {
    setMessage(byId('item-message'), error.message, 'error');
  } finally {
    itemButton.disabled = false;
  }
});

byId('logout-button').addEventListener('click', () => {
  state.token = '';
  state.userId = '';
  state.roleName = '';
  state.restaurantName = '';
  sessionStorage.removeItem('food-token');
  sessionStorage.removeItem('food-user-id');
  sessionStorage.removeItem('food-role');
  sessionStorage.removeItem('food-restaurant-name');
  byId('auth-form').reset();
  byId('restaurant-list').replaceChildren();
  byId('menu-area').hidden = true;
  updateSessionView();
  updateAuthForm();
});

const themeToggle = byId('theme-toggle');
const storedTheme = localStorage.getItem('food-theme') || 'light';
document.documentElement.dataset.theme = storedTheme;
function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  byId('theme-icon').textContent = dark ? '☀' : '☾';
  byId('theme-label').textContent = dark ? 'Light' : 'Dark';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#1e2520' : '#f6f4ed';
}
themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('food-theme', theme);
  updateThemeButton();
});

if (state.roleName === 'restaurant' || state.roleName === 'user') state.role = state.roleName;
roleButtons.forEach((entry) => entry.classList.toggle('active', entry.dataset.role === state.role));
updateAuthForm();
updateSessionView();
if (state.token && state.roleName === 'restaurant') loadOwnerMenu();
updateThemeButton();