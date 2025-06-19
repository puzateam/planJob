// ===============================================================
// Planjob Frontend - v3.5 (Final UI & Auth Fixes)
// ===============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbzdMsyel5LsNiVmTpKj60CJC_ll-PqhFTOqp4xkaaxNgF1my6mBqQmrJ53K09gFrzIt/exec';

const AppState = { currentTeam: null, currentMember: null, currentRole: null, isLoggedIn: false, teamMembers: [], currentTasks: [], editingTaskId: null };

// --- DOM ELEMENTS ---
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const loginForm = document.getElementById('login-form');
const headerTeamName = document.getElementById('header-team-name');
const headerMemberName = document.getElementById('header-member-name');
const logoutBtn = document.getElementById('logout-btn');
const controlsBar = document.getElementById('controls-bar');
const themeSwitcher = document.getElementById('theme-switcher');
const manageUsersBtn = document.getElementById('manage-users-btn');
const taskList = document.getElementById('task-list');
const fabFooter = document.getElementById('fab-footer');
const addTaskBtn = document.getElementById('add-task-btn');
const taskForm = document.getElementById('task-form');
const taskDateInput = document.getElementById('task-date');
const taskModalTitle = document.getElementById('task-modal-title-label');
const addUserForm = document.getElementById('add-user-form');
const taskModal = new bootstrap.Modal(document.getElementById('task-modal'));
const manageUsersModal = new bootstrap.Modal(document.getElementById('manage-users-modal'));

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', initializeApp);
loginForm.addEventListener('submit', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
addTaskBtn.addEventListener('click', showAddTaskModal);
manageUsersBtn.addEventListener('click', showManageUsersModal);
taskForm.addEventListener('submit', handleSaveTask);
addUserForm.addEventListener('submit', handleAddMember);
document.querySelectorAll('#theme-switcher .theme-btn').forEach(btn => {
    btn.addEventListener('click', (e) => handleThemeChange(e.target.dataset.theme));
});

// --- INITIALIZATION & CORE WORKFLOW ---
function initializeApp() {
    checkLoginState(); // Check first to get team name
    const savedTheme = localStorage.getItem(`taskAppTheme_${AppState.currentTeam}`) || 'theme-green';
    applyTheme(savedTheme);

    if (AppState.isLoggedIn) {
        showLoader(`กำลังโหลดข้อมูลทีม ${AppState.currentTeam}...`);
        updateUI();
        populateTimeDropdown();
        fetchTasks();
    } else {
        updateUI();
    }
}

function checkLoginState() {
    const team = localStorage.getItem('taskAppTeam');
    const member = localStorage.getItem('taskAppMember');
    const role = localStorage.getItem('taskAppRole');
    if (team && member && role) {
        Object.assign(AppState, { currentTeam: team, currentMember: member, currentRole: role, isLoggedIn: true });
    } else {
        Object.assign(AppState, { currentTeam: null, currentMember: null, currentRole: null, isLoggedIn: false });
    }
}

async function handleLogin(event) {
    event.preventDefault();
    showLoader('กำลังเข้าสู่ระบบ...');
    const team_username = document.getElementById('team-username').value;
    const member_password = document.getElementById('member-password').value;
    const response = await fetchAPI('POST', { action: 'login', team_username, member_password });
    Swal.close();
    if (response?.status === 'success') {
        localStorage.setItem('taskAppTeam', response.team);
        localStorage.setItem('taskAppMember', response.member_name);
        localStorage.setItem('taskAppRole', response.role);
        localStorage.setItem(`taskAppTheme_${response.team}`, response.theme);
        initializeApp();
    } else {
        showError(response?.message || 'ข้อมูลไม่ถูกต้อง');
    }
}

function handleLogout() {
    localStorage.removeItem('taskAppTeam');
    localStorage.removeItem('taskAppMember');
    localStorage.removeItem('taskAppRole');
    window.location.reload();
}

// --- UI & DATA RENDERING ---
function updateUI() {
    if (AppState.isLoggedIn) {
        loginView.classList.add('d-none');
        appView.classList.remove('d-none');
        
        headerTeamName.textContent = `ทีม: ${AppState.currentTeam}`;
        headerMemberName.textContent = `(${AppState.currentMember})`;

        const canManageTasks = AppState.currentRole === 'director' || AppState.currentRole === 'officer';
        const canManageMembers = AppState.currentRole === 'director';

        fabFooter.classList.toggle('d-none', !canManageTasks);
        manageUsersBtn.classList.toggle('d-none', !canManageMembers);
        themeSwitcher.classList.toggle('d-none', !canManageMembers);

    } else {
        loginView.classList.remove('d-none');
        appView.classList.add('d-none');
    }
}

function renderTasks(tasks) {
    // ... (This function is unchanged from the previous final script)
    if (!tasks || tasks.length === 0) {
        taskList.innerHTML = '<p class="text-center text-muted mt-5">ไม่พบข้อมูลงาน</p>';
        return;
    }
    taskList.innerHTML = tasks.map(task => {
        const canEdit = AppState.currentRole === 'director' || (AppState.currentRole === 'officer' && AppState.currentMember === task.creator);
        const canDelete = canEdit;
        let actionsHtml = '';
        if (canEdit || canDelete) {
            const editBtn = canEdit ? `<button class="btn btn-sm btn-outline-warning" onclick="handleEditTask('${task.taskId}')" title="แก้ไขงาน"><i class="bi bi-pencil-square"></i></button>` : '';
            const deleteBtn = canDelete ? `<button class="btn btn-sm btn-outline-danger" onclick="handleDeleteTask('${task.taskId}')" title="ลบงาน"><i class="bi bi-trash"></i></button>` : '';
            actionsHtml = `<div class="task-actions">${editBtn}${deleteBtn}</div>`;
        }
        
        const cardColorClass = getTaskCardClass(task.date);
        return `
            <div class="card task-card mb-3 ${cardColorClass}">
                <div class="card-body">
                    ${actionsHtml}
                    <div class="d-flex justify-content-between">
                        <div class="pe-3">
                            <strong class="d-block">${task.date}</strong>
                            <span>${task.time} น.</span>
                        </div>
                        <div class="text-end">
                            <strong class="d-block">${task.taskName}</strong>
                            <span class="text-muted">${task.location || ''}</span>
                            <small class="d-block text-danger">ผู้ดำเนินการ: ${task.operator || 'N/A'}</small>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');
}


// --- TASK & MEMBER HANDLERS ---
async function fetchTasks() {
    const authData = { team: AppState.currentTeam, member_name: AppState.currentMember, role: AppState.currentRole };
    const response = await fetchAPI('POST', { action: 'getTasks', auth: authData });
    Swal.close();
    AppState.currentTasks = response?.status === 'success' ? response.data : [];
    renderTasks(AppState.currentTasks);
}

function showAddTaskModal() {
    AppState.editingTaskId = null;
    taskModalTitle.textContent = 'เพิ่มงานใหม่';
    taskForm.reset();
    taskDateInput.value = new Date().toISOString().split('T')[0];
    taskModal.show();
}

function handleEditTask(taskId) {
    const taskToEdit = AppState.currentTasks.find(t => t.taskId === taskId);
    if (taskToEdit) {
        AppState.editingTaskId = taskId;
        taskModalTitle.textContent = 'แก้ไขงาน';
        const dateParts = taskToEdit.date.split('/');
        const isoDate = `${parseInt(dateParts[2]) - 543}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
        taskForm['task-date'].value = isoDate;
        taskForm['task-time'].value = taskToEdit.time;
        taskForm['task-name'].value = taskToEdit.taskName;
        taskForm['task-location'].value = taskToEdit.location;
        taskForm['task-operator'].value = taskToEdit.operator;
        taskModal.show();
    }
}

async function handleSaveTask(event) {
    event.preventDefault();
    const payload = {
        date: taskDateInput.value,
        time: document.getElementById('task-time').value,
        taskName: taskForm['task-name'].value,
        location: taskForm['task-location'].value,
        operator: document.getElementById('task-operator').value,
    };
    let action = 'addTask';
    if (AppState.editingTaskId) {
        action = 'updateTask';
        payload.taskId = AppState.editingTaskId;
    }
    const authData = { team: AppState.currentTeam, member_name: AppState.currentMember, role: AppState.currentRole };
    showLoader('กำลังบันทึก...');
    const response = await fetchAPI('POST', { action, auth: authData, payload });
    Swal.close();
    if (response?.status === 'success') {
        taskModal.hide();
        showSuccess('บันทึกสำเร็จ!');
        fetchTasks();
    } else {
        showError(response?.message || 'เกิดข้อผิดพลาด');
    }
}

async function handleDeleteTask(taskId) {
    const result = await Swal.fire({ title: 'ยืนยันการลบ?', text: "คุณจะไม่สามารถกู้คืนข้อมูลนี้ได้!", icon: 'warning', showCancelButton: true, confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก' });
    if (result.isConfirmed) {
        showLoader('กำลังลบ...');
        const authData = { team: AppState.currentTeam, member_name: AppState.currentMember, role: AppState.currentRole };
        const response = await fetchAPI('POST', { action: 'deleteTask', auth: authData, payload: { taskId } });
        Swal.close();
        if (response?.status === 'success') {
            showSuccess('ลบข้อมูลสำเร็จ');
            fetchTasks();
        } else {
            showError(response?.message || 'เกิดข้อผิดพลาด');
        }
    }
}

async function showManageUsersModal() {
    showLoader('กำลังโหลดรายชื่อสมาชิก...');
    const authData = { team: AppState.currentTeam, member_name: AppState.currentMember, role: AppState.currentRole };
    const response = await fetchAPI('POST', { action: 'getMembers', auth: authData });
    Swal.close();
    if (response?.status === 'success') {
        AppState.teamMembers = response.data;
        populateUserManagementModal();
        manageUsersModal.show();
    } else {
        showError(response.message || 'ไม่สามารถโหลดข้อมูลสมาชิกได้');
    }
}

function populateUserManagementModal() {
    document.getElementById('user-list-table-container').innerHTML = `
        <table class="table table-striped table-hover align-middle">
            <thead><tr><th>ชื่อสมาชิก</th><th>บทบาท</th><th class="text-end">Action</th></tr></thead>
            <tbody>
                ${AppState.teamMembers.map(member => {
                    const isSelf = member.member_name === AppState.currentMember;
                    const canDelete = !isSelf && member.role !== 'director';
                    const actionButtonHtml = canDelete ? `<button class="btn btn-sm btn-danger" onclick="handleDeleteMember('${member.member_name}')">ลบ</button>` : '';
                    return `<tr>
                        <td>${member.member_name} ${isSelf ? '(คุณ)' : ''}</td>
                        <td><span class="badge bg-secondary">${member.role}</span></td>
                        <td class="text-end">${actionButtonHtml}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

async function handleAddMember(event) {
    event.preventDefault();
    const payload = {
        newMemberPassword: document.getElementById('new-member-password').value,
        newMemberName: document.getElementById('new-member-name').value,
        newMemberRole: document.getElementById('new-member-role').value,
    };
    showLoader('กำลังเพิ่มสมาชิก...');
    const authData = { team: AppState.currentTeam, member_name: AppState.currentMember, role: AppState.currentRole };
    const response = await fetchAPI('POST', { action: 'addMember', auth: authData, payload });
    Swal.close();
    if (response?.status === 'success') {
        showSuccess(response.message);
        addUserForm.reset();
        showManageUsersModal();
    } else {
        showError(response?.message || 'เกิดข้อผิดพลาด');
    }
}

async function handleDeleteMember(memberNameToDelete) {
    const result = await Swal.fire({ title: `ยืนยันการลบสมาชิก ${memberNameToDelete}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'ใช่, ลบ', cancelButtonText: 'ยกเลิก' });
    if (result.isConfirmed) {
        showLoader('กำลังลบ...');
        const authData = { team: AppState.currentTeam, member_name: AppState.currentMember, role: AppState.currentRole };
        const response = await fetchAPI('POST', { action: 'deleteMember', auth: authData, payload: { memberNameToDelete } });
        Swal.close();
        if (response?.status === 'success') {
            showSuccess(response.message);
            showManageUsersModal();
        } else {
            showError(response.message);
        }
    }
}

// --- UTILITY & THEME FUNCTIONS ---
function populateTimeDropdown() {
    const timeSelect = document.getElementById('task-time');
    timeSelect.innerHTML = '';
    for (let hour = 6; hour <= 18; hour++) {
        const timeString = hour.toString().padStart(2, '0') + ':00';
        timeSelect.innerHTML += `<option value="${timeString}">${timeString} น.</option>`;
    }
}

function getTaskCardClass(thaiDateString) {
    if (!thaiDateString) return '';
    try {
        const parts = thaiDateString.split('/');
        const taskDate = new Date(parseInt(parts[2]) - 543, parseInt(parts[1]) - 1, parseInt(parts[0]));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        if (taskDate < today) return 'task-card-overdue';
        if (taskDate.getTime() === today.getTime()) return 'task-card-today';
        if (taskDate.getTime() === tomorrow.getTime()) return 'task-card-warning';
        return '';
    } catch (e) { return ''; }
}

function handleThemeChange(themeClass) {
    applyTheme(themeClass);
    showLoader('กำลังบันทึกธีม...');
    const authData = { team: AppState.currentTeam, member_name: AppState.currentMember, role: AppState.currentRole };
    fetchAPI('POST', { action: 'updateTeamTheme', auth: authData, payload: { theme: themeClass } })
        .then(res => {
            Swal.close();
            if(res.status === 'success') {
                localStorage.setItem(`taskAppTheme_${AppState.currentTeam}`, themeClass);
            } else {
                showError('ไม่สามารถบันทึกธีมได้');
                const oldTheme = localStorage.getItem(`taskAppTheme_${AppState.currentTeam}`) || 'theme-green';
                applyTheme(oldTheme);
            }
        });
}

function applyTheme(themeClass) {
    document.body.className = themeClass;
    const newThemeColor = getComputedStyle(document.body).getPropertyValue('--bs-primary').trim();
    document.querySelector('meta[name="theme-color"]').setAttribute('content', newThemeColor);
}

async function fetchAPI(method, body = null) {
    try {
        let url = API_URL;
        const options = { method: 'POST', redirect: 'follow', muteHttpExceptions: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' } };
        options.body = JSON.stringify(body);
        const response = await fetch(url, options);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return { status: 'error', message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' };
    }
}

function showLoader(title = 'กำลังโหลด...') { Swal.fire({ title, allowOutsideClick: false, didOpen: () => Swal.showLoading() }); }
function showSuccess(title) { Swal.fire({ icon: 'success', title, showConfirmButton: false, timer: 1500 }); }
function showError(text) { Swal.fire({ icon: 'error', title: 'ผิดพลาด!', text }); }

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').then(reg => console.log('Service Worker: Registered')).catch(err => console.log(`Service Worker: Error: ${err}`));
    });
}
