const API_URL = 'http://localhost:5000/api';

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const dashboardContent = document.getElementById('dashboard-content');

// Check authentication state
function checkAuth() {
    const token = localStorage.getItem('srms_token');
    const userStr = localStorage.getItem('srms_user');
    
    if (token && userStr) {
        const user = JSON.parse(userStr);
        showDashboard(user);
    } else {
        showLogin();
    }
}

const registerView = document.getElementById('register-view');
const registerForm = document.getElementById('register-form');
const registerMsg = document.getElementById('register-msg');

function showLogin() {
    loginView.classList.add('active');
    dashboardView.classList.remove('active');
    if (registerView) registerView.classList.remove('active');
}

window.switchAuthView = function(viewName) {
    if (viewName === 'register') {
        loginView.classList.remove('active');
        registerView.classList.add('active');
    } else {
        registerView.classList.remove('active');
        loginView.classList.add('active');
    }
}

window.togglePassword = function(inputId, btnElement) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btnElement.textContent = '🔒';
    } else {
        input.type = 'password';
        btnElement.textContent = '👁️';
    }
}

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
};

window.activateSidebarLink = function(element, title) {
    document.querySelectorAll('.sidebar-link').forEach(link => link.classList.remove('active'));
    if (element) element.classList.add('active');
    // Update topbar title
    const topbarTitle = document.getElementById('topbar-title');
    if (topbarTitle && title) topbarTitle.textContent = title;
    // Auto-close sidebar on mobile after clicking a link
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
};

function showDashboard(user) {
    loginView.classList.remove('active');
    dashboardView.classList.add('active');

    // Populate sidebar footer with user info
    const greetingEl = document.getElementById('user-greeting');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-avatar');
    const topbarGreeting = document.getElementById('topbar-greeting');

    const displayName = user.full_name || user.username;
    const initial = displayName.charAt(0).toUpperCase();

    if (greetingEl) greetingEl.textContent = displayName;
    if (roleEl) roleEl.textContent = user.role.replace(/_/g, ' ');
    if (avatarEl) avatarEl.textContent = initial;
    if (topbarGreeting) topbarGreeting.textContent = `Welcome, ${displayName}`;

    renderSidebar(user);
    initDashboardContent(user);
}

function renderSidebar(user) {
    const sidebarNav = document.getElementById('sidebar-nav');
    let linksHTML = '';
    
    if (user.role === 'Student') {
        linksHTML = `
            <button class="sidebar-link active" onclick="activateSidebarLink(this, 'My Results'); fetchStudentResults()">📊 My Results</button>
            <button class="sidebar-link" onclick="activateSidebarLink(this, 'Course Registration'); renderStudentCourseRegistration()">📝 Register Courses</button>
        `;
    } else if (user.role === 'Lecturer') {
        linksHTML = `<button class="sidebar-link active" onclick="activateSidebarLink(this, 'My Courses'); renderLecturerCourses()">📚 My Courses</button>`;
    } else if (user.role.includes('Officer')) {
        linksHTML = `
            <button class="sidebar-link active" onclick="activateSidebarLink(this, 'Pending Approvals'); renderOfficerPending('${user.role}')">⏳ Pending Approvals</button>
            <button class="sidebar-link" onclick="activateSidebarLink(this, 'Approved Results'); renderOfficerApproved('${user.role}')">✅ Approved Results</button>
        `;
    } else { // Admin
        linksHTML = `
            <button class="sidebar-link active" onclick="activateSidebarLink(this, 'Manage Users'); renderAdminUsers()">👥 Manage Users</button>
            <button class="sidebar-link" onclick="activateSidebarLink(this, 'Manage Courses'); renderAdminCourses()">📚 Manage Courses</button>
            <button class="sidebar-link" onclick="activateSidebarLink(this, 'Audit Logs'); renderAdminLogs()">📋 Audit Logs</button>
        `;
    }
    
    if (sidebarNav) sidebarNav.innerHTML = linksHTML;
}

function initDashboardContent(user) {
    let content = '';
    
    if (user.role === 'Student') {
        content = `
            <div class="card">
                <h2>My Results</h2>
                <p class="subtitle">Your approved academic records</p>
                <div id="results-container">Loading...</div>
            </div>
        `;
        dashboardContent.innerHTML = content;
        setTimeout(fetchStudentResults, 0);
    } else if (user.role === 'Lecturer') {
        content = `
            <div class="card">
                <h2>Lecturer Dashboard</h2>
                <div id="lecturer-dynamic-content">
                    <p>Loading your courses...</p>
                </div>
            </div>
        `;
        dashboardContent.innerHTML = content;
        setTimeout(renderLecturerCourses, 0);
    } else if (user.role.includes('Officer')) {
        content = `
            <div class="card">
                <h2>Pending Approvals</h2>
                <div id="officer-dynamic-content">
                    <p>Loading pending courses...</p>
                </div>
            </div>
        `;
        dashboardContent.innerHTML = content;
        setTimeout(() => renderOfficerPending(user.role), 0);
    } else {
        content = `
            <div class="card">
                <h2>Admin Dashboard</h2>
                <div id="admin-dynamic-content">
                    <p>Select a tab from the sidebar to manage system entities.</p>
                </div>
            </div>
        `;
        dashboardContent.innerHTML = content;
        // Auto load the first active tab
        setTimeout(renderAdminUsers, 0);
    }
}

async function fetchStudentResults() {
    try {
        const res = await fetch(`${API_URL}/results/my-results`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }
        });
        const data = await res.json();
        
        const container = document.getElementById('results-container');
        if (!container) return;
        
        if (res.ok) {
            const { student, semesters, cgpa, totalCredits, totalPoints } = data;
            
            if (!semesters || semesters.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding: 3rem 1rem;">
                        <p style="font-size: 1.1rem; color: var(--text-muted);">📜 No official published results found yet.</p>
                        <small style="color: #94a3b8;">Results will appear here once approved by your Department and Faculty Examination Officers.</small>
                    </div>
                `;
                return;
            }
            
            let html = `
                <div style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; padding: 1.5rem 2rem; border-radius: var(--radius-lg); margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.4rem; color: #a5b4fc;">${student.full_name || 'Student Record'}</h3>
                        <p style="margin: 0.3rem 0 0; color: #cbd5e1; font-size: 0.95rem;">Matric No: <strong>${student.matric_no}</strong> | Dept: <strong>${student.department || 'General'}</strong> | Level: <strong>${student.level}L</strong></p>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;">Cumulative GPA (CGPA)</div>
                        <div style="font-size: 2.2rem; font-weight: 800; color: #4ade80; line-height: 1;">${cgpa} <span style="font-size:1rem; color:#94a3b8; font-weight:normal;">/ 5.00</span></div>
                        <small style="color: #cbd5e1; font-size: 0.8rem;">Total Credits: ${totalCredits} | Points: ${totalPoints}</small>
                    </div>
                </div>

                <div style="display:flex; justify-content:flex-end; margin-bottom: 1.5rem;">
                    <button class="btn primary-btn" style="width: auto; padding: 0.65rem 1.5rem;" onclick="printStudentTranscript()">🖨️ Download / Print Official Academic Transcript</button>
                </div>
            `;
            
            semesters.forEach(sem => {
                html += `
                    <div class="card" style="margin-bottom: 2rem; border: 1px solid var(--border);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 2px solid var(--border); padding-bottom: 0.75rem;">
                            <h3 style="margin: 0; font-size: 1.15rem; color: var(--primary);">📌 ${sem.semesterName}</h3>
                            <div style="background: rgba(79, 70, 229, 0.1); color: var(--primary); padding: 0.3rem 0.8rem; border-radius: 999px; font-weight: 700; font-size: 0.9rem;">
                                Semester GPA (SGPA): ${sem.sgpa}
                            </div>
                        </div>
                        <div class="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Course Code</th>
                                        <th>Course Title</th>
                                        <th>Department</th>
                                        <th>Units</th>
                                        <th>CA (30)</th>
                                        <th>Exam (70)</th>
                                        <th>Total</th>
                                        <th>Grade</th>
                                        <th>Points</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sem.courses.map(c => `
                                        <tr>
                                            <td><strong>${c.course_code}</strong></td>
                                            <td>${c.title}</td>
                                            <td><small style="color:var(--text-muted);">${c.course_dept || '—'}</small></td>
                                            <td>${c.credit_units}</td>
                                            <td>${c.ca_score}</td>
                                            <td>${c.exam_score}</td>
                                            <td><strong>${c.total_score}</strong></td>
                                            <td><span class="status-badge ${c.grade === 'F' ? 'status-rejected' : 'status-approved'}">${c.grade}</span></td>
                                            <td>${c.point_earned}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted); text-align: right;">
                            Total Units: <strong>${sem.semCredits}</strong> &nbsp;|&nbsp; Total Grade Points: <strong>${sem.semPoints}</strong>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        } else {
            container.innerHTML = `<p class="error-msg">${data.error || 'Failed to fetch results'}</p>`;
        }
    } catch(err) {
        const container = document.getElementById('results-container');
        if (container) container.innerHTML = '<p class="error-msg">Failed to connect to server.</p>';
    }
}

window.renderStudentCourseRegistration = async function() {
    const dashboardContent = document.getElementById('dashboard-content');
    dashboardContent.innerHTML = `
        <div class="card">
            <h2>Course Registration</h2>
            <p class="subtitle">Select your session, semester, and level to register pre-created courses or carryovers</p>
            
            <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1.5rem; background:#f8fafc; padding:1.2rem; border-radius:var(--radius-md); border:1px solid var(--border);">
                <div style="flex:1; min-width:180px;">
                    <label style="font-weight:600; font-size:0.85rem;">Academic Session</label>
                    <select id="reg_session_select" class="input" style="margin-bottom:0;" onchange="loadAvailableCoursesForRegistration()">
                        <option value="2025/2026" selected>2025/2026 Session</option>
                        <option value="2026/2027">2026/2027 Session</option>
                    </select>
                </div>
                <div style="flex:1; min-width:180px;">
                    <label style="font-weight:600; font-size:0.85rem;">Semester</label>
                    <select id="reg_semester_select" class="input" style="margin-bottom:0;" onchange="loadAvailableCoursesForRegistration()">
                        <option value="1" selected>First Semester</option>
                        <option value="2">Second Semester</option>
                    </select>
                </div>
                <div style="flex:1; min-width:180px;">
                    <label style="font-weight:600; font-size:0.85rem;">Level (Change for carryovers)</label>
                    <select id="reg_level_select" class="input" style="margin-bottom:0;" onchange="loadAvailableCoursesForRegistration()">
                        <option value="100">100 Level</option>
                        <option value="200">200 Level</option>
                        <option value="300">300 Level</option>
                        <option value="400">400 Level</option>
                        <option value="500">500 Level</option>
                    </select>
                </div>
            </div>

            <div id="registration-courses-container">
                <p>Loading available courses...</p>
            </div>
            
            <div style="margin-top:2.5rem;">
                <h3 class="section-title">📋 Registered Courses for this Session</h3>
                <div id="registered-courses-list">
                    <p style="color:var(--text-muted);">Loading registrations...</p>
                </div>
            </div>
        </div>
    `;
    
    loadAvailableCoursesForRegistration();
    loadMyRegistrationsList();
};

window.loadAvailableCoursesForRegistration = async function() {
    const container = document.getElementById('registration-courses-container');
    if (!container) return;
    
    const session = document.getElementById('reg_session_select').value;
    const semester = document.getElementById('reg_semester_select').value;
    const level = document.getElementById('reg_level_select').value;
    
    container.innerHTML = '<p>Loading courses...</p>';
    
    try {
        const res = await fetch(`${API_URL}/courses/available-for-registration?session=${session}&semester=${semester}&level=${level}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }
        });
        const data = await res.json();
        
        if (!res.ok) {
            container.innerHTML = `<p class="error-msg">${data.error || 'Failed to load courses'}</p>`;
            return;
        }
        
        const { courses, registered_ids, student } = data;
        
        const levelSelect = document.getElementById('reg_level_select');
        if (levelSelect && !levelSelect.dataset.userSet) {
            levelSelect.value = student.level;
            levelSelect.dataset.userSet = "true";
            loadAvailableCoursesForRegistration();
            return;
        }
        
        if (!courses || courses.length === 0) {
            container.innerHTML = `<div style="padding:1.5rem; text-align:center; color:var(--text-muted); background:#f9fafb; border-radius:8px;">No pre-created courses found for ${level}L - ${semester == 1 ? '1st' : '2nd'} Semester in ${student.department} department.</div>`;
            return;
        }
        
        const regSet = new Set(registered_ids);
        
        let html = `
            <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
                <p style="margin:0; font-size:0.9rem; color:var(--text-muted);">Department: <strong>${student.department}</strong> | Selected Level: <strong>${level}L</strong></p>
                <small style="color:var(--text-muted);">Check the courses you wish to offer and click Submit.</small>
            </div>
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th style="width:40px;">Select</th>
                            <th>Course Code</th>
                            <th>Course Title</th>
                            <th>Units</th>
                            <th>Department</th>
                            <th>Type</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${courses.map(c => {
                            const isReg = regSet.has(c.id);
                            return `
                                <tr style="${c.is_carryover ? 'background: #fff1f2;' : ''}">
                                    <td>
                                        <input type="checkbox" class="course-reg-checkbox" value="${c.id}" ${isReg ? 'checked disabled' : ''}>
                                    </td>
                                    <td><strong>${c.course_code}</strong></td>
                                    <td>${c.title}</td>
                                    <td>${c.credit_units}</td>
                                    <td>${c.department}</td>
                                    <td>
                                        ${c.is_carryover ? '<span class="status-badge status-rejected">⚠️ CARRYOVER</span>' : '<span class="status-badge" style="background:#e0e7ff; color:#3730a3;">Core</span>'}
                                    </td>
                                    <td>
                                        ${isReg ? '<span class="status-badge status-approved">✅ Registered</span>' : '<span style="color:#64748b; font-size:0.85rem;">Not Registered</span>'}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
                <button class="btn primary-btn" style="width:auto; padding:0.7rem 1.8rem;" onclick="submitCourseRegistration()">✅ Submit Selected Course Registration</button>
                <p id="reg-submit-msg" class="form-feedback" style="margin:0;"></p>
            </div>
        `;
        
        container.innerHTML = html;
    } catch(err) {
        container.innerHTML = '<p class="error-msg">Failed to connect to server.</p>';
    }
};

window.submitCourseRegistration = async function() {
    const checkboxes = document.querySelectorAll('.course-reg-checkbox:checked:not([disabled])');
    const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    const msgEl = document.getElementById('reg-submit-msg');
    
    if (selectedIds.length === 0) {
        msgEl.style.color = 'var(--error)';
        msgEl.textContent = 'Please select at least one new course to register.';
        return;
    }
    
    const session = document.getElementById('reg_session_select').value;
    const semester = document.getElementById('reg_semester_select').value;
    
    msgEl.style.color = 'var(--text-muted)';
    msgEl.textContent = 'Submitting registration...';
    
    try {
        const res = await fetch(`${API_URL}/courses/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('srms_token')}`
            },
            body: JSON.stringify({
                course_ids: selectedIds,
                session,
                semester
            })
        });
        const data = await res.json();
        
        if (res.ok) {
            msgEl.style.color = 'green';
            msgEl.textContent = data.message;
            loadAvailableCoursesForRegistration();
            loadMyRegistrationsList();
        } else {
            msgEl.style.color = 'var(--error)';
            msgEl.textContent = data.error || 'Failed to register courses.';
        }
    } catch(err) {
        msgEl.style.color = 'var(--error)';
        msgEl.textContent = 'Server connection failed.';
    }
};

window.loadMyRegistrationsList = async function() {
    const container = document.getElementById('registered-courses-list');
    if (!container) return;
    
    try {
        const res = await fetch(`${API_URL}/courses/my-registrations`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }
        });
        const registrations = await res.json();
        
        if (!registrations || registrations.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);">No course registrations found yet.</p>';
            return;
        }
        
        let html = `
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Session</th>
                            <th>Semester</th>
                            <th>Course Code</th>
                            <th>Course Title</th>
                            <th>Credit Units</th>
                            <th>Level</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${registrations.map(r => `
                            <tr>
                                <td><strong>${r.session}</strong></td>
                                <td>${r.semester == 1 ? '1st Semester' : '2nd Semester'}</td>
                                <td><strong>${r.course_code}</strong></td>
                                <td>${r.title}</td>
                                <td>${r.credit_units}</td>
                                <td>${r.level}L</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        container.innerHTML = html;
    } catch(err) {
        container.innerHTML = '<p class="error-msg">Failed to load registration history.</p>';
    }
};

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        loginError.textContent = 'Logging in...';
        
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            
            if (res.ok) {
                localStorage.setItem('srms_token', data.token);
                localStorage.setItem('srms_user', JSON.stringify(data.user));
                loginError.textContent = '';
                showDashboard(data.user);
            } else {
                loginError.textContent = data.error || 'Login failed';
            }
        } catch (error) {
            loginError.textContent = 'Failed to connect to server.';
        }
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('srms_token');
        localStorage.removeItem('srms_user');
        showLogin();
    });
}

if (registerForm) {
    const pwdInput = document.getElementById('reg_password');
    const pwdMsg = document.getElementById('password-strength-msg');
    
    pwdInput.addEventListener('input', () => {
        const val = pwdInput.value;
        const strongRegex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%\^&\*])(?=.{8,})");
        if (strongRegex.test(val)) {
            pwdMsg.textContent = 'Strong password ✓';
            pwdMsg.style.color = 'green';
        } else {
            pwdMsg.textContent = 'Weak: needs 8+ chars, upper/lower, number, and special character (!@#$%)';
            pwdMsg.style.color = 'red';
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const pwd = pwdInput.value;
        const strongRegex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%\^&\*])(?=.{8,})");
        if (!strongRegex.test(pwd)) {
            registerMsg.textContent = 'Please provide a strong password to continue.';
            registerMsg.style.color = 'red';
            return;
        }

        const body = {
            full_name: document.getElementById('reg_fullname').value,
            email: document.getElementById('reg_email').value,
            reg_number: document.getElementById('reg_number').value,
            department: document.getElementById('reg_dept').value,
            level: document.getElementById('reg_level').value,
            password: pwd
        };
        
        registerMsg.textContent = 'Creating account...';
        registerMsg.style.color = 'var(--primary)';
        
        try {
            const res = await fetch(`${API_URL}/auth/register-student`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            
            if (res.ok) {
                registerMsg.textContent = data.message;
                registerMsg.style.color = 'green';
                setTimeout(() => switchAuthView('login'), 2000);
            } else {
                registerMsg.textContent = data.error || 'Registration failed';
                registerMsg.style.color = 'red';
            }
        } catch (error) {
            registerMsg.textContent = 'Failed to connect to server.';
            registerMsg.style.color = 'red';
        }
    });
}

// Initialize
checkAuth();

// --- ADMIN SPECIFIC FUNCTIONS ---
async function renderAdminUsers() {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = '<p>Loading users...</p>';
    
    try {
        const [usersRes, rolesRes] = await Promise.all([
            fetch(`${API_URL}/admin/users`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }}),
            fetch(`${API_URL}/admin/roles`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }})
        ]);
        
        const users = await usersRes.json();
        const roles = await rolesRes.json();
        
        let html = `
            <div class="form-section">
                <h3 class="section-title">➕ Create New Staff Account</h3>
                <form id="create-user-form">
                    <div class="input-row">
                        <div class="input-group">
                            <label for="new_fullname">Full Name <span style="color:var(--error)">*</span></label>
                            <input type="text" id="new_fullname" placeholder="e.g. Dr. Jane Doe" required>
                        </div>
                        <div class="input-group">
                            <label for="new_email">Email Address <span style="color:var(--error)">*</span></label>
                            <input type="email" id="new_email" placeholder="jane.doe@university.edu" required>
                        </div>
                    </div>

                    <div class="input-row">
                        <div class="input-group">
                            <label for="new_password">Password <span style="color:var(--error)">*</span></label>
                            <div class="password-wrapper">
                                <input type="password" id="new_password" placeholder="At least 6 characters" required minlength="6">
                                <button type="button" class="eye-toggle" onclick="togglePassword('new_password', this)">👁️</button>
                            </div>
                        </div>
                        <div class="input-group">
                            <label for="new_role">User Role <span style="color:var(--error)">*</span></label>
                            <select id="new_role" required>
                                <option value="">-- Select Role --</option>
                                ${roles.filter(r => r.name !== 'Student').map(r => `<option value="${r.id}">${r.name.replace(/_/g, ' ')}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="officer-section" id="dept-fac-section">
                        <p class="officer-label">📌 Department & Faculty Assignment</p>
                        <div class="input-row">
                            <div class="input-group" id="dept-input-group">
                                <label for="new_dept">Department</label>
                                <input type="text" id="new_dept" placeholder="e.g. Computer Science">
                            </div>
                            <div class="input-group" id="faculty-input-group">
                                <label for="new_faculty">Faculty</label>
                                <input type="text" id="new_faculty" placeholder="e.g. Faculty of Science">
                            </div>
                        </div>
                    </div>

                    <button type="submit" class="btn primary-btn" style="margin-top: 0.5rem; width: auto; min-width: 200px;">✅ Create Account</button>
                    <p id="user-msg" class="form-feedback"></p>
                </form>
            </div>

            <div class="table-section">
                <div class="table-header">
                    <h3 class="section-title">👥 Existing Users (${users.length})</h3>
                    <button class="btn secondary-btn" onclick="promoteStudents()">🎓 Promote All Students</button>
                </div>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Email / Login ID</th>
                                <th>Full Name</th>
                                <th>Role</th>
                                <th>Department</th>
                                <th>Faculty</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.length === 0 ? '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No users found.</td></tr>' : 
                            users.map(u => `
                                <tr>
                                    <td>#${u.id}</td>
                                    <td><strong>${u.username}</strong></td>
                                    <td>${u.full_name}</td>
                                    <td><span class="role-badge">${(u.role_name || '').replace(/_/g, ' ')}</span></td>
                                    <td>${u.department || '—'}</td>
                                    <td>${u.faculty || '—'}</td>
                                    <td>
                                        <button class="btn secondary-btn" style="padding: 5px 12px; font-size: 0.8rem; border-color: var(--error); color: var(--error); background: transparent;" onclick="deleteUser(${u.id})">🗑️ Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        const roleSelect = document.getElementById('new_role');
        if (roleSelect) {
            roleSelect.addEventListener('change', (e) => {
                const text = e.target.options[e.target.selectedIndex].text.toLowerCase();
                const deptGrp = document.getElementById('dept-input-group');
                if (deptGrp) {
                    if (text.includes('faculty officer')) {
                        deptGrp.style.display = 'none';
                        document.getElementById('new_dept').value = '';
                    } else {
                        deptGrp.style.display = 'block';
                    }
                }
            });
        }
        
        const form = document.getElementById('create-user-form');
        const userMsg = document.getElementById('user-msg');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailValue = document.getElementById('new_email').value.trim();
            const fullNameValue = document.getElementById('new_fullname').value.trim();
            const passwordValue = document.getElementById('new_password').value;
            const roleValue = document.getElementById('new_role').value;
            const deptValue = document.getElementById('new_dept').value.trim();
            const facValue = document.getElementById('new_faculty').value.trim();
            
            userMsg.style.color = 'var(--error)';
            userMsg.textContent = '';

            if (!fullNameValue) {
                userMsg.textContent = 'Please enter full name.';
                return;
            }
            if (!emailValue || !/\S+@\S+\.\S+/.test(emailValue)) {
                userMsg.textContent = 'Please enter a valid email address.';
                return;
            }
            if (!passwordValue || passwordValue.length < 6) {
                userMsg.textContent = 'Password must be at least 6 characters.';
                return;
            }
            if (!roleValue) {
                userMsg.textContent = 'Please select a user role.';
                return;
            }

            userMsg.style.color = 'var(--text-muted)';
            userMsg.textContent = 'Creating account...';
            
            const body = {
                username: emailValue,
                password: passwordValue,
                full_name: fullNameValue,
                email: emailValue,
                role_id: roleValue,
                department: deptValue,
                faculty: facValue
            };
            
            try {
                const res = await fetch(`${API_URL}/admin/users`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('srms_token')}` 
                    },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                
                if (res.ok) {
                    userMsg.style.color = 'var(--success)';
                    userMsg.textContent = data.message || 'User created successfully!';
                    setTimeout(() => renderAdminUsers(), 1200);
                } else {
                    userMsg.style.color = 'var(--error)';
                    userMsg.textContent = data.error || 'Failed to create user account.';
                }
            } catch(err) {
                userMsg.style.color = 'var(--error)';
                userMsg.textContent = 'Network error. Could not connect to server.';
            }
        });
        
    } catch (err) {
        container.innerHTML = '<p class="error-msg">Failed to load admin users view.</p>';
    }
}

window.promoteStudents = async function() {
    if (!confirm("Are you sure you want to advance all students to the next level? (e.g., 100 -> 200)")) return;
    
    document.getElementById('user-msg').textContent = 'Promoting students...';
    try {
        const res = await fetch(`${API_URL}/admin/promote-students`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }
        });
        const data = await res.json();
        document.getElementById('user-msg').textContent = data.message || data.error;
    } catch (err) {
        document.getElementById('user-msg').textContent = 'Failed to communicate with server.';
    }
}

window.deleteUser = async function(id) {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    try {
        const res = await fetch(`${API_URL}/admin/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }
        });
        if (res.ok) renderAdminUsers();
        else alert('Failed to delete user.');
    } catch (err) {
        alert('Server error.');
    }
}

async function renderAdminCourses() {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = '<p>Loading courses and allocations...</p>';
    try {
        const [coursesRes, usersRes, allocRes] = await Promise.all([
            fetch(`${API_URL}/admin/courses`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }}),
            fetch(`${API_URL}/admin/users`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }}),
            fetch(`${API_URL}/admin/allocations`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }})
        ]);
        
        const courses = await coursesRes.json();
        const users = await usersRes.json();
        const allocations = await allocRes.json();
        
        const lecturers = users.filter(u => u.role_name === 'Lecturer');
        
        let html = `
            <div class="form-section">
                <h3 class="section-title">➕ Create New Course</h3>
                <form id="create-course-form">
                    <div class="input-row">
                        <div class="input-group">
                            <label for="c_code">Course Code <span style="color:var(--error)">*</span></label>
                            <input type="text" id="c_code" placeholder="e.g. CSC101" required>
                        </div>
                        <div class="input-group">
                            <label for="c_title">Course Title <span style="color:var(--error)">*</span></label>
                            <input type="text" id="c_title" placeholder="e.g. Introduction to CS" required>
                        </div>
                    </div>
                    <div class="input-row">
                        <div class="input-group">
                            <label for="c_units">Credit Units <span style="color:var(--error)">*</span></label>
                            <input type="number" id="c_units" placeholder="e.g. 3" min="1" max="6" required>
                        </div>
                        <div class="input-group">
                            <label for="c_level">Target Level <span style="color:var(--error)">*</span></label>
                            <select id="c_level" required>
                                <option value="100">100 Level</option>
                                <option value="200">200 Level</option>
                                <option value="300">300 Level</option>
                                <option value="400">400 Level</option>
                                <option value="500">500 Level</option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label for="c_sem">Semester <span style="color:var(--error)">*</span></label>
                            <select id="c_sem" required>
                                <option value="">Select Semester</option>
                                <option value="1">First Semester</option>
                                <option value="2">Second Semester</option>
                            </select>
                        </div>
                    </div>
                    <div class="input-row">
                        <div class="input-group">
                            <label for="c_dept">Department <span style="color:var(--error)">*</span></label>
                            <input type="text" id="c_dept" placeholder="e.g. Computer Science" required>
                        </div>
                        <div class="input-group">
                            <label for="c_faculty">Faculty <span style="color:var(--error)">*</span></label>
                            <input type="text" id="c_faculty" placeholder="e.g. Faculty of Science" required>
                        </div>
                    </div>
                    <button type="submit" class="btn primary-btn" style="margin-top: 0.5rem; width: auto; min-width: 200px;">✅ Create Course</button>
                    <p id="course-msg" class="form-feedback"></p>
                </form>
            </div>

            <div class="form-section" style="background: #f8fafc; border: 1px dashed var(--border);">
                <h3 class="section-title">👨‍🏫 Assign Course to Lecturer</h3>
                <form id="allocate-course-form">
                    <div class="input-row">
                        <div class="input-group">
                            <label for="alloc_course">Select Course <span style="color:var(--error)">*</span></label>
                            <select id="alloc_course" required>
                                <option value="">-- Choose Course --</option>
                                ${courses.map(c => `<option value="${c.id}">${c.course_code} - ${c.title} (${c.level}L - ${c.department})</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group">
                            <label for="alloc_lecturer">Select Lecturer <span style="color:var(--error)">*</span></label>
                            <select id="alloc_lecturer" required>
                                <option value="">-- Choose Lecturer --</option>
                                ${lecturers.map(l => `<option value="${l.id}">${l.full_name} (${l.username})</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group">
                            <label for="alloc_session">Academic Session <span style="color:var(--error)">*</span></label>
                            <input type="text" id="alloc_session" value="2025/2026" required placeholder="e.g. 2025/2026">
                        </div>
                    </div>
                    <button type="submit" class="btn primary-btn" style="margin-top: 0.5rem; width: auto; min-width: 200px;">🔗 Assign Course</button>
                    <p id="alloc-msg" class="form-feedback"></p>
                </form>
            </div>

            <div class="table-section">
                <h3 class="section-title">📌 Course Allocations (${allocations.length})</h3>
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr>
                                <th>Session</th>
                                <th>Course Code</th>
                                <th>Course Title</th>
                                <th>Level</th>
                                <th>Assigned Lecturer</th>
                                <th>Department</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allocations.length === 0 ? '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No courses currently allocated.</td></tr>' :
                            allocations.map(a => `
                                <tr>
                                    <td><strong>${a.session}</strong></td>
                                    <td><strong>${a.course_code}</strong></td>
                                    <td>${a.course_title}</td>
                                    <td>${a.level || 100}L</td>
                                    <td>${a.lecturer_name} <br><small style="color:var(--text-muted);">${a.lecturer_email}</small></td>
                                    <td>${a.department || '—'}</td>
                                    <td>
                                        <button class="btn secondary-btn" style="padding: 4px 10px; font-size: 0.8rem; border-color: var(--error); color: var(--error); background: transparent;" onclick="deleteAllocation(${a.id})">🗑️ Remove</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="table-section">
                <h3 class="section-title">📚 All Registered Courses (${courses.length})</h3>
                <div class="table-responsive">
                    <table>
                        <thead><tr><th>ID</th><th>Code</th><th>Title</th><th>Units</th><th>Level</th><th>Department</th><th>Faculty</th><th>Sem</th><th>Actions</th></tr></thead>
                        <tbody>
                            ${courses.length === 0 ? '<tr><td colspan="9" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No courses found.</td></tr>' :
                            courses.map(c => `<tr><td>#${c.id}</td><td><strong>${c.course_code}</strong></td><td>${c.title}</td><td>${c.credit_units}</td><td>${c.level}L</td><td>${c.department}</td><td>${c.faculty || '—'}</td><td>Sem ${c.semester}</td><td><button class="btn secondary-btn" style="padding: 4px 10px; font-size: 0.8rem; border-color: var(--error); color: var(--error); background: transparent;" onclick="deleteCourse(${c.id})">Delete</button></td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Form submit: Create Course
        document.getElementById('create-course-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const courseMsg = document.getElementById('course-msg');
            const body = {
                course_code: document.getElementById('c_code').value.trim(),
                title: document.getElementById('c_title').value.trim(),
                credit_units: document.getElementById('c_units').value,
                level: document.getElementById('c_level').value,
                department: document.getElementById('c_dept').value.trim(),
                faculty: document.getElementById('c_faculty').value.trim(),
                semester: document.getElementById('c_sem').value
            };
            
            try {
                const res = await fetch(`${API_URL}/admin/courses`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if(res.ok) {
                    courseMsg.style.color = 'var(--success)';
                    courseMsg.textContent = data.message || 'Course created successfully!';
                    setTimeout(() => renderAdminCourses(), 1200);
                } else {
                    courseMsg.style.color = 'var(--error)';
                    courseMsg.textContent = data.error || 'Failed to create course.';
                }
            } catch(err) {
                courseMsg.style.color = 'var(--error)';
                courseMsg.textContent = 'Server error.';
            }
        });

        // Form submit: Allocate Course
        document.getElementById('allocate-course-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const allocMsg = document.getElementById('alloc-msg');
            const body = {
                course_id: document.getElementById('alloc_course').value,
                lecturer_id: document.getElementById('alloc_lecturer').value,
                session: document.getElementById('alloc_session').value.trim()
            };
            
            try {
                const res = await fetch(`${API_URL}/admin/allocations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if(res.ok) {
                    allocMsg.style.color = 'var(--success)';
                    allocMsg.textContent = data.message || 'Course allocated successfully!';
                    setTimeout(() => renderAdminCourses(), 1200);
                } else {
                    allocMsg.style.color = 'var(--error)';
                    allocMsg.textContent = data.error || 'Failed to allocate course.';
                }
            } catch(err) {
                allocMsg.style.color = 'var(--error)';
                allocMsg.textContent = 'Server error.';
            }
        });

    } catch(err) {
        container.innerHTML = '<p class="error-msg">Failed to load courses view.</p>';
    }
}

window.deleteCourse = async function(id) {
    if (!confirm("Are you sure you want to delete this course? This action cannot be undone.")) return;
    try {
        const res = await fetch(`${API_URL}/admin/courses/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }
        });
        if (res.ok) renderAdminCourses();
        else alert('Failed to delete course.');
    } catch (err) {
        alert('Server error.');
    }
}

window.deleteAllocation = async function(id) {
    if (!confirm("Are you sure you want to remove this course allocation?")) return;
    try {
        const res = await fetch(`${API_URL}/admin/allocations/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }
        });
        if (res.ok) renderAdminCourses();
        else alert('Failed to remove allocation.');
    } catch (err) {
        alert('Server error.');
    }
}

async function renderAdminLogs() {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = '<p>Loading logs...</p>';
    try {
        const res = await fetch(`${API_URL}/admin/audit-logs`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }});
        const logs = await res.json();
        
        let html = `
            <h3>System Audit Logs</h3>
            <table>
                <tr><th>Time</th><th>User</th><th>Action</th><th>Details</th><th>IP</th></tr>
                ${logs.map(l => `<tr><td>${new Date(l.created_at).toLocaleString()}</td><td>${l.username || 'System'}</td><td>${l.action}</td><td>${l.details}</td><td>${l.ip_address}</td></tr>`).join('')}
            </table>
        `;
        container.innerHTML = html;
    } catch(err) {
        container.innerHTML = '<p class="error-msg">Failed to load logs.</p>';
    }
}

// --- LECTURER SPECIFIC FUNCTIONS ---
async function renderLecturerCourses() {
    const container = document.getElementById('lecturer-dynamic-content');
    
    const sess = document.getElementById('lec_filter_session')?.value || '2025/2026';
    const sem = document.getElementById('lec_filter_semester')?.value || '';
    const lvl = document.getElementById('lec_filter_level')?.value || '';
    
    try {
        const queryParams = new URLSearchParams({ session: sess });
        if (sem) queryParams.append('semester', sem);
        if (lvl) queryParams.append('level', lvl);
        
        const res = await fetch(`${API_URL}/courses/my-courses?${queryParams.toString()}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }});
        const courses = await res.json();
        
        let filterBar = `
            <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1.2rem; background:#f8fafc; padding:1rem; border-radius:var(--radius-md); border:1px solid var(--border);">
                <div style="flex:1; min-width:140px;">
                    <label style="font-size:0.8rem; font-weight:600;">Academic Session</label>
                    <select id="lec_filter_session" class="input" style="margin-bottom:0;" onchange="renderLecturerCourses()">
                        <option value="2025/2026" ${sess === '2025/2026' ? 'selected' : ''}>2025/2026 Session</option>
                        <option value="2026/2027" ${sess === '2026/2027' ? 'selected' : ''}>2026/2027 Session</option>
                    </select>
                </div>
                <div style="flex:1; min-width:140px;">
                    <label style="font-size:0.8rem; font-weight:600;">Semester</label>
                    <select id="lec_filter_semester" class="input" style="margin-bottom:0;" onchange="renderLecturerCourses()">
                        <option value="" ${sem === '' ? 'selected' : ''}>All Semesters</option>
                        <option value="1" ${sem === '1' ? 'selected' : ''}>1st Semester</option>
                        <option value="2" ${sem === '2' ? 'selected' : ''}>2nd Semester</option>
                    </select>
                </div>
                <div style="flex:1; min-width:140px;">
                    <label style="font-size:0.8rem; font-weight:600;">Level</label>
                    <select id="lec_filter_level" class="input" style="margin-bottom:0;" onchange="renderLecturerCourses()">
                        <option value="" ${lvl === '' ? 'selected' : ''}>All Levels</option>
                        <option value="100" ${lvl === '100' ? 'selected' : ''}>100 Level</option>
                        <option value="200" ${lvl === '200' ? 'selected' : ''}>200 Level</option>
                        <option value="300" ${lvl === '300' ? 'selected' : ''}>300 Level</option>
                        <option value="400" ${lvl === '400' ? 'selected' : ''}>400 Level</option>
                        <option value="500" ${lvl === '500' ? 'selected' : ''}>500 Level</option>
                    </select>
                </div>
            </div>
        `;
        
        if (courses.length === 0) {
            container.innerHTML = filterBar + '<p style="color:var(--text-muted); padding:1rem; text-align:center;">No courses assigned to you for the selected filters.</p>';
            return;
        }
        
        let html = filterBar + `
            <label style="font-weight:600; font-size:0.9rem;">Select a course to grade registered students:</label>
            <select id="lecturer_course_select" class="input-group input" style="margin-top:0.3rem;" onchange="loadCourseStudents(this.value)">
                <option value="">-- Choose Assigned Course --</option>
                ${courses.map(c => {
                    let label = `${c.course_code} - ${c.title} (${c.level}L - Sem ${c.semester})`;
                    if (c.status === 'Rejected') label += ' [REJECTED]';
                    return `<option value="${c.id}">${label}</option>`;
                }).join('')}
            </select>
            <div id="course-status-banner"></div>
            <div id="students-grading-container" style="margin-top: 20px;"></div>
        `;
        container.innerHTML = html;
        
        window.currentLecturerCourses = courses;
    } catch(err) {
        container.innerHTML = '<p class="error-msg">Failed to load your courses.</p>';
    }
}

async function loadCourseStudents(courseId) {
    const container = document.getElementById('students-grading-container');
    const banner = document.getElementById('course-status-banner');
    if (!courseId) {
        container.innerHTML = '';
        banner.innerHTML = '';
        return;
    }
    
    const sess = document.getElementById('lec_filter_session')?.value || '2025/2026';
    
    // Check if rejected
    const courseObj = window.currentLecturerCourses.find(c => c.id == courseId);
    if (courseObj && courseObj.status === 'Rejected') {
        banner.innerHTML = `<div style="background:#fee2e2; color:#991b1b; padding:10px; border-radius:5px; margin-top:10px;">
            <strong>Results Rejected:</strong> ${courseObj.rejection_reason || 'Please review and resubmit.'}
        </div>`;
    } else {
        banner.innerHTML = '';
    }
    
    container.innerHTML = '<p>Loading registered students...</p>';
    try {
        const res = await fetch(`${API_URL}/courses/${courseId}/students?session=${sess}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }});
        const students = await res.json();
        
        if (students.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); padding:1rem; text-align:center;">No students have registered for this course yet in ' + sess + ' session.</p>';
            return;
        }
        
        let html = `
            <form id="grading-form">
                <div class="table-responsive">
                    <table>
                        <tr><th>Matric No</th><th>Name</th><th>Level</th><th>Department</th><th>CA Score (30)</th><th>Exam Score (70)</th></tr>
                        ${students.map((s, i) => {
                            const isApproved = s.status === 'Dept_Approved' || s.status === 'Faculty_Approved';
                            const caVal = s.ca_score !== null ? s.ca_score : '';
                            const examVal = s.exam_score !== null ? s.exam_score : '';
                            const disabled = isApproved ? 'disabled' : '';
                            return `
                            <tr>
                                <td><strong>${s.matric_no}</strong></td>
                                <td>${s.full_name}</td>
                                <td>${s.level}L</td>
                                <td>${s.department}</td>
                                <td>
                                    <input type="hidden" name="student_id[]" value="${s.student_id}">
                                    <input type="number" name="ca_score[]" min="0" max="30" class="input-group input" style="width:80px" value="${caVal}" ${disabled}>
                                </td>
                                <td>
                                    <input type="number" name="exam_score[]" min="0" max="70" class="input-group input" style="width:80px" value="${examVal}" ${disabled}>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </table>
                </div>
                <button type="submit" class="btn primary-btn" style="margin-top: 15px;">Submit Results</button>
                <div id="grading-msg"></div>
            </form>
        `;
        container.innerHTML = html;
        
        document.getElementById('grading-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const studentIds = form.querySelectorAll('input[name="student_id[]"]');
            const caScores = form.querySelectorAll('input[name="ca_score[]"]');
            const examScores = form.querySelectorAll('input[name="exam_score[]"]');
            
            const results = [];
            for (let i = 0; i < studentIds.length; i++) {
                if (caScores[i].value || examScores[i].value) {
                    results.push({
                        student_id: studentIds[i].value,
                        ca_score: caScores[i].value || 0,
                        exam_score: examScores[i].value || 0
                    });
                }
            }
            
            if(results.length === 0) {
                document.getElementById('grading-msg').innerHTML = '<span class="error-msg">Please enter at least one score.</span>';
                return;
            }
            
            document.getElementById('grading-msg').textContent = 'Uploading...';
            
            const reqRes = await fetch(`${API_URL}/results/upload`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('srms_token')}`
                },
                body: JSON.stringify({ course_id: courseId, results })
            });
            const data = await reqRes.json();
            document.getElementById('grading-msg').textContent = data.message || data.error;
            if(reqRes.ok) {
                document.getElementById('grading-msg').style.color = 'green';
            }
        });
        
    } catch(err) {
        container.innerHTML = '<p class="error-msg">Failed to load students.</p>';
    }
}

// --- OFFICER SPECIFIC FUNCTIONS ---
async function renderOfficerPending(role) {
    const container = document.getElementById('officer-dynamic-content');
    try {
        const res = await fetch(`${API_URL}/results/pending`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }});
        const pending = await res.json();
        
        if (pending.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted); padding:1rem; text-align:center;">No pending results for approval at this level.</p>';
            return;
        }
        
        let nextStatus = role === 'Department_Officer' ? 'Dept_Approved' : 'Faculty_Approved';
        
        let html = `
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Course Code</th>
                            <th>Title</th>
                            <th>Department</th>
                            <th>Faculty</th>
                            <th>Level</th>
                            <th>Semester</th>
                            <th>Students</th>
                            <th>Current Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pending.map(p => `
                            <tr>
                                <td><strong>${p.course_code}</strong></td>
                                <td>${p.title}</td>
                                <td>${p.department || '—'}</td>
                                <td>${p.faculty || '—'}</td>
                                <td>${p.level || 100}L</td>
                                <td>Sem ${p.semester || 1}</td>
                                <td>${p.student_count}</td>
                                <td><span class="status-badge" style="background:#fef3c7; color:#92400e;">${p.status}</span></td>
                                <td>
                                    <button class="btn primary-btn" style="padding: 5px 12px; font-size: 0.8rem;" onclick="reviewCourse(${p.course_id}, '${nextStatus}', '${p.course_code}', '${p.title}')">🔍 Review Marks</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div id="approval-msg" style="margin-top: 10px;"></div>
        `;
        container.innerHTML = html;
    } catch(err) {
        container.innerHTML = '<p class="error-msg">Failed to load pending approvals.</p>';
    }
}

window.reviewCourse = async function(courseId, nextStatus, courseCode, courseTitle) {
    const container = document.getElementById('officer-dynamic-content');
    container.innerHTML = `<p>Loading marks for ${courseCode}...</p>`;
    try {
        const res = await fetch(`${API_URL}/results/course/${courseId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }});
        const marks = await res.json();
        
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3>Reviewing ${courseCode} - ${courseTitle}</h3>
                <button class="btn outline-btn" onclick="renderOfficerPending(JSON.parse(localStorage.getItem('srms_user')).role)">⬅️ Back</button>
            </div>
            <div class="table-responsive">
                <table>
                    <tr><th>Matric No</th><th>Name</th><th>CA Score</th><th>Exam Score</th><th>Total</th><th>Grade</th></tr>
                    ${marks.map(m => `<tr><td>${m.matric_no}</td><td>${m.full_name}</td><td>${m.ca_score}</td><td>${m.exam_score}</td><td>${m.total_score}</td><td><strong>${m.grade}</strong></td></tr>`).join('')}
                </table>
            </div>
            
            <div style="margin-top:20px; background:#f9fafb; padding:15px; border-radius:8px; border:1px solid #e5e7eb;">
                <h4>Decision</h4>
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <button class="btn" style="background:var(--secondary); color:white;" onclick="approveCourse(${courseId}, '${nextStatus}')">✅ Approve Results</button>
                    <span style="color:#666">OR</span>
                    <input type="text" id="reject_reason" placeholder="Reason for rejection..." class="input-group input" style="margin-bottom:0; flex:1; min-width:200px;">
                    <button class="btn" style="background:#ef4444; color:white;" onclick="rejectCourse(${courseId})">❌ Reject</button>
                </div>
                <div id="approval-msg" style="margin-top: 10px;"></div>
            </div>
        `;
        container.innerHTML = html;
    } catch(err) {
        container.innerHTML = '<p class="error-msg">Failed to load course marks.</p>';
    }
}

window.approveCourse = async function(courseId, newStatus) {
    document.getElementById('approval-msg').textContent = 'Approving...';
    try {
        const res = await fetch(`${API_URL}/results/approve`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('srms_token')}`
            },
            body: JSON.stringify({ course_id: courseId, new_status: newStatus })
        });
        const data = await res.json();
        document.getElementById('approval-msg').textContent = data.message || data.error;
        if(res.ok) {
            document.getElementById('approval-msg').style.color = 'green';
            setTimeout(() => renderOfficerPending(JSON.parse(localStorage.getItem('srms_user')).role), 1500);
        }
    } catch (err) {
        document.getElementById('approval-msg').textContent = 'Failed to communicate with server.';
    }
}

window.rejectCourse = async function(courseId) {
    const reason = document.getElementById('reject_reason').value;
    if(!reason) {
        alert("Please provide a reason for rejecting these results.");
        return;
    }
    document.getElementById('approval-msg').textContent = 'Rejecting...';
    try {
        const res = await fetch(`${API_URL}/results/reject`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('srms_token')}`
            },
            body: JSON.stringify({ course_id: courseId, message: reason })
        });
        const data = await res.json();
        document.getElementById('approval-msg').textContent = data.message || data.error;
        if(res.ok) {
            document.getElementById('approval-msg').style.color = 'green';
            setTimeout(() => renderOfficerPending(JSON.parse(localStorage.getItem('srms_user')).role), 1500);
        }
    } catch (err) {
        document.getElementById('approval-msg').textContent = 'Failed to communicate with server.';
    }
}

window.renderOfficerApproved = async function(role) {
    const container = document.getElementById('officer-dynamic-content');
    container.innerHTML = '<p>Loading approved results...</p>';
    try {
        const res = await fetch(`${API_URL}/results/approved`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }});
        const approved = await res.json();
        
        if (approved.length === 0) {
            container.innerHTML = '<p>No approved results found.</p>';
            return;
        }
        
        let html = `
            <div class="table-responsive">
                <table>
                    <tr><th>Course Code</th><th>Title</th><th>Students Submitted</th><th>Status</th><th>Action</th></tr>
                    ${approved.map(p => `
                        <tr>
                            <td>${p.course_code}</td>
                            <td>${p.title}</td>
                            <td>${p.student_count}</td>
                            <td>${p.status}</td>
                            <td>
                                <button class="btn primary-btn" style="padding: 5px 10px; font-size: 0.8rem;" onclick="printBroadsheet(${p.course_id}, '${p.course_code}', '${p.title}')">🖨️ Print Broadsheet</button>
                            </td>
                        </tr>
                    `).join('')}
                </table>
            </div>
        `;
        container.innerHTML = html;
    } catch(err) {
        container.innerHTML = '<p class="error-msg">Failed to load approved results.</p>';
    }
}

window.printBroadsheet = async function(courseId, courseCode, courseTitle) {
    try {
        const res = await fetch(`${API_URL}/results/course/${courseId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }});
        const marks = await res.json();
        
        let html = `
            <html>
            <head>
                <title>Result Broadsheet - ${courseCode}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                    th { background-color: #f3f4f6; }
                    h2 { text-align: center; margin-bottom: 5px; }
                    h3 { text-align: center; margin-top: 0; color: #555; }
                </style>
            </head>
            <body>
                <h2>RESULT BROADSHEET</h2>
                <h3>${courseCode} - ${courseTitle}</h3>
                <table>
                    <tr><th>Matric No</th><th>Name</th><th>CA (30)</th><th>Exam (70)</th><th>Total (100)</th><th>Grade</th></tr>
                    ${marks.map(m => `
                        <tr>
                            <td>${m.matric_no}</td>
                            <td>${m.full_name}</td>
                            <td>${m.ca_score}</td>
                            <td>${m.exam_score}</td>
                            <td>${m.total_score}</td>
                            <td>${m.grade}</td>
                        </tr>
                    `).join('')}
                </table>
                <script>window.print();</script>
            </body>
            </html>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
    } catch (err) {
        alert("Failed to fetch marks for printing.");
    }
}

window.printStudentTranscript = async function() {
    try {
        const res = await fetch(`${API_URL}/results/my-results`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('srms_token')}` }
        });
        const data = await res.json();
        if (!res.ok) {
            alert("Failed to load transcript data for printing.");
            return;
        }

        const { student, semesters, cgpa, totalCredits, totalPoints } = data;
        
        let degreeClass = 'First Class Honors';
        const numCgpa = parseFloat(cgpa);
        if (numCgpa < 1.50) degreeClass = 'Fail';
        else if (numCgpa < 2.40) degreeClass = 'Third Class';
        else if (numCgpa < 3.50) degreeClass = 'Second Class Lower (2:2)';
        else if (numCgpa < 4.50) degreeClass = 'Second Class Upper (2:1)';

        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Academic Transcript - ${student.full_name}</title>
                <style>
                    body { font-family: 'Times New Roman', Times, serif; padding: 25px; color: #000; background: #fff; line-height: 1.4; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 3px double #000; padding-bottom: 12px; }
                    .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 1px; }
                    .header h3 { margin: 4px 0 0; font-size: 14px; font-weight: normal; text-transform: uppercase; }
                    .header p { margin: 3px 0 0; font-size: 11px; font-style: italic; color: #444; }
                    
                    .bio-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    .bio-table td { padding: 6px 10px; font-size: 13px; border: 1px solid #000; }
                    .bio-table td.label { font-weight: bold; background: #f0f0f0; width: 22%; }
                    
                    .sem-heading { font-size: 14px; font-weight: bold; margin-top: 18px; margin-bottom: 6px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; }
                    
                    .result-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
                    .result-table th, .result-table td { border: 1px solid #000; padding: 5px 8px; text-align: left; }
                    .result-table th { background-color: #eaeaea; font-weight: bold; text-align: center; font-size: 11px; text-transform: uppercase; }
                    .result-table td.center { text-align: center; }
                    
                    .summary-box { width: 100%; border-collapse: collapse; margin-top: 25px; border: 2px solid #000; }
                    .summary-box td { padding: 10px; font-size: 13px; }
                    
                    .signatures { margin-top: 45px; display: flex; justify-content: space-between; }
                    .sig-block { width: 42%; text-align: center; border-top: 1px dashed #000; padding-top: 5px; font-size: 12px; }
                    
                    @media print {
                        body { padding: 0; }
                        @page { margin: 1.2cm; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>STUDENT RESULT MANAGEMENT SYSTEM</h1>
                    <h3>OFFICIAL STATEMENT OF ACADEMIC RESULTS / TRANSCRIPT</h3>
                    <p>Office of the Registrar • Academic Records Unit • Date Issued: ${new Date().toLocaleDateString()}</p>
                </div>

                <table class="bio-table">
                    <tr>
                        <td class="label">STUDENT NAME:</td>
                        <td><strong>${student.full_name}</strong></td>
                        <td class="label">MATRIC / REG NO:</td>
                        <td><strong>${student.matric_no}</strong></td>
                    </tr>
                    <tr>
                        <td class="label">DEPARTMENT:</td>
                        <td>${student.department || 'N/A'}</td>
                        <td class="label">CURRENT LEVEL:</td>
                        <td>${student.level}L</td>
                    </tr>
                </table>

                ${semesters.map(sem => `
                    <div class="sem-heading">📌 ${sem.semesterName}</div>
                    <table class="result-table">
                        <thead>
                            <tr>
                                <th style="width: 12%;">Code</th>
                                <th>Course Title</th>
                                <th style="width: 18%;">Department</th>
                                <th style="width: 7%;">Units</th>
                                <th style="width: 7%;">CA</th>
                                <th style="width: 7%;">Exam</th>
                                <th style="width: 8%;">Total</th>
                                <th style="width: 7%;">Grade</th>
                                <th style="width: 8%;">Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sem.courses.map(c => `
                                <tr>
                                    <td class="center"><strong>${c.course_code}</strong></td>
                                    <td>${c.title}</td>
                                    <td class="center">${c.course_dept || '—'}</td>
                                    <td class="center">${c.credit_units}</td>
                                    <td class="center">${c.ca_score}</td>
                                    <td class="center">${c.exam_score}</td>
                                    <td class="center"><strong>${c.total_score}</strong></td>
                                    <td class="center"><strong>${c.grade}</strong></td>
                                    <td class="center">${c.point_earned}</td>
                                </tr>
                            `).join('')}
                            <tr style="background-color: #f5f5f5; font-weight: bold;">
                                <td colspan="3" style="text-align: right;">SEMESTER TOTALS:</td>
                                <td class="center">${sem.semCredits}</td>
                                <td colspan="3"></td>
                                <td class="center">SGPA:</td>
                                <td class="center">${sem.sgpa}</td>
                            </tr>
                        </tbody>
                    </table>
                `).join('')}

                <table class="summary-box">
                    <tr>
                        <td style="width: 55%;">
                            <strong>Total Cumulative Units Registered:</strong> ${totalCredits}<br>
                            <strong>Total Cumulative Grade Points Earned:</strong> ${totalPoints}
                        </td>
                        <td style="width: 45%; text-align: right; background-color: #f9f9f9;">
                            <span style="font-size: 15px;">Cumulative GPA (CGPA): <strong>${cgpa} / 5.00</strong></span><br>
                            <span style="font-size: 12px; color: #333;">Degree Classification: <strong>${degreeClass}</strong></span>
                        </td>
                    </tr>
                </table>

                <div class="signatures">
                    <div class="sig-block">
                        <strong>Departmental Examination Officer</strong><br>
                        Signature & Date
                    </div>
                    <div class="sig-block">
                        <strong>Academic Registrar / Dean</strong><br>
                        Signature & Date
                    </div>
                </div>

                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        const printWin = window.open('', '_blank');
        printWin.document.write(html);
        printWin.document.close();
    } catch (err) {
        alert("Could not generate transcript print document.");
    }
}
