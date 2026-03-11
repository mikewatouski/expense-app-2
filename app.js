const app = document.getElementById("app");

let expenseDraft = null;

function getUsers() {
  return JSON.parse(localStorage.getItem("users") || "[]");
}

function setUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

function getCurrentUser() {
  return localStorage.getItem("currentUser");
}

function setCurrentUser(username) {
  localStorage.setItem("currentUser", username);
}

function clearCurrentUser() {
  localStorage.removeItem("currentUser");
}

function getUserKey(key) {
  return `${getCurrentUser()}__${key}`;
}

function getData(key, fallback) {
  const raw = localStorage.getItem(getUserKey(key));
  return raw ? JSON.parse(raw) : fallback;
}

function setData(key, value) {
  localStorage.setItem(getUserKey(key), JSON.stringify(value));
}

function nowLocalInputValue() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  const d = new Date(value);
  return d.toLocaleString("es-AR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatMoney(value) {
  const n = Number(value || 0);
  return `$${n.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function showScreen(html) {
  app.innerHTML = `<div class="screen">${html}</div>`;
}

function initUserData(username) {
  const categoriesKey = `${username}__categories`;
  const expensesKey = `${username}__expenses`;
  const friendsKey = `${username}__friends`;

  if (!localStorage.getItem(categoriesKey)) {
    localStorage.setItem(
      categoriesKey,
      JSON.stringify(["Comida", "Transporte", "Salidas", "Compras", "Otros"])
    );
  }

  if (!localStorage.getItem(expensesKey)) {
    localStorage.setItem(expensesKey, JSON.stringify([]));
  }

  if (!localStorage.getItem(friendsKey)) {
    localStorage.setItem(friendsKey, JSON.stringify([]));
  }
}

/* =========================
   AUTH
========================= */

function renderAuthChoice() {
  showScreen(`
    <div class="brand">Mis Gastos</div>
    <h1>Controlá lo que gastás sin volverte loco</h1>
    <div class="subtitle">
      Registrá gastos, mirá resúmenes semanales y mensuales, separá por categorías y llevá control de quién te debe plata.
    </div>

    <div class="vertical-actions">
      <button class="btn btn-primary" onclick="renderLogin()">Iniciar sesión</button>
      <button class="btn btn-secondary" onclick="renderRegister()">Registrarse</button>
    </div>
  `);
}

function renderLogin() {
  showScreen(`
    <div class="topbar">
      <div>
        <div class="brand">Mis Gastos</div>
        <h2>Iniciar sesión</h2>
      </div>
      <span class="pill">Acceso</span>
    </div>

    <div class="section">
      <label>Nombre de usuario</label>
      <input class="input" id="login-username" placeholder="Tu usuario" />

      <label>Contraseña</label>
      <input class="input" id="login-password" type="password" placeholder="Tu contraseña" />

      <button class="btn btn-primary" onclick="handleLogin()">Entrar</button>
      <div id="login-error" class="error"></div>
    </div>

    <div class="helper">
      ¿No tenés cuenta? <span class="small-link" onclick="renderRegister()">Registrate</span>
    </div>
    <div class="helper">
      <span class="small-link" onclick="renderAuthChoice()">Volver</span>
    </div>
  `);
}

function renderRegister() {
  showScreen(`
    <div class="topbar">
      <div>
        <div class="brand">Mis Gastos</div>
        <h2>Crear cuenta</h2>
      </div>
      <span class="pill">Registro</span>
    </div>

    <div class="section">
      <label>Nombre de usuario</label>
      <input class="input" id="register-username" placeholder="Elegí tu usuario" />

      <label>Contraseña</label>
      <input class="input" id="register-password" type="password" placeholder="Elegí tu contraseña" />

      <button class="btn btn-primary" onclick="handleRegister()">Registrarse</button>
      <div id="register-error" class="error"></div>
    </div>

    <div class="helper">
      ¿Ya tenés cuenta? <span class="small-link" onclick="renderLogin()">Iniciá sesión</span>
    </div>
    <div class="helper">
      <span class="small-link" onclick="renderAuthChoice()">Volver</span>
    </div>
  `);
}

function handleRegister() {
  const username = document.getElementById("register-username").value.trim();
  const password = document.getElementById("register-password").value.trim();
  const error = document.getElementById("register-error");

  error.textContent = "";

  if (!username || !password) {
    error.textContent = "Completá usuario y contraseña.";
    return;
  }

  const users = getUsers();

  const sameUsername = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );
  if (sameUsername) {
    error.textContent = "Ese nombre de usuario ya existe.";
    return;
  }

  const samePassword = users.find((u) => u.password === password);
  if (samePassword) {
    error.textContent = "Esa contraseña ya está en uso.";
    return;
  }

  users.push({ username, password });
  setUsers(users);
  setCurrentUser(username);
  initUserData(username);
  renderHome();
}

function handleLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const error = document.getElementById("login-error");

  error.textContent = "";

  if (!username || !password) {
    error.textContent = "Completá usuario y contraseña.";
    return;
  }

  const users = getUsers();
  const user = users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    error.textContent = "Ese usuario no existe.";
    return;
  }

  if (user.password !== password) {
    error.textContent = "Contraseña incorrecta.";
    return;
  }

  setCurrentUser(user.username);
  initUserData(user.username);
  renderHome();
}

/* =========================
   HOME
========================= */

function renderHome() {
  const username = getCurrentUser();

  showScreen(`
    <div class="topbar">
      <div>
        <div class="brand">Panel principal</div>
        <h1>Hola, ${escapeHtml(username)}</h1>
      </div>
      <span class="pill">Bienvenido de vuelta</span>
    </div>

    <div class="subtitle">
      Hacé click para registrar un gasto, ver tu resumen semanal / mensual / compartidos o gestionar tus categorías.
    </div>

    <div class="vertical-actions">
      <button class="btn btn-primary" onclick="startExpenseFlow()">Registrar gasto</button>
      <button class="btn btn-secondary" onclick="renderSummary()">Ver resumen semanal / mensual / gastos compartidos</button>
      <button class="btn btn-dark" onclick="renderManageCategories()">Gestionar categorías</button>
      <button class="btn btn-danger" onclick="logout()">Cerrar sesión</button>
    </div>
  `);
}

function logout() {
  clearCurrentUser();
  renderAuthChoice();
}

/* =========================
   CATEGORIES
========================= */

function renderManageCategories() {
  const categories = getData("categories", []);

  showScreen(`
    <div class="topbar">
      <div>
        <div class="brand">Configuración</div>
        <h2>Gestionar categorías</h2>
      </div>
      <span class="pill">${categories.length} categorías</span>
    </div>

    <div class="section">
      <label>Nueva categoría</label>
      <input class="input" id="new-category-name" placeholder="Ej: Merienda, Universidad, Regalos..." />
      <button class="btn btn-primary" onclick="addCategory()">Agregar categoría</button>
      <div id="category-msg" class="error"></div>
    </div>

    <div class="section">
      <div class="section-title">Categorías actuales</div>
      <div class="list">
        ${
          categories.length
            ? categories
                .map(
                  (cat, index) => `
                    <div class="category-row">
                      <div class="category-name">${escapeHtml(cat)}</div>
                      <div class="inline-actions">
                        <button class="mini-btn mini-edit" onclick="renameCategory(${index})">Editar</button>
                        <button class="mini-btn mini-delete" onclick="deleteCategory(${index})">Eliminar</button>
                      </div>
                    </div>
                  `
                )
                .join("")
            : `<div class="empty">Todavía no tenés categorías.</div>`
        }
      </div>
    </div>

    <button class="btn btn-dark" onclick="renderHome()">Volver</button>
  `);
}

function addCategory() {
  const input = document.getElementById("new-category-name");
  const msg = document.getElementById("category-msg");
  const value = input.value.trim();

  msg.textContent = "";

  if (!value) {
    msg.textContent = "Escribí un nombre de categoría.";
    return;
  }

  const categories = getData("categories", []);
  const exists = categories.find((c) => c.toLowerCase() === value.toLowerCase());

  if (exists) {
    msg.textContent = "Esa categoría ya existe.";
    return;
  }

  categories.push(value);
  setData("categories", categories);
  renderManageCategories();
}

function renameCategory(index) {
  const categories = getData("categories", []);
  const current = categories[index];
  const next = prompt("Nuevo nombre para la categoría:", current);

  if (next === null) return;

  const clean = next.trim();
  if (!clean) return;

  const duplicate = categories.find(
    (c, i) => i !== index && c.toLowerCase() === clean.toLowerCase()
  );

  if (duplicate) {
    alert("Ya existe una categoría con ese nombre.");
    return;
  }

  const expenses = getData("expenses", []);
  expenses.forEach((expense) => {
    if (expense.category === current) {
      expense.category = clean;
    }
  });

  categories[index] = clean;
  setData("categories", categories);
  setData("expenses", expenses);
  renderManageCategories();
}

function deleteCategory(index) {
  const categories = getData("categories", []);
  const current = categories[index];

  const ok = confirm(
    `¿Eliminar "${current}"?\nLos gastos de esa categoría pasarán a "Otros".`
  );

  if (!ok) return;

  categories.splice(index, 1);

  if (!categories.find((c) => c.toLowerCase() === "otros")) {
    categories.push("Otros");
  }

  const expenses = getData("expenses", []);
  expenses.forEach((expense) => {
    if (expense.category === current) {
      expense.category = "Otros";
    }
  });

  setData("categories", categories);
  setData("expenses", expenses);
  renderManageCategories();
}

/* =========================
   EXPENSE FLOW
========================= */

function startExpenseFlow() {
  expenseDraft = {
    dateTime: nowLocalInputValue(),
    category: null,
    totalAmount: null,
    sharedEnabled: false,
    shares: []
  };

  renderExpenseStep1();
}

function renderStepDots(step) {
  return `
    <div class="step-dots">
      <div class="dot ${step >= 1 ? "active" : ""}"></div>
      <div class="dot ${step >= 2 ? "active" : ""}"></div>
      <div class="dot ${step >= 3 ? "active" : ""}"></div>
      <div class="dot ${step >= 4 ? "active" : ""}"></div>
    </div>
  `;
}

function renderExpenseStep1() {
  showScreen(`
    <div class="topbar">
      <div>
        <div class="brand">Registrar gasto</div>
        <h2>Paso 1 · Fecha y hora</h2>
      </div>
      <span class="pill">1 / 4</span>
    </div>

    ${renderStepDots(1)}

    <div class="section">
      <label>Fecha y hora del gasto</label>
      <input class="input" id="expense-datetime" type="datetime-local" value="${expenseDraft.dateTime}" />

      <div class="helper">
        Ya aparece la fecha y la hora actual del dispositivo. Si cargás algo tarde, la podés modificar acá.
      </div>
    </div>

    <div class="row">
      <button class="btn btn-primary" onclick="goExpenseStep2()">Siguiente</button>
      <button class="btn btn-dark" onclick="renderHome()">Cancelar</button>
    </div>
  `);
}

function goExpenseStep2() {
  const value = document.getElementById("expense-datetime").value;
  if (!value) return;
  expenseDraft.dateTime = value;
  renderExpenseStep2();
}

function renderExpenseStep2() {
  const categories = getData("categories", []);

  showScreen(`
    <div class="topbar">
      <div>
        <div class="brand">Registrar gasto</div>
        <h2>Paso 2 · Categoría</h2>
      </div>
      <span class="pill">2 / 4</span>
    </div>

    ${renderStepDots(2)}

    <div class="section">
      <label>Seleccioná una categoría</label>
      <select class="select" id="expense-category">
        ${categories
          .map(
            (cat) =>
              `<option value="${escapeAttr(cat)}" ${
                expenseDraft.category === cat ? "selected" : ""
              }>${escapeHtml(cat)}</option>`
          )
          .join("")}
      </select>

      <label>Crear una categoría nueva</label>
      <input class="input" id="quick-new-category" placeholder="Ej: Facultad, Delivery, Regalo..." />
      <button class="btn btn-secondary" onclick="quickAddCategory()">Agregar categoría</button>

      <div class="helper">
        Si querés modificar o borrar categorías, hacelo desde <span class="small-link" onclick="renderManageCategories()">Gestionar categorías</span>.
      </div>
    </div>

    <div class="row">
      <button class="btn btn-primary" onclick="goExpenseStep3()">Siguiente</button>
      <button class="btn btn-dark" onclick="renderExpenseStep1()">Atrás</button>
    </div>
  `);
}

function quickAddCategory() {
  const input = document.getElementById("quick-new-category");
  const value = input.value.trim();
  if (!value) return;

  const categories = getData("categories", []);
  const exists = categories.find((c) => c.toLowerCase() === value.toLowerCase());

  if (exists) {
    alert("Esa categoría ya existe.");
    return;
  }

  categories.push(value);
  setData("categories", categories);
  expenseDraft.category = value;
  renderExpenseStep2();
}

function goExpenseStep3() {
  const category = document.getElementById("expense-category").value;
  if (!category) return;
  expenseDraft.category = category;
  renderExpenseStep3();
}

function renderExpenseStep3() {
  const presets = Array.from({ length: 10 }, (_, i) => (i + 1) * 2000);

  const amountSelected = Number(expenseDraft.totalAmount) > 0;

  showScreen(`
    <div class="topbar">
      <div>
        <div class="brand">Registrar gasto</div>
        <h2>Paso 3 · Monto</h2>
      </div>
      <span class="pill">3 / 4</span>
    </div>

    ${renderStepDots(3)}

    <div class="section">
      <label>Monto personalizado</label>
      <div class="money-input-wrap">
        <span class="money-prefix">$</span>
        <input
          class="input money-input"
          id="custom-amount"
          type="number"
          min="0"
          step="1"
          placeholder="Ej: 2500 o 25000"
          value="${expenseDraft.totalAmount ?? ""}"
        />
      </div>

      <div class="helper">
        Si el monto no está entre los botones rápidos, lo escribís arriba y listo.
      </div>

      ${
        amountSelected
          ? `
            <div class="hr"></div>
            <div class="section-title">Monto elegido</div>
            <div class="item">
              <div class="item-head">
                <div class="item-title">Seleccionaste</div>
                <div class="badge money">${formatMoney(expenseDraft.totalAmount)}</div>
              </div>
            </div>

            <button class="btn btn-secondary" onclick="resetAmountSelection()">Cambiar monto</button>
            <button class="btn btn-primary" onclick="goExpenseStep4()">Siguiente</button>
          `
          : `
            <div class="amount-grid">
              ${presets
                .map(
                  (value) => `
                    <button class="amount-chip" onclick="selectPresetAmount(${value})">${formatMoney(value)}</button>
                  `
                )
                .join("")}
            </div>

            <button class="btn btn-success" onclick="selectCustomAmount()">Usar monto escrito</button>
          `
      }
    </div>

    <button class="btn btn-dark" onclick="renderExpenseStep2()">Atrás</button>
  `);
}

function selectPresetAmount(value) {
  expenseDraft.totalAmount = value;
  renderExpenseStep3();
}

function selectCustomAmount() {
  const value = Number(document.getElementById("custom-amount").value);
  if (!value || value <= 0) {
    alert("Ingresá un monto válido.");
    return;
  }

  expenseDraft.totalAmount = value;
  renderExpenseStep3();
}

function resetAmountSelection() {
  expenseDraft.totalAmount = null;
  renderExpenseStep3();
}

function renderExpenseStep4() {
  const friends = getData("friends", []);
  const currentShares = expenseDraft.shares || [];

  showScreen(`
    <div class="topbar">
      <div>
        <div class="brand">Registrar gasto</div>
        <h2>Paso 4 · Compartir gasto</h2>
      </div>
      <span class="pill">4 / 4</span>
    </div>

    ${renderStepDots(4)}

    <div class="section">
      <div class="switch-row">
        <div>
          <div class="section-title">¿Compartir gasto?</div>
          <div class="helper">
            Activá esto si vos pagaste todo y alguien te tiene que devolver una parte.
          </div>
        </div>

        <label class="switch">
          <input id="share-toggle" type="checkbox" ${expenseDraft.sharedEnabled ? "checked" : ""} onchange="toggleShareMode()" />
          <span class="slider"></span>
        </label>
      </div>
    </div>

    ${
      expenseDraft.sharedEnabled
        ? `
          <div class="section">
            <div class="section-title">Amigos para dividir gasto</div>

            ${
              friends.length
                ? `
                  <label>Seleccioná amigos</label>
                  <div class="list">
                    ${friends
                      .map((friend, idx) => {
                        const share = currentShares.find((s) => s.friend === friend);
                        const checked = !!share;
                        const amount = share ? share.amount : "";
                        return `
                          <div class="item">
                            <div class="item-head">
                              <div class="item-title">
                                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                                  <input type="checkbox" ${checked ? "checked" : ""} onchange="toggleFriendShare('${escapeJs(friend)}', this.checked)" />
                                  <span>${escapeHtml(friend)}</span>
                                </label>
                              </div>
                              <div class="badge">Amigo</div>
                            </div>

                            ${
                              checked
                                ? `
                                  <label>¿Cuánto te tiene que pagar?</label>
                                  <div class="money-input-wrap">
                                    <span class="money-prefix">$</span>
                                    <input
                                      class="input money-input"
                                      type="number"
                                      min="0"
                                      step="1"
                                      value="${amount}"
                                      onchange="setFriendShareAmount('${escapeJs(friend)}', this.value)"
                                      placeholder="Monto que te debe"
                                    />
                                  </div>
                                `
                                : ""
                            }
                          </div>
                        `;
                      })
                      .join("")}
                  </div>
                `
                : `<div class="empty">Todavía no tenés amigos guardados.</div>`
            }

            <div class="hr"></div>

            <label>Agregar amigo</label>
            <input class="input" id="new-friend-name" placeholder="Nombre del amigo" />
            <button class="btn btn-secondary" onclick="addFriendFromExpense()">Agregar amigo</button>

            <div class="helper">
              Tus amigos no tienen cuenta propia. Son solo para que vos veas quién te debe plata.
            </div>
          </div>
        `
        : ""
    }

    <div class="section">
      <div class="section-title">Resumen antes de guardar</div>
      <div class="item">
        <div class="item-sub"><strong>Fecha:</strong> ${formatDateTime(expenseDraft.dateTime)}</div>
        <div class="item-sub"><strong>Categoría:</strong> ${escapeHtml(expenseDraft.category)}</div>
        <div class="item-sub"><strong>Total pagado por vos:</strong> <span class="money">${formatMoney(expenseDraft.totalAmount)}</span></div>
      </div>
    </div>

    <div class="row">
      <button class="btn btn-success" onclick="saveExpense()">Guardar gasto en la nube</button>
      <button class="btn btn-dark" onclick="renderExpenseStep3()">Atrás</button>
    </div>
  `);
}

function toggleShareMode() {
  const checked = document.getElementById("share-toggle").checked;
  expenseDraft.sharedEnabled = checked;
  if (!checked) {
    expenseDraft.shares = [];
  }
  renderExpenseStep4();
}

function toggleFriendShare(friend, checked) {
  if (!expenseDraft.shares) expenseDraft.shares = [];

  if (checked) {
    const exists = expenseDraft.shares.find((s) => s.friend === friend);
    if (!exists) {
      expenseDraft.shares.push({ friend, amount: "", paid: false });
    }
  } else {
    expenseDraft.shares = expenseDraft.shares.filter((s) => s.friend !== friend);
  }

  renderExpenseStep4();
}

function setFriendShareAmount(friend, value) {
  const share = expenseDraft.shares.find((s) => s.friend === friend);
  if (!share) return;
  share.amount = Number(value);
}

function addFriendFromExpense() {
  const input = document.getElementById("new-friend-name");
  const value = input.value.trim();
  if (!value) return;

  const friends = getData("friends", []);
  const exists = friends.find((f) => f.toLowerCase() === value.toLowerCase());

  if (exists) {
    alert("Ese amigo ya existe.");
    return;
  }

  friends.push(value);
  setData("friends", friends);

  if (!expenseDraft.shares) expenseDraft.shares = [];
  expenseDraft.shares.push({ friend: value, amount: "", paid: false });

  renderExpenseStep4();
}

function goExpenseStep4() {
  renderExpenseStep4();
}

function saveExpense() {
  if (!expenseDraft.dateTime || !expenseDraft.category || !expenseDraft.totalAmount) {
    alert("Faltan datos del gasto.");
    return;
  }

  let shares = [];
  if (expenseDraft.sharedEnabled) {
    shares = (expenseDraft.shares || []).map((share) => ({
      friend: share.friend,
      amount: Number(share.amount || 0),
      paid: false
    }));

    const invalid = shares.find((s) => !s.amount || s.amount <= 0);
    if (invalid) {
      alert(`Falta poner cuánto te debe ${invalid.friend}.`);
      return;
    }

    const totalShared = shares.reduce((acc, s) => acc + Number(s.amount || 0), 0);
    if (totalShared > Number(expenseDraft.totalAmount)) {
      alert("La suma de lo que te deben no puede ser mayor al total pagado.");
      return;
    }
  }

  const expenses = getData("expenses", []);
  expenses.push({
    id: Date.now(),
    dateTime: expenseDraft.dateTime,
    category: expenseDraft.category,
    totalAmount: Number(expenseDraft.totalAmount),
    shares
  });

  setData("expenses", expenses);
  expenseDraft = null;
  renderHome();
}

/* =========================
   SUMMARY
========================= */

function getRealSpent(expense) {
  const paidBack = (expense.shares || [])
    .filter((s) => s.paid)
    .reduce((acc, s) => acc + Number(s.amount || 0), 0);

  return Number(expense.totalAmount) - paidBack;
}

function renderSummary() {
  const expenses = getData("expenses", []);
  const now = new Date();

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const weekAgo = new Date();
  weekAgo.setDate(now.getDate() - 7);

  const weeklyExpenses = expenses.filter((expense) => {
    const d = new Date(expense.dateTime);
    return d >= weekAgo;
  });

  const monthlyExpenses = expenses.filter((expense) => {
    const d = new Date(expense.dateTime);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const weeklyTotal = weeklyExpenses.reduce((acc, exp) => acc + getRealSpent(exp), 0);
  const monthlyTotal = monthlyExpenses.reduce((acc, exp) => acc + getRealSpent(exp), 0);

  const monthlyByCategory = {};
  monthlyExpenses.forEach((exp) => {
    if (!monthlyByCategory[exp.category]) {
      monthlyByCategory[exp.category] = 0;
    }
    monthlyByCategory[exp.category] += getRealSpent(exp);
  });

  const pendingShares = [];
  expenses.forEach((expense) => {
    (expense.shares || []).forEach((share) => {
      if (!share.paid) {
        pendingShares.push({
          expenseId: expense.id,
          friend: share.friend,
          amount: Number(share.amount || 0),
          category: expense.category,
          dateTime: expense.dateTime
        });
      }
    });
  });

  showScreen(`
    <div class="topbar">
      <div>
        <div class="brand">Resumen</div>
        <h2>Semanal / mensual / compartidos</h2>
      </div>
      <span class="pill">${expenses.length} gastos</span>
    </div>

    <div class="kpi-grid">
      <div class="kpi">
        <div class="kpi-label">Total semanal real</div>
        <div class="kpi-value">${formatMoney(weeklyTotal)}</div>
      </div>
      <div class="kpi">
        <div class="kpi-label">Total mensual real</div>
        <div class="kpi-value">${formatMoney(monthlyTotal)}</div>
      </div>
    </div>

    <div class="section" style="margin-top:12px;">
      <div class="section-title">Gasto mensual por categoría</div>
      <div class="list">
        ${
          Object.keys(monthlyByCategory).length
            ? Object.entries(monthlyByCategory)
                .sort((a, b) => b[1] - a[1])
                .map(
                  ([category, amount]) => `
                    <div class="item">
                      <div class="item-head">
                        <div class="item-title">${escapeHtml(category)}</div>
                        <div class="badge money">${formatMoney(amount)}</div>
                      </div>
                    </div>
                  `
                )
                .join("")
            : `<div class="empty">Todavía no hay gastos este mes.</div>`
        }
      </div>
    </div>

    <div class="section">
      <div class="section-title">Gastos compartidos pendientes</div>
      <div class="list">
        ${
          pendingShares.length
            ? pendingShares
                .map(
                  (share) => `
                    <div class="item">
                      <div class="item-head">
                        <div class="item-title">${escapeHtml(share.friend)}</div>
                        <div class="badge money">${formatMoney(share.amount)}</div>
                      </div>
                      <div class="item-sub">
                        Te debe plata por <strong>${escapeHtml(share.category)}</strong> · ${formatDateTime(share.dateTime)}
                      </div>
                      <div style="margin-top:10px;">
                        <button class="btn btn-success" onclick="markSharePaid(${share.expenseId}, '${escapeJs(share.friend)}')">
                          Marcar como pagado
                        </button>
                      </div>
                    </div>
                  `
                )
                .join("")
            : `<div class="empty">No tenés gastos compartidos pendientes.</div>`
        }
      </div>
    </div>

    <button class="btn btn-dark" onclick="renderHome()">Volver</button>
  `);
}

function markSharePaid(expenseId, friend) {
  const expenses = getData("expenses", []);
  const expense = expenses.find((e) => e.id === expenseId);
  if (!expense) return;

  const share = (expense.shares || []).find((s) => s.friend === friend && !s.paid);
  if (!share) return;

  share.paid = true;
  setData("expenses", expenses);
  renderSummary();
}

/* =========================
   HELPERS
========================= */

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeJs(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

/* =========================
   START
========================= */

(function startApp() {
  const user = getCurrentUser();
  if (user) {
    initUserData(user);
    renderHome();
  } else {
    renderAuthChoice();
  }
})();