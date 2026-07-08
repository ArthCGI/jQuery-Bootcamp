'use strict';

/* ════════════════════════════════════════════════════════════════
   CONFIG  — single place for all magic values  (DRY)
════════════════════════════════════════════════════════════════ */
const CONFIG = Object.freeze({
  ITEMS_PER_PAGE : 10,
  DEBOUNCE_MS    : 300,
  TOAST_DURATION : 3500,
  LS_EMPLOYEES   : 'emp_employees',   // localStorage key  – persists across sessions
  LS_NEXT_ID     : 'emp_next_id',     // localStorage key
  SS_ACTIVITIES  : 'emp_activities',  // sessionStorage key – clears on tab close
  CHART_COLORS   : ['#3498db','#2ecc71','#f39c12','#9b59b6','#e74c3c','#95a5a6'],
  DEPT_ORDER     : ['IT','HR','Finance','Marketing','Sales','Others'],
  MONTHS         : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
});

/* ════════════════════════════════════════════════════════════════
   UTILS  — pure helper functions, no side-effects  (DRY / KISS)
════════════════════════════════════════════════════════════════ */
const Utils = {

  /**
   * Returns a debounced wrapper of fn.
   * Principle: DRY — one reusable debounce instead of repeated timers.
   */
  debounce(fn, ms = CONFIG.DEBOUNCE_MS) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  },

  formatCurrency : (n) => '$' + Number(n).toLocaleString(),

  formatDisplayDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    return `${String(d.getDate()).padStart(2,'0')} ${CONFIG.MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  },

  getInitials : (name) => name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase(),

  timeAgo(isoStr) {
    const sec = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
    if (sec < 60)    return 'just now';
    if (sec < 3600)  return `${Math.floor(sec / 60)} mins ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`;
    return `${Math.floor(sec / 86400)} days ago`;
  },

  /** Escape user content before inserting as HTML – prevents XSS. */
  escape : (str) => $('<span>').text(String(str)).html()
};

/* ════════════════════════════════════════════════════════════════
   STORAGE SERVICE  (Single Responsibility: all persistence logic)
   localStorage  → employees array + next ID (survives page refresh)
   sessionStorage → activity log (clears when the tab is closed)
════════════════════════════════════════════════════════════════ */
const StorageService = {

  getEmployees() {
    try { return JSON.parse(localStorage.getItem(CONFIG.LS_EMPLOYEES)) || []; }
    catch { return []; }
  },

  saveEmployees(list) {
    localStorage.setItem(CONFIG.LS_EMPLOYEES, JSON.stringify(list));
  },

  getNextId() {
    return parseInt(localStorage.getItem(CONFIG.LS_NEXT_ID), 10) || 1;
  },

  saveNextId(id) {
    localStorage.setItem(CONFIG.LS_NEXT_ID, String(id));
  },

  getActivities() {
    try { return JSON.parse(sessionStorage.getItem(CONFIG.SS_ACTIVITIES)) || []; }
    catch { return []; }
  },

  saveActivities(list) {
    sessionStorage.setItem(CONFIG.SS_ACTIVITIES, JSON.stringify(list));
  }
};

/* ════════════════════════════════════════════════════════════════
   EMPLOYEE STORE  (Single Responsibility: in-memory array + CRUD)
   This is the single source of truth for all employee data.
   All mutations go through here, keeping the array consistent.
════════════════════════════════════════════════════════════════ */
const EmployeeStore = {

  _list: [],   // ← The central employees array

  /** Seed data shown on first launch (localStorage empty). */
  _SEED: [
    { id:1,  name:'John Doe',       email:'john.doe@email.com',     dept:'IT',        salary:7500, date:'2023-01-15' },
    { id:2,  name:'Jane Smith',     email:'jane.smith@email.com',   dept:'HR',        salary:6200, date:'2023-02-20' },
    { id:3,  name:'Michael Brown',  email:'michael.b@email.com',    dept:'Finance',   salary:8300, date:'2023-03-10' },
    { id:4,  name:'Emily Davis',    email:'emily.davis@email.com',  dept:'Marketing', salary:5800, date:'2023-04-18' },
    { id:5,  name:'William Wilson', email:'william.w@email.com',    dept:'IT',        salary:7200, date:'2023-05-22' },
    { id:6,  name:'Jessica Taylor', email:'jessica.t@email.com',    dept:'Sales',     salary:6000, date:'2023-06-30' },
    { id:7,  name:'David Anderson', email:'david.a@email.com',      dept:'Finance',   salary:8900, date:'2023-07-05' },
    { id:8,  name:'Sarah Thomas',   email:'sarah.t@email.com',      dept:'HR',        salary:5500, date:'2023-08-12' },
    { id:9,  name:'Chris Jackson',  email:'chris.j@email.com',      dept:'IT',        salary:7800, date:'2023-08-25' },
    { id:10, name:'Laura White',    email:'laura.w@email.com',      dept:'Marketing', salary:6400, date:'2023-09-10' }
  ],

  load() {
    const stored = StorageService.getEmployees();
    if (stored.length > 0) {
      this._list = stored;
    } else {
      this._list = this._SEED.map(e => ({ ...e })); // shallow copy
      StorageService.saveEmployees(this._list);
      StorageService.saveNextId(11);
    }
  },

  /** Returns a shallow copy of the array — callers cannot mutate internals. */
  getAll() { return [...this._list]; },

  getById(id) { return this._list.find(e => e.id === id) || null; },

  /** Append a new employee object and persist. Returns the created employee. */
  add(data) {
    const id  = StorageService.getNextId();
    const emp = { id, ...data };
    this._list.push(emp);
    StorageService.saveEmployees(this._list);
    StorageService.saveNextId(id + 1);
    return emp;
  },

  update(id, data) {
    const idx = this._list.findIndex(e => e.id === id);
    if (idx === -1) return null;
    this._list[idx] = { ...this._list[idx], ...data };
    StorageService.saveEmployees(this._list);
    return this._list[idx];
  },

  remove(id) {
    const idx = this._list.findIndex(e => e.id === id);
    if (idx === -1) return false;
    this._list.splice(idx, 1);
    StorageService.saveEmployees(this._list);
    return true;
  },

  /**
   * Compute all stats in a single pass over the array.
   * Principle: DRY — one traversal instead of separate reduce calls.
   */
  getStats() {
    let totalSalary = 0;
    const deptCounts    = {};
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let   recentCount   = 0;

    this._list.forEach(e => {
      totalSalary += e.salary;
      deptCounts[e.dept] = (deptCounts[e.dept] || 0) + 1;
      if (new Date(e.date + 'T00:00:00').getTime() >= thirtyDaysAgo) recentCount++;
    });

    const count     = this._list.length;
    const avgSalary = count ? Math.round(totalSalary / count) : 0;
    return { count, totalSalary, avgSalary, deptCounts, recentCount };
  }
};

/* ════════════════════════════════════════════════════════════════
   ALERT SERVICE  (Single Responsibility: all custom notifications)
   No browser alert() / confirm() — fully custom UI.
   No third-party plugins.
════════════════════════════════════════════════════════════════ */
const AlertService = {

  _ICONS: {
    success : 'fa-circle-check',
    error   : 'fa-circle-xmark',
    warning : 'fa-triangle-exclamation',
    info    : 'fa-circle-info'
  },

  /** Slide-in toast from the top-right corner. Auto-dismisses. */
  toast(type, message) {
    const id    = 'toast_' + Date.now();
    const icon  = this._ICONS[type] || this._ICONS.info;
    const $elem = $(`
      <div id="${id}" class="custom-toast custom-toast--${type}" role="status">
        <i class="fas ${icon} toast-icon"></i>
        <span class="toast-msg">${Utils.escape(message)}</span>
        <button class="toast-close" data-id="${id}" aria-label="Dismiss">
          <i class="fas fa-xmark"></i>
        </button>
      </div>`);

    $('#toastContainer').append($elem);
    // Use requestAnimationFrame so the CSS transition actually plays
    requestAnimationFrame(() => requestAnimationFrame(() => $elem.addClass('show')));
    setTimeout(() => this.dismiss(id), CONFIG.TOAST_DURATION);
  },

  dismiss(id) {
    const $t = $(`#${id}`);
    $t.removeClass('show');
    setTimeout(() => $t.remove(), 350);
  },

  /**
   * Custom confirm dialog — callback-based (replaces window.confirm).
   * @param {string}   message  - Prompt text shown to the user.
   * @param {Function} onOk     - Called when user clicks "Confirm".
   * @param {Function} [onCancel] - Called when user dismisses.
   */
  confirm(message, onOk, onCancel) {
    $('#confirmMessage').text(message);
    const $overlay = $('#confirmOverlay');

    $overlay.addClass('show');

    const close = () => {
      $overlay.removeClass('show');
    };

    $('#confirmOkBtn').off('click.dlg').on('click.dlg', () => {
      close();
      if (typeof onOk === 'function') onOk();
    });

    $('#confirmCancelBtn').off('click.dlg').on('click.dlg', () => {
      close();
      if (typeof onCancel === 'function') onCancel();
    });

    // Clicking the backdrop cancels
    $overlay.off('click.backdrop').on('click.backdrop', function (e) {
      if (e.target === this) {
        close();
        if (typeof onCancel === 'function') onCancel();
      }
    });
  }
};

/* ════════════════════════════════════════════════════════════════
   TABLE RENDERER  (Single Responsibility: render the employee table)
   Accepts a plain state object — no knowledge of App internals.
════════════════════════════════════════════════════════════════ */
const TableRenderer = {

  /**
   * Entry-point: filter → paginate → render → pagination controls.
   * Returns total filtered count so App can adjust page if needed.
   */
  render({ employees, page, perPage, query, dept }) {
    const filtered = this._filter(employees, query, dept);
    const start    = (page - 1) * perPage;
    const pageRows = filtered.slice(start, start + perPage);

    this._renderBody(pageRows, start);
    this._renderInfo(filtered.length, page, perPage);
    this._renderPagination(filtered.length, page, perPage);

    return filtered.length;
  },

  _filter(list, query, dept) {
    const q = (query || '').toLowerCase().trim();
    return list.filter(emp => {
      const matchSearch = !q
        || emp.name.toLowerCase().includes(q)
        || emp.email.toLowerCase().includes(q)
        || emp.dept.toLowerCase().includes(q);
      const matchDept = !dept || emp.dept === dept;
      return matchSearch && matchDept;
    });
  },

  _renderBody(rows, offset) {
    if (rows.length === 0) {
      $('#employeeTableBody').html(
        '<tr><td colspan="7" class="text-center text-muted py-4 fst-italic">No employees found.</td></tr>'
      );
      return;
    }
    $('#employeeTableBody').html(
      rows.map((emp, i) => this._rowHtml(emp, offset + i + 1)).join('')
    );
  },

  /** DRY: single template for every table row. */
  _rowHtml(emp, index) {
    return `
      <tr data-id="${emp.id}">
        <td>${index}</td>
        <td>${Utils.escape(emp.name)}</td>
        <td>${Utils.escape(emp.email)}</td>
        <td>${Utils.escape(emp.dept)}</td>
        <td>${Utils.formatCurrency(emp.salary)}</td>
        <td>${Utils.formatDisplayDate(emp.date)}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary btn-edit me-1"
                  data-id="${emp.id}" title="Edit">
            <i class="fas fa-pen fa-xs"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger btn-delete"
                  data-id="${emp.id}" title="Delete">
            <i class="fas fa-trash fa-xs"></i>
          </button>
        </td>
      </tr>`;
  },

  _renderInfo(total, page, perPage) {
    const start = total === 0 ? 0 : (page - 1) * perPage + 1;
    const end   = Math.min(page * perPage, total);
    $('#paginationInfo').text(`Showing ${start} to ${end} of ${total} entries`);
  },

  _renderPagination(total, page, perPage) {
    const totalPages = Math.ceil(total / perPage);
    if (totalPages <= 1) { $('#pagination').html(''); return; }

    const pages   = this._pageNumbers(page, totalPages);
    const prevDis = page === 1          ? 'disabled' : '';
    const nextDis = page === totalPages ? 'disabled' : '';

    let html = '<ul class="pagination pagination-sm mb-0">';
    html += `<li class="page-item ${prevDis}">
               <a class="page-link" href="#" data-page="${page - 1}">Previous</a></li>`;

    pages.forEach(p => {
      if (p === '…') {
        html += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
      } else {
        html += `<li class="page-item ${p === page ? 'active' : ''}">
                   <a class="page-link" href="#" data-page="${p}">${p}</a></li>`;
      }
    });

    html += `<li class="page-item ${nextDis}">
               <a class="page-link" href="#" data-page="${page + 1}">Next</a></li>`;
    html += '</ul>';

    $('#pagination').html(html);
  },

  _pageNumbers(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)        return [1, 2, 3, 4, 5, '…', total];
    if (cur >= total - 3) return [1, '…', total-4, total-3, total-2, total-1, total];
    return [1, '…', cur-1, cur, cur+1, '…', total];
  },

  /** Re-hide columns after each re-render (hidden state is in App.state). */
  applyColVisibility(hiddenCols) {
    // First reset all
    $('#employeeTable th, #employeeTableBody td').show();
    // Then hide the ones in the set (col numbers are 1-based nth-child)
    hiddenCols.forEach(col => {
      $(`#employeeTable th:nth-child(${col}), #employeeTableBody td:nth-child(${col})`).hide();
    });
  }
};

/* ════════════════════════════════════════════════════════════════
   STATS RENDERER  (Single Responsibility: update stat cards only)
════════════════════════════════════════════════════════════════ */
const StatsRenderer = {
  update({ count, totalSalary, avgSalary, deptCounts, recentCount }) {
    $('#statTotal').text(count);
    $('#statTotalSalary').text(Utils.formatCurrency(totalSalary));
    $('#statAvgSalary').text(Utils.formatCurrency(avgSalary));
    $('#statDepts').text(Object.keys(deptCounts).length);
    $('#statRecent').text(`+${recentCount} this month`);
  }
};

/* ════════════════════════════════════════════════════════════════
   CHART SERVICE  (Single Responsibility: doughnut chart only)
════════════════════════════════════════════════════════════════ */
const ChartService = {
  _chart: null,

  update(deptCounts, total) {
    const { labels, data, colors } = this._buildData(deptCounts);
    if (this._chart) this._chart.destroy();

    this._chart = new Chart(
      document.getElementById('deptChart').getContext('2d'),
      {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2 }] },
        options: {
          cutout: '65%',
          plugins: { legend: { display: false } },
          animation : { duration: 500 }
        }
      }
    );

    this._renderLegend(labels, colors, data, total);
  },

  _buildData(deptCounts) {
    const labels = [], data = [], colors = [];
    CONFIG.DEPT_ORDER.forEach((dept, i) => {
      if (deptCounts[dept]) {
        labels.push(dept); data.push(deptCounts[dept]); colors.push(CONFIG.CHART_COLORS[i]);
      }
    });
    Object.keys(deptCounts).forEach(dept => {
      if (!CONFIG.DEPT_ORDER.includes(dept)) {
        labels.push(dept); data.push(deptCounts[dept]); colors.push('#aaa');
      }
    });
    return { labels, data, colors };
  },

  _renderLegend(labels, colors, data, total) {
    const html = labels.map((lbl, i) => {
      const pct = total ? Math.round(data[i] / total * 100) : 0;
      return `<li class="d-flex align-items-center gap-2 mb-1">
        <span style="width:12px;height:12px;border-radius:3px;background:${colors[i]};
                     display:inline-block;flex-shrink:0"></span>
        ${Utils.escape(lbl)} (${pct}%)
      </li>`;
    }).join('');
    $('#chartLegend').html(html || '<li class="text-muted fst-italic">No data.</li>');
  }
};

/* ════════════════════════════════════════════════════════════════
   TOP EARNERS RENDERER  (Single Responsibility)
════════════════════════════════════════════════════════════════ */
const TopEarnersRenderer = {
  update(employees) {
    const top5 = [...employees].sort((a, b) => b.salary - a.salary).slice(0, 5);

    if (top5.length === 0) {
      $('#topEarnersList').html('<li class="text-muted text-center py-3 fst-italic">No data yet.</li>');
      return;
    }

    const html = top5.map(emp => `
      <li class="earner-item">
        <div class="d-flex align-items-center gap-2">
          <div class="earner-avatar">${Utils.getInitials(emp.name)}</div>
          <div>
            <div class="earner-name">${Utils.escape(emp.name)}</div>
            <div class="earner-dept">${Utils.escape(emp.dept)}</div>
          </div>
        </div>
        <span class="fw-semibold">${Utils.formatCurrency(emp.salary)}</span>
      </li>`).join('');

    $('#topEarnersList').html(html);
  }
};

/* ════════════════════════════════════════════════════════════════
   ACTIVITY LOGGER  (Single Responsibility: session activity log)
   Stored in sessionStorage — automatically cleared on tab close.
════════════════════════════════════════════════════════════════ */
const ActivityLogger = {

  _ICONS: {
    add    : 'fa-user-plus',
    edit   : 'fa-pen-to-square',
    delete : 'fa-user-minus',
    export : 'fa-file-export',
    system : 'fa-circle-info'
  },

  push(type, message) {
    const list = StorageService.getActivities();
    list.unshift({ type, message, time: new Date().toISOString() });
    if (list.length > 10) list.pop();
    StorageService.saveActivities(list);
    this.render();
  },

  render() {
    const list = StorageService.getActivities();
    if (list.length === 0) {
      $('#activityList').html(
        '<li class="text-muted text-center py-3 fst-italic">No activities yet.</li>'
      );
      return;
    }

    const html = list.slice(0, 6).map(a => {
      const icon = this._ICONS[a.type] || 'fa-circle';
      return `<li>
        <div class="d-flex align-items-start gap-2">
          <div class="activity-icon"><i class="fas ${icon} fa-sm"></i></div>
          <span>${a.message}</span>
        </div>
        <small class="text-muted text-nowrap">${Utils.timeAgo(a.time)}</small>
      </li>`;
    }).join('');

    $('#activityList').html(html);
  }
};

/* ════════════════════════════════════════════════════════════════
   FORM MANAGER  (Single Responsibility: form read / validate / reset)
════════════════════════════════════════════════════════════════ */
const FormManager = {

  /** Uses the browser Constraint Validation API for the add form. */
  validateAdd() {
    const form = document.getElementById('employeeForm');
    if (!form.checkValidity()) {
      $('#employeeForm').addClass('was-validated');
      return false;
    }
    return true;
  },

  getAddData() {
    return {
      name  : $('#empName').val().trim(),
      email : $('#empEmail').val().trim().toLowerCase(),
      dept  : $('#empDept').val(),
      salary: parseFloat($('#empSalary').val()),
      date  : $('#empDate').val()
    };
  },

  resetAdd() {
    document.getElementById('employeeForm').reset();
    $('#employeeForm').removeClass('was-validated');
  },

  /** Simple manual validation for the edit modal fields. */
  validateEdit() {
    const email = $('#editEmail').val().trim();
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return (
      $('#editName').val().trim()   &&
      EMAIL_RE.test(email)          &&
      $('#editDept').val()          &&
      parseFloat($('#editSalary').val()) > 0 &&
      $('#editDate').val()
    );
  },

  getEditData() {
    return {
      name  : $('#editName').val().trim(),
      email : $('#editEmail').val().trim().toLowerCase(),
      dept  : $('#editDept').val(),
      salary: parseFloat($('#editSalary').val()),
      date  : $('#editDate').val()
    };
  },

  populateEdit(emp) {
    $('#editName').val(emp.name);
    $('#editEmail').val(emp.email);
    $('#editDept').val(emp.dept);
    $('#editSalary').val(emp.salary);
    $('#editDate').val(emp.date);
  }
};

/* ════════════════════════════════════════════════════════════════
   APP CONTROLLER  (Orchestrator — SOLID: Dependency Inversion)
   High-level policy depends on abstractions (module interfaces),
   not on concrete storage / DOM details.
════════════════════════════════════════════════════════════════ */
const App = {

  // ── Mutable view state ─────────────────────────────────────────
  state: {
    currentPage : 1,
    searchQuery : '',
    deptFilter  : '',
    hiddenCols  : new Set(), // Set of 1-based column indices (nth-child)
    editingId   : null
  },

  // ── Init ────────────────────────────────────────────────────────
  init() {
    EmployeeStore.load();
    ActivityLogger.render();
    this.refresh();
    this._bindEvents();
    ActivityLogger.push('system', '<strong>Dashboard</strong> initialized');
  },

  /**
   * Single refresh entry-point.
   * Principle: KISS — one call updates everything from current state.
   */
  refresh() {
    const employees = EmployeeStore.getAll();
    const stats     = EmployeeStore.getStats();

    TableRenderer.render({
      employees,
      page    : this.state.currentPage,
      perPage : CONFIG.ITEMS_PER_PAGE,
      query   : this.state.searchQuery,
      dept    : this.state.deptFilter
    });

    TableRenderer.applyColVisibility(this.state.hiddenCols);
    StatsRenderer.update(stats);
    ChartService.update(stats.deptCounts, stats.count);
    TopEarnersRenderer.update(employees);
  },

  // ── Event Binding ───────────────────────────────────────────────
  _bindEvents() {

    // ── Add employee form ──────────────────────────────────────────
    $('#employeeForm').on('submit', (e) => {
      e.preventDefault();
      this._addEmployee();
    });

    $('#resetBtn').on('click', () => FormManager.resetAdd());

    // ── Search with debounce (300 ms) ──────────────────────────────
    const handleSearch = Utils.debounce((val) => {
      this.state.searchQuery = val.toLowerCase().trim();
      this.state.currentPage = 1;
      this.refresh();
    });

    $('#searchInput').on('input', function () { handleSearch($(this).val()); });

    // ── Department filter ──────────────────────────────────────────
    $('#deptFilter').on('change', (e) => {
      this.state.deptFilter  = e.target.value;
      this.state.currentPage = 1;
      this.refresh();
    });

    // ── EVENT DELEGATION — table action buttons ────────────────────
    // Attached to a stable ancestor so dynamically added rows work.
    $(document).on('click', '.btn-edit', (e) => {
      this._openEditModal(+$(e.currentTarget).data('id'));
    });

    $(document).on('click', '.btn-delete', (e) => {
      const id = +$(e.currentTarget).data('id');
      AlertService.confirm(
        'Are you sure you want to delete this employee?',
        () => this._deleteEmployee(id)
      );
    });

    // ── EVENT DELEGATION — pagination links ────────────────────────
    $(document).on('click', '.page-link', (e) => {
      e.preventDefault();
      const $li = $(e.currentTarget).closest('.page-item');
      if ($li.hasClass('disabled') || $li.hasClass('active')) return;
      this.state.currentPage = +$(e.currentTarget).data('page');
      this.refresh();
    });

    // ── EVENT DELEGATION — toast close buttons ─────────────────────
    $(document).on('click', '.toast-close', function () {
      AlertService.dismiss($(this).data('id'));
    });

    // ── Column toggle (hide/show) ──────────────────────────────────
    $(document).on('change', '.col-toggle', (e) => {
      const col = +$(e.currentTarget).data('col');
      e.currentTarget.checked
        ? this.state.hiddenCols.delete(col)
        : this.state.hiddenCols.add(col);
      TableRenderer.applyColVisibility(this.state.hiddenCols);
    });

    // ── Edit modal save ────────────────────────────────────────────
    $('#saveEditBtn').on('click', () => this._saveEdit());

    // ── Export CSV ─────────────────────────────────────────────────
    $('#exportCsvBtn').on('click', () => this._exportCsv());
  },

  // ── Actions ─────────────────────────────────────────────────────

  _addEmployee() {
    if (!FormManager.validateAdd()) return;

    const data = FormManager.getAddData();

    // Business rule: no duplicate email addresses
    const duplicate = EmployeeStore.getAll().some(e => e.email === data.email);
    if (duplicate) {
      AlertService.toast('error', 'An employee with this email already exists.');
      return;
    }

    const emp = EmployeeStore.add(data); // appends to array
    this.state.currentPage = 1;
    this.refresh();
    FormManager.resetAdd();
    AlertService.toast('success', `${emp.name} added successfully.`);
    ActivityLogger.push(
      'add',
      `<strong>Admin</strong> added employee <strong>${Utils.escape(emp.name)}</strong>`
    );
  },

  _deleteEmployee(id) {
    const emp = EmployeeStore.getById(id);
    if (!emp) return;

    EmployeeStore.remove(id);

    // Clamp current page if we deleted the last item on it
    const remaining = EmployeeStore.getAll().length;
    const maxPage   = Math.max(1, Math.ceil(remaining / CONFIG.ITEMS_PER_PAGE));
    if (this.state.currentPage > maxPage) this.state.currentPage = maxPage;

    this.refresh();
    AlertService.toast('warning', `${emp.name} has been removed.`);
    ActivityLogger.push(
      'delete',
      `<strong>Admin</strong> deleted employee <strong>${Utils.escape(emp.name)}</strong>`
    );
  },

  _openEditModal(id) {
    const emp = EmployeeStore.getById(id);
    if (!emp) return;
    this.state.editingId = id;
    FormManager.populateEdit(emp);
    new bootstrap.Modal(document.getElementById('editModal')).show();
  },

  _saveEdit() {
    if (!FormManager.validateEdit()) {
      AlertService.toast('error', 'Please fill all fields correctly.');
      return;
    }

    const data    = FormManager.getEditData();
    const updated = EmployeeStore.update(this.state.editingId, data);
    if (!updated) return;

    bootstrap.Modal.getInstance(document.getElementById('editModal')).hide();
    this.state.editingId = null;
    this.refresh();
    AlertService.toast('success', `${updated.name} updated successfully.`);
    ActivityLogger.push(
      'edit',
      `<strong>Admin</strong> updated employee <strong>${Utils.escape(updated.name)}</strong>`
    );
  },

  _exportCsv() {
    const headers = ['ID', 'Name', 'Email', 'Department', 'Salary', 'Joining Date'];
    const rows    = EmployeeStore.getAll().map(e => [
      e.id, e.name, e.email, e.dept, e.salary, Utils.formatDisplayDate(e.date)
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a   = document.createElement('a');
    Object.assign(a, { href: url, download: 'employees.csv' });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    AlertService.toast('info', 'Employee list exported as CSV.');
    ActivityLogger.push('export', '<strong>Admin</strong> exported the employee report');
  }
};

/* ── Bootstrap ──────────────────────────────────────────────── */
$(document).ready(() => App.init());
