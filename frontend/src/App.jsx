import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
const API = "https://budgetbuddy-backend-nxbb.onrender.com/api/expenses/";
const REGISTER = "https://budgetbuddy-backend-nxbb.onrender.com/api/register/";
const LOGIN = "https://budgetbuddy-backend-nxbb.onrender.com/api/token/";
const CATEGORIES = [
  'Food',
  'Travel',
  'Shopping',
  'Education',
  'Entertainment',
  'Miscellaneous',
];
const money = (value) =>
  '₹' + Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });
function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
async function readResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      'The server returned an unexpected response. Check the Django terminal.'
    );
  }
  if (!response.ok) {
    const detail =
      data.detail ||
      Object.values(data).flat().filter(Boolean).join(' ') ||
      `Request failed (${response.status})`;

    throw new Error(detail);
  }
  return data;
}
function App() {
  const [authenticated, setAuthenticated] = useState(
    Boolean(localStorage.getItem('accessToken'))
  );
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [authMessage, setAuthMessage] = useState('');
  const [page, setPage] = useState('Dashboard');
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: 'Food',
    date: new Date().toISOString().slice(0, 10),
    description: '',
  });
  const [budget, setBudget] = useState(() =>
    Number(localStorage.getItem('bb-budget') || 20000)
  );
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [budgetInput, setBudgetInput] = useState(() =>
    String(localStorage.getItem('bb-budget') || 20000)
  );
  const [categoryBudgets, setCategoryBudgets] = useState(() =>
    readJSON('bb-category-budgets', {})
  );
  const [budgetCategory, setBudgetCategory] = useState('Food');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [goal, setGoal] = useState(() =>
    readJSON('bb-savings-goal', {
      name: 'New Laptop',
      target: 20000,
      saved: 6000,
    })
  );
  const [goalForm, setGoalForm] = useState({
    name: '',
    target: '',
    saved: '',
  });
  const totalExpenses = useMemo(
    () =>
      expenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      ),
    [expenses]
  );
  const month = new Date().toISOString().slice(0, 7);
  const monthlyExpenses = useMemo(
    () =>
      expenses
        .filter((expense) =>
          String(expense.date || '').startsWith(month)
        )
        .reduce(
          (sum, expense) => sum + Number(expense.amount || 0),
          0
        ),
    [expenses, month]
  );
  const remaining = budget - monthlyExpenses;
  const goalPercent =
    Number(goal.target) > 0
      ? Math.min(
          100,
          Math.round((Number(goal.saved) / Number(goal.target)) * 100)
        )
      : 0;
  async function loadExpenses() {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setExpenses([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(API, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await readResponse(response);

      if (!Array.isArray(data)) {
        throw new Error('Unexpected expenses response from Django.');
      }

      setExpenses(data);
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'Could not load expenses.');
    } finally {
      setLoading(false);
    }
  }

  async function loadNotifications() {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setNotifications([]);
      return;
    }
    try {
      const response = await fetch(`${API}notifications/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await readResponse(response);
      if (Array.isArray(data)) setNotifications(data);
    } catch (error) {
      console.error('Could not load notifications:', error);
    }
  }

  async function markNotificationRead(id) {
    const token = localStorage.getItem('accessToken');
    try {
      const response = await fetch(`${API}notifications/${id}/read/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_read: true }),
      });
      const updated = await readResponse(response);
      setNotifications((current) => current.map((item) => item.id === id ? updated : item));
    } catch (error) {
      setMessage(error.message || 'Could not update notification.');
    }
  }

  useEffect(() => {
    if (authenticated) {
      loadExpenses();
      loadNotifications();
    }
    // Initial load only; refreshes happen through loadExpenses().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthMessage('');

    const registering = authMode === 'register';

    const payload = registering
      ? {
          username: authForm.username.trim(),
          email: authForm.email.trim(),
          password: authForm.password,
        }
      : {
          username: authForm.username.trim(),
          password: authForm.password,
        };

    try {
      const response = await fetch(registering ? REGISTER : LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await readResponse(response);

      if (registering) {
        setAuthMode('login');
        setAuthForm({
          username: authForm.username,
          email: '',
          password: '',
        });
        setAuthMessage('Account created successfully. Please log in.');
        return;
      }

      if (!data.access) {
        throw new Error('Login did not return an access token.');
      }

      localStorage.setItem('accessToken', data.access);

      if (data.refresh) {
        localStorage.setItem('refreshToken', data.refresh);
      }

      setAuthenticated(true);
      setPage('Dashboard');
      setAuthMessage('');
      setMessage('');
      await loadExpenses();
    } catch (error) {
      setAuthMessage(error.message || 'Could not connect to Django.');
    }
  }

  function logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    setAuthenticated(false);
    setExpenses([]);
    setNotifications([]);
    setPage('Dashboard');
    setAuthMode('login');
    setAuthForm({ username: '', email: '', password: '' });
    setAuthMessage('');
    setMessage('');
  }

  function changeExpense(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleExpenseSubmit(event) {
    event.preventDefault();
    setMessage('');

    const token = localStorage.getItem('accessToken');

    if (!token) {
      setMessage('Please log in again before adding an expense.');
      setAuthenticated(false);
      return;
    }

    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: form.title.trim(),
          amount: Number(form.amount),
          category: form.category,
          date: form.date,
          description: form.description,
        }),
      });

      const data = await readResponse(response);

      setExpenses((current) => [
        data,
        ...current.filter((item) => item.id !== data.id),
      ]);

      setForm({
        title: '',
        amount: '',
        category: 'Food',
        date: new Date().toISOString().slice(0, 10),
        description: '',
      });

      setShowForm(false);
      setPage('Transactions');
      setMessage('Expense saved successfully!');
      await loadNotifications();
    } catch (error) {
      setMessage(error.message || 'Could not save expense.');
    }
  }

  function saveBudget(event) {
    event.preventDefault();

    const amount = Number(budgetInput);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Enter a valid monthly budget greater than zero.');
      return;
    }

    localStorage.setItem('bb-budget', String(amount));
    setBudget(amount);
    setMessage('Monthly budget saved.');
  }

  function saveCategoryBudget(event) {
    event.preventDefault();

    const amount = Number(budgetAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('Enter a valid category budget.');
      return;
    }

    const updated = {
      ...categoryBudgets,
      [budgetCategory]: amount,
    };

    setCategoryBudgets(updated);
    localStorage.setItem('bb-category-budgets', JSON.stringify(updated));
    setBudgetAmount('');
    setMessage('Category budget saved.');
  }

  function saveGoal(event) {
    event.preventDefault();

    const target = Number(goalForm.target);
    const saved = Number(goalForm.saved);

    if (
      !goalForm.name.trim() ||
      !Number.isFinite(target) ||
      target <= 0 ||
      !Number.isFinite(saved) ||
      saved < 0
    ) {
      setMessage('Enter a goal name, a positive target, and a valid saved amount.');
      return;
    }

    const updated = {
      name: goalForm.name.trim(),
      target,
      saved,
    };

    setGoal(updated);
    localStorage.setItem('bb-savings-goal', JSON.stringify(updated));
    setGoalForm({ name: '', target: '', saved: '' });
    setMessage('Savings goal saved.');
  }

  const visibleExpenses = expenses.filter((expense) => {
    const text =
      `${expense.title || ''} ${expense.description || ''}`.toLowerCase();

    return (
      text.includes(search.toLowerCase()) &&
      (filterCategory === 'All' || expense.category === filterCategory)
    );
  });

  const categoryTotals = useMemo(() => CATEGORIES.map((category) => ({
    category,
    total: expenses
      .filter((expense) => expense.category === category)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
  })), [expenses]);

  const monthlyCategoryTotals = useMemo(() => CATEGORIES.map((category) => ({
    category,
    total: expenses
      .filter((expense) => String(expense.date || '').startsWith(month) && expense.category === category)
      .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
  })), [expenses, month]);

  const unreadNotifications = notifications.filter((item) => !item.is_read).length;

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const total = expenses.filter((item) => String(item.date || '').startsWith(key))
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return { key, label: date.toLocaleDateString('en-IN', { month: 'short' }), total };
    });
  }, [expenses]);

  const categoryChartData = monthlyCategoryTotals.filter((item) => item.total > 0);
  const categoryChartTotal = categoryChartData.reduce((sum, item) => sum + item.total, 0);
  const categoryChartGradient = useMemo(() => {
    const colors = ['#174c3c', '#28745b', '#5b9b79', '#a5c8a8', '#d1a85b', '#8b9b83'];
    if (!categoryChartTotal) return '#e8eee9 0% 100%';
    let cursor = 0;
    return categoryChartData.map((item, index) => {
      const start = cursor;
      cursor += (item.total / categoryChartTotal) * 100;
      return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    }).join(', ');
  }, [categoryChartData, categoryChartTotal]);

  // Category alerts use current-month spending, not all-time spending.
  useEffect(() => {
    let cancelled = false;
    const sendCategoryAlerts = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token || !authenticated) return;
      const monthKey = month;

      for (const item of monthlyCategoryTotals) {
        const limit = Number(categoryBudgets[item.category] || 0);
        const spent = Number(item.total || 0);
        if (limit <= 0 || spent < limit * 0.8) continue;

        const level = spent > limit ? 'over' : spent >= limit ? 'limit' : 'warning';
        const storageKey = `bb-category-${monthKey}-${item.category}-${level}`;
        if (localStorage.getItem(storageKey)) continue;
        localStorage.setItem(storageKey, 'pending');

        try {
          const response = await fetch(`${API}notifications/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: `${item.category} ${level === 'warning' ? 'Budget Warning' : 'Budget Alert'}`,
              message: level === 'over'
                ? `${item.category} spending is over budget: ${money(spent)} spent against ${money(limit)}.`
                : level === 'limit'
                  ? `${item.category} budget limit reached: ${money(spent)} of ${money(limit)} used.`
                  : `${item.category} has reached 80% of its budget: ${money(spent)} of ${money(limit)} used.`,
            }),
          });
          await readResponse(response);
          localStorage.setItem(storageKey, 'sent');
          if (!cancelled) await loadNotifications();
        } catch (error) {
          localStorage.removeItem(storageKey);
          console.error('Category notification failed:', error);
        }
      }
    };
    sendCategoryAlerts();
    return () => { cancelled = true; };
  }, [monthlyCategoryTotals, categoryBudgets, authenticated, month]);

// BUDGET UTILIZATION ALERTS

const bbCurrentMonth = new Date().getMonth();
const bbCurrentYear = new Date().getFullYear();

const bbMonthlyExpenses = expenses.filter((item) => {
  const d = new Date(item.date);

  return (
    d.getMonth() === bbCurrentMonth &&
    d.getFullYear() === bbCurrentYear
  );
});

const bbTotalSpent = bbMonthlyExpenses.reduce(
  (sum, item) => sum + Number(item.amount || 0),
  0
);

const bbBudgetPercentage =
  budget > 0 ? (bbTotalSpent / budget) * 100 : 0;

let bbBudgetAlert = null;

if (bbBudgetPercentage > 100) {
  bbBudgetAlert = {
    type: "danger",
    message: `Overspending! You exceeded your budget by ₹${(bbTotalSpent - budget).toFixed(2)}`
  };
} else if (bbBudgetPercentage >= 100) {
  bbBudgetAlert = {
    type: "danger",
    message: "Your monthly budget limit has been reached!"
  };
} else if (bbBudgetPercentage >= 80) {
  bbBudgetAlert = {
    type: "warning",
    message: "Warning! You have used 80% of your monthly budget."
  };
}

// SAVE BUDGET ALERTS IN DJANGO

useEffect(() => {
  const sendNotification = async () => {
    const token = localStorage.getItem("accessToken");

    if (!token || !bbBudgetAlert) return;

    const monthKey = new Date().toISOString().slice(0, 7);

    const alertType =
      bbBudgetPercentage > 100
        ? "overspending"
        : bbBudgetPercentage >= 100
        ? "limit-reached"
        : "80-percent-warning";

    const storageKey = `bb-${monthKey}-${alertType}`;

    if (localStorage.getItem(storageKey)) return;

    // Prevent duplicate requests
    localStorage.setItem(storageKey, "pending");

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/expenses/notifications/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: bbBudgetAlert.type === "danger"
              ? "Budget Alert"
              : "Budget Warning",
            message: bbBudgetAlert.message,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      localStorage.setItem(storageKey, "sent");
      await loadNotifications();
      console.log("Budget notification saved successfully!");
    } catch (error) {
      localStorage.removeItem(storageKey);
      console.error("Notification error:", error);
    }
  };

  sendNotification();
}, [bbBudgetPercentage, bbTotalSpent, budget]);

  function exportCSV() {
    const rows = [
      ['Title', 'Amount', 'Category', 'Date', 'Description'],
      ...expenses.map((expense) => [
        expense.title,
        expense.amount,
        expense.category,
        expense.date,
        expense.description || '',
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\r\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'budgetbuddy-expenses-report.csv';
    link.click();

    URL.revokeObjectURL(url);
  }
useEffect(() => {
  if (authenticated) loadNotifications();
  else setNotifications([]);
  // loadNotifications is intentionally called when auth state changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [authenticated]);
  if (!authenticated) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>💰 BudgetBuddy</h1>
          <h2>{authMode === 'login' ? 'Welcome Back!' : 'Create Account'}</h2>
          <p>
            {authMode === 'login'
              ? 'Log in to manage your finances.'
              : 'Sign up to start managing your expenses.'}
          </p>

          <form onSubmit={handleAuthSubmit}>
            <label>
              Username
              <input
                value={authForm.username}
                onChange={(event) =>
                  setAuthForm({ ...authForm, username: event.target.value })
                }
                autoComplete="username"
                required
              />
            </label>

            {authMode === 'register' && (
              <label>
                Email
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, email: event.target.value })
                  }
                  autoComplete="email"
                  required
                />
              </label>
            )}

            <label>
              Password
              <input
                type="password"
                value={authForm.password}
                onChange={(event) =>
                  setAuthForm({ ...authForm, password: event.target.value })
                }
                autoComplete={
                  authMode === 'login' ? 'current-password' : 'new-password'
                }
                minLength={8}
                required
              />
            </label>

            <button type="submit">
              {authMode === 'login' ? 'Login' : 'Sign Up'}
            </button>
          </form>

          {authMessage && <p role="alert">{authMessage}</p>}

          <p>
            {authMode === 'login'
              ? "Don't have an account?"
              : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setAuthMessage('');
              }}
            >
              {authMode === 'login' ? 'Sign Up' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  const pages = [
    'Dashboard',
    'Transactions',
    'Budgets',
    'Savings Goals',
    'Reports',
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>💰 BudgetBuddy</h2>

        <nav className="sidebar-nav">
          {pages.map((item) => (
            <button
              key={item}
              type="button"
              className={page === item ? 'active' : ''}
              onClick={() => {
                setPage(item);
                setMessage('');
                setShowForm(false);
              }}
            >
              {item}
            </button>
          ))}
        </nav>

        <button className="logout-button" type="button" onClick={logout}>
          Logout
        </button>
      </aside>

      <main className="main">
        <header className="page-header">
          <div>
            <h1>{page}</h1>
            <p>
              {page === 'Dashboard' && 'Welcome back! Here is your financial overview.'}
              {page === 'Transactions' && 'Search and review your saved expenses.'}
              {page === 'Budgets' && 'Manage your monthly and category budgets.'}
              {page === 'Savings Goals' && 'Track progress toward your savings target.'}
              {page === 'Reports' && 'Review your spending and export your report.'}
            </p>
          </div>

          <div className="header-actions">
            <div className="notification-menu">
              <button
                type="button"
                className={`notification-trigger ${showNotifications ? 'is-open' : ''}`}
                aria-label="Open notifications"
                aria-expanded={showNotifications}
                onClick={() => setShowNotifications((open) => !open)}
              >
                <span className="notification-bell" aria-hidden="true">🔔</span>
                {unreadNotifications > 0 && <span className="notification-count">{unreadNotifications > 9 ? '9+' : unreadNotifications}</span>}
              </button>
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-dropdown-header">
                    <div><strong>Notifications</strong><span>{unreadNotifications} unread</span></div>
                    <button type="button" className="text-button" onClick={loadNotifications}>Refresh</button>
                  </div>
                  <div className="notification-dropdown-list">
                    {notifications.length === 0 ? (
                      <p className="empty-state">You're all caught up. No notifications yet.</p>
                    ) : notifications.map((notification) => (
                      <article className={`notification-item ${notification.is_read ? 'read' : 'unread'}`} key={notification.id}>
                        <div className="notification-item-top">
                          <strong>{notification.title}</strong>
                          {!notification.is_read && <span className="notification-unread">New</span>}
                        </div>
                        <p>{notification.message}</p>
                        <div className="notification-item-bottom">
                          <small>{notification.created_at ? new Date(notification.created_at).toLocaleString() : ''}</small>
                          {!notification.is_read && (
                            <button type="button" className="text-button" onClick={() => markNotificationRead(notification.id)}>Mark as read</button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {(page === 'Dashboard' || page === 'Transactions') && (
            <button
              type="button"
              onClick={() => setShowForm((current) => !current)}
            >
              {showForm ? 'Cancel' : '+ Add Expense'}
            </button>
          )}
          </div>
        </header>

        {message && (
          <div className="app-message" role="status">
            {message}
          </div>
        )}

        {showForm &&
          (page === 'Dashboard' || page === 'Transactions') && (
            <section className="panel">
              <h2>Add Expense</h2>

              <form className="expense-form" onSubmit={handleExpenseSubmit}>
                <label>
                  Title
                  <input
                    name="title"
                    value={form.title}
                    onChange={changeExpense}
                    maxLength={100}
                    required
                  />
                </label>

                <label>
                  Amount (₹)
                  <input
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={changeExpense}
                    required
                  />
                </label>

                <label>
                  Category
                  <select
                    name="category"
                    value={form.category}
                    onChange={changeExpense}
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Date
                  <input
                    name="date"
                    type="date"
                    value={form.date}
                    onChange={changeExpense}
                    required
                  />
                </label>

                <label>
                  Description
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={changeExpense}
                  />
                </label>

                <button type="submit">Save Expense</button>
              </form>
            </section>
          )}

        {page === 'Dashboard' && (
          <>
            <section className="summary-cards">
              <div className="card">
                <p>Monthly Budget</p>
                <h2>{money(budget)}</h2>
              </div>
              <div className="card">
                <p>Current Month Expenses</p>
                <h2>{money(monthlyExpenses)}</h2>
              </div>
              <div className="card">
                <p>Remaining Budget</p>
                <h2>{money(remaining)}</h2>
              </div>
            </section>
{/* BUDGET UTILIZATION ALERT */}

{bbBudgetAlert && (
  <div
    style={{
      padding: "15px",
      margin: "15px 0",
      borderRadius: "10px",
      background:
        bbBudgetAlert.type === "danger"
          ? "#ffe0e0"
          : "#fff1cc",
      color:
        bbBudgetAlert.type === "danger"
          ? "#b91c1c"
          : "#92400e",
      fontWeight: "bold"
    }}
  >
    🔔 {bbBudgetAlert.message}
  </div>
)}
{remaining < 0 && (
              <p className="warning-message">
                You have exceeded your monthly budget.
              </p>
            )}

            <section className="visual-grid">
              <div className="panel chart-panel">
                <div className="panel-heading"><div><h2>Spending trend</h2><p className="muted">Your last six months</p></div><span className="chart-tag">6 months</span></div>
                <MonthlyTrendChart data={monthlyTrend} money={money} />
              </div>
              <div className="panel chart-panel">
                <div className="panel-heading"><div><h2>Spending by category</h2><p className="muted">Current month breakdown</p></div></div>
                <CategoryDonut data={categoryChartData} total={categoryChartTotal} gradient={categoryChartGradient} money={money} />
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h2>Recent Transactions</h2>
                <button type="button" onClick={() => setPage('Transactions')}>
                  View all
                </button>
              </div>

              {loading ? (
                <p>Loading expenses...</p>
              ) : expenses.length === 0 ? (
                <p>No expenses yet. Select Add Expense to create one.</p>
              ) : (
                <ExpenseList
  expenses={expenses.slice(0, 5)}
  onChanged={loadExpenses}
/>
              )}
            </section>

            <SavingsCard goal={goal} percent={goalPercent} />
          </>
        )}

        {page === 'Transactions' && (
          <section className="panel">
            <div className="filter-row">
              <input
                placeholder="Search transactions"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />

              <select
                value={filterCategory}
                onChange={(event) => setFilterCategory(event.target.value)}
              >
                <option value="All">All categories</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <button type="button" onClick={loadExpenses}>
                Refresh
              </button>
            </div>

            {loading ? (
              <p>Loading transactions...</p>
            ) : visibleExpenses.length ? (
              <ExpenseList
  expenses={visibleExpenses}
  onChanged={loadExpenses}
/>
            ) : (
              <p>No matching transactions found.</p>
            )}
          </section>
        )}

        {page === 'Budgets' && (
          <>
            <section className="panel">
              <h2>Monthly Budget</h2>
              <p>Current budget: <strong>{money(budget)}</strong></p>

              <form className="stacked-form" onSubmit={saveBudget}>
                <label>
                  Monthly limit (₹)
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={budgetInput}
                    onChange={(event) => setBudgetInput(event.target.value)}
                    required
                  />
                </label>
                <button type="submit">Save Monthly Budget</button>
              </form>

              <p>Spent this month: {money(monthlyExpenses)}</p>
              <p>Remaining: {money(remaining)}</p>
            </section>

            <section className="panel">
              <h2>Category Budgets</h2>

              <form className="inline-form" onSubmit={saveCategoryBudget}>
                <label>
                  Category
                  <select
                    value={budgetCategory}
                    onChange={(event) => setBudgetCategory(event.target.value)}
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Limit (₹)
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={budgetAmount}
                    onChange={(event) => setBudgetAmount(event.target.value)}
                    required
                  />
                </label>

                <button type="submit">Save Category Budget</button>
              </form>

              {Object.entries(categoryBudgets).map(([category, limit]) => {
                const spent =
                  categoryTotals.find((item) => item.category === category)
                    ?.total || 0;

                return (
                  <div className="list-row" key={category}>
                    <span>{category}</span>
                    <span>{money(spent)} / {money(limit)}</span>
                    <strong>
                      {spent > Number(limit) ? 'Over budget' : 'Within budget'}
                    </strong>
                  </div>
                );
              })}
            </section>
          </>
        )}

        {page === 'Savings Goals' && (
          <>
            <SavingsCard goal={goal} percent={goalPercent} />

            <section className="panel">
              <h2>Create or Update Savings Goal</h2>

              <form className="stacked-form" onSubmit={saveGoal}>
                <label>
                  Goal name
                  <input
                    value={goalForm.name}
                    onChange={(event) =>
                      setGoalForm({ ...goalForm, name: event.target.value })
                    }
                    placeholder={goal.name}
                    required
                  />
                </label>

                <label>
                  Target amount (₹)
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={goalForm.target}
                    onChange={(event) =>
                      setGoalForm({ ...goalForm, target: event.target.value })
                    }
                    placeholder={String(goal.target)}
                    required
                  />
                </label>

                <label>
                  Amount saved (₹)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={goalForm.saved}
                    onChange={(event) =>
                      setGoalForm({ ...goalForm, saved: event.target.value })
                    }
                    placeholder={String(goal.saved)}
                    required
                  />
                </label>

                <button type="submit">Save Savings Goal</button>
              </form>

              <p className="muted">
                Savings goal settings are stored in this browser.
              </p>
            </section>
          </>
        )}

        {page === 'Reports' && (
          <>
            <section className="summary-cards">
              <div className="card">
                <p>Total Expenses</p>
                <h2>{money(totalExpenses)}</h2>
              </div>
              <div className="card">
                <p>This Month</p>
                <h2>{money(monthlyExpenses)}</h2>
              </div>
              <div className="card">
                <p>Number of Transactions</p>
                <h2>{expenses.length}</h2>
              </div>
            </section>

            <section className="panel">
              <h2>Monthly Spending Insights</h2>
              <p>Budget utilization: <strong>{budget > 0 ? Math.round((monthlyExpenses / budget) * 100) : 0}%</strong></p>
              <p>Average expense per transaction this month: <strong>{money(expenses.filter((item) => String(item.date || '').startsWith(month)).length ? monthlyExpenses / expenses.filter((item) => String(item.date || '').startsWith(month)).length : 0)}</strong></p>
              <p>Highest spending category this month: <strong>{monthlyCategoryTotals.reduce((best, item) => item.total > best.total ? item : best, { category: 'None', total: 0 }).category}</strong></p>
            </section>

            <section className="visual-grid">
              <div className="panel chart-panel">
                <div className="panel-heading"><div><h2>Monthly spending trend</h2><p className="muted">Six-month overview</p></div></div>
                <MonthlyTrendChart data={monthlyTrend} money={money} />
              </div>
              <div className="panel chart-panel">
                <div className="panel-heading"><div><h2>Category distribution</h2><p className="muted">This month's expenses</p></div></div>
                <CategoryDonut data={categoryChartData} total={categoryChartTotal} gradient={categoryChartGradient} money={money} />
              </div>
            </section>

            <section className="panel">
              <h2>This Month: Spending by Category</h2>
              {monthlyCategoryTotals.filter((item) => item.total > 0).length === 0 ? (
                <p>No expenses recorded this month.</p>
              ) : monthlyCategoryTotals.filter((item) => item.total > 0).map(({ category, total }) => (
                <div className="list-row" key={`monthly-${category}`}>
                  <span>{category}</span>
                  <div className="report-bar-track">
                    <div className="report-bar-fill" style={{ width: `${monthlyExpenses ? (total / monthlyExpenses) * 100 : 0}%` }} />
                  </div>
                  <strong>{money(total)}</strong>
                </div>
              ))}
            </section>

            <section className="panel">
              <h2>Spending by Category (All Time)</h2>

              {categoryTotals.filter((item) => item.total > 0).length === 0 ? (
                <p>No expenses available for a report yet.</p>
              ) : (
                categoryTotals
                  .filter((item) => item.total > 0)
                  .map(({ category, total }) => (
                    <div className="list-row" key={category}>
                      <span>{category}</span>
                      <div className="report-bar-track">
                        <div
                          className="report-bar-fill"
                          style={{
                            width: `${
                              totalExpenses
                                ? (total / totalExpenses) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <strong>{money(total)}</strong>
                    </div>
                  ))
              )}

              <button
  type="button"
  className="export-button"
  onClick={exportCSV}
>
  Export Expenses CSV
</button>
            </section>
          </>
        )}

        <footer>BudgetBuddy · Manage money, build better habits.</footer>
      </main>
    </div>
  );
}


function MonthlyTrendChart({ data, money }) {
  const max = Math.max(...data.map((item) => item.total), 1);
  return (
    <div className="trend-chart" role="img" aria-label="Spending over the last six months">
      <div className="trend-chart-bars">
        {data.map((item) => (
          <div className="trend-column" key={item.key} title={`${item.label}: ${money(item.total)}`}>
            <span className="trend-value">{item.total ? money(item.total) : '—'}</span>
            <div className="trend-bar-area"><div className="trend-bar" style={{ height: `${Math.max(item.total ? 5 : 0, (item.total / max) * 100)}%` }} /></div>
            <span className="trend-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryDonut({ data, total, gradient, money }) {
  if (!data.length || total <= 0) return <div className="chart-empty">Add expenses to see your category breakdown.</div>;
  return (
    <div className="donut-layout">
      <div className="donut-chart" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label="Spending by category">
        <div className="donut-hole"><span>Total spent</span><strong>{money(total)}</strong></div>
      </div>
      <div className="donut-legend">
        {data.map((item, index) => (
          <div className="legend-row" key={item.category}>
            <span className={`legend-dot legend-${index % 6}`} /><span>{item.category}</span>
            <strong>{Math.round((item.total / total) * 100)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpenseList({ expenses, onChanged }) {
  async function editExpense(expense) {
    const title = window.prompt("Expense title:", expense.title);
    if (title === null) return;

    const amount = window.prompt("Amount:", expense.amount);
    if (amount === null) return;

    const category = window.prompt(
      "Category (Food, Travel, Shopping, Education, Entertainment, Miscellaneous):",
      expense.category
    );
    if (category === null) return;

    const date = window.prompt("Date (YYYY-MM-DD):", expense.date);
    if (date === null) return;

    const description = window.prompt(
      "Description:",
      expense.description || ""
    );
    if (description === null) return;

    if (!title.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      alert("Please enter a valid title and positive amount.");
      return;
    }

    const validCategories = [
      "Food", "Travel", "Shopping",
      "Education", "Entertainment", "Miscellaneous"
    ];

    if (!validCategories.includes(category)) {
      alert("Please enter a valid category.");
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/expenses/${expense.id}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`
          },
          body: JSON.stringify({
            title: title.trim(),
            amount: Number(amount),
            category,
            date,
            description
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        alert(JSON.stringify(error));
        return;
      }

      alert("Expense updated successfully!");
      await onChanged();
    } catch {
      alert("Could not update expense. Check that the backend is running.");
    }
  }

  async function deleteExpense(expense) {
    if (!window.confirm(`Delete "${expense.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/expenses/${expense.id}/`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`
          }
        }
      );

      if (!response.ok) {
        alert("Could not delete expense. Please check your login.");
        return;
      }

      alert("Expense deleted successfully!");
      await onChanged();
    } catch {
      alert("Could not delete expense. Check that the backend is running.");
    }
  }

  return (
    <div className="transactions">
      {expenses.map((expense) => (
        <div className="transaction" key={expense.id}>
          <div>
            <strong>{expense.title}</strong>
            <p>{expense.category} · {expense.date}</p>
            {expense.description && (
              <p className="muted">{expense.description}</p>
            )}
            <div className="expense-actions">
              <button type="button" onClick={() => editExpense(expense)}>
                Edit
              </button>
              <button
                type="button"
                className="delete-button"
                onClick={() => deleteExpense(expense)}
              >
                Delete
              </button>
            </div>
          </div>
          <strong>{money(expense.amount)}</strong>
        </div>
      ))}
    </div>
  );
}

function SavingsCard({ goal, percent }) {
  if (!goal) return null;

  return (
    <section className="panel savings-card">
      <h2>Savings Goal</h2>
      <p>{goal.name || "My Savings Goal"}</p>

      <h3>
        {money(Number(goal.saved) || 0)} / {money(Number(goal.target) || 0)}
      </h3>

      <div
        style={{
          width: "100%",
          height: "10px",
          background: "#e5eee8",
          borderRadius: "10px",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            width: `${Math.min(100, Math.max(0, Number(percent) || 0))}%`,
            height: "100%",
            background: "#28745b"
          }}
        />
      </div>

      <p>{Math.round(Number(percent) || 0)}% of your goal completed</p>
    </section>
  );
}

export default App;