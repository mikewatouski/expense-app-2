const app = document.getElementById("app");

// el script de index.html debe configurar supabase antes de cargar app.js:
// <script>window.supabase = supabase.createClient(URL, KEY);</script>
const sb = window.supabase;

let expenseDraft = null;

// sesión almacenada localmente solo guarda el id de Supabase
function getCurrentUser() {
  return localStorage.getItem("currentUser");
}
function setCurrentUser(userId, username) {
  localStorage.setItem("currentUser", userId);
  localStorage.setItem("currentUsername", username);
}

function getCurrentUsername() {
  return localStorage.getItem("currentUsername");
}

function clearCurrentUser() {
  localStorage.removeItem("currentUser");
  localStorage.removeItem("currentUsername");
}

// helpers de base de datos ----------------------------------------------------------------
async function getUsers() {
  if (!sb) {
    return JSON.parse(localStorage.getItem("users") || "[]");
  }
  const { data, error } = await sb.from("users").select("id,username");
  if (error) {
    console.error("getUsers:", error);
    return [];
  }
  return data;
}

function getUserKey(key) {
  return `${getCurrentUser()}__${key}`;
}

async function getData(key, fallback) {
  if (!sb) {
    console.log("Supabase no disponible, usando localStorage para", key);
    const raw = localStorage.getItem(getUserKey(key));
    return raw ? JSON.parse(raw) : fallback;
  }
  console.log("Usando Supabase para getData", key);
  const userId = getCurrentUser();
  if (!userId) return fallback;

  switch (key) {
    case "categories": {
      const { data, error } = await sb
        .from("categories")
        .select("name")
        .eq("user_id", userId)
        .order("created_at");
      if (error) {
        console.error("getData categories:", error);
        return fallback;
      }
      return data.map((r) => r.name);
    }
    case "friends": {
      const { data, error } = await sb
        .from("friends")
        .select("name")
        .eq("user_id", userId)
        .order("created_at");
      if (error) {
        console.error("getData friends:", error);
        return fallback;
      }
      return data.map((r) => r.name);
    }
    case "expenses": {
      const { data, error } = await sb
        .from("expenses")
        .select(`
          id,
          date_time,
          total_amount,
          category:categories(name),
          shared_expenses (
            friend_id,
            amount,
            paid
          )
        `)
        .eq("user_id", userId);
      if (error) {
        console.error("getData expenses:", error);
        return fallback;
      }
      const { data: friendRows } = await sb
        .from("friends")
        .select("id,name")
        .eq("user_id", userId);
      const friendsMap = {};
      if (friendRows) {
        friendRows.forEach((r) => (friendsMap[r.id] = r.name));
      }
      return data.map((e) => ({
        id: e.id,
        dateTime: e.date_time,
        category: e.category ? e.category.name : "",
        totalAmount: Number(e.total_amount),
        shares: (e.shared_expenses || []).map((se) => ({
          friend: friendsMap[se.friend_id] || "",
          amount: Number(se.amount),
          paid: se.paid,
        })),
      }));
    }
    default:
      return fallback;
  }
}

async function setData(key, value) {
  if (!sb) {
    console.log("Supabase no disponible, usando localStorage para", key);
    localStorage.setItem(getUserKey(key), JSON.stringify(value));
    return;
  }
  console.log("Usando Supabase para setData", key);
  const userId = getCurrentUser();
  if (!userId) return;

  switch (key) {
    case "categories": {
      await sb.from("categories").delete().eq("user_id", userId);
      if (value.length) {
        await sb.from("categories").insert(
          value.map((name) => ({ user_id: userId, name }))
        );
      }
      break;
    }
    case "friends": {
      await sb.from("friends").delete().eq("user_id", userId);
      if (value.length) {
        await sb.from("friends").insert(
          value.map((name) => ({ user_id: userId, name }))
        );
      }
      break;
    }
    case "expenses": {
      // Get current expense ids
      const { data: currentExpenses } = await sb
        .from("expenses")
        .select("id")
        .eq("user_id", userId);
      const currentIds = currentExpenses ? currentExpenses.map(e => e.id) : [];
      // Delete shared_expenses for existing expenses
      if (currentIds.length) {
        await sb.from("shared_expenses").delete().in("expense_id", currentIds);
      }
      // Delete all expenses
      await sb.from("expenses").delete().eq("user_id", userId);
      // Reinsert
      for (const exp of value) {
        let { data: catRow } = await sb
          .from("categories")
          .select("id")
          .eq("user_id", userId)
          .eq("name", exp.category)
          .single();
        let catId = catRow ? catRow.id : null;
        if (!catId) {
          const { data: newCat } = await sb
            .from("categories")
            .insert({ user_id: userId, name: exp.category })
            .select("id")
            .single();
          catId = newCat.id;
        }
        const { data: inserted } = await sb
          .from("expenses")
          .insert({
            user_id: userId,
            date_time: exp.dateTime,
            total_amount: exp.totalAmount,
            category_id: catId,
          })
          .select("id")
          .single();
        exp.id = inserted.id; // Update the id in the array
        if (exp.shares && exp.shares.length) {
          for (const s of exp.shares) {
            let { data: friendRow } = await sb
              .from("friends")
              .select("id")
              .eq("user_id", userId)
              .eq("name", s.friend)
              .single();
            let friendId = friendRow ? friendRow.id : null;
            if (!friendId) {
              const { data: newFriend } = await sb
                .from("friends")
                .insert({ user_id: userId, name: s.friend })
                .select("id")
                .single();
              friendId = newFriend.id;
            }
            await sb.from("shared_expenses").insert({
              expense_id: inserted.id,
              friend_id: friendId,
              amount: s.amount,
              paid: s.paid,
            });
          }
        }
      }
      break;
    }
  }
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

async function initUserData(userId) {
  // crea filas iniciales si aún no existen
  const cats = await getData("categories", []);
  if (cats.length === 0) {
    await setData("categories", [
      "Comida",
      "Transporte",
      "Salidas",
      "Compras",
      "Otros",
    ]);
  }
  const exps = await getData("expenses", []);
  if (exps.length === 0) {
    await setData("expenses", []);
  }
  const frs = await getData("friends", []);
  if (frs.length === 0) {
    await setData("friends", []);
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

async function handleRegister() {
  const username = document.getElementById("register-username").value.trim();
  const password = document.getElementById("register-password").value.trim();
  const error = document.getElementById("register-error");

  error.textContent = "";

  if (!username || !password) {
    error.textContent = "Completá usuario y contraseña.";
    return;
  }

  // Check if username exists
  const { data: existing, error: err1 } = await sb
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (err1 && err1.code !== 'PGRST116') { // PGRST116 = not found
    console.error(err1);
    error.textContent = "Error de base de datos.";
    return;
  }
  if (existing) {
    error.textContent = "Ese nombre de usuario ya existe.";
    return;
  }

  // Insert new user
  const { data: user, error: err2 } = await sb
    .from('users')
    .insert({ username, password_hash: password })
    .select('id')
    .single();

  if (err2) {
    console.error(err2);
    error.textContent = "No se pudo crear la cuenta.";
    return;
  }

  setCurrentUser(user.id, username);
  await initUserData(user.id);
  renderHome();
}

async function handleLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const error = document.getElementById("login-error");

  error.textContent = "";

  if (!username || !password) {
    error.textContent = "Completá usuario y contraseña.";
    return;
  }

  const { data: user, error: err } = await sb
    .from('users')
    .select('id, password_hash')
    .eq('username', username)
    .single();

  if (err || !user) {
    error.textContent = "Ese usuario no existe.";
    return;
  }

  if (user.password_hash !== password) {
    error.textContent = "Contraseña incorrecta.";
    return;
  }

  setCurrentUser(user.id, username);
  await initUserData(user.id);
  renderHome();
}

/* =========================
   HOME
========================= */

function renderHome() {
  const username = getCurrentUsername() || "Usuario";

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
      <button class="btn btn-secondary" onclick="(async () => { await renderSummary(); })()">Ver resumen semanal / mensual / gastos compartidos</button>
      <button class="btn btn-dark" onclick="(async () => { await renderManageCategories(); })()">Gestionar categorías</button>
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

async function renderManageCategories() {
  const categories = await getData("categories", []);

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
      <button class="btn btn-primary" onclick="(async () => { await addCategory(); })()">Agregar categoría</button>
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
                        <button class="mini-btn mini-edit" onclick="(async () => { await renameCategory(${index}); })()">Editar</button>
                        <button class="mini-btn mini-delete" onclick="(async () => { await deleteCategory(${index}); })()">Eliminar</button>
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

async function addCategory() {
  const input = document.getElementById("new-category-name");
  const msg = document.getElementById("category-msg");
  const value = input.value.trim();

  msg.textContent = "";

  if (!value) {
    msg.textContent = "Escribí un nombre de categoría.";
    return;
  }

  const categories = await getData("categories", []);
  const exists = categories.find((c) => c.toLowerCase() === value.toLowerCase());

  if (exists) {
    msg.textContent = "Esa categoría ya existe.";
    return;
  }

  categories.push(value);
  await setData("categories", categories);
  await renderManageCategories();
}

async function renameCategory(index) {
  const categories = await getData("categories", []);
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

  const expenses = await getData("expenses", []);
  expenses.forEach((expense) => {
    if (expense.category === current) {
      expense.category = clean;
    }
  });

  categories[index] = clean;
  await setData("categories", categories);
  await setData("expenses", expenses);
  await renderManageCategories();
}

async function deleteCategory(index) {
  const categories = await getData("categories", []);
  const current = categories[index];

  const ok = confirm(
    `¿Eliminar "${current}"?\nLos gastos de esa categoría pasarán a "Otros".`
  );

  if (!ok) return;

  categories.splice(index, 1);

  if (!categories.find((c) => c.toLowerCase() === "otros")) {
    categories.push("Otros");
  }

  const expenses = await getData("expenses", []);
  expenses.forEach((expense) => {
    if (expense.category === current) {
      expense.category = "Otros";
    }
  });

  await setData("categories", categories);
  await setData("expenses", expenses);
  await renderManageCategories();
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
      <button class="btn btn-primary" onclick="(async () => { await goExpenseStep2(); })()">Siguiente</button>
      <button class="btn btn-dark" onclick="renderHome()">Cancelar</button>
    </div>
  `);
}

async function goExpenseStep2() {
  const value = document.getElementById("expense-datetime").value;
  if (!value) return;
  expenseDraft.dateTime = value;
  await renderExpenseStep2();
}

async function renderExpenseStep2() {
  const categories = await getData("categories", []);

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
      <button class="btn btn-secondary" onclick="(async () => { await quickAddCategory(); })()">Agregar categoría</button>

      <div class="helper">
        Si querés modificar o borrar categorías, hacelo desde <span class="small-link" onclick="(async () => { await renderManageCategories(); })()">Gestionar categorías</span>.
      </div>
    </div>

    <div class="row">
      <button class="btn btn-primary" onclick="goExpenseStep3()">Siguiente</button>
      <button class="btn btn-dark" onclick="renderExpenseStep1()">Atrás</button>
    </div>
  `);
}

async function quickAddCategory() {
  const input = document.getElementById("quick-new-category");
  const value = input.value.trim();
  if (!value) return;

  const categories = await getData("categories", []);
  const exists = categories.find((c) => c.toLowerCase() === value.toLowerCase());

  if (exists) {
    alert("Esa categoría ya existe.");
    return;
  }

  categories.push(value);
  await setData("categories", categories);
  expenseDraft.category = value;
  await renderExpenseStep2();
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
            <button class="btn btn-primary" onclick="(async () => { await goExpenseStep4(); })()">Siguiente</button>
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

async function renderExpenseStep4() {
  const friends = await getData("friends", []);
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
            <button class="btn btn-secondary" onclick="(async () => { await addFriendFromExpense(); })()">Agregar amigo</button>

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
      <button class="btn btn-success" onclick="(async () => { await saveExpense(); })()">Guardar gasto en la nube</button>
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

async function addFriendFromExpense() {
  const input = document.getElementById("new-friend-name");
  const value = input.value.trim();
  if (!value) return;

  const friends = await getData("friends", []);
  const exists = friends.find((f) => f.toLowerCase() === value.toLowerCase());

  if (exists) {
    alert("Ese amigo ya existe.");
    return;
  }

  friends.push(value);
  await setData("friends", friends);

  if (!expenseDraft.shares) expenseDraft.shares = [];
  expenseDraft.shares.push({ friend: value, amount: "", paid: false });

  await renderExpenseStep4();
}

async function goExpenseStep4() {
  await renderExpenseStep4();
}

async function saveExpense() {
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

  const expenses = await getData("expenses", []);
  expenses.push({
    id: Date.now(),
    dateTime: expenseDraft.dateTime,
    category: expenseDraft.category,
    totalAmount: Number(expenseDraft.totalAmount),
    shares
  });

  await setData("expenses", expenses);
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

async function renderSummary() {
  const expenses = await getData("expenses", []);
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
                        <button class="btn btn-success" onclick="(async () => { await markSharePaid('${share.expenseId}', '${escapeJs(share.friend)}'); })()">
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

async function markSharePaid(expenseId, friend) {
  const expenses = await getData("expenses", []);
  const expense = expenses.find((e) => e.id === expenseId);
  if (!expense) return;

  const share = (expense.shares || []).find((s) => s.friend === friend && !s.paid);
  if (!share) return;

  share.paid = true;
  await setData("expenses", expenses);
  await renderSummary();
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

(async function startApp() {
  const user = getCurrentUser();
  if (user) {
    await initUserData(user);
    renderHome();
  } else {
    renderAuthChoice();
  }
})();