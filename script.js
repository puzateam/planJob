// !!! สำคัญ: แก้ไข URL นี้เป็น Web App URL ของคุณที่ได้จาก Google Apps Script !!!
const API_URL = 'https://script.google.com/macros/s/AKfycbx1K5nqqUOiXBkn_fJpl0emv7810veZJB0fvISaMJAq7xDoWKrrw_aqQFwGaaUBse0L6w/exec'; 

// DOM Elements
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const userDisplay = document.getElementById('user-display');
const logoutBtn = document.getElementById('logout-btn');
const taskList = document.getElementById('task-list');
const addTaskBtn = document.getElementById('add-task-btn');
const taskForm = document.getElementById('task-form');
const taskDateInput = document.getElementById('task-date');

// Bootstrap Modal Instance
const taskModalEl = document.getElementById('task-modal');
const taskModal = new bootstrap.Modal(taskModalEl);


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', checkLoginState);
loginForm.addEventListener('submit', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
addTaskBtn.addEventListener('click', () => {
    taskForm.reset();
    document.getElementById('modal-title').textContent = 'เพิ่มงานใหม่';
    taskDateInput.value = new Date().toISOString().split('T')[0];
    taskModal.show();
});
taskForm.addEventListener('submit', handleAddTask);


// --- Core Functions ---

function showLoader(title = 'กำลังโหลด...') {
    Swal.fire({
        title: title,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

function checkLoginState() {
    const username = localStorage.getItem('taskAppUser');
    if (username) {
        userDisplay.textContent = username;
        loginContainer.classList.add('d-none');
        appContainer.classList.remove('d-none');
        fetchTasks();
    } else {
        loginContainer.classList.remove('d-none');
        appContainer.classList.add('d-none');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    showLoader('กำลังเข้าสู่ระบบ...');
    
    const username = loginForm.username.value;
    const password = loginForm.password.value;

    const response = await fetchAPI('POST', { action: 'login', username, password });
    Swal.close();

    if (response && response.status === 'success') {
        localStorage.setItem('taskAppUser', response.username);
        checkLoginState();
    } else {
        Swal.fire({
            icon: 'error',
            title: 'ผิดพลาด!',
            text: response.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
        });
    }
}

function handleLogout() {
    Swal.fire({
        title: 'ต้องการออกจากระบบ?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'ใช่, ออกจากระบบ',
        cancelButtonText: 'ยกเลิก'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('taskAppUser');
            window.location.reload();
        }
    });
}

async function fetchTasks() {
    showLoader('กำลังโหลดข้อมูลงาน...');
    const owner = localStorage.getItem('taskAppUser');
    const response = await fetchAPI(`GET?owner=${owner}`);
    Swal.close();

    if (response && response.status === 'success') {
        renderTasks(response.data);
    } else {
        Swal.fire({
            icon: 'error',
            title: 'ไม่สามารถโหลดข้อมูล',
            text: response.message
        });
    }
}

function renderTasks(tasks) {
    taskList.innerHTML = '';
    if (tasks.length === 0) {
        taskList.innerHTML = '<p class="text-center text-muted mt-5">ยังไม่มีงานในรายการของคุณ</p>';
        return;
    }
    tasks.forEach(task => {
        const [thaiDate, thaiYear] = formatThaiDate(task.date);
        const card = document.createElement('div');
        card.className = 'card task-card mb-3';
        card.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between">
                    <div class="pe-3">
                        <strong class="d-block">${thaiDate} ${thaiYear}</strong>
                        <span class="text-muted">${task.time} น.</span>
                    </div>
                    <div class="text-end">
                        <strong class="d-block">${task.taskName}</strong>
                        <span class="text-muted">${task.location}</span>
                    </div>
                </div>
            </div>
        `;
        taskList.appendChild(card);
    });
}

async function handleAddTask(event) {
    event.preventDefault();
    showLoader('กำลังบันทึกข้อมูล...');

    const taskData = {
        action: 'addTask',
        owner: localStorage.getItem('taskAppUser'),
        date: taskForm['task-date'].value,
        time: taskForm['task-time'].value,
        taskName: taskForm['task-name'].value,
        location: taskForm['task-location'].value,
    };
    
    const response = await fetchAPI('POST', taskData);
    Swal.close();

    if (response && response.status === 'success') {
        taskModal.hide();
        Swal.fire({
            icon: 'success',
            title: 'บันทึกสำเร็จ!',
            showConfirmButton: false,
            timer: 1500
        });
        fetchTasks(); // โหลดข้อมูลใหม่
    } else {
        Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาด',
            text: response.message,
        });
    }
}

// --- Helper Functions ---
async function fetchAPI(method, body = null) {
    try {
        let url = API_URL;
        const options = { method: 'POST', redirect: 'follow', muteHttpExceptions: true, headers: {'Content-Type': 'text/plain;charset=utf-8'}};
        if (method.startsWith('GET')) {
            url += method.substring(3);
            const res = await fetch(url);
            return await res.json();
        } else if (method === 'POST') {
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
    const formattedDate = date.toLocaleDateString('th-TH', options);
    return [formattedDate, thaiYear];
}

// PWA: Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker: Registered'))
            .catch(err => console.log(`Service Worker: Error: ${err}`));
    });
}
