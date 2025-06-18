// !!! สำคัญ: แก้ไข URL นี้เป็น Web App URL ของคุณที่ได้จาก Google Apps Script !!!
const API_URL = 'https://script.google.com/macros/s/AKfycbx1K5nqqUOiXBkn_fJpl0emv7810veZJB0fvISaMJAq7xDoWKrrw_aqQFwGaaUBse0L6w/exec'; 

// DOM Elements
const loader = document.getElementById('loader');
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userDisplay = document.getElementById('user-display');
const logoutBtn = document.getElementById('logout-btn');
const taskList = document.getElementById('task-list');
const addTaskBtn = document.getElementById('add-task-btn');
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const closeModalBtn = document.querySelector('.close-btn');
const taskDateInput = document.getElementById('task-date');

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', checkLoginState);
loginForm.addEventListener('submit', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
addTaskBtn.addEventListener('click', () => {
    taskForm.reset();
    // ตั้งค่าวันที่ในฟอร์มเป็นวันปัจจุบันอัตโนมัติ
    taskDateInput.value = new Date().toISOString().split('T')[0];
    taskModal.style.display = 'block';
});
closeModalBtn.addEventListener('click', () => taskModal.style.display = 'none');
window.addEventListener('click', (event) => {
    if (event.target == taskModal) {
        taskModal.style.display = 'none';
    }
});
taskForm.addEventListener('submit', handleAddTask);


// --- Core Functions ---

function showLoader(show) {
    loader.style.display = show ? 'flex' : 'none';
}

function checkLoginState() {
    const username = localStorage.getItem('taskAppUser');
    if (username) {
        userDisplay.textContent = username;
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
        fetchTasks();
    } else {
        loginContainer.style.display = 'flex';
        appContainer.style.display = 'none';
    }
}

async function handleLogin(event) {
    event.preventDefault();
    showLoader(true);
    loginError.textContent = '';
    
    const username = loginForm.username.value;
    const password = loginForm.password.value;

    const response = await fetchAPI('POST', { action: 'login', username, password });

    showLoader(false);
    if (response && response.status === 'success') {
        localStorage.setItem('taskAppUser', response.username);
        checkLoginState();
    } else {
        loginError.textContent = response.message || 'เกิดข้อผิดพลาดในการล็อกอิน';
    }
}

function handleLogout() {
    localStorage.removeItem('taskAppUser');
    window.location.reload();
}

async function fetchTasks() {
    showLoader(true);
    const owner = localStorage.getItem('taskAppUser');
    const response = await fetchAPI(`GET?owner=${owner}`);

    showLoader(false);
    if (response && response.status === 'success') {
        renderTasks(response.data);
    } else {
        taskList.innerHTML = `<p class="error-message">ไม่สามารถโหลดข้อมูลได้: ${response.message}</p>`;
    }
}

function renderTasks(tasks) {
    taskList.innerHTML = '';
    if (tasks.length === 0) {
        taskList.innerHTML = '<p>ยังไม่มีงานในรายการของคุณ</p>';
        return;
    }

    // เรียงข้อมูลตามวันที่อีกครั้งเผื่อ API ไม่ได้เรียงมา
    tasks.sort((a, b) => new Date(a.date) - new Date(b.date));

    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';
        
        const [thaiDate, thaiYear] = formatThaiDate(task.date);

        taskItem.innerHTML = `
            <div class="task-item-col1">
                <strong>${thaiDate} ${thaiYear}</strong>
                <span>${task.time} น.</span>
            </div>
            <div class="task-item-col2">
                <strong>${task.taskName}</strong>
                <span>${task.location}</span>
            </div>
        `;
        taskList.appendChild(taskItem);
    });
}

async function handleAddTask(event) {
    event.preventDefault();
    showLoader(true);

    const taskData = {
        action: 'addTask',
        owner: localStorage.getItem('taskAppUser'),
        date: taskForm['task-date'].value,
        time: taskForm['task-time'].value,
        taskName: taskForm['task-name'].value,
        location: taskForm['task-location'].value,
    };
    
    const response = await fetchAPI('POST', taskData);
    
    showLoader(false);
    if (response && response.status === 'success') {
        taskModal.style.display = 'none';
        fetchTasks(); // โหลดข้อมูลใหม่
    } else {
        alert('เกิดข้อผิดพลาดในการเพิ่มข้อมูล: ' + response.message);
    }
}

// --- Helper Functions ---

async function fetchAPI(method, body = null) {
    try {
        let url = API_URL;
        const options = {
            method: 'POST', // GAS Web App มักใช้ POST สำหรับทุกอย่าง ยกเว้น GET พื้นฐาน
            redirect: 'follow',
            muteHttpExceptions: true,
            headers: {
                'Content-Type': 'text/plain;charset=utf-8', // ใช้ text/plain เพื่อหลีกเลี่ยง preflight CORS
            },
        };

        if (method.startsWith('GET')) {
            // สำหรับ doGet เราจะส่ง parameter ผ่าน URL
             url += method.substring(3); // เอา ?... มาต่อท้าย
             delete options.body;
             // Google Script doGet ต้องใช้วิธีเรียกโดยตรง ไม่ผ่าน POST
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
    const options = {
        day: 'numeric',
        month: 'short',
    };
    // ใช้ Locale 'th-TH' เพื่อให้ได้ชื่อเดือนภาษาไทย
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
