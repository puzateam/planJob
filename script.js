// ===============================================================
// Planjob Frontend - v2.0 (Team Model - Phase 2 Logic)
// ===============================================================

// !!! สำคัญ: แก้ไข URL นี้เป็น Web App URL ของคุณ !!!
const API_URL = 'https://script.google.com/macros/s/AKfycbx1K5nqqUOiXBkn_fJpl0emv7810veZJB0fvISaMJAq7xDoWKrrw_aqQFwGaaUBse0L6w/exec';

// --- 1. STATE MANAGEMENT (Updated for Team Model) ---
const AppState = {
    currentTeam: null,
    currentMember: null,
    currentRole: null,
    isLoggedIn: false,
    allTeams: [],
    currentTasks: [],
    editingTaskId: null
};

// --- 2. DOM ELEMENTS ---
const teamFilterDropdown = document.getElementById('user-filter-dropdown'); // Will be repurposed for teams
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


// --- 3. EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', initializeApp);
teamFilterDropdown.addEventListener('change', (e) => {
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
manageUsersBtn.addEventListener('click', () => { /* Logic to be added in Phase 3 */ });
taskForm.addEventListener('submit', handleSaveTask);
document.getElementById('add-user-form').addEventListener('submit', () => { /* Logic to be added in Phase 3 */ });

// --- 4. INITIALIZATION ---
async function initializeApp() {
    showLoader('กำลังเริ่มต้นระบบ...');
    checkLoginState(); // ** UPDATED **
    populateTimeDropdown();
    await fetchAndPopulateTeams(); // ** UPDATED **
    taskList.innerHTML = '<p class="text-center text-muted mt-5">กรุณาเลือกทีมจากเมนูด้านบนเพื่อดูตารางงาน</p>';
    if (AppState.isLoggedIn) {
        teamFilterDropdown.value = AppState.currentTeam;
        if(teamFilterDropdown.value) await fetchTasks(AppState.currentTeam);
    }
    updateUI();
    Swal.close();
}

// --- 5. CORE LOGIC (Updated for Team Model) ---

function populateTimeDropdown() {
    const timeSelect = document.getElementById('task-time');
    timeSelect.innerHTML = '';
    for (let hour = 6; hour <= 18; hour++) {
        const timeString = hour.toString().padStart(2, '0') + ':00';
        timeSelect.innerHTML += `<option value="${timeString}">${timeString} น.</option>`;
    }
}

/**
 * Checks for a logged-in session in localStorage.
 */
function checkLoginState() {
    const team = localStorage.getItem('taskAppTeam');
    const member = localStorage.getItem('taskAppMember');
    const role = localStorage.getItem('taskAppRole');
    if (team && member && role) {
        Object.assign(AppState, { currentTeam: team, currentMember: member, currentRole: role, isLoggedIn: true });
    }
}

/**
 * Fetches the list of unique teams and populates the dropdown.
 */
async function fetchAndPopulateTeams() {
    const response = await fetchAPI('POST', { action: 'getTeams' });
    if (response?.status === 'success') {
        AppState.allTeams = response.data;
        const currentSelection = teamFilterDropdown.value;
        teamFilterDropdown.innerHTML = '<option value="" selected disabled>--- เลือกทีม ---</option>';
        AppState.allTeams.forEach(teamName => {
            if (teamName) { teamFilterDropdown.innerHTML += `<option value="${teamName}">${teamName}</option>`; }
        });
        teamFilterDropdown.value = currentSelection;
    }
}

/**
 * Fetches tasks for a specific team.
 * @param {string} team - The name of the team to fetch tasks for.
 */
async function fetchTasks(team) {
    if (!team) return;
    showLoader('กำลังโหลดข้อมูลงาน...');
    const response = await fetchAPI(`GET?team=${team}`);
    Swal.close();
    AppState.currentTasks = response?.status === 'success' ? response.data : [];
    renderTasks(AppState.currentTasks);
}

/**
 * Renders the list of tasks to the page.
 */
function renderTasks(tasks) {
    if (tasks.length === 0) {
        taskList.innerHTML = '<p class="text-center text-muted mt-5">ไม่พบข้อมูลงานสำหรับทีมนี้</p>';
        return;
    }
    taskList.innerHTML = tasks.map(task => {
        const canManage = AppState.isLoggedIn && (
            AppState.currentRole === 'admin' || 
            AppState.currentRole === 'owner' || 
            AppState.currentMember === task.creator
        );
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
                            <small class="d-block text-info">สร้างโดย: ${task.creator || 'N/A'}</small>
                        </div>
                    </div>
                </div>
            </div>`;
    }).join('');
}

/**
 * Updates the UI based on the current login state.
 */
function updateUI() {
    const loggedIn = AppState.isLoggedIn;
    loginBtn.classList.toggle('d-none', loggedIn);
    teamFilterDropdown.parentElement.style.visibility = loggedIn ? 'hidden' : 'visible';
    statusBar.classList.toggle('d-none', !loggedIn);
    fabFooter.classList.toggle('d-none', !loggedIn);
    
    if (loggedIn) {
        statusBarText.textContent = `ทีม: ${AppState.currentTeam} | ผู้ใช้: ${AppState.currentMember}`;
        manageUsersBtn.classList.toggle('d-none', AppState.currentRole !== 'admin' && AppState.currentRole !== 'owner');
    }
}


// --- 6. HANDLER FUNCTIONS (Updated for Team Model) ---

/**
 * Handles the login process.
 */
async function handleLogin() {
    const { value: formValues } = await Swal.fire({
        title: 'เข้าสู่ระบบทีม',
        html: `<input id="swal-input1" class="swal2-input" placeholder="ชื่อทีม" required>
               <input id="swal-input2" type="password" class="swal2-input" placeholder="รหัสผ่านส่วนตัว" required>`,
        focusConfirm: false, confirmButtonText: 'เข้าสู่ระบบ', showCancelButton: true, cancelButtonText: 'ยกเลิก',
        preConfirm: () => {
            const u = document.getElementById('swal-input1').value;
            const p = document.getElementById('swal-input2').value;
            if (!u || !p) Swal.showValidationMessage('กรุณากรอกชื่อทีมและรหัสผ่าน');
            return [u, p];
        }
    });
    if (formValues) {
        showLoader('กำลังตรวจสอบ...');
        const [team_username, member_password] = formValues;
        const response = await fetchAPI('POST', { action: 'login', team_username, member_password });
        Swal.close();
        if (response?.status === 'success') {
            localStorage.setItem('taskAppTeam', response.team);
            localStorage.setItem('taskAppMember', response.member_name);
            localStorage.setItem('taskAppRole', response.role);
            checkLoginState();
            updateUI();
            teamFilterDropdown.value = response.team;
            if(teamFilterDropdown.value) fetchTasks(response.team);
        } else {
            showError(response?.message || 'ข้อมูลไม่ถูกต้อง');
        }
    }
}

/**
 * Handles the logout process.
 */
function handleLogout() {
    localStorage.removeItem('taskAppTeam');
    localStorage.removeItem('taskAppMember');
    localStorage.removeItem('taskAppRole');
    window.location.reload();
}

/**
 * Opens the task modal for editing an existing task.
 */
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

/**
 * Handles saving a new or edited task.
 */
async function handleSaveTask(event) {
    event.preventDefault();
    const payload = {
        date: taskDateInput.value,
        time: document.getElementById('task-time').value,
        taskName: taskForm['task-name'].value,
        location: taskForm['task-location'].value,
    };
    
    const authData = { 
        team: AppState.currentTeam, 
        member_name: AppState.currentMember, 
        role: AppState.currentRole 
    };

    let action = 'addTask';
    if (AppState.editingTaskId) {
        action = 'updateTask';
        payload.taskId = AppState.editingTaskId;
    } else {
        payload.team = AppState.currentTeam;
        payload.creator = AppState.currentMember;
    }

    showLoader('กำลังบันทึก...');
    const response = await fetchAPI('POST', { action, auth: authData, payload });
    Swal.close();

    if (response?.status === 'success') {
        taskModal.hide();
        showSuccess('บันทึกสำเร็จ!');
        fetchTasks(AppState.currentTeam);
    } else {
        showError(response?.message || 'เกิดข้อผิดพลาด');
    }
}

/**
 * Handles deleting a task.
 */
async function handleDeleteTask(taskId) {
    const result = await Swal.fire({ title: 'ยืนยันการลบ?', text: "คุณจะไม่สามารถกู้คืนข้อมูลนี้ได้!", icon: 'warning', showCancelButton: true, confirmButtonText: 'ใช่, ลบเลย!', cancelButtonText: 'ยกเลิก' });
    if (result.isConfirmed) {
        showLoader('กำลังลบ...');
        const authData = { team: AppState.currentTeam, member_name: AppState.currentMember, role: AppState.currentRole };
        const response = await fetchAPI('POST', { action: 'deleteTask', auth: authData, payload: { taskId } });
        Swal.close();
        if (response?.status === 'success') {
            showSuccess('ลบข้อมูลสำเร็จ');
            fetchTasks(AppState.currentTeam);
        } else {
            showError(response?.message || 'เกิดข้อผิดพลาด');
        }
    }
}

// Placeholder for future implementation
function populateUserManagementModal() { Swal.fire('Coming soon!', 'ฟังก์ชันจัดการสมาชิกจะถูกเพิ่มในเฟสถัดไป', 'info'); }
async function handleAddUser(event) { event.preventDefault(); /* Logic to be added in Phase 3 */ }

// --- 7. UTILITY FUNCTIONS ---
function getTaskCardClass(dateString) {
    if (!dateString) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(dateString);
    taskDate.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (taskDate < today) return 'task-card-overdue';
    if (taskDate.getTime() === today.getTime()) return 'task-card-today';
    if (taskDate.getTime() === tomorrow.getTime()) return 'task-card-warning';
    return '';
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

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').then(reg => console.log('Service Worker: Registered')).catch(err => console.log(`Service Worker: Error: ${err}`));
    });
}
