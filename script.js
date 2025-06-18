// !!! สำคัญ: แก้ไข URL นี้เป็น Web App URL ของคุณ !!!
const API_URL = 'YOUR_WEB_APP_URL_HERE';

const AppState = { currentUser: null, currentRole: null, isLoggedIn: false, allUsers: [] };
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
const taskModal = new bootstrap.Modal(document.getElementById('task-modal'));
const manageUsersModal = new bootstrap.Modal(document.getElementById('manage-users-modal'));

document.addEventListener('DOMContentLoaded', initializeApp);
userFilterDropdown.addEventListener('change', (e) => e.target.value && fetchTasks(e.target.value));
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

async function initializeApp() {
    showLoader('กำลังเริ่มต้นระบบ...');
    checkLoginState();
    populateTimeDropdown();
    await fetchAndPopulateUsers();
    taskList.innerHTML = '<p class="text-center text-muted mt-5">กรุณาเลือกผู้ใช้จากเมนูด้านบนเพื่อดูตารางงาน</p>';
    if (AppState.isLoggedIn) {
        const initialUser = AppState.currentRole === 'admin' ? 'all' : AppState.currentUser;
        userFilterDropdown.value = initialUser;
        if(userFilterDropdown.value) await fetchTasks(initialUser);
    }
    updateUI();
    Swal.close();
}

function populateTimeDropdown() {
    const timeSelect = document.getElementById('task-time');
    timeSelect.innerHTML = '';
    for (let hour = 6; hour <= 18; hour++) {
        const timeString = hour.toString().padStart(2, '0') + ':00';
        const option = document.createElement('option');
        option.value = timeString;
        option.textContent = timeString + ' น.';
        timeSelect.appendChild(option);
    }
}

function checkLoginState() {
    const user = localStorage.getItem('taskAppUser');
    const role = localStorage.getItem('taskAppRole');
    if (user && role) {
        Object.assign(AppState, { currentUser: user, currentRole: role, isLoggedIn: true });
    }
}

async function fetchAndPopulateUsers() {
    const response = await fetchAPI('POST', { action: 'getUsers' });
    if (response?.status === 'success') {
        AppState.allUsers = response.data;
        const currentSelection = userFilterDropdown.value;
        userFilterDropdown.innerHTML = '<option value="" selected disabled>--- เลือกผู้ใช้ ---</option>';
        if (AppState.isLoggedIn && AppState.currentRole === 'admin') {
            userFilterDropdown.innerHTML += '<option value="all">ดูทั้งหมด</option>';
        }
        AppState.allUsers.forEach(user => {
            if (user.username) {
                userFilterDropdown.innerHTML += `<option value="${user.username}">${user.username}</option>`;
            }
        });
        userFilterDropdown.value = currentSelection;
    }
}

async function fetchTasks(owner) {
    if (!owner) return;
    showLoader('กำลังโหลดข้อมูลงาน...');
    const response = await fetchAPI(`GET?owner=${owner}`);
    Swal.close();
    renderTasks(response?.status === 'success' ? response.data : []);
}

function renderTasks(tasks) {
    if (tasks.length === 0) {
        taskList.innerHTML = '<p class="text-center text-muted mt-5">ไม่พบข้อมูลงาน</p>';
        return;
    }
    taskList.innerHTML = tasks.map(task => {
        const canManage = AppState.isLoggedIn && (AppState.currentRole === 'admin' || AppState.currentUser === task.owner);
        const actionsHtml = canManage ? `
            <div class="task-actions">
                <button class="btn btn-sm btn-outline-danger" onclick="handleDeleteTask('${task.taskId}')" title="ลบงาน"><i class="bi bi-trash"></i></button>
            </div>` : '';
        return `
            <div class="card task-card mb-3">
                <div class="card-body">
                    ${actionsHtml}
                    <div class="d-flex justify-content-between">
                        <div class="pe-3">
                            <strong class="d-block">${task.date}</strong>
                            <span>${task.time} น.</span>
                        </div>
                        <div class="text-end">
                            <strong class="d-block">${task.taskName}</strong>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function updateUI() {
    const loggedIn = AppState.isLoggedIn;
    loggedInControls.classList.toggle('d-none', !loggedIn);
    loginBtn.classList.toggle('d-none', loggedIn);
    fabFooter.classList.toggle('d-none', !loggedIn);
    userFilterDropdown.parentElement.style.visibility = (loggedIn && AppState.currentRole !== 'admin') ? 'hidden' : 'visible';
    if (loggedIn) {
        userDisplay.textContent = `${AppState.currentUser} (${AppState.currentRole})`;
        manageUsersBtn.classList.toggle('d-none', AppState.currentRole !== 'admin');
    }
}

async function handleLogin() {
    const { value: formValues } = await Swal.fire({
        title: 'เข้าสู่ระบบ',
        html: `<input id="swal-input1" class="swal2-input" placeholder="ชื่อผู้ใช้" required>
               <input id="swal-input2" type="password" class="swal2-input" placeholder="รหัสผ่าน" required>`,
        focusConfirm: false, confirmButtonText: 'เข้าสู่ระบบ', showCancelButton: true, cancelButtonText: 'ยกเลิก',
        preConfirm: () => {
            const u = document.getElementById('swal-input1').value, p = document.getElementById('swal-input2').value;
            if (!u || !p) Swal.showValidationMessage('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
            return [u, p];
        }
    });
    if (formValues) {
        showLoader('กำลังตรวจสอบ...');
        const [username, password] = formValues;
        const response = await fetchAPI('POST', { action: 'login', username, password });
        Swal.close();
        if (response?.status === 'success') {
            localStorage.setItem('taskAppUser', response.username);
            localStorage.setItem('taskAppRole', response.role);
            checkLoginState();
            await fetchAndPopulateUsers(); // Re-populate to add "All" option for admin
            updateUI();
            const initialUser = response.role === 'admin' ? 'all' : response.username;
            userFilterDropdown.value = initialUser;
            fetchTasks(initialUser);
        } else {
            showError(response?.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
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
        time: document.getElementById('task-time').value,
        taskName: taskForm['task-name'].value,
        location: taskForm['task-location'].value,
    };
    showLoader('กำลังบันทึก...');
    const response = await fetchAPI('POST', { action: 'addTask', auth: AppState, payload });
    Swal.close();
    if (response?.status === 'success') {
        taskModal.hide();
        showSuccess('บันทึกสำเร็จ!');
        fetchTasks(userFilterDropdown.value);
    } else {
        showError(response?.message || 'เกิดข้อผิดพลาด');
    }
}

async function handleDeleteTask(taskId) {
    const result = await Swal.fire({ title: 'ยืนยันการลบ?', text: "คุณจะไม่สามารถกู้คืนข้อมูลนี้ได้!", icon: 'warning', showCancelButton: true, confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก' });
    if (result.isConfirmed) {
        showLoader('กำลังลบ...');
        const response = await fetchAPI('POST', { action: 'deleteTask', auth: AppState, payload: { taskId } });
        Swal.close();
        if (response?.status === 'success') {
            showSuccess('ลบข้อมูลสำเร็จ');
            fetchTasks(userFilterDropdown.value);
        } else {
            showError(response?.message || 'เกิดข้อผิดพลาด');
        }
    }
}

function populateUserManagementModal() {
    document.getElementById('user-list-table-container').innerHTML = `
        <table class="table table-striped table-hover">
            <thead><tr><th>Username</th><th>Role</th><th>Action</th></tr></thead>
            <tbody>
                ${AppState.allUsers.map(user => `
                    <tr>
                        <td>${user.username}</td>
                        <td><span class="badge bg-${user.role === 'admin' ? 'success' : 'secondary'}">${user.role}</span></td>
                        <td>${user.username !== 'admin' ? `<button class="btn btn-sm btn-danger" onclick="handleDeleteUser('${user.username}')">ลบ</button>` : ''}</td>
                    </tr>`).join('')}
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
    const response = await fetchAPI('POST', { action: 'addUser', auth: AppState, payload });
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
        const response = await fetchAPI('POST', { action: 'deleteUser', auth: AppState, payload: { usernameToDelete } });
        Swal.close();
        if (response?.status === 'success') {
            showSuccess(response.message);
            await fetchAndPopulateUsers();
            populateUserManagementModal();
        } else {
            showError(response.message);
        }
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

function showLoader(title = 'กำลังโหลด...') { Swal.fire({ title, allowOutsideClick: false, didOpen: () => Swal.showLoading() }); }
function showSuccess(title) { Swal.fire({ icon: 'success', title, showConfirmButton: false, timer: 1500 }); }
function showError(text) { Swal.fire({ icon: 'error', title: 'ผิดพลาด!', text }); }

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').then(reg => console.log('Service Worker: Registered')).catch(err => console.log(`Service Worker: Error: ${err}`));
    });
}
