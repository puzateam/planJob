// !!! สำคัญ: แก้ไข URL นี้เป็น Web App URL ของคุณ !!!
const API_URL = 'https://script.google.com/macros/s/AKfycbx1K5nqqUOiXBkn_fJpl0emv7810veZJB0fvISaMJAq7xDoWKrrw_aqQFwGaaUBse0L6w/exec';

const AppState = { currentUser: null, currentRole: null, isLoggedIn: false, allUsers: [], currentTasks: [], editingTaskId: null };
// DOM Elements
const userFilterDropdown = document.getElementById('user-filter-dropdown');
const statusBar = document.getElementById('status-bar');
const statusBarText = document.getElementById('status-bar-text');
const loginBtn = document.getElementById('login-btn');
const manageUsersBtn = document.getElementById('manage-users-btn');
const logoutBtn = document.getElementById('logout-btn');
const taskList = document.getElementById('task-list');
const fabFooter = document.getElementById('fab-footer');
const addTaskBtn = document.getElementById('add-task-btn');
const taskForm = document.getElementById('task-form');
const taskDateInput = document.getElementById('task-date');
const taskModalTitle = document.getElementById('task-modal-title-label');
// Modals
const taskModal = new bootstrap.Modal(document.getElementById('task-modal'));
const manageUsersModal = new bootstrap.Modal(document.getElementById('manage-users-modal'));

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeApp);
userFilterDropdown.addEventListener('change', (e) => {
    if (e.target.value) { fetchTasks(e.target.value); }
});
loginBtn.addEventListener('click', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
addTaskBtn.addEventListener('click', () => {
    AppState.editingTaskId = null;
    taskModalTitle.textContent = 'เพิ่มงานใหม่';
    taskForm.reset();
    taskDateInput.value = new Date().toISOString().split('T')[0];
    taskModal.show();
});
manageUsersBtn.addEventListener('click', () => {
    populateUserManagementModal();
    manageUsersModal.show();
});
taskForm.addEventListener('submit', handleSaveTask);
document.getElementById('add-user-form').addEventListener('submit', handleAddUser);

async function initializeApp() {
    showLoader('กำลังเริ่มต้นระบบ...');
    checkLoginState();
    populateTimeDropdown();
    await fetchAndPopulateUsers();
    taskList.innerHTML = '<p class="text-center text-muted mt-5">กรุณาเลือกผู้ใช้จากเมนูด้านบนเพื่อดูตารางงาน</p>';
    if (AppState.isLoggedIn) {
        userFilterDropdown.value = AppState.currentUser;
        if(userFilterDropdown.value) await fetchTasks(AppState.currentUser);
    }
    updateUI();
    Swal.close();
}

function populateTimeDropdown() {
    const timeSelect = document.getElementById('task-time');
    timeSelect.innerHTML = '';
    for (let hour = 6; hour <= 18; hour++) {
        const timeString = hour.toString().padStart(2, '0') + ':00';
        timeSelect.innerHTML += `<option value="${timeString}">${timeString} น.</option>`;
    }
}

async function fetchTasks(owner) {
    if (!owner) return;
    showLoader('กำลังโหลดข้อมูลงาน...');
    const response = await fetchAPI(`GET?owner=${owner}`);
    Swal.close();
    AppState.currentTasks = response?.status === 'success' ? response.data : [];
    renderTasks(AppState.currentTasks);
}

function checkLoginState() {
    const user = localStorage.getItem('taskAppUser');
    const role = localStorage.getItem('taskAppRole');
    if (user && role) { Object.assign(AppState, { currentUser: user, currentRole: role, isLoggedIn: true }); }
}

async function fetchAndPopulateUsers() {
    const response = await fetchAPI('POST', { action: 'getUsers' });
    if (response?.status === 'success') {
        AppState.allUsers = response.data;
        const currentSelection = userFilterDropdown.value;
        userFilterDropdown.innerHTML = '<option value="" selected disabled>--- เลือกผู้ใช้ ---</option>';
        AppState.allUsers.forEach(user => {
            if (user.username) { userFilterDropdown.innerHTML += `<option value="${user.username}">${user.username}</option>`; }
        });
        userFilterDropdown.value = currentSelection;
    }
}

/**
 * ** NEW HELPER FUNCTION **
 * Determines the CSS class for the task card based on its date.
 * @param {string} dateString - The date of the task in 'YYYY-MM-DD' format.
 * @returns {string} The CSS class name for coloring.
 */
function getTaskCardClass(dateString) {
    if (!dateString) return '';

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to the start of the day

    const taskDate = new Date(dateString);
    taskDate.setHours(0, 0, 0, 0); // Normalize task date

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (taskDate < today) {
        return 'task-card-overdue'; // Overdue
    } else if (taskDate.getTime() === today.getTime()) {
        return 'task-card-today'; // Today
    } else if (taskDate.getTime() === tomorrow.getTime()) {
        return 'task-card-warning'; // Tomorrow (1 day before)
    }
    return ''; // Default for future tasks
}


function renderTasks(tasks) {
    if (tasks.length === 0) {
        taskList.innerHTML = '<p class="text-center text-muted mt-5">ไม่พบข้อมูลงาน</p>';
        return;
    }
    taskList.innerHTML = tasks.map(task => {
        const canManage = AppState.isLoggedIn && (AppState.currentRole === 'admin' || AppState.currentUser === task.owner);
        const actionsHtml = canManage ?
            `<div class="task-actions">
                <button class="btn btn-sm btn-outline-warning" onclick="handleEditTask('${task.taskId}')" title="แก้ไขงาน"><i class="bi bi-pencil-square"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="handleDeleteTask('${task.taskId}')" title="ลบงาน"><i class="bi bi-trash"></i></button>
            </div>` : '';
        
        const formattedDate = (dateString) => {
            if (!dateString || !dateString.includes('-')) return dateString;
            try {
                const parts = dateString.split('-');
                const year = parseInt(parts[0]) + 543;
                return `${parts[2]}/${parts[1]}/${year}`;
            } catch (e) { return dateString; }
        };

        // ** UPDATED **: Add the dynamic color class to the card
        const cardColorClass = getTaskCardClass(task.date);

        return `
            <div class="card task-card mb-3 ${cardColorClass}">
                <div class="card-body">
                    ${actionsHtml}
                    <div class="d-flex justify-content-between">
                        <div class="pe-3">
                            <strong class="d-block">${formattedDate(task.date)}</strong>
                            <span>${task.time} น.</span>
                        </div>
                        <div class="text-end">
                            <strong class="d-block">${task.taskName}</strong>
                            <span class="text-muted">${task.location || ''}</span>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function updateUI() {
    const loggedIn = AppState.isLoggedIn;
    
    // Header controls
    loginBtn.classList.toggle('d-none', loggedIn);
    userFilterDropdown.parentElement.style.visibility = loggedIn ? 'hidden' : 'visible';

    // Status Bar and FAB
    statusBar.classList.toggle('d-none', !loggedIn);
    fabFooter.classList.toggle('d-none', !loggedIn);
    
    if (loggedIn) {
        statusBarText.textContent = `ตารางงานของ ${AppState.currentUser}`;
        manageUsersBtn.classList.toggle('d-none', AppState.currentRole !== 'admin');
    }
}

async function handleLogin() {
    const { value: formValues } = await Swal.fire({ title: 'เข้าสู่ระบบ', html: `<input id="swal-input1" class="swal2-input" placeholder="ชื่อผู้ใช้" required><input id="swal-input2" type="password" class="swal2-input" placeholder="รหัสผ่าน" required>`, focusConfirm: false, confirmButtonText: 'เข้าสู่ระบบ', showCancelButton: true, cancelButtonText: 'ยกเลิก', preConfirm: () => { const u = document.getElementById('swal-input1').value; const p = document.getElementById('swal-input2').value; if (!u || !p) Swal.showValidationMessage('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'); return [u, p]; } });
    if (formValues) {
        showLoader('กำลังตรวจสอบ...');
        const [username, password] = formValues;
        const response = await fetchAPI('POST', { action: 'login', username, password });
        Swal.close();
        if (response?.status === 'success') {
            localStorage.setItem('taskAppUser', response.username);
            localStorage.setItem('taskAppRole', response.role);
            checkLoginState();
            await fetchAndPopulateUsers();
            updateUI();
            userFilterDropdown.value = response.username;
            if(userFilterDropdown.value) fetchTasks(response.username);
        } else { showError(response?.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'); }
    }
}

function handleLogout() {
    localStorage.removeItem('taskAppUser');
    localStorage.removeItem('taskAppRole');
    window.location.reload();
}

function handleEditTask(taskId) {
    const taskToEdit = AppState.currentTasks.find(t => t.taskId === taskId);
    if (taskToEdit) {
        AppState.editingTaskId = taskId;
        taskModalTitle.textContent = 'แก้ไขงาน';
        taskForm['task-date'].value = taskToEdit.date;
        taskForm['task-time'].value = taskToEdit.time;
        taskForm['task-name'].value = taskToEdit.taskName;
        taskForm['task-location'].value = taskToEdit.location;
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
    };
    let action = 'addTask';
    if (AppState.editingTaskId) {
        action = 'updateTask';
        payload.taskId = AppState.editingTaskId;
    } else {
        payload.owner = AppState.currentUser;
    }
    showLoader('กำลังบันทึก...');
    const authData = { username: AppState.currentUser, role: AppState.currentRole };
    const response = await fetchAPI('POST', { action, auth: authData, payload });
    Swal.close();
    if (response?.status === 'success') {
        taskModal.hide();
        showSuccess('บันทึกสำเร็จ!');
        fetchTasks(AppState.currentUser);
    } else {
        showError(response?.message || 'เกิดข้อผิดพลาด');
    }
}

async function handleDeleteTask(taskId) {
    const result = await Swal.fire({ title: 'ยืนยันการลบ?', text: "คุณจะไม่สามารถกู้คืนข้อมูลนี้ได้!", icon: 'warning', showCancelButton: true, confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก' });
    if (result.isConfirmed) {
        showLoader('กำลังลบ...');
        const authData = { username: AppState.currentUser, role: AppState.currentRole };
        const response = await fetchAPI('POST', { action: 'deleteTask', auth: authData, payload: { taskId } });
        Swal.close();
        if (response?.status === 'success') {
            showSuccess('ลบข้อมูลสำเร็จ');
            fetchTasks(AppState.currentUser);
        } else {
            showError(response?.message || 'เกิดข้อผิดพลาด');
        }
    }
}

function populateUserManagementModal() {
    document.getElementById('user-list-table-container').innerHTML = `
        <table class="table table-striped table-hover align-middle">
            <thead><tr><th>Username</th><th>Role</th><th class="text-end">Action</th></tr></thead>
            <tbody>
                ${AppState.allUsers.map(user => {
                    if (!user.username) return '';
                    const roleDisplayHtml = user.username === 'admin'
                        ? `<span class="badge bg-success">admin</span>`
                        : `<select class="form-select form-select-sm" onchange="handleRoleChange('${user.username}', this.value)">
                               <option value="general" ${user.role === 'general' ? 'selected' : ''}>General</option>
                               <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                           </select>`;
                    const actionButtonHtml = user.username !== 'admin'
                        ? `<button class="btn btn-sm btn-danger" onclick="handleDeleteUser('${user.username}')">ลบ</button>`
                        : '';
                    return `<tr><td>${user.username}</td><td>${roleDisplayHtml}</td><td class="text-end">${actionButtonHtml}</td></tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

async function handleAddUser(event) {
    event.preventDefault();
    const payload = {
        newUsername: document.getElementById('new-username').value,
        newPassword: document.getElementById('new-password').value,
        newRole: document.getElementById('new-role').value,
    };
    showLoader('กำลังเพิ่มผู้ใช้...');
    const authData = { username: AppState.currentUser, role: AppState.currentRole };
    const response = await fetchAPI('POST', { action: 'addUser', auth: authData, payload });
    Swal.close();
    if (response?.status === 'success') {
        showSuccess(response.message);
        document.getElementById('add-user-form').reset();
        await fetchAndPopulateUsers();
        populateUserManagementModal();
    } else {
        showError(response?.message || 'เกิดข้อผิดพลาด');
    }
}

async function handleDeleteUser(usernameToDelete) {
    const result = await Swal.fire({ title: `ยืนยันการลบผู้ใช้ ${usernameToDelete}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'ใช่, ลบ', cancelButtonText: 'ยกเลิก' });
    if (result.isConfirmed) {
        showLoader('กำลังลบ...');
        const authData = { username: AppState.currentUser, role: AppState.currentRole };
        const response = await fetchAPI('POST', { action: 'deleteUser', auth: authData, payload: { usernameToDelete } });
        Swal.close();
        if (response?.status === 'success') {
            showSuccess(response.message);
            await fetchAndPopulateUsers();
            populateUserManagementModal();
        } else { showError(response.message); }
    }
}

async function handleRoleChange(usernameToUpdate, newRole) {
    showLoader('กำลังอัปเดตสิทธิ์...');
    const authData = { username: AppState.currentUser, role: AppState.currentRole };
    const response = await fetchAPI('POST', { action: 'updateUserRole', auth: authData, payload: { usernameToUpdate, newRole } });
    Swal.close();
    if (response?.status === 'success') {
        showSuccess('อัปเดตสิทธิ์สำเร็จ!');
        const userInState = AppState.allUsers.find(u => u.username === usernameToUpdate);
        if (userInState) userInState.role = newRole;
    } else {
        showError(response?.message || 'เกิดข้อผิดพลาดในการอัปเดต');
        populateUserManagementModal();
    }
}

async function fetchAPI(method, body = null) {
    try {
        let url = API_URL;
        const options = { method: 'POST', redirect: 'follow', muteHttpExceptions: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' } };
        if (method.startsWith('GET')) {
            url += method.substring(3);
            const res = await fetch(url);
            return await res.json();
        } else { options.body = JSON.stringify(body); }
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
