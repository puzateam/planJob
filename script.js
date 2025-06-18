// !!! สำคัญ: แก้ไข URL นี้เป็น Web App URL ของคุณ !!!
const API_URL = 'YOUR_WEB_APP_URL_HERE';

// --- State Management ---
const AppState = {
    currentUser: null,
    currentRole: null,
    isLoggedIn: false,
    allUsers: [],
};

// --- DOM Elements ---
const userFilterDropdown = document.getElementById('user-filter-dropdown');
const loggedInControls = document.getElementById('logged-in-controls');
const loginBtn = document.getElementById('login-btn');
const manageUsersBtn = document.getElementById('manage-users-btn');
const userDisplay = document.getElementById('user-display');
const logoutBtn = document.getElementById('logout-btn');
const taskList = document.getElementById('task-list');
const fabFooter = document.getElementById('fab-footer');
const addTaskBtn = document.getElementById('add-task-btn');
const taskForm = document.getElementById('task-form');
const taskDateInput = document.getElementById('task-date');

// --- Modals ---
const taskModal = new bootstrap.Modal(document.getElementById('task-modal'));
const manageUsersModal = new bootstrap.Modal(document.getElementById('manage-users-modal'));

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', initializeApp);
userFilterDropdown.addEventListener('change', (e) => fetchTasks(e.target.value));
loginBtn.addEventListener('click', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
addTaskBtn.addEventListener('click', () => {
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

// --- Initialization ---
async function initializeApp() {
    showLoader('กำลังเริ่มต้นระบบ...');
    checkLoginState(); // Check for existing login session
    await fetchAndPopulateUsers(); // Get all users for the dropdown
    await fetchTasks(userFilterDropdown.value); // Fetch all tasks initially
    updateUI();
    Swal.close();
}

// --- Core Logic ---
function checkLoginState() {
    const user = localStorage.getItem('taskAppUser');
    const role = localStorage.getItem('taskAppRole');
    if (user && role) {
        AppState.currentUser = user;
        AppState.currentRole = role;
        AppState.isLoggedIn = true;
    }
}

async function fetchAndPopulateUsers() {
    const response = await fetchAPI('POST', { action: 'getUsers' });
    if (response && response.status === 'success') {
        AppState.allUsers = response.data;
        userFilterDropdown.innerHTML = '<option value="all">ดูทั้งหมด</option>';
        AppState.allUsers.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.username;
            userFilterDropdown.appendChild(option);
        });
    }
}

async function fetchTasks(owner = 'all') {
    showLoader('กำลังโหลดข้อมูลงาน...');
    const response = await fetchAPI(`GET?owner=${owner}`);
    Swal.close();
    if (response && response.status === 'success') {
        renderTasks(response.data);
    } else {
        showError('ไม่สามารถโหลดข้อมูลได้');
        taskList.innerHTML = '<p class="text-center text-muted mt-5">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
    }
}

function renderTasks(tasks) {
    taskList.innerHTML = '';
    if (tasks.length === 0) {
        taskList.innerHTML = '<p class="text-center text-muted mt-5">ไม่พบข้อมูลงาน</p>';
        return;
    }
    tasks.forEach(task => {
        const [thaiDate, thaiYear] = formatThaiDate(task.date);
        const card = document.createElement('div');
        card.className = 'card task-card mb-3';
        card.dataset.taskId = task.taskId;
        card.dataset.owner = task.owner;

        const canManage = AppState.isLoggedIn && (AppState.currentRole === 'admin' || AppState.currentUser === task.owner);
        const actionsHtml = canManage ? `
            <div class="task-actions">
                <button class="btn btn-sm btn-outline-danger" onclick="handleDeleteTask('${task.taskId}')" title="ลบงาน"><i class="bi bi-trash"></i></button>
            </div>
        ` : '';

        card.innerHTML = `
            <div class="card-body">
                ${actionsHtml}
                <div class="d-flex justify-content-between">
                    <div class="pe-3">
                        <strong class="d-block">${thaiDate} ${thaiYear}</strong>
                        <span class="text-muted">${task.time} น.</span>
                    </div>
                    <div class="text-end">
                        <strong class="d-block">${task.taskName}</strong>
                        <span class="text-muted">${task.owner === 'admin' ? '' : '@'}${task.owner} | ${task.location}</span>
                    </div>
                </div>
            </div>
        `;
        taskList.appendChild(card);
    });
}

function updateUI() {
    if (AppState.isLoggedIn) {
        loggedInControls.classList.remove('d-none');
        loginBtn.classList.add('d-none');
        fabFooter.classList.remove('d-none');
        userDisplay.textContent = `${AppState.currentUser} (${AppState.currentRole})`;
        document.getElementById('user-filter-section').style.visibility = 'hidden';
        if (AppState.currentRole === 'admin') {
            manageUsersBtn.classList.remove('d-none');
        }
    } else {
        loggedInControls.classList.add('d-none');
        loginBtn.classList.remove('d-none');
        fabFooter.classList.add('d-none');
        manageUsersBtn.classList.add('d-none');
        document.getElementById('user-filter-section').style.visibility = 'visible';
    }
}

// --- Handlers ---
async function handleLogin() {
    const { value: formValues } = await Swal.fire({
        title: 'เข้าสู่ระบบ',
        html:
            '<input id="swal-input1" class="swal2-input" placeholder="ชื่อผู้ใช้" required>' +
            '<input id="swal-input2" type="password" class="swal2-input" placeholder="รหัสผ่าน" required>',
        focusConfirm: false,
        confirmButtonText: 'เข้าสู่ระบบ',
        showCancelButton: true,
        cancelButtonText: 'ยกเลิก',
        preConfirm: () => {
            const username = document.getElementById('swal-input1').value;
            const password = document.getElementById('swal-input2').value;
            if (!username || !password) {
                Swal.showValidationMessage('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
            }
            return [username, password];
        }
    });

    if (formValues) {
        const [username, password] = formValues;
        showLoader('กำลังตรวจสอบ...');
        const response = await fetchAPI('POST', { action: 'login', username, password });
        Swal.close();
        if (response && response.status === 'success') {
            localStorage.setItem('taskAppUser', response.username);
            localStorage.setItem('taskAppRole', response.role);
            checkLoginState();
            updateUI();
            fetchTasks(AppState.currentRole === 'admin' ? 'all' : AppState.currentUser);
        } else {
            showError(response.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        }
    }
}

function handleLogout() {
    localStorage.removeItem('taskAppUser');
    localStorage.removeItem('taskAppRole');
    window.location.reload();
}

async function handleSaveTask(event) {
    event.preventDefault();
    const payload = {
        owner: AppState.currentUser,
        date: taskDateInput.value,
        time: taskForm['task-time'].value,
        taskName: taskForm['task-name'].value,
        location: taskForm['task-location'].value,
    };
    showLoader('กำลังบันทึก...');
    const response = await fetchAPI('POST', { action: 'addTask', auth: { username: AppState.currentUser, role: AppState.currentRole }, payload });
    Swal.close();
    if (response && response.status === 'success') {
        taskModal.hide();
        showSuccess('บันทึกสำเร็จ!');
        fetchTasks(AppState.currentRole === 'admin' ? 'all' : AppState.currentUser);
    } else {
        showError(response.message || 'เกิดข้อผิดพลาด');
    }
}

async function handleDeleteTask(taskId) {
    const result = await Swal.fire({
        title: 'ยืนยันการลบ?', text: "คุณจะไม่สามารถกู้คืนข้อมูลนี้ได้!", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
        confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก'
    });
    if (result.isConfirmed) {
        showLoader('กำลังลบ...');
        const response = await fetchAPI('POST', { action: 'deleteTask', auth: { username: AppState.currentUser, role: AppState.currentRole }, payload: { taskId } });
        Swal.close();
        if (response && response.status === 'success') {
            showSuccess('ลบข้อมูลสำเร็จ');
            const currentFilter = AppState.isLoggedIn ? (AppState.currentRole === 'admin' ? 'all' : AppState.currentUser) : userFilterDropdown.value;
            fetchTasks(currentFilter);
        } else {
            showError(response.message || 'เกิดข้อผิดพลาด');
        }
    }
}

// --- Admin Handlers ---
function populateUserManagementModal() {
    const container = document.getElementById('user-list-table-container');
    container.innerHTML = `
        <table class="table table-striped table-hover">
            <thead><tr><th>Username</th><th>Role</th><th>Action</th></tr></thead>
            <tbody>
                ${AppState.allUsers.map(user => `
                    <tr>
                        <td>${user.username}</td>
                        <td><span class="badge bg-${user.role === 'admin' ? 'success' : 'secondary'}">${user.role}</span></td>
                        <td>
                            ${user.username !== 'admin' ? `<button class="btn btn-sm btn-danger" onclick="handleDeleteUser('${user.username}')">ลบ</button>` : ''}
                        </td>
                    </tr>
                `).join('')}
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
    const response = await fetchAPI('POST', { action: 'addUser', auth: { username: AppState.currentUser, role: AppState.currentRole }, payload });
    Swal.close();
    if (response && response.status === 'success') {
        showSuccess(response.message);
        document.getElementById('add-user-form').reset();
        await fetchAndPopulateUsers();
        populateUserManagementModal();
    } else {
        showError(response.message || 'เกิดข้อผิดพลาด');
    }
}

async function handleDeleteUser(usernameToDelete) {
     const result = await Swal.fire({ title: `ยืนยันการลบผู้ใช้ ${usernameToDelete}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'ใช่, ลบ', cancelButtonText: 'ยกเลิก' });
     if (result.isConfirmed) {
        showLoader('กำลังลบ...');
        const response = await fetchAPI('POST', { action: 'deleteUser', auth: { username: AppState.currentUser, role: AppState.currentRole }, payload: { usernameToDelete } });
        Swal.close();
        if (response.status === 'success') {
            showSuccess(response.message);
            await fetchAndPopulateUsers();
            populateUserManagementModal();
        } else {
            showError(response.message);
        }
     }
}

// --- Helper Functions ---
async function fetchAPI(method, body = null) {
    try {
        let url = API_URL;
        const options = {
            method: 'POST', redirect: 'follow', muteHttpExceptions: true,
            headers: {'Content-Type': 'text/plain;charset=utf-8'},
        };
        if (method.startsWith('GET')) {
            url += method.substring(3);
            const res = await fetch(url);
            return await res.json();
        } else {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(url, options);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return { status: 'error', message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' };
    }
}

function formatThaiDate(dateString) {
    const date = new Date(dateString);
    const thaiYear = date.getFullYear() + 543;
    const options = { day: 'numeric', month: 'short' };
    return [date.toLocaleDateString('th-TH', options), thaiYear];
}

function showLoader(title = 'กำลังโหลด...') { Swal.fire({ title, allowOutsideClick: false, didOpen: () => Swal.showLoading() }); }
function showSuccess(title) { Swal.fire({ icon: 'success', title, showConfirmButton: false, timer: 1500 }); }
function showError(text) { Swal.fire({ icon: 'error', title: 'ผิดพลาด!', text }); }

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker: Registered'))
            .catch(err => console.log(`Service Worker: Error: ${err}`));
    });
}
